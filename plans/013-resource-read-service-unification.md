# 013 — Unify the resource READ on one resolution core; drop "Projection" framing

> Handoff from the plans/011 loop. NOT in the 011 commit. Captures an architectural
> direction the user raised mid-loop; 011 §26 deliberately deferred the Portal side.
>
> **Revision note.** An earlier draft of this plan put a single `ResolvedResourceContext`
> at the shared node and made Portal and Agent two serializers of it. That over-unified:
> it silently promoted "Portal adopts the Resource/Section model" from a *product choice*
> to an *architectural requirement*. Corrected below after grounding against the code. The
> shared node sits **lower** (the resolver + atomic result); multiple deterministic
> assemblers over it are allowed and expected.

## The concern

The 011 agent surface reads, from the outside, like a *second parallel business API*
("Portal API" vs "Agent API") with a "Projection" subsystem flavour. Two problems:

1. **"Projection" drags in the wrong baggage.** CQRS projection, materialized view,
   event consumption, precompute, persisted read model, background refresh — all of which
   directly contradict ADR-0013 (Resource is **live**, not materialized). It should never
   spawn `ProjectionPlan` / `ProjectionStore` / `ProjectionJob` entities.
2. **Portal-vs-Agent is the wrong boundary.** The honest split is by what is read, not by
   who reads it. Portal consumes *several* read faces; Agent consumes a subset. Forcing a
   single shared response shape is over-unification.

## The corrected model: one resolution core, many deterministic views

```
        Source / Anchor / Authz / Resolver registry        ── shared, already reused
                          │
              atomic resolution result                      ── the canonical thing
            (fragments · citations · warnings · status)
              /                          \
   buildContextBundle              getResourceContext
   (group by Source — Portal)      (group by Section — Agent)
            │                         /          \
   Portal topic/source view       JSON         Markdown     ── two serializers of ONE
                                                               ResourceContextResponse (OK)
```

Two levels, two different rules:

- **Level 1 — the resolution core (shared, REQUIRED to be single):** Source/Anchor/Authz,
  the resolver registry, the source→binding model, and the atomic resolved result
  (fragments + citations + warnings + status). This is already shared today.
- **Level 2 — assemblers (may be many):** `buildContextBundle` groups the atomic result by
  Source (Portal today); `getResourceContext` groups it by Section (Agent). Two deterministic
  views of the same facts are **not** two sources of truth. (The JSON+Markdown split *under*
  `getResourceContext` is itself two serializers of one `ResourceContextResponse` — that part
  was already correct and stays.)

**Technical consistency** (shared Level 1) is required. **Product consistency** (Portal and
Agent using the same navigation / grouping) is a separate, *optional* product decision — not
an architectural prerequisite.

## What is already correct (do NOT regress) — verified against code

- **α live projection (ADR-0013):** request-time resolution via the existing resolver
  registry + Source/Anchor/contentProvider; **no** stored excerpts, **no** ProjectionStore,
  **no** precompute. `resolvedAt`, not `generatedAt`.
- **The "doubling cost" is already banked.** `getResourceContext` reuses the *same*
  `createResolverRegistry([...])` as `buildContextBundle`; warning codes come from one
  `@atlas/schema`; there is no second resolver, no second citation/warning path. The only
  thing that diverges today is the **assembly** (by-Source vs by-Section).
- **The wire schema is `ResourceContextResponse`** (generated from `@atlas/schema` zod via
  `toJsonSchema`). Renaming the internal *record* type is contract-neutral — verified:
  `ResourceProjectionRecord` does not appear in the OpenAPI components; only
  `ResourceContextResponse` does.
- **`searchResources` is a Registry/Discovery read**, not a content read — it resolves a
  name to a canonical `{kind}/{slug}` and does **not** live-resolve Source content. So the
  agent root OpenAPI already spans two read faces (Discovery + Context).
- **Agent-side availability is already single-sourced** (011 §3, "#2 = B"): MCP reads the
  governed `availability-matrix` Source through `availabilityMatrixResolver`. No fork.

## Architectural invariants (the real deliverable)

Write these into an ADR-0013 follow-up. Note the wording — **"atomic"** is load-bearing:

```
There is exactly one source-resolution pipeline.
There is exactly one canonical source-binding model.
There is exactly one canonical ATOMIC resolution result.

Aggregate views may be many, but each must be deterministic and must NOT independently
resolve, reinterpret, or alter source-backed content.

Consistency is defined per (same request, same instant, same authz context):
facts and resolution status agree across views; response SHAPE need not.
```

`one canonical ATOMIC result` — **not** `one canonical result`. The latter would force
Portal onto the Resource/Section model. Multiple assemblers over the same atomic result are
explicitly allowed. The authz clause connects to ADR-0012: the same resource under a Portal
admin vs an anonymous agent may legitimately resolve different Sources — that is not a bug.

**YAGNI guards (do NOT build these now):**

- Do **not** materialize a shared `ResolutionBatch` / `ResolvedSourceResult` type yet. The two
  assemblers work today without one. Introduce a shared intermediate only when 013c-1 or the
  consistency test actually needs to *extract* the atomic result. Until then, guard the
  invariant with a review rule + golden tests (each assembler consumes resolver output
  verbatim; no re-resolution, no status reinterpretation, no re-ordering of facts).
- Do **not** mint a per-section `RegionalAvailabilityContext` wire type. Per-resource
  availability is just `ResourceContextResponse.sections.availability`. The name is *design
  vocabulary only* (see below); a bespoke per-section type re-introduces exactly the
  per-surface divergence we are removing.

## The boundary: three READ faces, two OpenAPI documents

| Face | Purpose | Examples | Consumers |
| --- | --- | --- | --- |
| **Resource Context Read** | one resource's live-resolved content | `getResourceContext` (textract `network` / `availability`) | Agent + (future) Portal detail |
| **Registry / Explore Read** | cross-resource query / index / aggregate over Atlas's own registry | `searchResources`, catalog list, availability matrix, guidance index, source browser | Portal (heavy) + Agent (discovery only) |
| **Management / Admin** | mutate / configure / diagnose | source & anchor edit, bindings, resolution diagnostics | Portal only |

These **three conceptual faces map to two OpenAPI documents** — do not build three API
namespaces:

- root `/openapi.json` = a curated subset of **Context Read + Discovery Read** (today: 4
  ops — `getAtlasInstructions`, `getAtlasCapabilityCatalog`, `searchResources`,
  `getResourceContext`).
- `/api/internal/openapi.json` = **Registry/Explore Read + Management** (topics, sources,
  context-bundle, diagnostics, …).

Both docs already generate component schemas from shared `@atlas/schema` zod
(`z.toJSONSchema`); they are **not** hand-written. Keep it that way.

## Two "availability" — same source of record, different contract

Two things wear the word "availability"; name them in design/code prose so the next reader
does not conflate them:

- **RegionalAvailabilityContext** — one service's `availability` section: the live-resolved
  row from the governed `availability-matrix` Source, with citation / warning / partial. It
  **is** the `availability` section of a Resource Context Read. (Design name only — not a new
  type.)
- **AvailabilityMatrix** — the cross-service × cross-region grid for the Explore surface. It
  **is** a Registry / Explore Read.

They **share one system of record** — the governed `availability-matrix` Source. That Source
is a *single* document: the resolver reads the whole grid in one resolve (matrix view) or one
row (context view), so the two **agree on facts by construction**. They differ only in
presentation / freshness affordances (a live single-row read with a per-row warning vs a
browse grid). ⇒ retiring `portal/src/api/server/availability.ts` (the hand-curated fixture)
means pointing the Explore matrix at the governed Source as a **Registry/Explore Read**, NOT
at `getResourceContext`. Its retirement is gated on the governed matrix's **data coverage**
(the pilot is narrower than the fixture), not on read architecture. This is exactly 011 §3's
deferred "full-stack single source (A)" — decoupled from this line.

## Work breakdown — what is REQUIRED vs OPTIONAL

| Item | Scope | Do now? |
| --- | --- | --- |
| **013a** | Rename `resourceProjectionService` → `resourceContextService`; `ResourceProjectionRecord` → `ResourceContextRecord`; internal symbols only (do **not** global-replace the word "projection" — much of it is correct ADR-0013 copy/freshness comments). Corrected invariants now in [ADR-0014](../docs/adr/0014-resource-read-one-core-many-views.md). | **Yes** — contract-neutral (verified). |
| **013b** | Document the boundary as the three READ faces → two OpenAPI docs; tag each existing capability to a face; mark `searchResources` as Discovery read. | **Yes** — docs only. |
| **013c-1** | **Folded into c-2.** There is no separate additive resource page — the resource content page *is* `catalog/$topicId` migrated (see "Converged c-2 target model"). The only standalone meaning is an optional *maintainer parity/diagnostics view* ("what does the blind agent see for X?") on the Management face. | n/a — folded. |
| **013c-2** | Full Portal Resource-first IA. Grilled shape in "Converged c-2 target model" below: Resource = the object; Topic = attribute/filter, not an API layer; APP-scope nests outside; bundled with ADR-0012 as one migration. | Recorded as [ADR-0015](../docs/adr/0015-portal-resource-first-ia.md); needs its own plan + blind-loop reverify; **not** a prerequisite for the Agent API. |
| **availability.ts** | Retire by pointing the Explore matrix at the governed Source (Registry/Explore Read). | Gated on governed-matrix **data coverage**; decoupled from this line. |

**Required = 013a + 013b.** Everything about Portal IA (`013c-*`) and `availability.ts` is
decoupled from Agent-API correctness and must not be framed as its cost.

## Converged c-2 target model (post-MVP — grilled 2026-06-26)

> **Superseded 2026-06-27.** A second grilling pass revised this section: a Topic now resolves
> three ways (Resource / Facet / **Decompose**), Facets keep a bounded-concurrency **aggregate
> view** (not "facets, not pages"), addressing unifies on `{kind}/{slug}`, and 0015 ships
> **independently** of the ADR-0012 APP migration (decision 4 below is reversed). Authoritative
> target: [ADR-0015](../docs/adr/0015-portal-resource-first-ia.md); execution plan:
> [plans/015](./015-portal-resource-first-ia.md). The text below is kept for history.

If/when Portal goes Resource-first, this is the agreed shape. It is one coherent migration —
do **not** ship it piecemeal.

1. **Resource is the primary content object.** The per-thing content page is keyed by
   `{kind}/{slug}`, section-grouped, served by `getResourceContext`. This page is **not new** —
   it is `catalog/$topicId` **migrated**: re-keyed (`topic-id` → `{kind}/{slug}`), re-grouped
   (by Source → by Section), re-pathed (`buildContextBundle` → `getResourceContext`). That is
   why "013c-1" is not a separable additive page — it dissolves into this migration.
   `sources/$sourceId` **stays** — a Source is a different object (the provenance behind
   sections), on the Registry/Explore or Management face.

2. **Topic demotes to a filter/attribute — NOT an API layer.**
   - An attribute on resource records (`resources.yaml` gains `topics: [...]`).
   - A query param over the resource listing (`GET /api/resources?topic=private-networking`)
     plus a field in the response — not a collection of its own.
   - Thin labeled metadata only (`{id, name, description?}`) for Portal theme-index pages;
     it owns **no** resolved content and **no** content endpoint.
   - ⇒ `/topics/{id}/context` retires; `source-topic-mappings.yaml`'s content role collapses
     into `resources.yaml` (resource → section → source becomes the single content spine);
     Portal migrates off `/topics`. Cross-cutting areas (private-networking, s3-guardrails,
     serverless-compute) survive as **theme facets, not pages**.

3. **APP-scope (ADR-0012) is the OUTER layer; Resource is the INNER object — nested.**
   "Login → pick APP → that APP's resources, theme-faceted." APP is *scope* (a Source
   `visibility`/authz filter, ADR-0012 §1); Resource is the *object* within scope; Topic is a
   *facet* within that. Three levels, no conflict.

4. **Ship c-2 and the ADR-0012 APP migration as ONE post-MVP "my APP's resources" IA effort.**
   Because APP nests outside Resource (decision 3), doing them separately would rewrite the
   same surfaces (catalog / guidance / availability) twice. Revise ADR-0012 §5's "reuse
   existing (topic-centric) surfaces" → "reuse the Source→Citation machine; the surfaces
   become resource-first." ADR-0012 is still *proposed*, so this reconciliation is cheap.

**Status: deferred behind the MVP done-bar** (grounded adoption journey). This migration
touches the 011 §26 freeze and requires a blind-loop reverify; it is recorded as
[ADR-0015](../docs/adr/0015-portal-resource-first-ia.md) (proposed) and needs its own
implementation plan. The only now-items remain **013a + 013b**; none of c-2 is a prerequisite
for Agent-API correctness.

## Consistency tests

Do **not** assert `Portal.sections == Agent.sections` — the groupings differ, so that
comparison is meaningless. Under one authz context and one resolution, assert the **atomic
facts** agree: `sourceId`, `anchorId`, fragment content/hash, citations, warning codes,
resolution status. Then golden-test each assembler separately (by-Source view; by-Section
view). This verifies fact consistency without forcing wire-shape consistency.

## The one-line concept to keep (drop the rest of "Projection")

> Agent API presents an agent-oriented view over the same live source-resolution pipeline
> and canonical resolution records used by Portal read surfaces.

Not "the same `ResolvedResourceContext`" — Portal does not consume that type today, and the
invariants do not require it to.

## Why the heavy items stay deferred (011 §26)

011 §26 freezes the Portal context-API calls and routes the full Portal+Agent unification to
a later plan. 013a / 013b do not touch that freeze. 013c-1 is additive (a new call, not a
changed one). 013c-2 is a product decision, out of scope here. Doing the path-merge mid-loop
would break green tests and the running blind-agent loop for no behavioural gain.
