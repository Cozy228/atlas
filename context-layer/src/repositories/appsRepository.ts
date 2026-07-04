import { AppRecordSchema, type AppRecord } from "@atlas/schema";

/**
 * Consumer-state store port for self-declared APPs (Step 3, P17). Mirrors
 * `FeedbackRepository`'s house style: `put` validates (`AppRecordSchema.parse`)
 * and persists a FULL record — create and update alike, so the PATCH route
 * composes `getById` + `put` and the port stays minimal. No delete in Step 3.
 */
export type AppsRepository = {
  put(app: unknown): AppRecord | Promise<AppRecord>;
  getById(id: string): AppRecord | undefined | Promise<AppRecord | undefined>;
  list(): AppRecord[] | Promise<AppRecord[]>;
};

export class InMemoryAppsRepository implements AppsRepository {
  private readonly apps = new Map<string, AppRecord>();

  put(app: unknown): AppRecord {
    const parsed = AppRecordSchema.parse(app);
    this.apps.set(parsed.id, parsed);
    return parsed;
  }

  getById(id: string): AppRecord | undefined {
    return this.apps.get(id);
  }

  list(): AppRecord[] {
    return Array.from(this.apps.values());
  }
}
