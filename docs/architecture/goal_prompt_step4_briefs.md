# Goal Prompt: Step 4 — L3 + L4 The Merge (I3/I4, M4/M5/M9, P26/P28)

Implement implementation-plan.md **Step 4**: the externalized in-head merge. A **pure
template** (graph + scope → the list of blocks to ask) → a **bounded-concurrency
executor** (the only I/O) → **one serialized `Brief` value** (I3) → rendered
byte-identically as `GET /api/briefs/{moment}`, `/briefs/{moment}.md`, and Portal page
props. Three moments this step — **adopt / build / change** (debug is Step 7's floor).
Loop until the Definition of Done is green.

Read `docs/architecture/implementation-plan.md` (§4 I3/I4, §7 Step 4, §5 acceptance A/E,
§8 crosswalk "missing L3/L4"), `docs/architecture/mid-level-design.md` (§1 `Brief` /
`BriefBlock` / `OperationalLocation`; §3 brief endpoints; §4 execution model; §10 M4, M5,
M9), `docs/architecture/direction-decision-log.md` (P26, P28, P31), ADR-0013 (§3 stamped
`resolvedAt`, §4 honest-empty two-axis status, §6 one clock), ADR-0014 (§2 the
bounded-concurrency aggregator), and the Step-2 change-feed surface (`handleChangesRequest`
+ the `events` store) before starting. This prompt is the executable distillation; on
conflict those documents win.

> **Layout ruling (inherited from Steps 1–3):** everything lands in `context-layer`,
> `@atlas/schema`, and existing portal files, plainly named — no new workspace package,
> **no design-doc layer names (L0–L4) in code or paths** (the code says `briefs`,
> `assemble`, `template`, `brief` — "L3/L4" lives only in docs). Mirror the
> feedback / apps / graph precedent everywhere a precedent exists.

## Goal

After this step, **every surface answers "for my app, in my landing zones, now" from one
cited Brief**:

- A `Brief` is a pure value: `{ moment, situation: { appId?, landingZoneIds[], origin },
  blocks: BriefBlock[], resolvedAt }`. A `BriefBlock` is `{ id, question, landingZoneId?,
  status, evidence[] (cited section content), pointers[] (OperationalLocation),
  warnings[] }`. Evidence and pointers are **separate arrays by construction** — the
  ADR-0003 line is a type property, not a style rule. Per-zone blocks carry
  `landingZoneId`; LZ-independent blocks render once (P26).
- Assembly is **plan/execute split** (I4): a template is a **pure function** `(graph
  version, scope) → BlockRequest[]` (which edge types to follow, which section subset per
  node — both closed sets, M5 relevance contracts, **no numeric budget**). Only the
  **executor** touches I/O: bounded-concurrency resolution of the planned sections
  (ADR-0014 §2 aggregator; per-request `pageCache`; the `GovernedResolutionContext` threaded
  per I2). **No brief-level cache** — the content cache underneath is the only cache (M4:
  one clock, ADR-0013 §6).
- The three templates (**adopt / build / change**) are **code, not a DSL** (like
  `landingZones/`: configuration input, no template engine, no fourth template without a
  product decision). The **change** template reads the Step-2 feed (`handleChangesRequest` /
  the `events` store) for its blocks. A block **delivers the join** — it never re-serves
  content the agent can discover itself from its repo or the source directly (P28).
- **`?depth=citations|excerpts`** is an **acceptance property, not an option** (M9/P28): the
  agent face must be consumable at `citations` depth (structure + citations, no bodies)
  without paying excerpt cost; human renders default to `excerpts`.
- All L4 renders consume the **same** `Brief` value (I3), so face drift is structurally
  inexpressible. The transport-wiring guard (demoted from the equivalence proof) extends to
  briefs: loader ≡ `GET /api/briefs/{moment}` for sampled scopes.

```text
situation (scope + graph version)
        │  pin ONE graph version at entry (I1)
        ▼
template(moment)  ── PURE ──▶ BlockRequest[]        (which edges to follow · which sections · per-zone)
        │  (adopt · build · change; M5 relevance contracts, no budget)
        ▼
executor  ── bounded-concurrency, threads ctx, content-cache only ──▶ resolves each block
        │  honest-empty: missing ⇒ unresolved+warning · failed fetch ⇒ partial+warning · never absent/truncated
        ▼
Brief { moment, situation{landingZoneIds[]}, blocks[], resolvedAt }   ← ONE value (I3)
        │
        ├── GET /api/briefs/{moment}?…&depth=citations|excerpts   (governed, scoped)
        ├── GET /briefs/{moment}.md?…                              (stable address ≠ stored file; stamped resolvedAt)
        └── Portal brief page props                               (same value; face drift unwritable)
```

## Current-tree facts (verify at HEAD before starting)

- **The graph is the substrate (Step 2).** `deriveGraph` (pure, content-hashed) +
  `GraphVersion`/`GraphNode`/`GraphEdge` exist in `context-layer/src/graph/` +
  `@atlas/schema`. Pin one version at brief entry; traverse its edges. **No L3/L4 assembly
  exists yet** — grep-confirmed absent (`Brief`, `BriefBlock`, `assembleBrief`, `briefs/`).
- **Scope is live (Steps 1+3).** `createResolutionContext` seats `scope.landingZoneIds[]`
  by value or by reference; `handleAvailabilityRequest` and `handleChangesRequest` are its
  readers. Briefs are the next reader — thread the governed ctx, never a bare context (I2).
- **The change feed is live (Step 2).** `handleChangesRequest(ctx, { since })` returns
  scoped `ChangeEvent[]` + cursor; the change template's blocks read it. **What's New stays
  untouched (P31)** — the brief change moment is the derived feed, not the editorial page.
- **The content resolver + cache are the executor's tools.** `getResourceContext` /
  the resolvers + `withCache` resolve a node's sections with cited excerpts and a stamped
  `resolvedAt` (ADR-0013 §3/§6). The executor reuses them; it never adds a second cache.
- **Transport faces are set.** `handleHttpRequest` router + `ContextApiClient` (3 impls) +
  the transport guard `portal/src/api/server/contextApiContract.test.ts`. Briefs add a
  `getBrief(moment, scope?, depth?)` method + a `/briefs/*` router branch, mirroring the
  `getChanges` precedent.
- **Debug is NOT this step.** The `moment` enum includes `debug`, but the debug template +
  its operational-location floor are **Step 7** (M7). Step 4 implements adopt / build /
  change only; a `debug` request returns a documented "not-yet-available" honest response.

## Locked decisions (do not re-litigate)

1. **`Brief` + `BriefBlock` land in `@atlas/schema`** exactly per mid-level §1 (moment enum
   `adopt|build|debug|change`; situation carries the LZ **set** P26; block has separate
   `evidence[]`/`pointers[]`, two-axis `status ∈ available|partial|unresolved` + `warnings[]`
   reusing the existing `warningCodes` vocabulary — no parallel status words). `pointers[]`
   is `OperationalLocation[]` (schema lands here too, empty until Step 7 fills it).
2. **Templates are pure functions (I4).** Signature `(graph: GraphVersion, scope) →
   BlockRequest[]`. A `BlockRequest` names the subject node, the section subset (closed set
   per moment), and the `landingZoneId?` for per-zone blocks. **No I/O, no fetch, no
   `now()`** in a template — honesty is table-driven, tested with **no network mocks**.
3. **The executor is the only I/O (I4 + ADR-0014 §2).** Bounded concurrency; threads the
   `GovernedResolutionContext`; resolves each `BlockRequest` through the existing content
   path; assembles `BriefBlock[]`. Honest-empty is mandatory: **missing data ⇒ `unresolved`
   + the correct warning code (never an absent block); a failed fetch ⇒ `partial` + warning
   (never silent truncation)** — absence of data ≠ negative fact (ADR-0013 §4).
4. **No brief-level cache (M4).** One cache (content), one clock. A brief is cheap once its
   sections are cached; a second cache reintroduces the two-clock collapse ADR-0013 §6
   forbids.
5. **Relevance contracts, no budget (M5).** Each moment declares which edge types it follows
   and which section subset per node — both **closed sets**. Fan-out follows the data (a
   service with 8 modules shows 8). Size is handled by `depth` (M9), never truncation.
6. **`?depth=citations|excerpts` is an acceptance property (M9/P28).** `citations` returns
   structure + citations with **no excerpt bodies**; `excerpts` includes bodies. The agent
   face MUST be correct + useful at `citations`. Human renders default `excerpts`; the
   brief endpoints default `citations` for MCP-shaped callers per §3.
7. **Per-zone blocks (P26).** LZ-dependent blocks (availability, policy) render once per
   member zone with `landingZoneId` set; LZ-independent blocks render once. The situation's
   LZ set drives the fan-out.
8. **Brief endpoints are governed + scoped (§3, I2/M11).** `GET /api/briefs/adopt?service=…
   &app=…` (fallback `&lz=`), `/api/briefs/build?service=…&app=…`,
   `/api/briefs/change?app=…[&since=…]` (fallback `&lz=`) — required ctx, scope from the
   query, same governance-gate factory as every other route. `GET /briefs/{moment}.md` is a
   stable address (≠ a stored file; stamped `resolvedAt`), same semantics as
   `/resources/{…}.md`. Add `getBrief` to `ContextApiClient` + all impls; extend the
   transport guard so the in-process and HTTP faces agree.
9. **One serialized Brief, equivalence by construction (I3).** The Portal loader, the
   `/api/briefs/*` payload, and `/briefs/{moment}.md` render the **same** `Brief` value; the
   CI transport guard proves it for sampled scopes (demoted from a drift-catching test to a
   wiring guard — I3 makes drift unwritable, the guard proves the wiring).
10. **Multicloud native (P26/P29); public-safe fictional data everywhere.** Situation, blocks,
    and per-zone fan-out are plural from the first line; a hardcoded singular zone is a
    DoD-caught defect. Every fixture/doc uses fictional services/zones.

## Constraints

- Tests-not-gutted; frozen-suite discipline identical to Steps 1–3. English code/comments;
  implementers leave the tree uncommitted; reviewer commits. `pnpm` only; Vitest colocated;
  Playwright only for the one brief e2e spec.
- Reuse the content cache + resolvers + governance gate; **no second cache, no new infra**
  (briefs are pure views). What's New (P31), Ask-LLM, Entra, the debug template + status
  floor (Step 7), the MCP moment tools + APP home (Step 5), and the honesty dashboard
  (Step 6) are all out of scope.

## Definition of Done (each maps to a named test)

| # | Criterion | Proof |
|---|---|---|
| D1 | `Brief`/`BriefBlock`/`OperationalLocation` schema: strict, two-axis status, separate evidence/pointers, LZ-set situation | `schema` brief tests |
| D2 | Each template is pure: same (graph, scope) ⇒ same `BlockRequest[]`; no I/O reachable | `template.pure.test.ts` (no network) |
| D3 | Honest-empty: missing data ⇒ `unresolved`+correct code, never an absent block; failed fetch ⇒ `partial`+warning, never truncation | `assemble.honesty.test.ts` (table-driven) |
| D4 | Adopt brief: follows the adopt edge/section contract; per-zone availability/policy blocks for the LZ set | `adopt.test.ts` |
| D5 | Build brief: the "my context" join for the situation's declared services | `build.test.ts` |
| D6 | Change brief: reads the Step-2 feed scoped to the situation; `since=` incremental; cites each event | `change.test.ts` |
| D7 | `depth=citations` returns structure+citations with NO excerpt bodies; `depth=excerpts` includes them; agent face correct at citations | `depth.test.ts` |
| D8 | No brief-level cache: a brief re-assembles off the content cache; a spy proves no second cache clock | `assemble.noCache.test.ts` |
| D9 | Brief endpoints governed+scoped: `GET /api/briefs/{moment}` filters to `ctx.scope`; `.md` renders; in-process ≡ HTTP | `briefsRoute.test.ts` + extended `contextApiContract.test.ts` |
| D10 | One Brief value across loader / `/api/briefs` / `.md` for sampled scopes (I3 wiring guard) | extended `contextApiContract.test.ts` |
| D11 | `debug` is an honest not-yet-available response (deferred to Step 7), never a fabricated block | `briefsRoute.test.ts` |
| D12 | Portal brief pages render the scoped Brief via the existing APP/LZ selector | `packages/atlas-e2e/tests/briefs.spec.ts` (DEV_MOCKS=1) |
| D13 | Whole repo green: `pnpm -r typecheck`, `pnpm -r test`, e2e primary; no skipped/deleted tests vs baseline | CI-equivalent local run |

## Batches

- **Batch 0 (test author, frozen once):** `Brief`/`BriefBlock`/`OperationalLocation` schema
  + `assembleBrief` / template / executor signatures throwing `unimplemented`; additive
  `ContextApiClient.getBrief`; full D1–D12 suite red for behavioral reasons; the D12
  Playwright spec authored but excluded from the red loop.
- **Batch 1:** the executor (bounded-concurrency, ctx-threaded, content-cache only) + the
  `assembleBrief(plan, ctx)` glue → D3, D8 green.
- **Batch 2:** the adopt template + its relevance contract → D2, D4 green.
- **Batch 3:** the build template → D5 green.
- **Batch 4:** the change template (reads the Step-2 feed) → D6 green.
- **Batch 5:** brief endpoints + `.md` + `depth` + client threading + Portal brief pages +
  transport guard + `debug` honest-empty → D7, D9, D10, D11, D12, D13 green.

## Execution arrangement (same as Steps 1–3)

Batch 0 built once and review-frozen. Batches 1–5 built twice, independently — one Claude
Opus agent, one Codex (gpt-5.5, medium) — in isolated git worktrees forked from the reviewed
Batch-0 commit, against the same frozen suite. Fable reviews both per `atlas-review-standard`,
scores, merges the winner grafting superior fragments from the runner-up.

## Deferred with rationale (do not build now)

- **Debug template + operational floor** — Step 7 (M7); Step 4 ships the honest
  not-yet-available `debug` response.
- **MCP moment tools + APP home IA** — Step 5 (I6); the brief handlers are the code path the
  moment tools will wrap.
- **Honesty dashboard** (time-to-brief, tokens-per-brief, …) — Step 6; Step 4 emits the pino
  per-brief signals (moment, scope, per-block status, duration) the dashboard reads.
- **Atom brief items** — a later render of the same Brief value; not this step.
