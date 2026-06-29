# 018 — MSW dev driver + source decontamination (discovery-output, rules-only kernel)

> Status: design — decisions locked across the 2026-06-28 grilling session(s),
> **reconciled with the now-landed plans 019/020 in a 2026-06-29 grilling pass**
> (see "Reconciliation with plans 019/020" below — it amends the `metadata` and
> `guidance` rows, drops the `governance` field, and de-specializes the tests).
> **Sequencing: runs AFTER [019](019-contextbundle-retirement-and-authority-defer.md).**
> 019 leaves a portal that reads only resource-projection with authority deferred, so
> 018 touches the **source side only**.
> Builds on plan 017 (HEAD `e693e05`). Supersedes the seed framing in
> [`016-domain-decontamination.md`](016-domain-decontamination.md).
> Principle: memory `atlas-registry-is-discovery-output` — registry is the OUTPUT of
> discovery, not a hand-authored seed.

## Progress (2026-06-29 — partial; remaining CORE sequenced AFTER plan 021)

**Landed + committed** as `55aca41` ("feat(atlas): add MSW dev driver + single-live content path, retire anchors") — `pnpm -r typecheck·lint·test` all green; prod lambda bundle has 0 `msw`/`devMocks`:
- **G0 GATE** ✅ — Node-mode MSW seam: `context-layer/src/devMocks/{fixtures,handlers,server,setup,index}.ts` + `vitest.config.ts` setupFiles + `pnpm-workspace.yaml allowBuilds: msw: false`. Late-bound fetch proven intercepted. Subpath export `@atlas/context-layer/devMocks` for portal/Nitro reuse.
- **G1 (reference slice)** ✅ — late-bound fetch (`offlineResolutionContext`→`defaultResolutionContext`); live CQL reference discovery via MSW (`createReferenceDiscoveryFromEnv`, env-gated, honest-absence + honesty states); **deleted `adapters/dev/referenceDiscovery.ts`**.
- **G2 (terraform + confluence + policy)** ✅ — all three content resolvers single-live (always fetch; `!token`→honest gap); no offline fallback.
- **G4 (anchor "3 去")** ✅ — `ResolveRequest`/`ResourceSectionBindingSchema` carry inline `heading`/`selector`/`citation_label`; runtime heading-slug location; **deleted** `resolveAnchor`/`AnchorRepository`/`AnchorSchema`/`data/anchors.yaml`/integrity/feedback `anchor` target. Policy resolves live via Confluence (page ids `300001`/`300002`).
- **G6 (newsletter)** ✅ — releases + standalone announcements from one MSW-served "What's New" Confluence page; new `parseAnnouncements.ts`; **deleted `loadReleaseNotes`/`loadAnnouncements`**.
- **G5a (additive kernel + engine)** ✅ — rules-only `context-layer/src/kernel/` (doc-type patterns, vendor prefixes, `SECTION_RULES`) + `context-layer/src/discovery/` (`discoverServiceSources`/`deriveServiceResources`) + golden test. Built BEHIND the live path; nothing wired yet.

**REMAINING CORE (G5 flip + G6-guidance + `rm -rf data/`) — DEFERRED, to land WITH/AFTER [plan 021](021-multi-landing-zone-foundation.md), NOT on the current basis.** Decision (2026-06-29, after a coordination grilling + user concurrence):
- **Why sequence after 021, not now:** [ADR-0017](../docs/adr/0017-landing-zone-discovery-root.md) §Decision-5 makes **resource derivation inherently per-landing-zone** — one `{kind}/{slug}` fans out to per-LZ variants whose sections/sources/status may differ outright, resolved through the new `ResolutionContext.scope`. A *global* derivation built now is the wrong abstraction that 021's scope seam would force a rewrite of. 018-G5 also structurally **consumes 021's outputs**: `listServices()` (spine), domain-grouping (→ `resource.category`), and the live `availability-matrix` resolution. Building 018-G5 first would only produce a degraded, topic-bridged, global shape destined for rework + concurrent-tree conflicts (021 also reshapes `composition.ts` + the portal catalog).
- **Dependency direction is one-way:** 021 (availability + LZ scope) is the foundation and needs only the *already-committed* G0–G4. 018-G5 is downstream. So: **021 first → then 018-G5/G6 on the stable per-LZ base.** The committed kernel + `discovery/` engine is plug-in-ready; once 021 lands the scope seam, `deriveResources` is made scope-aware and wired, then `loadResources`/`loadRegistryFromManifests`/`inMemoryRegistry`/`dataDir` + `data/{sources,topics,source-topic-mappings,resources,feedback}.yaml` + `data/guidance/` (via the `GuidanceSource` port) are deleted in one coherent pass to clear the `rm -rf data/` gate.
- **Handoff to 021's worker:** the `availability-matrix` source id + the `availabilityMatrixResolver` `selector:{service}` contract are the seam 018-G5's derived `availability` section binds to — keep them stable. Guidance `applies_to`: 021 owns the `landing_zones` re-key, 018-G6 owns `services`/`security_policies` → discovered `{kind}/{slug}`.

## Context

Atlas's registry (sources / resources / anchors / mappings) was hand-authored as
`data/*.yaml` seed and wired through a parallel **dev-adapter / offline** path that every
resolver carries as an `env-gated else` branch. The locked realization: **registry is the
OUTPUT of discovery, not a hand-authored seed and not an input to fetch.** The seed + the
dev adapters are artifacts of "discovery not yet implemented."

This plan removes that parallel path entirely. After it:

- **Application code has a single live path** — every resolver always fetches+parses; there
  is no dev/offline branch, no `adapters/dev/`, no in-memory provider. The fetch backend is
  chosen purely by what `ctx.fetch` is bound to: **unit = injected fake (FetchLike DI),
  dev + integration = MSW, prod = real network.**
- **dev/integration mock the SOURCE SYSTEMS** (Confluence / Terraform / GitHub) at the
  network layer via MSW. **prod's import graph never references the mock** (hard constraint:
  zero mock code in the prod bundle, zero runtime switch).
- The only durable governed data is a **rules-only kernel** — classification + policy that
  discovery can never produce. **No source/resource instances live in code.**

## Architecture principle

- **descriptive** (which docs exist / where / page structure / which service / metadata) →
  **fully discovered** (crawl source systems + parse).
- **normative** (classification rules, conflict/severity policy) → **rules-only kernel**
  (versioned/reviewed TS constants, never `data/`). Even the guardrail/zone **taxonomy is
  discovered** (each kind has its own source-system space), so the kernel holds no instances.
- **the only fetch target is the source system** (Confluence / Terraform / GitHub — prod
  real, dev MSW). Mock the source system, never a "registry API" → no dangling prod endpoint.
- **authority is deferred** (plan 019). Under "discovery scope = authoritative sources,"
  authority is not a required attribute here; it returns later for contributed content
  (guidance multi-contributor).

## Locked decisions

| # | Decision |
|---|---|
| Driver | **MSW `setupServer`** (Node mode — `@mswjs/interceptors` patches `globalThis.fetch` in-process; **not** a browser Service Worker). The fetch target is server-side source systems, so Node mode is the only correct mode. |
| Seam | **Build-time conditional registration of a Nitro server plugin** — `nitro({ plugins: command==='serve' ? ['./server/devMocks/start'] : [] })` in `vite.config.ts`, file **outside** the auto-scanned `server/plugins/` dir. `setupServer().listen()` runs at the plugin module's **import top** (before any `globalThis.fetch` capture). prod build (`command==='build'`) never registers it → **zero `msw` in the bundle, zero runtime switch**. Verified feasible on the installed `nitro@3.0-beta` (`NitroConfig.plugins: string[]`). Pattern borrowed (not the code) from `shunnNet/nuxt-msw`. |
| Single live path | **Delete the entire offline path.** Resolvers drop the `env-gated else` branch → unconditional `resolve*Live`. Delete `resolveAnchor`, the in-memory registry/content provider, and **all of `adapters/dev/`**. Missing creds + no MSW = **honest gap**, never a fake fallback. |
| Unit tests | **Keep injected `FetchLike` DI** (test code injects a precise fake; prod-irrelevant). MSW is dev-runtime + integration only. |
| Late-bound fetch | `ctx.fetch` is late-bound `(i,init)=>globalThis.fetch(i,init)`; MSW starts before any capture. (Risk #1 — corroborated by nuxt-msw's "listen before ofetch captures fetch.") |
| Kernel ("2 留") | **Rules/config ONLY**: `serviceIdentityNormalizer` rules, `DOC_TYPE_PATTERNS`, `VENDOR_PREFIXES`, discovery entry scope (per-kind: `service` / `guardrail`-`security-policy` / `landing-zone` each map to their **own Confluence site/space**), conflict/severity policy, and new **`SECTION_RULES`** (per-kind section vocabulary + classification). **Zero Source/Resource instances.** |
| descriptive/normative | descriptive → discovery; normative → kernel rules. The old ≈4 governed sources are **not** kernel — their descriptive facts are discovered (dev: MSW fixture). |
| Resources | **Derived from discovery**, not authored. `resource = groupByKindIdentity(discoveredSources)`; `section → source` by `doc_type`; in-source position by heading-pattern default + raw-TOC; missing → honest-gap. Delete `resources.yaml` + `loadResources`. |
| anchor "3 去" | **Drop pre-stored anchors.** Binding carries an inline `heading` (a **default entry**, not a fixed address); the section is located at **runtime** (heading-slug scan). The full **heading list (TOC) is a free byproduct of the same parse** — no new endpoint/contract. The agent may request **any** heading, beyond the canonical vocabulary. Delete `AnchorRepository` / `anchors.yaml` / `AnchorSchema`. |
| guidance | Read through a **`GuidanceSource` port**; Phase-1 backing = a **separate, runtime-fetched structured-YAML store** → `Guidance[]` (resolution, not seed, not discovery). `data/guidance/` becomes **dev fixture only** (MSW serves the raw response). **Condition corrected (2026-06-29):** the real requirement is **independent of the Atlas build**, NOT legal non-ownership — an Atlas-org repo that is separate from the app build is still runtime-mutable (edit → re-fetch, no rebuild); only *bundling* is seed-in-disguise. Keep the form **structured** (guidance is a structured flow — steps/tasks/destination; Confluence prose can't encode it). Contributor-friendliness is a **Phase-2 write-path** concern (Portal contribution UI emitting structured guidance + reactivating 019's dormant authority for contributed content), seamed by the port — **not in 018**. |
| newsletter + announcements | **Both from Confluence** — the "What's New" page carries `releases:` and standalone `announcements:`. `resolveReleaseNotes` extracts **both** (extend it if it only parses releases). `data/newsletter.yaml` → dev fixture (MSW serves the page). Delete `loadReleaseNotes` / `loadAnnouncements`. No kernel content. |
| metadata | **Presentation metadata is best-effort discovered, gap otherwise (2026-06-29).** Discovered: `category` ← the availability page's **domain grouping** (decision below); `description` ← the overview section's lead; `entry_tools` ← the discovered Terraform module source + user-guide reference; freshness (`stale_source`) ← Confluence v2 `version`/`createdAt`, Terraform `published`. **Honest-gap / default** (no clean discovery source, do NOT add bespoke sources or kernel entries to fill catalog chrome): `owner_team`, `support_channel` (absent until a real ownership source exists — the catalog already degrades to "—"); `status` → default `active` (availability yields regional status, not lifecycle/deprecation). **Correction:** the old "owner ← `authorId`" was a misframe — page author ≠ owning team. Richer `approve`/`review` metadata still deferred. |

## Reconciliation with plans 019/020 (2026-06-29 grilling)

018 was locked before 019 finished and before 020 existed. This pass reconciles
them — the decisions above already fold in the amendments; the downstream
schema/test changes 018 must make:

- **Presentation metadata = discovery-derived, gap otherwise.** 020 migrated
  `owner_team`/`support_channel`/`category`/`status`/`description`/`entry_tools`
  onto `resources.yaml` records. 018 deletes that overlay → these come from
  discovery (`category`/`description`/`entry_tools`) or honest-gap
  (`owner_team`/`support_channel`/`status`). The 020 catalog page already
  degrades gracefully ("—" / conditional trust line) — do not regress that.
- **Drop the `governance` field.** 020's `ResourceContextResponse` /
  `ResourceRecordResponse` carry `governance: configured|unconfigured`, meaning
  "a `resources.yaml` overlay exists." With overlays gone the field is
  meaningless → **remove it from the schema**; consumers (`ReferenceDocs`,
  `EvidenceHealth`, the "No governed sources" notice) key off **`sections.length`**
  instead (empty governed sections = the same signal). Also drop
  `ResourceGovernanceSchema` usage in the projection.
- **`getResourceRecord` (020) is now discovery-backed**, not overlay-backed:
  G5's derivation produces its presentation-metadata bundle. The
  `/resources/{kind}/{slug}/record` route + clients stay; only the data source
  changes.
- **Single cross-reference key = the discovered `{kind}/{slug}`; the curated
  topic-id namespace is removed** (forced by "registry = discovery output" — not
  a choice). Today guidance + 020's `topics:` facet + the catalog cross-reference
  *curated* ids (`aws-textract`, `serverless-compute`, dead `central-landing-zone`);
  discovery yields concrete `{provider}/{id}` (`aws/lambda`) instead. So: (a)
  re-key `data/guidance/*.yaml applies_to.{services,landing_zones,security_policies}`
  to the discovered slug and **drop dead refs** (`central-landing-zone` — LZ left
  in 019; already dangling); (b) **drop 020's `record.topics` facet field** —
  `relatedGuidanceForTopic` and the feedback target key on the slug, not a curated
  topic id; (c) the umbrella `serverless-compute` **collapses to its member**
  `service/aws/lambda`; (d) the 020 bridges (`serviceRouteParamsForTopic` /
  `TOPIC_SERVICE_ALIASES`) lose their job and go away. **Must be settled in G5**
  (which deletes the curated ids) and G6 (whose guidance fixture uses the new key).
- **De-specialize the tests (all services 平权 — no special service).** There is
  no "textract HARD GATE" as a privileged anchor. The safety net replacing the
  deleted count-oracles is a **generic fixture-driven discovery test**: boot MSW
  with the source-space fixture, run discovery, assert the derived
  resources/sections/citations for **every** fixture service uniformly (a golden
  set, content-level — stronger than counts), plus the honest-gap/reference-only
  branches. Rewrite 019's `v1Acceptance` (drop the textract-as-hero framing) and
  the 020-added assertions (`getResourceRecord → owner_team="cloud-platform"`,
  the `governance` asserts) to the discovery-derived, de-specialized shape.

## Mechanism: MSW wiring (application code stays mock-free)

| Layer | How | Intercepts |
|---|---|---|
| Application code | only ever `(i,init) => globalThis.fetch(i,init)`; never imports `devMocks/`. | — |
| Unit tests | injected `FetchLike` fake (test code) | — |
| Integration (vitest) | `context-layer/vitest.config.ts` `setupFiles` → `beforeAll(server.listen)` / `afterEach(resetHandlers)` / `afterAll(close)`. `setupServer` patches fetch in-process. | context-layer outbound Confluence / Terraform / GitHub fetch |
| portal dev runtime | `server/devMocks/start.ts` (Nitro plugin, **conditionally registered** for `command==='serve'`); `setupServer().listen()` at import top. | same outbound source-system fetch (in the Nitro process where context-layer runs) |
| **prod** | `command==='build'` → plugin not registered → `msw` (devDependency) never in the graph → **zero config, zero mock** | — |

Shared: `context-layer/src/devMocks/{handlers,fixtures,server}.ts`; latency via `delay(ATLAS_DEV_MOCK_LATENCY_MS)`.

## Goals & execution (goal-driven · opus subagents on disjoint lanes · main agent verifies)

Each goal is a **verifiable end-state**: it closes only when its **done-when**
check passes, which the **main agent runs and accepts (验收)** — subagents
propose a diff + self-check, the main agent re-runs the check and gates. Global
bar: every goal ends green at `pnpm -r typecheck · lint · test`.

**Roles**
- **Main agent (orchestrator + 验收):** owns the sequential **spine** —
  `composition.ts`, the `@atlas/schema` contract changes, and the
  resource-derivation engine (single-author coherence) — and **runs/accepts every
  goal's done-when before the next goal starts**. Acceptance is never delegated.
- **Subagents (model: `opus`; `isolation: worktree` when mutating concurrently):**
  the disjoint-file lanes below.

**Parallel fan-out lanes (disjoint file-sets):**
- **Lane R — grounding (read-only):** before each goal, map current shape + every
  consumer of a to-be-deleted symbol. High fan-out, zero risk.
- **Lane H — MSW handlers + fixtures:** one subagent per source system
  (Confluence-content · Confluence-availability · Confluence-WhatsNew ·
  Terraform-README · GitHub-guidance · CQL-references). Disjoint `devMocks/` files.
- **Lane K — kernel rules:** one subagent per rule module (`DOC_TYPE_PATTERNS` ·
  `VENDOR_PREFIXES` · `SECTION_RULES` · discovery-entry-scope · conflict/severity).
- **Lane T — test migration:** one subagent per test area (delete count-oracles ·
  availability test · resolver tests · v1Acceptance + 020 getResourceRecord tests).

### G0 — Mock seam proven · GATE (sequential; nothing else starts; no fan-out)
- **Goal:** the load-bearing mechanism works — `setupServer` (Node) intercepts a
  late-bound source-system fetch; conditionally registered; **zero `msw` in prod**.
- **Done-when (main agent):** `devMocks/handlers.test.ts` boots `setupServer` and
  each mocked URL returns its fixture; a test proves a **late**
  `(i,init)=>globalThis.fetch` call is intercepted; a `command==='build'` bundle →
  `rg msw` = 0.
- **Subagents:** none — go/no-go, main agent does it. (`pnpm add -Dw msw`;
  `devMocks/{handlers,fixtures,server}.ts`; integration-only vitest `setupFiles`;
  app code untouched.) **If red, STOP — the whole approach is rethought.**

### G1 — Single live path (main-agent spine, after G0)
- **Goal:** ONE path — resolvers always fetch+parse; no env-gated `else`, no
  `adapters/dev/`, no in-memory registry/content provider.
- **Done-when:** `rg "adapters/dev"` app code (non-test) = 0; missing creds + no
  MSW = honest gap (test, not fake fallback); reference discovery serves migrated
  `FIXTURE_REFERENCES` via the CQL handler.
- **Main agent owns** `composition.ts` (unconditional live + late-bound fetch).
  **Subagents:** Lane H (CQL handler); then per-resolver `else`-branch deletions
  fan out (disjoint resolver files). Delete `resolveAnchor`, in-memory
  registry/content provider, `adapters/dev/referenceDiscovery.ts`.

### G2 — Source content discovered (fan-out, after G1)
- **Goal:** `confluencePageResolver` / `policyDocumentResolver` /
  `terraformModuleResolver` unconditional-live against MSW.
- **Done-when:** each resolves its fixture to section content + citation;
  `adapters/dev/sourceContent.ts` deleted.
- **Subagents:** Lane H (Confluence v2 page · Terraform README) + 3 disjoint
  resolver subagents + Lane T (resolver tests). Main agent accepts each.

### G3 — Availability discovered + domain grouping (parallel to G2, after G1)
- **Goal:** `confluenceAvailabilityProvider` implements the unchanged
  `AvailabilityProvider` by fetch+parse; the parse **preserves domain grouping**
  (feeds the grid **and** `resource.category`).
- **Done-when:** `listServices()` matches the MSW availability fixture rows
  (generic over N); `domain` present per service; `adapters/dev/availability.ts`
  deleted.
- **Subagents:** Lane H (availability page handler, domain-grouped) + Lane T
  (availability test). Independent of G2.

### G4 — Anchor "3 去" (schema = main-agent, after G1)
- **Goal:** bindings carry inline `{ heading?, selector?, citation_label? }`; the
  section is located at **runtime** (heading-slug scan); the TOC is a free byproduct.
- **Done-when:** `ResourceSectionBindingSchema` has no `anchor_id`; `resolveSection`
  builds from `binding.heading`/`selector`; `extractSectionFromRoot` /
  `extractSectionText` / `parseMatrix` unchanged; TOC exposed; `anchorRepository` /
  `Registry.anchors` / anchor-integrity / `data/anchors.yaml` / `AnchorSchema` /
  feedback `anchor` target deleted.
- **Main agent owns** the schema + `ResolveRequest` change (shared contract;
  coordinate with G2's `resolveSection` edits). **Subagents:** Lane T (anchor tests).

### G5 — Rules-only kernel + resource derivation (main-agent core, after G2/G3/G4)
- **Goal:** registry + resources assembled **from discovery + kernel rules** — zero
  instances; the presentation-metadata bundle + cross-ref re-key land here.
- **Done-when:** `kernel/` holds only rules; `resource =
  groupByKindIdentity(discoveredSources)` + `SECTION_RULES`; `getResourceRecord`
  metadata bundle derived (category/description/entry_tools; owner/support gap;
  default-active status); `governance` **and** `topics` fields dropped; cross-refs
  keyed on `{kind}/{slug}` (guidance `applies_to` + feedback + related);
  `serverless-compute`→`service/aws/lambda`; the generic golden-discovery test
  green; `loadRegistryFromManifests` / `loadResources` + the 5 registry/resource
  yaml deleted.
- **Subagents:** Lane K (5 disjoint kernel-rule subagents) land first; **main agent
  builds the derivation engine** on top (single-author). Lane T rewrites
  v1Acceptance + 020 tests (de-specialized).

### G6 — Content loaders (INDEPENDENT track — parallel to G1–G5, after G0)
- **Goal:** guidance via the `GuidanceSource` port (runtime structured store);
  newsletter + announcements via MSW-mocked Confluence.
- **Done-when:** the port reads the GitHub-raw fixture (`applies_to` keyed on
  `{kind}/{slug}`, dead `central-landing-zone` dropped); `resolveReleaseNotes`
  extracts releases **and** announcements; `loadGuidance` / `loadReleaseNotes` /
  `loadAnnouncements` / `newsletter.yaml`-as-source / `dataDir.ts` /
  `resolveDataDir` deleted.
- **Subagents:** Lane H (GitHub-guidance · Confluence-WhatsNew) + the port
  subagent. Disjoint from the resource track → runs concurrently from G0.

### G-verify — Decontamination proven (main agent, last)
- **Done-when (global gates — see ## Verification):** prod-clean `rg`; `rm -rf
  data/` → tests pass; dev-runtime MSW render; real-creds resolve. The four checks
  fan out (Lane R-style); the **main agent accepts**.

**Dependency spine:** G0 → G1 → {G2 ∥ G3 ∥ G4-schema} → G5 → G-verify, with **G6
as an independent parallel track from G0**. The main agent gates each arrow.

## anchor "3 去" design

Runtime section location **already exists**: `extractSectionFromRoot(root, locator)`
(`confluenceCloudContentProvider.ts:269`) slugifies every `<h1..6>` and matches;
`extractSectionText` does the same for Terraform README. Only the pre-stored `Anchor`
wrapper is removed. The agent flow becomes two uses of one parse: **(1) return the heading
list (TOC); (2) return a section by heading.** Bindings demote to default entry points; the
agent is not limited to the canonical vocabulary. `ResourceCitation.anchor` stays as the
**runtime-located slug**.

## Resource-derivation design (per-kind)

`resource = groupByKindIdentity(discoveredSources)` then project sections via `SECTION_RULES`:

- **service** — group by `serviceIdentityNormalizer` (discovered). `network`/`examples`
  both bind to the module-readme source but at different headings (heading-pattern default
  + raw-TOC); `availability` binds to the availability-matrix source.
- **guardrail / landing-zone** — each has its **own Confluence site/space/page**; group by
  crawling that space, same as a service. The unit taxonomy is **discovered**, not curated.
  Docs under each are discovered + classified.
- A discovered source that is **reference-only** (body needs user creds) cannot fill a
  section → reference block only; a **content-readable** one fills the section. Honest-gap
  when classification finds no heading.

## Test-infra migration

- **Delete** (target gone): registry-manifest count-oracles (16/12/24/20 + dangling-ref),
  `loadRegistryFromManifests.test.ts`, `anchorRepository.test.ts`, the `inMemoryRegistry`
  anchor-integrity asserts, `referenceDiscovery.test.ts`.
- **Rewrite** (behavior survives, source → MSW/kernel): `availability.test.ts` asserts
  `listServices()` matches the MSW page fixture's rows (generic over N); resource/section
  tests resolve through `setupServer` + the derivation rules.
- **Keep** (injected-FetchLike boundary): `confluenceReferenceDiscovery.test.ts`,
  `confluenceCloudContentProvider.test.ts`, resolver tests, `serviceIdentityNormalizer.test.ts`,
  schema tests.
- New integration suites drive the live adapters through `setupServer`. Replace count-oracles
  with **equal-or-stronger** integration asserts (017 DoD forbids gutting suites); the CQL
  handler must reproduce truncation/`incomplete` + 401/403/404 so honesty states stay exercised.
- **De-specialized (all services 平权).** The golden discovery test asserts the derived
  resources/sections/citations for **every** fixture service uniformly — no privileged
  "textract gate". Rewrite 019's `v1Acceptance` off the textract-as-hero framing, and the
  020-added `getResourceRecord`/`governance` assertions to the discovery-derived shape
  (owner/support absent, no `governance` field).

## Verification

1. `pnpm -r typecheck && pnpm -r lint && pnpm -r test` green after each goal.
2. **Prod-clean proof:** `rg -n "devMocks|msw" --glob '!**/devMocks/**' --glob '!**/*.test.*' context-layer/src portal/src portal/server` → 0 in app code; a prod build's bundle contains no `msw`/handlers.
3. `rm -rf data/` → `pnpm -r test` → no ENOENT (no file dependency remains).
4. Dev runtime: `ATLAS_DEV_MOCKS=1 pnpm --filter portal dev` → catalog renders reference block + derived sections, latency visible, all sourced from MSW.
5. Real Confluence/Terraform/GitHub env (no MSW) → same surfaces resolve against real source systems.

## Risks

- **late-bound fetch** is mandatory or MSW misses the patch — audit every fetch acquisition; start MSW before capture.
- **Nitro conditional-plugin registration** must keep the plugin out of `command==='build'`; verify the prod bundle has no `msw`.
- **Resource derivation** relies on per-kind classification (space→kind, doc→unit/section); author and verify these rules per kind; honest-gap when classification finds no match.
- **guidance ownership** — if guidance is not truly external, fetching it is seed-in-disguise; bundle instead.
- **Public-safe**: all fixtures + kernel stay fictional (no real space keys / page ids / creds).
