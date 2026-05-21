# Design review based on guidelines
_Exported on 2026/5/5 at GMT+8 19:19:46 from Cursor (3.2.21)_

---

**User**

检查，review，可以提出反驳意见，以 guideline 为核心与基准，检查新的设计是否合理。

---

**Cursor**

我先读取相关文件，了解 guideline 和新设计的内容。

让我先检查一下项目中是否还有其他设计文件。

好的，我已经完整阅读了三份文件。下面以 `docs/product/guideline.md` 为基准，对 `docs/notes/conversation1.md` 中 ChatGPT 提出的新设计进行系统性审查。

---

## Review：新设计是否符合 Guideline

### 审查基准

`docs/product/guideline.md` 的核心主张共 5 点：

1. **Consolidate knowledge portals**（整合，不是新增）
2. **Consider a DevEx portal that is information-centric, not provisioning-centric**（"Consider"——探索方向，不是执行指令）
3. **Explore AI-based documentation discovery and maintenance**（AI 是明确的探索方向）
4. **Platform maturity depends on experience, not just tooling**（体验驱动，不是工具驱动）
5. **Clear need for a "Platform as a Product" UX layer**（产品化思维的体验层）

---

### 一、对齐的部分（新设计做对了什么）

| Guideline 要求 | 新设计响应 | 判定 |
|---|---|---|
| Information-centric, not provisioning-centric | 明确声明 V1 不做 provisioning portal | 对齐 |
| 不替代 TFE / Harness | 保留 existing systems of record | 对齐 |
| Source systems remain system of record | 保留了这一原则 | 对齐 |
| Ownership / support path 需要可见 | Capability page 包含 owner、support channel | 对齐 |

---

### 二、偏离与问题（7 条反驳意见）

#### 反驳 1：Guideline 说"Consolidate"，新设计在"Add"

Guideline 原文：

> Consolidate knowledge portals.

新设计的做法是：在 TFE、Harness、Confluence、SharePoint、Git repos 之上**再加一个** Custom Lightweight Portal。这不是 consolidation，这是 **layer stacking**。

问题：如果不解决底层信息分散的问题，在上面加一层"漂亮的前门"只会导致：
- 又一个需要维护的信息源
- 用户看到 portal 里的内容和 Confluence 里不一致时，不知道信该谁
- 组织最终有 N+1 个 portal

**Guideline 要求的是减法，新设计做的是加法。**

---

#### 反驳 2：V1 Scope 严重膨胀

Guideline 的 Future Direction 只有 3 个 bullet points，语气是"Consider""Explore"——谨慎、探索性的。

新设计的 V1 却包含 **8 个模块**：

| 模块 | 涉及工作量 |
|---|---|
| Portal Home | 前端开发 + 内容策划 |
| Capability Catalog | 数据建模 + 内容编写 + 维护流程 |
| Landing Zone Navigator | 跨团队协调 + LZ 信息收集 |
| Documentation Hub | 文档聚合 + 权威标记 |
| Authority Badges | 治理体系设计 + 评审流程 |
| Ownership Metadata | 元数据采集 + 持续更新 |
| AI-assisted Search | RAG / 检索架构 + 权威约束 |
| Feedback Loop | 用户交互 + 后端工单流 |

这不是一个 V1，这是一个完整产品的 GA scope。原始设计在 scope 控制上更纪律——"narrow but complete mechanism"。新设计把"窄而完整"换成了"宽而浅"。

**Guideline 没有要求在 V1 交付一个完整的 portal。**

---

#### 反驳 3：丢掉了 Consumer-Neutral 原则

原始设计的核心原则之一：

> AI agents, skills, portals, and future automation flows are **consumption forms**, not the product definition.

新设计直接推翻了这个原则：

> Atlas / Knowledge Context Layer 不是用户看到的产品本体，而是 DevEx Portal 背后的治理与检索能力。

这意味着 **Portal 成了唯一的 first-class consumer**，AI agents 被降级为 Phase 2 的附加能力。

但 Guideline 明确说：

> Explore AI-based documentation discovery and maintenance

AI 不是附加功能，是 Guideline 明确的探索方向。把 portal 锁定为产品形态，会导致整个架构以人类浏览器交互为中心来设计，AI agent 消费路径变成事后补丁。

**Guideline 没有说 portal 是唯一的消费形态。原始设计的 consumer-neutral 更忠于 Guideline 的开放性。**

---

#### 反驳 4："Platform as a Product" ≠ "Build a Portal"

Guideline 说：

> Clear need for a "Platform as a Product" UX layer

新设计把这句话直接等价于"Build a web portal"。但 "Platform as a Product" 是一个思维框架，不是一个技术选型。它的含义包括：

- 可发现的 API 契约
- 自助服务能力
- 开发者反馈循环
- 体验质量度量
- 多消费形态支持（CLI、SDK、Portal、AI agent）

一个 React static site + JSON registry 不等于 "Platform as a Product"。它只是一个网站。

**新设计窄化了 Guideline 的意图。**

---

#### 反驳 5：Capability Catalog 与 Source Registry 的概念混淆

原始设计清晰地分离了两个概念：
- **Source**：知识住在哪（一个 Confluence 页面、一个 Git README）
- **Authority**：这个 source 对什么问题有权威性

新设计引入了 **Capability** 作为顶层实体，把 source 嵌套在 capability 下面。这导致：

- 一个 source 横跨多个 capability 时，数据模型需要重复（比如一份 IAM policy 文档同时适用于 API Gateway、Lambda、S3）
- "权威性"被绑定到 capability 而不是 source，治理粒度变粗
- Capability Catalog 开始承担 CMDB-lite 的职能（`provisioningTools`、`deploymentTools`、`landingZones`），尽管新设计自己说"不做 CMDB"

**原始设计的 source-centric 模型更干净、更 scalable。新设计的 capability-centric 模型在语义上有矛盾。**

---

#### 反驳 6：内容维护问题未解决，反而加重

Guideline 的核心痛点之一：

> Documentation is fragmented and outdated

新设计要求为每个 Capability 撰写详细页面（What is it / When to use / How to start / Approved Patterns / Guardrails / Operational Notes / Support / Freshness）。

问题是：**谁来写这些内容？谁来持续维护？**

- 如果由 Cloud Platform team 集中写 → 这个团队要维护 N 个 capability page + 原来的 Confluence + TFE modules，工作量翻倍
- 如果由各 BU team 分散写 → 又回到"文档分散、过期没人更新"的起点
- 每 90 天 review 一次核心 capability → 治理开销不小，且没有说不 review 的后果是什么

新设计本质上是在 **用更多内容来解决内容碎片化问题**——这是循环论证。

**Guideline 要的是 consolidation 和 AI-assisted maintenance，不是制造更多需要维护的内容面。**

---

#### 反驳 7：Phase 0 "Portal Shell" 实质上是一个精装 Confluence

新设计推荐的 Phase 0：

> React static site + JSON registry

或者：

> SharePoint modern site + structured pages

如果 Phase 0 的技术实现是 static site + JSON，那它和一个组织良好的 Confluence space 有什么本质区别？

- 都是手动维护的静态内容
- 都依赖人工更新
- 都没有实时连接到 source systems

与其花精力做一个新的 static portal，不如先在 Confluence 里按新设计的信息架构重组现有内容。用最低成本验证"按用户任务组织 vs 按工具组织"这个假设是否成立。

**新设计的 Phase 0 有解决方案过度的风险。**

---

### 三、总结判断

| 维度 | 原始设计 | 新设计 | Guideline 对齐度 |
|---|---|---|---|
| Scope 纪律 | 窄而完整 | 宽而浅 | 原始设计更对齐 |
| Consumer-neutral | 明确支持多消费形态 | Portal 优先，AI 后补 | 原始设计更对齐 |
| AI 探索 | Day 1 就服务 AI agents | Phase 2 才做 | 原始设计更对齐 |
| Consolidation | 不增加新 UI 层 | 新增一个 portal | 原始设计更对齐 |
| 内容维护 | 最小化上游负担 | 制造大量新内容面 | 原始设计更对齐 |
| 可落地性 | 偏后端，组织感知弱 | 有具体 UI 形态，容易汇报 | 新设计更对齐 |
| "Platform as Product" 表达 | 偏技术，不易向上传达 | 有清晰的产品叙事 | 新设计更对齐 |

### 四、核心建议

新设计的**叙事和汇报能力**确实优于原始设计——这是它真正的价值。但它在架构上不应该反过来重新定义产品边界。

合理的做法可能是：

1. **保留原始设计的架构纪律**（source-native、consumer-neutral、scope 控制）
2. **借用新设计的产品叙事**（DevEx Portal 作为表达方式，而不是架构锚点）
3. **Portal 是 Atlas 的第一个 consumer，不是 Atlas 的上层产品定义**
4. **V1 先证明 context layer 有效，Portal Shell 可以是验证手段，但不是产品本体**

一句话：**新设计用正确的语言讲了一个过大的故事。应该缩回来，用原始设计的骨架，穿新设计的外衣。**

---

**User**

跟我 brainstorm 一下新的设计，写到 @docs/architecture/current_design.md 里面

---

**Cursor**

好，我们来 brainstorm。项目上下文我已经充分了解了——Guideline、原始设计、ChatGPT 新设计、以及我刚才的 review 结论。

在我们开始之前，我想先确认一个最关键的方向性问题：

在我的 review 里，核心判断是**原始设计的骨架更忠于 Guideline，但新设计的产品叙事更容易推动组织接受**。我建议的方向是"用原始设计的骨架，穿新设计的外衣"。

但这里有一个根本性的选择需要你来定：

**设计方向选择**

> **Atlas 的产品定位应该是什么？**
> - Context Layer First：Atlas 是产品本体（governed context layer），Portal 是它的第一个 consumer。先证明 context delivery 有效，Portal 作为验证手段自然长出来。
> - Portal First：Portal 是产品本体，Atlas context layer 是 Portal 的后端能力。先交付一个可见的 Portal，context layer 作为技术底座逐步建设。
> - Twin Track：Portal 和 Context Layer 是同一个产品的两面。对外讲 Portal 故事（给组织看），对内建 Context Layer 架构（给技术团队用）。V1 两者同步交付最小集。 ✔
> - 我有别的想法，想先讨论一下。

好，Twin Track 方向很清晰——对外是 Portal 的故事，对内建 Context Layer 的架构，V1 两者同步交付最小集。

下一个关键问题：V1 的宽度控制。

ChatGPT 新设计的问题之一就是 V1 塞了 8 个模块。我们需要决定 V1 到底覆盖多少 surface。

**V1 Surface Scope**

> **V1 的 Portal 表面应该覆盖多少？**
> - 极窯：只做 1 个核心场景（比如只做 Capability Discovery），用它贯通 source registry → authority mapping → context delivery → Portal 展示的全链路。先证明机制有效。
> - 适中：做 2-3 个场景（比如 Capability Discovery + Landing Zone Navigator + Authoritative Source Lookup），让组织感知到“这是一个真的 Portal”。 ✔
> - 宽一点：Portal Home + Capability Catalog + Landing Zone + Doc Hub，但每个都只做 MVP，重点是全景可见。

好，适中 scope，2-3 个场景，让组织感知到"这是一个真的 Portal"。

接下来一个关键的设计决定——Guideline 明确提到 "Explore AI-based documentation discovery and maintenance"。原始设计的 context layer 天然支持 AI agent 消费；ChatGPT 新设计把 AI 推到了 Phase 2。

**AI \u5728 V1 \u4e2d\u7684\u4f4d\u7f6e**

> **V1 是否包含 AI 能力？**
> - AI 是 V1 核心能力之一：Context Layer 的 API 同时服务 Portal 和 AI Agent。Portal 上可以有一个“Ask Cloud Platform”入口，但回答必须基于 registered authoritative sources + citation。 ✔
> - AI 只在 API 层：Context Layer 的 API 设计就元原地支持 AI agent 消费，但 Portal 上 V1 不做 AI 界面。AI 是“准备好了但不地”的状态。
> - 不做 AI：V1 先证明 source registry + authority mapping + Portal 展示的核心链路，AI 留给 V2。

AI 作为 V1 核心能力，这和 Guideline 的方向高度一致。

再确认一个和 V1 pilot scope 相关的问题。原始设计提到了 3 类 source class（Terraform module repos、Confluence pages、Policy/guardrail documents）。

**V1 Source Classes**

> **V1 要支持哪些 source class？**
> - 保持原设计的 3 类：Terraform module repos、Confluence pages、Policy/guardrail documents。这 3 类已经足以覆盖 2-3 个 Portal 场景。 ✔
> - 加一些：除了这 3 类，还需要支持 Git repos（非 Terraform）、SharePoint、或其他来源。
> - 更窫：V1 只做 1-2 类，比如只做 Terraform + Confluence，先打通这两个的全链路。

好，核心方向已经清晰了。让我整理一下我们的设计决策：

| 决策项 | 选择 |
|---|---|
| 产品定位 | Twin Track：对外 Portal 故事，对内 Context Layer 架构 |
| V1 Scope | 适中：2-3 个场景 |
| AI | V1 核心能力，API 同时服务 Portal 和 AI Agent |
| Source Classes | Terraform repos、Confluence、Policy docs |

在进入详细设计之前，有一个关键的架构选择需要讨论——**数据模型的组织方式**。这是我在 review 中指出的新设计最大的结构性问题。

我推荐的方向是 **Approach B**，理由如下：

**Approach A：Source-Only**（纯原始设计）
- Source 是唯一的 first-class entity
- "Capability" 只是 source 上的 tag / topic 分类
- 优点：模型最简洁，治理粒度最细
- 缺点：Portal 的 Capability 页面没有稳定的实体支撑，导航体验弱

**Approach B：Source + Topic 双实体**（我推荐）
- Source 是治理实体（authority、locator、steward 都挂在这里）
- Topic 是导航实体（对应 Portal 上的 Capability 页面、Landing Zone 页面）
- Source 和 Topic 是多对多关系
- 优点：治理干净（在 source 层），导航清晰（在 topic 层），不互相污染
- 缺点：多一层 mapping，稍复杂

**Approach C：Capability-Centric**（ChatGPT 新设计）
- Capability 是顶层实体，Source 嵌套在 Capability 下
- 优点：Portal 页面和数据模型 1:1 对应，直觉
- 缺点：一个 source 跨多个 capability 时需要重复；authority 被绑到错误的层级

**数据模型选择**

> **你倾向哪个数据模型方向？**
> - Approach A：Source-Only。最简洁，Capability 只是 tag。
> - Approach B：Source + Topic 双实体。治理在 Source 层，导航在 Topic 层，多对多映射。（推荐） ✔
> - Approach C：Capability-Centric。Source 嵌套在 Capability 下。
> - 想讨论一下。

好。所有关键方向都定了。让我开始呈现设计。我会分几个部分，每部分确认后再继续。

---

### Part 1：产品定位 + 核心原则 + 系统架构

**产品定位（Twin Track）：**

- 内部架构名：**Atlas**——一个 governed cloud knowledge context layer
- 对外产品名：**Cloud Platform DevEx Portal**——应用团队发现和理解云平台能力的统一入口
- 两者是同一产品的两面。对组织讲 Portal 的故事，对技术团队建 Context Layer 的架构
- Atlas 不是 Portal 的后端；Portal 是 Atlas 的第一个 consumer

**核心原则（继承原始设计，增加 Twin Track 补充）：**

1. **Source-native**：不替代源系统，不维护影子副本
2. **Authority-aware**：权威性显式标注、可路由
3. **Consumer-neutral**：API 同时服务 Portal、AI Agent、未来的自动化流程
4. **Deterministic core**：Atlas 做确定性工作（注册、路由、定位、打包），判断留给消费者
5. **Portal is a consumer, not the architecture**：Portal 的 UI 需求不应反向定义 Context Layer 的数据模型

**系统架构（三层）：**

```
┌─────────────────────────────────────────────┐
│              Consumer Layer                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Portal   │  │ AI Agent │  │  Future    │  │
│  │  (React)  │  │ Consumer │  │ Automation │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │         │
├───────┴──────────────┴──────────────┴────────┤
│              Atlas Context Layer API         │
│  ┌─────────────────────────────────────────┐ │
│  │ Source Registry │ Authority Mapping      │ │
│  │ Locator Resolution │ Context Packaging  │ │
│  │ Topic Registry │ Access Filtering       │ │
│  └─────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│           Source Systems (unchanged)         │
│  Terraform Repos │ Confluence │ Policy Docs  │
└──────────────────────────────────────────────┘
```

关键边界：
- **Atlas 拥有**：source registry、topic registry、authority mapping、locator resolution、context packaging、access filtering
- **Atlas 不拥有**：源内容创作、语义推理、建议生成、workflow 执行、shadow catalog
- **Consumer 拥有**：解释上下文、判断优先级、生成建议、决定后续行动

---

这个定位和架构方向，你觉得可以吗？有什么需要调整的？

**Part 1 确认**

> **Part 1（产品定位 + 原则 + 架构）是否 OK？**
> - 没问题，继续下一部分。 ✔
> - 有调整意见，先讨论。

### Part 2：数据模型 + V1 场景

**数据模型（Source + Topic 双实体）：**

两个核心实体，一个映射关系：

**Source（治理实体）**——"知识住在哪，谁说了算"

| 字段 | 说明 |
|---|---|
| id | 稳定唯一标识 |
| title | 可读名称 |
| source_class | terraform-module / confluence-page / policy-document |
| location | URL / repo path |
| steward | 维护团队 |
| visibility | internal / restricted |
| authority_scope | 这个 source 对什么问题有权威（如 module-usage、security-guardrail、reference-guidance） |
| authority_level | authoritative / reference / example / draft / deprecated |
| anchor_strategy | 这个 source class 如何定位内部片段（markdown-heading / confluence-section / document-clause） |
| available_anchors | 已注册的可寻址锚点列表 |
| last_observed_at | 最后一次观察到内容的时间 |
| last_reviewed_at | 最后一次人工 review 的时间 |
| review_frequency | 建议 review 周期 |

**Topic（导航实体）**——"用户想找什么"

| 字段 | 说明 |
|---|---|
| id | 稳定唯一标识 |
| name | 显示名称（如 "AWS Textract"、"Central Landing Zone"） |
| topic_type | capability / landing-zone / guardrail-area |
| category | ai-ml / compute / network / security / ... |
| status | active / deprecated / planned |
| description | 一句话描述 |
| owner_team | 负责团队 |
| support_channel | 支持渠道 |
| entry_tools | 相关操作工具入口（TFE link、Harness link） |

**Source-Topic Mapping（多对多）**

一个 source 可以关联多个 topic；一个 topic 聚合多个 source。治理信息（authority、steward、freshness）始终挂在 source 上，不在 topic 上重复。

```
Topic: AWS Textract
  ├── Source: textract-module-readme    (authority: module-usage)
  ├── Source: textract-security-policy  (authority: security-guardrail)
  └── Source: textract-arch-guidance    (authority: reference-guidance)

Topic: S3 Guardrails
  ├── Source: s3-policy-doc             (authority: security-guardrail)
  ├── Source: textract-security-policy  (authority: security-guardrail)  ← 同一个 source
  └── Source: s3-module-readme          (authority: module-usage)
```

这样 `textract-security-policy` 同时出现在两个 topic 下，但只治理一次。

---

**V1 三个场景**

| 场景 | 用户问题 | Portal 展示 | Context Layer 能力 |
|---|---|---|---|
| **Capability Discovery** | "平台有什么 AI/ML 能力？Textract 怎么用？" | Capability 卡片列表 → 详情页（overview、how to start、authoritative sources、support） | topic registry 查询 → source selection → authority metadata → context bundle |
| **Landing Zone Navigation** | "我的应用应该部署在哪个 landing zone？" | Landing Zone 卡片 → 环境矩阵、onboarding path、guardrail 摘要、tool 入口 | topic_type=landing-zone 查询 → 关联 sources → guardrail excerpts |
| **Ask Cloud Platform（AI）** | "从 private subnet 用 Textract 需要什么？" | 带 citation 的 AI 回答 + authority badge + expansion links | source selection → excerpt retrieval → authority packaging → LLM reasoning（consumer 层） |

每个场景都贯穿 **source registry → authority mapping → locator resolution → context delivery → Portal/AI 展示** 的全链路。不是 3 个独立模块，是同一个 Context Layer 的 3 种消费路径。

---

Part 2 的数据模型和场景设计，你觉得怎么样？

**Part 2 确认**

> **Part 2（数据模型 + V1 场景）是否 OK？**
> - 没问题，继续下一部分。 ✔
> - 有调整意见，先讨论。

### Part 3：Context Delivery 模型 + AI 设计 + 技术方向

**Context Delivery 模型**

Atlas 的核心输出不是"页面"也不是"推荐"，而是 **context bundle**。

一个 context bundle 包含：
- 被选中的 sources 及其 authority 信息
- 精确的 sections / excerpts（或指向它们的锚点）
- 引用和溯源元数据
- 足够的周边上下文防止断章取义
- expansion paths（还能往哪深入）

**两条访问路径（继承原始设计）：**

1. **Discovery path**：用户给一个 topic / 问题 → Atlas 返回相关 sources + authority ranking
2. **Expansion path**：用户已知一个 source 或 anchor → Atlas 返回精确 excerpts + 周边上下文

**Progressive Disclosure（逐层展开）：**

```
Level 0: Source 列表 + 为什么被选中 + authority badge
Level 1: 精确 section / excerpt
Level 2: 相邻的支撑证据
Level 3: 关联 sources 的深度展开
```

Portal 和 AI Agent 都遵循这个 disclosure 模式——先给小的、精准的上下文，消费者可以逐步展开。

---

**AI 设计：判断在消费者，不在 Atlas**

这是最关键的架构边界。Atlas 和 AI 的分工：

```
┌────────────────────────────────────────────┐
│  Portal "Ask Cloud Platform" Consumer       │
│                                             │
│  1. 接收用户问题                              │
│  2. 调用 Atlas API → 获取 context bundle      │
│  3. 将 context bundle + 用户问题 → 送给 LLM   │
│  4. LLM 基于 context 推理，生成回答            │
│  5. 展示回答 + citations + authority badges   │
│                                             │
│  LLM reasoning 是 consumer 的事，不是 Atlas 的  │
└──────────────┬─────────────────────────────┘
               │ 调用
┌──────────────▼─────────────────────────────┐
│  Atlas Context Layer API                    │
│                                             │
│  - 确定性地选择相关 sources                    │
│  - 解析锚点，提取 excerpts                     │
│  - 打包 authority + provenance               │
│  - 返回 context bundle                       │
│                                             │
│  不做推理，不做建议，不做判断                     │
└─────────────────────────────────────────────┘
```

**AI 回答的约束规则：**

- 只基于 registered authoritative sources 回答
- 必须显示 citations（哪个 source、哪个 section）
- 必须显示 authority level badge
- 遇到 authority 冲突 → 提示用户两个 source 有分歧
- 遇到 source 过期 → 提示 freshness warning
- 遇到找不到相关 source → 明确告知"未找到注册的权威来源"
- 不生成声称可用的 Terraform 代码
- 不绕过 policy、不替代审批

---

**技术方向**

保持原始设计的 AWS 方向，补充 Portal 前端：

| 组件 | 技术选型 | 说明 |
|---|---|---|
| **Portal 前端** | React + lightweight framework | 静态部署或 SSR，V1 可以很轻 |
| **Atlas API** | API Gateway + Lambda | Consumer-neutral 的 context delivery API |
| **数据存储** | DynamoDB | Source registry、Topic registry、authority mapping、access metadata |
| **Source 访问** | Lambda → source systems | 请求时实时从 Terraform repos / Confluence / Policy docs 获取内容 |
| **凭证管理** | Secrets Manager / Parameter Store | Source 访问配置 |
| **AI 推理** | Bedrock / 外部 LLM | 在 Portal consumer 层调用，不在 Atlas 核心内 |
| **可观测性** | CloudWatch | 日志、指标、告警 |

**Request-Time Execution（继承原始设计）：**

V1 不做预计算索引、不做异步 ingest、不做后台 worker。所有 context delivery 在请求时完成：

1. 查 topic registry / source registry
2. 选候选 sources
3. 解析 source-native 锚点
4. 实时获取 excerpts
5. 打包 context bundle 返回

如果性能需要缓存，当作实现优化处理，不当作架构模型。

---

Part 3 的 context delivery、AI 边界和技术方向，你觉得怎么样？

**Part 3 确认**

> **Part 3（Context Delivery + AI + 技术方向）是否 OK？**
> - 没问题，继续最后一部分。
> - 有调整意见，先讨论。
>
> Answer: 没问题，portal 前端使用 tanstack start + vite 8

好，Portal 前端用 TanStack Start + Vite。

### Part 4：治理 + Scope 控制 + 失败模式 + 成功指标

**治理模型（轻量但显式）**

V1 治理原则：每个 source 有人管、每个 topic 有人答。

| 治理规则 | 说明 |
|---|---|
| 每个 source 必须有 steward | 谁负责内容准确性 |
| Authority level 必须显式标注 | authoritative / reference / example / draft / deprecated |
| 可见性和访问边界必须记录 | internal / restricted |
| 锚点必须可验证 | 注册时检查锚点是否可解析 |
| 过期和断链必须可见 | 超过 review_frequency 标记 "Needs Review"；锚点失效标记 "Broken Anchor" |
| Authority 冲突必须暴露 | 同一问题有两个 source 声称权威时，不隐藏，而是标记冲突 |

**质量信号直接传递给消费者**。Context bundle 不假装证据完整——如果 source 过期、锚点失效、authority 不清，bundle 里会带上这些 warning，由消费者决定如何处理。

**上游影响最小化**：
- Source owner 不需要维护额外的 metadata 合约
- 源系统继续作为内容创作地
- 治理 metadata 由 Atlas team 集中策展或增量补充

---

**V1 Scope 控制**

**V1 做什么：**

| 能力 | 说明 |
|---|---|
| Source Registry | 注册和管理 Terraform repos、Confluence pages、Policy docs |
| Topic Registry | 注册 capabilities 和 landing zones 作为导航实体 |
| Source-Topic Mapping | 多对多映射 + authority scope |
| Authority Mapping | 每个 source 的权威范围和等级 |
| Locator Resolution | 支持 3 种 source class 的锚点策略 |
| Context Bundle API | consumer-neutral 的 context delivery 接口 |
| Portal: Capability Discovery | topic_type=capability 的浏览和详情 |
| Portal: Landing Zone Navigator | topic_type=landing-zone 的导航和环境矩阵 |
| Portal: Ask Cloud Platform | AI 回答 + citation + authority badge |

**V1 不做什么：**

| 不做 | 原因 |
|---|---|
| Provisioning portal | 和 TFE / Harness 边界冲突 |
| 完整 CMDB / Service Catalog | 太重，V1 只做 topic registry |
| Shadow content store | 违反 source-native 原则 |
| AI 自动修改文档 | 权威性风险 |
| 全量文档迁移 | 引发 ownership 问题 |
| 预计算内容索引 | V1 走 request-time resolution |
| 全平台能力覆盖 | V1 pilot scope，先做 10-15 个核心 topic |
| Write-back memory layer | 不写合成内容回源系统 |

---

**失败模式（继承原始设计，Portal 层补充）**

| 失败模式 | 正确行为 |
|---|---|
| 相关 source 未注册 | 明确告知"未找到注册来源"，提供 feedback 路径 |
| Authority 在多个 source 间不清晰 | 暴露冲突，不选边 |
| 锚点失效 / 链接断裂 | 标记 Broken Anchor，回退到 source 级别 |
| 权限不匹配 | 告知存在相关 source 但无权限，指向申请路径 |
| Source class 锚点能力弱 | 标记 "weak anchoring"，只能提供 source 级别上下文 |
| Context bundle 过宽或过窄 | 提供 expansion / narrowing path，让消费者调整 |
| AI 回答无注册来源支撑 | 不编造答案，明确声明"超出已注册知识范围" |

---

**成功指标**

从两个维度评估——Context Layer 的质量（对内）和 Portal 的体验（对外）。

**Context Layer 质量指标：**

| 指标 | 衡量什么 |
|---|---|
| Source selection precision | 给定问题，返回的 sources 是否相关 |
| Anchor resolution success rate | 锚点解析成功率 |
| Citation completeness | context bundle 中 provenance 信息是否完整 |
| Access filtering correctness | 权限过滤是否准确 |
| Context bundle size | 返回的上下文是否精准、有界 |

**Portal 体验指标：**

| 指标 | 衡量什么 |
|---|---|
| Time to find right source | 找到正确文档的时间 |
| AI answer citation rate | AI 回答中有 citation 的比例 |
| Stale / broken source visibility | 过期或失效来源是否被有效标记 |
| Topic authority coverage | 核心 topic 是否都有权威 source 覆盖 |
| User return rate | 用户是否反复回来使用 |

---

Part 4 全部内容，你觉得怎么样？

**Part 4 确认**

> **Part 4（治理 + Scope 控制 + 失败模式 + 成功指标）是否 OK？**
> - 没问题，开始写设计文档。 ✔
> - 有调整意见，先讨论。

好，所有部分都确认了。现在我来写设计文档。

设计文档已经写入 `docs/architecture/current_design.md`。

快速做一个 self-review：

**Placeholder 扫描**：无 TBD / TODO，所有 section 都已填充。

**内部一致性检查**：
- 数据模型（Source + Topic 双实体）与各场景描述一致
- AI 边界（Atlas 不做推理）在架构图、AI 设计、约束规则中保持一致
- Consumer-neutral 原则在架构、系统边界、技术方向中贯穿
- V1 Scope 的"做"和"不做"没有矛盾

**Scope 检查**：适合一个 V1 实施计划。3 个场景 + 10-15 个 pilot topics，不是大杂烩。

**模糊性检查**：authority_scope 用了 string[]（如 `module-usage`, `security-guardrail`），这些值在 V1 初期可以是自由文本，后续如需收敛可以改为 enum。这个选择是刻意的，不算模糊。

---

请 review 一下这份设计文档。如果有需要修改的地方告诉我，确认没问题后我们可以进入下一步。

---
