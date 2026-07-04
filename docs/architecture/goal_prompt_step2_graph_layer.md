# Goal Prompt: Step 2 — L1 The Graph Layer (I1, M1/M2/M6/M8/M10, P16)

Implement implementation-plan.md **Step 2**: per-root **snapshots** in Valkey →
`deriveGraph` (pure, versioned) → the **differ** (pure, closed `EventClass`, stability
damping) → the append-only **`events`** store → a **per-scope change feed** (`GET
/api/changes` + per-scope Atom + a minimal in-portal *my changes* surface). Loop until
the Definition of Done is green.

Read `docs/architecture/implementation-plan.md` (§7 Step 2, §5 acceptance B/C, §8
keep/rebuild crosswalk), `docs/architecture/mid-level-design.md` (§10 M1, M2, M6, M8,
M10; §1 graph vocabulary), `docs/architecture/direction-decision-log.md` (P14, P16, P26,
P29, P30, **P31**), ADR-0013 (§4 honest-empty, §6 one-clock), and the memory notes on
Valkey packaging + logging before starting. This prompt is the executable distillation;
on conflict those documents win.

> **Governing decision — P31 (owner, 2026-07-05): the machine-derived change feed and the
> editorial What's New are two different surfaces; Step 2 does NOT rewire What's New.**
> `resolveReleaseNotes` / `whatsNew.ts` stays exactly as it is — a live projection of the
> federated-platform **Confluence "What's New" page** into releases + announcements, an
> **editorial newsletter / announcement** surface authored by humans. The differ-derived
> feed this step builds is the **"my changes"** surface of M8 — automatic, scoped, cited —
> and it lands on the **app-home / dashboard** side (the I6 "my change-feed slice"), NOT
> inside What's New. This is a return to M8's original wording ("in-portal *my changes*
> surface + per-scope Atom feed"); implementation-plan Step 2 prose, acceptance line C, and
> §6 A2's "What's New fed by derivation" all read against P31 and are being realigned in the
> plan doc — until that lands, **P31 wins here.** No teardown of What's New; positioning only.

> Layout ruling (inherited from Steps 1 & 3): everything lands in `context-layer`,
> `@atlas/schema`, and existing portal files, plainly named — no new workspace package,
> **no design-doc layer names (L0–L4) in code or paths** (the code says `snapshot`,
> `graph`, `differ`, `events`, `changeFeed`; "L1" lives only in docs). Mirror the
> feedback / apps precedent everywhere a precedent exists.

## Goal

After this step, **the platform's truth is a versioned, aging, self-witnessing graph**:

- Discovery no longer memoizes in process memory — each independently-failing **source
  root** persists a **snapshot** to Valkey with a real `resolvedAt`; cold start serves from
  the snapshot with no crawl; one root failing ages **exactly one subgraph**, loudly, while
  the others stay live (acceptance B).
- `deriveGraph` turns the snapshots into a **versioned graph** (content-hashed); every
  request pins one graph version at entry — no torn reads across roots mid-transition (I1).
  The registry + resource records become **projections of the graph**, their external
  shapes byte-stable (transport-wiring guard).
- The **differ** (pure: two successive graph versions → `ChangeEvent[]`) emits a **closed**
  `EventClass` set with **stability damping** (a delta must survive two consecutive
  successful parses before it becomes an event — M6), derived **inline at the snapshot
  transition** by the CAS winner (M10) — no free-running worker — and written **append-only,
  content-hash-idempotent** to DynamoDB `events` (M1).
- A **per-scope change feed** reads that store: `GET /api/changes?since=…` scoped through
  `ctx.scope` (Step 3's `landingZoneIds[]` set / `appId`), a per-scope **Atom** feed, and a
  minimal in-portal **"my changes"** dashboard surface driven by the existing APP/LZ
  selector. **What's New is untouched (P31).**

```text
discovery roots ──parse──▶ Valkey snapshot            deriveGraph          differ (M6 damping)
(availability page(s),     discovery:<envHash>:<root>  (pure, versioned) ─▶ two graph versions
 TFE modules, security)    K=2 · resolvedAt · SWR ─────┘  content-hashed      → ChangeEvent[]
                           CAS transition (M10) ─── winner derives inline ─────────┘
                                                                                    ▼
                                            DynamoDB events (append-only, idempotent, M1)
                                                                                    ▼
                           ctx.scope ─▶ GET /api/changes?since= · /changes.atom · "my changes" panel
                                        (What's New = separate editorial Confluence projection, P31)
```

## Current-tree facts (verify at HEAD before starting)

- **Discovery is an in-memory memo today.** `context-layer/src/composition.ts` runs two
  passes (`discoverServiceSources` = availability + Terraform; `discoverGuardrails` =
  security Confluence) and memoizes the whole result in a module-level `discoveryCache`
  keyed by `discoveryKey(env)` (composition.ts:62, 113-129, 171-185). This memo is what
  Step 2 replaces with Valkey snapshots (crosswalk §8: "composition.ts's env-hash in-memory
  memo → L1 snapshot + graph derivation").
- **Derivation is resource-first today.** `deriveRegistry` / `deriveServiceResources` /
  `deriveGuardrailResources` (composition.ts:290-301) build registry + `ResourceContextRecord[]`
  directly from the discovered lists. I1 inverts this: a `graph` becomes the substrate and
  these become **projections of it** (their outputs stay shape-stable).
- **Valkey is a hard dependency, packaged.** `@valkey/valkey-glide` static import,
  `ResilientContentCache` degrade-to-memory, `withCache` (single-flight + negative cache +
  SWR + auth-digest keys) already exist and are exactly the L0/L1 machinery (crosswalk keeps
  them). ⚠️ Reuse `withCache`/the existing cache seam; do **not** add a second cache clock
  (M4/ADR-0013 §6). ⚠️ Valkey infra is provisioned for content cache; confirm the snapshot
  keyspace shares it (no new infra for snapshots — M2/M10 both say "existing Valkey store").
- **`events` has no store, schema, or differ** — grep-confirmed absent (`ChangeEvent`,
  `deriveGraph`, `EventClass` do not exist). Everything in this step is new code.
- **DynamoDB house style is set twice** (feedback, apps): single-table `pk`/`sk` + `gsi1`,
  `@aws-sdk/lib-dynamodb`, `*RepositoryFactory` with `NODE_ENV=production` fail-fast when the
  table env is absent, `infra/main.tf` table + IAM + ECS env, a `dynamodb_*_table.md` doc,
  and `infra/test/terraform.test.ts` coverage. `events` mirrors this exactly.
- **What's New is a live Confluence-page projection** — `portal/src/api/server/whatsNew.ts`
  → `context-layer/src/releaseNotes/resolveReleaseNotes.ts` (one fetch + render + two
  parses → `Release[]` + `Announcement[]`). **Do not touch it (P31).** It is not part of
  this step's surface.
- **`ctx.scope` is live (Step 3).** `createResolutionContext` seats `scope.landingZoneIds[]`
  by value or by reference; availability is its first reader. The change feed is its second.
- Transport-wiring guard = `context-layer/src/api/contextApiContract.test.ts`; acceptance =
  `packages/atlas-acceptance`; e2e = `packages/atlas-e2e` (`DEV_MOCKS=1`); pino observability
  per the logging memory (leveled, always-on).

## Locked decisions (do not re-litigate)

1. **Snapshot = one key per independently-failing source root (M2/M10).** Key
   `discovery:<envHash>:<rootId>` in the existing Valkey store; value = the root's **parse
   output** (the descriptive facts — availability matrix rows, module versions, guardrail
   catalog entries), a real `resolvedAt`, and the parse-contract version. **K=2 retention**
   (current + previous, the differ's two inputs) — no history beyond K=2 lives here (that is
   what `events` is for). `rootId` granularity is pinned by the acceptance drill "kill one
   root → exactly one subgraph ages": choose roots so that holds (availability page **per
   cloud/LZ** — never one singular root for all clouds, P26/P29; the TFE module probe set;
   the guardrail Confluence space). **Source content bodies are never snapshotted** — only
   the descriptive graph-facing facts (P18/P24; content stays live-fetched at read time).
2. **`deriveGraph` is a pure function producing a content-hashed version (I1).** Input =
   the current snapshots; output = `{ version, nodes, edges, perRootFreshness }`. `version`
   is a stable content hash of the inputs. **Nodes/edges are a closed vocabulary** grounded
   in the three landed sources: nodes = `service`, `landingZone`, `module`, `guardrail`;
   edges = `available-in` (service→LZ), `uses-module` (service→module), `governed-by`
   (service→guardrail). Every request pins **one** version at entry (thread it on `ctx`);
   no handler reads two versions. `deriveRegistry`/`deriveResources` are re-expressed as
   projections of the graph with **byte-stable outputs** (the transport guard proves it).
3. **Snapshot transition is CAS; the winner derives events inline (M10).** On a fresh
   discovery pass, compare-and-swap the per-root previous-parse pointer on the existing
   Valkey store; the swap **winner** runs the differ and appends events, losers discard.
   Concurrent ECS tasks cannot emit conflicting baselines. **No free-running worker** —
   derivation happens at the transition, in-process.
4. **Differ is pure with stability damping (M6).** Signature: two successive graph versions
   (or their per-root parses) → `ChangeEvent[]`. **Closed `EventClass`** (added to
   `@atlas/schema`): `service-added`, `service-removed`, `available-in-added`,
   `available-in-removed`, `module-version-changed`, `governed-by-added`,
   `governed-by-removed`. **Damping:** a delta is emitted only after it **persists across two
   consecutive successful parses** — a single-parse flap emits nothing; a degradation gap
   (root failed → served last-good) emits **zero events + one aging note**, never a storm of
   phantom removals. A slug rename surfaces honestly as `service-removed` + `service-added`
   (discovery cannot see intent — M6). This closed set grows **only** when a new adapter
   witnesses a new delta kind (P22 growth axis), never speculatively.
5. **`events` store mirrors feedback/apps + is append-only idempotent (M1).**
   `repositories/eventsRepository.ts` (interface + in-memory), `dynamoEventsRepository.ts`
   (single-table `pk`/`sk` + `gsi1`, `EVENTS_TABLE` env, table doc
   `docs/architecture/dynamodb_events_table.md`), `eventsRepositoryFactory.ts`
   (`EVENTS_TABLE` → Dynamo; absent + `NODE_ENV=production` → **throw at construction**;
   else in-memory). **Idempotency:** the write key is a content hash of
   `(eventClass, subject, graphVersionFrom→To)` so a re-derivation of the same transition is
   a no-op — re-running discovery never doubles the feed. Append-only: no update, no delete.
   `since=<cursor>` reads walk the `gsi1` time index. Infra: `aws_dynamodb_table.events` +
   IAM + ECS env in `infra/main.tf`, `infra/test/terraform.test.ts` extended.
6. **Change feed API is governed and scoped (M8).** `GET /api/changes` on the same governed
   router: required `ctx`; filters events to `ctx.scope` (a `service`/`available-in` event is
   in scope iff its subject's LZ set intersects `scope.landingZoneIds`, or unscoped ⇒ all);
   `?since=<cursor>` for incremental reads; response is `{ events: ChangeEvent[], cursor }`.
   A per-scope **Atom** rendering (`GET /api/changes.atom` or `/changes.atom`, same scope
   query) — zero new infra, agent-consumable, serves both push cells of M8's matrix. Add
   `getChanges(scope?, since?)` to `ContextApiClient` + all three impls; extend the transport
   guard so in-process and HTTP faces agree.
7. **Minimal "my changes" surface — dashboard, NOT What's New (P31/I6).** A single in-portal
   route (e.g. `portal/src/routes/changes.tsx`) rendering the scoped feed, driven by the
   **existing Step-3 APP/LZ selector** (reuse it; no new selector). Each row is cited (subject
   node + the source root it came from) and carries its freshness/aging. This is the seed of
   Step 5's APP-home "my change-feed slice"; keep it a standalone route now (Step 5 embeds a
   slice). **Do not add a differ-fed section to `/whatsnew` or Home's What's New block.**
8. **Honest degradation + one clock (acceptance B, ADR-0013 §6).** A failed root serves its
   **last good snapshot**, `resolvedAt` unchanged, staleness **recomputed at read time**
   (the snapshot is never a second clock), with a **loud banner** on any surface that shows
   its subgraph; other roots stay live. Cold start (empty Valkey) serves from the first
   discovery pass, then snapshots — no crawl on the hot path. Per-root freshness is visible
   in the UI and in logs.
9. **Parse-contract fixtures fail CI on format drift (P16).** Each root gets a real-page
   fixture and a contract assertion; a shape the parser no longer recognizes is a **red CI**,
   not a silent empty. Extend the existing parser fixtures (availability, TFE, Confluence) to
   the snapshot/contract level; a drift here is expected churn (Track-B negotiation evidence),
   not an emergency.
10. **Multicloud native (P26/P29).** Roots, snapshots, graph nodes, and event subjects are
    **plural in shape from the first line** — availability is per-LZ, scope is a set, no
    singular cloud/root/zone survives in any signature. A hardcoded singular is a **DoD-caught
    defect**, not a migration. Public-safe: fictional services/zones in every fixture and doc.

## Constraints

- Tests-not-gutted; frozen-suite discipline identical to Steps 1 & 3.
- English code/comments; implementers leave the tree uncommitted; reviewer commits.
- `pnpm` only; Vitest 4 colocated; Playwright only for the one e2e spec (D-UI).
- Reuse `withCache` and the Valkey seam; **no second cache, no new infra beyond the `events`
  table** (snapshots share the existing Valkey store — M2/M10).
- Surgical: What's New (P31), Ask-LLM, Entra, moment briefs (Step 4), moment tools (Step 5),
  and **subscriptions/push** (deferred below) are all out of scope.

## Definition of Done (each maps to a named test)

| # | Criterion | Proof |
|---|---|---|
| D1 | Snapshot store: a discovery pass persists per-root snapshots to Valkey with real `resolvedAt` + K=2 retention; cold start serves from snapshot with no re-crawl | `snapshotStore.test.ts` (fake Valkey; assert 0 crawls on warm read) |
| D2 | `deriveGraph` is pure + content-hashed: same snapshots ⇒ identical `version`; a changed snapshot ⇒ new version; one request pins one version | `deriveGraph.test.ts` (golden versions) |
| D3 | Registry/resource projections are byte-stable off the graph (no external shape change) | existing registry/resource tests stay green + `contextApiContract.test.ts` |
| D4 | Differ golden: add/remove/version-change/link deltas → the exact closed `EventClass`; slug rename ⇒ removed+added | `differ.test.ts` |
| D5 | Damping: single-parse flap ⇒ 0 events; degradation gap (root fails → last-good) ⇒ 0 events + 1 aging note; a delta persisting across two parses ⇒ 1 event | `differ.damping.test.ts` |
| D6 | CAS transition: concurrent passes ⇒ one winner derives, no duplicate/torn events | `snapshotTransition.test.ts` |
| D7 | `events` append-only + idempotent: same transition re-derived ⇒ no new rows; `since=` reads incrementally | `eventsRepository.test.ts` (in-memory + mocked Dynamo) |
| D8 | Prod fail-fast: `NODE_ENV=production` without `EVENTS_TABLE` throws at construction; dev in-memory | `eventsRepositoryFactory.test.ts` |
| D9 | `GET /api/changes` governed + scoped: scope filters events; unscoped ⇒ all; Atom renders; in-process ≡ HTTP | `changesRoute.test.ts` + extended `contextApiContract.test.ts` |
| D10 | Honest aging: kill one root ⇒ exactly that subgraph ages with a loud banner, others live; staleness recomputed at read | `degradation.test.ts` + the e2e drill |
| D11 | Parse-contract fixtures fail CI on format drift for every root | per-root `*.contract.test.ts` |
| D12 | Portal "my changes" surface renders the scoped feed via the existing selector; **What's New untouched** (its tests unchanged, no differ import in whatsnew path) | `packages/atlas-e2e/tests/my-changes.spec.ts` (DEV_MOCKS=1) + a guard asserting `whatsNew.ts` imports no differ/graph symbol |
| D13 | Whole repo green: `pnpm -r typecheck`, `pnpm -r test`, e2e primary; infra test covers `events`; no skipped/deleted tests vs baseline | CI-equivalent local run |

## Batches

- **Batch 0 (test author, built once):** all schema stubs (`ChangeEvent`, `EventClass`,
  `GraphVersion` shapes) + snapshot/graph/differ/repository/route signatures throwing
  `unimplemented` (existing signatures untouched; repo typecheck stays green). Additive
  `ContextApiClient.getChanges(scope?, since?)` added here (existing impls keep compiling;
  honored in Batch 3). Full D1–D12 suite red for behavioral reasons only; the D12 Playwright
  spec authored but excluded from the red loop (no dev server in Batch 0).
- **Batch 1:** snapshot store over Valkey + CAS transition + composition rewire (replace the
  `discoveryCache` memo) → D1, D6 green.
- **Batch 2:** `deriveGraph` + registry/resource projections off it → D2, D3 green.
- **Batch 3:** differ + damping + `events` store (in-memory + Dynamo + factory + infra) +
  inline derivation at transition → D4, D5, D7, D8 green.
- **Batch 4:** `GET /api/changes` + Atom + client threading + scope filter → D9 green.
- **Batch 5:** portal "my changes" route + honest-aging banners + per-root contract fixtures
  + table doc → D10, D11, D12, D13 green.

## Execution arrangement (same as Steps 1 & 3)

Batch 0 built once and review-frozen. Batches 1–5 built twice, independently — one Claude
Opus agent, one Codex (gpt-5.5, medium) — in isolated git worktrees forked from the reviewed
Batch-0 commit, against the same frozen suite. Fable reviews both per `atlas-review-standard`,
scores, merges the winner grafting superior fragments from the runner-up.

## Review gates (Fable)

1. After Batch 0: suite reviewed against this DoD; defects fixed at the gate and re-frozen.
2. At DoD: both diffs reviewed (boundaries, dead code, port design, type safety, one-clock
   discipline, barrel hygiene, honest-gap); winner merged and committed by the reviewer.

## Revert

Every piece is additive or a cache: snapshots are derivation cache (loss ⇒ re-discover);
`events` is append-only and keeps history for re-enable; the feed surfaces fall back to
absence; **What's New is never touched, so it is the standing fallback change surface**.
Reverting restores composition.ts's in-memory memo without data loss.

## Deferred with rationale (do not build now)

- **Subscriptions** (`POST /api/subscriptions`, stored scope + `eventClasses`, M6 relevance
  filter) — the pull feed is fully scoped by `ctx` via the URL, so a stored subscription
  earns its keep only with **push**; defer both together. A2 is now assumed true (cadence
  exists), which *unblocks* them but does not mandate them in this step.
- **Push delivery** (SNS/SSE, M8 upgrade path) — Implementation-dependency; the Atom feed is
  the "now" channel.
- **APP-home embedding** of the change-feed slice + the situation card — Step 5 (I6); Step 2
  ships the standalone `/changes` surface it will later embed.
- **Moment briefs consuming the feed** — Step 4 (L3/L4).
- **Live operational values / status** on any node — Step 7 (P24/M12); Step 2 snapshots only
  descriptive facts, never status.

## A2 measurement (Track-A, non-blocking)

A2 (90-day change cadence) is **assumed true** (owner, 2026-07-05), so no posture gates on it.
Still record the number in implementation-plan §12: count would-be events from the availability
page's Confluence version history + the TFE module version history over the trailing 90 days,
once the differ can replay them. This is measurement, not a build gate.
