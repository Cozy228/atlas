---
status: active
review_after: 2026-07-27
---

# Implementation notes — Step 7 (Status board + self-service registration)

Companion to the diff on `feat/step7-status-board`. The reviewer reads this before
the diff. This file covers **Batch 0 only** (test author + frozen signatures);
Batches 1–5 append their own sections.

## Batch 0 — what was authored

Frozen the full D1–D11 suite plus the `unimplemented` signatures the later batches
fill, mirroring the Step 3/4/5 Batch-0 discipline exactly (schema stubs via
`z.custom` that throw on parse; store/route/adapter bodies throw
`"unimplemented (Step 7 Batch N)"`). Repo `pnpm -r typecheck` is GREEN; the
behavioral suite is RED for behavioral reasons only; every pre-existing suite
stays GREEN. The D10 Playwright spec is authored but excluded from the red loop.

### Schema (`@atlas/schema`)
- `packages/atlas-schema/src/index.ts`: Step-7 block after `Brief`. Hand-written
  TYPES (the frozen contract, so downstream stubs typecheck) + `z.custom` schema
  stubs that throw on any parse:
  - `LocationRegistrationRequest` = EXACTLY `{ system, kind, url }` (no secret/token).
  - `LocationRecord` = the stored consumer-state pointer `{ id, appId, system,
    kind, url, discoveredFrom, registeredAt }`.
  - value side: `LocationStatusEntry` `{ location, value|null, reason?, fetchedAt|null }`
    — the uncited at-read value; `StatusBoardResponse` `{ situation, statuses, warnings }`.
  - `locationStatusReasons = ["no-adapter","no-value-channel","fetch-failed"]`
    (real enum), plus `LocationListResponse` / `LocationRegistrationResponse`.
  - `OperationalLocationSchema` (landed in Step 4) is IMPORTED, never re-declared.
- `packages/atlas-schema/locations-schema.test.ts` (D1).

### context-layer
- `repositories/locationsRepository.ts` (port + `InMemoryLocationsRepository`),
  `repositories/dynamoLocationsRepository.ts`, `repositories/locationsRepositoryFactory.ts`
  (`createLocationsRepository` + `sharedLocationsRepository`, `LOCATIONS_TABLE`
  prod fail-fast) — mirror the apps trio + factory. Port adds `listByApp` + `delete`
  (registrations are per-APP and support DELETE).
- `locations/statusAdapter.ts` (D4): `adapterAuthModes` closed set, `StatusAdapter`
  port + `StatusAdapterContext`, `composeValueUrl` (SSRF-closed base composition),
  `resolveStatusAdapter` registry.
- `locations/tfeStatusAdapter.ts` (D5): `createTfeStatusAdapter` + `TFE_STATUS_TOKEN_ENV`.
- `locations/locationIndex.ts` (D2): `deriveLocationIndex(graph + registrations + scope)`.
- `status/statusBoard.ts` (D6/D7): `assembleStatusBoard(deps)` — pure aggregation
  over already-loaded registrations + injected adapters (never touches a repo).
- `briefs/debugFloor.ts` (D8): `assembleDebugFloor` (M7 floor).
- `api/locationsRoutes.ts` (POST/GET/DELETE) + `api/statusRoute.ts` (GET) — governed
  ctx-taking handlers. **NOT wired into `handleHttpRequest`** (Batch 1/5 wiring, per
  the Step-3 precedent where `/apps` was wired in Batch 1, not Batch 0).
- Barrel: `context-layer/src/index.ts` re-exports the new handlers, store,
  adapter model, index, board, and debug-floor symbols.
- Tests: `locationIndex.test.ts`, `adapter.authMode.test.ts`, `tfeStatusAdapter.test.ts`,
  `statusBoard.test.ts`, `statusBoard.noStore.test.ts`, `locationsRepository.test.ts`,
  `locationsRepositoryFactory.test.ts`, `api/statusRoute.test.ts`, `briefs/debugBrief.test.ts`.

### portal
- `api/contextApiClient.ts`: `ContextApiClient` gains `getStatus`, `listLocations`,
  `registerLocation`, `deleteLocation` (+ static stubs — server-side state, the
  static browser client declines like it does for apps/briefs).
- `api/server/inProcessContextApi.ts` + `api/server/httpContextApiClient.ts`: the
  additive methods across both real faces (in-process → the ctx-taking handlers;
  http → `/status` + `/locations`).
- `api/server/contextApiContract.test.ts`: a Step-7 D9 describe block (in-process ≡
  HTTP for registration + the status board).

### infra + e2e
- `infra/test/terraform.test.ts` (D11): asserts `aws_dynamodb_table.locations` +
  IAM (`/index/*`) + `LOCATIONS_TABLE` env + the `dynamodb_locations_table.md` doc.
  `main.tf` is NOT modified (Batch 1 provisions the table + writes the doc).
- `packages/atlas-e2e/tests/status-board.spec.ts` (D10): authored, EXCLUDED from
  the red loop (`@atlas/e2e` has no `test` script, so `pnpm -r test` skips it).

## Decisions (design left these open)

1. **Location scope key.** The goal prompt writes `?app=`/`&lz=`; the LANDED tree
   (briefs/availability/changes) uses `?appId=`/`?landingZones=` via the shared
   `scopeFromQuery`/`toScopeInput`. Followed the TREE — routes take a governed
   `ctx`, and a registration's owning APP is `ctx.scope.appId` (never the body).
2. **`LocationRecord` = OperationalLocation + `{ appId, registeredAt }`.** A stored
   registration IS an `OperationalLocation` (`discoveredFrom: "registration"`)
   scoped to an APP with a server clock — the minimal shape that lets the location
   index and the status board both read one record type.
3. **Registration store keys.** `pk=LOC#<id>`, `sk=METADATA`, `gsi1pk=APP#<appId>`,
   `gsi1sk=REGISTERED#<registeredAt>#<id>` — per-APP `gsi1` partition so
   `listByApp` is a single-partition Query (apps-store house style, scoped to app).
4. **Value-side lives in a distinct type, not on `OperationalLocation`.** The
   locked "import the pointer, never re-declare" rule means the value rides
   `LocationStatusEntry.value` (uncited, nullable), keeping the pointer value-free.
5. **`assembleStatusBoard` takes registrations + adapters as inputs** (no repo
   access) so D7 (“no value reaches a store”) is provable by spying repo writers
   and asserting zero calls — the board is structurally incapable of writing.

## Deviations (departed from the goal prompt / parent, and why)

1. **Type name `LocationStatusEntry`, not `LocationStatus`.** `@atlas/schema`
   ALREADY exports `LocationStatus` (the availability-map region/outpost status,
   line ~811). Re-using the name is a hard redeclare/collision (typecheck TS2300/
   TS2451). Renamed the Step-7 value type to `LocationStatusEntry` /
   `LocationStatusEntrySchema`. The tree won this collision (it is LAW).
2. **The D1 schema test is RED (all `safeParse` calls throw), not "accept-red /
   reject-green".** Under `zod@4.4.3` a `z.custom` check that throws PROPAGATES out
   of `safeParse` (it is not swallowed into `success:false`). So both the accept
   and the reject assertions fail against the Batch-0 stub. This is still "red for
   behavioral reasons" (the stub is unimplemented), never an import/type error, and
   it goes green when Batch 1 lands the real `.strict()` schema — matching the
   Step-3 `apps-schema.test.ts` intent. Documented so the reviewer does not read
   the reject-case reds as spurious.
3. **`explain_error` routing (D8) is asserted at the debug-FLOOR level, not the MCP
   tool level.** The parent note says "explain_error routes here". The MCP
   `atlas_explain_error` wiring is a Batch-5 portal concern (it currently sits in
   `NOT_YET_AVAILABLE`); Batch 0 pins the shared code path — `assembleDebugFloor`
   returning cited Evidence + location pointers — which `explain_error` will wrap
   (thin-wrap discipline, same as the other moment tools). `debugBrief.test.ts`
   drives that floor; the MCP wrap is verified in Batch 5.
4. **Location/status routes are NOT wired into `handleHttpRequest` in Batch 0.**
   The parent lists route handlers in Batch-0 scope; they exist as throwing stubs
   but are unwired, exactly as `/apps` was in the Step-3 Batch-0 commit (`cdc21c14`
   did not touch `httpRoute.ts`). The HTTP-face contract test is therefore red via
   a 404 → `ContextApiError` (behavioral), and Batch 1/5 add the router branches.

## Adjacent-found (untouched)

- `context-layer/src/sourceContent/confluenceOnboardingProvider.ts:383` — `oxlint`
  warns `blockFromNode` is declared but never used (pre-existing dead code).
- `context-layer/src/briefs/assembleBrief.ts:284` — `oxlint` `no-new-array` warning
  (pre-existing). Neither touched (out of scope).
- `.claude/standing-rules.md` is present but untracked in the repo (not mine; left as-is).

## Open questions

- **`?app=`/`&lz=` vs `?appId=`/`?landingZones=`.** Followed the tree (Decision 1).
  If the goal prompt's literal param names are load-bearing for an external agent
  contract, Batch 1 should reconcile the doc, not the code.
- **Does a graph-derived location need its own `discoveredFrom` grammar?** D2's test
  asserts a graph-derived pointer's `discoveredFrom` `includes(TERRAFORM_ROOT_ID)`
  and a registered one is exactly `"registration"`. Batch 2 fixes the precise
  provenance string; the test only pins the two-source distinction.

## Red-test inventory (suite → failing tests → reason is behavioral)

Command: `pnpm -r typecheck` GREEN (7/7 packages). `pnpm -r test` red ONLY in the
new Step-7 suites below; every other suite green (context-layer 67 files pass,
portal 39 files pass, schema 4 files pass, acceptance 2 files pass).

| DoD | Suite | Fails | Behavioral reason |
|---|---|---|---|
| D1 | `packages/atlas-schema/locations-schema.test.ts` | 15/16 | `z.custom` stubs throw `unimplemented` from `safeParse` (real enum test passes) |
| D2 | `context-layer/.../locations/locationIndex.test.ts` | 3 | `deriveLocationIndex` throws `unimplemented (Batch 2)` |
| D3 | `context-layer/.../repositories/locationsRepository.test.ts` | 10 | store bodies throw `unimplemented (Batch 1)` |
| D3 | `context-layer/.../repositories/locationsRepositoryFactory.test.ts` | 3 | factory throws `unimplemented (Batch 1)` (msg not yet `LOCATIONS_TABLE`) |
| D4 | `context-layer/.../locations/adapter.authMode.test.ts` | 5/6 | `composeValueUrl`/`resolveStatusAdapter` throw (closed-set test passes) |
| D5 | `context-layer/.../locations/tfeStatusAdapter.test.ts` | 3 | `createTfeStatusAdapter` throws `unimplemented (Batch 3)` |
| D6 | `context-layer/.../status/statusBoard.test.ts` | 4 | `assembleStatusBoard` throws `unimplemented (Batch 4)` |
| D7 | `context-layer/.../status/statusBoard.noStore.test.ts` | 1 | `assembleStatusBoard` throws before the zero-writes assertions |
| D8 | `context-layer/.../briefs/debugBrief.test.ts` | 1 | `assembleDebugFloor` throws `unimplemented (Batch 5)` |
| D9 | `context-layer/.../api/statusRoute.test.ts` | 4 | location/status handlers throw `unimplemented` |
| D9 | `portal/.../server/contextApiContract.test.ts` (Step 7 block) | 2 | http face 404s (unwired) → `ContextApiError`; in-process schema stub throws |
| D11 | `infra/test/terraform.test.ts` (2 new) | 2 | `main.tf` has no `locations` table + no `dynamodb_locations_table.md` doc |
| D10 | `packages/atlas-e2e/tests/status-board.spec.ts` | — | authored, EXCLUDED (no `test` script; not run by `pnpm -r test`) |

Totals: context-layer 34 new fails (9 files), portal 2 new fails (1 file), schema
15 new fails (1 file), infra 2 new fails. No pre-existing test regressed.

## Batch 1 — Opus track

Turns **D1, D3, D11** green + the **D9 registration slice** (routes + wiring),
against the frozen Batch-0 suite. No test file was edited. The remaining Step-7
reds are untouched (Batches 2–5). `pnpm -r typecheck` GREEN.

### What was built

- **D1 schema (`packages/atlas-schema/src/index.ts`).** Replaced the six
  `z.custom` throw-stubs (and deleted the now-unused `unimplementedLocationSchema`
  helper) with real `.strict()` zod shapes: `LocationRegistrationRequestSchema`
  (exactly `{ system, kind, url }`; `system`/`url` nonempty; `kind` reuses the
  landed `OperationalLocationKindSchema`), `LocationRecordSchema`,
  `LocationStatusEntrySchema` (value side — `value`/`fetchedAt` nullable, optional
  `reason`, NO citation field, strict), `LocationRegistrationResponseSchema`,
  `LocationListResponseSchema`, `StatusBoardResponseSchema`. Reused the existing
  hand-written types via explicit `z.ZodType<T>` annotations so the frozen public
  type surface is unchanged. `LocationStatusReasonSchema` was already a real enum
  and was kept. Per the reviewer ruling, the full value-side set (`LocationStatus`
  entry + board response) landed here in Batch 1, superseding the Batch-0 comment
  that deferred them to Batch 4. → `locations-schema.test.ts` **16/16**.
- **D3 store (`repositories/`).** `InMemoryLocationsRepository` (Map keyed by id,
  `put` validates via `LocationRecordSchema.parse`, `listByApp` filters on
  `appId`, `delete` by id). `DynamoLocationsRepository` mirrors
  `DynamoAppsRepository` with the Batch-0 key schema (`pk=LOC#<id>`, `sk=METADATA`,
  `gsi1pk=APP#<appId>`, `gsi1sk=REGISTERED#<registeredAt>#<id>`); `listByApp` is a
  single-partition `gsi1` Query on `:app = APP#<appId>`; adds `DeleteCommand` (not
  used by apps). `createLocationsRepository` + memoized `sharedLocationsRepository`
  mirror the apps factory with the `LOCATIONS_TABLE` prod fail-fast naming the
  missing var. → `locationsRepository.test.ts` **10/10** + `…Factory.test.ts` **3/3**.
- **D9 registration slice (`api/locationsRoutes.ts` + `api/httpRoute.ts`).** The
  three handlers are the only writers: `handleLocationRegistrationRequest` reads
  the owning APP from `ctx.scope.appId` (never the body — a missing app scope is a
  400), `safeParse`s the body (token/unknown field ⇒ 400 `invalid_request`),
  stamps a server `id`/`registeredAt` + `discoveredFrom: "registration"`, persists
  through `sharedLocationsRepository`, and logs via `logger("locations")` (mirrors
  `appsRoutes`). `handleLocationsListRequest` lists by `ctx.scope.appId`;
  `handleLocationDeleteRequest` removes by id. Wired `GET/POST /api/locations` +
  `DELETE /api/locations/{id}` into `handleHttpRequest`, same branch style as
  `/apps`. `/status` stays UNWIRED (Batch 5). → `statusRoute.test.ts` **3/4** (the
  status-board test stays the Batch-0 stub red); `contextApiContract.test.ts`
  registration test green (status-board test stays red).
- **D11 infra (`infra/main.tf` + `docs/architecture/dynamodb_locations_table.md`).**
  Added `aws_dynamodb_table.locations` (mirrors `events`), the task-role IAM
  `.arn` + `/index/*` lines, the `LOCATIONS_TABLE` ECS env, and the table doc
  (mirrors the apps doc; documents the per-APP `gsi1` partition + `LOC#` keys +
  the no-secret/no-value invariant). → `infra/test/terraform.test.ts` **8/8**.

### Decisions (design left open)

1. **DELETE 404 error code = `invalid_request`.** The frozen `apiErrorCodes` set
   is pinned by `schema.test.ts` (no `location_not_found` member) and MUST NOT be
   extended. A delete of an unknown id returns HTTP 404 with the generic
   `invalid_request` code + an id-naming message. This path is untested by the
   frozen suite (the DELETE test always removes an existing location); the choice
   is the conservative one — don't touch the frozen enum. See Deviations.
2. **Delete is not ownership-gated.** `handleLocationDeleteRequest` removes by id
   without checking the record's `appId` against `ctx.scope.appId`. Locked
   decision 6 is identity-free ("anyone in the org may register/mutate"), the
   frozen DELETE test passes a scoped ctx but asserts only status 200, and no test
   requires ownership. Kept minimal (`_ctx` unused, matching the stub signature).
3. **Scope param names follow the tree, not the goal-prompt literal.** The routes
   read the owning APP from the vetted `ctx.scope.appId` seeded by `?appId=`
   (`scopeFromQuery`), consistent with the Batch-0 note's Decision 1 and the
   availability/changes/briefs precedent — not the prompt's `?app=` literal.

### Deviations (departed from the plan / where the suite disagrees with the prompt)

1. **DELETE 404 uses `invalid_request`, not a dedicated `location_not_found`.**
   The goal prompt's route contract shows a `404` shape but the frozen
   `apiErrorCodes` enum (locked by `schema.test.ts:80`) has no location code and is
   not mine to change. Documented so the reviewer reads the code choice as
   deliberate, not an oversight.
2. **Value-side schemas landed in Batch 1 (not Batch 4).** Per the work order's
   reviewer ruling, `LocationStatusEntrySchema` + `StatusBoardResponseSchema` are
   real `.strict()` shapes now. The Batch-0 in-code comment still says "Batch 4"
   for the value side; left as-is (comment, not behavior) — the reviewer arbitrates
   whether to prune it.

### Adjacent-found (untouched)

- `context-layer/src/sourceContent/confluenceOnboardingProvider.ts:383` and
  `briefs/assembleBrief.ts:284` — the pre-existing oxlint warnings noted in Batch 0
  remain; out of scope, not touched.
- The Batch-0 in-code comments in `@atlas/schema` (lines ~1270-1277) still narrate
  a "Batch 1 / Batch 4" split for the schemas; now that the whole set lands in
  Batch 1 the split is stale prose only. Left for the reviewer (surgical-changes:
  not my defect to rewrite).

### Open questions

- None blocking. If the external agent contract needs the goal-prompt's literal
  `?app=`/`&lz=` param names (vs the tree's `?appId=`/`?landingZones=`), that is a
  doc reconciliation, not a code change (inherited from Batch-0 Decision 1).

### Self-verify transcript (Batch 1)

- `pnpm -r typecheck` → GREEN (7/7 workspace projects).
- `pnpm vitest run` per package:
  - `packages/atlas-schema`: **80 passed / 0 failed** (locations-schema 16/16).
  - `context-layer`: **356 passed, 2 skipped / 18 failed** — the 18 fails are the
    documented later-batch reds: D2 `locationIndex` (3), D4 `adapter.authMode` (5),
    D5 `tfeStatusAdapter` (3), D6 `statusBoard` (4), D7 `statusBoard.noStore` (1),
    D8 `debugBrief` (1), D9 `statusRoute` status-board (1). D3 repo (10) + factory
    (3) + the D9 registration lifecycle (3) are now GREEN.
  - `portal`: **162 passed / 1 failed** — the 1 fail is the D9 contract "status
    board agrees" test (Batch 5); the "registration agrees" test is GREEN.
  - `packages/atlas-acceptance`: **7 passed / 0 failed**.
  - `infra`: **8 passed / 0 failed**.
- `pnpm exec oxlint <touched files>` (incl. `--deny-warnings`) → clean (exit 0).

## Batch 2 — Opus track

Turns **D2** green by implementing `deriveLocationIndex` in
`context-layer/src/locations/locationIndex.ts` (the only source file touched). No
test file was edited; no other stub changed. The remaining Step-7 reds are
untouched (Batches 3–5).

### What was built

`deriveLocationIndex({ graph, registrations, scope })` returns value-free
`OperationalLocation` pointers from TWO scoped sources, in a deterministic order
(registrations first, then graph-derived over the already-sorted `graph.edges`):

1. **Registered locations** — each matching `LocationRecord` is stripped to the
   five pointer keys (`toPointer` drops the consumer-state `appId`/`registeredAt`),
   so its `discoveredFrom` stays exactly `"registration"` and no extra key rides
   the pointer.
2. **Graph-derived workspace pointers** — for each `uses-module` edge whose `from`
   is in `scope.serviceSlugs`, one TFE `workspace` pointer, reading the edges
   `deriveGraph` already produced (the ONE discovery path — never a second parse).

### Decisions (design left these open)

1. **Provenance-string grammar (the Batch-0 open question, now fixed).** A
   graph-derived pointer's `discoveredFrom` is `graph:<rootId>:<edgeType>` —
   e.g. `graph:terraform:uses-module`. It carries the witnessing source root id
   verbatim (so it `includes(TERRAFORM_ROOT_ID)`, the only pin the frozen test
   asserts) plus the edge kind that yielded the pointer, mirroring the per-edge
   provenance `deriveGraph`/`ChangeEvent` already stamp (`rootId`). Registered
   pointers keep their exact `"registration"` string. The two grammars are
   structurally distinct (`graph:` prefix vs the bare literal), so the two-source
   split is greppable, not guessed.
2. **Derived `url` rule — honest, never fabricated.** A workspace pointer's `url`
   is `https://<module address>` where the address is the `uses-module` edge's
   `to` (the real module address the terraform root witnessed, e.g.
   `app.terraform.io/example/parser/aws`). Only a scheme is prefixed; no host,
   path, or workspace slug is invented. The graph carries no separate workspace
   URL, so the module address is the honest data available (locked decision 5 —
   a pointer is a link, values are the status board's job).
3. **Derived `system` = `"tfe"`.** A `uses-module` binding is a Terraform module,
   whose value channel (workspace run state) is the TFE `service-token` adapter
   (locked decision 4, the M12 exemplar). `system` is the open-ended adapter key
   the status board later resolves; `"tfe"` is the honest owning system for a
   module binding.
4. **Derived pointer `id` = `workspace:<serviceSlug>:<moduleAddress>`.** A stable,
   collision-free, non-empty id (schema `min(1)`) derived only from graph data, so
   the same graph always yields the same id (no clock, no randomness).
5. **Scoping semantics.** Registrations filter by `scope.appId` (a registration
   without a matching owning APP is excluded — the third frozen test); when
   `scope.appId` is `undefined` NO registrations are included, since a registration
   always belongs to an APP and, with no target APP, none are "this APP's" — this
   mirrors how the Batch-1 routes read the owning APP from `ctx.scope.appId` (a
   missing app scope is a 400 there). Graph-derived pointers follow
   `scope.serviceSlugs` via the `uses-module` edge's `from`, the same shape the
   brief templates (`briefs/templates.ts`) use to scope graph reads — one graph
   consumer pattern, not a new one.

### Deviations

- None. The implementation stays inside the frozen signature and the two pins the
  test asserts (graph provenance `includes(TERRAFORM_ROOT_ID)`; registered ==
  `"registration"`).

### Adjacent-found (untouched)

- The pre-existing oxlint warnings noted in Batch 0/1
  (`sourceContent/confluenceOnboardingProvider.ts:383`, `briefs/assembleBrief.ts:284`)
  remain — out of scope, not touched.
- `docs/architecture/step7-codex-review-prompts.md` shows as modified in the
  worktree at Batch-2 start (not mine — a pre-existing uncommitted environment
  change); left as-is.

### Open questions

- None blocking. Graph-derived pointers currently derive ONLY from `uses-module`
  edges (the D2-pinned "workspace" case). If a later batch wants pointers from
  other edge kinds (e.g. a `pipeline`/`logs` system), the same
  `graph:<rootId>:<edgeType>` grammar and per-edge scoping extend cleanly — no
  design change, just more edge branches.

### Self-verify transcript (Batch 2)

- `pnpm vitest run` (context-layer) → **359 passed, 2 skipped / 15 failed**.
  `locations/locationIndex.test.ts` is **3/3 green**. The 15 fails are EXACTLY the
  documented later-batch reds: D4 `adapter.authMode` (5), D5 `tfeStatusAdapter` (3),
  D6 `statusBoard` (4), D7 `statusBoard.noStore` (1), D8 `debugBrief` (1), D9
  `statusRoute` status-board (1).
- `pnpm -r typecheck` → GREEN (7/7 workspace projects).
- `pnpm exec oxlint --deny-warnings context-layer/src/locations/locationIndex.ts`
  → clean (exit 0).
