import { afterEach, describe, expect, it, vi } from "vitest";

import { serviceProjection } from "../fixtures/resourceContexts";
import {
  fetchPortalAnnouncements,
  fetchPortalAsk,
  fetchPortalAvailability,
  fetchPortalDataMode,
  fetchPortalGuidance,
  fetchPortalLandingZones,
  fetchPortalReleases,
  fetchPortalResourceCatalog,
  fetchPortalResourceContext,
  fetchPortalResourceRecord,
  fetchPortalSourceDiscovery,
  submitPortalFeedback,
} from "./portalContextApiClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Portal Context API client", () => {
  it("starts a cancellable same-origin catalog request", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, { resources: [] }));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();

    await expect(fetchPortalResourceCatalog({ signal: controller.signal })).resolves.toEqual({
      resources: [],
    });
    expect(fetch).toHaveBeenCalledWith("/api/resources/catalog", {
      method: "GET",
      signal: controller.signal,
    });
  });

  it("rejects a pending catalog request when navigation aborts it", async () => {
    const fetch = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();

    const request = fetchPortalResourceCatalog({ signal: controller.signal });
    controller.abort(new DOMException("Navigation superseded", "AbortError"));

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("posts feedback without a Start server-function transport", async () => {
    const feedback = {
      id: "feedback-1",
      target_type: "resource" as const,
      target_id: "service/aws/textract",
      feedback_type: "missing" as const,
      message: "Add region guidance.",
      submitted_at: "2026-05-11T00:00:00.000Z",
    };
    const fetch = vi.fn(async () => jsonResponse(201, { feedback }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      submitPortalFeedback({
        target_type: feedback.target_type,
        target_id: feedback.target_id,
        feedback_type: feedback.feedback_type,
        message: feedback.message,
      }),
    ).resolves.toEqual({ feedback });
    expect(fetch).toHaveBeenCalledWith(
      "/api/feedback",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("posts Ask Atlas without a Start server-function transport", async () => {
    const body = { answer: "Use the cited control. [source#anchor]", sources: [], warnings: [] };
    const fetch = vi.fn(async () => jsonResponse(200, body));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();

    await expect(
      fetchPortalAsk(
        { resourceSlug: "aws/textract", question: "What applies?" },
        { signal: controller.signal },
      ),
    ).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith("/api/portal/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceSlug: "aws/textract", question: "What applies?" }),
      signal: controller.signal,
    });
  });

  it("queries source discovery through the explicit API", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, { sources: [] }));
    vi.stubGlobal("fetch", fetch);

    await expect(fetchPortalSourceDiscovery({ query: "module" })).resolves.toEqual({
      sources: [],
    });
    expect(fetch).toHaveBeenCalledWith("/api/sources?query=module", { method: "GET" });
  });

  it("preserves slash-separated resource addresses", async () => {
    const record = {
      kind: "service",
      id: "service/aws/textract",
      slug: "aws/textract",
      provider: "aws",
      name: "Amazon Textract",
      aliases: ["Textract"],
      category: "AI Services",
      status: "active",
      description: "Extract text from documents.",
      entry_tools: [],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, record))
      .mockResolvedValueOnce(jsonResponse(200, serviceProjection));
    vi.stubGlobal("fetch", fetch);

    await expect(
      fetchPortalResourceRecord({ kind: "service", slug: "aws/textract" }),
    ).resolves.toEqual(record);
    await expect(
      fetchPortalResourceContext({ kind: "service", slug: "aws/textract" }),
    ).resolves.toEqual(serviceProjection);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/resources/service/aws/textract/record",
      "/api/resources/service/aws/textract",
    ]);
  });

  it("reads each Portal-only query contract", async () => {
    const bodies: Record<string, unknown> = {
      "/api/portal/data-mode": { dataMode: "mock" },
      "/api/portal/landing-zones": { landingZones: [] },
      "/api/portal/availability": { zones: [] },
      "/api/portal/guidance": { guidance: [] },
      "/api/portal/announcements": { announcements: [] },
      "/api/portal/releases": { releases: [] },
    };
    const fetch = vi.fn(async (url: string) => jsonResponse(200, bodies[url]));
    vi.stubGlobal("fetch", fetch);

    await expect(
      Promise.all([
        fetchPortalDataMode(),
        fetchPortalLandingZones(),
        fetchPortalAvailability(),
        fetchPortalGuidance(),
        fetchPortalAnnouncements(),
        fetchPortalReleases(),
      ]),
    ).resolves.toEqual(["mock", [], { zones: [] }, [], [], []]);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(Object.keys(bodies));
  });

  it.each([
    [fetchPortalAvailability, { zones: [{ id: "broken" }] }],
    [fetchPortalGuidance, { guidance: [{ id: 42 }] }],
    [fetchPortalAnnouncements, { announcements: [{ id: 42 }] }],
    [fetchPortalReleases, { releases: [{ id: 42 }] }],
  ])("rejects malformed Portal presentation records", async (request, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, body)),
    );

    await expect(request()).rejects.toThrow(/response is invalid/i);
  });

  it.each([
    ["unknown enum", availabilityBody({ cloud: "gcp" })],
    ["empty required string", availabilityBody({ name: "" })],
    ["non-finite coordinate", availabilityBody({}, { coordinates: [Number.NaN, 0] })],
    ["extra property", availabilityBody({ extra: true })],
  ])("rejects availability with an %s", async (_label, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, body)),
    );

    await expect(fetchPortalAvailability()).rejects.toThrow(/response is invalid/i);
  });
});

function availabilityBody(
  zoneOverrides: Record<string, unknown> = {},
  locationOverrides: Record<string, unknown> = {},
) {
  return {
    zones: [
      {
        id: "awsf",
        name: "AWS Foundation",
        cloud: "aws",
        dataStatus: "available",
        locations: [
          {
            id: "us-east-1",
            label: "US-East-1",
            sub: "North Virginia",
            kind: "region",
            ...locationOverrides,
          },
        ],
        services: [],
        ...zoneOverrides,
      },
    ],
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
