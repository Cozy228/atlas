# Current-Design Optimization Directions

> **Purpose.** A neutral catalog of optimization *directions* observable in the **current** Atlas
> implementation (feat/0.2.0), as raw material for the product-architecture discussion. This is not a
> roadmap, not a ranking, and not a set of decisions. Each entry is **Observation** (with citation) →
> **Why it matters** → **Option space** (neutral, no recommendation). Companion to
> `PROJECT-CONTEXT-PACK.md`; every current-state claim traces there or to code.
>
> Framing rule: an "optimization direction" here means *a place where the current implementation and
> the stated intent are not yet aligned, or where a design choice is load-bearing and currently
> unsettled.* It does not imply the current state is wrong.

---

## A. The governed-context seam is only half-used

- **Observation.** The Portal's default in-process read path calls context-layer handlers with **no
  `ResolutionContext`** → falls to `defaultResolutionContext()`, which is **cache-free and token-free**
  (`portal/src/api/server/inProcessContextApi.ts:71-76`; `resolvers/resolverTypes.ts:84-92`;
  `resources/resourceContextService.ts:130`). Only the HTTP entry (`api/httpRoute.ts:119`
  `cachedResolutionContext`) and the `/api/*` bridge / `/mcp` thread the shared cache + caller Bearer.
  Current deployment runs the Context Layer **in-process** inside the Portal (memory
  `deployment-and-current-state`).
- **Why it matters.** On the primary deployment's human read path, the newly-hard-dependency
  **ElastiCache/Valkey cache and the ADR-0001 Bearer pipe (per-caller Confluence ACL) are bypassed** —
  reads use the service token and no shared cache. The "一体两面 / build the portal on the governed
  context API" intent (locked context) is not yet realized on the read path that users actually hit.
- **Option space.** (i) Have the in-process client pass a cached/authenticated `ResolutionContext`;
  (ii) always route the Portal through the HTTP contract (`CONTEXT_API_BASE_URL`), even co-located;
  (iii) accept the split as intended (UI = service-token/uncached, agents = per-caller/cached).

## B. Where does durable curated / governance state live?

- **Observation.** Registry/resources are **discovery-derived at runtime**, memoized in-process by
  env-hash; there is **no `data/*.yaml` seed and no durable store** (`context-layer/src/composition.ts`;
  seed retired per plan 018). ADR-0013/0015 state Atlas "durably stores presentation metadata," while
  plan-018 mandated "no durable resource instances in code" — **unresolved tension**
  (`PROJECT-CONTEXT-PACK.md` §6; memory `plan-015-is-adr0015-execution`).
- **Why it matters.** The governed-honesty model depends on curated fields — `owner`,
  `authority_level`, `review_frequency`/`last_reviewed_at` (review-decay) — that **no live source can
  refresh** (`CONTEXT.md:117-124`). If everything is derived from discovery each boot, those curated
  claims have no authoritative home; the Git-manifest ingestion seam (ADR-0007) is the designed home
  but its relationship to runtime discovery is not settled.
- **Option space.** (i) Git-manifest overlay merged over discovery (ADR-0007 seam) as the curation
  store; (ii) a durable metadata store distinct from source content; (iii) keep fully-derived and
  drop/relocate curated-field guarantees.

## C. Discovery cost & cold-start

- **Observation.** `discoverAll` runs **live at request time**, memoized only in-process by an env-hash
  key (`composition.ts:159`); the discovery spine is the **full ~100-service availability grid** (plan
  017 owner override), plus per-service Confluence reference discovery and per-service Terraform module
  probes (`discovery/discoverSources.ts`; memory `discovery-model-0.2.0-shift`).
- **Why it matters.** A cold start (or env change / new instance) triggers a full crawl of the source
  systems on the first request; scales with the whole cloud service catalog, not the hero slice — a
  latency and source-system rate-limit exposure directly relevant to the "point-of-action, fast" goal.
- **Option space.** (i) Persist/warm a discovery snapshot across boots; (ii) background/scheduled
  refresh (lifecycle plane, ADR-0008) feeding a cache; (iii) lazy per-resource discovery instead of
  whole-spine; (iv) accept live per-boot for simplicity.

## D. Status: reference vs ingest (the "every status" ambition)

- **Observation.** ADR-0003 classifies live operational status (TFE runs, etc.) as **uncited,
  Portal-native, a pointer to act elsewhere, NOT Evidence** (`CONTEXT.md:99-104`). The stated vision
  adds app / CICD / security-scan / "every status." Owner note: collecting status is valuable but the
  process is "麻烦" and maintenance debt is high (memory `product-direction-wedge`).
- **Why it matters.** Ingesting/aggregating status = N integrations that rot and pull Atlas toward
  becoming a dashboard-of-dashboards (the "one more scattered platform" trap). Referencing +
  live-resolving keeps it a context provider but bounds what it can promise about freshness/coverage.
- **Option space.** (i) Status as cited **pointers** + live-resolve on demand (never stored); (ii) a
  thin normalized status **index** (where it lives, per resource) without values; (iii) full
  aggregation pipeline (highest debt); (iv) defer status entirely from phase 1.

## E. Availability resolved twice

- **Observation.** `availabilityMatrixResolver` re-fetches + re-parses the availability page
  **independently** of `AvailabilityProvider`'s own memoized parse
  (`resolvers/availabilityMatrixResolver.ts:43-65`; `sourceContent/confluenceAvailabilityProvider.ts`).
- **Why it matters.** Two live-fetch/parse paths for one governed source = duplicate I/O and a possible
  consistency seam (two parses can disagree if the page changes between them).
- **Option space.** (i) Share one parsed matrix behind a single provider; (ii) keep separate if the
  resolver's per-request grain (cell/row/column) needs an independent read.

## F. Cache backend is a hard dependency but under-exercised

- **Observation.** `@valkey/valkey-glide` is now a **hard** dependency with `ResilientContentCache`
  degrade-to-memory; native `.node` externalized + Dockerfile COPY (memory
  `valkey-glide-hard-dep-packaging`). Per item **A**, the main in-process read path does not use it.
- **Why it matters.** The operational cost (packaging, native binding, ElastiCache provisioning) is
  paid, while the highest-volume path (Portal UI reads) currently bypasses the cache. Ties directly to
  the item-A decision.
- **Option space.** Follows A: if the Portal read path adopts the cached context, the hard dependency
  is justified on the hot path; otherwise the cache serves only agent/HTTP traffic.

## G. Feedback persistence default

- **Observation.** Feedback uses DynamoDB only when `FEEDBACK_TABLE` is set; otherwise an in-memory
  `Map` (`repositories/feedbackRepositoryFactory.ts:10`), seeded empty (`composition.ts`).
- **Why it matters.** Feedback ("missing / stale / broken / unclear") is a first-class governed-honesty
  mechanism (`CONTEXT.md:190-193`); on the in-memory default it is lost on restart. Prod deployment
  includes DynamoDB (memory `deployment-and-current-state`), so this is a config-wiring question, not
  code.
- **Option space.** (i) Require `FEEDBACK_TABLE` in prod (fail-fast if unset); (ii) accept the
  in-memory fallback as dev-only; (iii) surface persistence status in the honesty UI.

## H. Ask surface — scaffold vs feature

- **Observation.** Ask LLM synthesis is **not started**; the Bedrock/RAI adapter stack is dormant
  ported scaffold that *auto-activates* if `BEDROCK_MODEL_ID`/`RAI_MODEL_ID`/`LLM_PROVIDER` is set,
  else a deterministic simulated adapter (`portal/src/api/server/llmProvider.ts:14-34`; `ask.ts:44`).
  The doc-named `ATLAS_ASK_LLM` flag does not exist. Rate limiter is in-memory, `userId` always
  `"anonymous"` (`ask/askAtlas.ts`). (memory `product-direction-wedge`; `PROJECT-CONTEXT-PACK.md` §6.)
- **Why it matters.** When Ask is picked up, there is no explicit on/off gate, and rate-limiting +
  identity are per-process placeholders — relevant to any human-first "ask a governance question"
  hero, and to the grounded-citation validation already present (`validateCitations`).
- **Option space.** (i) Keep Ask as a grounded wayfinding router (no LLM) for phase 1; (ii) add an
  explicit feature gate before wiring a live adapter; (iii) real per-user identity + durable rate
  limiting when/if Ask becomes first-class.

## I. Documentation / spec drift

- **Observation.** Several docs are stale against current code (newer-wins): `agent_readiness.md`
  (Lambda + API Gateway deployment; cites nonexistent `infra/src/atlasInfraPlan.ts`), `ATLAS_*` env
  prefix across multiple docs (code uses bare `CONFLUENCE_*`), `mvp-product-design.md:216`
  (`/api/topics?query=`, `ATLAS_ASK_LLM`), ADR-0017 header ("not yet in code"),
  `constraints.md`/`current_design.md` (self-flagged retired field names) (`PROJECT-CONTEXT-PACK.md` §6).
- **Why it matters.** These docs are read as authority by humans and agents; drift undermines the
  "provenance + freshness" pitch the product itself makes.
- **Option space.** (i) A reconciliation pass to current facts; (ii) mark-stale + redirect to the
  authoritative source; (iii) leave as historical (relying on the newer-wins rule).

## J. 一体两面 requires one API, not two surfaces

- **Observation.** Two client paths exist (in-process default vs HTTP), and the agent-facing `/api/*`,
  `/mcp`, `/resources/*.md` already run on the governed HTTP contract, while the Portal UI defaults to
  the in-process path (items A, F).
- **Why it matters.** The locked intent is "build the portal ON the governed context API so the agent
  face is a near-free byproduct." If the Portal renders from a divergent path, the two faces can drift
  in content and freshness — the opposite of 一体两面.
- **Option space.** (i) Unify both faces on the same governed contract/resolution path; (ii) contract
  tests asserting Portal and agent responses are equivalent (ADR-0011 bundle-equivalence spirit);
  (iii) accept divergence with documented differences.
