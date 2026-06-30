# 021 — Multi-landing-zone foundation (handoff goal prompt)

> Executable handoff. Elaborates [ADR-0017](../docs/adr/0017-landing-zone-discovery-root.md) into
> cold-executable Work Units. Decisions are settled (grilled 2026-06-27, ground-truth-reconciled
> 2026-06-29) — a fresh agent/subagent executes each Work Unit cold, in order. Builds on plan 017
> (reference discovery) + plan 018 G0–G2/G4 (committed `55aca41`). **Plan 018 G5/G6 are sequenced AFTER
> this** (commit `5e28270` — per-LZ derivation depends on the LZ root). Public-safe, fake-data-only.

## Goal

Make the **landing zone the discovery root**: the only hardcoded input is the LZ list; availability,
services, and links/resources are all **discovered**. This is the LZ-rooted form of plan 018's gate
**G3** — it replaces today's TS availability fixture with per-LZ discovery, fills the
[ADR-0015](../docs/adr/0015-portal-resource-first-ia.md) §5 scope seam at `ResolutionContext.scope`
(LZ first, APP reserved), and ships a current-LZ selector.

**Done-bar (whole plan):**
- `context-layer/src/landingZones/` exports `LANDING_ZONES` (sample set: `awsf` wired; `awsc` + `azure`
  `dataStatus: not-available`).
- Availability is **discovered per-LZ** via `confluenceAvailabilityProvider` (dev: MSW page for `awsf`;
  `awsc`/`azure` honest-empty) — the `availability.ts` TS fixture is **deleted**.
- `ResolutionContext.scope?: {landingZoneId?, appId?}` exists, **no-op default** (absent scope ⇒ today's
  full return — every un-migrated read path unchanged).
- Top-nav current-LZ dropdown (default `awsf`); `awsc`/`azure` show an honest "data not available for
  this landing zone" (ADR-0006), never another LZ's data.
- `pnpm -r typecheck && pnpm -r lint && pnpm -r test && pnpm -r build` green; no `LandingZoneData`(id =
  cloud) references remain.

## The decisions (settled — do NOT re-litigate)

1. **LZ is the only hardcoded root**; availability/services/links are discovered (ADR-0017 d.1). The TS
   availability fixture is **deleted, not renamed** — it was discovery *output* masquerading as *input*.
2. **LZ granularity = named cloud×environment target** (`awsf`/`awsc`/`azure`); `cloud`/`tier`/`account`/
   `region` are **attributes**. `cloud` carries `region`; an LZ never spans clouds.
3. **LZ-list home = a first-class `context-layer/src/landingZones/` module**, **two layers kept
   separate**: (i) **topology** constant `{ id, name, cloud, tier?, dataStatus }` (dev=prod); (ii) each
   LZ's **availability-source locator** from **env** (`ATLAS_CONFLUENCE_*`, dev→MSW page / prod→real
   space), resolved in `composition.ts`. **Not** a dev seed, **not** `data/*.yaml`, **not** an
   `@atlas/schema` instance (schema holds the `LandingZone` *shape* only).
4. **Scope seat = `ResolutionContext.scope?: {landingZoneId?, appId?}`**, no-op default. LZ fills now,
   `app_id` reserved (ADR-0012). LZ does **not** enter `{kind}/{slug}` (same rule as `app_id`).
5. **Per-LZ honesty (ADR-0006):** unwired LZ → `data-not-available`, no fallback, no fabrication.
6. **One identity → per-LZ variants:** one `{kind}/{slug}` resolves through `scope.landingZoneId` to a
   per-LZ variant; variants are **fully independent** (may differ outright). Guidance reuses
   `applies_to.landing_zones` (absent ⇒ global).
7. **Data flow:** `landingZones/` (+ env locator) → `composition.ts` → `confluenceAvailabilityProvider`
   (iterates LZ) → per-LZ availability confluence page → discover services + matrix → discover
   links/resources (plan 017 reference discovery). Unwired LZ → honest-empty.

## Current state (what exists today — verify before editing)

- **Availability is a TS fixture:** `context-layer/src/adapters/dev/availability.ts:334`
  `availabilityZones: LandingZoneData[]`, `id = z.enum(["aws","azure"])` (a **cloud** mislabeled as LZ).
  `listAvailabilityServices()` flattens it into the discovery spine; `toAvailabilityMatrixMarkdown()`
  serializes it for `availabilityMatrixResolver` (read via the dev content provider —
  `resolverTypes.ts:94` "availability stays dev until G3").
- **Port:** `AvailabilityProvider` (`services/availabilityProvider.ts`) = `getZones()` + `listServices()`;
  dev impl `createDevAvailabilityProvider()` wired at `composition.ts:88`.
- **Scope seam unbuilt:** `ResolutionContext` (`resolvers/resolverTypes.ts:54`) = `token` + `fetch` +
  `pageCache`, no `scope`. Read entry = `getResourceContext(deps, params, ctx)`
  (`resources/resourceContextService.ts:129`).
- **Schema:** `@atlas/schema` `landingZoneIds = ["aws","azure"]`, `LandingZoneDataSchema` (id/name/
  locations/services); `topicTypes` still includes dead `"landing-zone"` (0 instances).
- **Guidance:** `data/guidance/*.yaml` `applies_to.landing_zones: [central-landing-zone]` (old id set).
- **Routes:** `portal/src/routes/` has `index`/`overview`/`catalog`/`availability`/`guidance`/`service.
  $provider.$id`/… — **no** `/lz` or `/estate`.
- **MSW source-space:** `context-layer/src/devMocks/{handlers,fixtures}.ts` mock Confluence pages /
  Terraform / CQL — **no availability page fixture yet** (Goal B adds one).

## Target architecture

```
context-layer/src/landingZones/  (LANDING_ZONES topology constant, schema-validated, dev=prod)
  + env (ATLAS_CONFLUENCE_*: per-LZ availability page/space locator; dev→MSW, prod→real)
        │  composition.ts assembles
        ▼
  confluenceAvailabilityProvider  (iterates LANDING_ZONES)
        │
        ├─ awsf (wired)  → MSW availability page →[discover]→ services + matrix
        │                                          →[discover, plan 017]→ links/resources
        └─ awsc / azure (dataStatus: not-available) → honest-empty grid (ADR-0006)

  read scope: getResourceContext(..., ctx.scope?.landingZoneId)  — absent ⇒ full (no-op)
```

## Work Units (each cold-executable by ONE subagent; respect the order)

### Goal A — LZ root + scope seam (context-layer · ADDITIVE · zero breakage)

Build the discovery root and the no-op seam. Nothing reads them destructively yet, so all existing tests
must stay green.

- **A1 — `LandingZone` schema** in `@atlas/schema`: `{ id, name, cloud: ("aws"|"azure"), tier?, dataStatus:
  ("available"|"not-available") }` (+ exported type). Do **not** delete `LandingZoneDataSchema` yet (Goal B
  renames it).
- **A2 — `context-layer/src/landingZones/` module:** export `LANDING_ZONES` constant — `awsf`
  (`cloud: "aws"`, `dataStatus: "available"`), `awsc` (`cloud: "aws"`, `not-available`), `azure`
  (`cloud: "azure"`, `not-available`) — schema-validated at module load. Add a helper that resolves each
  LZ's availability-source locator from env (mirror `createReferenceDiscoveryFromEnv` in
  `composition.ts`); absent env ⇒ honest absence, never a fabricated locator.
- **A3 — `ResolutionContext.scope`:** add `scope?: { landingZoneId?: string; appId?: string }` to
  `resolverTypes.ts`; `defaultResolutionContext()` leaves it unset. Thread it through
  `getResourceContext` to resolvers **without** behavior change (absent ⇒ full return).
- **Done-bar:** module + schema exist, `LANDING_ZONES` validates the 3 LZs; `scope` field present + unset
  by default; `pnpm -r typecheck && pnpm -r test` green (no behavior change anywhere).

### Goal B — LZ-aware availability G3 + naming convergence (context-layer) · depends on A

Replace the fixture with per-LZ discovery and converge the "landing zone" naming in one sweep (so there is
no awkward `id=awsf` but type-named `LandingZoneData` interim).

**Hard constraint (user decision 2026-06-29) — availability's *presentation* does not change.** Keep the
`AvailabilityResponse` **wire shape byte-stable** and do **NOT** touch `matrix-view` / `region-map` /
`region-detail` / the `explore/*` suite. B changes only (a) the provider's data **source** (fixture →
per-LZ discovery) and (b) per-LZ keying. The read narrows to the current LZ via `scope.landingZoneId`, so
`AvailabilityResponse.zones` carries the current LZ — the **array shape is unchanged** (`matrix-view`
already renders `zones[]`, now length 1). The rename (B4) is **type-name + id-value only**
(`LandingZoneData` → per-LZ shape, `id` aws→awsf); the JSON field structure is unchanged, so consumers'
rendering is untouched (only their type imports rename).

- **B1 — `confluenceAvailabilityProvider`:** implements `AvailabilityProvider` by iterating
  `LANDING_ZONES`; for each **wired** LZ fetch+parse its bound availability page into services + matrix;
  **unwired** LZ → empty grid. `getZones()`/`listServices()` become **LZ-keyed** (`id = awsf`, `cloud` an
  attribute). Wire it at `composition.ts` in place of `createDevAvailabilityProvider()`.
- **B2 — MSW availability page** (`devMocks/`): a fixture Confluence page for `awsf` whose parsed rows
  match what `availabilityMatrixResolver` expects (keep the governed-matrix labels S3 / API-GW / Textract
  stable — plan 017 B2). This is the per-LZ form of plan 018's "availability page handler."
- **B3 — delete the fixture:** remove `availabilityZones`/`AWS_SERVICES`/`AZURE_SERVICES`/locations from
  `adapters/dev/availability.ts` (the file's fixture role ends; keep only what discovery needs, if
  anything).
- **B4 — naming convergence:** rename `LandingZoneData`(id=cloud) → the per-LZ shape (`id=awsf`, `cloud`
  attribute) across `@atlas/schema` + context-layer + **portal type imports** (`catalog.index`,
  `service.$provider.$id`, `components/catalog/adopted`, `api/server/availability`); annotate ADR-0009's
  schema note; **delete** dead `topic_type:"landing-zone"`; migrate guidance `applies_to.landing_zones`
  values to the new LZ ids.
- **Done-bar:** `AvailabilityResponse` wire shape unchanged + `explore/*` components untouched
  (availability renders identically for `awsf`); `listServices()` matches the MSW `awsf` page rows
  (generic over N); `awsc`/`azure` honest-empty; matrix resolver still answers S3/API-GW/Textract via
  MSW; no `LandingZoneData`(id=cloud) refs; `pnpm -r typecheck && lint && test && build` green. **Coordinate with 018 before deleting/renaming
  the port** (it owns G5 derivation that consumes `listServices` — but G5 is sequenced after this).

### Goal C — current-LZ selector UI (portal) · depends on A+B

- **C1 — current-LZ state + top-nav dropdown:** a global "current LZ" (default `awsf`) + a right-aligned
  top-nav dropdown listing all `LANDING_ZONES`; switching updates the filtered pages. (Load the TanStack
  Router skills `router-core/search-params` or `navigation` before wiring — current-LZ likely rides a
  search param or root context.)
- **C2 — per-LZ honesty:** selecting `awsc`/`azure` renders an ADR-0006 "data not available for this
  landing zone" state on availability + resource surfaces — never `awsf` data. Unwired LZs appear in the
  dropdown (registered targets), they are not hidden.
- **Done-bar:** dropdown switches current LZ; `awsc`/`azure` render data-not-available; deferred-loading +
  skeletons not regressed; portal typecheck/lint/test/build green.

## Constraints / gotchas

- **Progressive safety:** absent `scope` ⇒ today's full return. No un-migrated read path changes behavior
  (this is what lets A land additively and B land without a flag day).
- **Single live path (018 G1):** no re-introduced fixture/offline branch — availability now fetch+parses
  through MSW like every other source.
- **Live projection (ADR-0013/0014):** request-time resolution, no stored excerpts, `resolvedAt`. Per-LZ
  variants re-resolve; never materialized.
- **MSW fixture shape:** the `awsf` availability page must parse into the same rows the resolver expects
  (it reads `MATRIX_ROWS` = S3 / API-GW / Textract today). Keep labels stable or the resolver breaks.
- **`dataStatus` is honesty, not a feature flag:** `not-available` renders an ADR-0006 dead-end, not a
  hidden LZ.
- **Public-safe:** `awsf`/`awsc`/`azure` are generic sample ids; locators are env vars, not real
  URLs/spaces. No real org LZ names/accounts/Confluence spaces.

## Coordination with plan 018 (G5/G6 — sequenced AFTER this, commit `5e28270`)

| File / concern | 021 (this — G3) owns | 018 G5/G6 (after) |
|---|---|---|
| `adapters/dev/availability.ts` deletion | **yes** (Goal B3) | — |
| `AvailabilityProvider` LZ-aware signature | **yes** (Goal B1) | consumes it in per-LZ derivation |
| availability MSW page | **yes** (Goal B2) | — |
| `composition.ts` availability wiring | **yes** | registry/derivation lines |
| `ResolutionContext.scope` | **yes** (Goal A3) | resolvers pass-through, ignore scope |
| `data/*.yaml`, other `adapters/dev/*` deletion | no | **G5** |
| guidance loader/content | no | **G6** |

> G5's per-LZ derivation is explicitly downstream of this plan's LZ root (commit `5e28270`). 021 lands
> the `AvailabilityProvider` signature + `availability.ts` deletion once; G5 builds on it.

## Out of scope — later phases (each an independently mergeable slice; 021 = the skeleton only)

021 ships the LZ **skeleton**: root + scope seam + availability **truly per-LZ** + the current-LZ
selector. It does **not** push LZ scope into every surface yet — those are separate mergeable slices so
021 stays reviewable, not one giant cross-cutting PR:

- **022 — Newsletter/announcements per-LZ.** Filter/vary newsletter by current LZ. 021 doesn't touch it.
- **023 — Catalog/resource per-LZ variant content (the heavy one).** Today the scope seam is **no-op**
  (Goal A3): switching LZ changes availability + honesty, but a resource's detail **content** is still
  identical across LZs. 023 makes `getResourceContext` actually resolve a per-LZ variant via
  `scope.landingZoneId` (s3@awsf ≠ s3@azure — independent sections/sources/guidance/status). Hero-slice
  one service first.
- **024 — Ask per-LZ.** Ask answers scoped to the current LZ.

**Explicitly NOT doing (user decision 2026-06-29): no multi-LZ comparison view.** Availability follows the
current-LZ selector (one LZ's grid at a time), which 021 Goal B/C already deliver — there is **no**
separate "availability LZ axis" phase. (`/estate` overview + the `/lz/{id}` outer route stay
optional-later per ADR-0017 d.7, and are not comparison surfaces.)

- **APP scope implementation (ADR-0012)** — the `appId` slot stays reserved.
- **15c** (APP-scope seam) is **absorbed** into Goal A's scope seam; **15e** (facets) + **15g**
  (blind-loop) stay deferred-optional per `plans/015`, claiming no number.
