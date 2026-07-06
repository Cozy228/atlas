import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AppListResponseSchema,
  AvailabilityReadResponseSchema,
  BriefSchema,
  ChangesResponseSchema,
  LocationListResponseSchema,
  ResourceContextResponseSchema,
  StatusBoardResponseSchema,
  type ChangeEvent,
} from "@atlas/schema";
import { handleHttpRequest, sharedEventsRepository } from "@atlas/context-layer";
import { DEV_TERRAFORM_BASE_URL, server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

import { createFetchContextApiClient } from "./httpContextApiClient";
import { serverContextApiClient } from "./inProcessContextApi";

// Post-flip (plan 018 G5) the catalog is the OUTPUT of live discovery, so boot
// the MSW server + point the discovery channels at the fixtures. Reference space
// stays off: the two-consumer parity proof compares live projections, and
// reference discovery stamps a per-call timestamp (kept an honest empty list).
const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

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

  it("D9: the in-process face and the HTTP face return one governed projection from one shared cache", async () => {
    // Transport-wiring guard (Step 1): the Portal's in-process client and the
    // raw HTTP router are two faces of the SAME governed read. Both reads run
    // anonymously so the content cache's auth-digested key is identical across
    // the two faces; the Bearer-threading half of the guard is asserted on the
    // HTTP face below (the in-process face is honest-anonymous until a Portal
    // identity exists — locked decision 7).
    const httpSeen: SeenRequest[] = [];
    const httpProjection = await rawHttpGet({
      path: "/api/resources/service/aws/textract",
      seen: httpSeen,
    });

    // Wire-level cache observability: the HTTP read above (and this file's
    // earlier anonymous reads) already resolved this resource through the
    // shared cache, so a governed in-process read re-fetches NOTHING upstream.
    const upstreamDuringInProcessRead: string[] = [];
    server.events.on("request:start", ({ request }) => {
      if (request.url.startsWith(DEV_TERRAFORM_BASE_URL)) {
        upstreamDuringInProcessRead.push(request.url);
      }
    });
    let inProcessProjection: unknown;
    try {
      inProcessProjection = await serverContextApiClient.getResourceContext(
        "service",
        "aws/textract",
      );
    } finally {
      server.events.removeAllListeners("request:start");
    }

    // Both faces share ONE process-wide content cache: upstream fetch count
    // across the two reads stays at the first read's count.
    expect(upstreamDuringInProcessRead).toEqual([]);

    // Identical governed projection — one contract, two transports (normalize
    // the per-call projection stamp like the equivalence tests above).
    expect(stripResolvedAt(inProcessProjection)).toEqual(stripResolvedAt(httpProjection));

    // The HTTP face threads the caller Bearer where the surface accepts one.
    const bearerSeen: SeenRequest[] = [];
    await rawHttpGet({
      path: "/api/resources/service/aws/textract",
      token: CALLER_TOKEN,
      seen: bearerSeen,
    });
    expect(bearerSeen[0]?.authorization).toBe(`Bearer ${CALLER_TOKEN}`);
  });
});

/**
 * D8 — the Step 3 consumer-state surface obeys the same transport-wiring guard:
 * `GET`/`POST /api/apps` and scoped availability agree between the Portal's
 * in-process client and the raw `handleHttpRequest` router. One governed
 * contract, two transports.
 */
describe("Context API consumer contract — Step 3 consumer state (D8)", () => {
  async function rawAvailabilityZones(query: Record<string, string>): Promise<string[]> {
    const response = await handleHttpRequest({ method: "GET", path: "/api/availability", query });
    return AvailabilityReadResponseSchema.parse(JSON.parse(response.body)).zones.map(
      (zone) => zone.id,
    );
  }

  it("registration agrees: POST via the client, then GET list via both faces", async () => {
    // POST through the Portal's real fetch client (bridged into the router).
    const client = createFetchContextApiClient({
      baseUrl: BASE_URL,
      fetch: contextLayerBridge([]),
    });
    const registered = await client.registerApp({
      name: "Orion Checkout",
      landingZoneIds: ["awsf"],
      serviceSlugs: ["aws/textract"],
    });
    const appId = registered.app.id;
    expect(registered.app.origin).toBe("self-declared");

    // GET list via the raw HTTP router...
    const httpList = await handleHttpRequest({ method: "GET", path: "/api/apps" });
    const httpApps = AppListResponseSchema.parse(JSON.parse(httpList.body)).apps;

    // ...and via the in-process client (same process, same shared store).
    const inProcessApps = (await serverContextApiClient.listApps()).apps;

    expect(httpApps.some((app) => app.id === appId)).toBe(true);
    expect(inProcessApps.some((app) => app.id === appId)).toBe(true);
    // Both faces observe the identical record for the registered id.
    expect(inProcessApps.find((app) => app.id === appId)).toEqual(
      httpApps.find((app) => app.id === appId),
    );
  });

  it("scoped availability agrees: by-value scope narrows to the member zones on both faces", async () => {
    const scope = { landingZones: ["awsf"] };

    const httpZones = await rawAvailabilityZones({ landingZones: "awsf" });
    const inProcessZones = (await serverContextApiClient.getAvailability(scope)).zones.map(
      (zone) => zone.id,
    );

    expect(httpZones).toEqual(["awsf"]);
    expect(inProcessZones).toEqual(["awsf"]);

    // The scoping is real: an unscoped read returns the full topology.
    const unscoped = await rawAvailabilityZones({});
    expect(unscoped.length).toBeGreaterThan(1);
  });
});

/**
 * D9 — the change feed obeys the same transport-wiring guard (Step 2, M8): a
 * seeded event read via `GET /api/changes` and via the Portal's in-process
 * `getChanges` returns one governed, scope-filtered payload on both faces.
 */
describe("Context API consumer contract — Step 2 change feed (D9)", () => {
  function changeEvent(id: string, landingZoneIds: string[], derivedAt: string): ChangeEvent {
    return {
      id,
      class: "service-added",
      subject: { kind: "service", id: `cloudx/${id}` },
      landingZoneIds,
      rootId: `availability:${landingZoneIds[0]}`,
      graphVersionFrom: "v0",
      graphVersionTo: "v1",
      derivedAt,
    };
  }

  it("scoped change feed agrees across the in-process and HTTP faces", async () => {
    await sharedEventsRepository(process.env).append([
      changeEvent("awsf-svc", ["awsf"], "2026-07-01T00:00:00.000Z"),
      changeEvent("azure-svc", ["azuref"], "2026-07-02T00:00:00.000Z"),
    ]);

    const httpBody = ChangesResponseSchema.parse(
      JSON.parse(
        (
          await handleHttpRequest({
            method: "GET",
            path: "/api/changes",
            query: { landingZones: "awsf" },
          })
        ).body,
      ),
    );
    const inProcess = await serverContextApiClient.getChanges({ landingZones: ["awsf"] });

    expect(httpBody.events.map((e) => e.id)).toEqual(["awsf-svc"]);
    expect(inProcess.events.map((e) => e.id)).toEqual(["awsf-svc"]);
    expect(inProcess.events).toEqual(httpBody.events);
    // Per-root substrate freshness (D10) is global (not scope-filtered) and agrees
    // across the two transports — in-process ≡ HTTP for `roots` too.
    expect(inProcess.roots).toEqual(httpBody.roots);
  });
});

/**
 * D9 — the Step 7 status board + self-service registration obey the same
 * transport-wiring guard: `POST/GET /api/locations` and `GET /api/status` agree
 * between the Portal's in-process client and the raw `handleHttpRequest` router.
 * One governed contract, two transports; the value board is uncited + read-only.
 *
 * Red in Batch 0: the location/status routes are unwired + their handlers throw
 * `unimplemented`, so the client calls reject / the router 404s. Green at Batch 1
 * (locations) / Batch 5 (status + wiring). Public-safe fictional data.
 */
describe("Context API consumer contract — Step 7 status + registration (D9)", () => {
  it("registration agrees: POST location via the client, then GET list via both faces", async () => {
    const client = createFetchContextApiClient({
      baseUrl: BASE_URL,
      fetch: contextLayerBridge([]),
    });
    // Register an APP first, then a location scoped to it (a location belongs to an APP).
    const app = await client.registerApp({
      name: "Orion Checkout",
      landingZoneIds: ["awsf"],
      serviceSlugs: ["aws/textract"],
    });
    const appId = app.app.id;

    const registered = await client.registerLocation(
      {
        system: "tfe",
        kind: "workspace",
        url: "https://flightdeck.example.com/app/orion/workspaces/prod",
      },
      { appId },
    );
    expect(registered.location.discoveredFrom).toBe("registration");

    // GET list via the raw HTTP router...
    const httpList = await handleHttpRequest({
      method: "GET",
      path: "/api/locations",
      query: { appId },
    });
    const httpLocations = LocationListResponseSchema.parse(JSON.parse(httpList.body)).locations;
    // ...and via the in-process client (same process, same shared store).
    const inProcessLocations = (await serverContextApiClient.listLocations({ appId })).locations;

    expect(httpLocations.some((loc) => loc.id === registered.location.id)).toBe(true);
    expect(inProcessLocations.find((loc) => loc.id === registered.location.id)).toEqual(
      httpLocations.find((loc) => loc.id === registered.location.id),
    );
  });

  it("the status board agrees across the in-process and HTTP faces for a scope", async () => {
    const httpStatus = await handleHttpRequest({
      method: "GET",
      path: "/api/status",
      query: { landingZones: "awsf" },
    });
    const httpBoard = StatusBoardResponseSchema.parse(JSON.parse(httpStatus.body));
    const inProcessBoard = await serverContextApiClient.getStatus({ landingZones: ["awsf"] });

    // One governed board value, two transports (values uncited + read-only, ADR-0003).
    expect(inProcessBoard.statuses).toEqual(httpBoard.statuses);
  });
});

/**
 * D9/D10 — the moment brief obeys the same transport-wiring guard (Step 4, I3):
 * the Portal's in-process `getBrief`, `GET /api/briefs/{moment}`, and the `.md`
 * render all serialize ONE Brief value for a sampled scope. I3 makes face drift
 * unwritable by construction; this guard proves the wiring. Public-safe fixtures.
 */
describe("Context API consumer contract — Step 4 briefs (D9/D10)", () => {
  it("one Brief value across the in-process and HTTP faces for a sampled scope", async () => {
    const httpResponse = await handleHttpRequest({
      method: "GET",
      path: "/api/briefs/adopt",
      query: { service: "aws/textract", landingZones: "awsf" },
    });
    const httpBrief = BriefSchema.parse(JSON.parse(httpResponse.body));

    const inProcessBrief = await serverContextApiClient.getBrief("adopt", {
      landingZones: ["awsf"],
      service: "aws/textract",
    });

    // One serialized Brief, two transports (normalize the per-call top-level stamp).
    expect(stripResolvedAt(inProcessBrief)).toEqual(stripResolvedAt(httpBrief));
  });

  it("the .md face renders the same Brief value (stable address ≠ stored file)", async () => {
    const markdown = await handleHttpRequest({
      method: "GET",
      path: "/api/briefs/adopt.md",
      query: { service: "aws/textract", landingZones: "awsf" },
    });
    expect(markdown.status).toBe(200);
    expect(markdown.headers["content-type"]).toContain("text/markdown");
    expect(markdown.body.length).toBeGreaterThan(0);
  });
});
