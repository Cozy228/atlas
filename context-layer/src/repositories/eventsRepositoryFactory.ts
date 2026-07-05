import { DynamoEventsRepository } from "./dynamoEventsRepository";
import { InMemoryEventsRepository, type EventsRepository } from "./eventsRepository";

/**
 * Select the events repository by environment (Step 2, M1), same fail-fast
 * posture as the apps store:
 *
 *   - `EVENTS_TABLE` set                    → `DynamoEventsRepository` (durable)
 *   - absent + `NODE_ENV === "production"`  → THROW at construction. The change
 *     feed is durable history — it must never silently land in memory where a
 *     task restart erases it. The error names `EVENTS_TABLE` so the
 *     misconfiguration is diagnosable from the log alone.
 *   - absent otherwise                      → `InMemoryEventsRepository` (dev/test).
 */
export function createEventsRepository(env: Record<string, string | undefined>): EventsRepository {
  const tableName = env.EVENTS_TABLE;
  if (tableName) {
    return new DynamoEventsRepository({ tableName });
  }
  if (env.NODE_ENV === "production") {
    throw new Error(
      "EVENTS_TABLE is not configured in production; the durable change feed must not " +
        "silently land in memory. Set EVENTS_TABLE to the provisioned DynamoDB table.",
    );
  }
  return new InMemoryEventsRepository();
}

/**
 * The process-shared events store: ONE instance per process, memoized like
 * `sharedAppsRepository` (module scope, first-env wins), so the transition
 * winner (write path) and the change-feed route (read path) resolve THIS
 * instance and a just-derived event is immediately visible to a `since=` read.
 */
let sharedRepository: EventsRepository | undefined;

export function sharedEventsRepository(env: Record<string, string | undefined>): EventsRepository {
  return (sharedRepository ??= createEventsRepository(env));
}
