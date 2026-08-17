/**
 * Prototype "kimi" — fixture integrity tests.
 *
 * The surfaces derive their state from these fixtures, so the fixtures must be
 * internally coherent and deterministic: every cross-reference resolves, every
 * diagnosis points at a real failed run, and time-based rendering is stable.
 */

import { describe, expect, it } from "vitest";

import {
  APPS,
  APP_MAP,
  ARTIFACT_BUILDS,
  DIAGNOSIS_CASES,
  EXISTING_SERVICE_NAMES,
  GOLDEN_PATH,
  JOURNEYS,
  PEOPLE,
  RUNS,
  SCAFFOLDER_INTENTS,
  SIM_RUN_PLANS,
  SOURCES,
  TEAMS,
  TICKETS,
  freshnessOf,
  timeAgo,
} from "./fixtures";

describe("prototype kimi fixtures", () => {
  it("gives every app a unique id, a known team and a known owner", () => {
    const ids = new Set<string>();
    for (const app of APPS) {
      expect(ids.has(app.id)).toBe(false);
      ids.add(app.id);
      expect(TEAMS[app.teamId], `team for ${app.id}`).toBeDefined();
      expect(PEOPLE[app.ownerId], `owner for ${app.id}`).toBeDefined();
    }
  });

  it("keeps journeys aligned with the golden path stages", () => {
    const stageIds = new Set(GOLDEN_PATH.stages.map((s) => s.id));
    for (const app of APPS) {
      const journey = JOURNEYS[app.id];
      expect(journey, `journey for ${app.id}`).toBeDefined();
      expect(journey.goldenPathId).toBe(GOLDEN_PATH.id);
      expect(journey.stations).toHaveLength(GOLDEN_PATH.stages.length);
      for (const station of journey.stations) {
        expect(stageIds.has(station.stageId)).toBe(true);
      }
    }
  });

  it("resolves every blocker to an existing ticket, person and source", () => {
    const ticketIds = new Set(TICKETS.map((t) => t.id));
    for (const journey of Object.values(JOURNEYS)) {
      for (const station of journey.stations) {
        if (!station.blocker) continue;
        expect(ticketIds.has(station.blocker.ticketId)).toBe(true);
        expect(PEOPLE[station.blocker.waitingOnPersonId]).toBeDefined();
        expect(SOURCES[station.blocker.source]).toBeDefined();
      }
    }
  });

  it("points every diagnosis case at a real failed run of the same app", () => {
    for (const diagnosis of DIAGNOSIS_CASES) {
      const run = RUNS.find((r) => r.id === diagnosis.runId);
      expect(run, `run for diagnosis ${diagnosis.runId}`).toBeDefined();
      expect(run?.status).toBe("failed");
      expect(run?.appId).toBe(diagnosis.appId);
      expect(APP_MAP[diagnosis.appId]).toBeDefined();
      for (const entry of diagnosis.ownership) {
        expect(PEOPLE[entry.ownerId]).toBeDefined();
        expect(TEAMS[entry.teamId]).toBeDefined();
      }
    }
  });

  it("covers every scaffolder intent with a simulated run plan", () => {
    for (const intent of SCAFFOLDER_INTENTS) {
      const plan = SIM_RUN_PLANS[intent.id];
      expect(plan, `plan for ${intent.id}`).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(SOURCES[plan.targetSystem]).toBeDefined();
    }
  });

  it("keeps artifact builds and the name-conflict set consistent with apps", () => {
    for (const build of ARTIFACT_BUILDS) {
      expect(APP_MAP[build.appId], `app for build ${build.id}`).toBeDefined();
    }
    for (const app of APPS) {
      expect(EXISTING_SERVICE_NAMES).toContain(app.id);
    }
  });

  it("renders time deterministically from the fixed reference time", () => {
    expect(timeAgo("2026-08-14T09:11:32Z")).toBe("29m");
    expect(timeAgo("2026-08-11T15:02:00Z")).toBe("2d 19h");
    expect(freshnessOf("2026-08-14T09:10:00Z")).toBe("fresh");
    expect(freshnessOf("2026-08-13T07:20:00Z")).toBe("stale");
  });
});
