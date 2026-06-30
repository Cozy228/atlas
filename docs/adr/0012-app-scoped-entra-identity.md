# Post-MVP APP-scoping: a progressive Entra identity gates app-scoped Sources; agents inherit it through the identity-agnostic Bearer pipe (ADR-0001)

Status: proposed
Date: 2026-06-24

> **Scope-seam update:** [ADR-0015](./0015-portal-resource-first-ia.md) §5 reserved a scope injection
> point for this ADR's APP-scope (decision 5 below). [ADR-0017](./0017-landing-zone-discovery-root.md)
> then **seats it at `ResolutionContext.scope` and fills it first with landing-zone**, keeping the
> `app_id` slot reserved in the same object (still proposed/unbuilt) — layering APP later inserts into
> that seam, no new mechanism.

## Context

Post-MVP, Atlas's center of gravity shifts from platform-wide wayfinding to **"my APP"**:
once a user authenticates (Entra ID), everything reframes around the APPs they belong to —
the APP's services, deployment architecture, and operational status. Atlas today is
platform-wide and unauthenticated; there is no notion of a caller, let alone the APPs they
own. Two questions the current architecture does not answer:

1. **Where does per-APP data live** without building a second product (a CMDB)?
2. **How does an agent inherit the user's auth + APP context?** Atlas is agent-first
   (llms.txt, MCP, OpenAPI; [ADR-0002](./0002-atlas-is-a-portal-context-layer-is-its-core.md)),
   so any per-APP gating must work for an external agent, not just the browser.

Two constraints shape the answer: a user belongs to **many** APPs (1:N), and "APP state"
spans the two paradigms the codebase already separates
([ADR-0003](./0003-evidence-vs-live-status-split.md)) — citable structure vs live status.

## Decision

1. **An APP is a set of app-scoped Sources — not a new data plane.** No CMDB, no parallel
   inventory store. An APP's topology / service inventory enters as **Sources** (the pointer
   model of [ADR-0007](./0007-runtime-object-ingestion-seam.md)) carrying a new `app_id` +
   `visibility: app`, flowing through the **same** Source→Excerpt→Citation→Bundle machine.
   "Belongs to APP" degrades to a Source **visibility** dimension — not a new mechanism.

2. **The evidence/ops split (ADR-0003) decides structure vs status, applied per-APP —
   unchanged.**
   - **APP structure** (topology, service inventory, the *designed* deployment architecture)
     is **Evidence** → app-scoped Source → Context API → **Citation + `stale_source`**
     (fresh-drift, [ADR-0006](./0006-governed-honesty-model.md)). Visible to MCP/agents,
     subject to app authz.
   - **APP live status** (health, instance counts, current deploy run) is **Operational
     status** → **Portal-native, app-scoped, never enters the Context API, never an
     Excerpt** — surfaced as an **action pointer** that links out (ADR-0003's TFE rule, now
     app-filtered). Agents get governed context, not ops.
   - This retires the design-time idea of a `Citation.freshness: live` field: live status
     never *becomes* a Citation, so the tension never arises. ADR-0003 already resolved it.

3. **A progressive Entra identity gates app-scoped Sources — extending ADR-0001's
   identity-agnostic posture, not replacing it.**
   - **public Sources**: any entry point, anonymous (today's behavior, unchanged).
   - **app-scoped Sources**: require an **Entra bearer** (audience = Context API) whose
     claims resolve `user → APPs`. The Context API filters app-scoped Sources by that authz
     **before** source-content resolution.
   - **Two identity layers, in series, orthogonal:** Entra app-scope (Context-API layer —
     *which Sources you may see*) → then ADR-0001's bearer for source-content ACL (*whether
     you may read each source*; server-side service token today, Confluence-OBO later).
     Atlas still "does not decide whose identity it is" — it validates the Entra bearer and
     threads it; **callers acquire it.**
   - **APP is a per-request parameter, not a token singleton.** The bearer carries the *set*
     of permitted APPs; the specific APP is `app_id` per request, server-checked `user ×
     app`. One session, many APPs.

4. **Every consumer acquires the Entra bearer its own way; the Context API stays
   identity-agnostic about *how* (ADR-0001 spirit).**
   - **Browser** → Easy Auth / BFF (Entra OIDC); the server holds the token (+ OBO to the
     Context-API audience if it is a separate registration). The SPA never holds an access
     token.
   - **External agent** → **MCP OAuth** (`401` + `WWW-Authenticate` → Entra). Anonymous
     tools still serve public; only app-scoped reads trigger the flow — open discovery is
     preserved.
   - **Bare REST / CI** → caller mints its own Entra token (**client credentials** for a
     service principal; **device code** for a human at a CLI). Same bearer, no auto-prompt.
   - **No Atlas-issued PAT.** Entra's flows cover every consumer; a self-issued token system
     is YAGNI.
   - ⇒ **Agents inherit auth + APP through the same bearer the Bearer pipe already threads**
     (`portal/src/api/server/mcp/handler.ts`) — zero new mechanism in the MCP handler.

5. **Portal shape: APP-selector-first.** Login → "the APPs you belong to" → pick one →
   existing surfaces (catalog / guidance / availability / …) filtered by that `app_id`.
   Single-focus; existing surfaces reused behind one scope filter (Portal is one consumer,
   ADR-0002). A cross-APP aggregate dashboard is a later evolution, not the entry shape.

## Considered and rejected

- **A new APP inventory data plane / CMDB** parallel to the Context Layer. Rejected:
  reinvents the Source→Citation machine, splits the system of record, and contradicts
  "APP = new Sources."
- **Live APP status as cited Evidence (`freshness: live` on Citations).** Rejected: violates
  ADR-0003 (live status never enters the Context API / never an Excerpt) and reopens a
  tension 0003 closed cleanly. Live status is Portal-native ops, not Evidence.
- **Atlas-issued per-APP PAT.** Rejected as YAGNI: browser (Easy Auth), agent (MCP OAuth),
  CI (client credentials / device code) are all Entra-native; a bespoke token is an
  issuance/rotation/revocation system to own.
- **APP baked into the token as a single value.** Rejected: a user is 1:N over APPs; one
  token per APP forces re-auth to switch. The token carries the *set*; APP is a parameter.
- **Per-user Confluence token as the app-scope mechanism.** Already rejected for source ACL
  by ADR-0001; app-scope is a *separate, additive* Context-API-layer filter, not a change to
  that bearer.

## Consequences

- **Schema deltas:** `Source` gains `app_id?` + `visibility: app`; an APP entity is thin
  (≈ an Entra group id + display name). **No `Citation.freshness` field** (consequence of
  rejecting live-as-evidence). MCP tools likely need **no `app_id` param** — app-scoped
  Sources have their own ids and the Context API filters by the bearer's app authz
  automatically; an `app_id` is an *aggregation key* for the "my APP" view, not per-tool
  gating.
- **Ingestion:** APP-structure Sources enter via the **post-MVP live-ingestion path
  ADR-0007 explicitly reserved** ("a future live-ingestion API … reuses the schema +
  validator … Revisit post-MVP") — an automated/event-driven app-inventory feed reusing
  `SourceSchema` + validator, *not* hand-authored Git PRs. 0007's foreseen extension, now
  claimed.
- **Public-safe ([ADR-0004](./0004-public-safe-proof-boundary.md)):** this repo ships only
  the *generic* seam — an Entra/OIDC-shaped identity boundary, a `visibility: app` Source
  class, and a **mock APP fixture** (one fictional APP + fake topology). Real Easy Auth /
  OBO / Azure Resource Graph adapters are company-side, env-configured. The claim is carried
  by tests, not a live tenant.
- **Gating:** **post-MVP**, downstream of the MVP done-bar (grounded adoption journey;
  `docs/product/api-gateway-adoption-gate.md`). It does not move the MVP line.
- **Open (implementation, not architecture):** `user → APP` membership source (Entra group
  claim vs Graph lookup); app-inventory ingestion trigger + cadence; live-status proxy
  failure/degrade behavior; whether bare-REST app access is documented externally or only
  browser + MCP are promoted (product posture, deferred).
