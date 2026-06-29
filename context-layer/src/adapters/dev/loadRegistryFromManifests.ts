/**
 * Manifest loader — reads the Git-managed `data/*.yaml` registry control plane,
 * validates it through the shared `@atlas/schema` gate, and returns a
 * `RegistrySeed` so it feeds straight into `createInMemoryRegistry`. An invalid
 * manifest fails fast with file + id + reason.
 *
 * This is the only place the registry touches the filesystem. The schema-side
 * validators stay pure/fs-free (ADR-0007): we parse YAML here and hand plain
 * objects to `validateRegistryManifest`.
 *
 * Feedback ships as authored initial state in `feedback.yaml`; it is validated
 * downstream by `createInMemoryRegistry` (the registry-manifest gate covers the
 * authored sources/topics/mappings).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { validateRegistryManifest } from "@atlas/schema";
import { resolveDataDir } from "./dataDir";
import type { RegistrySeed } from "./inMemoryRegistry";

// The Git-managed registry dir, resolved across dev / bundled server / Docker
// with no required env — see resolveDataDir.
export const DATA_DIR = resolveDataDir();

function readYaml(dir: string, file: string): unknown {
  return parse(readFileSync(join(dir, file), "utf8"));
}

/**
 * Load + validate the registry manifests in `dir` and return a `RegistrySeed`.
 * Throws with an actionable, multi-line message listing every blocking issue
 * (file + id + reason) when validation fails.
 */
export function loadRegistryFromManifests(dir: string = DATA_DIR): RegistrySeed {
  // Honest-gap: with no manifests present (e.g. a deploy before a live adapter is
  // configured) contribute an empty registry rather than throwing — missing data
  // is an honest gap, not a crash. Malformed data still fails fast below.
  if (!existsSync(join(dir, "sources.yaml"))) {
    return { sources: [], topics: [], mappings: [], feedback: [] };
  }

  const { sources, topics, mappings, issues } = validateRegistryManifest({
    sources: readYaml(dir, "sources.yaml"),
    topics: readYaml(dir, "topics.yaml"),
    mappings: readYaml(dir, "source-topic-mappings.yaml"),
  });

  const errors = issues.filter((issue) => issue.level === "error");
  if (errors.length > 0) {
    throw new Error(
      `Invalid registry manifest in ${dir}:\n` +
        errors.map((error) => `  - ${error.path}: ${error.message}`).join("\n"),
    );
  }

  const feedback = readYaml(dir, "feedback.yaml");
  if (!Array.isArray(feedback)) {
    throw new Error(`Invalid feedback.yaml in ${dir}: expected a top-level list of records.`);
  }

  return { sources, topics, mappings, feedback };
}
