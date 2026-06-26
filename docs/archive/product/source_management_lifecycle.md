# Atlas Source Management — Complete Lifecycle Design

This document defines the **source management lifecycle**, including roles, operating locations, tasks, state model, and evolution path. It uses a **Confluence page** as the concrete example throughout.

This is the authoritative reference for source management design, superseding earlier drafts and conversation-level analysis.

---

## Design Principles

1. **Source Author zero burden** — Authors maintain Confluence content only. They never interact with Atlas.
2. **Automate detection, human decides authority** — Atlas automates discovery, health checks, change detection. Humans only make governance judgments (is this canonical? is it still valid?).
3. **No unnecessary surfaces** — V1 adds zero Portal surfaces for source management. Platform Team operates through existing tools (seed files, scripts, API).
4. **Auditable by default** — Every human decision and automated check is recorded with actor, timestamp, source version, and decision.
5. **Portal is a consumer** — Portal reads from Context API. It never directly accesses Confluence or owns registry data.

---

## Roles

| Role | Who | Operates Where | Responsibilities |
|------|-----|---------------|------------------|
| **Source Author** | Engineer / architect who writes in Confluence | Confluence only | Creates and maintains page content. **Does not know Atlas exists.** Never asked to fill Atlas metadata, declare authority, or manage freshness. |
| **Platform Team** | Cloud Platform team = Atlas owner + operator | Git repo (seed files), Atlas API, ops scripts | Discovers sources. Registers them in the registry. Runs health monitoring. Manages the overall registry lifecycle. Resolves systemic issues (service account permissions, broken locators, authority conflicts). |
| **Capability Steward** | Business/technical owner of a capability domain (e.g. Landing Zone steward, Security Baseline steward) | Git repo (PR review) or lightweight confirmation channel | Makes exactly one kind of judgment: **is this source authoritative for my capability, and to what degree?** Also confirms validity when source content changes significantly. |
| **Portal Consumer** | Application developer, SRE, platform user | Atlas Portal | Browses capabilities, reads source excerpts, opens canonical Confluence links, submits feedback (stale / broken / missing / wrong). |
| **Atlas System** | Automated backend | Context Layer, scheduled jobs | Request-time Confluence resolution, health checks, change detection, fingerprint comparison, warning generation. Never makes authority decisions. |

### Why no "Source Curator" role

Previous analysis proposed a separate Curator role. In V1 (and likely V2), the Platform Team IS the curator. The team is small enough that splitting this into a named role adds conceptual overhead without operational value. If the organization scales to hundreds of sources with a dedicated governance function, the role can be formalized then.

---

## Two-Layer State Model

### Layer A: Portal Display States (what consumers see)

| State | Meaning | Visual |
|-------|---------|--------|
| **Active** | Source is registered, reviewed, and trustworthy | Normal display with authority badge |
| **Warning** | Source is active but has an issue (changed, stale, restricted) | Warning badge + explanation |
| **Deprecated** | Source is no longer recommended; replacement may exist | Muted display + deprecation notice |
| **Retired** | Source removed from consumer view | Not displayed (audit record preserved) |

Consumers do not see internal workflow states. They see trust signals.

### Layer B: Backend Governance States (what the system tracks)

These states describe where a source is in its lifecycle, including intake workflow:

```
intake_submitted       — URL or proposal received
analysis_running       — Backend fetching Confluence metadata + running AI profiling
analysis_completed     — AI profile ready for human review
review_requested       — Sent to Capability Steward for authority decision
approved               — Steward confirmed authority level
active                 — Live in registry, displayed in Portal, monitored
changed_detected       — Confluence content changed since last review
review_pending         — Change or staleness requires steward re-confirmation
deprecated             — Marked as no longer recommended
retired                — Removed from active display, audit record preserved
rejected               — Reviewed and explicitly excluded from Atlas
broken                 — Locator invalid (404), anchor missing, or service account blocked
```

**Why this matters**: Without backend states, you cannot answer operational questions like:
- Where is this source intake stuck?
- Did AI analysis complete?
- Has the steward been asked to review?
- Was the change detection PR created?
- Did the registry sync after approval?

The mapping from backend → Portal display:

| Backend State | Portal Display |
|---------------|---------------|
| intake_submitted, analysis_running, analysis_completed, review_requested, approved | Not displayed (not yet active) |
| active | Active |
| changed_detected, review_pending, broken | Active + Warning |
| deprecated | Deprecated |
| retired, rejected | Not displayed |

---

## Complete Lifecycle: A Confluence Page's Journey

### Example Source

> **"How to onboard an application to AWS Federated Landing Zone"**
> Confluence page in Cloud Platform space, authored by a platform enablement engineer.

---

### Phase 1: Discovery

**Principle: Source Author does nothing. Atlas finds the source.**

#### V1: Manual discovery by Platform Team

| Action | Who | Where | What happens |
|--------|-----|-------|-------------|
| Platform Team identifies a valuable page | Platform Team member | Confluence / team knowledge | Recognizes this page should be in Atlas |
| Team decides to register it | Platform Team | Internal discussion / backlog | No Portal surface involved |

In V1 there is no Portal intake form and no automated Confluence scanning. Discovery is a human process within the Platform Team, using existing knowledge of the Confluence landscape.

Users who want to suggest a source use existing channels:
- Cloud Platform support channel (Slack/Teams)
- Jira / ServiceNow ticket
- Direct team communication

**Backend state**: `intake_submitted` (recorded when Platform Team begins registration)

#### Future: Automated discovery + Portal intake

| Phase | Discovery method |
|-------|-----------------|
| V2 | Scheduled Confluence space/label scanning discovers candidate pages automatically |
| V2 | Portal provides a minimal Source Intake surface (single URL field) for Platform Team |
| V3 | Portal consumers can "Suggest a source" which enters the intake queue |
| V3 | Portal intake triggers PR under the hood for governance |

---

### Phase 2: Analysis

**Principle: System extracts metadata automatically. Humans never fill forms.**

#### V1: Manual analysis with code assistance

Platform Team reads the Confluence page and manually determines:
- `authority_scope` — what capability/scenario this covers
- `authority_level` — canonical / authoritative / reference / example
- `steward` — which team owns this domain
- `review_frequency` — how often it should be re-validated

They create anchor definitions for key page sections (heading paths, selectors).

**Backend state**: `analysis_running` → `analysis_completed`

#### Future: AI-powered profiling

Atlas backend will:
1. Call Confluence REST API (service account) — fetch page id, title, version, updated_at, author, labels, restrictions, body
2. Generate AI summary: detected purpose, capability, scenario, owner signal, support path, tools mentioned, duplicate risk
3. Produce a **Candidate Profile** with suggested authority level, scope, steward, and risks
4. Platform Team reviews AI suggestions and corrects errors rather than filling fields from scratch

---

### Phase 3: Registration

**Principle: Registration is structured data in Git, reviewed via PR.**

#### What gets registered

One source registration involves four objects:

**1. Source** (the governance entity)

```yaml
source:
  id: "aws-fed-lz-onboarding-confluence"
  title: "How to onboard an application to AWS Federated Landing Zone"
  source_class: "confluence-page"
  location: "https://confluence.internal/display/CLOUD/AWS-Fed-LZ-Onboarding"
  steward: "cloud-platform-enablement"
  visibility: "internal"
  authority_scope: ["aws-federated-landing-zone", "application-onboarding"]
  authority_level: "authoritative"
  last_reviewed_at: "2026-05-11"
  review_frequency: "P90D"
```

**2. Anchors** (addressable sections within the page)

```yaml
anchors:
  - id: "aws-fed-lz-onboarding-prerequisites"
    source_id: "aws-fed-lz-onboarding-confluence"
    anchor_strategy: "confluence-section"
    title: "Prerequisites"
    selector:
      type: "confluence-section"
      page_id: "987654321"
      heading_path: ["Prerequisites"]
    citation_label: "AWS Fed LZ Onboarding — Prerequisites"
    status: "unvalidated"

  - id: "aws-fed-lz-onboarding-access-request"
    source_id: "aws-fed-lz-onboarding-confluence"
    anchor_strategy: "confluence-section"
    title: "Access Request Process"
    selector:
      type: "confluence-section"
      page_id: "987654321"
      heading_path: ["Access Request Process"]
    citation_label: "AWS Fed LZ Onboarding — Access Request"
    status: "unvalidated"
```

**3. Topic** (reuse existing or create new)

```yaml
topic:
  id: "aws-federated-landing-zone"
  name: "AWS Federated Landing Zone"
  topic_type: "capability"
  category: "landing-zones"
  status: "active"
  owner_team: "cloud-platform-enablement"
  support_channel: "#cloud-platform-support"
```

**4. Source-Topic Mapping**

```yaml
source_topic_mapping:
  source_id: "aws-fed-lz-onboarding-confluence"
  topic_id: "aws-federated-landing-zone"
```

#### V1: Registration via TypeScript seed files

Platform Team edits `context-layer/src/seeds/pilotRegistry.ts`, adds the source/anchor/topic/mapping entries, and restarts the service. Changes are committed to Git with conventional commit messages.

**Backend state**: `review_requested` (if steward confirmation is needed) → `approved` → `active`

#### Future: YAML registry files + CI validation

- `data/sources/*.yaml`, `data/topics/*.yaml`, `data/mappings/*.yaml`
- CI validates: schema compliance, no duplicate IDs, owner exists, authority scope valid, locator format correct
- PR merge triggers registry reload

---

### Phase 4: Steward Confirmation

**Principle: Steward makes exactly one judgment — authority level. Everything else is pre-filled.**

#### When Steward is involved

Not every source registration requires steward confirmation. Guidelines:

| Authority level | Steward confirmation required? |
|----------------|-------------------------------|
| canonical | **Yes** — this is the strongest claim, must be explicitly confirmed |
| authoritative | **Yes** — still a strong governance claim |
| reference | No — Platform Team can register directly |
| example | No — low governance weight |

#### V1: Steward confirms via PR review

When a source is proposed as canonical or authoritative:

1. Platform Team opens a PR adding the source to the registry
2. PR description includes: source title, AI/manual summary, proposed authority level, proposed scope
3. Capability Steward is added as PR reviewer (via CODEOWNERS or manual assignment)
4. Steward reviews and approves (or requests changes)
5. PR merge = source becomes active

**Backend state**: `review_requested` → `approved` (on PR approval) → `active` (on merge + reload)

#### Future: Lightweight Portal confirmation

When Git automation becomes available:
1. Portal shows a minimal confirmation card to the steward (deep-linked from notification)
2. Steward clicks one button: Canonical / Authoritative / Reference / Reject
3. Backend creates and merges the PR under the hood
4. Steward never touches Git directly

---

### Phase 5: Active Display

**Principle: Portal displays trust signals, not lifecycle complexity.**

Once active, the source appears in Portal:

```
Authoritative Sources

✅ authoritative  How to onboard to AWS Federated Landing Zone
   Confluence · cloud-platform-enablement
   Reviewed: 2026-05-11 · Updated in Confluence: 2026-05-05
   ↳ Prerequisites
   ↳ Access Request Process
   [Open in Confluence]  [Report issue]
```

Key display rules:
- **Two timestamps**: "Reviewed" (steward confirmation) and "Updated in Confluence" (source system modification). The gap between them is the trust signal.
- **Authority badge**: canonical / authoritative / reference
- **Excerpt on expand**: Atlas fetches section content from Confluence at request time (no durable mirror), renders a preview + "Open in Confluence" deep link
- **Warnings inline**: stale, changed since review, broken anchor, restricted access

---

### Phase 6: Monitoring

**Principle: Fully automated. Detect problems, surface them as warnings, never auto-fix authority.**

Atlas backend scheduled job checks all active sources:

| Check | Method | Warning produced |
|-------|--------|-----------------|
| Page exists? | Confluence API status code | `broken_locator` (404), `permission_issue` (403) |
| Version changed? | Compare `current_version` vs `reviewed_version` | `changed_since_review` |
| Content changed? | Body content hash vs stored fingerprint | `content_changed` |
| Anchor valid? | Resolve heading selectors against live page | `broken_anchor` |
| Review expired? | `today - last_reviewed_at > review_frequency` | `stale` |
| Permissions changed? | Confluence restriction metadata | `permission_changed` |

#### Change severity classification

| Severity | Examples | System response |
|----------|----------|----------------|
| **Minor** | Typo fix, formatting | Record only. No warning. No notification. |
| **Major** | Steps changed, policy updated, scope modified | Portal shows "Changed since review" warning. Notify steward. |
| **Critical** | Page deleted, service account blocked, canonical source unreachable | Portal shows strong warning. Notify Platform Team + steward immediately. |

**V1**: Health checks may be manual or semi-automated (ops script). Full scheduled automation is a V2 capability.

**Future**: AI compares reviewed snapshot vs current content, generates a change summary with severity classification, enabling smarter routing.

**Backend state**: `active` → `changed_detected` → `review_pending`

---

### Phase 7: Re-confirmation

**Principle: Same confirmation mechanism as Phase 4, triggered by monitoring.**

When a major or critical change is detected:

1. Platform Team creates a PR updating `reviewed_version`, `last_reviewed_at`, and any broken anchor selectors
2. PR description includes the change summary (manual in V1, AI-generated in future)
3. Steward reviews: confirms still valid, or requests deprecation/update

| Steward decision | System action |
|-----------------|---------------|
| **Still valid** | Update `reviewed_version` + `last_reviewed_at`. Clear warning. |
| **Needs update** | Warning remains. Source Author updates Confluence (Atlas doesn't manage Confluence content). Next monitoring cycle detects new version. |
| **Deprecate** | Status → `deprecated`. Portal shows deprecation badge + replacement link. |

**Backend state**: `review_pending` → `approved` → `active` (if confirmed) or → `deprecated`

---

### Phase 8: Retirement

**Principle: Sources are never deleted. They transition to deprecated/retired with audit trail preserved.**

| Trigger | Action | Portal display |
|---------|--------|---------------|
| Replaced by newer source | `deprecated` + `superseded_by` link | Muted display + "See [replacement] for current guidance" |
| Capability decommissioned | `retired` | Not displayed |
| Page permanently deleted | `broken` → `retired` (after steward confirms) | Not displayed |
| Long-term stale, no owner | `retired` (Platform Team decision) | Not displayed |

**Backend state**: `deprecated` or `retired`

---

## Confluence-Specific: Permission Handling

### V1 Strategy: Honest + Conservative

Atlas does NOT solve Confluence permissions. It acknowledges them.

| Service account status | Source visibility | Portal behavior |
|----------------------|------------------|----------------|
| Can read + page unrestricted | `internal` | Show preview + "Open in Confluence" |
| Can read + page has restrictions | `restricted` | Metadata only + "This source may require access" + access guidance |
| Cannot read (403) | `service_blocked` | Metadata only + "Preview unavailable" |
| Page gone (404) | broken | Warning badge |

**Not built in V1**: Per-user Confluence permission checks, delegated tokens, real-time ACL queries.

**Built in V1**: Record Confluence restriction metadata at registration time. Use it for conservative display degradation.

### Future: Progressive permission awareness

| Phase | Capability |
|-------|-----------|
| V2 | Read Confluence page restriction metadata → show "restricted to [groups]" |
| V3 | With SSO integration, approximate per-user access check (user groups ∩ allowed groups) |

---

## Audit Model

Every human decision and system check produces an audit event.

### Human decision events

```
source_id, action, actor, timestamp, source_version, decision, context
```

Actions: `submitted`, `rejected`, `approved`, `confirmed`, `deprecated`, `retired`

### System check events

```
source_id, checked_at, source_version, health_status, change_severity, change_summary
```

Health statuses: `healthy`, `changed`, `stale`, `broken`, `permission_issue`

These records answer: **who decided what, when, based on which version of the source, and why.** This is the audit trail regardless of whether the governance backbone is DB-based (V1) or Git-based (future).

---

## Evolution Path

### V1 — Contract + UX Proof (current)

| Aspect | V1 approach |
|--------|-------------|
| Discovery | Platform Team manually identifies sources |
| Analysis | Manual reading + judgment |
| Registration | TypeScript seed files in `context-layer/src/seeds/` |
| Steward confirmation | PR review on seed file changes |
| Portal intake | **None** (No Auth = no formal intake surface) |
| Health monitoring | Manual or semi-automated ops scripts |
| Change detection | Request-time anchor resolution + fingerprint comparison |
| Audit | Git commit history on seed files |
| Source suggestion by users | Existing channels (Slack, Jira, direct communication) |

**V1 proves**: the data model, the authority/freshness/warning display, the Context API contract, and the Portal consumption UX.

### V2 — Real Source Connectivity

| Aspect | V2 approach |
|--------|-------------|
| Discovery | Scheduled Confluence space/label scan discovers candidates automatically |
| Analysis | Confluence REST API + AI profiling generates Candidate Profiles |
| Registration | YAML registry files in `data/` + CI schema validation |
| Steward confirmation | PR review with AI-generated summary in PR description |
| Portal intake | Platform Team can submit URL via Portal → triggers backend analysis |
| Health monitoring | Scheduled backend jobs checking all active sources |
| Change detection | Version tracking + content fingerprint + AI change summary + severity classification |
| Audit | Git history + structured audit events in DB |

**V2 proves**: live Confluence integration works end-to-end, automated health monitoring reduces manual burden.

### V3 — Governance at Scale

| Aspect | V3 approach |
|--------|-------------|
| Discovery | Multi-source scanning (Confluence, Git, policy repos) + Portal user suggestions |
| Analysis | Full AI profiling with duplicate detection, authority conflict detection |
| Registration | Portal intake triggers PR under the hood |
| Steward confirmation | Lightweight Portal confirmation card (deep-linked from notification) → backend creates/merges PR |
| Portal intake | Open to Portal consumers (suggest source) with moderation |
| Health monitoring | Continuous monitoring with intelligent alert routing |
| Change detection | AI-powered change summary, smart severity classification, auto-routing to correct steward |
| Audit | Git as governance backbone, Portal as interaction layer |
| Permission | Approximate per-user access check with SSO integration |

**V3 delivers**: a self-sustaining governed knowledge system where source trust is continuously maintained with minimal human intervention.

---

## Role × Phase Matrix

| Phase | Source Author | Platform Team | Capability Steward | Atlas System | Portal Consumer |
|-------|-------------|---------------|-------------------|-------------|-----------------|
| **Discovery** | Writes in Confluence (unaware of Atlas) | Identifies valuable sources | — | Future: scans Confluence automatically | Future: suggests sources via existing channels |
| **Analysis** | — | Reads page, determines authority/scope (V1). Reviews AI profile (future). | — | Future: fetches Confluence metadata + AI profiling | — |
| **Registration** | — | Creates seed entries / YAML files. Opens PR. | — | Validates schema (future CI) | — |
| **Steward Confirmation** | — | Assigns steward. Coordinates review. | Reviews PR. Confirms authority level for their capability. | Records decision + version. | — |
| **Active Display** | — | — | — | Serves Context API. Resolves anchors at request time. | Browses, reads excerpts, opens Confluence links. |
| **Monitoring** | — | Runs health checks (V1 manual, future automated) | — | Checks version, access, anchors, freshness. Generates warnings. | Sees warnings on source cards. |
| **Re-confirmation** | May update Confluence content if steward requests | Creates review PR with change summary | Confirms still valid / deprecate | Provides change data | May report issues triggering review |
| **Retirement** | — | Updates registry status | Confirms deprecation decision | Removes from active display | Sees deprecation notice or source disappears |

---

## Key Design Decisions Log

| Decision | Rationale |
|----------|-----------|
| V1 has no Portal Source Intake | No Auth model means no user identity → no meaningful intake workflow governance. Platform Team uses direct registry access. |
| Two-layer state model | Portal consumers need simplicity (4 states). Backend needs workflow tracking (12 states). Conflating them creates either confusing UX or insufficient ops visibility. |
| Source Author is never burdened | Enterprise adoption fails if Atlas adds work to the people who create content. Authors maintain Confluence; Atlas builds a governance layer on top without their involvement. |
| Steward confirms via PR review (V1) | Leverages existing Git review workflow. No new surface required. Provides natural audit trail. |
| Monitoring is manual in V1 | Automated monitoring requires Confluence API integration which is not yet built. Semi-automated ops scripts are the pragmatic V1 path. |
| Content fingerprint for drift detection | Allows Atlas to detect that source content diverged from last steward review without auto-syncing or mirroring content. Surfaces drift as a warning signal, not an automatic correction. |
| No per-user permission check | Confluence ACL integration requires SSO + delegated auth. V1 uses conservative display based on service account access + restriction metadata. |
| PR under the hood is the long-term target | Combines low-friction Portal interaction with Git's natural audit/diff/rollback/CODEOWNERS capabilities. Blocked in V1 by company Git automation constraints. |
