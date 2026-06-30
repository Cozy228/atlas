# Availability as a parametric-anchor resolver: query precision mirrors citation granularity

Status: accepted
Date: 2026-06-20

> **Refined post-MVP by [ADR-0017](./0017-landing-zone-discovery-root.md):** this ADR's "zone" is a
> **cloud provider** (`landingZoneIds = ["aws","azure"]` in `@atlas/schema`) — ADR-0017 renames it to a
> real **landing-zone** id (`awsf`/`awsc`/`azure`), demotes `cloud` to an attribute, and reroots
> availability as **LZ-rooted discovery** (the `availability.ts` fixture retirement this ADR foresaw is
> executed in `plans/021` G3). The core resolver decision — parse-once matrix, parametric anchor, no
> stale cache — stands; only the zone vocabulary + the fixture data source change.

## Context

The region×service Availability matrix is named as Evidence
([ADR-0003](./0003-evidence-vs-live-status-split.md)): it must flow through the Context API
with a Citation, reusing freshness/drift, replacing today's Portal-native fixture
projection (`portal/src/api/server/availability.ts`, hand-curated from
`docs/architecture/catalog.md`).

The open contract (MVP-design §13 #2) was the **anchor strategy**. Existing anchors are
one-dimensional — `markdown-heading`, `confluence-section`, `document-clause` — each a
single location in prose. A matrix is two-dimensional (rows = Services, columns = regions,
cells = a status), so "where is the authoritative statement that *S3 is available in
us-east-1*" has no existing anchor shape. We also had no contract for citation granularity,
or for what happens when the source table cannot be parsed.

## Decision

**One parse, a structured matrix, a parametric anchor, and a response whose precision
mirrors the query's.**

1. **Parse once into a structured matrix.** A new resolver parses the governed Confluence
   table into `service × region → status`, cached behind the existing **lazy TTL** (the
   cache is a performance optimization only — MVP-design §5 — never a resilience fallback,
   see point 4).
2. **A new `availability-cell` anchor kind** addresses the matrix parametrically: an
   address may pin a Service, a region, or both. (Added to `anchorStrategies` in
   `@atlas/schema` alongside `markdown-heading`/`confluence-section`/`document-clause`.)
3. **Query precision mirrors citation granularity.** The resolver returns at the grain the
   query pins, and the Citation carries that same grain:
   - Service **and** region pinned (`S3 @ us-east-1`) → **cell**: `Availability Matrix → S3 × us-east-1`.
   - Only Service pinned (`which regions is S3 in`) → **row**: `Availability Matrix → S3 row`.
   - Only region pinned (`what's available in us-east-1`) → **column**: `Availability Matrix → us-east-1 column`.

   A precise question gets a precise answer; a fuzzy question gets a fuzzy answer. This is
   the [[Wayfinding]] / governed-honesty posture applied to granularity.
4. **Honest dead-end on parse failure.** If the live table cannot be fetched or parsed
   (format drift), the bundle returns **no availability data plus a warning**, and **never
   serves a stale cached matrix**. Honesty is preferred over resilience: a stale matrix
   presented as current would be the one thing the moat
   ([ADR-0006](./0006-governed-honesty-model.md)) forbids.

## Considered and rejected

- **Row-level only** (anchor = the Service row): simpler, but cannot cite the precise
  Service×region cell a precise question deserves.
- **Table-level only** (reuse `confluence-section`, return the whole matrix): no new anchor
  kind, but the coarsest grain — "here is the table, figure it out" — fails to prove
  governed citation down to the claim.
- **Stale-cache fallback on parse failure**: more resilient demo, but presents a possibly-
  outdated matrix as current. Rejected on honesty grounds.
- **Partial-cell parse** (return parseable cells, flag the rest): finest degradation, but
  the largest parser surface and partial-state test matrix for marginal MVP value.

## Consequences

- Net-new resolver + `availability-cell` anchor kind; `availability.ts` fixture retires in
  favor of the Context API projection (Evidence + Citation).
- A new resolve-time warning code for the unparseable/unavailable matrix (honest dead-end).
- The lazy-TTL cache remains a within-TTL optimization, explicitly *not* a fallback.
- Region/Service axes are public-safe fixtures (de-branded, see CONTEXT); `us-east-1` /
  `ca-central-1` are public AWS codes and may stay.
