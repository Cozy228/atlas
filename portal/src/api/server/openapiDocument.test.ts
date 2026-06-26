import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Validator } from "@seriousme/openapi-schema-validator";
import { apiErrorCodes, warningCodes } from "@atlas/schema";
import { handleHttpRequest } from "@atlas/context-layer";

import { buildAgentOpenApiDocument, buildInternalOpenApiDocument } from "./openapiDocument";

const agent = buildAgentOpenApiDocument();
const internal = buildInternalOpenApiDocument();

describe("openapi document validity", () => {
  it("both documents are valid OpenAPI 3.1", async () => {
    for (const document of [agent, internal]) {
      const validator = new Validator();
      const result = await validator.validate(JSON.parse(JSON.stringify(document)));
      expect(result.errors ?? []).toEqual([]);
      expect(result.valid).toBe(true);
      expect(document.openapi).toMatch(/^3\./);
    }
  });

  it("the internal document documents every warning and error code", () => {
    const serialized = JSON.stringify(internal);
    for (const code of warningCodes) {
      expect(serialized, `warning code ${code} must be documented`).toContain(code);
    }
    for (const code of apiErrorCodes) {
      expect(serialized, `error code ${code} must be documented`).toContain(code);
    }
  });

  it("the agent document documents every warning code (resource responses surface them)", () => {
    const serialized = JSON.stringify(agent);
    for (const code of warningCodes) {
      expect(serialized, `warning code ${code} must be documented`).toContain(code);
    }
  });

  it("exposes the four agent operations and nothing else", () => {
    const operationIds = Object.values(agent.paths).flatMap((methods) =>
      Object.values(methods).map((operation) => (operation as { operationId: string }).operationId),
    );
    expect(operationIds.sort()).toEqual([
      "getAtlasCapabilityCatalog",
      "getAtlasInstructions",
      "getResourceContext",
      "searchResources",
    ]);
  });

  it("marks the Bearer pipe on both documents", () => {
    expect(agent.components.securitySchemes.bearerPipe.scheme).toBe("bearer");
    expect(internal.components.securitySchemes.bearerPipe.scheme).toBe("bearer");
  });

  it("keeps the single mutation endpoint on internal and none on agent", () => {
    expect(mutationsOf(agent)).toEqual([]);
    // POST /context-bundle is read-only despite the verb (body-carrying read).
    expect(mutationsOf(internal).sort()).toEqual(["POST /context-bundle", "POST /feedback"]);
  });

  it("uses the bare origin for the agent server and the /api base for internal", () => {
    expect(agent.servers[0]?.url).toBe("https://portal.example.com");
    expect(internal.servers[0]?.url).toBe("https://portal.example.com/api");
  });

  it("uses the caller origin when one is supplied", () => {
    expect(buildAgentOpenApiDocument("https://portal.acme.example").servers[0]?.url).toBe(
      "https://portal.acme.example",
    );
    expect(buildInternalOpenApiDocument("https://portal.acme.example").servers[0]?.url).toBe(
      "https://portal.acme.example/api",
    );
  });
});

function mutationsOf(document: { paths: Record<string, Record<string, unknown>> }): string[] {
  return Object.entries(document.paths).flatMap(([path, methods]) =>
    Object.keys(methods)
      .filter((method) => !["get", "head"].includes(method))
      .map((method) => `${method.toUpperCase()} ${path}`),
  );
}

/**
 * Route ↔ OpenAPI parity. The net invariant is `agent ⊆ router == internal`:
 *
 * - agent ⊆ router: every agent `/api/*` path dispatches in `handleHttpRequest`
 *   (the discovery paths `/llms.txt` and `/.well-known/*` are Nitro routes, not
 *   Context-API routes, so they are excluded here).
 * - router == internal: forward — every internal path dispatches; reverse —
 *   every dispatch parsed from `httpRoute.ts` has a documented internal path.
 */
describe("openapi route parity", () => {
  const PROBE_VALUES: Record<string, string> = {
    topic_id: "aws-textract",
    source_id: "textract-module-readme",
    kind: "service",
    slug: "aws/textract",
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

  async function dispatches(template: string, method: string): Promise<boolean> {
    const concrete = template.replace(
      /\{([^}]+)\}/g,
      (_, name: string) => PROBE_VALUES[name] ?? "probe",
    );
    const body = PROBE_BODIES[template];
    const response = await handleHttpRequest({
      method: method.toUpperCase(),
      path: concrete,
      body: body ? JSON.stringify(body) : undefined,
    });
    const parsed = JSON.parse(response.body) as { error?: { message?: string } };
    return parsed.error?.message !== "Route was not found.";
  }

  it("every agent /api/* path dispatches in the router (agent ⊆ router)", async () => {
    for (const [template, methods] of Object.entries(agent.paths)) {
      if (!template.startsWith("/api/")) {
        continue;
      }
      for (const method of Object.keys(methods)) {
        expect(
          await dispatches(template, method),
          `${method.toUpperCase()} ${template} is documented but not dispatched`,
        ).toBe(true);
      }
    }
  });

  it("every internal path+method is actually dispatched (internal ⊆ router)", async () => {
    for (const [template, methods] of Object.entries(internal.paths)) {
      for (const method of Object.keys(methods)) {
        expect(
          await dispatches(template, method),
          `${method.toUpperCase()} ${template} is documented but not dispatched`,
        ).toBe(true);
      }
    }
  });

  it("every dispatched route is documented in the internal document (router ⊆ internal)", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../../../context-layer/src/api/httpRoute.ts", import.meta.url)),
      "utf8",
    );

    // Static dispatches: if (method === "GET" && path === "/topics")
    const dispatched = new Set<string>();
    for (const match of source.matchAll(/method === "(\w+)" && path === "([^"]+)"/g)) {
      dispatched.add(`${match[1]} ${match[2]}`);
    }
    // Regex dispatches: const m = path.match(/^\/topics\/([^/]+)$/); if (method === "GET" && m)
    const patterns = new Map<string, string>();
    for (const match of source.matchAll(/const (\w+) = path\.match\(\/(.+?)\/\);/g)) {
      const template = match[2]
        .replace(/\\\//g, "/")
        .replace(/^\^|\$$/g, "")
        .replace(/\(\[\^\/\]\+\)/g, "{param}")
        // Trailing-slug capture `(.+)` (resource slug spans multiple segments).
        .replace(/\(\.\+\)/g, "{param}");
      patterns.set(match[1], template);
    }
    for (const match of source.matchAll(/method === "(\w+)" && (\w+)\b(?!.*path ===)/g)) {
      const template = patterns.get(match[2]);
      if (template) {
        dispatched.add(`${match[1]} ${template}`);
      }
    }
    expect(dispatched.size).toBeGreaterThanOrEqual(11);

    const documented = new Set(
      Object.entries(internal.paths).flatMap(([path, methods]) =>
        Object.keys(methods).map(
          (method) => `${method.toUpperCase()} ${path.replace(/\{[^}]+\}/g, "{param}")}`,
        ),
      ),
    );
    for (const route of dispatched) {
      expect(
        documented,
        `dispatched route "${route}" is missing from the internal openapi`,
      ).toContain(route);
    }
  });
});
