# Atlas V1 — Design, Principles, Implementation & Product Questions

This document consolidates **product design**, **DevEx guideline context**, **architecture principles**, **repository implementation reality**, **target audiences**, and **open product questions** focused on **source management**, **ongoing maintenance**, and **business value** (including whether Atlas is “only a link site”). It is a snapshot for alignment; authoritative specs remain in `docs/architecture/*`, `docs/product/product_proposal.md`, `docs/product/guideline.md`, and `constraints.md`.

---

## 1. DevEx & platform context (`guideline.md`)

Atlas sits in a broader **Platform & Developer Experience** narrative:

| Theme | Content |
|--------|--------|
| **Questions raised** | Is there a centralized portal for managing landing zones? How do teams navigate documentation and platform capabilities? |
| **Current state** | Only the central landing zone has a custom portal; other environments lean on Terraform Enterprise and Harness; **no unified developer portal** exists. |
| **Challenges** | Documentation is **fragmented and outdated**; **discoverability** is limited across tools and environments. |
| **Future direction** | Consolidate knowledge portals; favor a DevEx portal that is **information-centric, not provisioning-centric**; explore **AI-based documentation discovery and maintenance** (without replacing source-of-truth systems). |
| **Implication** | **Platform maturity depends on experience, not just tooling**; there is a need for a **“Platform as a Product” UX layer**. |

Atlas is one concrete answer to that implication: a **governed information layer** and portal—not a replacement for TFE/Harness, but a **single entry** for “what exists, what is authoritative, where to go next.”

---

## 2. Product design (what Atlas is)

### 2.1 One product, two surfaces

| Surface | Role |
|--------|------|
| **Atlas Portal** | Human-facing internal cloud platform portal (TanStack Start + Vite). First consumer of the Context API, not the owner of registry logic. |
| **Atlas Context Layer** | Backend: governed **source registry**, **topic registry**, authority mapping, locator resolution, **context bundle** assembly. Exposes the **Context API**. |
| **Ask Atlas** | Example AI experience in the Portal: answers must be grounded in context bundles and citations; the Context Layer **never** calls an LLM. |

Atlas **does not replace** Terraform Enterprise, Harness, Confluence, Git, or policy libraries. It **organizes** them into a governed, information-centric entry point and returns **citation-ready** evidence.

### 2.2 V1 success criterion (narrow full loop)

A user can:

1. Find a **capability** or **landing zone** in the Portal.
2. See **owner**, **support path**, **tools**, and **authoritative sources** with authority/freshness/warnings.
3. Obtain **context bundles** from registered sources (deterministic assembly).
4. Use **Ask Atlas** (or another consumer) so answers use **only** registered context and show **citations**.

### 2.3 In scope vs out of scope (V1)

**In scope (product proposal):** Home, capability discovery (~10–15 pilot capabilities), capability detail, landing zone navigator, authoritative source lookup surfaces, feedback path, shared AI consumer contract (context bundle), No-Auth operating model.

**Explicitly out of scope for V1:** Provisioning workflows, landing zone creation, full CMDB/service catalog, document migration into Atlas, general-purpose search, AI rewriting authoritative docs, **admin UI for registry management**, user authentication/SSO.

---

## 3. Core principles (design + constraints)

Summarized from `docs/architecture/current_design.md` and `docs/architecture/constraints.md`:

| Principle | Meaning |
|-----------|---------|
| **Source-native** | Source systems remain the system of record; Atlas holds metadata, authority, locators—not a shadow doc library. |
| **Authority-aware** | Routing uses explicit authority scope/level, not keyword relevance alone. |
| **Consumer-neutral** | Same Context API for Portal, agents, automation; no privileged consumer data path. |
| **Deterministic core** | Registration, routing, resolution, packaging are deterministic; interpretation/recommendation stay in consumers. |
| **Portal is a consumer** | Portal must not own the data model or bypass the API for registry reads. |
| **Request-time content** | No ingest pipeline or durable mirror of full source content in V1; failures surface as **warnings**, not necessarily whole-request failure. |
| **Schema-first API** | Contracts live in shared schema package; structured errors with discriminable codes. |
| **AI boundary** | Prompts use **only** context bundle + user question; uncited claims stripped or flagged; LLM credentials and source-system credentials **never** in browser bundles or committed seeds. |
| **Module boundary** | `context-layer` ↔ `portal` separation; no LLM inside Context Layer. |

---

## 4. Target audiences

| Audience | Primary needs |
|----------|----------------|
| **Application / platform consumers** | Discover capabilities and landing zones, find authoritative guidance, open correct tools, ask cited questions, submit feedback when guidance is wrong or stale. |
| **Cloud platform / stewardship teams** | Keep registry and mappings accurate; answer feedback; maintain authoritative content in **their** systems (Git, Confluence, policy repos). V1 **does not** give them an Atlas admin product surface—maintenance is **API or seed / ops process** (see constraints). |
| **Future AI/automation consumers** | Same Context API as Portal—agents, CLI, MCP, workflows. |

V1 assumes a **trusted internal environment** (No Auth); visibility is modeled as metadata and warnings, not identity enforcement.

---

## 5. Existing implementation (repository reality)

### 5.1 Modules

| Area | Location | Notes |
|------|-----------|--------|
| Shared contract | `packages/atlas-schema` | Types/schemas for discovery, bundles, feedback, errors. |
| Context API & domain | `context-layer` | HTTP adapter, Lambda handler, routes, services, in-memory repos, pilot seed; Dynamo **feedback** repo when `ATLAS_FEEDBACK_TABLE` is set. |
| Portal | `portal` | Routes, UI, server functions, Context API client (in-process or remote HTTP), Ask Atlas + citation validation, LLM adapters (Bedrock / RAI / simulated). |
| Infra sketch | `infra` | Typed plan / draft Terraform strings—product behavior does not depend on this file for local demo. |

### 5.2 Implemented product flows (high level)

- Topic and source **discovery** APIs and Portal consumption (home, lists, detail, search).
- **Context bundle** assembly with warnings (e.g. stale source, broken anchors, restricted visibility—see service logic).
- **Feedback** API with shared schema; persistence **in-memory by default**, optional **DynamoDB** for feedback only.
- **Ask Atlas** server-side: context bundle → LLM adapter → citation validation.
- **Pilot registry data** today: **TypeScript seed** (`context-layer/src/seeds/`), not the YAML-on-disk layout illustrated in the implementation plan.

### 5.3 Product-relevant gaps vs written design (not deployment)

- **Registry durability:** Long-term design points to **DynamoDB** for registry entities; today **sources/topics/anchors/mappings** load from **in-memory pilot seed** only.
- **Seed operational model:** Plan suggests **`data/*.yaml`** and loaders; repo uses **TS seed**—teams must decide whether to move to **GitOps files + validation** for stewardship workflows.
- **Real source fetchers:** Resolver framework exists; **live Git/Confluence/policy fetchers** are not wired—pilot content uses **in-memory excerpts**, so the **product story** is proven structurally, not as full integration with every source system.
- **Thin metadata endpoints:** Sketch includes **`GET /topics/{id}`** and **`GET /sources/{id}`**; current HTTP surface relies on discovery + context routes—fine for many UX paths, but not identical to the written endpoint list.

---

## 6. Open questions — source management, maintenance, “link site,” business value

This section records **product/strategy** questions—not infra checklists.

### 6.1 Source management without an admin UI (V1 constraint)

- Constraints say: **no admin UI for registry in V1**; registration/maintenance via **API calls or seed scripts**.  
- **Questions:** Who is accountable for adding or retiring a source? Is the registry updated via **PR-reviewed YAML/JSON**, internal automation, or future write APIs? How do we prevent the registry from drifting from Confluence/Git **without** turning Atlas into a second CMS?

### 6.2 How to maintain the system over time

- **Operational clarity:** When stewards change a module README or policy PDF, what **process** updates anchors, `last_reviewed_at`, or warnings so Portal stays trustworthy?  
- **Feedback loop:** Feedback exists to surface stale/broken/missing guidance—how does that connect to **ownership** (SLAs, routing to teams)? Atlas records signals; it does not **replace** ownership workflows unless the org wires them.

### 6.3 “Are we only building a link aggregator?” — reverse thinking

**If Atlas were only bookmark trees and outbound links:**

- You might still reduce **fragmentation** (`guideline.md`: scattered docs, weak discoverability)—that has **some** value.
- You would **not** fully deliver: **which link is authoritative**, **for what scope**, **whether it is stale or broken**, **machine-readable bundles for AI**, or **cited answers** bounded by registry rules.

**What the design claims beyond links:**

- **Authority & governance metadata** on each source (level, scope, steward, visibility).
- **Structured context bundles** with citations, warnings, expansion paths—**deterministic**, comparable across Portal and agents.
- **Ask Atlas** as proof that **governed context**, not raw web search, backs AI answers.

**Business value (why leadership should care):**

- Moves maturity from **“we bought tools”** to **“teams can find and trust platform truth”** (`guideline.md`: maturity = experience).
- Cuts time wasted hunting **which doc is official** and reduces **wrong-env / wrong-pattern** mistakes when paired with authority signals.
- Positions the platform for **AI consumers** (agents, automation) without letting the model invent policy—**citations and stripping uncited claims** are the guardrail story.

### 6.4 Documentation inside Portal vs staying source-native

- Design favors **excerpts + provenance + deep links**, not moving authoring into Atlas.  
- **Question:** How much “read here” vs “open in Confluence/Git” does the org want—and does expanding inline reading **strengthen trust** or **blur ownership** of the canonical doc?

### 6.5 Alignment expectation (docs vs code)

- Implementation plan describes YAML seeds and Dynamo-backed registry; code today uses **TS pilot seed** and **optional Dynamo for feedback only**.  
- **Question:** Is pilot explicitly **“contract + UX proof”** until GitOps seed + persistence land—or should the snapshot docs declare pilot limitations so stakeholders don’t assume full registry ops are already live?
