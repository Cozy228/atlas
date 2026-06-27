# Post-MVP: Portal becomes Resource-first — Topic resolves to Resource / Facet / Decompose, addresses unify on `{kind}/{slug}`, shipped as an independent IA migration with an APP-scope seam reserved

Status: accepted — MVP done-bar reached 2026-06-27; cleared for execution
Date: 2026-06-26 (proposed) · 2026-06-27 (accepted after a grilling pass)

> Builds on [ADR-0014](./0014-resource-read-one-core-many-views.md) (which keeps Portal's read
> *free* to stay topic-centric) and **revises** two earlier decisions:
> [ADR-0012](./0012-app-scoped-entra-identity.md) §5 (sequencing) and
> [ADR-0013](./0013-resource-projection-not-materialization.md)'s external addressing
> (`{provider}/{resource}` → `{kind}/{slug}`). A 2026-06-27 grilling pass resolved the open
> sub-questions (promotion rule, metadata home, facet content, addressing, sequencing); execution
> detail lives in `plans/013` ("Converged c-2 target model"). This ADR records the decision and
> the 0012/0013 revisions.

## Context

ADR-0014 establishes that consistency requires a shared *atomic* result, **not** a shared
response shape — so Portal staying topic-centric is architecturally fine indefinitely. That left
an open **product** question, now decided **yes**: Portal's human information architecture becomes
Resource-first.

- Today Portal is **topic-centric**: `catalog/$topicId`, source-grouped via `buildContextBundle`;
  navigation is Topic / Source. The agent surface is **resource-centric**: `getResourceContext`,
  section-grouped, addressed as `{kind}/{slug}`.
- [ADR-0012](./0012-app-scoped-entra-identity.md) (proposed) sets a post-MVP "my APP" entry —
  login → pick APP → surfaces filtered by `app_id` — and its §5 assumed the existing
  topic-centric surfaces are reused behind that filter.
- Grounding (verified): `topics.yaml` ↔ `resources.yaml` is **not 1:1**, and the gap is
  **three-way**, not two-way. Concrete services map ~1:1 (`aws-textract` ↔ `service/aws/textract`).
  Some Topics are cross-cutting *views* that only aggregate other Resources' Sections
  (`private-networking`, `logging-monitoring`) and own no content. And some Topics are *umbrella
  sets* (`serverless-compute`, `s3-guardrails`) that must be **decomposed**: the umbrella becomes a
  view while the real things under it (Lambda; a specific guardrail) split out as their own
  addresses. (An earlier draft mislabeled `serverless-compute` a flat "editorial grouping" — by the
  rule below it is a Decompose, not a bare Facet.)

## Decision (accepted)

1. **Resource is the primary content object, addressed `{kind}/{slug}`.** The per-thing content
   page is keyed by `{kind}/{slug}`, section-grouped, served by `getResourceContext`. This page is
   `catalog/$topicId` **migrated** (re-keyed `topic-id` → `{kind}/{slug}`; re-grouped Source →
   Section; re-pathed `buildContextBundle` → `getResourceContext`). `sources/$sourceId` **stays**
   (a Source is a different object). A Resource record owns **both** its Section→Source/Anchor
   bindings **and** its identity/presentation metadata (owner, support channel, status, category,
   version, entry tools): the metadata that today lives on the Topic moves onto the Resource;
   `getResourceContext` stays content-only and the page composes record-metadata + resolved
   content. (Consistent with [ADR-0013](./0013-resource-projection-not-materialization.md) §2 —
   Atlas durably stores identity + bindings + presentation metadata, never resolved content.)

2. **The promotion rule (three-way), not a list of examples.** A Topic resolves to exactly one
   disposition by a structural test. A Topic is a **Resource** iff *all* hold: (a) stable unique
   identity expressible as `{kind}/{slug}`; (b) an independent lifecycle (owner, status, version,
   deprecation, scope); (c) every Section describes the **same** object; (d) an authoritative
   Source describes *that object itself*, not mainly an aggregate of others. Otherwise:
   - **Facet** — a cross-cutting view/label that aggregates others' Sections
     (`private-networking`, `logging-monitoring`).
   - **Decompose** — an umbrella *set* (`serverless-compute`, `s3-guardrails`): the Topic demotes
     to a Facet **and** its real Resources are split out (Lambda; a specific guardrail).

   Worked dispositions: `aws-textract`, `central-landing-zone` → Resource; `private-networking`,
   `logging-monitoring` → Facet; `serverless-compute`, `s3-guardrails` → Decompose; `iam-boundary`
   → Resource iff it is one concretely-governed guardrail, else Facet.

3. **Topic demotes to a Facet/attribute — not an API layer.**
   - an attribute on resource records (`resources.yaml` gains `topics: [...]`);
   - a query param over the resource listing (`GET /api/resources?topic=private-networking`) + a
     response field — not a collection of its own;
   - thin labeled metadata only (`{id, name, description?}`) for theme-index pages.
   - A **Facet page** = a filtered Resource list **plus** an optional aggregate view of its
     members' Sections. That aggregate keeps each member's **Resource boundary and Citations** (an
     ADR-0014 §2 *deterministic view over the atomic result* — it re-resolves nothing and forms no
     Facet-owned content), and is orchestrated **server-side with bounded concurrency** (Portal
     server / internal assembler), never an unbounded browser N+1. There is **no** Facet content
     endpoint and **no** second content model coequal with Resource.
   - ⇒ `/topics/{id}/context` retires; `source-topic-mappings.yaml`'s content role collapses into
     `resources.yaml` (resource → section → source is the single content spine); Portal migrates
     off `/topics`.

4. **Addresses unify on `{kind}/{slug}` for human and agent alike.** One canonical public address
   per Resource: Portal `/{kind}/{slug}` and Agent `/api/resources/{kind}/{slug}` +
   `/resources/{kind}/{slug}.md`. This **revises ADR-0013**'s `{provider}/{resource}` examples:
   `provider` folds into the `service`-kind slug (`slug = aws/textract`), and provider-less kinds
   (`guardrail/s3-public-access`) get a working address they lacked. Old `/catalog/$topicId` URLs
   301 by disposition: Resource → its new address; Facet → its filtered listing; Decompose → the
   Facet page that lists the split-out Resources.

5. **APP-scope (ADR-0012) is an OUTER layer reserved, not bundled.** "Login → pick APP → that
   APP's resources, theme-faceted." APP is *scope* (a Source `visibility`/authz filter, ADR-0012
   §1); Resource is the *object*; Topic-as-Facet is a *view*. This ADR ships **independently**
   (global entry, no APP filter) but is **architecturally reserved** for APP scope: the
   Registry/Explore read carries an optional visibility/scope injection point defaulting to a
   global-visible no-op; the APP entry later arrives as an **outer route wrapper** (`/app/{id}/…`);
   and `{kind}/{slug}` deliberately **excludes** `app_id` (APP filters, it does not address).
   Layering APP later is *inserting the reserved seam*, not rewriting the IA. This **revises
   ADR-0012 §5** ("reuse existing topic-centric surfaces" → "reuse the Source→Citation machine; the
   surfaces become resource-first") and **reverses this ADR's own earlier decision 4** ("ship 0015
   + the APP migration as ONE effort"): decisions 1–4 reference no `app_id`, so coupling two
   still-*proposed* decisions only lets one block the other.

## Considered and rejected

- **Keep Portal topic-centric forever (Resource stays agent-only).** Architecturally fine per
  ADR-0014 — the default if this ADR were not adopted. Rejected as the *target*: theme/area browse
  is better as facets over canonical Resources than as parallel topic pages, and one object model
  removes the Topic↔Resource content duplication.
- **Promote a Topic by `topic_type`.** Rejected: type ≠ "is it a real thing." It mislabels
  `serverless-compute` (a service-typed umbrella) and `private-networking` (a security-policy-typed
  view). The structural four-part test (decision 2) is the honest predicate.
- **Promote every Topic to a Resource (areas become `area/…` kinds).** Rejected: pushes editorial
  groupings into the resolution model — an "area" would have to declare which Sources it resolves,
  re-creating governance the Facet model avoids.
- **Two addressing schemes (Portal `{kind}/{slug}`, Agent `{provider}/{resource}`).** Rejected:
  two canonical addresses per thing, and `{provider}/{resource}` still breaks for provider-less
  kinds like `guardrail`.
- **Bundle 0015 + the ADR-0012 APP migration into one effort.** Rejected (reverses the original
  decision 4): couples two proposed post-MVP decisions and lets 0012 block 0015, for a "rewrite the
  surfaces twice" cost that is overstated — adding a scope *filter* over a finished resource-first
  IA is not a second IA rewrite.
- **Topic and Resource as two coequal nav modes.** Rejected: re-introduces parallel surfaces with
  M:N content drift.
- **Resource-first as the global entry, APP a mere facet.** Rejected: contradicts ADR-0012's
  APP-selector-first entry shape; APP is scope reserved as an outer layer (decision 5).

## Consequences

- **Cleared for execution.** The MVP done-bar (grounded adoption journey) was reached 2026-06-27,
  releasing the only gate; this was never a prerequisite for Agent-API correctness (ADR-0014). 0015
  still **requires its own implementation plan** (none exists yet) before code moves.
- **Touches the 011 §26 freeze twice**: it changes existing Portal context-API calls *and* the
  external `{provider}/{resource}` → `{kind}/{slug}` addressing → its own implementation plan + a
  blind-loop reverify.
- **`/topics/{id}/context` retires** and `source-topic-mappings.yaml` loses its content role; the
  Topic → Resource/Facet/Decompose split is a data-authoring step (umbrella Topics gain their
  split-out Resource records).
- **Facet pages add a server-side bounded-concurrency aggregator** over `getResourceContext`; it
  must re-resolve nothing and preserve per-Resource Citations (golden-tested as an ADR-0014 §2
  view).
- **ADR-0012 §5 amendment pending** its acceptance; **ADR-0013 addressing** is revised here (a
  pointer is added at 0013's head).
- If reverted, nothing is lost: ADR-0014 already lets Agent and Portal share the resolution core
  while keeping their own assemblers indefinitely.
