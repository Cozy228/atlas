---
status: active
review_after: 2026-07-20
---

# Goal Prompt: Step 2 Tails — Valkey snapshot adapter · D3 projection inversion · D10 banner

Close the three documented Step-2 gaps left open at merge (`e318c25`, lifecycle wiring
`0cb4a3b`). Parent authority: `docs/architecture/goal_prompt_step2_graph_layer.md` (its
Locked Decisions and Constraints all still bind) and `docs/architecture/mid-level-design.md`
(M2/M10, M12 one-clock), ADR-0013 §4/§6. On conflict, those win. This prompt is the
executable distillation of the remaining scope only.

## Current-tree facts (verified 2026-07-06 at `a17199d`)

- `context-layer/src/composition.ts:62,171-185` — module-level `discoveryCache` promise memo
  still serves the registry/resource read path (`:283-301`); `deriveGraph` is never imported
  there. The two "⚠️ SCOPED GAP" blocks at `graph/refreshGraphSnapshots.ts:22-35` and
  `graph/snapshotStoreFactory.ts:8-19` describe exactly this.
- `graph/snapshotStoreFactory.ts:21-25` — `sharedSnapshotStore(_env)` ignores env and always
  returns `InMemorySnapshotStore`. No Valkey adapter exists.
- Step-4 briefs (`graph/requestGraph.ts:25-52`, `briefsRoute.ts:84`) re-parse all roots **per
  request** with no cache and no snapshot store — a third, independent discovery path.
- `graph/deriveGraph.ts:103-107` emits `perRootFreshness` with hardcoded `stale: false`.
  `ChangesResponseSchema` (`packages/atlas-schema`) is strict `{ events, cursor }` — no
  freshness. No portal banner component exists; `routes/changes.tsx` renders events only.
  `graph/degradation.test.ts` covers aging at the context layer (in-memory) only.
- Valkey machinery to reuse: `sourceContent/valkeyContentCache.ts` (GLIDE cluster client,
  TLS, optional IAM), `iovalkeyContentCache.ts`, selection logic in
  `sourceContentCache.ts:249-278` (`CACHE_VALKEY_URL`, `CACHE_VALKEY_CLIENT=iovalkey`,
  `CACHE_VALKEY_USERNAME`, `CACHE_VALKEY_IAM_CLUSTER`, `AWS_REGION`).

## Tail 1 — `ValkeySnapshotStore` (M2/M10 prod hardening)

Locked decisions:

1. `context-layer/src/graph/valkeySnapshotStore.ts` implementing the existing `SnapshotStore`
   port. One Valkey key per root: `discovery:<envHash>:<rootId>`, value = JSON of the
   `SnapshotPair` (K=2 retention is inherent in the pair). **No TTL** — cold start must serve
   from snapshot.
2. **CAS must be atomic server-side**: a single-key script (GLIDE `invokeScript` / iovalkey
   `eval`) that compares the stored pair's pending id and swaps only on match. Single-key ⇒
   cluster-slot safe. Client-side read-then-set is a defect.
3. `readAll` without cluster SCAN: maintain an index set key `discovery:<envHash>:roots`
   (add `rootId` on every successful write), `readAll` = read index members + per-key GET.
4. Client selection mirrors `createValkeyCache` (GLIDE default, `CACHE_VALKEY_CLIENT=iovalkey`
   switch, same env vars — **no new env vars**). Sharing the content-cache connection instance
   is optional; sharing the infra is mandatory (no new infra).
5. Resilience is **construction-time selection, not per-op fallback**: `CACHE_VALKEY_URL` set
   ⇒ Valkey store; unset ⇒ in-memory; a connection failure at construction falls back to
   in-memory with a loud pino error. A **runtime** op error is logged and returns the safe
   value (read ⇒ `undefined` = cold; CAS ⇒ lost) — never a hidden second store (one source of
   truth; a per-op memory fallback would split-brain the CAS).
6. `sharedSnapshotStore(env)` honors env (remove the `_env` ignore + the SCOPED GAP comment).
   Memoize per env-hash as today.

## Tail 2 — D3 projection inversion (memo → snapshot rewire)

Locked decisions:

1. **Delete the `discoveryCache` memo.** The composition read path reads through the shared
   snapshot store via `serveRootSnapshot` per root (existing SWR gating: warm ⇒ 0 crawls;
   cold/stale ⇒ crawl + CAS transition; failed crawl ⇒ last-good + aging note). Registry and
   resources become projections computed from the snapshot-held parse outputs.
2. **Byte-stable outputs are the hard gate**: every existing registry/resource test and
   `contextApiContract.test.ts` stays green **unchanged**. If the current snapshot `RootParse`
   shape lacks facts the projections need, extend it (descriptive facts only, bump the
   parse-contract version, update contract fixtures). **Source content bodies are never
   snapshotted** (P18/P24).
3. Keep an in-process **single-flight** around the cold-start crawl (request coalescing so a
   cold burst crawls once). This is not a cache and not a second clock — no stored freshness,
   no TTL; the snapshot store remains the only state.
4. **Unify the Step-4 brief path**: `deriveRequestGraph` reads the same shared snapshot store
   (serve-from-snapshot; cold ⇒ crawl through the same single-flight) instead of re-parsing
   per request. Brief outputs stay stable (Step-4/5 suites green). After this, exactly **one**
   discovery path exists (snapshot store), consumed by composition, briefs, and the lifecycle
   refresher.
5. Remove both SCOPED GAP comment blocks; the honest-gap prose must not outlive the gap.

## Tail 3 — D10 loud banner (honest aging, one clock)

Locked decisions:

1. **Fix `deriveGraph`'s hardcoded `stale: false`.** Staleness is recomputed at read time via
   `computeFreshness` against the caller's `now` — never stored. The graph `version` content
   hash must **not** incorporate freshness (a version must not churn with wall-clock time).
2. **Expose per-root freshness on the governed feed**: additive `roots` field on
   `GET /api/changes` response — `{ rootId, resolvedAt, stale, agingNote? }[]`, all roots
   (events are scope-filtered; substrate health is global). Update `ChangesResponseSchema`,
   all three `ContextApiClient` impls, and the transport guard (`contextApiContract.test.ts`)
   so in-process ≡ HTTP.
3. **Portal loud banner**: a reusable component (e.g. `stale-subgraph-banner.tsx`) rendered
   wherever the change feed renders (`/changes` route, and the APP-home feed slice if Step 5
   embedded one — check, don't assume). Shown when any root is stale or carries an aging
   note: names the root(s), shows the age (from `resolvedAt`, computed client-side at render),
   visually loud (not a chip). Other roots' rows stay live — the banner never blocks the feed.
4. Tests: route-level assertion that a stale root surfaces in the response
   (`changesRoute` test extension), a portal component test for the banner, and the e2e drill
   if `DEV_MOCKS=1` fixtures can force an aged root — assess honestly; if mocks cannot
   simulate it, defer the e2e with a one-line note in the PR description instead of faking it.

## Constraints (unchanged from parent)

- Tests-not-gutted; existing suites stay green unchanged unless a locked decision above says
  otherwise. English code/comments. `pnpm` only. Vitest colocated.
- Surgical: What's New (P31), Ask-LLM, Entra, subscriptions/push all untouched.
- **Leave the tree uncommitted** — reviewer commits. Do **not** touch the pre-existing
  uncommitted files (`AGENTS.md`, `.claude/standing-rules.md`, `docs/agents/`).
- No new env vars, no new infra, no second cache clock (M4/ADR-0013 §6).
- Multicloud plural shapes everywhere; fictional fixture data only (public-safe).

## Definition of Done

| # | Criterion | Proof |
|---|---|---|
| T1a | `ValkeySnapshotStore`: JSON pair roundtrip, atomic scripted CAS (contention ⇒ one winner), index-set `readAll`, no TTL | `valkeySnapshotStore.test.ts` (fake client, no live Valkey in CI) |
| T1b | Factory: `CACHE_VALKEY_URL` ⇒ Valkey; unset ⇒ in-memory; construction failure ⇒ in-memory + loud log; runtime op error ⇒ safe value, never memory fallback | `snapshotStoreFactory.test.ts` |
| T2a | Memo gone: composition serves registry/resources from snapshots; warm read ⇒ 0 crawls; cold burst ⇒ 1 crawl (single-flight); failed root ⇒ last-good + aging, others live | composition-level test (extend existing) + `degradation.test.ts` still green |
| T2b | Byte-stable: all existing registry/resource tests + `contextApiContract.test.ts` green **unchanged** | CI-equivalent run |
| T2c | Briefs read snapshots: `deriveRequestGraph` hits the store (warm ⇒ 0 crawls); Step-4/5 suites green | `requestGraph` test extension |
| T3a | `deriveGraph` freshness honest: stale recomputed at read; version hash time-invariant | `deriveGraph.test.ts` extension |
| T3b | `/api/changes` carries `roots` freshness; in-process ≡ HTTP; schema + 3 client impls updated | `changesRoute.test.ts` + transport guard |
| T3c | Portal banner: stale root ⇒ loud banner naming root + age; live roots unaffected | component test (+ e2e drill or honest deferral note) |
| T4 | Whole repo green: `pnpm -r typecheck`, `pnpm -r test`; no skipped/deleted tests vs baseline; SCOPED GAP comments removed | CI-equivalent local run |

## Execution

Single-track: one Claude Opus builder agent in the main working tree, uncommitted.
Review: Fable per `atlas-review-standard` + Codex (heterogeneous second opinion) on the diff.
Fixes applied by an Opus fix agent; Fable commits in batches and pushes.

## Revert

All additive or cache: removing the Valkey adapter restores in-memory; restoring the memo is
a single-file revert of composition.ts; the banner and `roots` field are additive surface.
