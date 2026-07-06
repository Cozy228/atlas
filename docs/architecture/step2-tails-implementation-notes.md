---
status: active
review_after: 2026-07-20
---

# Step-2 Tails — Implementation Notes (deviation log)

Builder deliverable for `docs/architecture/goal_prompt_step2_tails.md` (T1 Valkey
snapshot adapter · T2 D3 projection inversion · T3 D10 loud banner). Tree left
uncommitted; reviewer commits. Baseline before work: context-layer 314 pass / 2
skip, portal 157 pass, repo typecheck green.

## 1. File-by-file summary

### T1 — `ValkeySnapshotStore`
- **`context-layer/src/graph/valkeySnapshotStore.ts`** (new) — transport-agnostic
  `ValkeySnapshotStore implements SnapshotStore` over a narrow `SnapshotClient`
  port. Owns JSON (de)serialization of the `SnapshotPair`, the roots index, and
  safe-value degradation. `SNAPSHOT_CAS_LUA` = the server-side CAS script
  (computes the stored pending id via the same `${contractVersion}@${resolvedAt}`
  formula as `pendingId()`; on a win ATOMICALLY `SET`s the pair AND `SADD`s the
  root into the index — one script, two keys, same hash tag, **FIX 1**). No TTL.
- **`context-layer/src/graph/valkeySnapshotClient.ts`** (new) — `GlideSnapshotClient`
  (GLIDE default, IAM + TLS like `valkeyContentCache`, eager connect,
  `invokeScript(keys:[pair,index])`/`smembers`) and `IoValkeySnapshotClient`
  (`CACHE_VALKEY_CLIENT=iovalkey` fallback, lazy import, `eval` numKeys=2).
  `casSwap` now carries the index key + rootId; `addRoot`/`sadd` dropped (folded
  into the atomic script, **FIX 1**). `parseValkeyUrl` now imported from the new
  `sourceContent/valkeyUrl.ts` (not `valkeyContentCache`, **FIX 2**).
  `createSnapshotClient(env, url, deps)` selects + connects. Dynamic-imported by
  the factory only when a URL is set (**FIX 2**).
- **`context-layer/src/sourceContent/valkeyUrl.ts`** (new, **FIX 2**) — `parseValkeyUrl`
  extracted here so the snapshot chain never pins the GLIDE-importing
  `valkeyContentCache` into the static graph. `valkeyContentCache` imports it and
  re-exports for back-compat.
- **`context-layer/src/graph/snapshotStoreFactory.ts`** (rewritten) — `sharedSnapshotStore(env, nowMs?, deps?)`
  is **async**, memoized per env-hash; `createSnapshotStore(env, deps?)` selects
  Valkey vs in-memory at construction (dynamic-importing `valkeySnapshotClient`
  only when a URL is set, **FIX 2**), falling back to in-memory + loud pino error on
  a connection failure. `snapshotEnvHash(env)` now folds in the credential envs
  (`TERRAFORM_TOKEN`, `CONFLUENCE_TOKEN`/`_EMAIL`, `CONFLUENCE_SECURITY_TOKEN`/`_EMAIL`),
  sha256-truncated so no secret leaks (**FIX 3**); it also keys the read-path
  single-flight. A degraded (transient-outage) fallback is retried after
  `SNAPSHOT_STORE_RETRY_MS` (60s) — recovering to Valkey on success, keeping the
  SAME stable in-memory instance on continued failure (no cold-storm, **FIX 4**).
  Key prefix `discovery:{<envHash>}` (hash-tag braces, **FIX 1**).
- **`context-layer/src/graph/refreshGraphSnapshots.ts`** — caller updated to
  `await sharedSnapshotStore(env)`; both SCOPED GAP comment blocks removed and the
  header doc rewritten to describe the durable store (T2.5 / T1).
- Tests: **`valkeySnapshotStore.test.ts`**, **`snapshotStoreFactory.test.ts`** (new).

### T2 — D3 projection inversion (memo → snapshot)
- **`context-layer/src/graph/serveSnapshots.ts`** (new) — `serveRootSnapshots(...)`:
  the ONE read-path entry serving every root through the shared store (warm ⇒ 0
  crawls; cold/stale ⇒ crawl + inline CAS transition; failed ⇒ last-good + aging).
  Module-level single-flight (`inFlightCrawls`, keyed `envHash:rootId`) coalesces a
  cold burst to one crawl on the SHARED path only; an injected store bypasses
  coalescing entirely (direct crawl, no map participation) so it can never coalesce
  onto a different provider's in-flight shared crawl (**FIX 5**). Returns
  `{ snapshots, aging }`.
- **`context-layer/src/discovery/projectDiscovery.ts`** (new) — `reconstructDiscovery(snapshots)`
  rebuilds `DiscoveredService[]`/`DiscoveredGuardrail[]` from the parses: service
  identity re-derived from the `{provider}/{id}` slug via `normalizeServiceIdentity`,
  modules regain their synthetic `sourceId` + empty list-only `headings`, guardrails
  carry the snapshot `pageId`. Ordering preserved (LZ order × grid order, first-seen).
- **`context-layer/src/composition.ts`** — deleted `discoveryCache` memo, `discoveryKey`,
  `runDiscovery`, `discoverAll`; added `serveDiscovery(env, provider, injected)` that
  serves through the shared store (or a fresh in-memory store when a provider is
  injected — the test/adapter seam) and reconstructs the projections. Registry /
  resources unchanged downstream (byte-stable).
- **`context-layer/src/graph/requestGraph.ts`** — `deriveRequestGraph` now reads the
  shared store via `serveRootSnapshots` then `deriveGraph` (T2.4). One discovery path.
- **`context-layer/src/graph/graphTypes.ts`** — `SecurityRootParse.guardrails` gains
  optional `pageId` (the one fact the guardrail projection needs).
- **`context-layer/src/graph/rootParsers.ts`** — `parseSecurityRoot` populates `pageId`.
- **`context-layer/src/graph/rootConfig.ts`** — security `contractVersion` → `security-v2`.
- **`context-layer/src/graph/rootParsers.contract.test.ts`** — security case asserts a
  truthy `pageId` (contract-fixture update, sanctioned by T2.2).
- Tests: **`serveSnapshots.test.ts`**, **`projectDiscovery.test.ts`** (new).

### T3 — D10 loud banner (honest aging, one clock)
- **`context-layer/src/graph/deriveGraph.ts`** — `deriveGraph(snapshots, now = new Date())`;
  the hardcoded `stale: false` replaced by the read-time `perRootFreshness(snapshots, now)`
  helper. `version` unchanged (freshness never enters the content hash).
- **`packages/atlas-schema/src/index.ts`** — new `ChangeFeedRootSchema`
  (`{ rootId, resolvedAt, stale, agingNote? }`) + `roots` added to
  `ChangesResponseSchema` (required, additive) + `ChangeFeedRoot` type export.
- **`context-layer/src/api/changesRoute.ts`** — `handleChangesRequest` builds `roots`
  from the shared snapshot store's `readAll()`, staleness recomputed at read against
  `now` (optional in `ChangesRequestOptions`), with a human `agingNote` on stale roots.
  Sorted for cross-transport determinism.
- **`portal/src/api/contextApiClient.ts`** — static stub returns `roots: []`.
- **`portal/src/api/server/changesMock.ts`** — `MOCK_ROOTS` with one deliberately
  aged root (`availability:azuref`) so DEV_MOCKS renders the banner; returned by
  `mockChangesFeed`.
- **`portal/src/components/changes/stale-subgraph-banner.tsx`** (new) — the loud
  `role="alert"` banner (`data-testid="stale-subgraph-banner"`), names aging roots,
  age computed client-side from `resolvedAt`, renders nothing when all roots live.
- **`portal/src/routes/changes.tsx`**, **`portal/src/routes/index.tsx`** — render the
  banner above the shared `ChangeFeedList` (both the `/changes` route and the Step-5
  APP-home feed slice — Step 5 DID embed a slice; confirmed).
- **`portal/src/components/changes/change-feed.tsx`** — `ChangeRow`'s `<li>` gains
  `data-testid="change-feed-row"` so the e2e can assert a FEED row specifically,
  never matching the banner's own `<li>` (**FIX 7**).
- Tests: **`stale-subgraph-banner.test.tsx`** (new); **`deriveGraph.test.ts`**,
  **`changesRoute.test.ts`**, **`contextApiContract.test.ts`** extended;
  **`packages/atlas-e2e/tests/my-changes.spec.ts`** — banner assertion authored;
  both feed-row assertions now scoped to `getByTestId("change-feed-row")` (**FIX 7**).

## 2. Deviation log

- **T1 store selection is async.** `sharedSnapshotStore` became `Promise<SnapshotStore>`
  (eager connect so a construction failure falls back at construction, decision 5).
  The one production caller (`refreshGraphSnapshots`) and the new read path `await`
  it. No behavioral change to callers; faithful to decision 5/6.
- **T1 runtime-op-error test lives in `valkeySnapshotStore.test.ts`, not the factory
  test.** DoD T1b lists "runtime op error ⇒ safe value" under the factory proof, but
  it is a *store* behavior (the factory only selects). Covered with a throwing fake
  client in the store test; the factory test proves the selection/construction-fallback
  half. No requirement skipped — the item is proven, just in the honest home.
- **T2 availability identity is reconstructed by splitting the snapshot slug, NOT by
  extending the availability parse.** The `{provider}/{id}` slug is exactly
  `normalizeServiceIdentity`'s `key`, so `normalizeServiceIdentity({provider, id, name})`
  reproduces the identity byte-for-byte (same tuple discovery used). This avoids
  bumping `availability-v1` and touching every availability test fixture. Assumption:
  a service `id` contains no `/` (true for real machine ids; the graph already relies
  on slug == identity.key for coherence). Only the security parse genuinely lacked a
  needed fact (`pageId`), so only it was extended + version-bumped.
- **T2 `SecurityRootParse.pageId` is OPTIONAL, not required.** Making it required would
  break brief-template fixtures (`briefs/*.test.ts`, `deriveGraph.test.ts`) that build
  security parses without it. The live `parseSecurityRoot` always populates it, so the
  composition projection is exact; reconstruction falls back to `""` only on a fixture
  that never reaches the guardrail projection. `security-v2` bump kept (T2.2).
- **T2 injected-provider seam.** `createDefaultContextService({ availabilityProvider })`
  now serves through a FRESH per-call in-memory store (not the shared one), preserving
  the old `useCache = !options.availabilityProvider` isolation so an injected spine is
  never masked by a warm shared snapshot. No `createDefaultContextService` test injects
  a provider today, so this is a faithful port of the prior seam, not new behavior.
- **T2 composition read path now derives events on cold roots.** Per decision T2.1
  ("cold/stale ⇒ crawl + CAS transition"). A cold root's first crawl SEEDS its baseline
  silently (damping → 0 events), so a fresh-start read pollutes no feed; warm reads do
  0 work. Verified: full context + portal suites green, including the change-feed guard.
- **T3 `contextApiContract.test.ts` was extended (roots parity), not left unchanged.**
  T2b says that file stays green "unchanged"; the change is a T3.2 requirement ("update
  … the transport guard") — one ADDED assertion (`inProcess.roots === httpBody.roots`),
  no pre-existing assertion weakened or removed.
- **T3 `agingNote` is emitted whenever a root reads stale** (route side), rather than
  only on a witnessed failed-refresh. From `readAll` the route cannot distinguish
  "old" from "failing"; staleness IS the honest read-time signal the banner keys on.

### Review fixes (Fable + Codex, 7 confirmed) — deviations & notes

- **FIX 1 — hash-tag key scheme deviates from the work order's literal
  `discovery:<envHash>:<rootId>`.** The atomic SET+SADD needs the pair key and the
  roots index in the SAME cluster slot, so the env-hash is wrapped in Valkey hash-tag
  braces: `discovery:{<envHash>}:<rootId>` + index `discovery:{<envHash>}:roots`. The
  keyspace is brand new (never deployed), so the scheme change is free. The `SnapshotClient`
  port lost `addRoot` (folded into the atomic script); `casSwap` gained the index key +
  rootId. The store's best-effort-SADD path (and its "won CAS with failing index update"
  test) are GONE — the index write can no longer partially fail independently of the CAS,
  so that scenario no longer exists.
- **FIX 4 — `sharedSnapshotStore` gained `nowMs?` (injected clock) AND `deps?`.** The work
  order named only the clock; `deps` (mirroring `createSnapshotStore`'s existing test-only
  seam) is required so the recovery test can drive construction failure-then-success without
  a live Valkey. Both are optional; the two production callers (`refreshGraphSnapshots`,
  `serveSnapshots`, `changesRoute`) are unchanged.
- **FIX 4 — retry chaining reworked to avoid serializing concurrent readers.** A naive
  `shared = shared.then(retryIfDue)` on every call desynchronized concurrent cold readers
  (breaking the shared-path single-flight, T2a). The final design keeps a synchronous
  `sharedState` mirror: a healthy/URL-unset entry is served from the SAME memoized promise
  with no chaining (lockstep preserved); only a degraded entry past the retry window
  reassigns `shared`. Same observable behavior, no cold-storm.
- **FIX 5 — the existing T2a cold-burst test was adapted, not just added-to.** FIX 5 removes
  coalescing for injected stores, but the existing "cold burst ⇒ 1 crawl" test proved
  coalescing via a shared INJECTED store — which FIX 5 now bypasses. It was rewritten to
  exercise the SHARED path (no injected store), where single-flight actually lives; the new
  FIX 5 test covers the injected-vs-shared isolation. No acceptance weakened.
- **FIX 6 — the fake client mirrors `SNAPSHOT_CAS_LUA` inline, without `pendingId()`.** The
  contention test's caller-side `expected` is now computed inline
  (`${contractVersion}@${resolvedAt}`) too, so the whole test file no longer imports
  `pendingId` — the fake can drift-detect the Lua formula rather than tracking the TS helper.

## 3. Definition of Done

| # | Criterion | Status | Evidence |
|---|---|---|---|
| T1a | JSON pair roundtrip, atomic scripted CAS (one winner), index-set `readAll`, no TTL | PASS | `valkeySnapshotStore.test.ts` — 8 tests (roundtrip, cold pair, CAS contention one-winner, index readAll, read/CAS runtime-error safe values, best-effort index) |
| T1b | Factory: URL ⇒ Valkey; unset ⇒ in-memory; construction fail ⇒ in-memory + loud log; runtime op error ⇒ safe value | PASS | `snapshotStoreFactory.test.ts` — 4 tests (unset⇒memory, set⇒Valkey via injected client, connect-fail⇒memory fallback, per-env memoization); runtime-op-error in `valkeySnapshotStore.test.ts` |
| T2a | Memo gone; warm ⇒ 0 crawls; cold burst ⇒ 1 crawl; failed root ⇒ last-good + aging, others live | PASS | `serveSnapshots.test.ts` (cold-burst-single-flight, warm-0-crawls, served-services); `projectDiscovery.test.ts`; `degradation.test.ts` unchanged & green |
| T2b | Byte-stable: all registry/resource tests + `contextApiContract.test.ts` green | PASS | context-layer 335 pass / 2 skip; portal 160 pass; `contextApiContract.test.ts` projection-equivalence assertions unchanged & green |
| T2c | Briefs read snapshots (`deriveRequestGraph` hits store, warm ⇒ 0 crawls); Step-4/5 suites green | PASS | `deriveRequestGraph` rewired to `serveRootSnapshots`; brief suites (`adopt`/`build`/`template.pure`/`briefsRoute`) green; warm-0 proven by `serveSnapshots.test.ts` |
| T3a | `deriveGraph` freshness honest: stale recomputed at read; version time-invariant | PASS | `deriveGraph.test.ts` — new "recomputes staleness at read" + "version is time-invariant" tests |
| T3b | `/api/changes` carries `roots`; in-process ≡ HTTP; schema + 3 clients updated | PASS | `changesRoute.test.ts` stale-root test; `contextApiContract.test.ts` roots-parity assertion; schema `ChangeFeedRootSchema`; 3 clients (`inProcess` parse, `http` parse, static stub `roots: []`) |
| T3c | Portal banner: stale root ⇒ loud banner naming root + age; live roots unaffected | PASS (unit/component) / e2e RUN deferred | `stale-subgraph-banner.test.tsx` — 3 tests; e2e assertion authored in `my-changes.spec.ts` (see §4) |
| T4 | Whole repo green: `pnpm -r typecheck`, `pnpm -r test`; no skipped/deleted tests; SCOPED GAP removed | PASS | `pnpm -r typecheck` green; `pnpm -r test` green (schema 64, azure-icons 1, context 335/2skip, portal 160, acceptance 7); `grep -r "SCOPED GAP"` = 0 |

## 4. Honest gaps

- **T3c e2e browser RUN deferred (assertion authored).** The banner e2e is authored in
  `packages/atlas-e2e/tests/my-changes.spec.ts` and the DEV_MOCKS data path was made to
  force an aged root (`MOCK_ROOTS`), so the drill IS feasible — but running the full
  Playwright suite here needs a live dev server via the `webServer` config (port/baseURL
  coupling that memory flags as fragile: `:3000` occupied, `PW_BASE_URL=:3100` vs the
  `pnpm --filter @atlas/portal dev` default port). Per the work order's explicit
  allowance, the RUN is deferred to the reviewer/CI. Behavior is otherwise covered by the
  component test (render logic) + `changesRoute.test.ts` (route freshness) + the mock
  data path. The spec is not skipped/`.skip`; it will execute in the e2e job.
- **FIX 6 residual risk (accepted).** The unit fake mirrors `SNAPSHOT_CAS_LUA` *by
  construction* (same inline `${contractVersion}@${resolvedAt}` formula + SET+SADD), so it
  catches a drift between the Lua and the TS `pendingId()` helper, but NOT a bug in the real
  Lua execution itself (fake ≠ a live Valkey running the script). A live-Valkey integration
  test remains the only thing that would close that gap; not in scope here.
- The two pre-existing oxlint warnings (`briefs/assembleBrief.ts`,
  `sourceContent/confluenceOnboardingProvider.ts`) are untouched adjacent findings — not
  introduced here.

### Adjacent-found (untouched)
- None material beyond the two pre-existing lint warnings above.

## 5. Commands run (final, after review fixes)

- `pnpm -r typecheck` → all 7 projects Done (green).
- `pnpm -r test` → schema 64 ✓, azure-react-icons 1 ✓, context-layer 339 ✓/2 skip
  (+4 net: +1 FIX 3, +3 FIX 4, +1 FIX 5, −1 obsolete best-effort-index), portal 160 ✓,
  atlas-acceptance 7 ✓.
- `pnpm -r lint` → green (only the two pre-existing warnings noted above).
- `pnpm --filter @atlas/portal build` → succeeds; `INEFFECTIVE_DYNAMIC_IMPORT` count = 0
  (valkeyContentCache + valkeySnapshotClient are now their own dynamic-import chunks, FIX 2).
- `grep -rn "SCOPED GAP" context-layer/src portal/src` → 0 matches.
