# Convention-driven Confluence reference discovery: the service inventory is the Resource spine, references enter Atlas but their bodies do not

Status: accepted — build-ready spec locked 2026-06-28 (12 seam decisions in `plans/017`)
Date: 2026-06-27 (proposed) · 2026-06-28 (accepted after a seam-grilling pass)

> Implements `plans/017`. Builds on [ADR-0013](./0013-resource-projection-not-materialization.md)
> (Resource is a live projection; Source is the system of record) and
> [ADR-0015](./0015-portal-resource-first-ia.md) (`{kind}/{slug}` addressing; the `service`-kind
> slug folds in `provider`). It does **not** touch the governed Registry / `SourceContentProvider`
> ports from `plans/016`; it adds a **new** narrow port. Per `seed-dev-adapter-principle` the design
> target is the real-environment live fetch — `data/*.yaml` is a dev mock, never the standard.

## Context

The platform documents each service in Confluence, but Atlas's governed Registry only knows the
handful of Sources that have been hand-curated with governance metadata + anchors. We want the
agent- and human-facing Resource surface to **auto-discover** the Confluence pages that document
every service, with **zero per-service / per-page / per-section configuration** — and to do so
**honestly**: a discovered link is *reference-only*, its body is **not** readable by a blind agent
(Confluence needs the user's own credentials).

Three things the prior `plans/017` draft assumed turned out not to exist in code as described, which
is what this ADR pins down:

- The "availability service inventory" was named as the spine of *which services exist*, but the
  `AvailabilityProvider` port exposed only `getZones()`, and `AvailabilityRecord` carries no
  `provider`. There was no enumeration to iterate and no provider to key on.
- "Resource detail merges governed Sources + references" assumed the Resource exists. But the read
  (`getResourceContext`) is keyed off `data/resources.yaml` records and 404s when none is found —
  and almost no service has a record. So discovery for an un-curated service had nowhere to land.
- `data/resources.yaml` was called a "new optional overlay," but it *is* the existing
  projection-record file; the join key between an inventory service and an overlay record was
  undefined.

## Decision (accepted)

1. **The service inventory is the Resource spine; identity is `{provider}/{id}`.** For
   `kind: service`, the **governed availability-matrix**'s service rows establish Resource
   **existence** and **canonical identity**. `AvailabilityProvider` gains `listServices():
   ServiceIdentity[]` sourced from the **governed-matrix scope** (the anchor-pinned, cited subset
   that `availabilityMatrixResolver`/`parseMarkdownMatrix` already produces in prod) — **not** a
   flatten of `getZones()`, whose full AWS+Azure presentation grid is unrelated to the spine (and
   whose prod live-fetch is a separate plan-014 TODO). **Discovery iterates EVERY service the
   enumeration returns — count is data, not a design knob.** The dev fixture happens to return 3
   (`MATRIX_ROWS` = s3/api-gateway/textract); a prod availability source may list tens or hundreds,
   and the code (a `for each` over `listServices()`, no inlined count) covers all of them with zero
   per-service config. The canonical key is `{provider}/{id}` — identical to the `service`-kind
   `{kind}/{slug}` of ADR-0015 — produced from the spine tuple **alone**. `provider` is the
   governed matrix's single-zone scope (a **config attribute of the matrix Source**, dev `aws`;
   the serialized matrix markdown carries no provider column), never parsed from page prose;
   multi-cloud = multiple governed matrices, one provider each.

2. **A reference entering Atlas is not its body entering Atlas.** Discovery yields
   `DiscoveredReference[]` — reference-only, categorized by `doc_type` (`design | user-guide |
   policy`), each carrying `content_mode: "reference_only"`, `access_mode: "service_credentials"`,
   `agent_accessible: false`. It populates **no** governed Source, relaxes **no** Registry schema,
   and implements **no** `SourceContentProvider`. A reference may later be **promoted** into a
   governed Source only with governance metadata + bindings (out of scope).

3. **Spine-only Resources are first-class: Identity ⊕ optional Governed Overlay.** `resources.yaml`
   no longer decides whether a service Resource exists — it is an **optional overlay** of governance
   metadata + Section bindings. `getResourceContext` is identity-first:
   - identity from `listServices()` where `identity.key === slug`;
   - overlay present → `governance: "configured"`, resolve Sections as today;
   - identity present, overlay absent → `governance: "unconfigured"`, empty Sections, **not a 404
     and not a faked resolver failure** — an honest "governed content not yet configured";
   - neither (service kind) → genuine 404;
   - non-service kinds → unchanged (overlay is their identity, no discovery).
   The response gains a top-level flat `references: DiscoveredReference[]` (each carries its
   `doc_type`; the schema does not pre-bucket) and the resource-level `governance` field.

4. **Double-hit admission with tiered aliases — recall is wide, admission is strict.** CQL
   (`title ~ "<alias>"`, v1 `GET /wiki/rest/api/content/search`, scoped by space + `type = page`)
   is used **only for wide recall**. A candidate enters the reference list **iff** both hit:
   - **identity hit** — after normalizing the title (lowercase + separator-normalized), it contains
     a **complete `admissionAlias` token-sequence** (not a `\b` substring regex);
   - **doc-type hit** — the normalized title matches a **global typed** doc-type pattern map (not
     per-space); on multiple hits the longest/most-specific pattern wins, tie-break
     `policy > user-guide > design`.
   Aliases are **tiered**: the bare machine slug is **recall-eligible only**; admission accepts
   **only stable human product names + explicit abbreviations**. Non-matching candidates go to
   **discovery diagnostics** (a structured count/log, never a user surface, never an `other`
   bucket). Title rules are the deterministic Preview-phase mechanism; Confluence labels / explicit
   metadata are the stronger future signal.

5. **In-process, per-Resource-key last-good cache with SWR — honest staleness, no new infra.** Each
   `identity.key` is an independent query + cache unit: fresh TTL **1h**; stale-past-TTL → serve
   stale + single-flight refresh; refresh failure → keep last-good + expose `last_observed_at` +
   `status: "stale"`; past max-staleness **24h** → `status: "unavailable"` (never unbounded stale);
   cold start + fetch failure → honest gap. Per-service recall cap **50** → `incomplete: true` +
   log on truncation (no silent cap). Discovery is **triggered on demand by the resource-detail
   read**; the list page never enumerates; warmup, if any, uses bounded concurrency. Runs in the
   existing ECS service; creds from Secrets Manager via the task role.

## Why not the alternatives

- **Provider parsed from the page / a separate `ServiceInventoryProvider` port** — rejected:
  provider is metadata about the matrix, not a cell, and a second port over the same matrix invites
  two-source drift. One port, one source of "which services exist."
- **References only on services that already have a `resources.yaml` record** — rejected: it caps
  discovery to the curated handful and makes adding a service require a hand-authored stub, breaking
  the O(1) promise. Spine-only Resources are the whole point.
- **Trusting CQL recall as the identity signal / pre-bucketing references by `doc_type` in the
  schema** — rejected: CQL `title ~` is fuzzy/substring, so admission needs a strict client re-check;
  and baking the three doc-types into the wire contradicts "the title convention is an admission
  filter, not a data model."
- **A cross-instance cache / external store** — out of scope: the in-process last-good cache with
  SWR + single-flight is enough for Preview and adds no infra.

## Consequences

- **New types in `@atlas/schema`:** `ServiceIdentity` (`provider,id,name,key,recallAliases[],
  admissionAliases[]`) and `DiscoveredReference`; `ResourceContextResponse` gains `references[]` +
  `governance`. The governed `SourceSchema` stays strict and reference-unaware.
- **New port** `ResourceReferenceDiscovery` (context-layer); `AvailabilityProvider` gains
  `listServices()`; a `ServiceIdentityNormalizer` derives keys + tiered aliases.
  `getResourceContext` / `ResourceContextDeps` become identity-first and thread the new port.
- **Composition** defaults to `createDevReferenceDiscovery()` (in-code fixture, offline, never reads
  yaml); prod swaps `createConfluenceReferenceDiscovery(config)` using the existing
  `ConfluenceLiveConfig` + injectable `FetchLike`, adding the net-new CQL search call.
- **Honesty guarantees hold:** every reference is `reference_only` + `agent_accessible:false`;
  misses → honest gap/diagnostics, never fabricated; cache failure surfaces staleness/`unavailable`,
  never a silent stale link list.
- **Out of scope / later:** reference→Source promotion; generic Confluence body parsing/citation;
  TFE-registry / Git auto-discovery (resolved content stays governed); label-based discovery; Azure
  / multi-cloud (the spine grows as services enter the governed inventory).

Execution detail and the 12 numbered seam decisions: `plans/017-live-confluence-discovery.md`
(§Build-ready specification).
