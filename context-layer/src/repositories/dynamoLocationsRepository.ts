import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient as DynamoDBDocumentClientType,
} from "@aws-sdk/lib-dynamodb";
import { LocationRecordSchema, type LocationRecord } from "@atlas/schema";
import type { LocationsRepository } from "./locationsRepository";

/**
 * DynamoDB-backed locations store (`LOCATIONS_TABLE`), same single-table house
 * style as `DynamoAppsRepository`. Key contract:
 *
 *   pk     = `LOC#${id}`                    sk     = "METADATA"
 *   gsi1pk = `APP#${appId}`                 gsi1sk = `REGISTERED#${registeredAt}#${id}`
 *
 * Unlike apps (one constant `APP` partition), locations partition `gsi1` PER APP
 * (`gsi1pk = "APP#<appId>"`), so `listByApp(appId)` is a single-partition Query
 * scoped to that APP — bounded consumer state, ordered by `registeredAt`.
 * `getById` reads the primary key; `delete` is a `DeleteItem` on it. Items strip
 * the key attributes and parse back through `LocationRecordSchema` on the way out.
 */
const LOCATIONS_INDEX_NAME = "gsi1";

export type DynamoLocationsRepositoryInput = {
  tableName: string;
  client?: DynamoDBDocumentClientType;
};

export class DynamoLocationsRepository implements LocationsRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClientType;

  constructor(input: DynamoLocationsRepositoryInput) {
    this.tableName = input.tableName;
    this.client =
      input.client ??
      DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true },
      });
  }

  async put(location: unknown): Promise<LocationRecord> {
    const parsed = LocationRecordSchema.parse(location);
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: toDynamoItem(parsed) }),
    );
    return parsed;
  }

  async getById(id: string): Promise<LocationRecord | undefined> {
    const response = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: locationPk(id), sk: "METADATA" } }),
    );
    return parseLocationItem(response.Item);
  }

  async listByApp(appId: string): Promise<LocationRecord[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: LOCATIONS_INDEX_NAME,
        KeyConditionExpression: "gsi1pk = :app",
        ExpressionAttributeValues: { ":app": appPartition(appId) },
      }),
    );
    return (response.Items ?? [])
      .map((item) => parseLocationItem(item))
      .filter((location): location is LocationRecord => Boolean(location));
  }

  async delete(id: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { pk: locationPk(id), sk: "METADATA" } }),
    );
  }
}

export function toDynamoItem(location: LocationRecord): LocationRecord & {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
} {
  return {
    pk: locationPk(location.id),
    sk: "METADATA",
    gsi1pk: appPartition(location.appId),
    gsi1sk: `REGISTERED#${location.registeredAt}#${location.id}`,
    ...location,
  };
}

function parseLocationItem(item: Record<string, unknown> | undefined): LocationRecord | undefined {
  if (!item) {
    return undefined;
  }
  const { pk: _pk, sk: _sk, gsi1pk: _gsi1pk, gsi1sk: _gsi1sk, ...location } = item;
  return LocationRecordSchema.parse(location);
}

function locationPk(id: string): string {
  return `LOC#${id}`;
}

function appPartition(appId: string): string {
  return `APP#${appId}`;
}
