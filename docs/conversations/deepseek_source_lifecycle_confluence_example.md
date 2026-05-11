# Atlas V1 — Source Lifecycle: Confluence Page Example

This document uses a **Confluence page** as a concrete Source to walk through the full lifecycle — registration, discovery, consumption, feedback, maintenance, and retirement. Each stage specifies **who** operates, **where** they operate, and **what** they do.

---

## Roles

| Role | Who | Where They Operate |
|------|-----|--------------------|
| **Source Author** | Platform engineer / architect who writes Confluence docs | Confluence |
| **Atlas Curator** | DevEx / platform governance team member | Git repository (PR-reviewed seed files) + Atlas API |
| **Consumer** | Application team developer, SRE | Atlas Portal, Ask Atlas, CLI / MCP tools |
| **Steward** | The team listed in `source.steward` | Confluence (content) + Git repo / API (registry metadata) |
| **Atlas System** | Automated (Context Layer) | Request-time resolution, health checks |

---

## Stage 1: Registration — Bringing a Confluence Page into Atlas

### 1.1 Prerequisite

A Source Author has already authored a Confluence page:

- **Title:** "AWS Textract — Networking Requirements"
- **URL:** `https://confluence.internal/display/CLOUD/Textract-Networking`
- **Sections:** `## VPC Configuration`, `## Private Link Setup`, `## Security Groups`

The page lives **only** in Confluence. Atlas has no knowledge of it yet.

### 1.2 Curator Registers Source, Anchors, Topic, Mapping

**Where:** Git repository (seed files) + `POST` API calls. Under the V1 constraint of no admin UI, there are two equivalent paths:

- **Path A (current implementation):** TypeScript seed in `context-layer/src/seeds/`, loaded into memory on restart.
- **Path B (design target):** GitOps YAML files under `data/sources/`, merged via PR, loaded by a DynamoDB loader.

Regardless of path, the Curator performs **four registration actions**:

#### (a) Register a Source (governance entity)

```yaml
source:
  id: "textract-networking-confluence"
  title: "AWS Textract — Networking Requirements"
  source_class: "confluence-page"
  location: "https://confluence.internal/display/CLOUD/Textract-Networking"
  steward: "cloud-network-team"
  visibility: "internal"
  authority_scope: ["module-usage", "network-guardrail"]
  authority_level: "authoritative"
  last_reviewed_at: "2026-04-15"
  review_frequency: "P90D"
```

**Key judgment call:** The Curator must decide `authority_level` (authoritative / reference / example / draft / deprecated) and `authority_scope`. These cannot be auto-inferred from Confluence — they require human governance judgment.

#### (b) Register Anchors (addressable sections)

A single Confluence page typically has multiple sections worth referencing. The Curator creates one Anchor per section:

```yaml
anchors:
  - id: "textract-networking-vpc"
    source_id: "textract-networking-confluence"
    anchor_strategy: "confluence-section"
    title: "VPC Configuration"
    selector:
      type: "confluence-section"
      page_id: "123456789"
      heading_path: ["VPC Configuration"]
      heading_slug: "vpc-configuration"
    citation_label: "Textract Networking — VPC Configuration"
    status: "unvalidated"
    last_validated_at: null

  - id: "textract-networking-privatelink"
    source_id: "textract-networking-confluence"
    anchor_strategy: "confluence-section"
    title: "Private Link Setup"
    selector:
      type: "confluence-section"
      page_id: "123456789"
      heading_path: ["Private Link Setup"]
      heading_slug: "private-link-setup"
    citation_label: "Textract Networking — Private Link Setup"
    status: "unvalidated"
    last_validated_at: null
```

`status: "unvalidated"` means the Anchor selector has not yet been verified against live Confluence content. On first request-time resolution, if the heading does not exist, the status changes to `broken`.

#### (c) Create or associate a Topic

If the capability already has a Topic, reuse it. Otherwise, create a new one:

```yaml
topic:
  id: "aws-textract"
  name: "AWS Textract"
  topic_type: "capability"
  category: "ai-ml"
  status: "active"
  description: "Managed OCR and document extraction service"
  owner_team: "ai-platform-team"
  support_channel: "#ask-ai-platform"
  entry_tools:
    - label: "TFE — Textract Module"
      url: "https://tfe.internal/workspaces/textract"
```

#### (d) Create Source-Topic Mapping

```yaml
source_topic_mapping:
  source_id: "textract-networking-confluence"
  topic_id: "aws-textract"
```

**Summary:** One registration involves 1 Source + N Anchors + (0 or 1 Topic) + 1 Mapping. All done via structured files in Git, reviewed via PR.

---

## Stage 2: Discovery — Consumer Finds and Reads the Source

### 2.1 Browse by Topic

**Where:** Atlas Portal

A Consumer (application developer) opens the Portal, sees a category list on the home page, and clicks "AI/ML" → "AWS Textract."

Portal calls the Context API:

```
GET /topics/aws-textract
```

The Context Layer returns Topic details + associated Source list (with authority badges) + Anchor references. Portal renders:

```
AWS Textract — capability | maintained by ai-platform-team | #ask-ai-platform

Authoritative sources:
  ✅ authoritative  Textract Networking Requirements  cloud-network-team  reviewed: 2026-04-15
     ↳ VPC Configuration
     ↳ Private Link Setup
  📖 reference      Textract Architecture Overview    ai-platform-team    reviewed: 2025-12-01
     ↳ High-level Design
```

### 2.2 Expand an Anchor to Read Content

Consumer clicks "VPC Configuration" → Portal calls:

```
GET /anchors/textract-networking-vpc/expand
```

The Context Layer fetches the corresponding section from Confluence **at request time** (no durable mirror), and returns excerpt + provenance:

```json
{
  "anchor": { "id": "textract-networking-vpc", "title": "VPC Configuration" },
  "excerpt": "Textract requires a VPC with at least 3 subnets...",
  "source": {
    "title": "AWS Textract — Networking Requirements",
    "location": "https://confluence.internal/display/CLOUD/Textract-Networking",
    "authority_level": "authoritative"
  },
  "warnings": []
}
```

Portal renders the excerpt alongside an **"Open in Confluence"** deep link that points to the exact section. This answers the question: how much "read here" vs "open in Confluence" — Atlas provides enough excerpt to judge relevance, and a deep link to the canonical source for full reading. Ownership stays with Confluence.

### 2.3 Ask Atlas (AI-Assisted Consumption)

**Where:** Atlas Portal (Ask Atlas UI)

Consumer types: *"How do I set up Private Link for Textract?"*

Portal server-side flow:

1. Call Context API → get context bundle (excerpt from `textract-networking-privatelink` + authority metadata + source-level warnings).
2. Send `context bundle + user question` to the LLM adapter (Bedrock / RAI / simulated).
3. LLM reasons over governed context only, generates an answer.
4. Citation validator checks every factual claim against the context bundle.
5. Return to user: answer with inline citations, authority badges, freshness indicators, and "Open in Confluence" links.

This is why Atlas is **not** just a link aggregator: the AI can only answer within the boundary of registered, governed context. Uncited claims are stripped or flagged.

---

## Stage 3: Feedback — Consumer Reports an Issue

### 3.1 Submitting Feedback

**Where:** Atlas Portal (Feedback form)

Two scenarios trigger feedback:

**Scenario A — Content issue:** Consumer finds the Private Link setup steps in Confluence are outdated (the endpoint URL changed in March 2026), but the Source is still marked `authoritative`.

**Scenario B — Metadata gap:** Consumer searches for "Textract logging" and finds no registered Source.

Consumer actions:

1. Click "Report Issue" on the Portal.
2. Select feedback type: `stale`.
3. Write: *"The Private Link setup steps reference the old endpoint URL — it changed in March 2026."*
4. Submit → Portal calls `POST /feedback`.

Context Layer persists the Feedback to DynamoDB (if `ATLAS_FEEDBACK_TABLE` is configured) or in-memory:

```json
{
  "id": "fb-001",
  "target_type": "source",
  "target_id": "textract-networking-confluence",
  "feedback_type": "stale",
  "message": "The Private Link setup steps reference the old endpoint URL — it changed in March 2026.",
  "submitted_at": "2026-05-11T10:30:00Z"
}
```

### 3.2 V1 Limitation: Feedback Does Not Auto-Act

Atlas records the signal. In V1, Feedback does **not** automatically:

- Notify the Steward team (no alert/webhook integration built in).
- Change `authority_level` or `last_reviewed_at` on the Source.
- Create a Jira ticket or Slack message.

Feedback in V1 is a **passive data pool**. It requires Stewards to actively query it, or for the organization to wire an external process (e.g., a weekly script that exports Feedback to a Slack channel or ticket queue).

---

## Stage 4: Maintenance — Steward Responds to Change and Feedback

This is the most operationally complex stage. It directly addresses how Atlas stays trustworthy over time without becoming a second CMS.

### 4.1 Maintenance Triggers

| Trigger | Condition | Impact |
|---------|-----------|--------|
| **Content update** | Source Author edits the Confluence page (heading renamed, content rewritten) | Anchor may become `broken`; excerpt may be stale |
| **Review expiry** | `now - last_reviewed_at > review_frequency` (e.g., 90 days) | Source flagged "Needs Review" in context bundle warnings |
| **Feedback accumulation** | Multiple `stale` / `broken` Feedback records point to the same Source | Steward should investigate |
| **Page moved or deleted** | Confluence URL changes or page is archived | Source `location` invalid; all Anchors `broken` |

### 4.2 Scenario A: Confluence Content Changes, Anchor Breaks

1. **Source Author** edits the Confluence page: renames "Private Link Setup" to "AWS Private Link Configuration" and updates the content.

2. **Atlas System** on the next request: tries to resolve the old selector (`heading_path: ["Private Link Setup"]`) → resolution fails → the context bundle includes:
   ```json
   {
     "warnings": [{
       "type": "broken_anchor",
       "anchor_id": "textract-networking-privatelink",
       "message": "Heading 'Private Link Setup' not found on Confluence page"
     }]
   }
   ```
   The bundle falls back to source-level context (less precise, but the request does not fail).

3. **Consumer** sees a "Broken Anchor" warning in Portal and may submit Feedback.

4. **Steward** (cloud-network-team) receives the signal (via Feedback query, routine review, or someone noticing the Portal warning):
   - Opens the Confluence page, confirms the heading was renamed.
   - Updates the Anchor selector in the Git repo:
     ```yaml
     anchor:
       id: "textract-networking-privatelink"
       selector:
         heading_path: ["AWS Private Link Configuration"]
         heading_slug: "aws-private-link-configuration"
       status: "valid"
       last_validated_at: "2026-05-11"
       content_fingerprint: "d4e5f6..."
     ```
   - Updates the Source's `last_reviewed_at: "2026-05-11"`.
   - Opens a PR → review → merge → loader writes to DynamoDB.

**Critical point:** The Steward updates **Atlas registry metadata** (selector, fingerprint, validation timestamp), not Confluence content. Content authoring stays in Confluence. Atlas metadata is the thin governance layer on top.

### 4.3 Scenario B: Review Frequency Expires

1. Atlas System, during context bundle assembly, checks `now - last_reviewed_at > review_frequency` → automatically attaches:
   ```json
   {
     "warnings": [{
       "type": "needs_review",
       "source_id": "textract-networking-confluence",
       "last_reviewed_at": "2026-02-10"
     }]
   }
   ```

2. Portal renders: 🟡 "Needs Review — last reviewed 90+ days ago."

3. **Steward** sees the warning:
   - Opens the Confluence page, verifies content is still accurate.
   - If accurate: updates only `last_reviewed_at` (metadata-only change; content unchanged).
   - If outdated: coordinates with the Source Author to update Confluence first, then updates Anchors and fingerprint.

### 4.4 The Role of `content_fingerprint`

If the Anchor has a `content_fingerprint` from the last validation, Atlas can compare it against a hash of the live Confluence content at request time. A mismatch adds:

```json
{ "type": "content_changed_since_validation", "anchor_id": "..." }
```

This provides a **drift detection** mechanism — even without automated sync, Atlas can flag that the source may have diverged from what was last validated. This partially answers the "how to prevent registry drift without becoming a second CMS" question from §6.1: Atlas detects drift and surfaces it as a signal; it does not auto-sync.

### 4.5 Feedback-Driven Maintenance Loop

1. Steward team periodically queries Feedback (or an external script exports it to Slack/Jira).

2. Group by `target_type` + `feedback_type`: *"3 stale reports on textract-networking-confluence."*

3. Steward:
   - Verifies in Confluence → updates content if needed.
   - Updates registry metadata in Git/API → PR → merge.
   - (Optionally) marks Feedback as resolved if the data model supports resolution state.

**What V1 does not do:** auto-close Feedback, auto-notify Stewards, enforce SLAs. These require the organization to integrate Atlas Feedback into their own operational workflows.

---

## Stage 5: Retirement — Source is Deprecated or Replaced

**Where:** Git repository / API

When a Confluence page is superseded (e.g., Textract networking guidance is merged into a broader "AWS Networking Standards" document):

1. **Steward** does not delete the Source record (preserves audit trail). Instead, updates:
   ```yaml
   source:
     id: "textract-networking-confluence"
     authority_level: "deprecated"
   ```

2. If a replacement Source exists, add a new mapping to the Topic for the new Source. The old mapping stays (optional `superseded_by` reference to the new Source).

3. **Portal** renders:
   - ❌ deprecated badge in muted style.
   - *"This source has been deprecated. See AWS Networking Standards for current guidance."*
   - The deep link to Confluence is preserved for historical reference.

4. **Consumer** sees the deprecated marker and naturally shifts to the new authoritative source via the Topic page.

---

## Full Lifecycle Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Confluence                                │
│                                                                  │
│  Source Author: creates / edits page content                     │
│  (The sole content authoring surface — Atlas never replaces it)  │
└──────────────┬───────────────────────────────────────────────────┘
               │ page published / updated
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Git Repo + Atlas API                             │
│                                                                  │
│  Curator (registration):                                         │
│    - Registers Source (authority_level, scope, steward,          │
│      location, review_frequency)                                 │
│    - Registers Anchors (selector, strategy)                      │
│    - Creates Topic + Source-Topic Mapping                        │
│                                                                  │
│  Steward (maintenance):                                          │
│    - Updates Anchor selectors when Confluence headings change    │
│    - Updates last_reviewed_at after periodic review              │
│    - Updates content_fingerprint after validation                │
│    - Changes authority_level → deprecated on retirement          │
│    - Reviews Feedback records → decides maintenance priority     │
│                                                                  │
│  All changes via PR-reviewed YAML/JSON seed files                │
└──────────────┬───────────────────────────────────────────────────┘
               │ seed loading / API writes
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Atlas Context Layer                             │
│                                                                  │
│  Stores: Source / Topic / Anchor / Mapping / Feedback metadata   │
│  Does at request time:                                           │
│    - Fetches excerpts from Confluence API (no durable mirror)    │
│    - Resolves Anchor selectors against live content              │
│    - Detects: broken anchors, stale sources, fingerprint drift   │
│    - Assembles context bundles (warnings + authority +           │
│      provenance + citations + expansion paths)                   │
│  Never: stores full source content, calls LLMs, reasons or       │
│    recommends                                                    │
└──────────────┬───────────────────────────────────────────────────┘
               │ Context API (consumer-neutral)
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Atlas Portal                                 │
│                                                                  │
│  Consumer:                                                       │
│    - Browses Topics by category → sees Source list with          │
│      authority badges, freshness, steward info                   │
│    - Expands Anchors → reads excerpts + clicks deep links        │
│      to Confluence for full reading                              │
│    - Ask Atlas → governed AI Q&A (LLM bound to context bundle    │
│      only; uncited claims stripped)                              │
│    - Submits Feedback → stale / broken / missing / unclear       │
│                                                                  │
│  Future consumers (CLI, MCP, agents) use the same Context API    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Direct Answers to §6 Open Questions

### §6.1 — Who manages sources without an admin UI?

- **Curator** (Atlas/DevEx team) handles registration and retirement.
- **Steward** (the team named on each Source) handles ongoing metadata accuracy for sources they own.
- **Process:** PR-reviewed YAML/JSON seed files in Git → loader → DynamoDB. GitOps, not UI operations.
- **Drift prevention:** `content_fingerprint` comparison + `review_frequency` expiry warnings + Feedback signals → human intervention. V1 does not auto-sync.

### §6.2 — How is the system maintained over time?

- Source Author changes Confluence → Anchor may break → Atlas marks warning at request time → Portal displays it + Consumer submits Feedback → Steward investigates → updates Git-based registry metadata → PR merge → registry healthy again.
- The Feedback loop requires the organization to wire Atlas Feedback into its own ticketing/Slack workflows. Atlas records signals; it does not replace ownership workflows unless the org connects them.

### §6.3 — Is this just a link aggregator?

No. A link aggregator lacks: authority levels, authority scopes, freshness warnings, broken anchor detection, fingerprint-based drift detection, context bundle assembly, citation provenance, and the constraint that AI answers must ground themselves in registered context. Atlas's core value is the **governance layer**, not the navigation layer.

### §6.4 — How much content lives inside Portal vs stays in Confluence?

Current design: Portal shows excerpts + provenance + deep links. Full reading happens in Confluence. This keeps the canonical document ownership unambiguous while providing enough inline context for users to judge relevance.

### §6.5 — Is the current implementation pilot or production-ready?

The current implementation (TS seed + in-memory storage + optional DynamoDB for Feedback only) is a **contract + UX proof**, not a production-ready registry persistence solution. This should be clearly stated to stakeholders so they do not assume full registry operations are already live.
