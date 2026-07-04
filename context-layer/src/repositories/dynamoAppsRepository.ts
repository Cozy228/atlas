import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient as DynamoDBDocumentClientType,
} from "@aws-sdk/lib-dynamodb";
import { AppRecordSchema, type AppRecord } from "@atlas/schema";
import type { AppsRepository } from "./appsRepository";

/**
 * DynamoDB-backed apps store (`APPS_TABLE`), same single-table house style as
 * `DynamoFeedbackRepository`. Key contract:
 *
 *   pk     = `APP#${id}`           sk     = "METADATA"
 *   gsi1pk = "APP"                 gsi1sk = `DECLARED#${declaredAt}#${id}`
 *
 * Consumer state is bounded, so `list()` is a single-partition `gsi1` Query on
 * the constant `APP` partition (not the feedback repo's Scan). Items strip the
 * key attributes and parse back through `AppRecordSchema` on the way out.
 */
const APPS_INDEX_NAME = "gsi1";
const LIST_PARTITION = "APP";

export type DynamoAppsRepositoryInput = {
  tableName: string;
  client?: DynamoDBDocumentClientType;
};

export class DynamoAppsRepository implements AppsRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClientType;

  constructor(input: DynamoAppsRepositoryInput) {
    this.tableName = input.tableName;
    this.client =
      input.client ??
      DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true },
      });
  }

  async put(app: unknown): Promise<AppRecord> {
    const parsed = AppRecordSchema.parse(app);
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: toDynamoItem(parsed) }),
    );
    return parsed;
  }

  async getById(id: string): Promise<AppRecord | undefined> {
    const response = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: appPk(id), sk: "METADATA" } }),
    );
    return parseAppItem(response.Item);
  }

  async list(): Promise<AppRecord[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: APPS_INDEX_NAME,
        KeyConditionExpression: "gsi1pk = :app",
        ExpressionAttributeValues: { ":app": LIST_PARTITION },
      }),
    );
    return (response.Items ?? [])
      .map((item) => parseAppItem(item))
      .filter((app): app is AppRecord => Boolean(app));
  }
}

export function toDynamoItem(app: AppRecord): AppRecord & {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
} {
  return {
    pk: appPk(app.id),
    sk: "METADATA",
    gsi1pk: LIST_PARTITION,
    gsi1sk: `DECLARED#${app.declaredAt}#${app.id}`,
    ...app,
  };
}

function parseAppItem(item: Record<string, unknown> | undefined): AppRecord | undefined {
  if (!item) {
    return undefined;
  }
  const { pk: _pk, sk: _sk, gsi1pk: _gsi1pk, gsi1sk: _gsi1sk, ...app } = item;
  return AppRecordSchema.parse(app);
}

function appPk(id: string): string {
  return `APP#${id}`;
}
