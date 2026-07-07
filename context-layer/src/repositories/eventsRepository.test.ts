import { describe, expect, it, vi } from "vitest";
import type { ChangeEvent } from "@atlas/schema";
import { InMemoryEventsRepository, eventCursor } from "./eventsRepository";
import { DynamoEventsRepository } from "./dynamoEventsRepository";

/**
 * D7 — the events store is append-only + idempotent (M1): the same event id
 * re-appended is a no-op (a re-derived transition never doubles the feed), and
 * `since=<cursor>` reads walk the time index incrementally. Proven on the
 * in-memory impl and the DynamoDB adapter (mocked client). Public-safe data.
 */

function event(
  id: string,
  derivedAt: string,
  cls: ChangeEvent["class"] = "service-added",
): ChangeEvent {
  return {
    id,
    class: cls,
    subject: { kind: "service", id: "cloudx/parser" },
    landingZoneIds: ["zone-alpha"],
    rootId: "availability:zone-alpha",
    graphVersionFrom: "v0",
    graphVersionTo: "v1",
    derivedAt,
  };
}

describe("InMemoryEventsRepository (D7)", () => {
  it("appends and lists oldest→newest", async () => {
    const repo = new InMemoryEventsRepository();
    await repo.append([
      event("a", "2026-07-01T00:00:00.000Z"),
      event("b", "2026-07-02T00:00:00.000Z"),
    ]);
    const feed = await repo.listSince();
    expect(feed.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("is idempotent: re-appending an existing id adds no row", async () => {
    const repo = new InMemoryEventsRepository();
    await repo.append([event("a", "2026-07-01T00:00:00.000Z")]);
    const newlyAppended = await repo.append([
      event("a", "2026-07-01T00:00:00.000Z"),
      event("c", "2026-07-03T00:00:00.000Z"),
    ]);
    // Only the genuinely-new event is reported as appended.
    expect(newlyAppended.map((e) => e.id)).toEqual(["c"]);
    expect((await repo.listSince()).map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("since=<cursor> returns only events strictly after the cursor", async () => {
    const repo = new InMemoryEventsRepository();
    const a = event("a", "2026-07-01T00:00:00.000Z");
    const b = event("b", "2026-07-02T00:00:00.000Z");
    await repo.append([a, b]);
    expect((await repo.listSince(eventCursor(a))).map((e) => e.id)).toEqual(["b"]);
    expect(await repo.listSince(eventCursor(b))).toEqual([]);
  });
});

describe("DynamoEventsRepository (D7)", () => {
  it("append issues an idempotent conditional put per event", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repo = new DynamoEventsRepository({
      tableName: "atlas-events",
      client: { send } as never,
    });

    await repo.append([event("a", "2026-07-01T00:00:00.000Z")]);

    const putInput = send.mock.calls[0]?.[0]?.input;
    expect(putInput.TableName).toBe("atlas-events");
    expect(putInput.Item.pk).toBe("EVENT#a");
    expect(putInput.Item.gsi1sk).toBe(eventCursor(event("a", "2026-07-01T00:00:00.000Z")));
    // The condition is what makes a duplicate id a no-op.
    expect(putInput.ConditionExpression).toContain("attribute_not_exists");
  });

  it("listSince queries the gsi1 time index forward from the cursor", async () => {
    const send = vi.fn().mockResolvedValue({ Items: [] });
    const repo = new DynamoEventsRepository({
      tableName: "atlas-events",
      client: { send } as never,
    });

    await repo.listSince("2026-07-01T00:00:00.000Z#a");

    const queryInput = send.mock.calls[0]?.[0]?.input;
    expect(queryInput.IndexName).toBe("gsi1");
    expect(queryInput.KeyConditionExpression).toContain("gsi1pk");
    expect(queryInput.KeyConditionExpression).toContain("gsi1sk");
  });

  it("listSince follows LastEvaluatedKey to completion (no silent truncation past 1MB)", async () => {
    // Two pages: the first returns a page + a continuation key, the second drains
    // it. A single-Query walk would drop page two and undercount (D4 forbids that).
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [toItem(event("a", "2026-07-01T00:00:00.000Z"))],
        LastEvaluatedKey: { gsi1pk: "EVENT", gsi1sk: "2026-07-01T00:00:00.000Z#a" },
      })
      .mockResolvedValueOnce({
        Items: [toItem(event("b", "2026-07-02T00:00:00.000Z"))],
      });
    const repo = new DynamoEventsRepository({
      tableName: "atlas-events",
      client: { send } as never,
    });

    const feed = await repo.listSince();

    expect(feed.map((e) => e.id)).toEqual(["a", "b"]);
    expect(send).toHaveBeenCalledTimes(2);
    // The second Query resumes from the first page's continuation key.
    expect(send.mock.calls[1]?.[0]?.input.ExclusiveStartKey).toEqual({
      gsi1pk: "EVENT",
      gsi1sk: "2026-07-01T00:00:00.000Z#a",
    });
  });
});

/** The stored row shape (`toDynamoItem`) the adapter reads back on a query page. */
function toItem(e: ChangeEvent): Record<string, unknown> {
  return {
    pk: `EVENT#${e.id}`,
    sk: "METADATA",
    gsi1pk: "EVENT",
    gsi1sk: eventCursor(e),
    ...e,
  };
}
