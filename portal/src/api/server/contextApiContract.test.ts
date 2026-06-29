import { describe, expect, it } from "vitest";
import { ResourceContextResponseSchema } from "@atlas/schema";
import { handleHttpRequest } from "@atlas/context-layer";

import { createFetchContextApiClient } from "./httpContextApiClient";

/**
 * Projection-equivalence proof (ADR-0011): the Portal and an external Skill are
 * two independent Context API consumers that obtain the *same* governed resource
 * projection from the same HTTP surface, with no deployed endpoint (the
 * public-safe proof boundary, ADR-0004). The Portal side uses its real client
 * library; the Skill side drives the documented raw-HTTP sequence from SKILL.md
 * by hand (search the resource, then read its context) — so this is genuinely
 * two consumers, not the same client called twice. It also proves the caller
 * Bearer is forwarded when present and never appears in browser-facing output.
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

/**
 * Issue a single GET exactly as an external agent following SKILL.md would —
 * build the URL and headers by hand, with no Portal client library — and bridge
 * it straight into the real Context Layer HTTP router (the public-safe proof
 * boundary: no deployed endpoint). Records what the server saw on the wire.
 */
async function rawHttpGet(input: {
  path: string;
  query?: Record<string, string>;
  token?: string;
  seen: SeenRequest[];
}): Promise<unknown> {
  const url = new URL(input.path, "http://contract.local");
  for (const [key, value] of Object.entries(input.query ?? {})) {
    url.searchParams.set(key, value);
  }
  const headers: Record<string, string> = input.token
    ? { authorization: `Bearer ${input.token}` }
    : {};

  input.seen.push({ method: "GET", path: url.pathname, authorization: headers.authorization });

  const response = await handleHttpRequest({
    method: "GET",
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers,
  });

  return JSON.parse(response.body);
}

/**
 * The literal SKILL.md consumption sequence (ADR-0011): resolve the resource id
 * by name search, then read that resource's context. No Portal client library is
 * involved — this is the path an independent external agent would follow from
 * the published instructions, so the equivalence proof is genuinely two
 * consumers rather than the same client called twice.
 */
async function consumeViaDocumentedSkillSequence(input: {
  query: string;
  token?: string;
  seen: SeenRequest[];
}): Promise<unknown> {
  // Step 1 (SKILL.md): GET /api/resources?query=<terms> -> pick {kind, slug}.
  const search = (await rawHttpGet({
    path: "/api/resources",
    query: { query: input.query },
    token: input.token,
    seen: input.seen,
  })) as { items?: Array<{ kind: string; slug: string }> };
  const match = search.items?.[0];
  if (!match) {
    throw new Error(`No resource discovered for query "${input.query}".`);
  }

  // Step 2 (SKILL.md): GET /api/resources/{kind}/{slug} -> the projection.
  return rawHttpGet({
    path: `/api/resources/${encodeURIComponent(match.kind)}/${match.slug}`,
    token: input.token,
    seen: input.seen,
  });
}

/** Top-level resolvedAt is the moment THIS projection ran, so it differs per
 *  call; normalize it before asserting two consumers got the same projection. */
function stripResolvedAt(projection: unknown): unknown {
  return { ...(projection as Record<string, unknown>), resolvedAt: "x" };
}

describe("Context API consumer contract", () => {
  it("the Portal client and the documented Skill HTTP sequence return the same projection", async () => {
    const portalSeen: SeenRequest[] = [];
    const skillSeen: SeenRequest[] = [];

    // Portal side: the Portal's real client library against the in-process router.
    const portalClient = createFetchContextApiClient({
      baseUrl: BASE_URL,
      token: CALLER_TOKEN,
      fetch: contextLayerBridge(portalSeen),
    });
    const portalProjection = await portalClient.getResourceContext("service", "aws/textract");

    // Skill side: the literal, library-free SKILL.md sequence (search, then read) —
    // an independent consumer, not the same client invoked twice.
    const skillProjection = await consumeViaDocumentedSkillSequence({
      query: "textract",
      token: CALLER_TOKEN,
      seen: skillSeen,
    });

    // Both projections validate against the shared schema...
    expect(ResourceContextResponseSchema.parse(portalProjection)).toEqual(portalProjection);
    expect(ResourceContextResponseSchema.parse(skillProjection)).toEqual(skillProjection);
    // ...and agree once the per-call projection timestamp is normalized: one
    // contract, two independent consumers (ADR-0011).
    expect(stripResolvedAt(skillProjection)).toEqual(stripResolvedAt(portalProjection));

    // The Skill searched the resource before reading it: two documented GETs.
    expect(skillSeen.map((seen) => seen.path)).toEqual([
      "/api/resources",
      "/api/resources/service/aws/textract",
    ]);
    // The caller Bearer is forwarded on every documented Skill call...
    expect(skillSeen.every((seen) => seen.authorization === `Bearer ${CALLER_TOKEN}`)).toBe(true);
    // ...and on the Portal's resource call, which hits the same endpoint.
    expect(portalSeen[0]?.path).toBe("/api/resources/service/aws/textract");
    expect(portalSeen[0]?.authorization).toBe(`Bearer ${CALLER_TOKEN}`);
  });

  it("omits the Authorization header when the consumer has no token", async () => {
    const seen: SeenRequest[] = [];
    const anonymousClient = createFetchContextApiClient({
      baseUrl: BASE_URL,
      fetch: contextLayerBridge(seen),
    });

    await anonymousClient.getResourceContext("service", "aws/textract");

    expect(seen[0]?.authorization).toBeUndefined();
  });

  it("never leaks the token into the browser-facing projection output", async () => {
    const seen: SeenRequest[] = [];
    const client = createFetchContextApiClient({
      baseUrl: BASE_URL,
      token: CALLER_TOKEN,
      fetch: contextLayerBridge(seen),
    });

    const projection = await client.getResourceContext("service", "aws/textract");

    // The projection is what reaches the browser; the token must not be in it.
    expect(JSON.stringify(projection)).not.toContain(CALLER_TOKEN);
  });
});
