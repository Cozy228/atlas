import type { DynamoDBDocumentClient as DynamoDBDocumentClientType } from "@aws-sdk/lib-dynamodb";
import type { LocationRecord } from "@atlas/schema";
import type { LocationsRepository } from "./locationsRepository";

/**
 * DynamoDB-backed locations store (`LOCATIONS_TABLE`), same single-table house
 * style as `DynamoAppsRepository`. Frozen key contract (D3 + the table doc
 * `docs/architecture/dynamodb_locations_table.md`, written in Batch 1):
 *
 *   pk     = `LOC#${id}`                         sk     = "METADATA"
 *   gsi1pk = `APP#${appId}`                      gsi1sk = `REGISTERED#${registeredAt}#${id}`
 *
 * `listByApp(appId)` QUERIES `gsi1` on the per-APP `gsi1pk = "APP#<appId>"`
 * partition (bounded consumer state — a single-partition Query, not a Scan);
 * `getById` reads the primary key; `delete` is a `DeleteItem` on the primary key.
 * Items strip the key attributes and parse back through `LocationRecordSchema`.
 *
 * STEP 7 BATCH 0 STUB: bodies land in Batch 1.
 */
export type DynamoLocationsRepositoryInput = {
  tableName: string;
  client?: DynamoDBDocumentClientType;
};

export class DynamoLocationsRepository implements LocationsRepository {
  constructor(_input: DynamoLocationsRepositoryInput) {
    throw new Error("unimplemented (Step 7 Batch 1)");
  }

  async put(_location: unknown): Promise<LocationRecord> {
    throw new Error("unimplemented (Step 7 Batch 1)");
  }

  async getById(_id: string): Promise<LocationRecord | undefined> {
    throw new Error("unimplemented (Step 7 Batch 1)");
  }

  async listByApp(_appId: string): Promise<LocationRecord[]> {
    throw new Error("unimplemented (Step 7 Batch 1)");
  }

  async delete(_id: string): Promise<void> {
    throw new Error("unimplemented (Step 7 Batch 1)");
  }
}
