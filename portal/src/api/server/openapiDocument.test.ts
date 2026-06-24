import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Validator } from "@seriousme/openapi-schema-validator";
import { apiErrorCodes, warningCodes } from "@atlas/schema";
import { handleHttpRequest } from "@atlas/context-layer";

import { buildOpenApiDocument } from "./openapiDocument";

const document = buildOpenApiDocument();

describe("openapi document validity", () => {
  it("is a valid OpenAPI 3.1 document", async () => {
    const validator = new Validator();
    const result = await validator.validate(JSON.parse(JSON.stringify(document)));
    expect(result.errors ?? []).toEqual([]);
    expect(result.valid).toBe(true);
    expect(document.openapi).toMatch(/^3\./);
  });

  it("documents every warning and error code", () => {
    const serialized = JSON.stringify(document);
    for (const code of warningCodes) {
      expect(serialized, `warning code ${code} must be documented`).toContain(code);
    }
    for (const code of apiErrorCodes) {
      expect(serialized, `error code ${code} must be documented`).toContain(code);
    }
  });

  it("marks the Bearer pipe and exposes exactly one mutation endpoint", () => {
    expect(document.components.securitySchemes.bearerPipe.scheme).toBe("bearer");
    const mutations = Object.entries(document.paths).flatMap(([path, methods]) =>
      Object.keys(methods)
        .filter((method) => !["get", "head"].includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`),
    );
    // POST /context-bundle is read-only despite the verb (body-carrying read).
    expect(mutations.sort()).toEqual(["POST /context-bundle", "POST /feedback"]);
  });

  it("uses the public-safe fictional host", () => {
    expect(document.servers[0]?.url).toBe("https://portal.example.com/api");
  });
});

/**
 * Route ↔ OpenAPI parity, both directions.
 *
 * Forward: every documented path dispatches in `handleHttpRequest` (probed —
 * the router's catch-all 404 says "Route was not found.", so any documented
 * path that hits it is a phantom).
 * Reverse: every dispatch in `httpRoute.ts` has a documented path (parsed
 * from the router source; a new dispatch without a spec update fails here).
 */
describe("openapi route parity", () => {
  const PROBE_VALUES: Record<string, string> = {
    topic_id: "aws-textract",
    source_id: "textract-module-readme",
  };
  const PROBE_BODIES: Record<string, unknown> = {
    "/context-bundle": { topic_id: "aws-textract" },
    "/feedback": {
      target_type: "topic",
      target_id: "aws-textract",
      feedback_type: "unclear",
      message: "probe",
    },
  };

  it("every documented path+method is actually dispatched", async () => {
    for (const [template, methods] of Object.entries(document.paths)) {
      const concrete = template.replace(
        /\{([^}]+)\}/g,
        (_, name: string) => PROBE_VALUES[name] ?? "probe",
      );
      for (const method of Object.keys(methods)) {
        const body = PROBE_BODIES[template];
        const response = await handleHttpRequest({
          method: method.toUpperCase(),
          path: concrete,
          body: body ? JSON.stringify(body) : undefined,
        });
        const parsed = JSON.parse(response.body) as {
          error?: { message?: string };
        };
        expect(
          parsed.error?.message,
          `${method.toUpperCase()} ${template} is documented but not dispatched`,
        ).not.toBe("Route was not found.");
      }
    }
  });

  it("every dispatched route is documented", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../../../context-layer/src/api/httpRoute.ts", import.meta.url)),
      "utf8",
    );

    // Static dispatches: if (method === "GET" && path === "/topics")
    const dispatched = new Set<string>();
    for (const match of source.matchAll(/method === "(\w+)" && path === "([^"]+)"/g)) {
      dispatched.add(`${match[1]} ${match[2]}`);
    }
    // Regex dispatches: const m = path.match(/^\/topics\/([^/]+)$/);
    //                   if (method === "GET" && m) ...
    const patterns = new Map<string, string>();
    for (const match of source.matchAll(/const (\w+) = path\.match\(\/(.+?)\/\);/g)) {
      const template = match[2]
        .replace(/\\\//g, "/")
        .replace(/^\^|\$$/g, "")
        .replace(/\(\[\^\/\]\+\)/g, "{param}");
      patterns.set(match[1], template);
    }
    for (const match of source.matchAll(/method === "(\w+)" && (\w+)\b(?!.*path ===)/g)) {
      const template = patterns.get(match[2]);
      if (template) {
        dispatched.add(`${match[1]} ${template}`);
      }
    }
    expect(dispatched.size).toBeGreaterThanOrEqual(9);

    const documented = new Set(
      Object.entries(document.paths).flatMap(([path, methods]) =>
        Object.keys(methods).map(
          (method) => `${method.toUpperCase()} ${path.replace(/\{[^}]+\}/g, "{param}")}`,
        ),
      ),
    );
    for (const route of dispatched) {
      expect(documented, `dispatched route "${route}" is missing from openapi.json`).toContain(
        route,
      );
    }
  });
});
