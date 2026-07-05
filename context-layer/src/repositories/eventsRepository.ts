import { type ChangeEvent } from "@atlas/schema";

/**
 * The durable change-event store port (Step 2, M1). Append-only + idempotent:
 * an event whose content-hash `id` already exists is a no-op (a re-derived
 * transition never doubles the feed), and nothing is ever updated or deleted.
 * `listSince` walks a time index forward from an opaque cursor, so a
 * `since=<3 weeks ago>` read is served from durable history — which is exactly
 * why events live in DynamoDB, not the K=2 Valkey snapshots (M1 vs M2).
 *
 * Mirrors the feedback/apps house style: interface + in-memory here, DynamoDB
 * adapter + factory (with prod fail-fast) in sibling files.
 */
export type EventsRepository = {
  /** Append idempotently; returns only the events that were NEWLY persisted. */
  append(events: ChangeEvent[]): ChangeEvent[] | Promise<ChangeEvent[]>;
  /** Events strictly after `cursor` (opaque, from {@link eventCursor}),
   *  oldest→newest; absent cursor ⇒ the whole feed. */
  listSince(cursor?: string): ChangeEvent[] | Promise<ChangeEvent[]>;
};

/**
 * The opaque, lexicographically-sortable time cursor for an event: `derivedAt`
 * (ISO, sorts chronologically) + the idempotency id as a tiebreaker for events
 * derived in the same millisecond. This is the `gsi1` sort key of the Dynamo
 * adapter and the `cursor` returned on the feed response.
 */
export function eventCursor(event: ChangeEvent): string {
  return `${event.derivedAt}#${event.id}`;
}

export class InMemoryEventsRepository implements EventsRepository {
  private readonly events = new Map<string, ChangeEvent>();

  append(events: ChangeEvent[]): ChangeEvent[] {
    const appended: ChangeEvent[] = [];
    for (const event of events) {
      // Idempotent on the content-hash id: an existing id is a no-op (M1).
      if (!this.events.has(event.id)) {
        this.events.set(event.id, event);
        appended.push(event);
      }
    }
    return appended;
  }

  listSince(cursor?: string): ChangeEvent[] {
    const ordered = [...this.events.values()].sort((a, b) =>
      eventCursor(a) < eventCursor(b) ? -1 : eventCursor(a) > eventCursor(b) ? 1 : 0,
    );
    return cursor ? ordered.filter((event) => eventCursor(event) > cursor) : ordered;
  }
}
