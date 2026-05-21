**You:**

文档
Platform & Developer Experience (DevEx)
• Key Questions Raised:
• Is there a centralized portal for managing landing zones?
• How do teams navigate documentation and platform capabilities?
• Current State:
• Only central landing zone has a custom portal.
• Other environments use:
• Terraform Enterprise
• Harness CI/CD
• No unified developer portal exists.
• Challenges Identified:
• Documentation is fragmented and outdated
• Lack of discoverability across tools and environments
• Future Direction:
• Consolidation of knowledge portals
• Possible DevEx portal (information-centric, not provisioning)
• Explore Al-based documentation discovery and maintenance
• Implication:
• Platform maturity depends on experience, not just tooling
• Clear need for "Platform as a Product" UX layer 我们现在组织需要这么一个东西，然后我之前有一些设计方案，但是问题卡在了实现的形态上，按照上面的这个 direction、portal，能否帮我调整一下设计。

设计如下：粘贴的文本 （1）
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

* * *

**ChatGPT:**

我会把你原来的“knowledge context layer”设计往“DevEx Portal / Platform as a Product UX layer”收一下：保留底层治理能力，但把 V1 的产品形态改成更容易被组织接受的“信息型入口 + 搜索/导航 + 权威内容卡片”，而不是先做一个偏后端的上下文中台。

* * *

**ChatGPT:**

可以。你原来的设计方向是对的，但**产品形态需要从“知识上下文中台”前移成“DevEx Portal”**。

也就是说：

> **Atlas / Knowledge Context Layer 不是用户看到的产品本体，而是 DevEx Portal 背后的治理与检索能力。**  
> 对组织汇报时，主产品应该叫 **Cloud Platform DevEx Portal** / **Internal Cloud Platform Hub**，而不是先讲 context broker。

你之前设计里已经有很强的底层逻辑：source-native、authority-aware、consumer-neutral，不替代 Terraform repo / Confluence / policy docs，只做权威来源注册、定位、引用和上下文打包。这个底座可以保留，但要换一个更贴近当前组织痛点的表达方式。

粘贴的文本 (1)

---

# 调整后的产品定位

## 原定位

**Governed Internal Cloud Knowledge Context Layer**

偏后端、偏架构、偏 AI agent consumption。

## 调整后定位

**Cloud Platform DevEx Portal**

一个面向内部应用团队的统一入口，用来发现、理解和使用云平台能力。

它不是 provisioning portal，不直接替代 Terraform Enterprise 或 Harness CI/CD。

它的核心价值是：

> 让团队知道：  
> **有什么能力、适合谁用、怎么开始、谁负责、哪些文档权威、当前状态如何、后续去哪操作。**

---

# 新的一句话定义

> The Cloud Platform DevEx Portal is an information-centric platform experience layer that helps application teams discover cloud platform capabilities, understand authoritative guidance, navigate landing zones, and access the right tools, documentation, and support paths from one place.

中文可以说：

> 这是一个面向应用团队的云平台体验入口，不替代现有工具，而是把分散在 Terraform Enterprise、Harness、Confluence、policy 文档和团队页面中的平台能力组织成一个可发现、可导航、可维护、可引用的统一入口。

---

# 核心设计变化

## 1. 从“Context Layer”变成“Portal + Context Layer”

你的原设计里说 V1 不做 final UI，这在技术设计里没问题，但现在组织真正缺的是 portal，所以需要改成：

```
Cloud Platform DevEx Portal
        |
        |-- Human-facing UX layer
        |-- Capability catalog
        |-- Landing zone navigation
        |-- Documentation discovery
        |-- Support / ownership / onboarding paths
        |
Atlas Context Layer
        |
        |-- source registry
        |-- authority mapping
        |-- source locator
        |-- citation / provenance
        |-- AI doc discovery support
```

也就是：

| 层 | 作用 |
| --- | --- |
| DevEx Portal | 用户入口，解决 discoverability 和 navigation |
| Atlas Context Layer | 后端治理能力，解决 authoritative source、section locator、staleness、citation |
| Existing Tools | TFE、Harness、Confluence、policy docs、Git repos，继续作为 source of truth |

---

# V1 不要做什么

这一点很关键，否则会变成大项目，容易死。

V1 **不要做**：

| 不做 | 原因 |
| --- | --- |
| 不做 provisioning portal | 会和 Terraform Enterprise / Harness 边界冲突 |
| 不做 landing zone 自动创建 | 复杂度高，权限、审批、合规都会卡住 |
| 不做完整服务目录 CMDB | 太重，维护成本高 |
| 不做 AI 自动改文档 | 风险高，权威性不清 |
| 不做全量文档迁移 | 会引发 ownership 和维护问题 |
| 不做“万能搜索引擎” | V1 先做 curated discovery，不做企业级搜索平台 |

V1 应该是：

> **Information-centric DevEx Portal + governed source registry + AI-assisted discovery.**

---

# 推荐的新信息架构

Portal 首页不要按工具分，比如 TFE / Harness / Confluence。  
应该按用户任务分。

## 首页结构

```
Cloud Platform Hub

1. Start Here
   - I want to onboard a new application
   - I want to use an AWS service
   - I want to deploy through TFE
   - I want to understand landing zones
   - I want to check cloud guardrails
   - I need support

2. Platform Capabilities
   - Compute
   - Network
   - Storage
   - Data
   - AI / ML
   - Security
   - Observability
   - CI/CD
   - Landing Zones

3. Landing Zone Navigator
   - Central Landing Zone
   - Business Unit / Environment-specific zones
   - Sandbox / dev / prod paths
   - Ownership and access model

4. Authoritative Guidance
   - Policies
   - Reference architectures
   - Terraform module usage
   - Guardrails
   - Approved patterns

5. Tool Entry Points
   - Terraform Enterprise
   - Harness
   - ServiceNow / request forms
   - Confluence spaces
   - Git repositories

6. What’s New / Changes
   - New modules
   - Deprecated modules
   - Policy changes
   - Breaking changes
```

---

# 每个 Capability Page 应该长什么样

比如一个 **AWS Textract** 能力页面，不应该只是贴链接。

应该是这种结构：

```
AWS Textract

What is it?
- Internal approved OCR / document text extraction capability.

When should I use it?
- Use for scanned PDFs, image-based forms, document extraction.
- Do not use for highly sensitive documents unless data classification allows it.

How do I start?
- TFE module: xxx
- Required IAM pattern: xxx
- Required S3 pattern: xxx
- Example repo: xxx

Authoritative Sources
- Terraform module README
- Security policy section
- Architecture guidance
- Known limitations page

Operational Notes
- Private endpoint requirement
- KMS / S3 encryption notes
- Logging / CloudTrail troubleshooting

Support
- Owning team
- Slack / Teams channel
- Request path
- Escalation path

Freshness
- Last reviewed
- Source owner
- Broken link status
```

这种页面比“搜索一个 Confluence 页面”好很多，因为它提供的是**平台产品体验**。

---

# Landing Zone Navigator 需要单独做

你现在的痛点里明确提到：

> Only central landing zone has a custom portal.  
> Other environments use Terraform Enterprise / Harness CI/CD.  
> No unified developer portal exists.

所以 V1 里必须有一个 **Landing Zone Navigator**，但它不是 landing zone management portal。

它应该回答这些问题：

| 用户问题 | Portal 应该提供 |
| --- | --- |
| 我在哪个 landing zone？ | landing zone map |
| 哪些环境可用？ | environment matrix |
| 这个环境谁维护？ | ownership card |
| 怎么 onboarding？ | step-by-step path |
| 哪些工具负责部署？ | TFE / Harness links |
| 这个 landing zone 有什么限制？ | guardrail summary |
| 怎么申请权限？ | request path |
| 出问题找谁？ | support path |

建议页面结构：

```
Landing Zone Navigator

1. Landing Zone Overview
   - Central LZ
   - BU-specific LZ
   - Shared services
   - Sandbox / non-prod / prod

2. Environment Matrix

| Environment | Purpose | Provisioning | Deployment | Owner | Support | Status |
|---|---|---|---|---|---|---|
| Central LZ | Standard platform workloads | TFE | Harness | Cloud Platform | link | Active |
| Team-specific LZ | BU-owned workloads | TFE workspace | Harness pipeline | BU Cloud Team | link | Active |

3. Entry Paths
   - New app onboarding
   - Existing app migration
   - Sandbox request
   - Production readiness

4. Guardrails
   - Network
   - IAM
   - S3
   - KMS
   - Logging
   - Tagging
```

---

# 新的 V1 Scope

你的原 V1 scope 偏底层：source registration、authority mapping、anchors、context bundle。这个继续保留，但要换成用户可感知的 scope。

## V1 目标

> Build a unified information-centric Cloud Platform DevEx Portal that helps application teams discover landing zones, cloud capabilities, authoritative documentation, and platform support paths, while reusing existing systems of record.

## V1 范围

| Module | V1 做什么 |
| --- | --- |
| Portal Home | 统一入口，按用户任务组织 |
| Capability Catalog | 平台能力卡片，不是完整 CMDB |
| Landing Zone Navigator | 解释不同 landing zone / env / tool path |
| Documentation Hub | 聚合权威文档，不迁移所有内容 |
| Authority Badges | 标记 authoritative / reference / outdated / draft |
| Ownership Metadata | owner、support channel、review date |
| AI-assisted Search | 基于权威来源回答，必须带引用 |
| Feedback Loop | 用户可以报告 broken link、outdated doc、missing capability |

---

# Capability Catalog 不是 Service Catalog

这里要讲清楚。

很多组织一听 portal，会想到 Backstage 那种 Service Catalog，或者 CMDB。你这里不应该先做那个。

你要做的是 **Platform Capability Catalog**。

区别：

| 类型 | 管什么 |
| --- | --- |
| Service Catalog | 应用、服务、owner、runtime、dependency |
| CMDB | 资产、配置项、关系 |
| Platform Capability Catalog | 平台提供什么能力，怎么使用，谁维护，文档在哪 |
| Provisioning Catalog | 一键创建资源、申请环境、执行 workflow |

你的 V1 是第三个。

---

# 推荐实现形态

我建议按组织成熟度分三种方案。

## Option A：Confluence / SharePoint Hub + Metadata Registry

最快落地。

适合你们当前文档已经在 Confluence / SharePoint，而且组织短期只想要“统一入口”。

```
Confluence / SharePoint Portal
        |
        |-- Manually curated capability pages
        |-- Landing zone overview
        |-- Tool links
        |-- Owner and support info
        |
Metadata Registry
        |
        |-- YAML / DynamoDB / SharePoint List
        |-- source owner
        |-- authority level
        |-- review date
        |-- source link
```

优点：

* 快
* 政治阻力低
* 不需要新平台审批
* 适合先证明价值

缺点：

* UX 有上限
* AI discovery 能力弱
* 内容结构容易再次变乱

适合 **Phase 0 / Phase 1**。

---

## Option B：Backstage Portal

如果你们已经有平台工程文化，可以考虑 Backstage。

Backstage 是 Spotify 开源的开发者门户框架，常用于内部服务目录、文档、平台插件和开发者自助入口。

适合：

* 组织已经有 internal developer platform 方向
* 未来要接服务目录、组件 ownership、CI/CD、runtime metadata
* 有团队长期维护 portal

不适合：

* 只是想先解决文档和 landing zone navigation
* 没有人维护插件生态
* 企业内部审批慢

它的问题是：**容易被误解成工程平台大项目**。

---

## Option C：Custom Lightweight Portal

我更倾向这个，尤其是你们的需求偏云平台能力导航，而不是通用 service catalog。

技术形态：

```
React / Next.js / TanStack Start
        |
API Gateway / Lambda / Hono
        |
DynamoDB metadata registry
        |
Connectors:
- Confluence
- Git repos
- TFE
- Harness
- Policy docs
```

V1 甚至可以更轻：

```
Static React Portal
        |
JSON / YAML registry
        |
Links to source systems
```

后面再升级为：

```
Portal
  + Search API
  + AI Answer API
  + Source freshness checker
  + Broken link detector
  + Authority registry
```

---

# 我建议的最终路线

## Phase 0：先做“Portal Shell”

目标：让组织看到统一入口长什么样。

内容：

* 首页
* Landing Zone Navigator
* 10 个核心 capability cards
* 关键工具入口
* support path
* authoritative source links

技术可以非常轻：

```
React static site + JSON registry
```

或者：

```
SharePoint modern site + structured pages
```

不要一开始就做 AI。

---

## Phase 1：加 Metadata Registry

目标：让 portal 不只是静态文档，而是有治理信息。

Registry 字段建议：

```YAML
id: aws-textract
name: AWS Textract
type: platform-capability
domain: ai-ml
status: active
owner_team: Cloud Platform
support_channel: "#cloud-platform-support"
primary_tooling:
  - Terraform Enterprise
  - Harness
authoritative_sources:
  - type: terraform-module-readme
    url: ""
    authority: module-usage
  - type: policy-doc
    url: ""
    authority: security-guardrail
  - type: confluence
    url: ""
    authority: reference-guidance
review:
  last_reviewed: 2026-04-20
  review_frequency: quarterly
  steward: ""
tags:
  - textract
  - ocr
  - document-ai
```

这个 registry 就是你原来 Atlas source registry 的 portal 化版本。

你原设计里已经提出每个 source 应包含 stable identity、location、source type、visibility、steward、domain、authority classification、available locators，这个可以直接转成 portal metadata model。

粘贴的文本 (1)

---

## Phase 2：加 AI-assisted Discovery

目标：不是做聊天机器人，而是解决：

* 文档太多找不到
* 不知道哪个是权威来源
* 文档过期没人知道
* 应用团队不知道下一步该去哪

AI 功能可以是：

```
Ask Cloud Platform
```

但回答必须有约束：

* 只基于 registered authoritative sources
* 必须显示 citations
* 必须显示 confidence / source freshness
* 遇到冲突要提示
* 不允许直接生成 Terraform 并声称可用
* 不允许绕过 policy
* 不替代正式审批

示例：

```
Q: How do I use Textract from a private subnet?

Answer:
- Use the approved Terraform module ...
- Private endpoint is required ...
- S3 object access requires ...
- Known issue: presigned URL access may conflict with SCP ...

Sources:
- Terraform module README
- Textract private access guidance
- S3 guardrail policy
```

这和你原来的 context bundle 模型是一致的：返回 selected sources、exact sections、authority、provenance、expansion paths，而不是直接做 recommendation。

粘贴的文本 (1)

---

## Phase 3：Documentation Maintenance Assistant

这个是未来方向，不要放 V1 核心路径里。

AI 可以做：

| 功能 | 说明 |
| --- | --- |
| broken link detection | 定期检查链接失效 |
| stale page detection | 超过 review date 标记 |
| duplicate guidance detection | 找到重复或冲突页面 |
| doc gap detection | 用户搜索不到时记录缺口 |
| suggested update | 生成修改建议，但需要 owner approve |
| change impact summary | policy / module 更新后提示影响页面 |

关键原则：

> AI 可以发现问题和建议修改，但不能直接成为 authoritative source。

---

# 新架构图

```
Users / App Teams
        |
        v
Cloud Platform DevEx Portal
        |
        |-- Home / Start Here
        |-- Capability Catalog
        |-- Landing Zone Navigator
        |-- Documentation Hub
        |-- Tool Entry Points
        |-- Ask Cloud Platform
        |
        v
Portal Backend / DevEx API
        |
        |-- capability registry
        |-- source registry
        |-- authority mapping
        |-- ownership metadata
        |-- review / freshness metadata
        |
        v
Existing Systems of Record
        |
        |-- Terraform Enterprise
        |-- Harness
        |-- Confluence / SharePoint
        |-- Git repositories
        |-- Policy documents
        |-- ServiceNow / request forms
```

---

# 页面设计建议

## 1. Portal 首页

首页不要堆文档链接，要解决入口问题。

```
What do you want to do?

[Onboard a new application]
[Use an approved AWS service]
[Understand landing zones]
[Deploy with Terraform Enterprise]
[Deploy with Harness]
[Check cloud policies]
[Get support]
```

下面是 capability cards：

```
Popular Platform Capabilities

- API Gateway
- Textract
- AgentCore
- S3
- KMS
- VPC Endpoint
- IAM Role Pattern
- CloudWatch Logging
```

再下面是：

```
Recently Updated
- API Gateway module v2.3 released
- S3 guardrail updated
- New AgentCore onboarding guide

Known Issues
- Textract S3Object mode may fail under specific SCP condition
- Harness pipeline template migration in progress
```

---

## 2. Capability Detail Page

每个能力页面统一模板。

```
Capability: API Gateway

Status: Active
Owner: Cloud Platform
Support: #cloud-platform-support
Provisioning: Terraform Enterprise
Deployment: Harness
Authority Level: Governed

Overview
- What this capability is
- When to use it
- When not to use it

How to Start
1. Read module usage
2. Pick environment
3. Apply TFE template
4. Connect Harness pipeline
5. Validate logging and policy

Approved Patterns
- Private API
- Public API
- Internal-only API

Guardrails
- Authentication
- Network boundary
- Logging
- Rate limiting

Authoritative Sources
- Terraform module README
- Security policy
- Reference architecture
- Troubleshooting guide

Related Capabilities
- Lambda
- VPC Endpoint
- WAF
- CloudWatch
```

---

## 3. Landing Zone Page

```
Landing Zones

Purpose:
Explain where workloads should live and how teams should onboard.

Landing Zone Cards:

[Central Landing Zone]
- Best for: standard app workloads
- Provisioning: TFE
- Deployment: Harness
- Owner: Cloud Platform
- Status: Active
- Start here: link

[BU Landing Zone]
- Best for: BU-specific workloads
- Provisioning: TFE workspace
- Deployment: Harness
- Owner: BU Cloud Team
- Status: Active
- Start here: link

[Sandbox]
- Best for: experimentation
- Provisioning: Request form / TFE
- Owner: Cloud Platform
- Guardrails: limited
```

---

# 数据模型建议

## Capability

```JSON
{
  "id": "aws-textract",
  "name": "AWS Textract",
  "category": "AI / ML",
  "description": "Approved OCR and document text extraction capability.",
  "status": "active",
  "ownerTeam": "Cloud Platform",
  "supportChannel": "#cloud-platform-support",
  "provisioningTools": ["Terraform Enterprise"],
  "deploymentTools": ["Harness"],
  "landingZones": ["central-lz", "bu-lz"],
  "authorityLevel": "governed",
  "lastReviewedAt": "2026-04-20",
  "sources": [
    {
      "id": "textract-module-readme",
      "type": "git-readme",
      "url": "",
      "authorityFor": ["module-usage", "input-output-contract"],
      "steward": "Cloud Platform"
    },
    {
      "id": "textract-policy",
      "type": "policy-doc",
      "url": "",
      "authorityFor": ["security-guardrail", "data-classification"],
      "steward": "Cloud Security"
    }
  ]
}
```

---

## Landing Zone

```JSON
{
  "id": "central-lz",
  "name": "Central Landing Zone",
  "description": "Standard landing zone for centrally governed workloads.",
  "status": "active",
  "ownerTeam": "Cloud Platform",
  "supportedEnvironments": ["dev", "test", "prod"],
  "provisioningTools": ["Terraform Enterprise"],
  "deploymentTools": ["Harness"],
  "onboardingPath": "",
  "guardrailSummary": [
    "centralized logging required",
    "approved IAM role pattern required",
    "private endpoint preferred for supported AWS services"
  ],
  "supportPath": ""
}
```

---

## Source

```JSON
{
  "id": "api-gateway-module-readme",
  "sourceType": "terraform-module-repo",
  "title": "API Gateway Terraform Module README",
  "url": "",
  "ownerTeam": "Cloud Platform",
  "visibility": "internal",
  "authorityFor": [
    "module-usage",
    "variables",
    "examples"
  ],
  "anchorStrategy": "markdown-heading",
  "lastObservedAt": "2026-05-01",
  "lastReviewedAt": "2026-04-15"
}
```

---

# 权威等级设计

建议不要只有 “authoritative / not authoritative”。太粗。

用这几类：

| Level | 含义 |
| --- | --- |
| Authoritative | 正式权威来源，可作为执行依据 |
| Reference | 参考资料，可辅助理解 |
| Example | 示例，不保证适用于所有场景 |
| Draft | 草稿，不作为正式依据 |
| Deprecated | 已废弃 |
| Unknown | 未治理来源 |

Portal 上可以显示 badge：

```
[Authoritative]
[Reference]
[Example]
[Deprecated]
[Needs Review]
```

这比单纯文档搜索强很多。

---

# AI 搜索的边界

AI 搜索应该是：

```
Find + explain + cite
```

不是：

```
Decide + approve + execute
```

建议定成：

## AI 可以做

* 找相关 capability
* 总结权威文档
* 给出 onboarding path
* 指出冲突来源
* 标记文档可能过期
* 生成 support ticket draft
* 解释 Terraform module README
* 给出下一步导航

## AI 不做

* 不直接 provision cloud resources
* 不替代 security approval
* 不绕过 guardrail
* 不把非权威内容包装成权威结论
* 不自动修改 policy
* 不自动更新 authoritative docs

---

# Governance 流程

V1 需要一个很轻的治理流程，否则 portal 很快又会过期。

## 每个 Capability 必须有

| 字段 | 必填 |
| --- | --- |
| Owner team | 是 |
| Support path | 是 |
| Authoritative source | 是 |
| Last reviewed date | 是 |
| Status | 是 |
| Tooling entry point | 是 |
| Landing zone compatibility | 建议必填 |
| Known limitations | 建议必填 |

## Review 机制

```
每 90 天 review 一次核心 capability
超过 review date 自动标记 Needs Review
broken link 自动标记 Broken Source
authority conflict 自动标记 Conflicting Guidance
```

---

# 成功指标

不要只用 page view。要体现 DevEx 价值。

| 指标 | 含义 |
| --- | --- |
| Time to find right source | 找到正确文档的时间是否下降 |
| Search success rate | 用户是否找到答案 |
| Broken / stale doc count | 文档质量是否可见并下降 |
| Support ticket deflection | 基础问题是否减少 |
| Onboarding path completion | 新应用 onboarding 是否更顺 |
| Capability discoverability | 用户是否知道平台已有能力 |
| Source authority coverage | 核心能力是否都有权威来源 |
| Portal return usage | 用户是否反复回来用 |

---

# 推荐汇报版本

可以这样对领导讲：

> Today, cloud platform knowledge is distributed across TFE, Harness, Confluence, Git repositories, and policy documents. The issue is no longer just tooling; it is discoverability, authority, and developer experience.
> 
> We propose a Cloud Platform DevEx Portal as an information-centric experience layer. It will not replace Terraform Enterprise or Harness, and it will not become a provisioning portal in V1. Instead, it will provide a unified entry point for landing zones, platform capabilities, authoritative documentation, ownership, support paths, and AI-assisted documentation discovery.
> 
> Under the portal, we will maintain a lightweight governed source registry and authority mapping layer, so the portal can show which documents are official, which teams own them, when they were reviewed, and where users should go next. This gives us a practical Platform-as-a-Product UX layer without forcing every source team to migrate content or maintain a second system of truth.

---

# 最终建议

你的设计不要推翻，应该这样改：

```
Old:
Atlas is the product.

New:
Cloud Platform DevEx Portal is the product.
Atlas is the governed context layer behind it.
```

V1 应该交付：

1. **一个统一 Portal 首页**
2. **一个 Landing Zone Navigator**
3. **一组核心 Platform Capability Pages**
4. **一个轻量 metadata/source registry**
5. **权威来源、owner、review date、support path**
6. **AI-assisted documentation discovery，但必须带 citation 和 authority signal**

这会更贴合你们当前的组织问题：  
不是缺一个新的工具，而是缺一个能把现有工具、文档、landing zone 和平台能力组织起来的 **DevEx 入口层**。

* * *

**You:**

不考虑 Backstage，option C。给我一个新的设计文档。

* * *

**ChatGPT:**

我会把它写成可直接拿去评审的设计文档：产品定位、范围边界、信息架构、系统架构、数据模型、AI discovery、治理、MVP 路线和成功指标都会收进去。

* * *

**ChatGPT:**

已经放到右侧文档里了。

核心调整是：

* 不用 Backstage
* 采用 **Option C：Custom Lightweight Portal**
* 产品主形态改为 **Cloud Platform DevEx Portal**
* 你之前的 **Governed Internal Cloud Knowledge Context Layer** 保留为后端能力，不再作为用户看到的主产品
* V1 明确是 **information-centric portal**，不是 provisioning portal
* 包含：
    * Portal Home
    * Landing Zone Navigator
    * Platform Capability Catalog
    * Documentation & Authority Hub
    * Tool Entry Points
    * AI-assisted Documentation Discovery
    * metadata registry
    * MVP 分阶段路线

设计是基于你之前那份 source-native、authority-aware、consumer-neutral 的知识层草案改写的。
