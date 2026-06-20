/**
 * Manifest loader — reads the Git-managed `data/*.yaml` registry control plane,
 * validates it through the shared `@atlas/schema` gate, and returns a value
 * shape-compatible with `PilotRegistrySeed` so it feeds straight into
 * `loadPilotRegistry`. An invalid manifest fails fast with file + id + reason.
 *
 * This is the only place the registry touches the filesystem. The schema-side
 * validators stay pure/fs-free (ADR-0007): we parse YAML here and hand plain
 * objects to `validateRegistryManifest`.
 *
 * Feedback has no manifest yet (it is runtime-mutable, not authored), so it
 * continues to come from the `pilotFeedbackSeed` code module — keeping the large
 * `pilotRegistry.ts` seed out of the runtime path entirely.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { validateRegistryManifest } from "@atlas/schema";
import { pilotFeedbackSeed } from "./pilotFeedbackSeed.js";
import type { PilotRegistrySeed } from "./pilotRegistry.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/seeds -> src -> context-layer -> repo root -> data
export const DATA_DIR = join(here, "..", "..", "..", "data");

function readYaml(dir: string, file: string): unknown {
  return parse(readFileSync(join(dir, file), "utf8"));
}

/**
 * Load + validate the registry manifests in `dir` and return a
 * `PilotRegistrySeed`. Throws with an actionable, multi-line message listing
 * every blocking issue (file + id + reason) when validation fails.
 */
export function loadRegistryFromManifests(dir: string = DATA_DIR): PilotRegistrySeed {
  const { sources, topics, anchors, mappings, issues } = validateRegistryManifest({
    sources: readYaml(dir, "sources.yaml"),
    topics: readYaml(dir, "topics.yaml"),
    anchors: readYaml(dir, "anchors.yaml"),
    mappings: readYaml(dir, "source-topic-mappings.yaml"),
  });

  const errors = issues.filter((issue) => issue.level === "error");
  if (errors.length > 0) {
    throw new Error(
      `Invalid registry manifest in ${dir}:\n` +
        errors.map((error) => `  - ${error.path}: ${error.message}`).join("\n"),
    );
  }

  return { sources, topics, anchors, mappings, feedback: pilotFeedbackSeed };
}
