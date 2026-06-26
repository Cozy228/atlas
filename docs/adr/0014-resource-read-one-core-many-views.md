# The resource read is one resolution core with many deterministic views: drop the "Projection" framing and split the surface by read-face, not by consumer

Status: accepted
Date: 2026-06-26

> Refines [ADR-0013](./0013-resource-projection-not-materialization.md). It does **not**
> reverse 0013's α (live, not materialized) decision; it retires the *word* "Projection" at
> the code/naming layer and reframes the read surface by face rather than by consumer.

## Context

[ADR-0013](./0013-resource-projection-not-materialization.md) settled α — Resource and
Section endpoints are **live** projections, never materialized — and used "Projection" as the
framing term. The 011 agent surface then shipped (`searchResources`, `getResourceContext`, the
`.md` view) by **reusing the existing resolver engine**. A review (plans/013) surfaced two
framing problems, both verified against the code:

- **"Projection" drags in the wrong baggage.** The word evokes CQRS projection, materialized
  view, event consumption, precompute, persisted read model, background refresh — every one of
  which contradicts 0013's own live decision and invites `ProjectionStore` / `ProjectionPlan`
  / `ProjectionJob` entities 0013 forbids.
- **"Portal API vs Agent API" is the wrong boundary.** It reads as a *second parallel business
  API*. In fact the resolution engine is already shared: `getResourceContext` reuses the same
  `createResolverRegistry([...])` as `buildContextBundle`; warning codes come from one
  `@atlas/schema`; OpenAPI components are generated from shared zod; the wire type is
  `ResourceContextResponse`; `searchResources` is identity resolution over the registry, not
  content resolution. Only the **assembly** differs (group-by-Source vs group-by-Section).

So the "doubling cost" a naive reading fears is already avoided; what remains is a naming
problem and a boundary problem, not a duplicated subsystem.

## Decision

1. **Retire the "Projection" term at the code/naming layer; keep 0013's live decision.**
   `resourceProjectionService` → `resourceContextService`; `ResourceProjectionRecord` →
   `ResourceContextRecord`. Do **not** global-replace the word "projection" — it stays correct
   in 0013's "live projection" sense in prose and comments. Contract-neutral: verified that the
   record type does not appear in the OpenAPI wire components (only `ResourceContextResponse`
   does).

2. **The canonical thing is the ATOMIC resolution result, not an assembled response.**
   ```
   There is exactly one source-resolution pipeline.
   There is exactly one canonical source-binding model.
   There is exactly one canonical ATOMIC resolution result
     (fragments + citations + warnings + status).
   Aggregate views may be many, but each must be deterministic and must NOT independently
     resolve, reinterpret, or alter source-backed content.
   ```
   "Atomic" is load-bearing. "One canonical *result*" (unqualified) would force every consumer
   onto a single assembled shape — e.g. Portal onto the Resource/Section model. `buildContextBundle`
   (by Source) and `getResourceContext` (by Section) are two legitimate deterministic views of
   the **same** atomic result, not two sources of truth.

3. **Consistency is defined per (same request, same instant, same authz context):** facts and
   resolution status agree across views; response **shape** need not. (Connects to
   [ADR-0012](./0012-app-scoped-entra-identity.md): the same resource under different authz may
   resolve a different set of Sources — that is correct, not drift.)

4. **Split the surface by READ-FACE, not by consumer.** Three faces:
   - **Resource Context Read** — one resource's live-resolved content (`getResourceContext`).
     Consumed by the Agent and (if [ADR-0015](./0015-portal-resource-first-ia.md) is adopted)
     the Portal resource page.
   - **Registry / Explore Read** — cross-resource query / index / aggregate over Atlas's *own*
     registry (`searchResources`, catalog list, availability matrix, guidance index, source
     browser). Consumed heavily by Portal; by the Agent only for discovery.
   - **Management / Admin** — mutate / configure / diagnose (source & anchor edit, bindings,
     resolution diagnostics). Portal only.

   These **three conceptual faces map to two OpenAPI documents** — do **not** build three API
   namespaces: root `/openapi.json` = a curated subset of Context Read + Discovery Read;
   `/api/internal/openapi.json` = Registry/Explore Read + Management. Component schemas stay
   **generated** from shared `@atlas/schema` zod.

5. **Do not materialize a shared `ResolutionBatch` / `ResolvedSourceResult` type yet (YAGNI).**
   The two assemblers work without one. Introduce a shared intermediate only when a consumer
   (a Portal resource page, ADR-0015) or the consistency test actually needs to *extract* the
   atomic result. Until then, guard the invariant with a review rule + golden tests: each
   assembler consumes resolver output verbatim (no re-resolution, no status reinterpretation,
   no re-ordering of facts).

6. **Concept line to keep, dropping the rest of "Projection-as-subsystem":**
   > Agent API presents an agent-oriented view over the same live source-resolution pipeline
   > and canonical resolution records used by Portal read surfaces.

   Not "the same `ResolvedResourceContext`" — Portal does not consume that type today, and these
   invariants do not require it to.

## Considered and rejected

- **One canonical *assembled* result (a single `ResolvedResourceContext` that Portal and Agent
  both serialize).** Rejected: over-unifies. It silently promotes a Portal IA migration from a
  *product choice* to an *architectural requirement*, while the resolution engine is already
  shared — so the win is illusory and the cost (Portal IA migration) is real. Whether Portal
  *should* adopt the Resource/Section model is a separate, deferred product decision
  ([ADR-0015](./0015-portal-resource-first-ia.md), proposed).
- **Keep "Projection" as the domain term.** Rejected: contradicts 0013's live decision by
  connotation and invites the materialized-view entities 0013 forbids.
- **Boundary as Portal-API vs Agent-API.** Rejected: implies a second parallel business API.
  The honest axis is read-face — which Portal spans (all three) and the Agent subsets (Context +
  a little Discovery).
- **A new `packages/` split (`context-core` / `agent-api` / `portal-api`).** Rejected as
  premature: the monorepo already has `context-layer` core + `@atlas/schema` + `portal`; the
  shared schema and service already meet the goal.

## Consequences

- The rename + these invariants (plans/013 "013a") are contract-neutral and can land now.
- The boundary documentation (plans/013 "013b") records the three read-faces → two OpenAPI
  docs, tags each existing capability to a face, and marks `searchResources` as a Discovery
  read.
- **Consistency tests compare the atomic batch** (`sourceId` / `anchorId` / fragment hash /
  citations / warning codes / status), then golden-test each assembler separately — never
  whole-response equality (the groupings differ by design).
- **"availability" has two referents** — a per-resource Section (Resource Context Read) and the
  cross-resource matrix (Registry/Explore Read). They share one system of record (the governed
  `availability-matrix` Source, [ADR-0009](./0009-availability-matrix-resolver.md)), so they
  agree on facts by construction. Retiring `portal/src/api/server/availability.ts` is a
  Registry/Explore-read swap gated on governed-matrix **data coverage**, decoupled from this ADR.
- **Whether Portal adopts the Resource/Section model is explicitly out of scope here.** These
  invariants neither require nor forbid it; that decision is [ADR-0015](./0015-portal-resource-first-ia.md)
  (proposed, post-MVP).
