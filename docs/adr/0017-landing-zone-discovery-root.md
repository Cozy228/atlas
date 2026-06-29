# Post-MVP: Landing Zone is the discovery root — multi-LZ as the first fill of the ADR-0015 §5 scope seam

Status: accepted — locked across a 2026-06-27 grilling pass and a 2026-06-29 ground-truth reconciliation; cleared for execution. **Implementation pending in `plans/021`** — not yet in code (no `ResolutionContext.scope`; `availability.ts` fixture still present).
Date: 2026-06-27 (grilling) · 2026-06-29 (reconciled to the post-018 codebase, accepted)

> Builds on [ADR-0015](./0015-portal-resource-first-ia.md) §5 (the reserved visibility/scope
> seam) and [ADR-0009](./0009-availability-matrix-resolver.md) (availability as a cited
> resolver). **Extends** ADR-0009 with a per-LZ availability axis + LZ-rooted discovery — 0009
> foresaw the `availability.ts` fixture's retirement, now executed; the `LandingZoneData`(id=cloud)
> misnomer is a schema-layer rename, not 0009's text — amends [ADR-0012](./0012-app-scoped-entra-identity.md) §5 (the
> reserved scope seam is now first *filled* by LZ, not APP), and pins ADR-0015 §5's abstract
> "injection point" to a concrete seat (`ResolutionContext.scope`). Execution detail lives in
> `plans/021`; this ADR records the decision. The data-flow realization is the
> **landing-zone-rooted form of plan 018's gate G3** (availability discovery) — see Consequences
> for the split with the in-flight 018 work.

## Context

"Post-MVP multi-cloud" was decided, in the user's words, as **"multi-cloud == multi-landing-zone."**
A grilling pass (2026-06-27) locked four foundation forks; a ground-truth pass (2026-06-29)
reconciled them to a codebase that plans 017–020 had moved underneath the original memo.

- **Today availability is a TS fixture, not discovered.** `context-layer/src/adapters/dev/availability.ts`
  hard-codes `AWS_SERVICES`/`AZURE_SERVICES`/locations into `availabilityZones: LandingZoneData[]`,
  and `LandingZoneData.id` is `z.enum(["aws","azure"])` — a **cloud provider mislabeled as a landing
  zone**. `listAvailabilityServices()` flattens that fixture into the discovery spine, and
  `toAvailabilityMatrixMarkdown()` serializes it for the matrix resolver. `resolverTypes.ts:94` marks
  this explicitly: *"availability stays dev until G3."*
- **The discovery main line already points here.** Plan 017 decision **B3**: *"`provider` comes from
  the matrix Source's zone/scope config… Multi-cloud = multiple governed matrices, each scoped to one
  zone/provider."* Plan 018 gate **G3** replaces the fixture with a `confluenceAvailabilityProvider`
  (fetch+parse) — but **singularly**: one page → one global inventory, with **no landing-zone
  dimension**. Plan 018's derivation design even notes *"landing-zone each own Confluence site/space."*
  Nobody has connected the discovery to a landing-zone root.
- **ADR-0015 §5 reserved a scope seam** — *"the Registry/Explore read carries an optional
  visibility/scope injection point defaulting to a global-visible no-op… `{kind}/{slug}` deliberately
  excludes `app_id`"* — but reserved it for APP (`/app/{id}`), and left it unbuilt (`ResolutionContext`
  carries only `token` + `fetch` + `pageCache`).

## Decision (accepted)

1. **The landing zone is the discovery root; everything below it is discovered, not seeded.** The
   *only* thing fixed in code is the landing-zone list (the deployment topology an organization already
   knows). For each LZ, its bound availability source is fetched and parsed; from that page **services**
   and the availability matrix are discovered; from each service **links/resources** are discovered (the
   plan 017 reference-discovery machine). This is the **landing-zone-rooted form of G3**:
   `confluenceAvailabilityProvider` iterates the LZ list rather than resolving one global page. The TS
   availability fixture is **deleted, not renamed** — it was discovery *output* masquerading as *input*.
   (The "product vs. input" test: LZ is input; availability, services, and links are product.)

2. **LZ granularity = a named cloud×environment deployment target.** A landing zone is a named target
   (`awsf`, `awsc`, `azure` as the sample set); `cloud`, `tier`, `account`, `region` are its
   **attributes**, not its identity. `cloud` carries `region`; a landing zone never spans clouds. The LZ
   list is **application configuration** seated as a first-class **`context-layer/src/landingZones/`**
   module (shared by dev and prod), **not** a dev seed, **not** a `data/*.yaml` file, **not** an
   `@atlas/schema` instance (the schema package holds the `LandingZone` *shape* only). **Two layers, kept
   separate:** the **topology** (`{ id, name, cloud, tier?, dataStatus }`, dev=prod) is the constant;
   each LZ's **availability-source locator** (dev≠prod) is env-bound (the existing `ATLAS_CONFLUENCE_*`
   pattern — dev→MSW mock page, prod→real space), resolved in `composition.ts`.

3. **This is the first *fill* of the ADR-0015 §5 seam, seated at `ResolutionContext.scope`.** The
   reserved injection point becomes `scope?: { landingZoneId?: string; appId?: string }`, **defaulting to
   a no-op** (absent scope ⇒ today's full, global-visible return — so every un-migrated read path is
   unchanged: *progressive safety*). LZ fills the seam first; APP (ADR-0012) keeps its reserved slot in
   the same object. As ADR-0015 §5 already fixed, **LZ does not enter the `{kind}/{slug}` address** —
   exactly like `app_id`, scope *filters*, it does not *address*.

4. **Per-LZ honesty (ADR-0006).** A landing zone whose availability source is not wired (sample: `awsc`,
   `azure`) is marked **data-not-available** and says so — it never falls back to another LZ's data and
   never fabricates. "Registered as a target, no data yet" is an honest dead-end, not an empty cloud.

5. **One logical identity fans out to per-LZ variants.** A service is one `{kind}/{slug}` (ADR-0015
   single address), but resolves — *through `scope.landingZoneId`* — to a per-LZ variant whose
   sections/sources/guidance/status/architecture are **fully independent and may differ outright**
   (`s3@awsf` and `s3@azure` are not "shallow vs deep" — they can be different designs). Guidance reuses
   the existing `applies_to.landing_zones` field (absent ⇒ global).

6. **Naming convergence (the "landing zone" word is overloaded in three places).** `LandingZoneData`
   (id = cloud) is renamed to a per-LZ shape (id = `awsf`, `cloud` an attribute) — which makes the name
   *correct* for the first time; ADR-0009's zone vocabulary is revised accordingly. The dead
   `topic_type: "landing-zone"` enum value (0 instances since LZ left the catalog in plan 019) is
   removed. Guidance `applies_to.landing_zones` values migrate from the old `central-landing-zone`
   vocabulary to the new LZ ids.

7. **Mental model = current-LZ selector (no comparison view).** A global "current LZ" selector (top-nav
   dropdown, default `awsf`) drives the filtered pages, and availability follows it — **one LZ's grid at a
   time**. There is **no** multi-LZ comparison surface / "availability axis" (user decision 2026-06-29):
   availability is already per-LZ via this work, not a separate comparison phase. An optional `/estate`
   overview + the `/lz/{id}/…` outer route wrapper (mirroring ADR-0015 §5's `/app/{id}`) may come later,
   but are not comparison views.

## Considered and rejected

- **A `data/landing-zones.yaml` seed** (the original 2026-06-27 memo's form). Rejected: the availability
  port's seed was never YAML (it is a TS constant behind the port), and the LZ list is configuration
  *input*, not a dev mock — a YAML file would split LZ away from the very port it roots. The decision is
  *config constant + discovery*, no new seed file.
- **Keep the singular G3 (availability stays one global fixture/page).** Rejected: it bakes discovery
  *output* in as *input*, and a singular→LZ-aware change later is rework of the port signature
  (`getZones`/`listServices`) and schema. Plan 017 B3 already committed to "multiple matrices, each
  scoped to one zone."
- **Put LZ in the `{kind}/{slug}` address.** Rejected: scope *filters*, it does not *address* — the same
  rule ADR-0015 §5 set for `app_id`.
- **Hang the LZ list off `AvailabilityProvider`.** Rejected: a landing zone is a site-wide scope;
  availability is merely one consumer. The LZ list is an independent root that availability discovery
  *reads*.
- **Bundle LZ + APP into one scope migration.** Rejected (mirrors ADR-0015's own split of 0015 from
  0012): LZ ships now behind the no-op seam; APP stays reserved in the same `scope` object — coupling the
  two would let the still-*proposed* APP block LZ.

## Consequences

- **multi-LZ's foundation phase == the landing-zone-rooted G3** (`plans/021`): LZ config root +
  `confluenceAvailabilityProvider` (LZ-aware) + the `ResolutionContext.scope` no-op + the current-LZ
  dropdown + per-LZ honesty for the unwired LZs.
- **Split with the in-flight plan 018 work.** 018 is being executed by another worker: it owns **G5**
  (rules-only kernel + resource derivation) and **G6** (guidance/content loaders) and the `data/*.yaml`
  deletions. `plans/021` owns **G3** — `adapters/dev/availability.ts`'s deletion, the
  `AvailabilityProvider` LZ-aware signature, the availability MSW page fixture, and the `composition.ts`
  availability wiring. G3 and G5 are independent gates by 018's own design; the two touch `composition.ts`
  on different lines. **This split is an assumption pending confirmation** that 018 is not concurrently
  rewriting availability — if 018 is doing the singular G3, `plans/021` supersedes it (LZ-aware is the
  target).
- **The `AvailabilityProvider` LZ-aware signature ripples to portal** type imports of `LandingZoneData`
  (`catalog.index`, `service.$provider.$id`, `adopted`) — a rename migration, listed in `plans/021`.
- **Later phases each get their own plan**: newsletter multi-LZ, catalog per-LZ variants + honesty (hero
  slice first), the availability LZ axis, Ask, and the `/estate` overview + `/lz/{id}` outer route.
- **ADR-0009 amendment** (zone → cloud/LZ) lands with `plans/021`; **ADR-0012 §5** stays reserved (the
  `appId` slot is unfilled); if reverted, the no-op seam means un-migrated reads are unaffected.
