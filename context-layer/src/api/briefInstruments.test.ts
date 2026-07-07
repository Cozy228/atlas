import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangeEvent, MetricCounterSample, MetricHistogramSample } from "@atlas/schema";
import { handleHttpRequest } from "./httpRoute";
import { handleBriefRequest } from "./briefsRoute";
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { assembleBrief } from "../briefs/assembleBrief";
import type { BriefPlan } from "../briefs/briefTypes";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import { logger } from "../observability/logging";
import { resetMetrics, snapshot } from "../observability/metrics";
import { setDevDiscoveryEnv } from "../devMocks";

/**
 * D2 + D3 — the brief instruments. Every assembled brief feeds the registry at the
 * SAME call-sites that log (locked decision 1): time-to-brief, block status +
 * warning-code counters, agent call share, and `brief_payload_est_tokens` on both
 * JSON and markdown faces — each labelled with the producing face (channel, D2)
 * and the depth tier. Driven against the MSW discovery fixtures (`aws/textract`).
 */

const savedEnv = { ...process.env };
beforeAll(() => {
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
});
afterAll(() => {
  process.env = savedEnv;
});
beforeEach(() => resetMetrics());

function histogram(
  name: string,
  match: (labels: MetricHistogramSample["labels"]) => boolean,
): MetricHistogramSample | undefined {
  return snapshot().histograms.find((h) => h.name === name && match(h.labels));
}

function counter(
  name: string,
  match: (labels: MetricCounterSample["labels"]) => boolean,
): MetricCounterSample | undefined {
  return snapshot().counters.find((c) => c.name === name && match(c.labels));
}

describe("brief instruments (D3)", () => {
  it("records time-to-brief, call share, block counters, and the JSON payload for an adopt brief", async () => {
    await handleHttpRequest({
      method: "GET",
      path: "/api/briefs/adopt",
      query: { service: "aws/textract", landingZones: "awsf" },
    });

    // time-to-brief histogram, labelled {moment, depth, channel} (locked decision 3).
    const ttb = histogram(
      "brief_time_to_brief_ms",
      (l) => l.moment === "adopt" && l.depth === "citations" && l.channel === "http",
    );
    expect(ttb?.count).toBe(1);

    // Agent call share (P20): one call on the http face.
    expect(counter("brief_calls", (l) => l.moment === "adopt" && l.channel === "http")?.value).toBe(
      1,
    );

    // Per-block status counters (locked decision 4).
    expect(snapshot().counters.some((c) => c.name === "brief_blocks")).toBe(true);

    // JSON-face token estimate, per {moment, depth, channel, face} (locked decision 5).
    const json = histogram(
      "brief_payload_est_tokens",
      (l) => l.face === "json" && l.moment === "adopt" && l.channel === "http",
    );
    expect(json?.count).toBe(1);
    expect(json?.sum ?? 0).toBeGreaterThan(0);
  });

  it("records the markdown-face payload on the .md render", async () => {
    await handleHttpRequest({
      method: "GET",
      path: "/api/briefs/adopt.md",
      query: { service: "aws/textract", landingZones: "awsf" },
    });
    expect(
      histogram("brief_payload_est_tokens", (l) => l.face === "markdown" && l.moment === "adopt"),
    ).toBeTruthy();
  });

  it("feeds the negotiation queue: a subject with no content projection is an unresolved + warned block, grouped by code × subjectKind", async () => {
    const ctx = await createResolutionContext({ channel: "http" });
    // A scope entity has no content projection (assembleBrief.resolveBlock) — a
    // deterministic `source_unavailable` warning with subjectKind = the subject kind.
    const plan: BriefPlan = {
      moment: "adopt",
      situation: { landingZoneIds: [], origin: "by-value" },
      depth: "citations",
      requests: [{ subject: { kind: "landingZone", id: "zone-x" }, sections: [] }],
    };
    await assembleBrief(plan, ctx);

    expect(
      counter(
        "brief_block_warnings",
        (l) => l.code === "source_unavailable" && l.subjectKind === "landingZone",
      )?.value,
    ).toBe(1);
    expect(counter("brief_blocks", (l) => l.status === "unresolved")?.value).toBe(1);
  });

  it("instruments the change moment, which self-times outside assembleBrief", async () => {
    const changeEvent: ChangeEvent = {
      id: "chg-instr-1",
      class: "service-added",
      subject: { kind: "service", id: "cloudx/parser" },
      landingZoneIds: ["awsf"],
      rootId: "availability:awsf",
      graphVersionFrom: "v0",
      graphVersionTo: "v1",
      derivedAt: "2026-07-01T00:00:00.000Z",
    };
    await sharedEventsRepository(process.env).append([changeEvent]);

    const ctx = await createResolutionContext({
      scope: { kind: "by-value", landingZones: ["awsf"] },
      channel: "http",
    });
    await handleBriefRequest("change", ctx, {});

    // The change path never touches assembleBrief, so it must record its own
    // time-to-brief + block counters (locked decisions 3 + 4).
    expect(
      histogram("brief_time_to_brief_ms", (l) => l.moment === "change" && l.channel === "http")
        ?.count,
    ).toBe(1);
    expect(counter("brief_blocks", (l) => l.status === "available")?.value).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      counter("brief_calls", (l) => l.moment === "change" && l.channel === "http")?.value,
    ).toBe(1);
  });
});

describe("channel attribution (D2)", () => {
  it("lands the mcp channel on the brief metrics", async () => {
    const ctx = await createResolutionContext({
      scope: { kind: "by-value", landingZones: ["awsf"] },
      channel: "mcp",
    });
    await handleBriefRequest("adopt", ctx, { service: "aws/textract" });

    expect(histogram("brief_time_to_brief_ms", (l) => l.channel === "mcp")).toBeTruthy();
    expect(counter("brief_calls", (l) => l.channel === "mcp")?.value).toBe(1);
  });

  it("the assembleBrief log line carries channel + depth", async () => {
    const spy = vi.spyOn(logger("briefs"), "info");
    const ctx = await createResolutionContext({
      scope: { kind: "by-value", landingZones: ["awsf"] },
      channel: "portal",
    });
    await handleBriefRequest("adopt", ctx, { service: "aws/textract", depth: "excerpts" });

    const logged = spy.mock.calls.find(
      ([obj]) => obj && typeof obj === "object" && "moment" in (obj as Record<string, unknown>),
    );
    expect(logged?.[0]).toMatchObject({ moment: "adopt", channel: "portal", depth: "excerpts" });
    spy.mockRestore();
  });
});
