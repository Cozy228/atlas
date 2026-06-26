# Plan 009: Parallelise anchor resolution in `buildContextBundle`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bcfabcc..HEAD -- context-layer/src/services/contextBundleService.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live loop before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (changes how the expensive external provider is driven; output
  ordering must stay deterministic)
- **Depends on**: 006 (before/after fetch count), 008 (single-flight first, so the
  parallel burst coalesces same-page fetches instead of multiplying them)
- **Category**: perf (parsing / resolving)
- **Planned at**: commit `bcfabcc`, 2026-06-25

## Why this matters

`buildContextBundle` resolves anchors with a **sequential `await`-in-loop**. At
`disclosure_level: 2` — the catalog datasheet default — it resolves **every**
anchor of **every** source one at a time, so total latency is the *sum* of all
resolutions. When the real Confluence/Terraform providers are wired, each
resolution is an external fetch + HTML/Markdown parse, so a topic with several
sources × several anchors waits through a long serial chain on exactly the slow,
proxied link the audit targets. Resolving independent anchors concurrently makes
latency the *max* of the chain, not the sum. Combined with plan 008's single-flight
(same-page anchors share one fetch) and negative cache, this is the second pillar
of cutting the expensive path.

## Current state

`context-layer/src/services/contextBundleService.ts:126-171` — the resolution
loop, verbatim at `bcfabcc`:

```ts
for (const source of sources) {
  const anchors = service.registry.anchors.findBySourceId(source.id);

  if (source.visibility === "restricted") {
    warnings.push({ code: "restricted_source", message: "Source exists but has restricted visibility.", source_id: source.id });
  }
  if (isStale(source, service.now)) {
    warnings.push({ code: "stale_source", message: "Source is past its review frequency.", source_id: source.id });
  }

  const excerpts = [];
  if (disclosureLevel > 0) {
    const resolver = service.resolvers.get(source.source_class);
    for (const anchorId of anchorIdsForDisclosure(anchors, request.anchor_id, disclosureLevel)) {
      const resolved = await resolver?.resolve({ source, anchors, anchorId, contentProvider: service.contentProvider, ctx });
      if (resolved) {
        warnings.push(...resolved.warnings);
        excerpts.push(...resolved.excerpts);
      }
    }
  }

  bundleSources.push({ source, anchors, selection_rationale: buildSelectionRationale(source, request), excerpts });
}

warnings.push(...authorityConflictWarnings(sources));
```

Key facts that constrain the refactor:
- **Output must stay deterministic.** `excerpts` are pushed in `anchorIdsForDisclosure`
  order; `bundleSources` in `sources` order; `warnings` in iteration order then the
  trailing `authorityConflictWarnings(sources)`. Tests and the UI's "References"
  list depend on this ordering. `Promise.all` preserves array order, so collect
  results into ordered arrays and flatten — never push from inside a racing callback.
- `anchorIdsForDisclosure` (lines 342-353) returns **1** id at `disclosure_level < 2`
  and **all** ids at `>= 2`. The win scales with that count.
- `resolver?.resolve(...)` is the only async/external call. `resolver` may be
  `undefined` (no resolver for a source_class) — the `?.` must be preserved.
- `service.now`, `service.contentProvider`, `ctx` are stable across the loop.
- There is a representative test: `context-layer/src/services/contextBundleService.test.ts`
  (read it first — it pins bundle output for known seeds; it is your safety net).

## Commands you will need

| Purpose | Command (from `context-layer/`) | Expected |
|---------|----------------------------------|----------|
| Install | `pnpm install` (repo root) | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Service tests | `pnpm exec vitest run src/services/contextBundleService.test.ts` | all pass (unchanged output) |
| All tests | `pnpm test` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Fetch counter (006) | `pnpm exec vitest run scripts/measure-bundle-fetch-count.debug.test.ts` | latency/serialisation drops |

## Scope

**In scope** (the only file you should modify):
- `context-layer/src/services/contextBundleService.ts` — the resolution loop in
  `buildContextBundle` only.

**Out of scope** (do NOT touch):
- The resolver interface / `AnchorResolver.resolve` signature and any file under
  `context-layer/src/resolvers/**` or `context-layer/src/sourceContent/**` —
  parse-once / batch-by-page (D-6) is a separate, contract-changing follow-up (see
  Maintenance). This plan only changes *how the existing resolvers are driven*.
- `anchorIdsForDisclosure`, `authorityConflictWarnings`, `selectSources`,
  `buildSelectionRationale` — keep them as-is; only the loop that calls
  `resolve` changes.
- Output ordering or shape — the bundle response must be byte-identical for a
  given seed (the service test enforces this).

## Git workflow

- Branch: `advisor/009-parallel-anchor-resolution`.
- Conventional commits, e.g. `perf(context-layer): resolve bundle anchors concurrently`.
  No `Co-Authored-By` trailer (husky rejects it).
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Parallelise anchors within a source (deterministic)

Replace the inner `for … await resolver.resolve` with an ordered `Promise.all`
over the anchor ids, then flatten warnings/excerpts in order:

```ts
const excerpts = [];
if (disclosureLevel > 0) {
  const resolver = service.resolvers.get(source.source_class);
  const anchorIds = anchorIdsForDisclosure(anchors, request.anchor_id, disclosureLevel);
  const resolutions = await Promise.all(
    anchorIds.map((anchorId) =>
      resolver?.resolve({ source, anchors, anchorId, contentProvider: service.contentProvider, ctx }),
    ),
  );
  for (const resolved of resolutions) {       // in anchorIds order → deterministic
    if (resolved) {
      warnings.push(...resolved.warnings);
      excerpts.push(...resolved.excerpts);
    }
  }
}
```

This alone removes the per-anchor serialisation (the largest factor at
`disclosure_level: 2`). With plan 008's single-flight, multiple anchors on the
**same** Confluence page still issue a single underlying fetch.

**Verify**: `pnpm exec vitest run src/services/contextBundleService.test.ts` → all
pass with **no change to expected output** (ordering preserved). `pnpm typecheck` → exit 0.

### Step 2: Process sources concurrently (ordered, bounded)

Convert the outer `for (const source of sources)` to build an ordered array of
per-source results concurrently, then assemble `bundleSources` in `sources` order.
Keep the trailing `authorityConflictWarnings(sources)` push **after** all sources
resolve. Because warnings currently interleave per-source (restricted/stale) with
per-anchor warnings, collect each source's warnings into its own ordered list and
concatenate in `sources` order so the final `warnings` array matches the
sequential version exactly.

Target shape (per-source work extracted to a local async function returning an
ordered record):

```ts
const perSource = await Promise.all(sources.map(async (source) => {
  const sourceWarnings: ContextBundleResponse["warnings"] = [];
  const anchors = service.registry.anchors.findBySourceId(source.id);
  if (source.visibility === "restricted") sourceWarnings.push({ /* restricted_source */ });
  if (isStale(source, service.now)) sourceWarnings.push({ /* stale_source */ });

  const excerpts = [];
  if (disclosureLevel > 0) { /* Step 1 block, pushing into sourceWarnings/excerpts */ }

  return {
    bundleSource: { source, anchors, selection_rationale: buildSelectionRationale(source, request), excerpts },
    warnings: sourceWarnings,
  };
}));

for (const r of perSource) {            // sources order
  bundleSources.push(r.bundleSource);
  warnings.push(...r.warnings);
}
warnings.push(...authorityConflictWarnings(sources));
```

**Rate-limit guard**: if the registry can produce *many* sources/anchors,
unbounded `Promise.all` could burst the external system. If the seed/tests show
more than ~10 concurrent resolutions, add a small concurrency bound (e.g. a
`mapWithConcurrency(items, 5, fn)` helper in this file) instead of a raw
`Promise.all`. If unsure, keep `Promise.all` for Step 1 (anchors, small N) and
leave Step 2's sources sequential — Step 1 captures most of the win. Record which
you chose in the commit message.

**Verify**: `pnpm exec vitest run src/services/contextBundleService.test.ts` → all
pass, output unchanged. `pnpm test` → exit 0.

### Step 3: Full suite + counter

**Verify**: `pnpm test` → exit 0; `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.
If 006's counter exists, run it and record the new numbers in
`docs/architecture/perf-baseline.md` (fetch count should be ≤ before thanks to 008;
the serial→parallel change shows up as reduced wall-time in a timed harness if you
add one — optional).

## Test plan

- Rely on the existing `contextBundleService.test.ts` as the **invariant**: bundle
  output (sources order, excerpts order, warnings order, anchor_references) must be
  identical for every seeded case. If it passes unchanged, ordering is preserved.
- Add one focused test (optional) with a resolver spy that records call start order
  and asserts overlapping execution (e.g. all `resolve` calls start before the
  first resolves) to prove concurrency — only if it doesn't make the suite flaky.
- Do not add timing-based assertions to CI (flaky); keep timing in the 006 debug
  harness.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0; `pnpm test` exits 0 (context-layer).
- [ ] `contextBundleService.test.ts` passes with **no edits to its expected output**.
- [ ] The inner anchor loop uses `Promise.all` (anchors resolve concurrently); the
      `resolver?.resolve` optional-call and `disclosure_level` gating are preserved.
- [ ] `warnings`, `excerpts`, `bundleSources`, and the trailing
      `authorityConflictWarnings` ordering are unchanged (proven by the passing test).
- [ ] Only `contextBundleService.ts` is modified (`git status --short`).
- [ ] `plans/README.md` status row for 009 updated (note if Step 2 was kept sequential).

## STOP conditions

Stop and report (do not improvise) if:

- The service test's expected output changes — that means ordering drifted; revert
  to the ordered-flatten pattern and do not edit the expectation.
- You need to change `AnchorResolver.resolve`'s signature or any resolver/provider
  file to make this work — that is the D-6 follow-up, out of scope here.
- The registry seed implies a large fan-out (≫10 concurrent external resolutions)
  and no concurrency bound exists — report so a bound is added deliberately rather
  than risking a rate-limit storm against the real provider.
- `ContextBundleResponse["warnings"]` typing rejects the per-source collection
  approach — report the exact type error.

## Maintenance notes

- **D-6 follow-up (parse-once / batch-by-page)**: even with single-flight, each
  anchor on the same page re-**parses** the HTML inside `resolveConfluencePageLive`
  (`context-layer/src/resolvers/confluencePageResolver.ts:15-17` →
  `confluenceCloudContentProvider`). The next win is caching the *parsed* structure
  (heading/section index) keyed by page+version and resolving multiple anchors from
  it, or having the resolver accept pre-fetched content. That changes the resolver
  contract (blast radius across `resolvers/**` + `sourceContent/**`) and deserves
  its own plan — write it after 008/009 land and 006's counter shows the residual
  parse cost.
- A reviewer should verify determinism by diffing a bundle response for a fixed
  seed before/after (the service test is that diff).
- If a future change makes anchor resolution order-dependent (one anchor's result
  feeding the next), this parallelisation must be revisited — today they are
  independent.
