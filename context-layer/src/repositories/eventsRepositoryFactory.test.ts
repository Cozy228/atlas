import { describe, expect, it } from "vitest";
import { createEventsRepository } from "./eventsRepositoryFactory";
import { InMemoryEventsRepository } from "./eventsRepository";
import { DynamoEventsRepository } from "./dynamoEventsRepository";

/**
 * D8 — the events factory fails fast in production without `EVENTS_TABLE` (the
 * durable change feed must never silently land in memory), and otherwise selects
 * Dynamo-when-configured / in-memory-for-dev — same posture as the apps store.
 */
describe("createEventsRepository (D8)", () => {
  it("EVENTS_TABLE set ⇒ DynamoEventsRepository", () => {
    const repo = createEventsRepository({ EVENTS_TABLE: "atlas-events" });
    expect(repo).toBeInstanceOf(DynamoEventsRepository);
  });

  it("absent + NODE_ENV=production ⇒ throws at construction, naming EVENTS_TABLE", () => {
    expect(() => createEventsRepository({ NODE_ENV: "production" })).toThrowError(/EVENTS_TABLE/);
  });

  it("absent in dev/test ⇒ InMemoryEventsRepository", () => {
    expect(createEventsRepository({})).toBeInstanceOf(InMemoryEventsRepository);
    expect(createEventsRepository({ NODE_ENV: "test" })).toBeInstanceOf(InMemoryEventsRepository);
  });
});
