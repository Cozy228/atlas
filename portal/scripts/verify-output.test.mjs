import { describe, expect, it } from "vitest";

import {
  findPerformanceBudgetViolations,
  findProductionExclusionViolations,
} from "./verify-output.mjs";

const cleanInput = {
  entries: [
    { kind: "file", path: "public/index.html", content: "<!doctype html>" },
    { kind: "file", path: "server/index.mjs", content: "startPortalServer();" },
  ],
  installedPackageNames: ["@tanstack/react-form", "hono", "vite"],
  packageSections: {
    dependencies: { "@tanstack/react-form": "^1.33.0", hono: "^4.12.32" },
  },
  workspaceRoots: ["/workspace/atlas", "/workspace/atlas/portal"],
};

describe("production output exclusion gate", () => {
  it("accepts a standalone Hono/SPA output and the allowed React Form package", () => {
    expect(findProductionExclusionViolations(cleanInput)).toEqual([]);
  });

  it.each([
    ["TanStack Start", "import('@tanstack/react-start/server')"],
    ["TanStack Start", "import('@tanstack/start')"],
    ["TanStack Start", "createServerFn({ method: 'GET' })"],
    ["Nitro", "const runtime = 'nitro'"],
    ["Nitro", "defineNitroPlugin(() => {})"],
    ["MSW", "import { setupServer } from 'msw/node'"],
    ["devMocks", "import('@atlas/context-layer/devMocks')"],
    ["DEV_MOCKS", "process.env.DEV_MOCKS"],
  ])("rejects the %s identifier in emitted text", (label, content) => {
    const violations = findProductionExclusionViolations({
      ...cleanInput,
      entries: [{ kind: "file", path: "server/index.mjs", content }],
    });

    expect(violations).toContain(`server/index.mjs contains forbidden ${label} identifier`);
  });

  it("rejects symlinks and absolute workspace paths", () => {
    const violations = findProductionExclusionViolations({
      ...cleanInput,
      entries: [
        { kind: "symlink", path: "server/node_modules" },
        {
          kind: "file",
          path: "server/index.mjs",
          content: 'const source = "/workspace/atlas/context-layer/src/index.ts";',
        },
      ],
    });

    expect(violations).toContain("server/node_modules is a forbidden symlink");
    expect(violations).toContain("server/index.mjs contains an absolute workspace path");
  });

  it("rejects forbidden declared and directly installed packages", () => {
    const violations = findProductionExclusionViolations({
      ...cleanInput,
      installedPackageNames: ["@tanstack/react-form", "nitro"],
      packageSections: {
        dependencies: { "@tanstack/react-start": "1.168.26" },
        devDependencies: { msw: "2.14.6" },
      },
    });

    expect(violations).toEqual(
      expect.arrayContaining([
        "dependencies declares forbidden TanStack Start package @tanstack/react-start",
        "devDependencies declares forbidden MSW package msw",
        "portal/node_modules exposes forbidden Nitro package nitro",
      ]),
    );
  });
});

describe("performance budgets", () => {
  it("reports the exact dimension that exceeds its budget", () => {
    const performance = {
      initialHome: { requestCount: 15, transferBytes: 200_000 },
      javascript: { fileCount: 55, transferBytes: 480_000 },
      stylesheets: { fileCount: 1, transferBytes: 21_000 },
    };

    expect(findPerformanceBudgetViolations(performance)).toEqual([
      "initial home JS requests: 15 exceeds budget 14",
    ]);
  });
});
