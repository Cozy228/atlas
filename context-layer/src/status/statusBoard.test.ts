/**
 * D6 — the status board aggregation-at-read (P24). For each registered location:
 * a value fetched through the owning adapter renders as an uncited value; a system
 * with NO adapter, an `authMode: none`, or a failed fetch degrades to a labeled
 * pointer (value null + a `reason`) — never a fabricated value. Values are
 * uncited and visually separable from Evidence (ADR-0003): a `LocationStatus`
 * carries NO citation/evidence field by construction.
 *
 * Red in Batch 0: `assembleStatusBoard` throws `unimplemented`, so every
 * aggregation assertion fails behaviorally. Green at Batch 4. Public-safe data.
 */
import { describe, expect, it } from "vitest";
import type { LocationRecord, Situation } from "@atlas/schema";
import type { FetchLike } from "../resolvers/resolverTypes";
import type { StatusAdapter, StatusAdapterContext } from "../locations/statusAdapter";
import { assembleStatusBoard } from "./statusBoard";

const SITUATION: Situation = {
  appId: "app-orion",
  landingZoneIds: ["zone-alpha"],
  origin: "by-reference",
};

function record(id: string, system: string): LocationRecord {
  return {
    id,
    appId: "app-orion",
    system,
    kind: system === "tfe" ? "workspace" : "dashboard",
    url: `https://${system}.example.com/${id}`,
    discoveredFrom: "registration",
    registeredAt: "2026-07-06T00:00:00.000Z",
  };
}

/** A value-capable adapter whose fetch returns `value` (or null to simulate a
 *  failed fetch degrading to a labeled pointer). */
function fakeAdapter(system: string, value: string | null): StatusAdapter {
  return {
    system,
    authMode: "service-token",
    allowlistedBase: "https://api.example.com",
    async fetchValue() {
      return value;
    },
  };
}

const noopFetch: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({}) });
const CTX: StatusAdapterContext = { fetch: noopFetch, env: {} };

describe("D6: assembleStatusBoard", () => {
  it("renders a live value as an uncited status (no citation/evidence field)", async () => {
    const board = await assembleStatusBoard({
      situation: SITUATION,
      registrations: [record("loc-tfe", "tfe")],
      adapters: [fakeAdapter("tfe", "applied")],
      adapterContext: CTX,
    });

    const status = board.statuses.find((s) => s.location.id === "loc-tfe");
    expect(status?.value).toBe("applied");
    expect(status?.fetchedAt).toBeTruthy();
    // ADR-0003: a value is operational status, never Evidence — no citation rides it.
    expect(status && "citations" in status).toBe(false);
    expect(status && "evidence" in status).toBe(false);
  });

  it("degrades a system with no adapter to a labeled pointer (reason no-adapter)", async () => {
    const board = await assembleStatusBoard({
      situation: SITUATION,
      registrations: [record("loc-dash", "observatory")],
      adapters: [],
      adapterContext: CTX,
    });

    const status = board.statuses.find((s) => s.location.id === "loc-dash");
    expect(status?.value).toBeNull();
    expect(status?.reason).toBe("no-adapter");
    expect(status?.fetchedAt).toBeNull();
  });

  it("degrades a failed value fetch to a labeled pointer (reason fetch-failed), never a lie", async () => {
    const board = await assembleStatusBoard({
      situation: SITUATION,
      registrations: [record("loc-tfe", "tfe")],
      adapters: [fakeAdapter("tfe", null)],
      adapterContext: CTX,
    });

    const status = board.statuses.find((s) => s.location.id === "loc-tfe");
    expect(status?.value).toBeNull();
    expect(status?.reason).toBe("fetch-failed");
  });

  it("echoes the scope and produces one status per registered location", async () => {
    const board = await assembleStatusBoard({
      situation: SITUATION,
      registrations: [record("loc-tfe", "tfe"), record("loc-dash", "observatory")],
      adapters: [fakeAdapter("tfe", "applied")],
      adapterContext: CTX,
    });

    expect(board.situation).toEqual(SITUATION);
    expect(board.statuses.map((s) => s.location.id).sort()).toEqual(["loc-dash", "loc-tfe"]);
  });
});
