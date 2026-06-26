/**
 * Resource projection-record loader — reads the Git-managed
 * `data/resources.yaml` control plane and validates it through the shared
 * `@atlas/schema` gate. A record holds only identity + a Section Projection Plan
 * (references to existing Sources/Anchors), never Section content (ADR-0013 §2).
 *
 * Resources load independently of the Topic/Source registry seed, so the
 * registry equivalence oracle is untouched; reference integrity (every binding
 * points at a real Source/Anchor) is asserted by a dedicated wiring test.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { ResourceProjectionRecordSchema, type ResourceProjectionRecord } from "@atlas/schema";
import { resolveDataDir } from "../dataDir";

export const RESOURCES_FILE = "resources.yaml";

/**
 * Load + validate the resource projection records in `dir`. Throws with an
 * actionable message (index + reason) on a malformed record, and rejects
 * duplicate canonical `{kind}/{slug}` ids (proposal §13 consistency).
 */
export function loadResources(dir: string = resolveDataDir()): ResourceProjectionRecord[] {
  const raw = parse(readFileSync(join(dir, RESOURCES_FILE), "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error(`Invalid ${RESOURCES_FILE}: expected a top-level list of resource records.`);
  }

  const records = raw.map((entry, index) => {
    const result = ResourceProjectionRecordSchema.safeParse(entry);
    if (!result.success) {
      throw new Error(
        `Invalid resource record at index ${index} in ${RESOURCES_FILE}: ${result.error.message}`,
      );
    }
    return result.data;
  });

  assertUniqueCanonicalIds(records);
  return records;
}

/** Canonical `{kind}/{slug}` ids for every registered resource (sitemap, §12). */
export function listResourceCanonicalIds(dir?: string): string[] {
  return loadResources(dir).map((record) => `${record.kind}/${record.slug}`);
}

function assertUniqueCanonicalIds(records: ResourceProjectionRecord[]): void {
  const seen = new Set<string>();
  for (const record of records) {
    const id = `${record.kind}/${record.slug}`;
    if (seen.has(id)) {
      throw new Error(`Duplicate canonical resource id: ${id}`);
    }
    seen.add(id);
  }
}
