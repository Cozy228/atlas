# Goal Prompt: Step 7 — Status Board + Self-Service Registration (P24, M12, M7)

Implement implementation-plan.md **Step 7**: three ADR-0003-shaped pieces —
(1) the **location index** ("where this APP's things live", derived from graph edges; the
debug brief's floor + `explain_error`'s first version, M7); (2) the **status board** —
**aggregation-at-read** of live operational values fetched through per-system adapter
`authMode`, displayed read-only, uncited, visually separated, **never stored, no history,
no alerting** (P24); (3) **self-service registration** — teams register locations
(`{ system, kind, url }`) as consumer state; a system without a value-capable adapter renders
as a **labeled pointer** until access lands. The first `service-token` adapter (TFE class)
walks the M12 model end-to-end. Loop until the Definition of Done is green.

Read `docs/architecture/implementation-plan.md` (§7 Step 7, §5 acceptance G, §4 lifecycle),
`docs/architecture/mid-level-design.md` (§1 `OperationalLocation`; §10 **M12** auth modes +
allowlist + never-store-secrets, **M7** debug floor, **M3** identity-free consumer state),
`docs/architecture/direction-decision-log.md` (**P24** aggregation-at-read only, P18
content-is-the-bar, P26), **ADR-0003** (the pointer/value line — a fetched value is
operational status, uncited, never Evidence, never stored), and the Step-2 graph
(`GraphEdge`, `deriveGraph`) + Step-3 consumer-state precedent (`apps` store) before
starting. This prompt is the executable distillation; on conflict those documents win.

> **This step can run IN PARALLEL with Step 4** — its module tree is disjoint
> (`locations/` + `status/` + a registration store vs Step 4's `briefs/`), and the four
> moments were split so **debug is here, not in Step 4** (Step 4 = adopt/build/change). The
> shared foundation (graph edges, scope, consumer-state house style) is already landed.

> **Layout ruling (inherited from Steps 1–3):** everything lands in `context-layer`,
> `@atlas/schema`, and existing portal files, plainly named — no new workspace package,
> **no design-doc layer names in code or paths** (`locations`, `status`, `registration`,
> `adapter`). Mirror the apps / feedback / graph precedent everywhere a precedent exists.

## Goal

After this step, **an APP can see where its things live and their live state — honestly,
without Atlas ever becoming a monitoring system or a secret store**:

- **Location index (M7).** From the graph's edges (Step 2) + the APP's registered locations,
  answer "where does this APP's stuff live" — the debug brief's **floor**. An
  `OperationalLocation` is `{ id, system, kind, url, discoveredFrom }`: a **pointer record**
  whose *existence* is discovered/registered with provenance; any *value* fetched through it
  is operational status — **uncited, never stored, never Evidence** (ADR-0003).
- **Status board — aggregation-at-read (P24).** For the scope's registered locations,
  live-fetch current values through the owning system's adapter, display them **read-only,
  uncited, visually separated** from cited Evidence. **No durable store, no history, no
  alerting.** A fetch failure degrades to a **labeled pointer** (the honest floor), never a
  fabricated value.
- **Adapter `authMode` (M12).** A closed set: **`caller-bearer`** (thread the caller's token;
  Confluence class) / **`service-token`** (a narrow-scoped read-only env token; TFE class) /
  **`none`** (no value channel — the block stays a labeled pointer). Values fetch **only**
  through the adapter's **allowlisted API base**, **never an arbitrary URL GET** — SSRF is
  **closed by construction, not by filter**. **Atlas never stores a team's secret**: a system
  needing team-owned credentials is a fetch-access negotiation (Track B), not a vault feature.
- **Self-service registration.** Teams register `{ system, kind, url }`; records are consumer
  state (identity-free, labeled, logged — M3), stored like `apps`. **No secret field exists
  in the registration schema** (a registration carrying a token would be a secret store + an
  SSRF proxy simultaneously — the rejected shape). The `url` is a human link only; value
  fetching goes through the owning adapter's allowlisted base.
- **Debug brief floor (M7).** The debug moment (deferred from Step 4) assembles the target
  capability's troubleshooting sections as cited Evidence **plus** the location index's
  pointers/values as the operational floor — content is the bar, locations are the floor
  (P18). Free-text error interpretation is never done server-side (P12/P15 — the consuming
  agent's job).

```text
graph edges (Step 2) + registered locations (consumer state)
        │
        ▼
location index  ── "where this APP's things live" (pointers, provenance) ──▶ debug floor (M7)
        │
        ▼
status board (aggregation-at-read, P24)
   for each location → adapter.authMode:
     caller-bearer → fetch via allowlisted base w/ caller token   (Confluence class)
     service-token → fetch via allowlisted base w/ env read-token (TFE class — the M12 walk)
     none          → labeled pointer (honest floor)
   value → displayed read-only, UNCITED, visually separated, NEVER stored (ADR-0003)
   fetch fails     → degrade to labeled pointer
        ▲
   SSRF closed by construction: value fetch ONLY through the adapter's allowlisted API base,
   NEVER the registered `url`; the registration schema has NO secret field.
```

## Current-tree facts (verify at HEAD before starting)

- **The graph edges are the location substrate (Step 2).** `GraphEdge` / `deriveGraph` exist;
  the location index reads them + the APP's registered locations. **No `locations`/`status`
  surface exists yet** — grep-confirmed absent (`OperationalLocation` value-side,
  `statusBoard`, `registerLocation`, adapter `authMode`).
- **Consumer-state house style is set (Step 3).** `apps` store =
  `repositories/{appsRepository, dynamoAppsRepository, appsRepositoryFactory}` + single-table
  `pk`/`sk`/`gsi1`, `APPS_TABLE` + prod fail-fast, table doc, infra + terraform test. The
  locations registration store mirrors this exactly (`LOCATIONS_TABLE`).
- **Scope + governance are live (Steps 1+3).** `createResolutionContext` seats scope;
  `ctx.token` carries the opaque caller Bearer (the `caller-bearer` authMode threads it).
  The status board is a scope reader like availability/changes.
- **`OperationalLocation` schema is sketched (mid-level §1) but not landed** — Step 4's Batch
  0 lands the *pointer* shape for `BriefBlock.pointers[]`; Step 7 lands the value-side +
  registration + adapters. (If Step 4 hasn't merged, Step 7's Batch 0 lands the schema; the
  reviewer reconciles the single source.)
- **ADR-0003 is the hard line.** A value fetched through a pointer is uncited operational
  status: never in `evidence[]`, never in any durable store, visually separated in every
  render. A test asserts zero status values reach any store.

## Locked decisions (do not re-litigate)

1. **`OperationalLocation` + `LocationRegistration` land in `@atlas/schema`.** Location =
   `{ id, system, kind ("workspace"|"pipeline"|"logs"|"dashboard"|"runbook"), url,
   discoveredFrom }`. Registration request has **`{ system, kind, url }` and NO secret / token
   field** (`.strict()` rejects any) — a token in a registration is structural invalidity.
2. **Adapter `authMode` is a closed set + an allowlisted base (M12).** Each system adapter
   declares `authMode ∈ caller-bearer | service-token | none` and an **allowlisted API base**.
   Value fetch composes the base + a derived path from the location, **never the registered
   `url`** (SSRF closed by construction). `none` ⇒ no value channel (labeled pointer).
3. **Never store a secret; never store a value (M12 + ADR-0003 + P24).** No credential is
   persisted. No status value is persisted — the board is **aggregation-at-read**, no history,
   no alerting. Registrations (pointers) ARE consumer state and persist like `apps`.
4. **The first adapter is the TFE `service-token` walk (M12).** A narrow-scoped read-only env
   token (`TFE_STATUS_TOKEN` class) fetches a workspace's current run state through the TFE
   allowlisted base. It walks the full M12 model end-to-end and is the conformance exemplar
   for the next adapter.
5. **Degradation is a labeled pointer, never a lie.** A failed value fetch, a `none` authMode,
   or a system with no adapter renders the location as a **labeled pointer** (name + link +
   "value unavailable" state), never a fabricated or stale value.
6. **Self-service registration is identity-free but logged (M3).** Anyone in the org may
   register a location for an APP; mutations are logged (pino) and the record is labeled
   consumer state. The routes are the only writers (no upsert-on-read).
7. **The debug brief floor (M7).** The debug moment assembles cited troubleshooting Evidence
   **plus** the location index (pointers + at-read values). `explain_error(app, error?)`'s
   first version routes to this floor; free-text error interpretation stays client-side.
8. **Status board is governed + scoped (I2/M11).** `GET /api/status?app=…` (fallback `&lz=`)
   filters to the scope's registered locations; required ctx; `caller-bearer` adapters thread
   `ctx.token`. Registration: `POST /api/locations`, `GET /api/locations?app=…`,
   `DELETE /api/locations/{id}` — the registration store's only writers.
9. **Multicloud native (P26/P29); public-safe fictional data.** Locations, scope, and the
   board are plural from the first line; every fixture/doc uses fictional systems/URLs.

## Definition of Done (each maps to a named test)

| # | Criterion | Proof |
|---|---|---|
| D1 | `OperationalLocation` + `LocationRegistration` schema: strict, **no secret field** (a token in a registration is a 400) | `schema` locations test |
| D2 | Location index: derives "where this APP's things live" from graph edges + registrations, scoped | `locationIndex.test.ts` |
| D3 | Registration store mirrors apps (in-memory + Dynamo + factory + prod fail-fast on `LOCATIONS_TABLE`) | `locationsRepository.test.ts` + `locationsRepositoryFactory.test.ts` |
| D4 | Adapter `authMode` closed set; value fetch composes the **allowlisted base**, never the registered `url` (SSRF closed) | `adapter.authMode.test.ts` |
| D5 | TFE `service-token` adapter fetches a live workspace state end-to-end (mocked); missing token ⇒ labeled pointer | `tfeStatusAdapter.test.ts` |
| D6 | Status board aggregation-at-read: values render read-only, uncited, visually separated; fetch failure ⇒ labeled pointer | `statusBoard.test.ts` |
| D7 | **No status value in any durable store** (spy every repository) and **no secret field anywhere** | `statusBoard.noStore.test.ts` |
| D8 | Debug brief floor (M7): cited Evidence + the location index's pointers/values; `explain_error` routes here | `debugBrief.test.ts` |
| D9 | `GET /api/status` + `/api/locations` governed+scoped; registration round-trip; in-process ≡ HTTP | `statusRoute.test.ts` + extended `contextApiContract.test.ts` |
| D10 | Portal status board + self-service registration form render via the existing APP/LZ selector | `packages/atlas-e2e/tests/status-board.spec.ts` (DEV_MOCKS=1) |
| D11 | Infra: `aws_dynamodb_table.locations` + IAM + `LOCATIONS_TABLE` env; table doc | `infra/test/terraform.test.ts` + `dynamodb_locations_table.md` |
| D12 | Whole repo green: `pnpm -r typecheck`, `pnpm -r test`, e2e primary; no skipped/deleted tests vs baseline | CI-equivalent local run |

## Batches

- **Batch 0 (test author, frozen once):** schema (`OperationalLocation` value-side +
  `LocationRegistration`) + location-index / adapter / status-board / route signatures
  throwing `unimplemented`; additive `ContextApiClient.getStatus` + `registerLocation`;
  registration store stubs mirroring apps; full D1–D11 suite red for behavioral reasons; the
  D10 Playwright spec authored but excluded from the red loop.
- **Batch 1:** the registration store (in-memory + Dynamo + factory + infra) + routes → D1,
  D3, D11 green.
- **Batch 2:** the location index off graph edges + registrations → D2 green.
- **Batch 3:** the adapter `authMode` model + SSRF-closed base composition + the TFE
  `service-token` adapter → D4, D5 green.
- **Batch 4:** the status board aggregation-at-read + never-store assertions → D6, D7 green.
- **Batch 5:** the debug brief floor + `explain_error` routing + `/api/status` + client
  threading + Portal board/registration + transport guard → D8, D9, D10, D12 green.

## Execution arrangement (same as Steps 1–3)

Batch 0 built once and review-frozen. Batches 1–5 built twice, independently — one Claude
Opus agent, one Codex (gpt-5.5, medium) — in isolated git worktrees forked from the reviewed
Batch-0 commit, against the same frozen suite. Fable reviews both per `atlas-review-standard`,
scores, merges the winner grafting superior fragments from the runner-up.

## Seam with Step 4 (running in parallel)

- **`OperationalLocation` schema** is shared: whichever step's Batch 0 lands first owns it;
  the other imports it. Step 4 uses the *pointer* shape in `BriefBlock.pointers[]`; Step 7
  adds the value-side + registration. Reviewer reconciles to one source.
- **The debug moment** belongs to Step 7 (M7). Step 4 ships an honest not-yet-available
  `debug` response; Step 7 replaces it with the floor. No file overlap — Step 4 owns
  `briefs/{adopt,build,change}`, Step 7 owns `briefs/debug` + `locations/` + `status/`.

## Deferred with rationale (do not build now)

- **History / alerting on any value** — explicitly out (P24 aggregation-at-read only; owner:
  "history/alerting 肯定不会做").
- **Additional value-capable adapters** beyond the TFE `service-token` walk — added when a
  real system's fetch-access lands (I5 conformance kit; A3/Track-B), each a plug-in behind
  the closed `authMode` port.
- **Credential vault / caller OAuth for arbitrary systems** — never; team-owned credentials
  are a fetch-access negotiation, not a stored secret (M12).
