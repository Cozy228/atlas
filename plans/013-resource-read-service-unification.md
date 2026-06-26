# 013 — Unify the resource read into one shared service (Read vs Management), drop "Projection" framing

> Handoff from the plans/011 loop. NOT in the 011 commit. Captures an architectural
> direction the user raised mid-loop; 011 §26 deliberately deferred the Portal side.

## The concern

The 011 agent surface reads, from the outside, like a *second parallel business API*
("Portal API" vs "Agent API") with a "Projection" subsystem flavour. The desired shape
is one shared read service that organises **the same** resolved result into whatever a
caller needs:

```
            Source / Anchor / Resolver         (unchanged — already reused)
                        │
                        ▼
              ResourceContextService           (one read service)
                        │
              ResolvedResourceContext           (one resolved result)
                /                 \
       Portal serializer      Agent serializer
              │                      │
        Portal JSON/UI        Agent JSON / Markdown
```

The real boundary should be **Shared Read API vs Internal Management API**, NOT
Portal-vs-Agent.

## What is already correct (do NOT regress)

- α live projection (ADR-0013): request-time resolution via the existing resolver
  registry + Source/Anchor/contentProvider; **no** stored excerpts, **no** ProjectionStore,
  **no** precompute. `getResourceContext` already reuses the same engine as
  `buildContextBundle`.
- JSON and Markdown are already two serializers of one `ResourceContextResponse`.
- `data/resources.yaml` is the Section→Source/Anchor/order mapping required by 011 §5.2 +
  ADR-0013 §2 (Section granularity does not exist in topics/sources/anchors, so it must be
  declared somewhere). It is declarative config, analogous to `source-topic-mappings.yaml` —
  keep the *data*, reconsider only the *framing/naming*.

## What this follow-up should do

1. **Rename away from "Projection"** so it reads as a read/serialize layer, not a subsystem:
   - `resourceProjectionService.ts` → `resourceContextService.ts`; `getResourceContext`
     stays. Consider `ResolvedResourceContext` as the internal type name; keep the
     wire schema (`ResourceContextResponse`) stable for the agent contract.
   - `ResourceProjectionRecord` → e.g. `ResourceContextRecord` (the `data/resources.yaml`
     row). Mechanical rename across schema + loader + service + openapi import + tests
     (~8–10 files); behaviour-neutral.
2. **Collapse the two read paths**: have the Portal read path (today: `buildContextBundle`
   / topic-centric, source-grouped) and the Agent path (resource-centric, section-grouped)
   both be views over one `ResourceContextService`/`ResolvedResourceContext`, with a Portal
   serializer and an Agent serializer. Today Portal still uses the bundle API unchanged
   (011 §26); this is where the unification lands.
3. **Reframe the boundary** as Shared Read API (consumed by Portal UI + Agent) vs Internal
   Management API (registry edit/ingestion/admin/diagnostics — the internal OpenAPI). The
   011 agent-vs-internal OpenAPI split is a stepping stone, not the final boundary.
4. Pairs naturally with the already-deferred "full-stack single-source availability (A)"
   item (011 §3): retire `portal/src/api/server/availability.ts` once Portal reads the
   shared service.

## Why it is deferred (not done in 011)

011 §26 forbids touching the Portal UI / context-API calls this round, and explicitly
routes the full Portal+Agent unification to a later plan. Doing the rename + path-merge
mid-loop would break green tests and the running blind-agent loop for no behavioural gain.
