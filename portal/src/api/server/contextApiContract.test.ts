import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema, type ContextRequest } from "@atlas/schema";
import { handleHttpRequest } from "@atlas/context-layer";

import { createFetchContextApiClient } from "./httpContextApiClient";

/**
 * Bundle-equivalence proof (ADR-0011): the Portal and an external Skill are two
 * independent Context API consumers that obtain the *same* governed bundle from
 * the same HTTP surface, with no deployed endpoint (the public-safe proof
 * boundary, ADR-0004). The Portal side uses its real client library; the Skill
 * side drives the documented raw-HTTP sequence from SKILL.md by hand (discover
 * the topic, then fetch its context) — so this is genuinely two consumers, not
 * the same client called twice. It also proves the caller Bearer is forwarded
 * when present and never appears in any browser-facing output.
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
 * The literal SKILL.md consumption sequence (ADR-0011): discover the topic id by
 * query, then fetch that topic's context bundle. No Portal client library is
 * involved — this is the path an independent external agent would follow from
 * the published instructions, so the equivalence proof is genuinely two
 * consumers rather than the same client called twice.
 */
async function consumeViaDocumentedSkillSequence(input: {
  query: string;
  token?: string;
  seen: SeenRequest[];
}): Promise<unknown> {
  // Step 1 (SKILL.md): GET /api/topics?query=<terms> -> pick the matching topic id.
  const discovery = (await rawHttpGet({
    path: "/api/topics",
    query: { query: input.query },
    token: input.token,
    seen: input.seen,
  })) as { topics?: Array<{ id: string }> };
  const topicId = discovery.topics?.[0]?.id;
  if (!topicId) {
    throw new Error(`No topic discovered for query "${input.query}".`);
  }

  // Step 2 (SKILL.md): GET /api/topics/{topic_id}/context -> the bundle.
  return rawHttpGet({
    path: `/api/topics/${encodeURIComponent(topicId)}/context`,
    token: input.token,
    seen: input.seen,
  });
}

const request: ContextRequest = { topic_id: "aws-textract", disclosure_level: 1 };

describe("Context API consumer contract", () => {
  it("the Portal client and the documented Skill HTTP sequence return the same governed bundle", async () => {
    const portalSeen: SeenRequest[] = [];
    const skillSeen: SeenRequest[] = [];

    // Portal side: the Portal's real client library against the in-process router.
    const portalClient = createFetchContextApiClient({
      baseUrl: BASE_URL,
      token: CALLER_TOKEN,
      fetch: contextLayerBridge(portalSeen),
    });
    const portalBundle = await portalClient.getContextBundle({ topic_id: "aws-textract" });

    // Skill side: the literal, library-free SKILL.md sequence (discover, then fetch) —
    // an independent consumer, not the same client invoked twice.
    const skillBundle = await consumeViaDocumentedSkillSequence({
      query: "textract",
      token: CALLER_TOKEN,
      seen: skillSeen,
    });

    // Both bundles validate against the shared schema...
    expect(ContextBundleResponseSchema.parse(portalBundle)).toEqual(portalBundle);
    expect(ContextBundleResponseSchema.parse(skillBundle)).toEqual(skillBundle);
    // ...and are byte-identical: one contract, two independent consumers (ADR-0011).
    expect(skillBundle).toEqual(portalBundle);

    // The Skill discovered the topic before fetching it: two documented GETs.
    expect(skillSeen.map((seen) => seen.path)).toEqual([
      "/api/topics",
      "/api/topics/aws-textract/context",
    ]);
    // The caller Bearer is forwarded on every documented Skill call...
    expect(skillSeen.every((seen) => seen.authorization === `Bearer ${CALLER_TOKEN}`)).toBe(true);
    // ...and on the Portal's context call, which hits the same endpoint.
    expect(portalSeen[0]?.path).toBe("/api/topics/aws-textract/context");
    expect(portalSeen[0]?.authorization).toBe(`Bearer ${CALLER_TOKEN}`);
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
