import { describe, expect, it } from "vitest";

import { APP_REFUND_API, APP_SEARCH_INDEXER } from "./index";
import { attentionItems, journeySummary, provenanceMix, stepsByPhase } from "./derive";

describe("journeySummary", () => {
  it("counts applicable steps, excluding off-branch", () => {
    const summary = journeySummary(APP_REFUND_API);
    // 17 total steps, 1 off-branch → 16 applicable
    expect(summary.applicable).toBe(16);
  });

  it("counts verified and confirmed as complete", () => {
    const summary = journeySummary(APP_REFUND_API);
    expect(summary.complete).toBeGreaterThan(0);
    expect(summary.complete).toBeLessThan(summary.applicable);
  });

  it("counts waived steps separately from complete", () => {
    const summary = journeySummary(APP_REFUND_API);
    expect(summary.waived).toBe(1); // license-gate
  });

  it("identifies the blocking step using the worst-first ladder", () => {
    const summary = journeySummary(APP_REFUND_API);
    // The first-dev-deploy step is failed, which is the worst state.
    expect(summary.blockingStep?.id).toBe("first-dev-deploy");
    expect(summary.blockingStep?.state).toBe("failed");
  });

  it("reports no blocking step for a completed journey", () => {
    const summary = journeySummary(APP_SEARCH_INDEXER);
    expect(summary.blockingStep).toBeUndefined();
    expect(summary.outstanding).toBe(0);
  });

  it("progress is between 0 and 1", () => {
    for (const app of [APP_REFUND_API, APP_SEARCH_INDEXER]) {
      const summary = journeySummary(app);
      expect(summary.progress).toBeGreaterThanOrEqual(0);
      expect(summary.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe("attentionItems", () => {
  it("ranks failure above blocked, blocked above waiting", () => {
    const items = attentionItems(APP_REFUND_API);
    const failureIdx = items.findIndex((i) => i.kind === "failure");
    const blockedIdx = items.findIndex((i) => i.kind === "blocked");
    const waitingIdx = items.findIndex((i) => i.kind === "waiting");
    expect(failureIdx).toBeLessThan(blockedIdx);
    expect(blockedIdx).toBeLessThan(waitingIdx);
  });

  it("returns an empty list for a completed journey", () => {
    const items = attentionItems(APP_SEARCH_INDEXER);
    // The operating app has no failures, no blocked, no waiting, no attention advisories.
    expect(items.filter((i) => i.urgency <= 2)).toHaveLength(0);
  });

  it("includes data-quality items for stale context facts", () => {
    const items = attentionItems(APP_REFUND_API);
    const dq = items.find((i) => i.kind === "data-quality");
    expect(dq).toBeDefined();
    // The cost-centre fact is aging with a caveat.
    expect(dq?.title).toContain("Cost centre");
  });

  it("every attention item has a title and a why", () => {
    for (const app of [APP_REFUND_API, APP_SEARCH_INDEXER]) {
      for (const item of attentionItems(app)) {
        expect(item.title).toBeTruthy();
        expect(item.why).toBeTruthy();
      }
    }
  });
});

describe("stepsByPhase", () => {
  it("groups steps under their phase in fixture order", () => {
    const groups = stepsByPhase(APP_REFUND_API);
    expect(groups.length).toBe(APP_REFUND_API.journey.phases.length);
    for (const group of groups) {
      for (const step of group.steps) {
        expect(step.phaseId).toBe(group.phase.id);
      }
    }
  });

  it("every step appears in exactly one phase group", () => {
    for (const app of [APP_REFUND_API, APP_SEARCH_INDEXER]) {
      const groups = stepsByPhase(app);
      const grouped = groups.flatMap((g) => g.steps.map((s) => s.id));
      const all = app.journey.steps.map((s) => s.id);
      expect(grouped.sort()).toEqual(all.sort());
    }
  });
});

describe("provenanceMix", () => {
  it("counts each provenance kind in the context", () => {
    const mix = provenanceMix(APP_REFUND_API.context);
    expect(mix.observed).toBeGreaterThan(0);
    expect(mix.atlas).toBeGreaterThan(0);
    expect(mix.unknown).toBeGreaterThanOrEqual(1); // secret scope
  });

  it("sum of all kinds equals the number of facts", () => {
    for (const app of [APP_REFUND_API, APP_SEARCH_INDEXER]) {
      const mix = provenanceMix(app.context);
      const total = mix.observed + mix.derived + mix.declared + mix.atlas + mix.unknown;
      expect(total).toBe(app.context.length);
    }
  });
});

describe("fixture invariants", () => {
  it("every step references a valid phase", () => {
    for (const app of [APP_REFUND_API, APP_SEARCH_INDEXER]) {
      const phaseIds = new Set(app.journey.phases.map((p) => p.id));
      for (const step of app.journey.steps) {
        expect(phaseIds.has(step.phaseId)).toBe(true);
      }
    }
  });

  it("every step has a non-empty holder label", () => {
    for (const app of [APP_REFUND_API, APP_SEARCH_INDEXER]) {
      for (const step of app.journey.steps) {
        expect(step.holder.label).toBeTruthy();
      }
    }
  });

  it("every diagnosis cause has a confidence between 0 and 1", () => {
    for (const app of [APP_REFUND_API, APP_SEARCH_INDEXER]) {
      for (const dx of app.diagnoses) {
        for (const cause of dx.causes) {
          expect(cause.confidence).toBeGreaterThanOrEqual(0);
          expect(cause.confidence).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("every intent field has a non-empty reason", () => {
    for (const app of [APP_REFUND_API, APP_SEARCH_INDEXER]) {
      for (const intent of app.intents) {
        for (const field of intent.fields) {
          expect(field.reason).toBeTruthy();
        }
      }
    }
  });

  it("both applications use the same golden path version", () => {
    expect(APP_REFUND_API.journey.version).toBe(APP_SEARCH_INDEXER.journey.version);
    expect(APP_REFUND_API.journey.goldenPathId).toBe(APP_SEARCH_INDEXER.journey.goldenPathId);
  });
});
