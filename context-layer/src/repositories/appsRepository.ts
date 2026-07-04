import type { AppRecord } from "@atlas/schema";

/**
 * Consumer-state store port for self-declared APPs (Step 3, P17). Mirrors
 * `FeedbackRepository`'s house style: `put` validates (`AppRecordSchema.parse`)
 * and persists a FULL record — create and update alike, so the PATCH route
 * composes `getById` + `put` and the port stays minimal. No delete in Step 3.
 *
 * STEP 3 BATCH 0 STUB: bodies land in Batch 1
 * (goal_prompt_step3_consumer_state.md, locked decision 3).
 */
export type AppsRepository = {
  put(app: unknown): AppRecord | Promise<AppRecord>;
  getById(id: string): AppRecord | undefined | Promise<AppRecord | undefined>;
  list(): AppRecord[] | Promise<AppRecord[]>;
};

export class InMemoryAppsRepository implements AppsRepository {
  put(_app: unknown): AppRecord {
    throw new Error("unimplemented (Step 3 Batch 1)");
  }

  getById(_id: string): AppRecord | undefined {
    throw new Error("unimplemented (Step 3 Batch 1)");
  }

  list(): AppRecord[] {
    throw new Error("unimplemented (Step 3 Batch 1)");
  }
}
