import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Resolve the Git-managed `data/` registry directory across every runtime, with
 * no required configuration:
 *
 *   1. `ATLAS_DATA_DIR` (absolute) — explicit override for a mounted volume or a
 *      non-standard layout (lets data change without a rebuild — ADR-0007).
 *   2. Self-locate — climb from this module toward the filesystem root and return
 *      the first ancestor that holds `data/sources.yaml`. This works both when
 *      running from source (`context-layer/src/seeds/…`) and from the bundled
 *      portal server (`portal/.output/server/_chunks/…`), as long as the repo
 *      `data/` (or a copy beside the deployed bundle, e.g. the Docker image's
 *      `/var/task/data`) is present.
 *   3. Last-resort relative default — preserves the original behavior.
 *
 * Why not a fixed `join(here, "..","..","..","data")`: that depth is only correct
 * in the source tree; once bundled the same walk lands at `portal/data`, which
 * does not exist. Self-locating removes that footgun so `node .output/server/
 * index.mjs` and `pnpm dev` both work with zero env.
 */
export function resolveDataDir(): string {
  const override = process.env.ATLAS_DATA_DIR;
  if (override) return override;

  const start = dirname(fileURLToPath(import.meta.url));
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "data");
    if (existsSync(join(candidate, "sources.yaml"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return join(start, "..", "..", "..", "data");
}
