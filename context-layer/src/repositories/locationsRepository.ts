import type { LocationRecord } from "@atlas/schema";

/**
 * Consumer-state store port for self-registered operational locations (Step 7,
 * M3). Mirrors `AppsRepository`'s house style: `put` validates
 * (`LocationRecordSchema.parse`) and persists a FULL record. Unlike apps,
 * registrations are per-APP scoped and support DELETE (locked decision 8:
 * `DELETE /api/locations/{id}`), so the port adds `listByApp` + `delete`.
 * The routes are the only writers (M11: no upsert-on-read).
 *
 * STEP 7 BATCH 0 STUB: bodies land in Batch 1
 * (goal_prompt_step7_status_board.md, locked decision 3).
 */
export type LocationsRepository = {
  put(location: unknown): LocationRecord | Promise<LocationRecord>;
  getById(id: string): LocationRecord | undefined | Promise<LocationRecord | undefined>;
  listByApp(appId: string): LocationRecord[] | Promise<LocationRecord[]>;
  delete(id: string): void | Promise<void>;
};

export class InMemoryLocationsRepository implements LocationsRepository {
  put(_location: unknown): LocationRecord {
    throw new Error("unimplemented (Step 7 Batch 1)");
  }

  getById(_id: string): LocationRecord | undefined {
    throw new Error("unimplemented (Step 7 Batch 1)");
  }

  listByApp(_appId: string): LocationRecord[] {
    throw new Error("unimplemented (Step 7 Batch 1)");
  }

  delete(_id: string): void {
    throw new Error("unimplemented (Step 7 Batch 1)");
  }
}
