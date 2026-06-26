# Post-MVP: Portal becomes Resource-first — Topic demotes to a filter/attribute, nested inside the ADR-0012 APP scope, shipped as one IA migration

Status: proposed
Date: 2026-06-26

> Builds on [ADR-0014](./0014-resource-read-one-core-many-views.md) (which keeps Portal's read
> *free* to stay topic-centric) and **revises** [ADR-0012](./0012-app-scoped-entra-identity.md)
> §5. Execution detail lives in `plans/013` ("Converged c-2 target model"); this ADR records the
> decision and the 0012 §5 revision.

## Context

ADR-0014 establishes that consistency requires a shared *atomic* result, **not** a shared
response shape — so Portal staying topic-centric is architecturally fine indefinitely. That
leaves an open **product** question: should Portal's human information architecture become
Resource-first?

- Today Portal is **topic-centric**: `catalog/$topicId`, source-grouped via `buildContextBundle`;
  navigation is Topic / Source. The agent surface is **resource-centric**: `getResourceContext`,
  section-grouped, addressed as `{kind}/{slug}`.
- [ADR-0012](./0012-app-scoped-entra-identity.md) (proposed) sets a post-MVP "my APP" entry —
  login → pick APP → surfaces filtered by `app_id` — and its §5 assumed the **existing
  topic-centric surfaces are reused** behind that filter.
- Grounding (verified): `topics.yaml` ↔ `resources.yaml` is **not 1:1**. Concrete services map
  ~1:1 (`aws-textract` ↔ `service/aws/textract`), but cross-cutting *areas/concepts*
  (`private-networking`, `s3-guardrails`, `serverless-compute`) have **no** `{kind}/{slug}`
  address — they are editorial groupings, not resolution objects.

## Decision (proposed)

1. **Resource is the primary content object.** The per-thing content page is keyed by
   `{kind}/{slug}`, section-grouped, served by `getResourceContext`. This page is **not new** —
   it is `catalog/$topicId` **migrated** (re-keyed `topic-id` → `{kind}/{slug}`; re-grouped by
   Source → by Section; re-pathed `buildContextBundle` → `getResourceContext`). `sources/$sourceId`
   **stays** — a Source is a different object (the provenance behind sections).

2. **Topic demotes to a filter/attribute — not an API layer.**
   - an attribute on resource records (`resources.yaml` gains `topics: [...]`);
   - a query param over the resource listing (`GET /api/resources?topic=private-networking`) +
     a response field — not a collection of its own;
   - thin labeled metadata only (`{id, name, description?}`) for theme-index pages; **no**
     resolved content and **no** content endpoint.
   - ⇒ `/topics/{id}/context` retires; `source-topic-mappings.yaml`'s content role collapses
     into `resources.yaml` (resource → section → source becomes the single content spine);
     Portal migrates off `/topics`. Cross-cutting areas survive as **theme facets, not pages**.

3. **APP-scope (ADR-0012) is the OUTER layer; Resource is the INNER object; Topic is a facet
   within.** "Login → pick APP → that APP's resources, theme-faceted." APP is *scope* (a Source
   `visibility` / authz filter, ADR-0012 §1); Resource is the *object*; Topic is a *facet*.
   Three levels, no conflict.

4. **Ship this and the ADR-0012 APP migration as ONE post-MVP "my APP's resources" IA effort.**
   Because APP nests outside Resource (decision 3), doing them separately would rewrite the same
   surfaces (catalog / guidance / availability) twice. This **revises ADR-0012 §5**: "reuse
   existing (topic-centric) surfaces" → "reuse the Source→Citation machine; the surfaces become
   resource-first." (0012 is still *proposed*, so the reconciliation is cheap.)

## Considered and rejected

- **Keep Portal topic-centric forever (Resource stays agent-only).** Architecturally fine per
  ADR-0014 — this is the **default if this ADR is not adopted**. Rejected as the *target*
  because theme/area browse is better served as facets over canonical Resource objects than as
  parallel topic pages, and a single object model removes the Topic↔Resource content
  duplication.
- **Topic and Resource as two coequal nav modes.** Rejected: re-introduces two parallel
  surfaces with M:N content drift.
- **Promote areas into a resource kind (`area/private-networking`).** Rejected: pushes editorial
  groupings into the resolution model — an "area" would have to declare which Sources it
  resolves, re-creating governance the facet model avoids.
- **Resource-first as the global entry, APP as a mere facet.** Rejected: contradicts ADR-0012's
  APP-selector-first entry shape.

## Consequences

- **Deferred behind the MVP done-bar** (grounded adoption journey); **not** a prerequisite for
  Agent-API correctness (ADR-0014). The only now-items remain plans/013 "013a + 013b".
- **Touches the 011 §26 freeze** (it changes existing Portal context-API calls) → requires its
  own implementation plan + a blind-loop reverify.
- **`/topics/{id}/context` retires** and `source-topic-mappings.yaml` loses its content role —
  both are migration steps, not now-changes.
- **ADR-0012 §5 to be amended** ("reuse existing surfaces" → "surfaces become resource-first")
  when this ADR is accepted.
- If this ADR is **not** adopted, nothing is lost: ADR-0014 already lets Agent and Portal share
  the resolution core while keeping their own assemblers indefinitely.
