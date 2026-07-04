/**
 * D6 — apps repository selection + the prod fail-fast guard (Step 3, mid-level
 * §2; locked decision 3). Durable consumer state must never silently land in
 * memory: `NODE_ENV=production` without `APPS_TABLE` throws at construction.
 * Dev/test with no table falls back in-memory; a configured table selects the
 * Dynamo adapter. (This is where apps do better than the feedback factory's
 * silent in-memory fallback — the noted-not-fixed anti-precedent.)
 */
import { describe, expect, it } from "vitest";
import { InMemoryAppsRepository } from "./appsRepository";
import { DynamoAppsRepository } from "./dynamoAppsRepository";
import { createAppsRepository } from "./appsRepositoryFactory";

describe("D6: createAppsRepository", () => {
  it("throws at construction in production without APPS_TABLE (naming the missing var)", () => {
    expect(() => createAppsRepository({ NODE_ENV: "production" })).toThrow(/APPS_TABLE/);
  });

  it("falls back to the in-memory repository in dev/test without APPS_TABLE", () => {
    expect(createAppsRepository({})).toBeInstanceOf(InMemoryAppsRepository);
    expect(createAppsRepository({ NODE_ENV: "test" })).toBeInstanceOf(InMemoryAppsRepository);
  });

  it("selects the Dynamo repository when APPS_TABLE is configured (even in production)", () => {
    expect(
      createAppsRepository({ NODE_ENV: "production", APPS_TABLE: "atlas-apps" }),
    ).toBeInstanceOf(DynamoAppsRepository);
  });
});
