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
