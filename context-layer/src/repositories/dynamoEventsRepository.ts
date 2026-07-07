import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient as DynamoDBDocumentClientType,
} from "@aws-sdk/lib-dynamodb";
import { ChangeEventSchema, type ChangeEvent } from "@atlas/schema";
import { eventCursor, type EventsRepository } from "./eventsRepository";

/**
 * DynamoDB-backed change-event store (`EVENTS_TABLE`), same single-table house
 * style as the apps/feedback repos. Key contract:
 *
 *   pk     = `EVENT#${id}`          sk     = "METADATA"
 *   gsi1pk = "EVENT"                gsi1sk = `${derivedAt}#${id}`  (eventCursor)
 *
 * Append is an idempotent conditional put (`attribute_not_exists(pk)`): a
 * re-derived event collides on its content-hash id and is a no-op (M1). Reads
 * walk `gsi1` forward from the `since` cursor on the single `EVENT` partition —
 * the change cadence is low (A2), so a single time-ordered partition is the
 * right shape for `since=` incremental reads; revisit only if volume demands it.
 * Append-only: no update, no delete.
 */
const EVENTS_INDEX_NAME = "gsi1";
const LIST_PARTITION = "EVENT";

export type DynamoEventsRepositoryInput = {
  tableName: string;
  client?: DynamoDBDocumentClientType;
};

export class DynamoEventsRepository implements EventsRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClientType;

  constructor(input: DynamoEventsRepositoryInput) {
    this.tableName = input.tableName;
    this.client =
      input.client ??
      DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true },
      });
  }

  async append(events: ChangeEvent[]): Promise<ChangeEvent[]> {
    const appended: ChangeEvent[] = [];
    for (const event of events) {
      try {
        await this.client.send(
          new PutCommand({
            TableName: this.tableName,
            Item: toDynamoItem(event),
            // Idempotent (M1): a re-derived event collides on its content-hash pk
            // and the conditional put is a no-op, never a duplicate row.
            ConditionExpression: "attribute_not_exists(pk)",
          }),
        );
        appended.push(event);
      } catch (error) {
        if (isConditionalCheckFailed(error)) {
          continue; // already appended — idempotent no-op
        }
        throw error;
      }
    }
    return appended;
  }

  async listSince(cursor?: string): Promise<ChangeEvent[]> {
    // Walk the single time-ordered partition forward from the cursor (M1),
    // following `LastEvaluatedKey` to completion: a DynamoDB Query caps each page
    // at ~1MB, so a single QueryCommand would SILENTLY truncate past that boundary
    // — the change feed and the Step-6 event-volume-by-class read must both see the
    // WHOLE feed, never an unlabelled undercount (D4: no silent truncation).
    const items: Record<string, unknown>[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: EVENTS_INDEX_NAME,
          KeyConditionExpression: cursor ? "gsi1pk = :p AND gsi1sk > :since" : "gsi1pk = :p",
          ExpressionAttributeValues: cursor
            ? { ":p": LIST_PARTITION, ":since": cursor }
            : { ":p": LIST_PARTITION },
          ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
        }),
      );
      for (const item of response.Items ?? []) {
        items.push(item);
      }
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return items
      .map((item) => parseEventItem(item))
      .filter((event): event is ChangeEvent => Boolean(event));
  }
}

export function toDynamoItem(event: ChangeEvent): ChangeEvent & {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
} {
  return {
    pk: eventPk(event.id),
    sk: "METADATA",
    gsi1pk: LIST_PARTITION,
    gsi1sk: eventCursor(event),
    ...event,
  };
}

export function parseEventItem(item: Record<string, unknown> | undefined): ChangeEvent | undefined {
  if (!item) {
    return undefined;
  }
  const { pk: _pk, sk: _sk, gsi1pk: _gsi1pk, gsi1sk: _gsi1sk, ...event } = item;
  return ChangeEventSchema.parse(event);
}

function eventPk(id: string): string {
  return `EVENT#${id}`;
}

/** A conditional-put rejection (the id already exists) — the idempotent path. */
function isConditionalCheckFailed(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "ConditionalCheckFailedException"
  );
}

export { EVENTS_INDEX_NAME, LIST_PARTITION };
