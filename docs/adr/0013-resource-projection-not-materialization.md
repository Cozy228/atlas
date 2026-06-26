# Resource is a live projection, not a materialized document: Source stays the system of record

Status: accepted
Date: 2026-06-26

> Refined by [ADR-0014](./0014-resource-read-one-core-many-views.md): retires the *Projection*
> term at the code/naming layer and reframes the read surface by face (Context / Explore /
> Management). The α live-not-materialized decision below is unchanged.

## Context

The Agent discovery / API redesign
([proposal](../atlas-agent-discovery-and-api-redesign-proposal.md)) introduces an
external, resource-centric surface for blind agents:

- `GET /api/resources/{provider}/{resource}` — structured context grouped by Section;
- `GET /resources/{provider}/{resource}.md` — a machine-readable Markdown view;
- coarse Sections (`network`, `availability`, …) instead of internal Topic/Context.

This is the right external shape. But an early draft described it as Atlas
"pre-assembling a complete resource document" per resource and serving a "static
`.md`", with a response model that carried `content` records and a `generatedAt`
timestamp. That phrasing quietly changes what Atlas *is*.

Two models were implicit:

- **α — Live resource projection.** External Source remains the system of record.
  Atlas stores only the metadata needed to construct a projection (identity,
  Section→Source/Anchor mappings, resolver config, ordering), and resolves content
  live on each request.
- **β — Durable resource materialization.** Atlas stores curated/resolved Section
  bodies so agent reads are a simple lookup — i.e. Atlas becomes a content system of
  record / CMS.

β contradicts the accepted posture: Evidence flows through the Context API with a
Citation ([ADR-0003](./0003-evidence-vs-live-status-split.md)); the governed-honesty
moat ([ADR-0006](./0006-governed-honesty-model.md)) forbids presenting possibly-stale
content as current; and the availability resolver
([ADR-0009](./0009-availability-matrix-resolver.md) §1, §4) already mandates that the
lazy-TTL cache is "a performance optimization only — never a resilience fallback" and
that a parse/fetch failure returns "no data plus a warning" and "never a stale cached
matrix". A resource-level materialized document would reintroduce, at a coarser grain,
exactly the stale-as-current failure those decisions reject.

## Decision

**Atlas Resource and Section endpoints are live projections of external Sources.
Select α; reject β.**

1. **Source is the system of record.** Atlas does not durably store resolved excerpts,
   mirrored source bodies, pre-assembled Resource documents, or stale fallback copies.

2. **Atlas durably stores only projection metadata.** Per Resource: canonical identity
   and aliases; a **Section Projection Plan** mapping each Section to Source/Anchor
   references, resolver id, and ordering; freshness/drift configuration; presentation
   metadata. Section *content* lives only in the Source.

3. **Representation endpoints, not artifacts.** `GET /api/resources/{p}/{r}` and
   `GET /resources/{p}/{r}.md` are dynamic representations. A stable `.md` URL means the
   address and document *structure* are stable — not that a Markdown file is stored.
   Each request: load the Projection Plan → live-resolve referenced Sources/Anchors →
   aggregate successes by Section → return Citations, per-Section status, and warnings
   → on failure, never fall back to a previously resolved excerpt. The response is
   stamped `resolvedAt` (a resolution time), not `generatedAt` (a build time).

4. **Two orthogonal axes, reusing existing vocabulary.** A Section carries a resolution
   `status` (`available` / `partial` / `unresolved`) and a list of `warnings` /
   `missingSections[].code` drawn from the existing `@atlas/schema` `warningCodes`
   (`no_registered_source`, `source_unavailable`, `broken_anchor`, `stale_source`,
   `availability_unavailable`, …). No parallel status vocabulary is invented. A negative
   ("unsupported") conclusion is only valid as source-backed evidence inside a resolved
   Section's `content`; it is never a bare status code. Missing or failed ≠ negative.

5. **Cache stays a within-TTL optimization** (ADR-0009 §1). The source-content cache may
   accelerate live resolution but is never a resilience fallback and never serves stale
   content when resolution fails.

6. **Two clocks, kept separate: provenance vs staleness.** The perf cache freezes only the
   *parsed excerpt and its `resolvedAt`* (the moment it was actually parsed from Source); a
   cache hit returns that original `resolvedAt`, never the request time. Freshness/drift
   (`stale_source`) is **not** cached — it is recomputed on every projection from the
   registry's current `review_frequency` / recorded version vs now, independent of cache
   hit/miss. A cache hit can and must still carry a `stale_source` warning. Collapsing the
   two clocks would let the perf-TTL silently swallow a `review_frequency`-triggered
   staleness and let a stale cached value claim it was just resolved — exactly the
   stale-as-current failure ADR-0006/0009 forbid.

## Considered and rejected

- **Durable resource materialization (β).** Simplest agent reads and smallest latency,
  but turns Atlas into a content system of record, invalidates the live-resolution and
  governed-honesty guarantees, and would require explicitly superseding ADR-0003/0006/
  0009. If ever pursued, it must be its own product + architecture decision, not a
  side effect of the discovery redesign.
- **Static build-time `.md` artifacts.** Cacheable and cheap to serve, but a stored
  Markdown file drifts from the Source and re-creates stale-as-current presentation.
- **Per-section materialized excerpts with TTL.** A middle ground, but any persisted
  excerpt that can outlive its Source becomes a stale-fallback temptation; the cache
  already covers the legitimate performance need without authority.

## Consequences

- The proposal's response model uses `citations` + `resolvedAt` + a two-axis
  `status` / `warnings` shape; `generatedAt`, `not_collected`, and a content-bearing
  `Content records` source are removed in favor of `Section Projection Plan` /
  reference records.
- "Complete context" is downgraded to "all registered Sections live-resolved, with
  partial results, missing/failed status, and warnings." Callers must treat a missing
  or failed Section as absence of data, not a negative fact.
- New work is projection-mapping governance (which Sources/Anchors compose which
  Section), not content authoring — Atlas never holds Section bodies.
- `getResourceContext` may return partial results and per-Section warnings; clients and
  the Markdown view must surface resolution state (e.g. a `Resolved at …` header and
  per-Section warnings) rather than imply a complete static document.
