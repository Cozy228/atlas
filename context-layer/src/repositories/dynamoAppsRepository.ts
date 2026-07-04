import type { DynamoDBDocumentClient as DynamoDBDocumentClientType } from "@aws-sdk/lib-dynamodb";
import type { AppRecord } from "@atlas/schema";
import type { AppsRepository } from "./appsRepository";

/**
 * DynamoDB-backed apps store (`APPS_TABLE`), same single-table house style as
 * `DynamoFeedbackRepository`. Frozen key contract (D7 + the table doc
 * `docs/architecture/dynamodb_apps_table.md`, written in Batch 1):
 *
 *   pk     = `APP#${id}`                         sk     = "METADATA"
 *   gsi1pk = "APP"                               gsi1sk = `DECLARED#${declaredAt}#${id}`
 *
 * `list()` QUERIES `gsi1` on the constant `gsi1pk = "APP"` partition (bounded
 * consumer state — a single-partition Query, not the feedback repo's Scan).
 * `getById` reads the primary key; items strip the key attributes and parse
 * back through `AppRecordSchema` on the way out.
 *
 * STEP 3 BATCH 0 STUB: bodies land in Batch 1.
 */
export type DynamoAppsRepositoryInput = {
  tableName: string;
  client?: DynamoDBDocumentClientType;
};

export class DynamoAppsRepository implements AppsRepository {
  constructor(_input: DynamoAppsRepositoryInput) {
    throw new Error("unimplemented (Step 3 Batch 1)");
  }

  async put(_app: unknown): Promise<AppRecord> {
    throw new Error("unimplemented (Step 3 Batch 1)");
  }

  async getById(_id: string): Promise<AppRecord | undefined> {
    throw new Error("unimplemented (Step 3 Batch 1)");
  }

  async list(): Promise<AppRecord[]> {
    throw new Error("unimplemented (Step 3 Batch 1)");
  }
}
