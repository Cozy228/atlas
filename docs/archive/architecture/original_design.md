# Governed Internal Cloud Knowledge Context Layer Design

## Context

Internal cloud knowledge is spread across Terraform module repositories, Confluence pages, policy documents, architecture guidance, enablement notes, and team-owned content. Both humans and AI agents pay a high context-switching cost to find the right material, decide which source is authoritative, and retrieve only the sections that matter.

The problem is not only discovery. The deeper problem is that internal cloud knowledge is source-native but not context-ready. Every consumer repeatedly does the same work: locate sources, judge authority, extract useful sections, and expand into more detail when needed.

## Problem Statement

The company does not have a governed internal layer that can register cloud knowledge sources, classify their authority, and deliver precise, citation-ready context to downstream consumers.

As a result, every consumer, whether human, AI agent, portal, or workflow, must integrate with scattered source systems directly and reconstruct context on its own.

## Product Definition

The product is a **governed internal cloud knowledge context layer**.

It is **source-native**. It does not replace Terraform repositories, Confluence, or other source systems, and it does not maintain a full shadow catalog of service truths. Instead, it is the governed layer that knows:

- what internal cloud sources exist
- what each source is authoritative for
- how to locate stable sections and excerpts within each source
- how to package precise context for consumers on demand

AI agents, skills, portals, and future automation flows are **consumption forms**, not the product definition. Reasoning remains the responsibility of the consuming AI agent, not this system.

## Core Design Principle

**Source-native, authority-aware, consumer-neutral.**

V1 should preserve source content where it already lives, add only the minimum metadata needed to govern and route that content, and serve precise context bundles to consumers without precomputing a second truth model.

## Architectural Lessons Applied

This design adopts several lessons from production-grade agent knowledge systems while keeping Atlas aligned with its narrower purpose.

- **Source systems remain the system of record.** Atlas is the context and retrieval layer, not the canonical authoring surface for source content.
- **The runtime stays deterministic.** Atlas should do source registration, authority routing, locator resolution, access filtering, and context packaging through deterministic logic and stable contracts.
- **Judgment stays with the consumer.** AI agents and skills remain responsible for interpretation, synthesis, recommendation, and action.
- **No write-back memory layer in V1.** Atlas does not create compiled-truth pages, write synthesized knowledge back into source systems, or maintain a shadow memory repo.

## Business Value

The value is not "another knowledge store" and not "a recommendation engine."

The value is:
- less context switching to find relevant internal cloud knowledge
- more precise and smaller context passed to AI agents
- clearer authority and provenance for citations and evidence
- reusable context delivery across multiple consumers instead of one-off integrations

This turns scattered documents into a shared internal context surface.

## V1 Thesis

V1 should prove that a governed context layer can improve how internal cloud knowledge is discovered, selected, cited, and delivered to AI agents and other consumers, without forcing upstream teams to maintain a second truth model.

The proof does not require a broad enterprise catalog. It requires a narrow but complete mechanism:

- source registration
- authority mapping
- stable locators and anchors
- precise excerpt packaging
- progressive disclosure

## Goals

- Register and govern the initial set of cloud knowledge sources
- Classify which sources are authoritative for which kinds of questions or evidence
- Provide stable source-, section-, and excerpt-level locators
- Package precise context bundles for consumers
- Support progressive disclosure from source summary to exact excerpts
- Prove that governed context delivery improves downstream agent behavior compared with direct raw-source access

## Non-Goals

- Building the final user interface
- Building a recommendation or decision engine inside the knowledge layer
- Replacing source systems with a second full truth catalog
- Building a write-back memory layer or synthesized page store
- Requiring all upstream teams to publish a new metadata contract in V1
- Building full Terraform generation, validation, and repair loops in V1
- Covering the full internal cloud landscape in V1

## V1 Pilot Scope

V1 should be scoped around **operating capability**, not around one business domain or a precomputed catalog model.

The initial pilot should prove a closed loop for four capabilities:

- source registration for Terraform module repositories, Confluence pages, and policy or guardrail documents

## System Boundary

The knowledge context layer owns:

- the source registry
- source governance metadata
- authority mapping
- type-specific locator and anchoring strategies
- source selection interfaces over registered sources
- precise expansion interfaces for known sources and anchors
- context packaging and progressive disclosure interfaces

The knowledge context layer does not own:

- raw source authoring
- raw source content as the primary system of record
- semantic reasoning or advice generation
- a shadow service catalog or precomputed domain truth layer
- synthesized write-back into a shadow repo or source system
- downstream workflow execution

This keeps the system focused on context delivery rather than consumer-specific reasoning.

## Deterministic and Latent Boundary

Atlas should make the deterministic and latent boundary explicit.

### Atlas owns deterministic work

- source registration
- authority mapping
- access and visibility filtering
- locator and anchor resolution
- context bundle assembly
- citation and provenance packaging

### Consumers own latent work

- interpreting the returned context
- deciding which evidence matters most
- synthesizing recommendations or advice
- choosing follow-up questions or actions

This boundary keeps Atlas thin, predictable, and consumer-neutral.

## Source Model

V1 is organized around governed sources and source classes, not pre-extracted service objects.

The initial supported source classes are:

- Terraform module repositories
- Confluence pages
- policy or guardrail documents

Each registered source should capture:

- stable source identity
- source location
- source type
- visibility and access boundary
- optional version or last-observed marker when readily available from the source
- source steward or maintaining team
- content domain or topic classification
- authority classification
- available locators, or anchors

### Authority Mapping

Authority is lightweight but explicit.

The system should be able to express facts such as:

- this repository README is authoritative for module usage details
- this policy document is authoritative for guardrail language
- this architecture page is authoritative for reference guidance in a bounded area

This is not a full truth model. It is the minimum routing knowledge needed to deliver the right evidence to consumers.

### Stable Locators and Anchors

The system must do more than store links.

It should support:

- source-level access
- section-level access
- excerpt-level access
- stable citation identifiers where possible

Different source classes may need different anchor strategies. For example:

- repository -> file path, heading, or snippet range
- Confluence page -> page, section, or excerpt anchor
- policy document -> document section, clause, or cited excerpt

This allows a consumer to request precise context instead of reading an entire page or repository by default.

### Source Onboarding Principle

Atlas should distinguish between **new source instances** and **new source classes**.

- Adding a new source instance should require only a new source registration entry.
- Adding a new locator strategy should happen only when Atlas starts supporting a genuinely new source class or native anchor shape.
- V1 should prefer source classes whose native structure is already addressable by headings, sections, or equivalent stable anchors.

This avoids drifting into a design where every new source requires a new parsing subsystem.

## Context Delivery Model

V1 supports a **hybrid access model**:

1. **Discovery path**
   The consumer starts with a topic, module, service, or question and asks the layer to find relevant sources.

2. **Expansion path**
   The consumer already knows a source or anchor and asks for exact excerpts, surrounding context, or related evidence.

In V1, "discovery" means **source selection**, not a separate search platform. The layer should use the source registry, authority mapping, and source-native locators to identify sources. It does not need a pre-ingested content index or a separate semantic retrieval layer to satisfy the core design goal.

The system's primary output is a **context bundle**, not a recommendation.

A context bundle should include:

- the selected sources
- the exact sections or excerpts to inspect
- authority and provenance information
- enough surrounding context to avoid misinterpretation
- expansion paths for further disclosure

### Progressive Disclosure

1. source summary and why it was selected
2. exact sections or excerpts
3. adjacent supporting evidence
4. deeper expansion into related sources

This keeps the first response small and relevant while allowing the consumer to ask for more.

## Consumer Contract

Consumers should be able to:

- discover relevant sources for a topic, service, or module
- request precise excerpts rather than full documents
- request expansion from a known source, section, or excerpt
- retrieve authority and provenance metadata
- expand a context bundle incrementally
- see conflicts, gaps, or weak authority signals

Consumers are expected to perform the reasoning step themselves. The knowledge context layer improves the quality of that reasoning by supplying precise, governed context.

## AWS Hosting Direction

V1 should be hosted on AWS as a **source registry and context broker**, not as an ingestion or indexing pipeline.

The recommended runtime shape is:

- **API Gateway + Lambda** for the external interface
- **DynamoDB** for the source registry, authority metadata, locator strategy metadata, and access metadata
- **Secrets Manager or Parameter Store** for any source access configuration or credentials
- **CloudWatch** for logging and operational visibility

### What the AWS-hosted layer does

The AWS-hosted layer should:

- register and update governed sources
- resolve which sources are relevant for a request
- fetch or access source content on demand
- resolve source-native anchors and excerpts at request time
- package authority-aware context bundles for consumers

### What the AWS-hosted layer does not require in V1

V1 does **not** require:

- a dedicated discovery/search layer
- an asynchronous ingest pipeline
- a background worker fleet
- a precomputed excerpt index
- a persistent replicated copy of all source content

If temporary caching becomes necessary for performance or access reasons, it should be treated as an implementation optimization, not as a source-of-truth content store and not as the primary architectural model.

### Request-Time Execution Model

V1 should prefer request-time resolution:

1. look up governed sources and authority metadata
2. select candidate sources for the request
3. resolve source-native locators or anchors
4. retrieve the exact excerpts and adjacent context needed
5. return a context bundle with citation and expansion paths

This keeps the architecture aligned with the core principle: source-native, authority-aware, consumer-neutral.

## Governance and Quality Controls

The layer is only useful if it remains governed.

V1 governance rules:

- every registered source has a steward
- authority classification is explicit for governed source categories
- visibility and access boundaries are recorded
- locators and anchors are validated
- broken or stale references are visible
- conflicts in authority mapping are surfaced rather than hidden

Quality issues should affect what the consumer sees. A context bundle should expose weak authority, missing access, or broken anchors rather than pretending the evidence is complete.

## Evaluation and Health

Atlas should be evaluated as a context layer, not as a reasoning system.

V1 health and quality checks should focus on:

- source selection precision
- anchor and excerpt resolution success rate
- citation and provenance completeness
- permission and visibility filtering correctness
- context bundle relevance and bounded size

These checks matter more than breadth in V1 because they prove the layer is trustworthy to downstream agents and consumers.

## Upstream and Downstream Impact

### Upstream Impact

V1 should minimize workflow change for source owners.

- source owners do not need to maintain a full second metadata contract
- source systems remain the place where content is authored
- any additional governance should be light enough to be curated centrally or incrementally

### Downstream Impact

V1 changes how consumers access internal cloud knowledge.

- consumers stop integrating with scattered source systems one by one
- AI agents receive smaller, more precise, citation-ready context
- multiple consumers can share the same governed context surface

## Failure Modes

Important failure modes include:

- relevant source not registered
- authority unclear across multiple sources
- broken link or invalid anchor
- permission mismatch
- unsupported or weak anchoring for a source class
- source available but precise excerpt not locatable
- context bundle too broad or too shallow for the request

The system should make these failure modes explicit. The correct behavior is to surface the limitation and offer the next best expansion path, not to invent missing certainty.

## Proof of Value

V1 should be judged by whether it improves context delivery quality for downstream consumers.

The proof should include four parts:

(Not full doc)