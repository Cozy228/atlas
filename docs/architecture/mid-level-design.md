# Mid-Level Design — Context Graph, Moment Briefs, Change Feed

> **Status:** accepted design (decisions M1–M12, §10; M1–M4 owner-confirmed 2026-07-03,
> M5–M10 presented and folded the same day; M11–M12 owner-confirmed 2026-07-03 in the
> realization round, together with implementation decisions I1–I6 — see
> `implementation-plan.md`). Amended 2026-07-04 per **P26** (multicloud situation shape:
> `AppRecord.landingZoneIds[]`, per-zone brief blocks).
> Companion to `unified-product-architecture.md` (high-level, CLOSED per decision log P17).
> This document pins schemas, persistence, API surface, execution model, module boundaries,
> validation, and migration order. It stays above code: shapes are described, not typed out.
> Capability-state vocabulary applies; platform vocabulary per `CONTEXT.md`.

---

## 1. Schema contracts (`@atlas/schema` additions)

All new shapes reuse the existing warning-code vocabulary and the two-axis
`status ∈ available|partial|unresolved` + `warnings[]` model (ADR-0013 §4). No parallel status
vocabulary.

- **`NodeRef`** — one of: a Resource address `{ kind, slug }`; a scope entity
  `{ scope: "landing-zone" | "app", id }`; an operational location `{ location: <id> }`.
  Scope entities and locations are NOT Resources: no sections, no `{kind}/{slug}` address, never
  citable as Evidence.
- **`GraphEdge`** — `{ from: NodeRef, to: NodeRef, type: EdgeType, provenance: { source_id,
  resolvedAt } }`. `EdgeType` is a **closed enum**: `service-availability`, `service-module`,
  `service-policy-ref`, `service-guidance`, `service-location`, `app-landing-zone`,
  `app-service`, `resource-owner`. Every edge answers "where was I discovered from" (P14);
  edges from consumer state (`app-*`) carry `provenance: { source_id: "consumer-state",
  resolvedAt: <declaredAt> }` and are rendered `self-declared`.
- **`OperationalLocation`** — `{ id, system ("tfe" | "harness" | …), kind ("workspace" |
  "pipeline" | "logs" | "dashboard" | "runbook"), url, discoveredFrom }`. A pointer record
  (ADR-0003 seat): the pointer's *existence* is discovered (with provenance); any *value* fetched
  through it is operational status — uncited, never stored, never Evidence.
- **`AppRecord`** (consumer state) — `{ id, name, landingZoneIds[], serviceSlugs[], origin:
  "self-declared" | "registry", declaredAt, updatedAt }`. `origin` drives the UI label and the
  edge provenance; a registry adapter later rewrites `origin` in place (P17 upgrade).
  `landingZoneIds` is a **set** (P26): an APP may hold deployments in several zones across
  clouds; an LZ id carries its cloud identity, so no separate cloud dimension exists. One
  `app-landing-zone` edge is derived per member. The repo manifest (P21) declares the same set.
  **(P30, 2026-07-05.)** `AppRecord` is NOT the situation's truth source and nothing
  platform-side derives from it (consumer state is never Evidence). Identity is resolved from a
  **provenanced source** — Entra (Portal login) / repo (agent inference); self-declared is the
  labeled, provenance-less fallback. `origin: self-declared → registry` is the provenance
  **upgrade seat**. Persistence is justified only by a durable consumer-state need
  (subscriptions/feedback, Step 2) and holds an *identity association*, not a scope snapshot —
  scope follows from the provenanced identity. The manifest is an optional explicit override,
  not a mandated anchor (an agent infers scope from the repo first, P28).
- **`Subscription`** (consumer state) — `{ id, appId, channel: "newsletter" | "feed",
  eventClasses?: EventClass[] (default: all), createdAt }`.
- **`ChangeEvent`** — `{ id, class: EventClass, subject: NodeRef | EdgeKey, landingZoneId?,
  from: { value?, resolvedAt, citation }, to: { value?, resolvedAt, citation },
  rootId, derivedAt }`. `EventClass` is the **closed list** (P13): `catalog-added`,
  `catalog-removed`, `availability-changed`, `module-version-changed`, `policy-ref-changed`,
  `owner-changed`. `EdgeKey = (from, to, type)`. Both ends cite the parses they came from —
  a change is Evidence about structure.
- **`Brief`** — `{ moment: "adopt" | "build" | "debug" | "change", situation: { appId?,
  landingZoneIds[], origin }, blocks: BriefBlock[], resolvedAt }`. The situation carries the
  scope's LZ **set** (P26); LZ-dependent blocks (availability, policy) render per member zone,
  LZ-independent blocks render once.
  **`BriefBlock`** — `{ id, question, landingZoneId?, status, evidence[] (cited section
  content), pointers[] (OperationalLocation), warnings[] }`. `landingZoneId` is set on
  per-zone blocks only. Evidence and pointers are separate arrays by construction — the
  ADR-0003 line is a type property, not a style rule.

## 2. State & persistence map (who owns what, where)

| Store | Class | Contents | Loss consequence |
|---|---|---|---|
| **Valkey** | derived cache | content perf cache (existing `withCache`); **discovery snapshots, keyed per root**: `discovery:<envHash>:<rootId>` = parse output + `resolvedAt`, plus the previous successful parse (K=2 retained per root, for diffing) | re-discover on next read; no product data lost |
| **DynamoDB `events`** | derived, durable | append-only `ChangeEvent`s (event id = content hash → idempotent conditional put) | change feed history lost — hence durable, NOT recomputed from Valkey |
| **DynamoDB `apps`, `subscriptions`, `feedback`** | consumer state (P17) | self-declared APPs, subscriptions, feedback | user data lost — durable, fail-fast wiring in production like `FEEDBACK_TABLE` |
| **Git overlay** | curation exception (P14) | only fields with no derivable source | versioned in Git; PR is the review surface |

Nothing else is durable. Source content never lands in any of these (P7).

**(P30, 2026-07-05.)** The `apps` row is consumer state, not a situation truth source: a
self-declared APP is a provenance-less, labeled fallback, and its persistence is justified by
the subscription/feedback anchor need (Step 2), not by storing scope — identity resolves from a
provenanced source (Entra/repo). `subscriptions` arrive in Step 2.

## 3. API surface (all through the one governed router, P10)

**Brief endpoints** (new family; ADR-0013 amendment — representation endpoints extend from
resource to brief):

- `GET /api/briefs/adopt?service={slug}&app={id}` (fallback `&lz={id}`)
- `GET /api/briefs/build?service={slug}&app={id}`
- `GET /api/briefs/debug?app={id}[&error={text}]`
- `GET /api/briefs/change?app={id}[&since={iso}]` (fallback `&lz=`)
- `GET /briefs/{moment}.md?…` — Markdown render, same semantics as `/resources/{…}.md`
  (stable address ≠ stored file; stamped `resolvedAt`).

**Consumer state:**

- `GET /api/apps` · `POST /api/apps` (self-declare; `serviceSlugs` validated against discovered
  records, same pattern as feedback target validation) · `PATCH /api/apps/{id}` ·
  `GET /api/apps/{id}`
- `POST /api/subscriptions` · `DELETE /api/subscriptions/{id}`

**Change feed (agent pull):** `GET /api/changes?scope=app:{id}|lz:{id}&since={iso}` → `ChangeEvent[]`.

**MCP moment tools** (thin wrappers over the brief handlers — same code path, P13):
`check_adoption(service, app)` → adopt brief · `get_my_context(app)` → build brief ·
`explain_error(app, error?)` → debug brief · `whats_changed(app, since?)` → change brief.
The existing 4 read-only resource tools remain the atom layer.

Existing `/api/resources/*` is untouched.

## 4. Execution model

- **Brief assembly** is request-time: template (code, §5) → graph traversal from the situation's
  entry node → bounded-concurrency resolution of the traversed nodes' relevant sections
  (ADR-0014 §2 aggregator; per-request `pageCache`; `ResolutionContext` threaded per P10). No
  brief-level cache: the content cache underneath is the only cache (a brief is cheap once
  sections are cached; a second cache would add a second clock).
- **Snapshot lifecycle:** read-through with stale-while-revalidate per root; a *successful*
  revalidation that replaces a previous successful parse is a **snapshot transition**.
- **Event derivation runs at snapshot transition**, inline in the revalidation flow (still the
  runtime plane — request- or schedule-triggered, no free-running worker): diff new vs previous
  successful parse **of the same root**, map to `ChangeEvent`s, conditional-put to `events`
  (content-hash id ⇒ concurrent transitions across ECS tasks are idempotent).
  **Degradation gaps produce zero events** — one `aging-note` annotation instead (the change feed
  never lies during recovery; unified doc §3.4 honesty rule).
- **Lifecycle plane (Optional at runtime):** a scheduled refresh task (keeps snapshots warm and
  transitions regular) and the newsletter job (reads `events` × `subscriptions`, renders the
  change brief, sends). Both use the lifecycle credential plane (`CONTEXT.md` two-planes).

## 5. Module boundaries (`context-layer/src/`)

- `graph/` — edge derivation (formalizes what `discovery/derive*` already implies) + snapshot
  store port (`SnapshotStore`: get/put per root, previous-parse retention).
- `briefs/` — the assembler + **four templates as code** (like `landingZones/`: configuration
  input, not data; no template DSL, no fifth template without a product decision).
- `changes/` — the differ (pure function: two parses → events) + `EventStore` port (DynamoDB
  adapter, in-memory for dev).
- `apps/` — `AppDirectoryPort`: `selfDeclaredAppsAdapter` (DynamoDB) now; `registryAppsAdapter`
  later (P17 upgrade swaps adapters, port unchanged).
- `subscriptions/` — port + DynamoDB adapter.
- Portal: APP selector (subsumes the LZ selector as its fallback), brief pages per moment,
  What's New re-wired to the change feed. `mcp/handler.ts`: +4 moment tools.
- Composition root (`composition.ts`) remains the sole wiring point.

## 6. Validation & tests (what "correct" means)

- **Face equivalence** (P10, extended): for sampled scopes, the Portal loader's brief, the
  `/api/briefs/*` payload, and the MCP tool result are schema-identical. CI-gated.
- **Parse contracts** (P16): per-root fixtures from real pages; format drift fails CI.
- **Differ golden tests:** snapshot-pair fixtures → expected events; a degradation-gap pair →
  zero events + one aging note. The differ is pure, so this is table-driven.
- **Template honesty tests:** every `BriefBlock` declares its honest-empty; fixtures with missing
  data must yield `unresolved` + the right warning code, never an absent block (absence of data ≠
  negative fact, ADR-0013 §4).
- **Consumer-state validation:** self-declared `serviceSlugs` must resolve against discovered
  records; dangling declarations surface a warning on the APP (not silently dropped) when
  discovery no longer produces the service.

## 7. Observability (pino, existing arc)

Per-brief: moment, scope, per-block status, duration. Per-root: snapshot age at serve,
transitions, degradation enter/exit. Per-derivation: event counts by class. Two product metrics
fall out: **time-to-brief** (the "merge time" the product exists to collapse) and **per-block
unresolved rate** — the honest-gap dashboard that tells us which source to negotiate next (P16
convention→contract prioritization is data-driven, not vibes).

## 8. Migration order (dependency, not calendar)

1. **Seam factory (P10)** — shared `cachedResolutionContext`; everything below threads it.
2. **Snapshot store per root** — Valkey keys + K=2 retention; cold-start and multi-task crawl
   collapse.
3. **Edges formalized** — derive step emits `GraphEdge[]` with provenance; schema lands.
4. **Differ + `events` table** — change feed live; What's New consumes it.
5. **`apps/` port + self-declared adapter + APP selector** — the P17 entry.
6. **Brief assembler + adopt/build/change templates** — pages + MCP moment tools (one code path).
7. **Debug template** — locations index from existing edges; value resolution stays
   Capability-bounded.
8. **Subscriptions + newsletter job** — the push column (Optional at runtime).

Each step is independently shippable and independently revertible; no step blocks on a
landability fact except 7's value half.

## 9. Doc/vocabulary consequences

`CONTEXT.md` gains: **moment**, **brief**, **operational location**, **consumer state**,
**context adapter**, **snapshot transition**; "wayfinding" is marked subsumed by the situated-
merge framing (P12). ADR-0013 gets the brief-endpoints amendment pointer. The pack §6 stale-doc
reconciliation pass rides along.

## 10. Mid-level decisions taken (with the alternative that lost)

- **M1 — Events are derived once and stored durably (DynamoDB), not recomputed.** Alternative:
  re-diff Valkey snapshots on demand — rejected because Valkey retention (K=2) can't serve
  `since=<3 weeks ago>`, and feed history must survive cache loss. Cost: an append-only table
  with idempotent writes.
- **M2 — Snapshots live in Valkey, not DynamoDB.** They are derivation cache, not product data;
  loss ⇒ re-discover. Valkey is already the hard dependency and SWR machinery exists. Cost:
  accepting that snapshot history beyond K=2 does not exist (that is what `events` is for).
- **M3 — Self-declare ships without identity.** Anyone in the org portal can create/edit an APP
  record; mutations are logged (pino) and the record is labeled. Accepted because the blast
  radius is a mislabeled convenience record (never Evidence), and the real fix (Entra) arrives as
  an adapter, not a redesign. Alternative (block APP entry on identity) re-creates the gate P17
  just removed.
- **M4 — No brief-level cache.** One cache (content), one clock. A brief cache would reintroduce
  the two-clock collapse ADR-0013 §6 forbids, for latency the owner has ruled non-critical.
- **M5 — Template relevance contracts (owner rule: pull in everything relevant).** No numeric
  budget. Each template declares what *relevant* means for its moment: which edge types it
  follows and which section subset per node (both closed sets). Fan-out follows the data (a
  service with 8 modules shows 8). Response size for agents is handled by `depth` (M9); a failed
  fetch inside a brief yields `partial` + a warning — never silent truncation.
- **M6 — Change-feed noise: two noises, two filters.** *Relevance noise* (events you don't care
  about) is filtered by **subscription** — scope + `eventClasses` (owner rule). *Truth noise*
  (false events from parse flapping) is filtered by **stability damping** — a changed value must
  persist across two consecutive successful parses before an event is emitted. Subscriptions
  cannot fix a lying event; damping cannot know what you care about; both stay. A slug rename is
  honestly reported as `catalog-removed` + `catalog-added` (discovery cannot see intent).
- **M7 — Debug brief: content is the bar, locations are the floor (P18).** The target capability
  assembles content: the declared services' troubleshooting sections as cited excerpts, plus
  operational values (run states, log excerpts) **live-fetched, displayed uncited and visually
  separated** (ADR-0003) as fetch access to each system lands (Negotiate N4). Until then a
  source's block degrades to a labeled pointer — honest floor, never the target. Free-text error
  interpretation is never done server-side (P12/P15 — the consuming agent's job); deterministic
  error-class routing arrives with the runbook error-code convention (N3).
- **M8 — Push delivery channel.** Now: the in-portal "my changes" surface + a per-scope Atom
  feed (zero new infrastructure; agent-consumable, so the feed serves both push cells of the
  binding matrix). Upgrade path (owner-confirmed direction): SNS/SSE-style push delivery —
  Implementation dependency. Email is not the plan.
- **M9 — Brief depth parameter.** `?depth=citations|excerpts`. Human renders default to
  `excerpts`; MCP moment tools default to `citations` (structure + citations first; the agent
  fetches bodies via the resource atom layer on demand). Token size is the agent's latency.
- **M10 — Snapshot-transition atomicity.** The per-root previous-parse pointer swap is atomic
  (compare-and-swap on the **existing Valkey store** — no new infrastructure); the swap winner
  derives events, losers discard. Concurrent ECS tasks cannot emit conflicting baselines.
- **M11 — Scope passes by value or by reference (the manifest ↔ AppRecord reconciliation).**
  *By value:* a call carries the repo manifest's declaration (`landingZones[]`, `services[]` —
  set shape per P26) inline — stateless, zero registration, and a by-value request **never
  writes** (no upsert-on-read). *By reference:* `appId` → a durable `AppRecord`, needed only where
  consumer state must persist (subscriptions, feedback attribution, the "my APP" view).
  Registration is an explicit act (portal or `POST /api/apps`), after which the id is
  written back into the manifest. Brief/resource endpoints accept both forms. Conflict rule:
  both present and disagreeing → the request scopes by the manifest **value** (the caller's
  own freshest declaration) and carries a `scope_drift` warning — honest, and it nudges the
  sync. Alternative rejected: implicit upsert on an agent's first call — drive-by record
  creation, and it silently widens the blast radius M3 deliberately bounded.
- **M12 — Operational values are fetched only through per-system adapters; auth mode is an
  adapter property.** Closed set: `caller-bearer` (thread the caller's token; Confluence
  class) / `service-token` (narrow-scoped read-only env token; TFE class) / `none` (no value
  channel — the block stays a labeled pointer, the honest floor). A self-registered
  location's `url` field is a human link only; value fetching goes through the owning
  adapter's allowlisted API base, **never an arbitrary URL GET** — SSRF is closed by
  construction, not by filter. **Atlas never stores a team's secret**: a system that needs
  team-owned credentials is a fetch-access negotiation (Track B), not a credential-vault
  feature. Alternative rejected: registrations carrying fetch URLs + tokens — that shape is
  simultaneously a secret store and an SSRF proxy.
