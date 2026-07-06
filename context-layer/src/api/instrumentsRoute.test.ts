import { beforeEach, describe, expect, it } from "vitest";
import { InstrumentsResponseSchema, type ChangeEvent } from "@atlas/schema";
import { handleInstrumentsRequest } from "./instrumentsRoute";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import { recordBriefAssembled, resetMetrics } from "../observability/metrics";

/**
 * D4 + D6 — the honesty dashboard read. Event volume by class is derived at read
 * from the durable events store (the append-only truth, locked decision 7);
 * `GET /api/internal/instruments` returns the full snapshot + the negotiation
 * queue sorted desc (P16/P22). Public-safe fictional data.
 */

function event(id: string, cls: ChangeEvent["class"], landingZoneIds: string[]): ChangeEvent {
  return {
    id,
    class: cls,
    subject: { kind: "service", id: `cloudx/${id}` },
    landingZoneIds,
    rootId: `availability:${landingZoneIds[0]}`,
    graphVersionFrom: "v0",
    graphVersionTo: "v1",
    derivedAt: "2026-07-01T00:00:00.000Z",
  };
}

beforeEach(() => resetMetrics());

describe("instruments dashboard (D4/D6)", () => {
  it("D4: derives event volume by class, agreeing with the seeded events", async () => {
    await sharedEventsRepository(process.env).append([
      event("alpha", "service-added", ["zone-a"]),
      event("beta", "service-added", ["zone-a"]),
      event("gamma", "module-version-changed", ["zone-a"]),
    ]);

    const result = await handleInstrumentsRequest(process.env);
    const body = InstrumentsResponseSchema.parse(result.body);
    const byClass = Object.fromEntries(body.eventVolumeByClass.map((e) => [e.class, e.count]));

    expect(byClass["service-added"]).toBe(2);
    expect(byClass["module-version-changed"]).toBe(1);
    // Every closed class is present with a stable shape (0 when absent).
    expect(byClass["governed-by-added"]).toBe(0);
  });

  it("D6: returns the full snapshot with the negotiation queue sorted desc", async () => {
    recordBriefAssembled({
      moment: "adopt",
      depth: "citations",
      channel: "http",
      durationMs: 5,
      blocks: [
        { status: "unresolved", subjectKind: "service", warningCodes: ["no_registered_source"] },
        { status: "unresolved", subjectKind: "service", warningCodes: ["no_registered_source"] },
        { status: "partial", subjectKind: "guardrail", warningCodes: ["source_unavailable"] },
      ],
    });

    const result = await handleInstrumentsRequest(process.env);
    expect(result.status).toBe(200);
    const body = InstrumentsResponseSchema.parse(result.body);

    expect(body.since).toBeTruthy();
    expect(body.counters.some((c) => c.name === "brief_block_warnings")).toBe(true);
    expect(body.histograms.some((h) => h.name === "brief_time_to_brief_ms")).toBe(true);

    // The "which source next" answer: the busiest gap first.
    expect(body.negotiationQueue[0]).toMatchObject({
      code: "no_registered_source",
      subjectKind: "service",
      count: 2,
    });
    const counts = body.negotiationQueue.map((q) => q.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});
