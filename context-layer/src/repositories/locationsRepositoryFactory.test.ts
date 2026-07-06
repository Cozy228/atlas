/**
 * D3 — locations repository selection + the prod fail-fast guard (Step 7,
 * mid-level §2; locked decision 3). Durable consumer state must never silently
 * land in memory: `NODE_ENV=production` without `LOCATIONS_TABLE` throws at
 * construction, naming the missing var. Dev/test with no table falls back
 * in-memory; a configured table selects the Dynamo adapter.
 *
 * Red in Batch 0: `createLocationsRepository` throws `unimplemented`, so the
 * fall-back + Dynamo-selection assertions fail behaviorally; the prod-throw
 * assertion passes only when the error message names `LOCATIONS_TABLE` (Batch 1).
 */
import { describe, expect, it } from "vitest";
import { InMemoryLocationsRepository } from "./locationsRepository";
import { DynamoLocationsRepository } from "./dynamoLocationsRepository";
import { createLocationsRepository } from "./locationsRepositoryFactory";

describe("D3: createLocationsRepository", () => {
  it("throws at construction in production without LOCATIONS_TABLE (naming the missing var)", () => {
    expect(() => createLocationsRepository({ NODE_ENV: "production" })).toThrow(/LOCATIONS_TABLE/);
  });

  it("falls back to the in-memory repository in dev/test without LOCATIONS_TABLE", () => {
    expect(createLocationsRepository({})).toBeInstanceOf(InMemoryLocationsRepository);
    expect(createLocationsRepository({ NODE_ENV: "test" })).toBeInstanceOf(
      InMemoryLocationsRepository,
    );
  });

  it("selects the Dynamo repository when LOCATIONS_TABLE is configured (even in production)", () => {
    expect(
      createLocationsRepository({ NODE_ENV: "production", LOCATIONS_TABLE: "atlas-locations" }),
    ).toBeInstanceOf(DynamoLocationsRepository);
  });
});
