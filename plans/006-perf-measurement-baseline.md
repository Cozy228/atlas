# Plan 006: Establish a performance measurement baseline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bcfabcc..HEAD -- portal/vite.config.ts portal/package.json portal/scripts context-layer/src/services/contextBundleService.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (adds measurement artifacts + one debug test; no runtime change)
- **Depends on**: none
- **Category**: perf (tooling / baseline)
- **Planned at**: commit `bcfabcc`, 2026-06-25
- **Executed at**: commit `bcfabcc`, 2026-06-26 — baseline captured in
  `docs/architecture/perf-baseline.md` (§1–3 with numbers; §4 throttled trace is
  TODO, needs Chrome DevTools). **Authorized deviation**: the Step-3 STOP
  condition (context-layer `test` did not exclude `scripts/*.debug.test.*`) was
  resolved by changing exactly one line —
  `"test": "vitest run"` → `"test": "vitest run --exclude \"scripts/*.debug.test.ts\""`
  in `context-layer/package.json`, mirroring portal's existing exclude (NARROWS
  CI). No runtime source was modified.

## Why this matters

The 2026-06-25 performance audit ranked findings by **estimated** impact because
no objective, repeatable baseline exists. Every later plan (007–010) claims a win
in "wire bytes / external round-trips / main-thread ms" — those claims are only
provable against numbers captured the same way before and after. This plan
captures four baselines and commits a repeatable harness so any executor can
re-run them and a reviewer can verify a regression gate:

1. **Bundle/chunk inventory** (wire bytes per route).
2. **Availability matrix render cost** (main-thread ms — a harness already exists).
3. **External-resolver-call count per bundle request** (the highest-leverage axis;
   plans 008/009 reduce it).
4. **Throttled DevTools trace methodology** (Slow 4G + CPU 6×) with a first
   capture per route.

## Current state

- **Build** — `portal/package.json:16`:
  `"build": "node scripts/gen-agent-skills-index.mjs && vite build"` → emits to
  `portal/.output/`. Hashed chunks land in `portal/.output/public/assets/`.
  A build at `bcfabcc` produced (uncompressed):
  - `index-1LHUkF3J.js` **446 KB** (entry), `react-dom-*.js` 184 KB,
    `aws-icons-*.js` 122 KB, `azure-icons-*.js` 118 KB,
    `availability.index-*.js` 116 KB, `feedback-inline-form-*.js` 79 KB,
    `features-animation-*.js` 72 KB (this is `motion`), `globals-*.css` 132 KB,
    `inter-latin-*.woff2` 48 KB (+ other unicode-range-gated subsets).
  - These are **uncompressed** sizes read from `ls`. The baseline must record
    **gzip and brotli** sizes (what actually crosses the wire) — they are ~30 %
    of uncompressed for JS/CSS.
- **Render harness** — `portal/package.json:23`:
  `"measure:availability-render": "vitest run scripts/measure-availability-render-cost.debug.test.tsx --reporter verbose"`.
  At `bcfabcc` it reports roughly AWS ~11 ms / Azure ~6 ms median MatrixView
  render. The exact script is `portal/scripts/measure-availability-render-cost.debug.test.tsx`
  (read it before extending; it is excluded from `pnpm test` by the
  `--exclude scripts/*.debug.test.tsx` glob).
- **External-resolver calls** — `context-layer/src/services/contextBundleService.ts:94-183`
  (`buildContextBundle`) resolves anchors in a nested loop
  (`for source … for anchorId … await resolver.resolve(...)`, lines 126-162). The
  resolution context's `fetch` is the only external I/O. There is **no counter**
  today. `context-layer/src/resolvers/resolverTypes.ts` defines `ResolutionContext`
  with a `fetch: FetchLike`; `offlineResolutionContext()` supplies an offline
  fetch. A counting `FetchLike` wrapper passed as `ctx.fetch` will count external
  calls for a representative bundle.
- **Existing debug-test pattern** — the repo already uses `*.debug.test.tsx`
  files run via a dedicated script and excluded from CI `pnpm test`. Model the new
  counter test on `scripts/measure-availability-render-cost.debug.test.tsx`.

## Commands you will need

| Purpose | Command (run from `portal/` unless noted) | Expected on success |
|---------|-------------------------------------------|---------------------|
| Install | `pnpm install` (repo root) | exit 0 |
| Build | `pnpm build` | exit 0; `.output/public/assets/` populated |
| Render cost | `pnpm measure:availability-render` | prints AWS/Azure median ms |
| Typecheck | `pnpm typecheck` | exit 0 (`tsc --noEmit --pretty false`) |
| Tests | `pnpm test` | exit 0 |
| Counter test | `pnpm exec vitest run scripts/measure-bundle-fetch-count.debug.test.ts --reporter verbose` (from `context-layer/`) | prints external-fetch count |
| Gzip sizes | `cd .output/public/assets && for f in *.js *.css; do printf '%s\t%s\t%s\n' "$f" "$(gzip -c "$f" \| wc -c)" "$(stat -f%z "$f")"; done` | tab table: file, gzip bytes, raw bytes |

(Verified against `portal/package.json` at `bcfabcc`. The `context-layer` test
runner is Vitest; confirm with `cat context-layer/package.json` before step 3.)

## Scope

**In scope** (create these; do not modify runtime source):
- `docs/architecture/perf-baseline.md` (create) — the committed baseline tables +
  trace methodology.
- `context-layer/scripts/measure-bundle-fetch-count.debug.test.ts` (create) — the
  external-resolver-call counter (a `*.debug.test.ts`, excluded from CI).
- `portal/scripts/print-chunk-sizes.mjs` (create, optional) — a tiny script that
  prints the gzip/brotli/raw size table from `.output/public/assets/` so the
  inventory is reproducible without hand-running the shell loop.

**Out of scope** (do NOT modify):
- Any runtime source under `portal/src/**` or `context-layer/src/**` — this plan
  measures, it does not optimise. Optimisation is plans 007–010.
- `portal/vite.config.ts` — do not change chunking here; A-1/A-4 follow-ups are
  separate and depend on this baseline.

## Git workflow

- Branch: `advisor/006-perf-baseline`.
- Commit per step; conventional-commit style (the repo's hook enforces it — see
  `git log --oneline -5`, e.g. `feat(portal): …`). Use `chore(perf): …` or
  `docs(perf): …` for these measurement artifacts. **Do not** add a
  `Co-Authored-By` trailer (the husky hook rejects it).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Capture the gzip/brotli chunk inventory

Build, then record per-chunk **gzip and brotli** sizes (what the slow link
actually transfers), grouped by which route loads each chunk.

- Run `pnpm build`.
- Either run the shell loop in "Commands" or create
  `portal/scripts/print-chunk-sizes.mjs` (reads `.output/public/assets/`, prints
  `file | raw | gzip | brotli` using Node's `zlib.gzipSync`/`zlib.brotliCompressSync`).
- Write the table into `docs/architecture/perf-baseline.md` under a
  "## 1. Bundle inventory (commit `<SHA>`)" heading. Mark the **entry chunk**
  (`index-*.js`) and the per-route chunks (`availability.index-*`, `catalog.*`,
  etc.). Note the gzip total a cold `/` visit downloads (entry + react + react-dom
  + globals.css + `inter-latin`).

**Verify**: `docs/architecture/perf-baseline.md` contains a table with a gzip
column and a non-zero gzip size for `index-*.js`. `grep -c "gzip" docs/architecture/perf-baseline.md` → ≥ 1.

### Step 2: Record the availability render cost

- Run `pnpm measure:availability-render`.
- Paste the AWS/Azure median ms (and any p95 the harness prints) into
  `perf-baseline.md` under "## 2. Availability render cost". Note the DOM-node
  count if the harness reports it; if not, add a one-line note that
  `matrix-view.tsx:196` uses `content-visibility:auto` (so off-screen rows skip
  layout) and that node count is `regions × services`.

**Verify**: `pnpm measure:availability-render` exits 0 and the doc records two
numbers (AWS, Azure).

### Step 3: Add the external-resolver-call counter

Create `context-layer/scripts/measure-bundle-fetch-count.debug.test.ts`. It must:

- Build a context bundle for a representative request **at `disclosure_level: 2`**
  (the catalog datasheet default — the worst case, resolves every anchor) using
  the real `buildContextBundle` and a registry seed that has a multi-anchor
  source.
- Pass a `ResolutionContext` whose `fetch` is a counting wrapper:
  ```ts
  let externalFetches = 0;
  const ctx = { ...offlineResolutionContext(), fetch: (input, init) => { externalFetches++; return baseFetch(input, init); } };
  ```
- Assert/print `externalFetches` and the number of anchors resolved, so the ratio
  (fetches ÷ anchors) is visible. This is the number plans 008 (single-flight,
  negative cache) and 009 (batch-by-page) must reduce.

Read `scripts/measure-availability-render-cost.debug.test.tsx` and
`context-layer/src/services/contextBundleService.ts` first to match the seed/setup
conventions. Record the printed count in `perf-baseline.md` under
"## 3. External-resolver calls per bundle (disclosure_level 2)".

**Verify**: `pnpm exec vitest run scripts/measure-bundle-fetch-count.debug.test.ts --reporter verbose`
(from `context-layer/`) prints a non-zero `externalFetches` and an anchor count.
`pnpm test` (from `context-layer/`, then from `portal/`) still exits 0 — the new
file is a `*.debug.test.ts` and must be excluded by the existing test glob (if the
context-layer `test` script does not already exclude `scripts/*.debug.test.*`,
STOP and report rather than widening CI).

### Step 4: Document the throttled-trace methodology + first capture

Add "## 4. Throttled trace methodology" to `perf-baseline.md`:

- Tooling: Chrome DevTools, **Network = Slow 4G, CPU = 6× slowdown** (the
  low-spec-Windows/slow-network proxy for the target machine).
- Routes to trace: `/`, `/overview`, `/catalog`, `/availability`, `/catalog/<a real topic id>`, `/ask`, `/guidance`.
- Metrics per route: TTFB, FCP, LCP, TBT, and SPA route-transition time (nav from
  `/` to the route after warm load).
- Procedure: serve a production build (`node .output/server/index.mjs` from
  `portal/.output/`, or the repo's documented serve command), 3 runs per route,
  record median + p95.
- Capture **one** baseline run now and paste the numbers in. If no browser/DevTools
  is available in the executor environment, record the methodology and mark the
  capture "TODO — run on a machine with Chrome DevTools"; do not block the plan on
  it.

**Verify**: `perf-baseline.md` has section 4 with the throttle settings, the route
list, and either real numbers or an explicit "TODO — needs Chrome" marker.

## Test plan

- No runtime tests change. The only new test is the debug counter (step 3), which
  is excluded from CI by the `*.debug.test.*` glob.
- Verification: `pnpm test` from both `portal/` and `context-layer/` exits 0
  (proving the new debug test did not leak into CI); `pnpm typecheck` from both
  exits 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `docs/architecture/perf-baseline.md` exists with sections 1–4.
- [ ] Section 1 has a **gzip** size column with a non-zero entry-chunk size.
- [ ] `pnpm measure:availability-render` exits 0 and its numbers are in section 2.
- [ ] `context-layer/scripts/measure-bundle-fetch-count.debug.test.ts` exists and,
      when run, prints `externalFetches` and an anchor count.
- [ ] `pnpm test` exits 0 in `portal/` AND `context-layer/`; `pnpm typecheck`
      exits 0 in both.
- [ ] No files under `portal/src/**` or `context-layer/src/**` modified
      (`git status --short` shows only the new docs/scripts files).
- [ ] `plans/README.md` status row for 006 updated.

## STOP conditions

Stop and report (do not improvise) if:

- `pnpm build` fails or `.output/public/assets/` is empty (the chunk inventory is
  the spine of every later plan).
- The context-layer test script does **not** already exclude `scripts/*.debug.test.*`
  — adding a debug test would otherwise run in CI. Report rather than editing the
  CI test glob.
- `buildContextBundle`'s signature or the `ResolutionContext.fetch` seam differs
  from the "Current state" excerpt (the counter can't be wired the documented way).
- You find yourself about to modify runtime source to capture a number — that is
  out of scope; report what you needed instead.

## Maintenance notes

- Re-run this harness after plans 008/009 and record the new external-fetch count
  — that delta is their proof of win.
- The A-1 entry-chunk-trim and F-3′ icon-split follow-ups depend on Step 1's
  inventory; when you act on them, re-run Step 1 and diff the entry-chunk gzip.
- If `vite`/`rolldown` chunk names change across versions, update the route→chunk
  mapping in section 1; the names are content-hashed and will rotate.
