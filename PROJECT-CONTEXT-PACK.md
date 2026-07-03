# Project Context Pack

> **Purpose.** A high-density, fully-traceable snapshot of the `atlas` project as it exists on
> branch `feat/0.2.0` (2026-07-02), built to eliminate information asymmetry before a high-level
> design discussion. It records *what is*, not *what should be*. Every assertion carries an inline
> citation tagged `[from-code | from-doc | from-memory | inferred]`. Source conflicts are flagged,
> not resolved. Interim/scaffold implementations are tagged distinctly from intended design.

---

## 1. Product Context

- **What Atlas is.** A *governed context layer* for a cloud platform: it registers, validates, and
  serves authoritative source *excerpts with citations*. The source systems (Confluence spaces,
  Terraform module registries, policy documents) remain the system of record; Atlas discovers and
  projects from them at request time and **never mirrors them durably** (`README.md:3-8`, `CONTEXT.md:3-6`)
  [from-doc].
- **The product surface.** The Portal is the self-service catalog app engineers open mid-task; it is
  the *primary but non-privileged consumer* of the Context Layer core engine, and does not own the
  data model (`PRODUCT.md:20-26`; `docs/adr/0002-atlas-is-a-portal-context-layer-is-its-core.md`) [from-doc].
- **Users.** Every engineer at the company (platform engineers → backend/full-stack devs), plus
  occasional technical PMs/EMs; they arrive in-flow with a specific question and a deadline, not to
  browse (`PRODUCT.md:9-17`) [from-doc].
- **The one job = "wayfinding"**: tell a consumer, fast and authoritatively, *what exists, who owns
  it, where the authoritative source is, and how fresh it is* (`CONTEXT.md:87-91`;
  `docs/product/mvp-product-design.md:32-35`) [from-doc]. Success = a confident, source-linked answer
  in under two minutes (`PRODUCT.md:28-29`) [from-doc].
- **The moat = "governed honesty"** (4 mechanisms, no active re-validation): fresh/version-drift,
  review-decay of curated fields, authority-conflict (surface both, *pick no side*), and honest
  dead-end + first-class Feedback (`docs/adr/0006-governed-honesty-model.md`;
  `docs/product/mvp-product-design.md:37-51`) [from-doc].
- **What Atlas explicitly refuses to be**: general search, a shadow content store/CMS, a recommender,
  an identity/access system, a provisioning executor, or a monitoring platform
  (`docs/product/mvp-product-design.md:52-64`) [from-doc].

---

## 2. Current System Shape

pnpm workspace monorepo. Packages: `@atlas/portal` (TanStack Start + React 19, Vite 8 / Nitro,
Tailwind v4; dev on :3000), `@atlas/context-layer` (framework-agnostic domain logic),
`@atlas/schema` (shared zod schemas/types), `@atlas/e2e` (Playwright, zero-download),
`@atlas/acceptance` (black-box agent-discovery checks), `azure-react-icons`, `@atlas/infra`
(Terraform) (`README.md:14-25`) [from-doc].

**Context API boundary (portal ↔ context-layer) — the load-bearing seam** [intended design]:
- Two live transports, chosen by env at request time: `CONTEXT_API_BASE_URL` set → an HTTP fetch
  client (`kind:"http"`, threads `Authorization: Bearer`); unset → in-process client calling
  context-layer handlers directly (`portal/src/api/server/httpContextApiClient.ts:24-44`) [from-code].
- Portal route loaders reach the API through `createServerFn` RPCs that forward the caller's Bearer
  (`portal/src/api/server/contextApi.ts:1-33`); browser code never touches the in-process layer
  (`contextApi.ts:6`) [from-code].
- External agents/skills hit the Portal origin `/api/*`, bridged straight into `handleHttpRequest` —
  the same router the Lambda handler uses (`portal/src/api/server/contextApiBridge.ts:4-13`;
  `portal/server/routes/api/[...].ts:8`) [from-code].
- ⚠️ **Interim gap**: the in-process client calls handlers with **no `ResolutionContext`**, so that
  path has *no Bearer and no shared cache* — only the HTTP path threads them end-to-end
  (`portal/src/api/server/inProcessContextApi.ts:73`; `resolverTypes.ts:85`) [from-code].

**context-layer subsystems** (main file → responsibility) [from-code, intended]:
`discovery/` (probe Terraform+Confluence → derive registry/resources: `discoverSources.ts`,
`deriveResources.ts`, `deriveGuardrails.ts`) · `resolvers/` (live-content ports per source class,
assembled in `resolverRegistry.ts`) · `sourceContent/` (per-system providers + caches:
`confluenceCloudContentProvider.ts`, `valkeyContentCache.ts`) · `resources/` (kind-first projection:
`resourceContextService.ts` = `getResourceContext`/`searchResources`) · `services/`
(`contextService.ts` container, `availabilityProvider.ts`) · `landingZones/` (ADR-0017 topology root)
· `registry/`+`repositories/` (Source/Feedback ports + adapters) · `releaseNotes/` · `kernel/`
(rules-only classification constants, holds *zero* data instances, `kernel/index.ts:1-6`) ·
`observability/logging.ts` (pino) [from-code].

**Intended vs interim/scaffold:**
- **Intended (production path):** `composition.ts` wires *live* discovery unconditionally; the same
  code path serves prod (real systems) and dev/CI (env pointed at MSW). There is **no `data/*.yaml`
  seed** — registry/resources are discovery *output* (`composition.ts:8-13`; confirmed absent)
  [from-code]. Schema core type = `Resource` addressed `{kind}/{slug}`, kinds
  `service | guardrail | landing-zone` (`packages/atlas-schema/src/index.ts:414,497`) [from-code].
- **Interim/scaffold:** `context-layer/src/devMocks/` (MSW handlers + fixtures + sample HTML) is a
  dev/test transport only, hard-gated off when `NODE_ENV==="production"`
  (`portal/server/devMocks/start.ts`; `portal/src/api/server/dataMode.ts:17`) [from-code]. Feedback
  defaults to **in-memory** (`FEEDBACK_TABLE` unset) with DynamoDB as the wired-but-optional adapter
  (`repositories/feedbackRepositoryFactory.ts:10`) [from-code]. Landing zones ship as a hardcoded
  constant with only `awsf` live; `awsc`/`azure` are `dataStatus:"not-available"`
  (`landingZones/landingZones.ts:16-22`) [from-code].

---

## 3. Key Flows

**User flows** (route → surface) [from-code]: Home `/` → Catalog `/catalog` → Service detail
`/service/$provider/$id`; Availability `/availability` (per-landing-zone matrix); Guidance
`/guidance/$guidanceId` (onboarding step tree); Sources `/sources/*` and Security-policy
`/policies/$policyId` (**routes live but UI-unlinked** since `dc19c05`, [from-memory]); Releases
`/releases/$releaseId`, What's New `/whatsnew`, Support `/support`; `/overview` and `/skills` are
**gated redirects to `/`** (kept, not deleted) [from-code; from-memory `topic-retirement-done.md`].

**Control flow — live source resolution (the core engine)** [from-code]:
`handleHttpRequest` (`api/httpRoute.ts:38`, reads Bearer → `ResolutionContext`) → route
`/resources/{kind}/{slug}` → `getResourceContext` (`resources/resourceContextService.ts:127`) →
`resolveSection` picks a resolver by `source_class` (`resolverRegistry.ts:19`) →
`confluencePageResolver` / `terraformModuleResolver` / `policyDocumentResolver` /
`availabilityMatrixResolver`. Each resolver uses **caller token first, else env token**
(`ctx.token ?? env.CONFLUENCE_TOKEN`); missing creds → an honest empty excerpt + `source_unavailable`
warning, never fabricated content (`confluencePageResolver.ts:6`) [from-code].

**Data flow — content fetch + cache** [from-code]: live fetch memoized per-request in `ctx.pageCache`
(single-flight), wrapped by `withCache` (single-flight + negative cache + stale-while-revalidate)
keyed by `method+url+sha256(Authorization)` so identities never share cached bodies
(`sourceContentCache.ts:89`). Persistent cache = Valkey/GLIDE (default) or iovalkey when
`CACHE_VALKEY_URL` is set, wrapped in `ResilientContentCache` that degrades to in-memory on any
primary throw, logging once on transition (`sourceContentCache.ts:194,253`) [from-code].

**Data flow — discovery** [from-code]: `discoverAll` (`composition.ts:159`, memoized by env-hash) →
`discoverServiceSources` flattens the availability *spine*, maps each service to modules via
`TERRAFORM_MODULE_MAP` (JSON, 1:N) and probes `${TERRAFORM_ORG}/…`; `discoverGuardrails` CQL-lists the
security Confluence space; results derived through kernel `SECTION_RULES` into resource records +
Sources. Single live path — dev/CI point `CONFLUENCE_*`/`TERRAFORM_*` at MSW; **no separate
fixture-mode branch** in discovery (`discoverSources.ts:79`; `discoverGuardrails.ts:47`) [from-code].

**Data flow — availability (LZ-aware)** [from-code]: `createConfluenceAvailabilityProvider` iterates
`LANDING_ZONES`, fetches+parses each wired zone's Confluence page (`parseAvailabilityPage` lives
*inside* `confluenceAvailabilityProvider.ts`, not a standalone file); unparseable/unwired → empty grid
+ `availability_unavailable`, never another LZ's data (`confluenceAvailabilityProvider.ts:77,334`);
Portal renders it via `availabilityQueryOptions` + `useCurrentLandingZone()`, showing
`DataNotAvailableForZone` for not-available zones (`portal/src/routes/availability.index.tsx`) [from-code].

**Ask Atlas flow** [from-code]: `ask.ts:36` resolves a `{kind,slug}` (or `searchResources` first hit)
→ `getResourceContext` → `hasGovernedEvidence` gate → daily in-memory rate limiter (100/day, userId
always `"anonymous"`) → `createConfiguredClaimsAdapter` → `validateCitations` drops any claim whose
`citation_ids` aren't all in the projection's citation set (grounding enforcement) (`ask/askAtlas.ts:80-108`).

**Agent-readiness surfaces** [from-code]: `/mcp` (stateless JSON-RPC, 4 read-only tools, Bearer
threaded, `mcp/handler.ts:57`), `/.well-known/{mcp/server-card,oauth-protected-resource,ai-catalog,api-catalog}`,
`/llms.txt`, `/robots.txt`, `/sitemap.xml` (`agentDiscovery.ts`), and `/resources/{kind}/{slug}.md`
Markdown projection (`renderResourceMarkdown`).

**Feedback flow** [from-code]: `POST /feedback` → validate target against discovered records →
`FeedbackRepository.put` (DynamoDB if `FEEDBACK_TABLE`, else in-memory `Map`) (`api/feedbackRoute.ts:13`).

---

## 4. Important Implementation Details

- **Schema contracts** (`packages/atlas-schema/src/index.ts`) [from-code]: source classes
  `terraform-module | confluence-page | policy-document | availability-matrix`; authority levels
  `authoritative → deprecated`; a fixed **warning-code vocabulary** (`stale_source`, `broken_anchor`,
  `authority_conflict`, `restricted_source`, `source_unavailable`, `no_registered_source`,
  `availability_unavailable`, …). The agent-facing *resource-projection contract* (ADR-0013) is
  camelCase (`resolvedAt`, `requestedSections`, `matchReason`), with two orthogonal axes:
  `section.status ∈ available|partial|unresolved` and reasons via `warnings[].code` (`index.ts:400-513`).
- **Section vocabulary** is a single stable union spanning all kinds; per-kind applicability owned by
  the resource-kind registry (`index.ts:421-441`) [from-code].
- **Bearer pipe** (ADR-0001): opaque caller token threaded unparsed to Confluence; falls back to a
  narrow-scoped service `CONFLUENCE_TOKEN`; Confluence's own ACL governs results (`CONTEXT.md:46-63`) [from-doc].
- **Cache key** includes an Authorization SHA-256 digest so different callers never share cached
  content (`sourceContentCache.ts:89`) [from-code].
- **Deployment — current shape** [from-memory, owner-authoritative 2026-07-02]: **ECS Fargate + ALB +
  DynamoDB + ElastiCache (Valkey/GLIDE)**. This is the single current target; the Context Layer runs
  **in-process** inside the Portal's Nitro server, not as a separate service. Backing artifacts
  [from-code]: `portal/Dockerfile` builds a Nitro Node server on `PORT=8080`, copies the GLIDE
  `linux-x64-gnu` native binding (loaded when `CACHE_VALKEY_URL` points at ElastiCache), targets
  linux/amd64; `infra/main.tf` is hand-authored Terraform (VPC + ALB + ECS Fargate + DynamoDB
  `feedback`). The `context-layer` `build:lambda` bundle (`lambda/handler.ts:24`) is a **public-safe /
  optional artifact**, not the current deployment path. (Older `agent_readiness.md` "API Gateway
  Lambda" text is superseded — see §6.)
- **CI** (`.github/workflows/ci.yml`) [from-code]: job `verify` = `pnpm -r typecheck` → `lint` →
  `test` → portal `build` → context-layer `build:lambda`; then `e2e` (ubuntu+windows, mock-forced dev
  server, drives an already-installed system Edge, never downloads Chromium) and ubuntu `e2e-smoke`
  (real prod build, mock-free).
- **Key env vars** [from-code]: `CONFLUENCE_BASE_URL/TOKEN/EMAIL/SPACE_KEYS` (+ `CONFLUENCE_SECURITY_*`
  for the separate security instance); `TERRAFORM_BASE_URL/TOKEN/ORG/MODULE_MAP`;
  `CACHE_VALKEY_URL`/`CACHE_VALKEY_CLIENT`; `FEEDBACK_TABLE`; `BEDROCK_MODEL_ID`/`RAI_MODEL_ID`/`LLM_PROVIDER`;
  `CONTEXT_API_BASE_URL`; `DEV_MOCKS` (three-state: `1` force mock, `0` force real, else auto-detect on
  Confluence creds) (`portal/server/devMocks/shouldMock.ts:17`).

---

## 5. Historical Context (decision archaeology)

- **The 0.2.0 arc.** `feat/0.2.0` diverged from `main` at `bec3f16` (2026-05-07); it is a from-scratch
  rebuild that deletes the old `ContextBundleService`/`Topic`/`Anchor`/`pilotRegistry` architecture in
  favor of a discovery→derive pipeline. `bfff465` added a **port-restoration crosswalk**
  (`0.2.0-port-crosswalk.md`): Tier A = generic 0.2.0 infra taken as-is; Tier B = real parsing/fetch
  logic ported per-file from an old-architecture snapshot `18844da` [from-doc; from-memory].
- **Retired directions (with recorded rationale)** [from-memory unless noted]:
  - *ContextBundle → resource projection* (plan 019, `09a96e9`): `buildContextBundle`, `contextRoute`,
    MCP `atlas_get_context_bundle`, and the `ContextBundleResponse/Excerpt/AnchorReference` types
    deleted; consumers moved to `getResourceContext`. Rationale: Source ≠ Resource (Source is evidence
    *beneath* a Resource); services became uniform (no hero special-casing); policy became a discovered
    `kind:guardrail` Resource; LZ removed from the catalog (`plan-019-contextbundle-retired.md`).
  - *Topic → resource-first collapse* (ADR-0015 / plans 015→020, `d7a463c`+`d0f8b41`, 2026-06-30):
    `Topic` entity deleted, `kind` replaced `topic_type`, `record.topics` gone, route became
    `/service/$provider/$id`, catalog reads `GET /api/resources/catalog`; `/overview`+`/skills`
    *gated, not deleted*, per explicit user instruction (`topic-retirement-done.md`).
  - *capability → service* rename (pre-0.2.0) [from-code, `git log`]; *guardrail → security-policy*
    catalog rename (2026-06-26): route `/guardrails`→`/policies`, static "Rules" section deleted for
    live-cited policy sources; the `resourceKinds` `guardrail` axis was deliberately **kept** (different
    concept) (`atlas-guardrail-renamed-security-policy.md`).
  - *"Projection" retired as a naming/code term* by ADR-0014 (the 0013 live-vs-materialized *decision*
    is **not** reversed, only the word) (`docs/adr/0014-...md:1`) [from-doc].
  - *`ATLAS_` env prefix dropped* → source-system naming (`CONFLUENCE_*`/`TERRAFORM_*`/`CACHE_*`,
    2026-06-30) (`atlas-env-model-and-dev-seam.md`) [from-memory].
  - *`data/*.yaml` seed deleted* (plan 018, `2ce30f3`): registry/resources/guidance made fully
    discovery-derived; MSW kept only as sanctioned dev transport (`plan-018-execution-state.md`).
- **Discovery-model shift** (`dc19c05`, `41e37b0`, 2026-07-02): policy became a *per-service Confluence
  reference* (separate security instance via `extraInstances[]`), not a standalone crawl; TFE moved from
  a hardcoded convention to an explicit `TERRAFORM_ORG`+`TERRAFORM_MODULE_MAP` **1:N** map ("a service
  maps to several Terraform modules, not one") (`discovery-model-0.2.0-shift.md`; commit `41e37b0`).
- **Multi-landing-zone** (plan 021, ADR-0017, `796dac2`, 2026-06-29): "multi-cloud" == multi-LZ,
  post-MVP; LZ is discovery's sole hardcoded root (a code constant, a `landing-zones.yaml` was vetoed);
  `awsf` wired live, `awsc`/`azure` `not-available`; provider field = cloud, LZ never enters `{kind}/{slug}`;
  `ResolutionContext.scope` designed as a no-op seam (`plan-021-execution-state.md`, `multi-landing-zone-scope.md`).
- **Infra/cache/observability recent arc** [from-code/from-memory]: `16b2471` replaced a TS infra-plan
  generator with hand-authored Terraform; `1e6506f` made Valkey/GLIDE a **hard** dependency with
  in-memory degradation (native `.node` externalized via rolldown + Dockerfile COPY);
  `e0d2663` replaced the `ATLAS_LOG` on/off gate with always-on pino leveled logging and instrumented a
  previously-silent TFE 0-fetch chain (malformed `TERRAFORM_MODULE_MAP` JSON / key mismatch / empty spine).
- **ADR supersession chains** [from-doc]: 0013 `{provider}/{resource}` addressing → 0015 `{kind}/{slug}`;
  0009 "zone"=cloud vocabulary → refined by 0017 (LZ id); 0012 §5 scope seam → revised by 0015, then
  *first filled by LZ not APP* per 0017 (`appId` slot stays reserved).

---

## 6. Known Gaps And Open Questions

> **Conflict-resolution rule (owner, 2026-07-02):** where sources disagree, the **newer-dated document
> / owner statement is authoritative**. The items below are recorded with that rule already applied —
> most are now "older doc to update," not open questions.

- **Deployment shape — resolved; older doc stale.** Current target is **ECS Fargate + ALB + DynamoDB +
  ElastiCache**, Context Layer in-process (owner, 2026-07-02) — consistent with `constraints.md:81`
  ("ALB + ECS Fargate + DynamoDB … do not deploy through Lambda/API Gateway") and
  `infra/test/terraform.test.ts:15-30` (asserts ECS/ALB/DynamoDB present, Lambda/API-Gateway absent)
  [from-code]. **Stale, to fix**: `agent_readiness.md:216-227` still describes an "API Gateway HTTP
  Lambda" deployment and cites `infra/src/atlasInfraPlan.ts`, **a file that does not exist** [from-doc].
  The `context-layer` `build:lambda` bundle is a public-safe/optional artifact, not the deployment.
- **ADR-0017 — landed; ADR header stale.** LZ-rooted discovery is **implemented** (owner, 2026-07-02):
  `LANDING_ZONES` + `landingZoneSource.ts` exist and are tested (`landingZones/landingZones.ts:16`)
  [from-code]. The ADR's own header still reads "not yet in code (no `ResolutionContext.scope`;
  `availability.ts` fixture still present)" — **stale**; the named `availability.ts` fixture is no
  longer in the tree, and `ResolutionContext.scope` remains a no-op seam (`docs/adr/0017-...md:3`) [from-doc].
- **Self-flagged stale docs**: `constraints.md:25` and `current_design.md:101,140` carry maintainer
  NOTEs admitting they reference retired field names (`Topic`, `ContextBundle`, `{provider}/{resource}`);
  cross-checked correct against the live schema. **Not self-flagged**: `mvp-product-design.md:216` still
  cites retired `/api/topics?query=` / `/api/sources?query=` endpoints and an `ATLAS_ASK_LLM` flag [from-doc].
- **Ask LLM synthesis — not started (owner, 2026-07-02).** The feature has not been built; the
  Bedrock/RAI adapter code (`llmProvider.ts:14-34`, `bedrockClaimsProvider.ts`) is **dormant ported
  scaffold**, not a shipped capability. Two incidental facts follow from that: the doc-named
  `ATLAS_ASK_LLM` flag does not exist in code (zero grep hits), and the scaffold happens to activate a
  real adapter if `BEDROCK_MODEL_ID`/`RAI_MODEL_ID`/`LLM_PROVIDER` is set, else a deterministic
  simulated adapter (`ask.ts:44`) — neither reflects an intended, gated feature yet
  [from-code; `mvp-product-design.md:146,216` from-doc is directionally right (dormant) but names a flag
  that was never wired].
- **Env-name drift**: multiple docs still cite `ATLAS_CONFLUENCE_*`; code uses the bare `CONFLUENCE_*`
  (zero code hits for the prefixed form) (`0001/0004/0017`, `perf-baseline.md`, `goal_prompt_runtime_resolution.md`
  vs `landingZoneSource.ts:37-39`) [from-doc/from-code].
- **In-process Context API path skips Bearer + cache** — the Portal reaches the cached/authenticated
  path only when `CONTEXT_API_BASE_URL` forces the HTTP client (`inProcessContextApi.ts:73`) [from-code].
- **CI landmine — removed 2026-07-02.** `context-layer/scripts/measure-bundle-fetch-count.debug.test.ts`
  (imported the deleted `contextBundleService` + retired `data/sources.yaml` seed) was `git rm`'d this
  session; `context-layer/scripts/` is now empty. The vestigial `--exclude "scripts/*.debug.test.ts"`
  guard remains in `context-layer/package.json:22` (now a harmless no-op) [from-code].
- **`@atlas/schema` package** has no `test`/`typecheck`/`lint` scripts of its own; whether it is gated
  transitively via consumers is not independently confirmed (`packages/atlas-schema/package.json`) [from-code].
- **Plan 016 (domain decontamination)** has no completion record; likely subsumed by plan 018's
  discovery-derivation, but unverified [from-memory].
- **`mvp-product-design.md §13` open questions** (still unconverged per doc): beyond-scope Feedback
  modeling, the definition of "deployable" acceptance, measurement/observability plan, latency budget,
  public-safe CI enforcement, steward role/surface (`mvp-product-design.md:248-264`) [from-doc].
- **Uncommitted working-tree change**: `portal/src/routes/whatsnew.tsx` (modified) + new
  `portal/src/components/whatsnew/grid-broadsheet.tsx` — an in-progress What's New layout variant [from-code].
- **Rabbit holes deferred** (not chased here): the exact runtime state of the released a11y-debt gate
  (baseline-count-only, incl. a nested-`<main>` bug on `/whatsnew`); whether `agentSkills` is a live
  source file or fully inlined into `agentDiscovery.ts` [from-memory / inferred].

---

## 7. Discussed Future Directions (proposed, not built — no ranking)

- **Automated source governance / Phase 2** (ADR-0008): broad-scan discovery + confidence-gated
  auto-classification feeding the Git ingestion seam; explicitly reverses the earlier "no crawler"
  non-goal, gated on "after the spine is proven" (`docs/adr/0008-...md`) [from-doc].
- **Continuous-reconciliation source lifecycle** + a designed-but-deferred **mutable/"Autonomous Source
  Control Plane" (option B)**, gated on five measured triggers (`docs/architecture/source-lifecycle-design.md:5,257`)
  [from-doc]. The mutable/live control plane is repeatedly proposed-and-deferred across ADR-0007/0008
  ("a deferral, not a dead end") [from-doc].
- **APP-scoped Entra identity** (ADR-0012): APP as a Source-visibility dimension; proposed, post-MVP,
  scope seam currently filled by LZ instead (`docs/adr/0012-...md:3`) [from-doc].
- **Agent discovery & API redesign proposal** (`docs/atlas-agent-discovery-and-api-redesign-proposal.md`,
  marked "设计建议稿" / design-proposal): a 4-layer bootstrap→capability→invocation→content redesign to
  fix agents that can't bootstrap from `/` or act on the Topic-era OpenAPI; parts already adopted as
  ADR-0013/0014 resource work, the full redesign is proposal-stage [from-doc].
- **API Gateway grounded-adoption hard gate** (`docs/product/api-gateway-adoption-gate.md`): a CI-enforced
  adoption journey across S3/API Gateway/Textract (discover → fit → cited Terraform starter). Bespoke
  NL→IaC generation is explicitly "a separate, later layer … not part of the MVP done bar" [from-doc].
- **Multi-LZ expansion beyond `awsf`** (plans 022–025, never authored as files): newsletter multi-LZ,
  catalog per-LZ content variants (flagged "heaviest"), full availability LZ axis, Ask multi-LZ, plus
  an `/estate` overview + `/lz/{id}` route (`multi-landing-zone-scope.md`; `docs/adr/0017-...md:126-127`)
  [from-memory/from-doc].
- **Agent-readiness Phase 2/3** (`docs/architecture/agent_readiness.md`): resumed Agent Skills
  publication, robots/sitemap/Link headers; the read-only MCP facade is already partly built [from-doc/from-code].
- **Live LLM synthesis in Ask — not started (owner, 2026-07-02)**: a Bedrock/RAI adapter *scaffold*
  exists but the feature is unbuilt/dormant; Ask today is a grounded wayfinding router
  (`llmProvider.ts`; `mvp-product-design.md:146`) [from-code/from-doc/from-memory].

---

## 8. Source Map

- `README.md` — repo layout, dev mock-vs-live seam, common tasks, CI shape.
- `PRODUCT.md` — users, product purpose, brand/design principles (evidence-before-confidence).
- `CONTEXT.md` — the domain glossary (Source/Anchor/Excerpt/Citation/Resource/Guardrail/Availability/…);
  authoritative terminology + retirement flags (Topic retired).
- `DESIGN.md` — the "Blueprint" design system: OKLCH tokens, Inter/Plex Mono, token-swap reskin seam (ADR-0005).
- `AGENTS.md` / `CLAUDE.md` — working agreement, public-safe rules, skill-loading protocol.
- `0.2.0-port-crosswalk.md` — the 18844da→0.2.0 Tier-A/Tier-B port-restoration map and global renames.
- `docs/product/mvp-product-design.md` — the authoritative MVP product+architecture design (the one job,
  MVP bar, hero slice, governed honesty, §13 open questions).
- `docs/adr/0001–0017` — decision archaeology; note the supersession chains (0013→0015, 0009→0017, 0012→0017).
- `docs/architecture/{current_design,constraints,live-resolution,source-lifecycle-design,agent_readiness,catalog}.md`
  — background design + self-flagged stale NOTEs + the deployment/lifecycle future directions.
- `plans/README.md` + `plans/001–026` — execution log with per-plan status (DONE/deferred/rejected).
- `packages/atlas-schema/src/index.ts` — the canonical contract surface (enums, warning codes, resource projection).
- `context-layer/src/composition.ts` — the sole composition root (live discovery + resolvers + repositories).
- `context-layer/src/api/httpRoute.ts` + `resources/resourceContextService.ts` — the request-resolution entry + core.
- `portal/src/api/server/{contextApi,httpContextApiClient,inProcessContextApi,contextApiBridge}.ts` — the Context API boundary.
- `portal/server/devMocks/{shouldMock,start}.ts` — the dev mock/live seam.
- `.github/workflows/ci.yml`, `portal/Dockerfile`, `infra/main.tf` — the verification + deployment artifacts.
- Project memory (`/Users/ziyu/.claude/projects/-Users-ziyu-Workspace-atlas/memory/`) — prior grilling
  outcomes: plan-018/019/021 execution state, discovery-model shift, env model, topic retirement,
  product-direction-wedge, deployment-and-current-state.

---

## 9. Positions Taken (owner, 2026-07-02 — freshest, most binding)

These are the maintainer's most recent stated positions from the design discussion that produced this
pack. They **supersede** any older doc on conflict (newer-wins). Downstream prompts treat them as
**strong priors**: **P1, P2, P3 are firm** (do not relitigate — design around them); **P4, P5, P6 are
challengeable** if evidence supports a better path.

- **P1 — Atlas is ONE product: a governed multicloud Platform-Engineering context layer.** The invariant
  is *governed context* (cited, fresh, honest) delivered at **point-of-action**, for humans (Portal) and
  machines (agent API/MCP) off the **same governed data** — **一体两面**. [firm]
- **P2 — Hard boundary: Atlas NEVER provisions / deploys / triggers CICD.** Agents may **read**
  status/logs/info to gather context *before* an action; Atlas never performs the action. (= guideline
  "information-centric not provisioning-centric"; ADR-0003 status = uncited pointer.) [firm]
- **P3 — The phase-now wedge is the Human-first portal**, mandated top-down + by `guideline.md`.
  Agent-first is the eventual other face, explicitly **NOT the first thing**. [firm — external mandate]
- **P4 — Status = reference + live-resolve, never ingest/mirror** (ADR-0003 line). Do it *gradually*;
  company data-landability is the hard part and maintenance debt is high. [challengeable on mechanism]
- **P5 — Anti-"Knowledge Center too weak" (the manager's live challenge): the moat is trust
  (provenance + freshness + governed honesty) + point-of-action, NOT coverage breadth.** Build the
  human portal **ON** the governed context API so the agent face is a near-free byproduct. [challengeable]
- **P6 — Multicloud (>3 clouds) unified entry is the terminal frame**; cross-cloud data landability is
  the gating constraint on any cross-cloud ambition. [challengeable on sequencing]

