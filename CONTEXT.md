# Atlas Context Layer

Atlas is a governed context layer: it registers, validates, and serves
authoritative source excerpts with citations. Source systems (Confluence,
Terraform repos, policy documents) remain the system of record; Atlas never
mirrors them durably.

## Language

**Source**:
A registered system-of-record document Atlas can cite (a Confluence page, a
Terraform module README, a policy document). Identified by `source_class`.
_Avoid_: Document, page, file.

**Anchor**:
A registered, citable location within a Source (a heading, a section, a
clause). Carries a `selector.locator` used to find the section at resolve time.
_Avoid_: Bookmark, fragment, section (when you mean the registered pointer).

**Excerpt**:
The text Atlas returns for an Anchor at request time, always paired with a
Citation. Excerpts are ephemeral — resolved live, never durably ingested.
_Avoid_: Snippet, content, body.

**Citation**:
The provenance attached to an Excerpt: `source_id`, `anchor_id`, label, and
location. An Excerpt without a Citation is never returned.

**Resolution**:
The act of turning a registered Anchor into an Excerpt at request time. For
Confluence Cloud this means a live API call through the [[Bearer pipe]] — using
whatever token the caller supplied, else the [[Service-token fallback]]. Atlas
does not bind resolution to any particular identity; Confluence's own ACL
governs what comes back, against whatever identity that token represents.
_Avoid_: Lookup, fetch (when you mean the governed resolve step).

**restricted_source**:
A single user-visible warning meaning "this Source exists but the caller's
identity is not allowed to see its content." It covers BOTH a registry-declared
restriction (`source.visibility === "restricted"`, known without calling the
source) AND a runtime ACL denial (Confluence returns 401/403 at resolve time).
The two origins converge on this one code; we do not split them.
_Avoid_: access_denied (that is the *error* form, used only on explicit source
requests), forbidden, unauthorized.

**Bearer pipe**:
The identity-agnostic transport this goal builds. Atlas reads an opaque Bearer
from the `Authorization` header and threads it, unparsed, all the way to
Confluence; Confluence enforces ACL against whatever identity that token
represents. Atlas never decides whose identity it is — that is each consumer's
responsibility.

**Caller identity**:
Whose token fills the Bearer pipe, decided per-consumer, not by Atlas. A Portal
UI may forward the logged-in user's token (once OAuth is wired); an AI Agent may
carry a user-configured token; a service-to-service caller carries only a
service token. Acquiring these is out of scope for the runtime-resolution goal.

**Service-token fallback**:
When no caller token is present, Atlas falls back to a server-side
`CONFLUENCE_TOKEN`. This token is deliberately **narrow-scoped** (only
broadly-readable pages) so the fallback cannot leak content a user could not
see. If even that is absent, resolution falls back to the offline pilot map.

**stale_source**:
A warning meaning "the registered record may no longer match the live source of
record." It now carries TWO origins under one code: (1) the Source is past its
`review_frequency` (overdue for review, time-based), and (2) **drift** — the
live Confluence page version is newer than the version Atlas recorded. The two
are distinguished only by the warning `message`, never by a separate code.
_Avoid_: changed_detected (an internal lifecycle state, never a warning code),
outdated.

**observed_version / drift**:
`observed_version` is the source-of-record version Atlas last recorded for a
Source (added to `SourceSchema`, optional). **Drift** is the runtime condition
where the live page version exceeds `observed_version`. With no recorded
version, drift never fires (no false positives). Drift surfaces as
[[stale_source]], not a new code.

**Two credential planes**:
Atlas keeps two separate credential paths. The **health/lifecycle plane** uses
a service credential for background metadata. The **runtime resolution plane**
uses the [[Bearer pipe]]: the caller's token when supplied, else the narrow
service-token fallback. They never mix.

**Wayfinding**:
Atlas's core job: telling a consumer, fast and authoritatively, what exists, who
owns it, where the authoritative source is, and how fresh it is. The MVP's center
of gravity; browsing and asking both serve it.
_Avoid_: Search, discovery (when you mean the directed where/who/how-fresh answer).

**Evidence**:
Any content derived from a citable [[Source]] — an [[Excerpt]], a Terraform module
doc, the parsed [[Availability]] matrix. Always carries a [[Citation]] and flows
through the consumer-neutral Context API.
_Avoid_: Data, content (when you mean cited, source-derived material).

**Operational status**:
Live, uncited state of a provisioning system (Terraform Enterprise runs/workspaces).
Portal-native — fetched by the Portal directly, never entering the Context API and
never presented as [[Evidence]]. Atlas shows it read-only, as a pointer to act in
TFE/Harness; Atlas never provisions.
_Avoid_: Metrics, telemetry, evidence.

**Availability**:
The region×[[Service]] matrix, parsed once from a governed Confluence [[Source]] into a
structured `service × region → status` and cached behind a lazy TTL (performance only). It
is [[Evidence]] (returned with a [[Citation]] and freshness/drift signals), not a
free-standing UI projection. Addressed by the **`availability-cell`** anchor parametrically:
**response precision mirrors query precision** — Service+region pinned → a cell, only Service
→ a row, only region → a column, and the Citation carries that same grain. If the table
can't be parsed, the bundle returns **no data + a warning** and never serves a stale cached
matrix ([ADR-0009](docs/adr/0009-availability-matrix-resolver.md)).
_Avoid_: Regions matrix, availability projection (when you mean the governed source).

**Review-decay**:
The visible aging of a human-curated claim (owner, `authority_level`, source↔resource mapping)
measured per-object as `now − last_reviewed_at` against that object's `review_frequency`, in
**two stages**: **aging** past ~80% of the frequency, **overdue** past 100%. Derived at
resolve time (no scanner). The UI shows the claim as unverified rather than asserting it
confidently. Distinct from [[stale_source]] (which is excerpt/version drift on a live
source); review-decay is the honesty mechanism for curated fields no live source can refresh.
_Avoid_: Expiry, decay (unqualified).

**Authority conflict**:
Two Sources that are **both currently valid** and have **different owners** claiming
authority for the same scope with differing guidance. Atlas surfaces both with a conflict
warning and **picks no side**. Supersession (a current record replacing a legacy one) is
**not** a conflict — the legacy record is [[stale_source]]/deprecated, single truth remains;
a [[Guardrail]] is single-truth and never conflicts. The one seeded conflict
([ADR-0010](docs/adr/0010-module-and-confluence-source-division.md)) is **Textract
private-subnet configuration**: the module README (module owner) ⟷ a platform Confluence
runbook (platform team), both current, disagreeing.
_Avoid_: Disagreement, ambiguity; calling current-vs-legacy a conflict.

**Resource**:
The canonical governed *thing*, addressed `{kind}/{slug}` (e.g. `service/aws/textract`,
`guardrail/s3-public-access`). It owns **both** its Sections (each Section → [[Source]]/[[Anchor]]
bindings) **and** its identity/presentation metadata (owner, status, version, entry tools). The
accepted primary content object of the Portal per
[ADR-0015](docs/adr/0015-portal-resource-first-ia.md); one canonical address
shared by Portal and Agent.
_Avoid_: Projection (the materialized-view connotation 0013/0014 retired), object, entity.

**Topic** (retired):
The catalog's *former* organizing unit and schema core type. The ADR-0015 resource-first
collapse is now **complete**: [[Resource]] (`{kind}/{slug}`) is the schema core type, `kind`
replaced `topic_type`, the `record.topics` field is gone, and the route is
`/service/$provider/$id`. Per [ADR-0015](docs/adr/0015-portal-resource-first-ia.md) every
former Topic resolved to exactly one disposition — a [[Resource]], a [[Facet]], or a
[[Decompose|decomposition]] — and Topic stopped being a content object of its own.
_Avoid_: Treating Topic as a live content object or current schema type; Category (was a Topic
attribute, not the Topic itself).

**Facet**:
A cross-cutting label/view (e.g. `private-networking`, `logging-monitoring`) that **aggregates
other [[Resource]]s' Sections rather than owning any**. Rendered as a filtered [[Resource]] list
plus an optional **bounded-concurrency** aggregate of members' Sections — server-orchestrated,
each block keeping its Resource boundary and [[Citation]]
([ADR-0014](docs/adr/0014-resource-read-one-core-many-views.md) §2); never a content object or
endpoint of its own.
_Avoid_: Area, theme page, topic page (when you mean the page-less cross-cutting filter).

**Decompose**:
The disposition for an *umbrella* [[Topic]] that is really a **set** (e.g. `serverless-compute`,
`s3-guardrails`): the Topic itself demotes to a [[Facet]] while its real [[Resource]]s (Lambda; a
specific guardrail) are split out as their own `{kind}/{slug}` objects.
_Avoid_: Group, grouping (drags in materialized-view baggage and hides the split-out step).

**Service**:
A catalog entry for an AWS service Atlas governs (S3, API Gateway, Textract). A presentation
facet of a [[Resource]] — the schema core type is `Resource`; "Service" is the catalog's word
for the AWS-service subset, carried as the `kind` value **`service`** (renamed from the
former `capability`; goal `goal_prompt_capability_to_service_rename.md`). Landing Zones,
[[Guardrail]]s, and [[Availability]] are **their own surfaces** — sibling `kind` values
`landing-zone` / `guardrail`, never labeled Services. The hero slice governs three
Services deep (S3, API Gateway, Textract) in the Federated Landing Zone.
_Avoid_: **Capability** anywhere — the word is purged from live code, schema, and UI; the
`kind` value is `service`, and the schema type itself is `Resource`. Do not call a Landing
Zone or Guardrail a Service.

**Guardrail**:
A platform rule projected from a **single** policy-document [[Source]] (via an anchor),
carrying an authority + a **severity** (a governance attribute held on the source↔resource
mapping, not in the source doc). Single-truth: a Guardrail can only go [[stale_source]],
**never** [[Authority conflict|conflict]]. No dedicated guardrails manifest.
_Avoid_: Policy, control (when you mean the governed, severity-bearing rule).

**Beyond registered scope**:
The honest dead-end when no Source is registered for a resource: Atlas says so plainly and
offers a path to file [[Feedback]] (missing), never falling back to ungoverned search.
_Avoid_: Not found, no results, empty state.

**Candidate / Promotion**:
A **Candidate** is a manifest awaiting review — from AI authoring or Phase-2 discovery —
carried as review `status: draft` and shown badged `unverified`. **Promotion** is the
human-reviewed merge that moves it to `published` in the Git-versioned registry (the
governance truth). Objects enter through the Git ingestion seam, **never a mutable store**.
_Avoid_: Pending, staging (and do not confuse review `status: draft` with the `draft`
`authority_level`).

**Auto-classified**:
A Source whose `authority_scope`/`authority_level` was *proposed* by Phase-2 discovery
classification, not yet human-confirmed; shown `unverified` until reviewed. High-confidence
proposals emit a `status: draft` manifest PR; low-confidence or conflicting ones go to a
human queue.
_Avoid_: Inferred, guessed.

**Lifecycle plane**:
The credential/execution plane that runs **scheduled** governance work (broad-scan
discovery, metadata re-validation). Distinct from the runtime resolution plane, which is
request-time and **never** runs background workers.
_Avoid_: Background, worker (unqualified).
