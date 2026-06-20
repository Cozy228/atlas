# Atlas — Cloud Platform DevEx Portal & Governed Context Layer

> **Status:** Foundational thesis. The current *settled* product identity and MVP boundary
> live in [`../product/mvp-product-design.md`](../product/mvp-product-design.md); decisions are in
> [`../adr/`](../adr/). Where this doc disagrees with those, **they win.**

## Product Definition

Atlas is a **governed internal cloud knowledge context layer** that powers a **Cloud Platform DevEx Portal**.

These are two faces of the same product:

- **Externally (to the organization):** Cloud Platform DevEx Portal — a unified, information-centric entry point for application teams to discover cloud platform capabilities, navigate landing zones, find authoritative guidance, and get AI-assisted answers with citations.
- **Internally (to the technical team):** Atlas Context Layer — a governed source registry with authority mapping, locator resolution, and consumer-neutral context delivery API.

Portal is Atlas's first consumer, not Atlas's parent. The Context Layer API simultaneously serves the Portal, AI agents, and future automation flows. Portal UI requirements do not define the Context Layer's data model or system boundary.

## Core Principles

1. **Source-native.** Atlas does not replace Terraform repositories, Confluence, or policy documents. Source systems remain the system of record. Atlas knows where sources live, what they are authoritative for, and how to locate precise sections within them.

2. **Authority-aware.** Every registered source has an explicit authority scope and level. Atlas routes consumers to the right evidence based on authority, not just keyword relevance.

3. **Consumer-neutral.** The Context Layer API serves Portal, AI agents, and future consumers through the same interfaces. No consumer gets a privileged data path.

4. **Deterministic core.** Atlas performs source registration, authority routing, locator resolution, visibility signaling, and context packaging through deterministic logic. Judgment, interpretation, and recommendation stay with consumers.

5. **Portal is a consumer, not the architecture.** Portal's UX needs are met by consuming the Context Layer API. Portal does not own the data model, authority logic, or source governance.

6. **No Auth in V1.** V1 intentionally does not add user authentication, registration, or identity-based application access. It assumes a trusted internal operating environment. Visibility remains a source metadata and warning signal, not a V1 identity enforcement system.

## System Architecture

```
┌─────────────────────────────────────────────┐
│              Consumer Layer                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Portal   │  │ AI Agent │  │  Future    │  │
│  │(TanStack  │  │ Consumer │  │ Automation │  │
│  │  Start)   │  │          │  │            │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │         │
├───────┴──────────────┴──────────────┴────────┤
│           Atlas Context Layer API            │
│  ┌─────────────────────────────────────────┐ │
│  │ Source Registry  │ Topic Registry       │ │
│  │ Authority Mapping│ Visibility Signals   │ │
│  │ Locator Resolution │ Context Packaging  │ │
│  └─────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│         Source Systems (unchanged)           │
│  Terraform Repos │ Confluence │ Policy Docs  │
└──────────────────────────────────────────────┘
```

### System Boundary

Atlas owns:

- Source registry and governance metadata
- Topic registry (navigation entities for Portal)
- Source-Topic mapping
- Authority mapping and routing
- Type-specific locator and anchoring strategies
- Source selection interfaces
- Excerpt and expansion interfaces
- Context packaging and progressive disclosure
- Visibility metadata and access warning packaging

Atlas does not own:

- Source content authoring
- Source content as the primary system of record
- Semantic reasoning or advice generation
- Shadow service catalog or precomputed domain truth layer
- Write-back into source systems
- Downstream workflow execution

### Deterministic and Latent Boundary

Atlas owns deterministic work:

- Source registration
- Authority mapping
- Visibility signal packaging
- Locator and anchor resolution
- Context bundle assembly
- Citation and provenance packaging

Consumers own latent work:

- Interpreting returned context
- Deciding which evidence matters most
- Synthesizing recommendations or advice
- Choosing follow-up questions or actions

## Data Model

Atlas keeps governance, navigation, location, and user feedback separate. Governance lives on Source. Navigation lives on Topic. Source-native addressability lives on Anchor. Operational feedback lives on Feedback. These concerns do not contaminate each other.

### Source (Governance Entity)

A Source represents a registered, governed piece of cloud knowledge.

| Field | Type | Description |
|---|---|---|
| id | string | Stable unique identifier |
| title | string | Human-readable name |
| source_class | enum | `terraform-module` / `confluence-page` / `policy-document` |
| location | string | URL or repository path |
| steward | string | Maintaining team |
| visibility | enum | `internal` / `restricted` |
| authority_scope | string[] | What this source is authoritative for (e.g. `module-usage`, `security-guardrail`, `reference-guidance`) |
| authority_level | enum | `authoritative` / `reference` / `example` / `draft` / `deprecated` |
| last_observed_at | timestamp | Last time content was observed |
| last_reviewed_at | timestamp | Last human review |
| review_frequency | duration | Suggested review cycle |

### Topic (Navigation Entity)

A Topic is what users look for — a capability, a landing zone, or a guardrail area.

| Field | Type | Description |
|---|---|---|
| id | string | Stable unique identifier |
| name | string | Display name (e.g. "AWS Textract", "Central Landing Zone") |
| topic_type | enum | `capability` / `landing-zone` / `guardrail-area` |
| category | string | Domain classification (e.g. `ai-ml`, `compute`, `network`, `security`) |
| status | enum | `active` / `deprecated` / `planned` |
| description | string | One-line summary |
| owner_team | string | Responsible team |
| support_channel | string | Support path |
| entry_tools | object[] | Related operational tool entry points (TFE link, Harness link) |

### Anchor (Addressability Entity)

An Anchor represents a stable, source-native location inside a Source. Atlas stores the selector needed to find that location at request time; it does not store a permanent copy of the source content.

| Field | Type | Description |
|---|---|---|
| id | string | Stable unique identifier |
| source_id | string | Source this anchor belongs to |
| anchor_strategy | enum | `markdown-heading` / `confluence-section` / `document-clause` |
| title | string | Human-readable section or clause name |
| selector | object | Source-class-specific locator, such as file path plus heading path, Confluence page section, or document clause ID |
| citation_label | string | Human-readable citation text for consumers |
| content_fingerprint | string | Optional hash used to detect drift without storing full content |
| status | enum | `valid` / `broken` / `weak` / `unvalidated` |
| last_validated_at | timestamp | Last validation time |

Example selectors:

```json
{
  "type": "markdown-heading",
  "file_path": "README.md",
  "heading_path": ["Usage", "Private subnet"],
  "heading_slug": "private-subnet"
}
```

```json
{
  "type": "confluence-section",
  "page_id": "123456",
  "heading_path": ["AWS Textract", "Networking"],
  "heading_slug": "networking"
}
```

### Source-Topic Mapping

Many-to-many. A source can serve multiple topics. A topic aggregates multiple sources.

Authority and governance metadata stay on the Source, never duplicated onto the Topic.
Topic-specific default anchors may be referenced from the mapping, but anchor selectors remain owned by Anchor records.

```
Topic: AWS Textract (capability)
  ├── Source: textract-module-readme    (authority: module-usage, level: authoritative)
  ├── Source: textract-security-policy  (authority: security-guardrail, level: authoritative)
  └── Source: textract-arch-guidance    (authority: reference-guidance, level: reference)

Topic: S3 Guardrails (guardrail-area)
  ├── Source: s3-policy-doc             (authority: security-guardrail, level: authoritative)
  ├── Source: textract-security-policy  (authority: security-guardrail, level: authoritative)  ← shared
  └── Source: s3-module-readme          (authority: module-usage, level: authoritative)
```

### Feedback (Operational Signal)

Feedback records user-reported missing, stale, broken, or unclear guidance. It is not authoritative source content and does not change Source, Topic, or Anchor truth by itself.

| Field | Type | Description |
|---|---|---|
| id | string | Stable or generated identifier |
| target_type | enum | `topic` / `source` / `anchor` |
| target_id | string | Referenced Topic, Source, or Anchor |
| feedback_type | enum | `missing` / `stale` / `broken` / `unclear` |
| message | string | Free-text user message |
| submitted_at | timestamp | Submission time |

### Source Onboarding Principle

Atlas distinguishes between new source instances and new source classes.

- Adding a new source instance requires only a new registry entry.
- Adding a new anchor strategy happens only when Atlas supports a genuinely new source class.
- V1 prefers source classes whose native structure is already addressable by headings, sections, or stable anchors.

## Context Delivery Model

Atlas's primary output is a **context bundle**, not a page and not a recommendation.

A context bundle contains:

- Selected sources and why they were selected
- Selected anchors and why they were selected
- Exact sections or excerpts, or anchor references that can be expanded on demand
- Authority and provenance metadata
- Sufficient surrounding context to prevent misinterpretation
- Expansion paths for further disclosure
- Warnings for stale, broken, conflicting, unavailable, or restricted evidence

### Two Access Paths

1. **Discovery path.** Consumer provides a topic, question, or keyword. Atlas returns relevant sources ranked by authority.
2. **Expansion path.** Consumer provides a known source or anchor. Atlas returns precise excerpts plus surrounding context.

### Progressive Disclosure

| Level | What is returned |
|---|---|
| 0 | Source list + selection rationale + authority badges + anchor references |
| 1 | Exact sections or excerpts for selected anchors |
| 2 | Adjacent supporting evidence |
| 3 | Deep expansion into related sources |

Both Portal and AI Agent consumers follow this disclosure pattern. The first response is small and precise. The consumer requests more when needed.

## V1 Scenarios

V1 proves the full chain — source registry → authority mapping → locator resolution → context delivery → consumer presentation — through three scenarios. These are not independent modules; they are three consumption paths over the same Context Layer.

### Scenario 1: Capability Discovery

**User question:** "What AI/ML capabilities does the platform offer? How do I use Textract?"

**Portal surface:** Capability card list filtered by category → detail page with overview, how-to-start steps, authoritative sources with badges, support path, tool entry points.

**Context Layer path:** Query topic registry (topic_type=capability) → select associated sources → retrieve authority metadata → package context bundle.

### Scenario 2: Landing Zone Navigation

**User question:** "Where should my application be deployed? What are the guardrails for the central landing zone?"

**Portal surface:** Landing zone cards → environment matrix, onboarding path, guardrail summary, tool entry points.

**Context Layer path:** Query topic registry (topic_type=landing-zone) → select associated sources → retrieve guardrail excerpts → package context bundle.

### Scenario 3: AI Consumer Discovery

**User question:** "How do I use Textract from a private subnet?"

**Consumer surface:** Portal Ask UI, local AI agent skill, CLI assistant, MCP tool, or automation workflow with inline citations, authority badges, source freshness indicators, and expansion links.

**Context Layer path:** Source selection → excerpt retrieval → authority packaging → context bundle returned to consumer.

**AI consumer path:** Receive context bundle → send bundle + user question to LLM → LLM reasons over governed context → present cited answer or take a bounded follow-up action.

## AI Consumer Design

### Architectural Boundary

LLM reasoning is a consumer responsibility, not an Atlas responsibility. Atlas provides precise, governed context. The AI consumer interprets it. Ask Atlas is one Portal presentation of this contract, not the only AI consumer.

```
AI Consumer (Portal Ask UI / local agent skill / CLI / MCP tool)
  1. Receive user question
  2. Call Atlas API → get context bundle
  3. Send context bundle + question → LLM
  4. LLM reasons over governed context, generates answer
  5. Present answer or action with citations + authority badges

Atlas Context Layer API
  - Deterministically select relevant sources
  - Resolve anchors, extract excerpts
  - Package authority + provenance
  - Return context bundle
  - No reasoning, no recommendations, no judgment
```

### AI Consumer Constraint Rules

- Answers only based on registered authoritative sources
- Must display citations (which source, which section)
- Must display authority level badge
- Authority conflict → surface both sources with conflict warning
- Stale source → display freshness warning
- No registered source found → explicitly state "no registered authoritative source found"
- Must not generate Terraform code and claim it is production-ready
- Must not bypass policy or substitute for approval processes

## Execution Model

V1 prefers request-time resolution. No pre-ingested content index, no async ingest pipeline, no background worker fleet.

1. Look up governed sources and authority metadata
2. Select candidate sources for the request
3. Resolve source-native locators or anchors
4. Retrieve exact excerpts and adjacent context
5. Return context bundle with citation and expansion paths

If caching becomes necessary for performance, treat it as an implementation optimization, not as the architectural model.

## Governance

### V1 Governance Rules

- Every registered source has a steward
- Authority level is explicit for every governed source
- Visibility boundaries are recorded
- Anchors are validated at registration time
- Sources past review_frequency are flagged "Needs Review"
- Broken anchors are flagged "Broken Anchor"
- Authority conflicts across sources for the same question are surfaced, not hidden

### Quality Signal Propagation

Context bundles do not pretend evidence is complete. If a source is stale, an anchor is broken, or authority is unclear, the bundle carries these warnings. Consumers decide how to handle them.

### Upstream Impact

V1 minimizes workflow change for source owners:

- Source owners do not maintain an additional metadata contract
- Source systems remain the authoring surface
- Governance metadata is curated centrally or incrementally by the Atlas team

## V1 Scope

### In Scope

| Capability | Description |
|---|---|
| Source Registry | Register and manage Terraform repos, Confluence pages, policy docs |
| Topic Registry | Register capabilities and landing zones as navigation entities |
| Source-Topic Mapping | Many-to-many mapping with authority scope |
| Authority Mapping | Authority scope and level per source |
| Locator Resolution | Anchor strategies for 3 source classes |
| Context Bundle API | Consumer-neutral context delivery interface |
| Portal: Capability Discovery | Browse and detail view for topic_type=capability |
| Portal: Landing Zone Navigator | Navigation, environment matrix, guardrail summary for topic_type=landing-zone |
| AI Consumer Contract | Context bundle contract usable by Portal Ask UI, local agent skills, CLI tools, MCP tools, and automation workflows |
| No Auth operating model | Trusted internal V1 surface with no user registration, login, SSO, or identity-based application access |
| Pilot content | 10-15 core topics with registered sources |

### Out of Scope

| Not in V1 | Reason |
|---|---|
| Provisioning portal | Boundary conflict with TFE / Harness |
| Full CMDB / Service Catalog | Too heavy; V1 has topic registry only |
| Shadow content store | Violates source-native principle |
| AI-generated doc modifications | Authority risk |
| Full document migration | Ownership problems |
| Pre-computed content index | V1 uses request-time resolution |
| Full platform capability coverage | Pilot scope; 10-15 core topics first |
| Write-back memory layer | No synthesized content written to source systems |
| Background ingest pipeline | Not needed for request-time model |
| User authentication or registration | V1 intentionally uses a trusted internal operating model |

## Failure Modes

| Failure | Correct behavior |
|---|---|
| Relevant source not registered | State "no registered source found"; offer feedback path |
| Authority unclear across sources | Surface conflict; do not pick sides |
| Broken anchor or link | Flag "Broken Anchor"; fall back to source-level context |
| Source permission mismatch | Flag the source as restricted or unavailable; do not add a user auth flow |
| Weak anchoring for source class | Flag "weak anchoring"; provide source-level context only |
| AI answer has no registered source support | Do not fabricate; state "beyond registered knowledge scope" |
| Context bundle too broad or narrow | Provide expansion / narrowing paths for consumer adjustment |

## Success Criteria

### Context Layer Quality (Internal)

| Metric | What it measures |
|---|---|
| Source selection precision | Are returned sources relevant to the query? |
| Anchor resolution success rate | Do anchors resolve to valid content? |
| Citation completeness | Does the context bundle include full provenance? |
| Visibility warning correctness | Are restricted or unavailable source signals accurate? |
| Context bundle size | Is returned context precise and bounded? |

### Portal Experience (External)

| Metric | What it measures |
|---|---|
| Time to find right source | Has discovery time decreased? |
| AI answer citation rate | What percentage of AI answers include citations? |
| Stale/broken source visibility | Are quality issues effectively flagged? |
| Topic authority coverage | Do core topics have authoritative source coverage? |
| User return rate | Do users come back? |
