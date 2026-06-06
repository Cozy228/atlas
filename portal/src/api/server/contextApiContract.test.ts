import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema, type ContextRequest } from "@atlas/schema";
import { handleHttpRequest } from "@atlas/context-layer";

import { createFetchContextApiClient } from "./httpContextApiClient.js";

/**
 * Contract test: the Portal and an external Skill are both Context API
 * consumers over the same HTTP surface. This proves they send the same request
 * shape (with the caller Bearer attached when present) and receive the same
 * bundle shape, and that the token never appears in any browser-facing output.
 */

const BASE_URL = "http://contract.local/api";
const CALLER_TOKEN = "fictional-caller-token-123";

type SeenRequest = {
  method: string;
  path: string;
  authorization: string | undefined;
};

/**
 * Bridge a Fetch-style call straight into the real Context Layer HTTP router,
 * capturing what the server observed on the wire.
 */
function contextLayerBridge(seen: SeenRequest[]) {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const parsed = new URL(url);
    const headers = normalizeHeaders(init?.headers);
    const authorization = headers.authorization ?? headers.Authorization;
    const method = init?.method ?? "GET";

    seen.push({ method, path: parsed.pathname, authorization });

    const response = await handleHttpRequest({
      method,
      path: parsed.pathname,
      query: Object.fromEntries(parsed.searchParams.entries()),
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    });

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  };
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

const request: ContextRequest = { topic_id: "aws-textract", disclosure_level: 1 };

describe("Context API consumer contract", () => {
  it("Portal and Skill share one request and bundle shape, with the token attached when present", async () => {
    const portalSeen: SeenRequest[] = [];
    const skillSeen: SeenRequest[] = [];

    const portalClient = createFetchContextApiClient({
      baseUrl: BASE_URL,
      token: CALLER_TOKEN,
      fetch: contextLayerBridge(portalSeen),
    });
    const skillClient = createFetchContextApiClient({
      baseUrl: BASE_URL,
      token: CALLER_TOKEN,
      fetch: contextLayerBridge(skillSeen),
    });

    const portalBundle = await portalClient.getContextBundle(request);
    const skillBundle = await skillClient.getContextBundle(request);

    // Same bundle shape (validated by the shared schema) and same content.
    expect(ContextBundleResponseSchema.parse(portalBundle)).toEqual(portalBundle);
    expect(ContextBundleResponseSchema.parse(skillBundle)).toEqual(skillBundle);
    expect(portalBundle).toEqual(skillBundle);

    // Same request shape on the wire.
    expect(portalSeen[0]?.method).toBe(skillSeen[0]?.method);
    expect(portalSeen[0]?.path).toBe(skillSeen[0]?.path);

    // The caller Bearer is forwarded to the Context API when present.
    expect(portalSeen[0]?.authorization).toBe(`Bearer ${CALLER_TOKEN}`);
    expect(skillSeen[0]?.authorization).toBe(`Bearer ${CALLER_TOKEN}`);
  });

  it("omits the Authorization header when the consumer has no token", async () => {
    const seen: SeenRequest[] = [];
    const anonymousClient = createFetchContextApiClient({
      baseUrl: BASE_URL,
      fetch: contextLayerBridge(seen),
    });

    await anonymousClient.getContextBundle(request);

    expect(seen[0]?.authorization).toBeUndefined();
  });

  it("never leaks the token into the browser-facing bundle output", async () => {
    const seen: SeenRequest[] = [];
    const client = createFetchContextApiClient({
      baseUrl: BASE_URL,
      token: CALLER_TOKEN,
      fetch: contextLayerBridge(seen),
    });

    const bundle = await client.getContextBundle(request);

    // The bundle is what reaches the browser; the token must not be in it.
    expect(JSON.stringify(bundle)).not.toContain(CALLER_TOKEN);
    // And the browser-originated request payload carries no token field.
    expect(Object.keys(request)).not.toContain("token");
  });
});
