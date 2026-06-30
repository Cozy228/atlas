# 017 — Live Confluence discovery adapter (build-ready goal prompt)

> Status: design — **build-ready** after the 2026-06-28 seam-grilling pass
> (12 decisions recorded in [§Build-ready specification](#build-ready-specification-2026-06-28)).
> This adapter implements a **NEW narrow port (`ResourceReferenceDiscovery`)**, NOT
> the Registry / SourceContentProvider ports from [`plans/016`](016-domain-decontamination.md).
> Dev/test keep the dev seed; the composition root swaps THIS live adapter in for
> prod. Per `seed-dev-adapter-principle`: the design target is the real-environment
> live fetch; `data/*.yaml` is dev mock only, never the design standard.

## Goal
Given the platform's service inventory, auto-discover the Confluence pages that
document each service and surface them as **reference-only document links,
categorized by doc type**, with ZERO per-service / per-page hand configuration.
The agent must never mistake "a link exists" for "content obtained."

## Locked decisions

| # | Fork | Decision |
|---|---|---|
| 1 | Adapter boundary | Implements a **new `ResourceReferenceDiscovery` port** returning `DiscoveredReference[]` (reference-only). It does **not** populate the governed Registry, does **not** implement `SourceContentProvider`, and the Registry's strict schema is **not** relaxed. A discovered reference may be **promoted** into a governed Source only after governance metadata + bindings are supplied (out of scope for MVP). |
| 2 | Catalog spine | The **availability service inventory** (the `AvailabilityProvider` enumeration) is the authoritative spine of *which services exist*. Discovery iterates whatever services that enumeration returns — count/coverage is **data, not a design knob** (dev = fixture projection, prod = the governed availability-matrix live-fetch+parse that already works). ~~Confluence enumeration of the service set~~ is retired. |
| 3 | Service identity | A new **`ServiceIdentityNormalizer`** turns `(provider, service id, display name)` into a canonical Resource key + base aliases. `data/resources.yaml` is an **optional governed overlay** (fix name / add aliases / supply governance metadata) — **never a precondition** for a service entering discovery. ConfluenceDiscovery consumes only the normalized `ServiceIdentity`. ~~Title-prefix derivation of the service set~~ is retired. |
| 4 | Discovery & categorization | Wide recall by aliases (CQL `title ~`), but a candidate enters the reference list **only when it hits BOTH the service identity AND a controlled doc-type pattern**. Non-matching candidates go to **discovery diagnostics** (structured log/count, not a user surface), never an `other` bucket. The title convention is an **admission filter, not a data model**; Confluence labels + the overlay are higher-confidence signals that progressively replace title inference. |
| 5 | Runtime / cache | **In-process, per-Resource-key last-good cache with stale-while-revalidate.** Miss → synchronous fetch; stale-past-TTL → serve stale + single-flight refresh; refresh failure → keep last-good, expose `lastObservedAt` + stale status; past **max-staleness → `unavailable`** (not unbounded stale); cold start + fetch failure → honest gap. No cross-instance / cross-restart external store. |
| 6 | Feature scope | Discovery covers **Confluence reference-only**. TFE module / Git README **resolved** content stays on the existing governed `terraformModuleResolver` path — out of this adapter. |
| 7 | Consumer merge | Resource detail **merges** governed Sources + reference-only references at read time, **clearly distinguished** (governed/resolved vs reference-only/agent-not-readable). Discovery adds references **alongside** the resolved-content panels — it does NOT replace them. |

## The discovery pipeline

```
AvailabilityProvider enumeration  (which services exist: provider/id/name;
                                   dev fixture / prod governed-matrix live-parse)
        │  iterate EVERY service — N is data, the code is generic (read as many as exist)
        ▼
ServiceIdentityNormalizer  →  canonical Resource key + base aliases
        │  [optional] data/resources.yaml governed overlay (name / aliases / governance metadata)
        ▼
ServiceIdentity
        ▼
ConfluenceDiscovery  (implements ResourceReferenceDiscovery)
   CQL wide recall by aliases
     → admit ONLY (service-identity hit ∧ doc-type pattern hit) → classify
     → misses → discovery diagnostics (never `other`)
   in-process per-Resource-key last-good cache + SWR + single-flight + max-staleness
        ▼
DiscoveredReference[]  (reference-only, categorized)
        ▼
Resource detail read  →  merge governed sources + reference-only refs (distinct, alongside)
```

## `DiscoveredReference` (output type)
- Fields: `title`, `url` (page webui), `doc_type` (`design | user-guide | policy`),
  `last_observed_at`, `content_mode: reference_only`, `access_mode`
  (`service_credentials` for Confluence), optional `confidence`.
- `content_mode` / `access_mode` live on **`DiscoveredReference`**, **not** on the
  governed `SourceSchema` (017's earlier "add to source schema" is reversed — the
  governed schema stays strict and unaware of references).
- Reuses the existing client stack but adds a **new** call: discovery hits the
  Confluence **CQL search endpoint** (`GET /wiki/rest/api/content/search`, v1) with
  the same baseUrl/auth (`ConfluenceLiveConfig`, injectable `FetchLike`) as the v2
  content reads. The current client only does single-page v2 reads — search is net-new.

## Config surface (O(1) — the whole point)
| Config | Scale | Home |
|---|---|---|
| Confluence creds (token / baseUrl / email) | O(1), 3 secrets | AWS Secrets Manager |
| Space key(s) | O(spaces), start with 1 | env / config |
| Doc-type pattern → bucket map | O(doc-type), fixed small set | code/config |
| per-service / per-page / per-section | **0 / 0 / 0** | — |

## Honesty (agent-facing)
- Every `DiscoveredReference` carries `content_mode: reference_only` +
  `agent_accessible: false` (Confluence body unreadable without user creds).
- Missing / unmatched → honest gap (empty list / diagnostics), never fabricated.
- Cache failure surfaces `lastObservedAt` + stale/`unavailable`, never a silent
  stale link list.

## Consumer UX
- Resource detail renders the categorized **reference doc-link list** as a distinct
  block **alongside** the governed resolved-content panels, labeled reference-only.

## Deploy (PROD on AWS ECS)
- In-process last-good cache inside the existing ECS service — **zero new infra**.
  Creds from Secrets Manager via the task role.
- The spine's prod source is the **already-working** governed availability-matrix
  live-fetch+parse (`availability-matrix` Source → `confluenceCloudContentProvider`
  → `parseMarkdownMatrix`); the parsed service rows ARE the enumeration. **No new
  prod dependency** — the top-level availability grid's prod live-fetch (plan 014's
  TODO) is a richer presentation grid, unrelated to the spine.

## Out of scope / later
- **Promote** a reference into a governed Source (manual governance action + bindings).
- Generic Confluence body parsing / citation (reference-only for now).
- Real TFE-registry / Git auto-discovery (resolved content stays governed + manual).
- Label-based discovery (`label in (...)`) as the robust upgrade to title-convention.
- Azure / multi-cloud coverage (spine grows as services enter the governed inventory).

## ADR impact
- ADR-0013: discovery is part of the live projection (the source SET is discovered),
  but a reference entering Atlas ≠ its body entering Atlas (reference_only).
- **[ADR-0016](../docs/adr/0016-convention-driven-confluence-reference-discovery.md)** —
  convention-driven Confluence reference discovery: the `ResourceReferenceDiscovery`
  port, ServiceIdentity normalization + optional overlay, the double-hit admission
  filter, the spine-only Identity ⊕ Overlay merge model, and the in-process
  last-good cache. Written 2026-06-28.

---

## Build-ready specification (2026-06-28)

The 2026-06-27/28 sessions locked the *decisions* (above); this pass resolves the
*seams* a builder needs. The earlier draft asserted three seams that do not exist in
code as described — they are specified here. Decisions are numbered B1–B12.

### The three seam gaps that were closed
1. **Spine had no service enumeration, and no `provider`.** `AvailabilityProvider`
   exposed only `getZones()`; `AvailabilityRecord` carries `{id,name,iconKey,domain,
   availability}` — no provider. (B1–B3)
2. **No merge container.** `ResourceContextResponse` had `{resource, requestedSections,
   sections, missingSections, resolvedAt}` — nowhere for references, no `governance`
   state, and `getResourceContext` returned `null`→404 when no `resources.yaml` record
   existed (so a discovered service with no governed overlay could not render). (B4–B6)
3. **`data/resources.yaml` double-named.** It IS the existing projection-record file;
   its `slug`/`provider`/`aliases` ARE the optional overlay — join key was undefined. (B4, B8)

### B1 — Canonical key = `{provider}/{id}`
The service-kind Resource key is `{provider}/{id}` (e.g. `aws/textract`), which is
exactly the `service`-kind `slug` under ADR-0015's `{kind}/{slug}` addressing. The
normalizer produces this from the spine tuple **alone** — `resources.yaml` is never
required to form a key (honors decision #3 "overlay never a precondition").

### B2 — `AvailabilityProvider.listServices()` enumerates the **governed matrix**, not the full grid
Add to the **existing** port (decision #2 — not a sibling port). **Critical:** the spine is
the **governed availability-matrix** (the anchor-pinned, cited subset that
`availabilityMatrixResolver` / `parseMarkdownMatrix` already produces in prod; dev =
`MATRIX_ROWS` = `s3, api-gateway, textract`) — **NOT** a flatten of `getZones()`.
`getZones()` returns the full AWS+Azure presentation grid (dozens of services, prod
live-fetch still a plan-014 TODO); §Deploy is explicit that grid is "unrelated to the
spine." So `listServices()` shares the matrix parse, not the grid:

```ts
// context-layer/src/services/availabilityProvider.ts
listServices(): ServiceIdentity[]   // EVERY service row the governed matrix exposes — N is data.
                                     // dev fixture = 3 (s3/api-gw/textract); prod may list 10s/100s.
```

**Generic over N (decision #2 — "count/coverage is data, not a design knob").** The code is a
`for each service in listServices()` loop with **no inlined `3` and no assumed upper bound**:
whatever the availability source enumerates, discovery iterates all of it (1, 2, 10, 100…).
The dev fixture happening to return 3 is **not** a cap. Adding a service to the platform's
availability ⇒ it enters discovery automatically, **zero per-service discovery config** (the
O(1) promise). Whether a given service is `configured` (has a `resources.yaml` overlay, e.g.
`textract`) or `unconfigured` (e.g. `s3`/`api-gateway` today) is orthogonal — both render.

### B3 — `provider` is the governed matrix's zone scope (a Source config attribute)
The governed matrix is **single-provider** (`MATRIX_ZONE_ID = "aws"`) and its serialized
markdown carries **no** provider column — so `provider` is **not** a parsed cell. It comes
from the matrix Source's zone/scope config (dev: the matrix is the AWS zone → `"aws"`).
Multi-cloud = multiple governed matrices, each scoped to one zone/provider. (This is exactly
why Q3 chose config-over-parse.)

### B4 — Spine-only Resource pages: Identity ⊕ Governed Overlay
For `kind: service`, the **availability inventory establishes Resource existence and
canonical identity**; `resources.yaml` no longer decides existence — it supplies
optional governance metadata + Section bindings. `getResourceContext` becomes
identity-first:

- resolve `ServiceIdentity` via `listServices()` where `identity.key === params.slug`;
- governed overlay = `findRecord(resources.yaml)`; **found** → `governance:"configured"`,
  resolve sections as today; **not found but identity exists** → `governance:"unconfigured"`,
  `sections:{}`, emit no per-section missing entries, **not 404, not a faked resolver failure**;
- neither identity nor overlay (service kind) → genuine 404;
- non-service kinds (`guardrail`, `landing-zone`): unchanged — overlay IS their identity,
  `governance:"configured"`, no discovery.

### B5 — Response gains a top-level flat `references`
```ts
// ResourceContextResponseSchema
references: DiscoveredReference[]   // flat; each carries doc_type — UI groups, schema does not
```

### B6 — Response gains a resource-level `governance`
```ts
governance: "configured" | "unconfigured"
```
"No overlay" is a property of the resource, not of each section — one clear signal, one
UI banner, semantically distinct from per-section `no_registered_source`.

### B7 — Dev discovery is a fixture **adapter**, not yaml
`adapters/dev/createDevReferenceDiscovery()` returns sample `DiscoveredReference[]` for
known services **in code** (each `content_mode:"reference_only"`, `agent_accessible:false`,
spanning doc_types) so the merge UI / spine-only page / `unconfigured` banner are
developable + testable offline. It does **not** read `data/*.yaml` — discovery is a
live-fetch port, not a governed-registry source.

### B8 — Alias derivation + recall/admission tiering
`ServiceIdentityNormalizer` derives, all case-normalized:
- `recallAliases` (search only) = { `name`, vendor-prefix-stripped name (drop
  `Amazon|AWS|Azure|GCP|Google`…), `id`-as-words };
- `admissionAliases` (gate only) = stable **human product names + explicit
  abbreviations only** — the bare machine slug is **recall-eligible, never
  admission-eligible**.
- `resources.yaml` aliases **ADD** to either tier; never replace.

### B9 — Identity hit = normalized full token-sequence match
After CQL recall, the client re-checks the title: lowercase + separator-normalized, the
title must contain a **complete `admissionAlias` token-sequence** (not a `\b` substring
regex). This refilters CQL's fuzzy/substring recall.

### B10 — Per-Resource-key CQL + cache; on-demand
- One CQL per service from its `recallAliases`:
  `(title ~ "a1" OR title ~ "a2" …) AND space in (<keys>) AND type = page`.
- Each `identity.key` is an **independent query + cache unit** (aligns with the
  per-Resource last-good cache / single-flight / SWR / fault isolation of decision #5).
- **Triggered on demand by the resource-detail read; the list page never runs full
  enumeration.** Warmup, if any, uses a **bounded-concurrency** scheduler.
- Per-service result cap (B12); truncation sets `incomplete:true` **and** logs — never a
  silent cap.

### B11 — doc-type judged by a global typed rule constant
A single typed `docTypePattern` map (fixed small set; **not** per-space — per-space would
break O(1)). Normalized-title token-pattern match; on multiple hits the **longest / most
specific** pattern wins, tie-break `policy > user-guide > design` (`design` is the widest
fallback). Zero hit → **not admitted**, goes to diagnostics (never an `other` bucket).
Title rules are the deterministic admission mechanism for the Preview phase; Confluence
labels / explicit metadata are the stronger future signal (out of scope, decision #4).

### B12 — Cache thresholds (the numbers behind decision #5)
- fresh TTL = **1h** (serve cache directly within window);
- stale-past-TTL → serve stale + single-flight refresh;
- max-staleness = **24h** → `status:"unavailable"` (never unbounded stale);
- per-service recall cap = **50** → `incomplete:true` + log on truncation.

### New types (home: `@atlas/schema`)
```ts
ServiceIdentity = {
  provider: string; id: string; name: string;
  key: string;                 // `${provider}/${id}` == service-kind slug
  recallAliases: string[];     // search-only
  admissionAliases: string[];  // gate-only
}

DiscoveredReference = {
  title: string; url: string;                       // page webui url
  doc_type: "design" | "user-guide" | "policy";
  last_observed_at: string;                          // ISO
  content_mode: "reference_only";
  access_mode: "service_credentials";
  agent_accessible: false;
  confidence?: number;                               // optional; unset in Preview
}
```

```ts
// new port — context-layer/src/services/resourceReferenceDiscovery.ts
ResourceReferenceDiscovery = {
  discover(identity: ServiceIdentity): Promise<{
    references: DiscoveredReference[];
    status: "fresh" | "stale" | "unavailable";
    last_observed_at: string | null;
    incomplete: boolean;
  }>;
}
```

### Wiring
`ContextBundleServiceOptions` gains `referenceDiscovery?: ResourceReferenceDiscovery`;
`composition.ts` defaults it to `createDevReferenceDiscovery()`; a prod build swaps in
`createConfluenceReferenceDiscovery(config)` (CQL v1 `GET /wiki/rest/api/content/search`,
same `ConfluenceLiveConfig` + injectable `FetchLike` as the v2 reads). `getResourceContext`
/ `ResourceContextDeps` thread the new port (service kind only).

---

## Goal-prompt harness

Tracking issue: [#17](https://github.com/Cozy228/atlas/issues/17).

This plan is executable: an implementing agent should treat the sections below as the
done-bar and loop until every check is green. Read [§Build-ready specification](#build-ready-specification-2026-06-28)
and [ADR-0016](../docs/adr/0016-convention-driven-confluence-reference-discovery.md) as the
**single source of truth**; do not re-litigate B1–B12.

### Constraints (non-negotiable)
- **Public-safe (repo `CLAUDE.md` §Rules).** No company code / internal URLs / real Confluence
  space keys / page ids / credentials. All fixtures use fictional services + generic sample data.
- **Generic core only.** No company-specific adapter here; `createConfluenceReferenceDiscovery`
  targets the **generic** Confluence Cloud CQL API behind the injectable `FetchLike`.
- **`seed-dev-adapter-principle`.** The design target is the real-environment live fetch;
  `data/*.yaml` and the dev fixture are mocks, **never** the design standard. The dev discovery
  adapter returns in-code samples — it must **not** read yaml (B7).
- **PNPM only.** All commands `pnpm …`.
- **Surgical.** Touch only the seams B1–B12 name; the governed `SourceSchema` / Registry /
  `SourceContentProvider` ports stay untouched and reference-unaware (decision #1).

### Implementation batches (each ends green before the next)
- **Batch 1 — schema** (`@atlas/schema`): add `ServiceIdentity`, `DiscoveredReference`; extend
  `ResourceContextResponseSchema` with `references: DiscoveredReference[]` + `governance`. Tests
  for each. → `pnpm --filter @atlas/schema test` green (raise the 32-test count, don't gut it).
- **Batch 2 — spine** (`context-layer`): `AvailabilityProvider.listServices()` over the
  **governed-matrix scope** (dev `MATRIX_ROWS`, prod the `availability-matrix` parse — **not**
  `getZones()`); provider = the matrix's zone (`"aws"`); `ServiceIdentityNormalizer` (key `{provider}/{id}`,
  tiered `recall`/`admission` aliases per B8). → `pnpm --filter` context-layer test green.
- **Batch 3 — identity-first read** (`context-layer` + `portal`): `getResourceContext` resolves
  identity from `listServices()`, merges optional overlay, emits `governance` + empty Sections for
  spine-only (never 404 / never faked failure, B4/B6); route + Portal detail render a spine-only
  service. → context-layer + portal tests green.
- **Batch 4 — discovery port + dev fixture**: `ResourceReferenceDiscovery` port +
  `createDevReferenceDiscovery()`; wire `ContextBundleServiceOptions.referenceDiscovery?` +
  `composition.ts` default; `getResourceContext` merges `references` top-level. → offline dev
  renders the categorized reference block.
- **Batch 5 — live adapter**: `createConfluenceReferenceDiscovery(config)` — CQL v1 search, the
  double-hit admission pipeline (B9 token-sequence identity hit + B11 doc-type judge), per-key SWR
  cache + single-flight + max-staleness + cap (B12), diagnostics for misses. Mocked-`FetchLike`
  tests. → context-layer test green.
- **Batch 6 — Portal reference UX**: reference-only block alongside resolved panels, labeled
  agent-not-readable; `unconfigured` banner; stale/`unavailable`/`incomplete` honestly shown.

### Definition of Done (loop until all green)
1. `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm validate:registry` all green; no suite
   gutted (counts go up, not down).
2. **Spine-only behavior:** a service that is in the availability inventory but has **no**
   `resources.yaml` record returns a normal detail page with `governance:"unconfigured"` and empty
   Sections — **not 404, not a resolver failure**.
2b. **Generic over N (no cap):** discovery iterates **every** service `listServices()` returns —
   no hardcoded count. A test that adds a 4th fixture service to the availability source must give
   it a detail page + discovery **with zero code changes**; nothing assumes 3.
3. **Honesty:** every `DiscoveredReference` carries `content_mode:"reference_only"` +
   `agent_accessible:false`; a miss yields an empty list + diagnostics, never a fabricated link.
4. **Offline dev:** with no creds, dev renders the categorized reference block from the in-code
   fixture (no yaml read by discovery).
5. **Identity precision:** a page whose title matches only the bare machine slug (not a human
   product name / explicit abbreviation) is **not** admitted; a title needs identity **and**
   doc-type hit to enter the list.
6. **Cache honesty:** past max-staleness (24h) `status` becomes `"unavailable"`; a truncated recall
   (cap 50) sets `incomplete:true` + logs — verified by a mocked-clock / mocked-`FetchLike` test.
7. **Public-safe:** no real space key / page id / credential in any committed file or fixture.

### Out of scope (deferred — do not build)
Reference→Source promotion; Confluence body parsing/citation; TFE-registry / Git auto-discovery;
label-based discovery; Azure / multi-cloud; cross-instance cache. (Mirror of ADR-0016 Consequences.)
