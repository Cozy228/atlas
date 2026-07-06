import { LocationRecordSchema, type LocationRecord } from "@atlas/schema";

/**
 * Consumer-state store port for self-registered operational locations (Step 7,
 * M3). Mirrors `AppsRepository`'s house style: `put` validates
 * (`LocationRecordSchema.parse`) and persists a FULL record. Unlike apps,
 * registrations are per-APP scoped and support DELETE (locked decision 8:
 * `DELETE /api/locations/{id}`), so the port adds `listByApp` + `delete`.
 * The routes are the only writers (M11: no upsert-on-read).
 */
export type LocationsRepository = {
  put(location: unknown): LocationRecord | Promise<LocationRecord>;
  getById(id: string): LocationRecord | undefined | Promise<LocationRecord | undefined>;
  listByApp(appId: string): LocationRecord[] | Promise<LocationRecord[]>;
  delete(id: string): void | Promise<void>;
};

export class InMemoryLocationsRepository implements LocationsRepository {
  private readonly locations = new Map<string, LocationRecord>();

  put(location: unknown): LocationRecord {
    const parsed = LocationRecordSchema.parse(location);
    this.locations.set(parsed.id, parsed);
    return parsed;
  }

  getById(id: string): LocationRecord | undefined {
    return this.locations.get(id);
  }

  listByApp(appId: string): LocationRecord[] {
    return Array.from(this.locations.values()).filter((location) => location.appId === appId);
  }

  delete(id: string): void {
    this.locations.delete(id);
  }
}
