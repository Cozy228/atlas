/**
 * D7 — NO status value ever reaches a durable store (ADR-0003 + P24) and NO
 * secret field exists anywhere. The board is aggregation-at-read: `assembleStatusBoard`
 * takes the already-loaded registrations + the injected adapters and returns the
 * board WITHOUT touching any repository. This spies the `put`/`append`/`delete`
 * writers of every consumer-state store and proves a status read writes NOTHING —
 * so a live value (which flows through the board) can never be persisted.
 *
 * Red in Batch 0: `assembleStatusBoard` throws `unimplemented`, so the assembly
 * (and thus the spy assertions) fail behaviorally. Green at Batch 4 when the board
 * is a pure at-read aggregation. Public-safe data.
 */
import { describe, expect, it, vi } from "vitest";
import type { LocationRecord, Situation } from "@atlas/schema";
import type { FetchLike } from "../resolvers/resolverTypes";
import type { StatusAdapter, StatusAdapterContext } from "../locations/statusAdapter";
import { InMemoryLocationsRepository } from "../repositories/locationsRepository";
import { InMemoryAppsRepository } from "../repositories/appsRepository";
import { InMemoryEventsRepository } from "../repositories/eventsRepository";
import { assembleStatusBoard } from "./statusBoard";

const SITUATION: Situation = {
  appId: "app-orion",
  landingZoneIds: ["zone-alpha"],
  origin: "by-reference",
};

/** A sentinel that would be unmistakable if it were ever written to a store. */
const SENTINEL_VALUE = "SENTINEL-run-state-applied-42";

const REGISTRATION: LocationRecord = {
  id: "loc-tfe",
  appId: "app-orion",
  system: "tfe",
  kind: "workspace",
  url: "https://flightdeck.example.com/loc-tfe",
  discoveredFrom: "registration",
  registeredAt: "2026-07-06T00:00:00.000Z",
};

function sentinelAdapter(): StatusAdapter {
  return {
    system: "tfe",
    authMode: "service-token",
    allowlistedBase: "https://api.example.com",
    async fetchValue() {
      return SENTINEL_VALUE;
    },
  };
}

const noopFetch: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({}) });
const CTX: StatusAdapterContext = { fetch: noopFetch, env: {} };

describe("D7: a status read writes no value to any store", () => {
  it("assembleStatusBoard performs ZERO writes on every consumer-state store", async () => {
    // Spy every store writer. A value must never reach any of them.
    const locationsPut = vi.spyOn(InMemoryLocationsRepository.prototype, "put");
    const locationsDelete = vi.spyOn(InMemoryLocationsRepository.prototype, "delete");
    const appsPut = vi.spyOn(InMemoryAppsRepository.prototype, "put");
    const eventsAppend = vi.spyOn(InMemoryEventsRepository.prototype, "append");

    const board = await assembleStatusBoard({
      situation: SITUATION,
      registrations: [REGISTRATION],
      adapters: [sentinelAdapter()],
      adapterContext: CTX,
    });

    // The value surfaced in the read-only board...
    expect(board.statuses[0]?.value).toBe(SENTINEL_VALUE);
    // ...but no store writer was ever invoked during the read.
    expect(locationsPut).not.toHaveBeenCalled();
    expect(locationsDelete).not.toHaveBeenCalled();
    expect(appsPut).not.toHaveBeenCalled();
    expect(eventsAppend).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
