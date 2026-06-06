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
`ATLAS_CONFLUENCE_TOKEN`. This token is deliberately **narrow-scoped** (only
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
