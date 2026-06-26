# 014 — Availability single-source (handoff goal prompt)

> Executable handoff. Elaborates plan 013's deferred "retire `availability.ts`" item
> into one focused task. Decision + design are settled (see below); a fresh agent
> should be able to execute this cold. Public-safe, fake-data-only repo rules apply.

## Goal

Make platform **availability** a single source of record read through the Context
Layer by **all three consumers** — the agent resource `availability` section, the MCP
`atlas_get_availability` tool, and the Portal Explore map/matrix — so they can never
diverge. Today there are TWO parallel implementations; collapse to one read path.

**Done-bar:** there is exactly one availability read in the Context Layer. Portal,
MCP, and the agent resource section all consume it. `portal/src/api/server/availability.ts`
no longer holds a second, ungoverned copy of availability facts. All existing tests
green; the Portal Explore map still renders the same data; the MCP availability result
carries a citation.

## The decision (settled — do NOT re-litigate)

- **Scope = A (full single-source incl. Portal).** All consumers read the one Context
  Layer availability read.
- **Do NOT migrate the fake data into a governed markdown table.** This is the key
  constraint. Treat the existing fixture data as the **dev-mock return of the one
  read** — exactly the pattern `availability.ts` already uses (`if (import.meta.env.DEV)
  await sleep(2000); return availabilityProjection;` — dev-latency + fixture). The
  unified read's DEV impl returns the (relocated) fixture with simulated latency; its
  PROD impl live-fetches Confluence at the same boundary. Single-source comes from
  *everyone calling the one read*, not from where the bytes are authored.
- **Presentation vs facts:** location coordinates/labels/kind and service iconKey/domain
  are presentation, not governance facts. They may ride along in the dev-mock return
  (it's all one `AvailabilityResponse`) and, in prod, stay a Portal-side static lookup
  merged with live facts. Pick the simplest split that keeps the `AvailabilityResponse`
  wire shape stable for consumers.

## Current state (the dual source to collapse)

1. **Governed path (the Atlas way) — agent resource `availability` section.**
   - `context-layer/src/resolvers/availabilityMatrixResolver.ts` (ADR-0009) parses a
     governed `availability-matrix` Source and returns a cell/row **as excerpt text**.
   - Source content: `context-layer/src/sourceContent/pilotSourceContent.ts` →
     `"availability-matrix"` (a tiny markdown table: 3 services × 2 regions).
   - Source/anchor records: `data/sources.yaml` (`id: availability-matrix`),
     `data/anchors.yaml` (`availability-textract-row` etc.), binding in
     `data/resources.yaml` (textract `availability` section).
   - Live in prod: `terraformModule`/`confluence` resolvers already show the
     token-gated live-fetch pattern; availability would follow the same boundary.

2. **Standalone fixture (the leftover) — Portal Explore + MCP.**
   - `portal/src/api/server/availability.ts`: `fetchAvailability` (server fn, dev-latency
     + fixture) and `availabilityProjection` (const). ~65 AWS + ~56 Azure fake services,
     locations with coordinates/outposts, statuses available/planned/interim/not-planned
     + ETA notes. Types: `AvailabilityResponse`, `AvailabilityRecord`, `Location`,
     `LocationStatus`, `LandingZoneId`. **Does NOT go through the Context Layer; no
     citation.** Its own comment: "The real adapter live-fetches + parses a Confluence
     page (slow). This mock is instant."
   - Consumed by: MCP `portal/src/api/server/mcp/tools.ts` (`atlas_get_availability`
     imports `availabilityProjection`); Portal via `portal/src/api/queries.ts`
     (`availabilityQueryOptions` → `fetchAvailability`).

3. **Consumers are insulated by the `AvailabilityResponse` shape** — keep that shape
   stable and they don't change. They are: routes `index.tsx`, `catalog.index.tsx`,
   `catalog.$topicId.tsx`, `availability.index.tsx`; components `catalog/data.ts`,
   `catalog/adopted.tsx`, and the whole `components/explore/*` suite (`matrix-view`,
   `region-map`, `world-geo`, `region-detail`, `service-icon`); `lib/availability-service.ts`
   (`findAvailabilityServiceForTopic`).

## Target architecture

```
            ONE availability read (Context Layer)
        dev → returns relocated fixture (+ dev-latency)
        prod → live-fetches Confluence (same boundary)
                          │  structured grid + citation/warnings
        ┌─────────────────┼──────────────────────┐
   agent resource     MCP atlas_get_         Portal fetchAvailability
   `availability`     availability           (merges facts + Portal-side
   section (one row)  (whole grid)            presentation → AvailabilityResponse)
```

- Add a Context Layer availability read returning the structured grid (zones →
  services → {location → status/note}) with a citation, exposed via the Context API
  router (`context-layer/src/api/httpRoute.ts`) as a Registry/Explore read, reachable
  from Portal through the existing bridge (`portal/src/api/server/contextApiBridge.ts`).
- Relocate the fixture data to be that read's DEV-MOCK content (Context Layer side).
  `availability.ts`'s standalone `availabilityProjection` is retired; presentation
  metadata (coords/icons) becomes a Portal-side static lookup if not carried in the
  read's return.
- Repoint MCP `atlas_get_availability` and Portal `fetchAvailability` at the read.
- Reconcile the agent resource `availability` section so its row resolves from the
  SAME facts (one source content feeding both the row-resolver and the grid read);
  keep its excerpt/citation contract.

## Steps (suggested)

1. Context Layer: define the structured availability data + a `readAvailability()`
   (dev-mock = relocated fixture, prod-live boundary stubbed like the TF/Confluence
   resolvers) returning grid + citation; wire a router route.
2. MCP: repoint `atlas_get_availability` at the read (now cited).
3. Portal: `fetchAvailability` calls the read via the bridge; merge with Portal-side
   presentation to keep the `AvailabilityResponse` shape byte-stable for consumers.
4. Agent resource section: source its availability row from the same data.
5. Retire `availability.ts`'s standalone data; keep only presentation if needed.
6. Tests: extend availability resolver/route tests; assert MCP availability carries a
   citation; assert Portal `AvailabilityResponse` shape unchanged; existing Explore +
   `availability-service` tests stay green.

## Constraints / gotchas

- **Two clouds** (AWS + Azure) with different locations — the structured shape must
  carry both zones (the current governed markdown table is AWS-only). Don't force one
  flat table.
- **Keep `AvailabilityResponse` wire shape stable** — ~8 consumers + the `explore/*`
  suite depend on it. This is what makes A tractable.
- **Public-safe, fake-data-only** (repo rule). The relocated fixture stays fictional;
  the prod live-fetch is a boundary/TODO, not real company data.
- Refs: ADR-0009 (availability matrix resolver), ADR-0014 (one core, many views),
  plan 013 (where this was deferred — "retirement gated on data coverage" is dissolved
  by the dev-mock-return design: coverage is just what the mock returns).
- The agent resource section currently reads a markdown *row*; the new grid read is
  structured. Both must read ONE underlying dataset — don't fork the data again.
