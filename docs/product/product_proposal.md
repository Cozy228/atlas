# Atlas Product Proposal

## Executive Summary

Atlas is an internal cloud platform portal for application teams.

It helps teams discover cloud platform capabilities, navigate landing zones, find authoritative guidance, and ask citation-backed cloud platform questions from one place. Atlas does not replace Terraform Enterprise, Harness, Confluence, Git repositories, or policy documents. It organizes them into a governed product experience.

The human-facing product is **Atlas Portal**. The backend capability is **Atlas Context Layer**. The Context Layer registers governed sources, maps authority, resolves source-native anchors, and returns context bundles that the Portal, AI consumers, and future automation can use.

V1 should prove a narrow but complete loop:

1. A user can find a platform capability or landing zone in Atlas Portal.
2. Atlas can show the right owner, support path, tool entry point, and authoritative sources.
3. Atlas can retrieve citation-ready context from registered sources.
4. Ask Atlas can answer only from registered context and show citations.

## Product Naming

| Name | Meaning |
|---|---|
| Atlas | Product name and umbrella brand |
| Atlas Portal | Human-facing internal cloud platform portal |
| Atlas Context Layer | Backend governed context layer |
| Atlas Context API | Consumer-neutral API exposed by the Context Layer |
| Ask Atlas | AI-assisted question experience in the Portal |

This naming keeps the product simple for users: they open Atlas. Internally, engineering can still preserve the Context Layer boundary.

## Why Now

Cloud platform knowledge is spread across Terraform modules, Confluence pages, policy documents, architecture notes, request forms, TFE workspaces, and Harness pipelines.

The current problem is not only missing documentation. The deeper issue is that application teams cannot reliably answer:

- What platform capabilities exist?
- Which landing zone should I use?
- Which document is authoritative?
- Where do I start?
- Which tool should I use next?
- Who owns this capability?
- Is the guidance still current?

The organization already has tooling. The missing layer is product experience: a unified, governed, information-centric entry point.

## Product Definition

Atlas is an internal cloud platform portal backed by a governed context layer.

It is:

- **Information-centric**, not provisioning-centric.
- **Source-native**, because existing systems remain the source of truth.
- **Authority-aware**, because it shows which sources are official, reference, draft, deprecated, or stale.
- **Navigation-first**, because application teams need to find the right capability, landing zone, guidance, and support path.
- **AI-ready**, because Ask Atlas can reason over governed context without becoming the authority itself.

Atlas is not:

- A provisioning portal.
- A replacement for Terraform Enterprise or Harness.
- A full CMDB or service catalog.
- A replacement for Confluence or policy documents.
- A general-purpose enterprise search engine.
- A system that lets AI rewrite authoritative documentation automatically.

## User Jobs

Atlas should support these jobs first:

| User Job | Atlas Response |
|---|---|
| I want to use an approved AWS capability | Show the capability page, owner, tool entry points, source badges, and how-to-start path |
| I need to understand landing zones | Show landing zone cards, environment matrix, guardrails, onboarding path, and support path |
| I need the official guidance | Show authoritative sources, review status, and exact source locations |
| I have a cloud platform question | Ask Atlas returns a cited answer based only on registered sources |
| I found stale or missing guidance | Provide a feedback path tied to source owner and topic owner |

## V1 Product Scope

V1 should be broad enough to feel like a real portal, but narrow enough to prove the mechanism.

### In Scope

| Surface | V1 Behavior |
|---|---|
| Portal Home | Task-oriented entry point for application teams |
| Capability Discovery | Browse 10-15 pilot platform capabilities |
| Capability Detail Page | Show overview, owner, support path, entry tools, authoritative sources, and source warnings |
| Landing Zone Navigator | Show landing zone cards, environment matrix, guardrail summary, onboarding path, and tool links |
| Authoritative Source Lookup | Surface registered sources, authority level, review freshness, and broken-anchor warnings |
| Ask Atlas | AI answer with citations, authority badges, and source freshness signals |
| Feedback Path | Let users report missing capability, stale source, broken link, or unclear guidance |

### Out of Scope

| Not in V1 | Reason |
|---|---|
| Provisioning workflows | TFE and Harness remain the operational systems |
| Landing zone creation | Too much approval, policy, and workflow complexity for V1 |
| Full CMDB or service catalog | V1 is about platform capabilities and landing zones, not all app assets |
| Full document migration | Source systems remain the authoring surfaces |
| General-purpose search | V1 uses registry lookup and authority mapping, not full-text or vector search |
| AI-generated source edits | Owners approve source changes outside Atlas |
| Admin UI for registry management | V1 can use seed data or API-based registration |

## Atlas Portal Experience

### Home

The home page should be organized around user intent, not tools.

Primary entry points:

- Onboard a new application.
- Use an approved AWS capability.
- Understand landing zones.
- Find authoritative guidance.
- Deploy with Terraform Enterprise.
- Deploy with Harness.
- Check cloud guardrails.
- Get support.
- Ask Atlas.

The home page should also show recently updated capabilities, stale or broken source warnings, and commonly used capability cards.

### Capability Page

Each capability page should answer:

- What is this capability?
- When should I use it?
- When should I not use it?
- How do I start?
- Which landing zones support it?
- Which tools do I use next?
- Which sources are authoritative?
- Who owns it?
- Where do I get support?
- Is the guidance current?

The page should not duplicate long-form documentation. It should provide a structured navigation and evidence layer over existing sources.

### Landing Zone Navigator

The Landing Zone Navigator should answer:

- What landing zones exist?
- Which workloads fit each landing zone?
- Which environments are supported?
- Which guardrails apply?
- Which tool handles provisioning?
- Which tool handles deployment?
- Who owns the landing zone?
- What is the onboarding path?

It is not a landing zone management portal. It is a navigation and guidance surface.

### Ask Atlas

Ask Atlas is the AI-assisted discovery path.

It should:

- Answer from registered Atlas context bundles only.
- Show citations for factual claims.
- Display authority and freshness signals.
- Surface conflicts instead of hiding them.
- Say when no registered authoritative source exists.
- Provide expansion links back to sources and related topics.

It should not:

- Approve exceptions.
- Provision cloud resources.
- Generate production-ready Terraform and present it as approved.
- Bypass security policy.
- Rewrite authoritative documents automatically.

## Atlas Context Layer

The Context Layer is the backend part of Atlas. It provides governed context delivery to Atlas Portal, Ask Atlas, AI agents, and future consumers.

It owns:

- Source registry.
- Topic registry.
- Source-topic mapping.
- Authority mapping.
- Access and visibility filtering.
- Locator and anchor resolution.
- Context bundle assembly.
- Citation and provenance packaging.
- Warning propagation for stale, broken, inaccessible, or conflicting evidence.

It does not own:

- Source content authoring.
- Source systems as the system of record.
- Semantic reasoning.
- Recommendations.
- Workflow execution.
- AI model invocation.

The key boundary is simple: **Atlas Context Layer selects, resolves, and packages evidence. Consumers interpret it.**

## Data Model Summary

V1 should keep three core records:

| Record | Purpose |
|---|---|
| Source | Governance entity: where knowledge lives, who stewards it, what it is authoritative for, and how anchors resolve |
| Topic | Navigation entity: what users search or browse for, such as capability, landing zone, or guardrail area |
| SourceTopicMapping | Relationship entity: which sources support which topics |

Governance fields live on Source. User navigation fields live on Topic. The mapping keeps the relationship explicit without turning Atlas into a CMDB.

## System Shape

```
Application Teams
        |
        v
Atlas Portal
  - Home
  - Capability Discovery
  - Landing Zone Navigator
  - Authoritative Source Lookup
  - Ask Atlas
        |
        v
Atlas Context API
  - Source Registry
  - Topic Registry
  - Source-Topic Mapping
  - Authority Mapping
  - Locator Resolution
  - Context Bundle Packaging
        |
        v
Existing Source Systems
  - Terraform module repositories
  - Confluence pages
  - Policy documents
  - TFE links
  - Harness links
```

## Technology Direction

| Component | Direction |
|---|---|
| Atlas Portal | TanStack Start + Vite |
| Atlas Context API | API Gateway + Lambda |
| Registry store | DynamoDB |
| Source retrieval | Request-time retrieval from registered source systems |
| Source credentials | Secrets Manager or Parameter Store |
| AI reasoning | Portal-side adapter, such as Bedrock or another approved model provider |
| Observability | CloudWatch |

V1 should not add OpenSearch, queues, Step Functions, or a background ingestion system. If caching is needed, it should be TTL-based and disposable.

## Governance Model

Atlas only works if governance stays visible and lightweight.

V1 rules:

- Every Source has a steward.
- Every Topic has an owner team.
- Every Source has an authority level.
- Every Source has an authority scope.
- Every Source has a visibility boundary.
- Registered anchors are validated.
- Stale sources are flagged.
- Broken anchors are flagged.
- Authority conflicts are surfaced.
- Users can report missing, stale, or unclear guidance.

Source owners should not need to migrate their content or maintain a second documentation system. Atlas should curate only the metadata needed to route users and AI consumers to the right evidence.

## Success Metrics

Atlas should be measured as both a portal and a context layer.

### Product Metrics

| Metric | Meaning |
|---|---|
| Time to find right source | Users can locate the official guidance faster |
| Search or question success rate | Users find a useful next step |
| Capability discoverability | Users can find supported platform capabilities |
| Landing zone navigation success | Users understand where to deploy and how to start |
| Support deflection | Repeated basic support questions decrease |
| Return usage | Users come back because Atlas is useful |

### Context Quality Metrics

| Metric | Meaning |
|---|---|
| Topic authority coverage | Pilot topics have authoritative sources |
| Source selection precision | Returned sources are relevant |
| Anchor resolution success rate | Exact sections resolve correctly |
| Citation completeness | Context bundles include source and section provenance |
| Warning visibility | Stale, broken, restricted, or conflicting sources are visible |
| Context bundle size | Returned context is bounded and useful |

## Phased Roadmap

These phases describe delivery order, not separate product visions. Phase 0 through Phase 2 together form the practical V1 path; Phase 3 is the likely follow-up once the core experience is credible.

### Phase 0: Product Shell and Pilot Content

Goal: make Atlas tangible to stakeholders.

Deliver:

- Atlas Portal home.
- 10-15 pilot topics.
- Capability detail page template.
- Landing Zone Navigator template.
- Source badge display.
- Owner and support path display.

### Phase 1: Governed Context Layer

Goal: make Atlas more than a static portal.

Deliver:

- Source registry.
- Topic registry.
- Source-topic mapping.
- Authority levels and scopes.
- Anchor strategy for Terraform module repositories, Confluence pages, and policy documents.
- Context bundle API.
- Warning model.

### Phase 2: Ask Atlas

Goal: prove governed AI-assisted documentation discovery as the AI-facing V1 increment.

Deliver:

- Portal-side LLM adapter.
- Prompt construction from context bundles only.
- Citation validation.
- AI answer UI with citations, authority badges, and warnings.
- No-source-found and conflict-handling behavior.

### Phase 3: Documentation Health

Goal: make documentation quality visible and maintainable.

Deliver:

- Broken source reporting.
- Stale source reporting.
- Missing topic feedback.
- Owner review workflow handoff.
- Health dashboard for pilot topics.

## Key Tradeoffs

### Portal Name

Using Atlas as the product and portal name creates a simpler user story: "Go to Atlas." Keeping "Context Layer" only for architecture avoids exposing backend terminology to application teams.

### Portal vs Context Layer

Atlas should be sold as a product experience and built with a strict backend boundary. This avoids two failure modes: a backend-only platform nobody understands, and a portal-only website that becomes another stale documentation surface.

### AI in V1

Ask Atlas is valuable because the guideline explicitly points toward AI-based documentation discovery. The risk is scope growth. The control is that Ask Atlas uses only registered context bundles and does not own reasoning authority inside the Context Layer.

### Content Maintenance

Atlas should not create long-form duplicate pages. Capability and landing zone pages should be structured navigation surfaces over existing authoritative sources. This keeps Atlas aligned with consolidation rather than adding another documentation system.

## Recommended Positioning Statement

Atlas gives application teams one place to discover cloud platform capabilities, understand landing zones, find authoritative guidance, and ask citation-backed platform questions.

It does not replace existing tools or documentation. It turns them into a governed, navigable platform experience by adding source registration, authority mapping, owner metadata, source freshness, locator resolution, and context delivery.

For leadership, Atlas is a Platform-as-a-Product experience layer. For engineering, Atlas is a portal backed by a deterministic, consumer-neutral context layer.
