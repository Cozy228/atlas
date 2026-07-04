# Goal Prompt: Step 3 — Consumer State + Situation Entry (P17/P21, M3, M11, P26)

Implement implementation-plan.md **Step 3**: the `AppRecord` consumer-state store,
explicit registration, the repo manifest spec, `selfDeclaredAppsAdapter` behind
Step 1's `AppDirectoryPort`, and the first reader of `ctx.scope`. Loop until the
Definition of Done is green.

Read `docs/architecture/implementation-plan.md` (§7 Step 3),
`docs/architecture/mid-level-design.md` (§1 `AppRecord`, §2 persistence map,
§3 consumer-state API, §10 M3 + M11), `docs/architecture/direction-decision-log.md`
(P17, P21, P26) and `docs/architecture/entra-app-scope-implementation-plan.md`
(the adapter-swap seam this step must not foreclose) before starting. This prompt
is the executable distillation; on conflict those documents win.

> Sequencing note (roadmap R0, owner-ratified): Step 3 runs **before** Step 2 —
> R0 (app-scope) = Steps 1+3; the graph layer is R1. Consequence: `Subscription`
> endpoints (mid-level §3) are **deferred to Step 2** — there is no change feed to
> attach to yet. The implementation-plan Step 3 "subscriptions attach" verify line
> moves with them. Nothing in this step may foreclose that attachment.

> Layout ruling (inherited from Step 1): everything lands in `context-layer`,
> `@atlas/schema`, and existing portal files, plainly named — no new workspace
> package, no design-doc layer names (L0–L4) in code or paths. Mirror the
> feedback precedent everywhere a precedent exists.

## Goal

After this step, the **situation** exists as data: an APP is a durable,
self-declared, always-labeled consumer-state record mapping to a landing-zone
*set* (P26); scope resolves **by reference** through the real store, **by value**
from a published repo manifest with zero registration (M11); and one surface —
availability — gives the first *scoped answer*. The Portal APP selector subsumes
the LZ selector; portal self-declare is the fallback for non-repo situations (P21).

```text
repo: atlas.app.yaml ──(agent reads, passes by value — NEVER writes)──┐
                                                                      ▼
portal self-declare form ──POST /api/apps──▶ apps store ──selfDeclaredAppsAdapter──▶ createResolutionContext
     (fallback, M3)         PATCH/GET        (DynamoDB `apps`,        (AppDirectoryPort)        │
                                              in-memory in dev)                                 ▼
                                                                        ctx.scope.landingZoneIds[] ──▶ scoped availability
```

## Current-tree facts (verified 2026-07-04, HEAD 2fc368f)

- Step 1 landed: `createResolutionContext` (`context-layer/src/resolvers/createResolutionContext.ts`)
  vets `ScopeInput` (by-value / by-reference / both, value-wins + `scope_drift`,
  unknown appId + `scope_unresolved`); `AppDirectoryPort` = one method
  `lookup(appId): Promise<{ landingZoneIds: string[] } | null>` (line 67), default
  `nullAppDirectoryAdapter`. `ctx.scope` **has zero readers** (grep-verified).
- HTTP router already parses `?landingZones=` / `?appId=` into `ScopeInput`
  (`context-layer/src/api/httpRoute.ts:134-152`).
- Feedback is the write-path precedent to mirror: `api/feedbackRoute.ts` (validate →
  put → 201), `repositories/dynamoFeedbackRepository.ts` (single-table `pk`/`sk` +
  `gsi1`; `@aws-sdk/lib-dynamodb` already a context-layer dependency),
  `repositories/feedbackRepositoryFactory.ts` (env-switch `FEEDBACK_TABLE` →
  Dynamo, else in-memory), `infra/main.tf` `aws_dynamodb_table.feedback` (~line 274)
  + task-role Dynamo policy + ECS env, `docs/architecture/dynamodb_feedback_table.md`.
  ⚠️ The feedback factory falls back to in-memory **silently** — mid-level §2's
  "fail-fast in production" is an unmet intent there; apps must do better (D6) and
  feedback is noted, not fixed (surgical).
- Availability: `handleAvailabilityRequest()` takes **no ctx** and returns ALL
  zones (`api/availabilityRoute.ts:25`); zones come from `LANDING_ZONES`
  (`landingZones/landingZones.ts:16-22`; ids today: `awsf`, `awsc`, `azure`) via the
  async `AvailabilityProvider` port.
- Portal LZ selector is client-only React context (`components/landing-zone/context.tsx`,
  default `awsf`; selector in `landing-zone-selector.tsx`); the availability page
  filters an all-zones payload client-side (`routes/availability.index.tsx:157-168`).
  Current-LZ **never reaches server code** — the Step 1 decision-7 tail.
- `ContextApiClient` interface: `portal/src/api/contextApiClient.ts:22-39`
  (9 methods; three impls: static browser, in-process, HTTP — `jsonPost` helper at
  `httpContextApiClient.ts:164`).
- `@atlas/schema` has **no** AppRecord/manifest shapes; `warningCodes` at
  `packages/atlas-schema/src/index.ts:24-42`, `apiErrorCodes` at 43-51;
  fs-free manifest-validation precedent = `guidanceManifest.ts`.
- MCP tools (4, read-only) stay the atom layer; `atlas_get_availability` already
  has a client-side `zone` filter param. Moment tools arrive with briefs (Step 5).
- Acceptance suite boots MSW and projects through the governance gate
  (`packages/atlas-acceptance/src/v1Acceptance.test.ts`); Playwright e2e lives in
  `packages/atlas-e2e` (hermetic `DEV_MOCKS=1`).

## Locked decisions (do not re-litigate)

1. **Schema shapes (mid-level §1, P26).** In `packages/atlas-schema/src/index.ts`:
   `AppRecordSchema` = `{ id, name, landingZoneIds: string[] (min 1),
   serviceSlugs: string[], origin: "self-declared" | "registry", declaredAt,
   updatedAt }`. `AppManifestSchema` (the repo manifest, fs-free like
   `guidanceManifest.ts`) = `{ name, landingZones: string[] (min 1),
   services?: string[], appId?: string }` — manifest field names deliberately
   match Step 1's by-value `ScopeInput` vocabulary. Request/response schemas for
   the routes below. `origin` is set by the server, never by the caller;
   `"registry"` exists in the enum from day one (the P17 in-place upgrade seat)
   but nothing writes it in Step 3.
2. **Manifest spec published** at `docs/architecture/app-manifest.md`: file name
   **`atlas.app.yaml`** at the consuming repo's root; fields per `AppManifestSchema`;
   the flow: agent reads the file → passes `landingZones`/`services` **by value**
   (zero registration, never writes — M11); after explicit registration the team
   commits the returned `appId` back into the manifest **themselves** (PR is the
   maintenance surface, P21) — Atlas never writes to a team repo. Include a
   fictional example. (`atlas.app.yaml`, not `atlas.yaml` — the latter is
   speculatively reserved by source-lifecycle-design.md for a different concern.)
3. **Store mirrors feedback, plus the missing prod guard.**
   `repositories/appsRepository.ts` (interface + in-memory),
   `repositories/dynamoAppsRepository.ts` (table doc:
   `docs/architecture/dynamodb_apps_table.md`, same `pk`/`sk` + `gsi1` house style,
   `APPS_TABLE` env), `repositories/appsRepositoryFactory.ts`: `APPS_TABLE` →
   Dynamo; absent + `NODE_ENV=production` → **throw at construction** (durable
   consumer state must not silently land in memory — mid-level §2); absent
   otherwise → in-memory (dev/test posture, `DEV_MOCKS` seam unchanged).
   Infra: `aws_dynamodb_table.apps` + IAM + ECS env in `infra/main.tf`, mirroring
   feedback, with the existing `infra/test/terraform.test.ts` extended.
4. **Routes (mid-level §3), same governed router.** `GET /api/apps` (list),
   `POST /api/apps` (register; server-generated id; 201), `GET /api/apps/{id}`
   (404 → new `apiErrorCodes` entry **`app_not_found`**: an APP is a scope
   entity, not a Resource — mid-level §1 `NodeRef` — so `resource_not_found`
   must not blur that boundary), `PATCH /api/apps/{id}` (partial update:
   `name`/`landingZoneIds`/`serviceSlugs`; bumps `updatedAt`). No DELETE in Step 3.
   Every mutation logs through the existing pino logger (M3: identity-free but
   never silent). `origin` is unconditionally `"self-declared"` on both write
   routes. **No upsert-on-read anywhere** (M11): the ONLY writers are these two
   routes. Add the routes to `ContextApiClient` + all three impls.
5. **Declarations are stored verbatim and warned, never dropped.** On POST/PATCH,
   validate `serviceSlugs` against discovered records (the feedback
   target-existence *mechanism*) and `landingZoneIds` against `LANDING_ZONES`;
   unknown entries are **kept** and reported in the 201/200 response's
   `warnings[]` with two new codes added to the schema union: `unknown_service`,
   `unknown_landing_zone`. (Rationale: a manifest legitimately declares services
   Atlas has not discovered yet — that gap is signal, not error. Same two codes,
   nothing else, join `warningCodes`.) Structural invalidity (empty name, empty
   zone set, unknown fields) is still a 400.
6. **`selfDeclaredAppsAdapter`** (`repositories/selfDeclaredAppsAdapter.ts`, the
   name is pre-ratified by the Entra plan): implements `AppDirectoryPort` over the
   apps repository — `lookup` returns the record's `landingZoneIds` or null.
   `createResolutionContext`'s **default** `appDirectory` becomes the env-selected
   adapter (memoized like `sharedCache`); `nullAppDirectoryAdapter` remains
   exported for callers/tests that want the empty directory. The Entra-era
   `registryAppsAdapter` swap must remain a pure adapter swap — no factory
   signature change.
7. **First scoped answer = availability.** `handleAvailabilityRequest(ctx)` now
   takes the governed ctx (required, Step 1 style): when
   `ctx.scope.landingZoneIds` is present, return only the member zones (unknown
   ids are simply absent); no scope → today's full return, byte-identical.
   `ContextApiClient.getAvailability(scope?)` gains an optional
   `{ landingZones?: string[]; appId?: string }` argument threaded to the ctx on
   the in-process and HTTP faces. **No other surface starts reading scope** —
   resource projection, catalog, discovery, MCP tools stay untouched (briefs are
   Step 4; moment tools are Step 5).
8. **Portal: APP selector subsumes the LZ selector (P17/P21/M3).** The selector
   component offers registered APPs (from `GET /api/apps`) above the raw
   landing-zone list; choosing an APP (a) narrows the zone choice to the APP's
   declared set (default: first member) and (b) shows the APP name with the
   **unconditional `self-declared` badge** (existing badge/label treatment — no
   new display state). A minimal self-declare/edit form (name, zones, services)
   drives POST/PATCH — the P21 fallback for non-repo situations. The availability
   loader threads the selection as by-value scope through
   `getAvailability(scope)` — closing Step 1's decision-7 tail. No APP selected ⇒
   LZ-only behavior, unchanged (this is also the revert posture).
9. **Surgical everywhere else.** No resolver reads scope beyond availability. No
   graph/feed/subscription code. No Valkey work. No Entra/identity fields on any
   record (WS2 adds identity later; the record stays identity-minimal). Public-safe:
   fictional apps/zones in every test and doc example.

## Constraints

- Tests-not-gutted; frozen suite discipline identical to Step 1.
- English code/comments; implementers leave the tree uncommitted; reviewer commits.
- `pnpm` only; Vitest 4 colocated; Playwright only for the one e2e spec below.

## Definition of Done (each maps to a named test)

| # | Criterion | Proof |
|---|---|---|
| D1 | Schemas accept the documented shapes and reject structural invalidity (empty name/zones, caller-supplied `origin`) | `packages/atlas-schema` unit tests for `AppRecordSchema` + `AppManifestSchema` |
| D2 | Registration lifecycle: POST → 201 + id; GET list/id; PATCH updates + bumps `updatedAt`; `origin` always `self-declared`; mutations logged | `context-layer/src/api/appsRoutes.test.ts` (in-memory repo; pino spy) |
| D3 | Dangling declarations stored verbatim + warned (`unknown_service`, `unknown_landing_zone`), never dropped; structural invalidity 400 | `appsRoutes.test.ts` |
| D4 | By-reference resolves through the real store: register → `createResolutionContext({scope:{kind:"by-reference",appId}})` seats the record's zone set; unknown appId still honest-empty `scope_unresolved` | factory integration test extending `createResolutionContext.test.ts` patterns (new file, frozen) |
| D5 | By-value zero-registration scoped answer: a fixture manifest's `landingZones` passed on the wire (`?landingZones=`) → availability returns exactly the member zones; the apps store receives **zero writes** (M11 spy) | acceptance test in `packages/atlas-acceptance` (manifest fixture → raw HTTP) |
| D6 | Prod fail-fast: `NODE_ENV=production` without `APPS_TABLE` throws at repository construction; dev falls back in-memory | `appsRepositoryFactory.test.ts` |
| D7 | Dynamo adapter conforms to the repository contract (same tests run against in-memory and mocked-client Dynamo, `dynamoFeedbackRepository.test.ts` style) | `dynamoAppsRepository.test.ts` |
| D8 | Transport-wiring guard extends to the new surface: `GET/POST /api/apps` and scoped availability agree between in-process client and `handleHttpRequest` | extend `contextApiContract.test.ts` |
| D9 | Portal: register via the form → APP appears in the selector with the `self-declared` badge → zone choice narrows to the declared set; no APP ⇒ LZ-only unchanged | `packages/atlas-e2e/tests/app-declare.spec.ts` (DEV_MOCKS=1) |
| D10 | Whole repo green: `pnpm -r typecheck`, `pnpm -r test`, e2e primary suite; infra test covers the `apps` table; no skipped/deleted tests vs. baseline | CI-equivalent local run |

## Batches

- **Batch 0 (test author, built once):** schema stubs + route/repository/adapter
  signatures throwing `unimplemented` (existing signatures untouched; repo
  typecheck stays green). Locked decision 7 changes an existing signature
  (`handleAvailabilityRequest(ctx)`) — Batch 0 may NOT make that change, so the
  D5/D8 scoped-availability tests observe through the wire (`handleHttpRequest`
  with `?landingZones=`) and through `ContextApiClient.getAvailability(scope?)`,
  whose optional `scope` parameter IS added in Batch 0 (additive: existing impls
  keep compiling; the in-process/HTTP impls honor it in Batch 3). Full D1–D9
  suite red for behavioral reasons only. The D9 Playwright spec is authored but
  may be excluded from the red-verification loop (no dev server in Batch 0); it
  freezes with the rest.
- **Batch 1:** schemas, store (in-memory + Dynamo + factory + infra), routes
  (D1–D3, D6, D7 green).
- **Batch 2:** `selfDeclaredAppsAdapter` + factory default swap (D4 green).
- **Batch 3:** scoped availability + client threading (D5, D8 green).
- **Batch 4:** portal selector subsumption + self-declare form + manifest spec doc
  + table doc (D9, D10 green).

## Execution arrangement (same as Step 1)

Batch 0 is built once and review-frozen. Batches 1–4 are built twice,
independently — one Claude Opus agent, one Codex (gpt-5.5, medium) — in isolated
git worktrees forked from the reviewed Batch-0 commit, against the same frozen
suite. Fable reviews both per `atlas-review-standard`, scores, merges the winner
grafting superior fragments from the runner-up.

## Review gates (Fable)

1. After Batch 0: suite reviewed against this DoD; defects fixed at the gate and
   re-frozen for both implementers.
2. At DoD: both diffs reviewed (boundaries, dead code, port design, type safety,
   barrel hygiene, honest-gap); winner merged and committed by the reviewer.

## Revert

Consumer state is additive: dropping the selector restores LZ-only scoping; the
routes/store/adapter can be disabled without touching Step 1's gate; the manifest
spec doc is the only artifact that escapes the repo (teams may have committed
manifests) — which is why its shape is frozen here and validated from day one.

## Deferred with rationale (do not build now)

- **Subscriptions** (`POST /api/subscriptions`, mid-level §3) — no feed exists
  until Step 2; the record would be dead weight and its shape may still learn
  from A2's cadence data.
- **MCP moment tools & any new MCP params** — Step 5 (I6), after A1.
- **Per-zone brief rendering** of the scope set — Step 4 (L3/L4).
- **Entra identity, `registryAppsAdapter`, membership gating** — R4/WS2·WS3;
  Step 3 must merely keep `AppDirectoryPort` the clean swap seam.
