# 018 — MSW dev driver + source decontamination (discovery-output, rules-only kernel)

> Status: design — decisions locked across the 2026-06-28 grilling session(s).
> **Sequencing: runs AFTER [019](019-contextbundle-retirement-and-authority-defer.md).**
> 019 leaves a portal that reads only resource-projection with authority deferred, so
> 018 touches the **source side only**.
> Builds on plan 017 (HEAD `e693e05`). Supersedes the seed framing in
> [`016-domain-decontamination.md`](016-domain-decontamination.md).
> Principle: memory `atlas-registry-is-discovery-output` — registry is the OUTPUT of
> discovery, not a hand-authored seed.

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
| guidance | Fetch from an **external, non-Atlas-owned GitHub repo** as yaml → `Guidance[]` (resolution, not seed, not discovery). **Condition:** guidance must genuinely live in a separate repo Atlas does not own; `data/guidance/` becomes **dev fixture only** (MSW serves the GitHub raw response). If Atlas actually owns it → bundle it, do not fetch. |
| newsletter + announcements | **Both from Confluence** — the "What's New" page carries `releases:` and standalone `announcements:`. `resolveReleaseNotes` extracts **both** (extend it if it only parses releases). `data/newsletter.yaml` → dev fixture (MSW serves the page). Delete `loadReleaseNotes` / `loadAnnouncements`. No kernel content. |
| metadata | **Extract only what the existing fetch trivially yields** (Confluence v2 `version`/`createdAt`/`authorId`, Terraform `published`) → freshness (`stale_source`) + owner. Richer `approve`/`review` metadata deferred. |

## Mechanism: MSW wiring (application code stays mock-free)

| Layer | How | Intercepts |
|---|---|---|
| Application code | only ever `(i,init) => globalThis.fetch(i,init)`; never imports `devMocks/`. | — |
| Unit tests | injected `FetchLike` fake (test code) | — |
| Integration (vitest) | `context-layer/vitest.config.ts` `setupFiles` → `beforeAll(server.listen)` / `afterEach(resetHandlers)` / `afterAll(close)`. `setupServer` patches fetch in-process. | context-layer outbound Confluence / Terraform / GitHub fetch |
| portal dev runtime | `server/devMocks/start.ts` (Nitro plugin, **conditionally registered** for `command==='serve'`); `setupServer().listen()` at import top. | same outbound source-system fetch (in the Nitro process where context-layer runs) |
| **prod** | `command==='build'` → plugin not registered → `msw` (devDependency) never in the graph → **zero config, zero mock** | — |

Shared: `context-layer/src/devMocks/{handlers,fixtures,server}.ts`; latency via `delay(ATLAS_DEV_MOCK_LATENCY_MS)`.

## Implementation batches (each ends green: `pnpm -r typecheck · lint · test`)

- **B0 — MSW harness (additive).** `pnpm add -Dw msw`. `devMocks/{handlers,fixtures,server}.ts` (source-system endpoints; fixtures migrated from the dev adapters). Integration-only vitest `setupFiles`. `devMocks/handlers.test.ts` boots `setupServer` and fetches each mocked URL. Nothing in app code wired.
- **B1 — Single live path + reference discovery via MSW.** composition wires live adapters unconditionally with late-bound fetch; CQL handler serves migrated `FIXTURE_REFERENCES` as real `results[]`. **Delete the resolver `else` branches, `resolveAnchor`, in-memory registry/content provider, and `adapters/dev/referenceDiscovery.ts`.**
- **B2 — Source-content resolution via MSW.** `confluencePageResolver` / `policyDocumentResolver` / `terraformModuleResolver` become unconditional-live; add Confluence v2 page + Terraform README handlers. Delete `adapters/dev/sourceContent.ts`.
- **B3 — Availability spine via MSW.** `sourceContent/confluenceAvailabilityProvider.ts` implements the unchanged `AvailabilityProvider` by fetch+parse (generalize `parseMarkdownMatrix`); availability is a discovered source classified to the `availability` section. Delete `adapters/dev/availability.ts`.
- **B4 — anchor "3 去".** `ResourceSectionBindingSchema` drops `anchor_id`, adds inline `{ heading?, selector?, citation_label? }`. `resolveSection` builds the request from `binding.heading`/`selector`. `ResolveRequest` → `{ source, locator?, selector?, citationLabel?, contentProvider, ctx }`. Keep `extractSectionFromRoot` / `extractSectionText` / `parseMatrix` verbatim (they ARE the runtime location). Expose the **heading list (TOC)** off the same parse. Delete `repositories/anchorRepository.ts`, `Registry.anchors`, the anchor integrity loop, `data/anchors.yaml`, `AnchorSchema`, the feedback `anchor` target. (`anchor_references` retirement is in 019.)
- **B5 — Rules-only kernel + resource derivation.** `context-layer/src/kernel/` — TS constants: `serviceIdentityNormalizer`, `DOC_TYPE_PATTERNS`, `VENDOR_PREFIXES`, discovery entry scope, conflict/severity policy, **`SECTION_RULES`** (per-kind `{ grouping-identity, section→docType, heading-pattern }`). composition assembles registry/resources **from discovery + these rules** — no instances. **Per-kind note:** every kind groups by a **discovered** identity — `service` via `serviceIdentityNormalizer`; `guardrail`/`security-policy` and `landing-zone` each have **their own Confluence site/space/page**, so their unit taxonomy is discovered the same way. The kernel holds only the **space→kind + classification** rules (zero instance taxonomy); `data/topics.yaml` is fully discovery-output. Delete `loadRegistryFromManifests` / `loadResources` / the 5 registry+resource yaml files.
- **B6 — Content loaders.** guidance → external-GitHub-yaml fetch+parse (MSW-mocked) replacing `loadGuidance`; newsletter **+ announcements** → MSW-mocked Confluence via `resolveReleaseNotes` (extended to extract both), delete `loadReleaseNotes`/`loadAnnouncements`/`newsletter.yaml`-as-source; metadata-A extraction. Delete `dataDir.ts` + `resolveDataDir`.

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

## Verification

1. `pnpm -r typecheck && pnpm -r lint && pnpm -r test` green after each batch.
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
