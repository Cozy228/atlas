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

## Batch 3 — Opus track

Scope: implemented the M12 SSRF-closed value-fetch primitives — `composeValueUrl` +
`resolveStatusAdapter` in `context-layer/src/locations/statusAdapter.ts`, and
`createTfeStatusAdapter` in `context-layer/src/locations/tfeStatusAdapter.ts`. Made D4
(`adapter.authMode.test.ts`, 6) + D5 (`tfeStatusAdapter.test.ts`, 3) green. No test files
touched (suite frozen at 8a62f176); no schema/route/statusBoard/debugFloor stubs touched.

### Decisions

- **Path-derivation + sanitization rule.** `composeValueUrl` derives the fetch path from
  the location's OWN `id` and NEVER reads `location.url`. The id is hardened down to a
  conservative segment allowlist (`replace(/[^A-Za-z0-9_-]/g, "")`) before it is appended
  under the base. This is SSRF-closed *by construction*, not by filter: `..`, `/`, `//`,
  `@`, `:`, whitespace, and any percent-encoding all fall out of the whitelist, so the
  composed URL cannot escape the allowlisted base origin regardless of what a malicious
  registration supplies. The base is normalized with a trailing-slash trim, then the URL is
  `${origin}/api/v2/workspaces/${segment}` (a TFE-shaped workspace path). Chose a character
  whitelist over `encodeURIComponent` because a whitelist is affirmatively enumerable —
  nothing outside `[A-Za-z0-9_-]` can survive — whereas encoding only escapes and would
  leave `%`, `.` in place.
- **Token-handling posture (service-token).** `createTfeStatusAdapter` captures only the
  `allowlistedBase` (from `TERRAFORM_BASE_URL` — deployment config, not a secret) at
  construction. The read-only token is read from `ctx.env[TFE_STATUS_TOKEN_ENV]` AT FETCH
  TIME inside `fetchValue`; it is never assigned to the adapter object, never logged, and
  never interpolated into any thrown/returned value. The mirrored fetch style (Bearer auth
  header, `GET`, JSON Accept) follows `terraformModuleContentProvider.fetchRegistryModule`.
- **Error-degradation semantics.** Every non-happy path returns `null` (degrade to a
  labeled pointer), never throws out of `fetchValue`, never fabricates: missing/empty token
  (guarded by `if (!token)`, no fetch issued — `seen` stays empty per D5), non-OK response,
  a thrown fetch (unreachable host), and an unparsable/shape-mismatched body (guarded by
  `extractRunStatus`, which walks `data.attributes["current-run-status"]` defensively and
  returns `null` on any mismatch). The `catch` block returns `null` silently so the token
  cannot leak through an error message.
- **`resolveStatusAdapter` registry.** `system === "tfe"` → `createTfeStatusAdapter(env)`;
  anything else → `undefined` (⇒ a labeled pointer, `no-adapter`). `caller-bearer` is a
  declared authMode in the closed set but has no adapter yet (none exists in the tree), so
  the registry supports the mode without wiring `ctx.token`.

### Deviations

- None from the locked contract. `adapterAuthModes` was already correct in the Batch-0
  stub, so no edit was needed for the closed-set assertion.

### Adjacent-found (untouched)

- `statusAdapter.ts` and `tfeStatusAdapter.ts` now form a benign ESM import cycle:
  `statusAdapter` imports `createTfeStatusAdapter`/`TFE_ADAPTER_SYSTEM` (runtime) from
  `tfeStatusAdapter`, which imports `composeValueUrl` (runtime) + `StatusAdapter`/
  `StatusAdapterContext` (type-only) back from `statusAdapter`. Both runtime references are
  only invoked at call time (not module init), so live bindings resolve correctly — verified
  by green tests + typecheck. Flagged only so a future reviewer does not "fix" it by
  inlining the primitive; the shared `composeValueUrl` is the intended SSRF-closed seam.
- `TERRAFORM_BASE_URL` unset ⇒ `allowlistedBase = ""` (mirrors the `?? ""` fallback in
  `composition.ts`/`rootConfig.ts`). Not exercised by the frozen tests; left as-is rather
  than inventing a default host.

### Open questions

- None blocking Batch 3. The `/api/v2/workspaces/{id}` path shape and
  `current-run-status` attribute match the D5 fixture body; if the real TFE run-state
  endpoint differs from the workspace resource, that is a downstream wiring concern for a
  live-integration batch, not this exemplar.

### Self-verify transcript

- `pnpm vitest run src/locations/adapter.authMode.test.ts src/locations/tfeStatusAdapter.test.ts`
  → Test Files 2 passed (2); Tests 9 passed (9) [D4 6/6 + D5 3/3].
- `cd context-layer && pnpm vitest run` → Tests 7 failed | 367 passed | 2 skipped. The 7
  reds are EXACTLY D6 `statusBoard` (4), D7 `statusBoard.noStore` (1), D8 `debugBrief` (1),
  D9 `statusRoute` (1) — all Batch-4+ stubs, out of scope.
- `pnpm -r typecheck` → GREEN (7/7 workspace projects).
- `pnpm exec oxlint context-layer/src/locations/statusAdapter.ts context-layer/src/locations/tfeStatusAdapter.ts`
  → clean (exit 0, no warnings/errors).

## Batch 4 — Opus track

Scope: implement `assembleStatusBoard` in `context-layer/src/status/statusBoard.ts` (Batch-0
`unimplemented` stub) → D6 (`statusBoard.test.ts`, 4) + D7 (`statusBoard.noStore.test.ts`, 1)
green. Touched ONLY that file + this notes section. Suite frozen at `8a62f176` — no test edits.

### Decisions

- **Pure aggregation, ZERO store access.** `assembleStatusBoard` reads only its injected
  inputs (`registrations` + `adapters` + `adapterContext`); it never imports or calls a
  repository, never caches, never persists (P24 recomputed-at-read). D7 spies
  `InMemoryLocationsRepository.put/delete`, `InMemoryAppsRepository.put`,
  `InMemoryEventsRepository.append` and asserts none fire — satisfied by construction, not by
  a guard.
- **Concurrency = `Promise.all` over registrations.** One entry per registered location, in
  registration order (input order preserved). No retry, no timeout, no batching — kept to
  exactly what the contract needs.
- **Per-location fault isolation.** Each location resolves in its own `resolveEntry`; the
  value fetch is wrapped in `try/catch`. A throwing adapter degrades ONLY that entry to
  `fetch-failed` and cannot poison sibling entries — even though the landed `StatusAdapter`
  contract says `fetchValue` already degrades to `null`, the catch guards a contract breach.
- **Reason mapping (closed set, honest floor — never a fabricated value):**
  - no adapter matches `record.system` → `value:null, reason:"no-adapter", fetchedAt:null`
  - adapter `authMode === "none"` → `value:null, reason:"no-value-channel", fetchedAt:null`
    (never calls `fetchValue` — `none` has no value channel by construction)
  - `fetchValue` returns `null` OR throws → `value:null, reason:"fetch-failed", fetchedAt:null`
  - `fetchValue` returns a string → `value, fetchedAt: new Date().toISOString()`, NO `reason`
- **`fetchedAt` = the read moment** (`new Date().toISOString()`) for a live value; `null` for
  every labeled-pointer entry. **`warnings` = `[]`** — the frozen tests assert scope echo +
  statuses only and never reference warnings; empty array is the honest pass-through.
- **`LocationRecord` → `OperationalLocation` projection.** `LocationStatusEntry.location` is
  typed `OperationalLocation` (strict: `{id,system,kind,url,discoveredFrom}`), but the injected
  registrations are `LocationRecord` (adds `appId`/`registeredAt`). `toPointer` drops the
  storage/scope fields so the entry carries only the pointer's public identity and parses the
  `.strict()` shape. The adapter's `fetchValue(location, ctx)` receives this same pointer
  (never the raw record).
- **ADR-0003 by construction.** `LocationStatusEntry` has no `citations`/`evidence` field in
  the schema, so a status value structurally cannot ride a citation — D6's
  `"citations" in status === false` / `"evidence" in status === false` pass because the built
  object never adds those keys.

### Deviations

- None from the locked contract. The stub's `StatusBoardDeps` type and signature were already
  correct; only the body was filled.

### Adjacent-found (untouched)

- The D6 `fakeAdapter` uses `authMode: "service-token"` for BOTH the value-success and the
  null-fetch case, so the `no-value-channel` branch (`authMode: "none"`) is exercised by no
  frozen test in Batch 4 — it is implemented per the schema `locationStatusReasons` closed set
  and locked decision 2/5. If Batch 5's route/e2e coverage does not hit a `none` adapter
  either, that reason path is spec-covered but not test-covered; flagged, not fixed.

### Open questions

- None blocking Batch 4.

### Self-verify transcript

- `cd context-layer && pnpm vitest run src/status/` → Test Files 2 passed (2); Tests 5 passed
  (5) [D6 4/4 + D7 1/1].
- `cd context-layer && pnpm vitest run` → Test Files 2 failed | 74 passed (76); Tests 2 failed
  | 372 passed | 2 skipped. The 2 reds are EXACTLY D8 `debugBrief` (1) + D9 `statusRoute` (1)
  — both Batch-5 `unimplemented` stubs, out of scope.
- `pnpm -r typecheck` → GREEN (7/7 workspace projects).
- `pnpm oxlint context-layer/src/status/statusBoard.ts` → clean (exit 0, no warnings/errors).

## Batch 5 — Opus track

The FINAL batch: the debug brief floor (D8), `/api/status` + client threading (D9),
the Portal status board + self-service registration UI (D10), and whole-repo green
(D12). No `*.test.ts` / `*.spec.ts` was edited (suite frozen at `8a62f176`).

### What was built

- **D8 — debug brief floor (`context-layer/src/briefs/debugFloor.ts`).**
  `assembleDebugFloor({ ctx, service, depth? })` now: derives ONE request-pinned
  graph (`deriveRequestGraph`, the shared discovery path); assembles cited
  troubleshooting Evidence through the SAME executor as adopt/build
  (`assembleBrief` over a local debug relevance contract — `overview`+`security`,
  plus `network`+`examples` when the graph witnesses a `uses-module` edge); loads
  the APP's registrations (only when `ctx.scope.appId` is set) and derives the
  location index (`deriveLocationIndex`); appends ONE "operational floor" block
  carrying the index pointers in `pointers[]` (evidence `[]`, `available` when a
  pointer exists, honest-empty `unresolved`+warning otherwise). Returns
  `{ ...brief, blocks: [...evidenceBlocks, floor] }`. `briefsRoute.ts` now routes
  the `debug` moment to this floor (replacing the Step-4 `emptyBrief` branch, which
  was removed as an orphan) — so `GET /api/briefs/debug` and the eventual
  `explain_error` wrap share ONE assembly path. Free-text error interpretation is
  never done server-side (P12/P15): `assembleDebugFloor` takes no error string and
  runs no LLM/interpretation.
- **D9 — status route (`context-layer/src/api/statusRoute.ts` + `httpRoute.ts`).**
  `handleStatusRequest(ctx)`: reads the scope echo from `ctx.scope`; loads the
  APP's registered locations via `sharedLocationsRepository(env).listByApp(appId)`
  (empty when no `appId` — a registration belongs to an APP); resolves ONE adapter
  per distinct `system` via `resolveStatusAdapter(system, env)`; threads
  `StatusAdapterContext = { fetch: ctx.fetch, token: ctx.token, env }` (the caller
  Bearer for `caller-bearer` adapters); calls `assembleStatusBoard` and returns
  200 `StatusBoardResponse`. Wired `GET /status` into `handleHttpRequest` (same
  style as `/availability`). The Portal in-process + HTTP faces were already
  wired in Batch 0/1 (they call `handleStatusRequest`), so the D9 contract test
  ("status board agrees") went green with the handler body alone.
- **D9 — openapi parity (`portal/src/api/server/openapiDocument.ts`).** The frozen
  `openapiDocument.test.ts` "router ⊆ internal" parity test parses `httpRoute.ts`
  for `method === "X" && path === "Y"` dispatches; my `GET /status` matches that
  shape, so it MUST be documented. Added the `/status` internal path + registered
  the `StatusBoardResponse` component schema (mirrors `/availability`). Also
  refreshed the `/briefs/{moment}` description (the `debug` moment is no longer
  not-yet-available — it assembles the floor). (`/locations` escapes this test by
  its `if (path === …) { if (method === …) }` code shape — method-second — so
  Batch 1 did not need to document it; only the `method === … && path === …`
  static form is caught.)
- **D10 — Portal status board + registration UI.**
  - New: `portal/src/api/server/locations.ts` — `fetchStatusBoard` +
    `registerLocation` server functions (mirror `apps.ts`; go straight to the
    governed `serverContextApiClient`, no mock fixture — the registration
    round-trip needs the real in-process store, like `/apps`).
  - New: `portal/src/components/status/status-board.tsx` — `AppStatusBoard`. A
    labeled `<section aria-labelledby>` "Status board", a `useQuery` over
    `statusBoardQueryOptionsFor(appId)` (skeleton while loading, in-place error +
    Retry, empty-scope note), and the ADR-0003 **uncited register**
    (`data-testid="status-uncited-region"`) — a dashed, tagged band distinct from
    any cited surface. Each entry renders as a live value
    (`data-testid="status-value"`, mono + an "uncited" tag + read stamp) or a
    labeled pointer (`data-testid="status-pointer"`, name + link + an explicit
    "Value unavailable" state with a plain reason — calm, not alarm). The inline
    **register form** (System / Kind / URL, NO secret field) posts via
    `registerLocation` and invalidates the board query; it REPLACES the opener
    button while open (so only one register affordance is in the tree at a time).
  - `queries.ts`: `statusBoardQueryOptionsFor(appId)` (keyed by APP, short
    staleTime, aggregation-at-read — a registration invalidates it).
  - `availability.index.tsx`: renders `<AppStatusBoard>` when an APP is selected
    (the board hangs off the shared selector, like `/changes`).
  - `landing-zone-selector.tsx`: made the dropdown controlled so picking an APP
    **closes** the picker — base-ui keeps radio menus open on select, and the
    open menu's inert overlay blocked the board (see Deviations).

### Decisions (design left these open)

1. **Debug floor lives in `debugFloor.ts`, `templates.ts` untouched.** The debug
   relevance contract (which troubleshooting sections) is a small local planner
   inside `debugFloor.ts`, not a fourth `templateForMoment` branch — keeping the
   shared `briefs/templates.ts` (and adopt/build/change) untouched per the file
   ownership seam. It mirrors the build template's section selection because those
   sections are the ones the fixtures resolve with citations (content is the bar).
2. **The floor is ONE dedicated block, not pointers scattered on evidence blocks.**
   `pointers[]` rides a single "Where do X's things live?" block (evidence `[]`);
   cited Evidence rides the section blocks. Both arrays stay separate by
   construction (ADR-0003), and the "block with pointers" hook is unambiguous.
3. **Status board is over REGISTERED locations only** (not graph-derived pointers).
   `handleStatusRequest` reads `listByApp` — the self-service consumer state. A
   bare landing-zone scope (no `appId`) honestly returns an empty board; the D9
   contract test's `landingZones: awsf` scope therefore agrees at `statuses: []`
   across both faces.
4. **The board sits on `/availability`.** The frozen `status-board.spec.ts`
   navigates to `/availability`, declares+selects an APP, and expects the board
   region there — so `AppStatusBoard` renders in `availability.index.tsx` gated on
   `selectedApp`. Coherent: availability is "where services run + their live
   operational state".
5. **Register form is inline (not the base-ui modal Dialog).** The form replaces
   the "Register a location" opener while open, so the submit button ("Add
   location") is the only register-shaped control in the tree — avoiding a
   Playwright strict-mode collision between the opener (`/register a location/i`,
   which also matches `/^register/`) and the submit (`/^(save|register|add)/i`).
6. **Registration server function has no mock branch.** Unlike `fetchChanges`/
   `fetchBrief` (which use fixtures in `DEV_MOCKS`), the board + registration go
   straight to the in-process store — the whole point is the real round-trip
   (register → the pointer appears), exactly as `/apps` works in dev mock mode.

### Deviations (departed from the work order / where the frozen suite ruled)

1. **`atlas_explain_error` was NOT registered as an MCP tool (work order §A vs the
   frozen suite).** §A says to wire `atlas_explain_error(app, error?)` in
   `portal/.../mcp/tools.ts` as a thin wrap. But three FROZEN tests hard-assert it
   stays UNregistered and listed as not-yet-available: `mcp.test.ts:77` (the
   `tools/list` set equals exactly the 8 existing tools), `mcp.test.ts:87` /
   `mcp.coldstart.test.ts:82` (`not.toContain("atlas_explain_error")`), and
   `mcp.bootstrap.test.ts:171` (bootstrap lists it not-yet-available). Registering
   the tool would turn all four red, and the suite is frozen + D12 requires
   whole-repo green. Per the work order's "disagreement ⇒ stop + log" rule and the
   scope contract's "conservative interpretation", I kept the frozen suite green
   and realized the "thin wrap routing to this floor" at the
   `handleBriefRequest("debug")` seam instead: `/api/briefs/debug` now assembles
   the floor, and `explain_error` will thin-wrap that exact handler verbatim (like
   `atlas_check_adoption` wraps `"adopt"`) the moment the frozen suite is updated
   to admit it. `mcp/tools.ts` was left untouched. This matches Batch-0 deviation
   #3, which already anticipated the MCP wrap as a later concern once the suite
   permits it. **This is the one place the work order's literal instruction could
   not be executed without breaking the frozen contract.**
2. **Touched `landing-zone-selector.tsx` (a Step-3 file outside my named
   ownership).** The D10 flow (`select app → click "Register a location"`) is
   unreachable unless selecting the APP closes the dropdown: base-ui keeps radio
   menus open on select, and the open menu's `data-base-ui-inert` overlay
   intercepts the board click (reproduced from the frozen spec). Made the dropdown
   controlled and set `open=false` in the APP-radio `onValueChange`. Verified
   compatible with the frozen `app-declare.spec.ts` (its post-select assertions —
   app name visible, `Azure menuitemradio` count 0 — hold whether the menu is open
   or closed). Strictly required to make D10 pass.
3. **Register-form security note uses `text-foreground`, not
   `text-muted-foreground`.** Axe flagged the 14px helper at 3.0:1 (light) / 3.4:1
   (dark) — `text-muted-foreground` rendered lighter than its nominal token here
   and cleared the a11y baseline routes but not this panel. Bumped to
   `text-foreground` (a deliberate high-contrast choice for a credential-safety
   note); a board-scoped axe scan then reported 0 color-contrast violations in
   BOTH schemes. The two tinted panels were also switched from `bg-muted/40`
   (alpha, which confused axe's blend computation) to solid `bg-muted` — the
   proven AA-clean surface the app already uses.

### Adjacent-found (untouched)

- The pre-existing oxlint warnings noted in Batch 0/1
  (`sourceContent/confluenceOnboardingProvider.ts:383`,
  `briefs/assembleBrief.ts:284`) remain — out of scope, not touched.
- The base-ui dropdown's "self-declared" badge (tiny 11px `bg-muted
  text-muted-foreground`) shows borderline color-contrast under a stricter,
  broader axe scan than the frozen baseline uses. Pre-existing Step-3 selector
  chrome, not in scope; the frozen `a11y.spec.ts` does not flag it. Flagged, not
  fixed.

### Open questions

- None blocking. If a future step DOES want `atlas_explain_error` callable, the
  frozen mcp tests (`tools/list` exact-set + bootstrap not-yet-available) must be
  updated FIRST, then the tool registered as a thin wrap over
  `handleBriefRequest("debug")` — no new assembly path.

### Self-verify transcript (Batch 5)

- `pnpm -r typecheck` → GREEN (7/7 workspace projects).
- `pnpm -r test` → GREEN: infra 8, `@atlas/schema` 80, `azure-react-icons` 1,
  context-layer **374 passed / 2 skipped**, portal **162 passed**, acceptance 7.
  Zero remaining Step-7 reds. D8 `debugBrief` (1) + D9 `statusRoute` (5) +
  portal contract "status board agrees" all green.
- E2E (own mock server `vite dev --port 3200`, `DEV_MOCKS=1`,
  `PW_BASE_URL=http://localhost:3200`): `playwright test` → **40 passed**,
  including `status-board.spec.ts` (D10) and all `a11y.spec.ts` axe checks (zero
  new serious/critical violations). No test skipped/deleted vs baseline.
- Board-scoped axe scan (`section[aria-labelledby]`, `color-contrast`, light AND
  dark, register form open): **0 violations** in both schemes.
- `pnpm exec oxlint --deny-warnings` over every touched source file → clean
  (exit 0).

### Files changed (Batch 5)

- context-layer: `briefs/debugFloor.ts`, `api/statusRoute.ts`, `api/httpRoute.ts`,
  `api/briefsRoute.ts`.
- portal: `api/server/locations.ts` (new), `components/status/status-board.tsx`
  (new), `api/queries.ts`, `routes/availability.index.tsx`,
  `components/landing-zone/landing-zone-selector.tsx`,
  `api/server/openapiDocument.ts`.

### Reviewer ruling outcome (2026-07-07) — `atlas_explain_error` registered

**Reviewer ruling 2026-07-07: the goal-prompt Seam clause wins over the Step-5
mile-marker assertions.** The Seam section orders that Step 5's
`atlas_explain_error` stub is REPLACED by this step's M7 floor, so the assertions
pinning it as unregistered are stale mile-markers Step 7 is ratified to retire
(house precedent: `bf4e849d`, e2e specs repaired after the Step-5 catalog-tab
retirement). Deviation #1 above is thereby RESOLVED — the tool is now registered.

- **Registered `atlas_explain_error` (`mcp/tools.ts`).** A `group: "moment"` tool,
  a THIN wrap over `briefFromArgs("debug", …, { service })` → the SAME
  `handleBriefRequest("debug")` → `assembleDebugFloor` seam the `/api/briefs/debug`
  + Portal faces already use (no second assembly, mirrors the other moment tools).
  Input: required `service` (like adopt), optional `error`, `ScopeArgs`, `DepthArg`.
  The `error` string is accepted but NEVER reaches the handler / any interpretation
  (P12/P15) — documented as caller-correlated only. `NOT_YET_AVAILABLE` is now `[]`;
  added the `toolErrorMessage` example.

- **Three named assertions flipped (plus one unavoidable sibling), before → after:**
  - `mcp.test.ts:77` — sorted `tools/list` set `[8 tools]` → `[9 tools]` (inserts
    `atlas_explain_error` between `atlas_check_adoption` and `atlas_get_availability`).
  - `mcp.test.ts:87` — `expect(names).not.toContain("atlas_explain_error")` →
    `.toContain(...)`.
  - `mcp.coldstart.test.ts:82` — `expect(toolNames).not.toContain("atlas_explain_error")`
    → `.toContain(...)`.
  - `mcp.bootstrap.test.ts:171` — `notYetAvailable … includes explain_error → true`
    → `→ false`, plus asserts `tools.moments` contains it, plus a NEW `it` that calls
    the tool and asserts it returns a debug-moment `Brief` (registration + call
    rigor, matching the other moment tools).
  - `mcp.bootstrap.test.ts:163` (SIBLING, same describe, not separately named but the
    same "unregistered" pinning) — `not.toContain` → `toContain`; leaving it red
    would contradict "registered and functional". Flagged here for transparency.
  Nothing else weakened or deleted; no other tool entry removed (the enumerated
  atoms/moments stay intact). Stale header/inline comments in the three test files
  were updated minimally to match the flipped assertions.

- **Re-run (exact counts):** `pnpm -r typecheck` GREEN (7/7). `pnpm --filter
  @atlas/context-layer test` → **374 passed / 2 skipped** (76 files). `pnpm --filter
  @atlas/portal test` → **163 passed** (39 files; +1 vs the pre-ruling 162 — the new
  `atlas_explain_error` callable test). `pnpm exec oxlint --deny-warnings` over
  `tools.ts` + the three test files → clean (exit 0).

## Post-merge fix (2026-07-07): e2e idempotency against a reused dev server

`app-declare.spec.ts` + `status-board.spec.ts` accumulated duplicate declared APPs
in the in-memory store across runs against a REUSED dev server → Playwright
strict-mode menu violations (OPEN.md item, now closed). Fix = approach (a),
test-side only: `APP_NAME` gains a per-run `Date.now()` suffix (digits-only, so
still regex-safe for the specs' `new RegExp(APP_NAME, "i")`; same-length digit
strings are never substrings of one another, so a stale menu entry cannot match a
later run's regex). `LOCATION_SYSTEM`/`LOCATION_URL` stay fixed — the board is
scoped to the run's fresh APP, so registered locations cannot accumulate across
runs. No assertion weakened. Independently re-verified (reviewer, not builder
self-report): both specs run TWICE consecutively against one mock-forced server
(`pnpm dev --port 3200` + `PW_BASE_URL`) — 2 passed / 2 passed.
