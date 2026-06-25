/**
 * Print a reproducible wire-size inventory of the built client assets
 * (plan 006, Step 1 — Section 1 of perf-baseline.md). For every `.js`/`.css`
 * in `.output/public/assets/`, report raw + gzip + brotli bytes — gzip/brotli
 * are what a slow link actually transfers, ~30% of the raw size for JS/CSS.
 *
 * Usage (from portal/, after `pnpm build`):
 *   node scripts/print-chunk-sizes.mjs            # all chunks, raw-size desc
 *   node scripts/print-chunk-sizes.mjs --json     # machine-readable
 *
 * It also prints the gzip total a cold `/` visit downloads: the entry chunk
 * (index-*.js) + react + react-dom + globals.css + the inter-latin base subset.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".output", "public", "assets");

function listChunks() {
  let entries;
  try {
    entries = readdirSync(assetsDir);
  } catch {
    console.error(`No assets dir at ${assetsDir}. Run \`pnpm build\` first.`);
    process.exit(1);
  }
  return entries
    .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
    .map((name) => {
      const buf = readFileSync(join(assetsDir, name));
      return {
        name,
        raw: statSync(join(assetsDir, name)).size,
        gzip: gzipSync(buf).length,
        brotli: brotliCompressSync(buf).length,
      };
    })
    .sort((a, b) => b.raw - a.raw);
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// The chunks a cold `/` visit must download before hydration: the entry chunk
// plus the always-loaded vendor + global-style chunks. Matched by name prefix
// because the hashes rotate across builds.
const COLD_HOME_PREFIXES = ["index-", "react-dom-", "react-", "globals-", "inter-latin-"];

function isColdHome(name) {
  // `react-` must not also swallow `react-dom-` (already its own entry); the
  // explicit prefix list keeps each chunk counted once.
  return COLD_HOME_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function main() {
  const chunks = listChunks();
  const asJson = process.argv.includes("--json");

  if (asJson) {
    console.log(JSON.stringify(chunks, null, 2));
    return;
  }

  const nameWidth = Math.max(...chunks.map((c) => c.name.length), 4);
  console.log(`${"file".padEnd(nameWidth)}  ${"raw".padStart(9)}  ${"gzip".padStart(9)}  ${"brotli".padStart(9)}`);
  for (const c of chunks) {
    console.log(
      `${c.name.padEnd(nameWidth)}  ${kb(c.raw).padStart(9)}  ${kb(c.gzip).padStart(9)}  ${kb(c.brotli).padStart(9)}`,
    );
  }

  const cold = chunks.filter((c) => isColdHome(c.name));
  const sum = (key) => cold.reduce((total, c) => total + c[key], 0);
  console.log("");
  console.log(`cold-/ chunks (${cold.map((c) => c.name).join(", ")}):`);
  console.log(`  raw=${kb(sum("raw"))}  gzip=${kb(sum("gzip"))}  brotli=${kb(sum("brotli"))}`);
}

main();
