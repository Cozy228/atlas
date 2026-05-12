**You:**

粘贴的 markdown (1)。md
文件
根据上面的内容，思考，搜索，研究一下，里面的几个问题，可以先向我提问补充缺失的内容，然后再开始做出你的推荐，分析。

* * *

**ChatGPT:**

我会先按“这是一个内部 DevEx / Platform as Product 的 V1 方案评审”来处理：先补几条关键问题，然后不等答案，基于当前文档和公开资料给出可落地推荐。重点会放在：维护机制、是否只是 link site、业务价值、V1 边界、代码/文档对齐。

* * *

**ChatGPT:**

我已经确认了文档里的主要矛盾：产品定义是“governed information layer / Context API”，但实现仍是 TS seed + in-memory registry；最大风险不是技术栈，而是维护权责没有闭环。这个点会决定它是平台产品，还是几年后没人信的链接站。

* * *

**ChatGPT:**

## 先补充 6 个问题，但我先不等答案

这些问题会影响最终方案，但不影响当前推荐：

1. **Registry 谁负责最终审核？**  
    是 Cloud Platform team、Architecture Governance、还是每个 capability 的 steward 自己负责？
2. **V1 要接哪些真实 source？**  
    Git repo、Confluence、SharePoint、policy repo、TFE module registry、Harness pipeline、ServiceNow、Jira，哪些是真正能读 API 的？
3. **领导最在意的指标是什么？**  
    减少 support ticket、减少 onboarding 时间、提高 TFE module adoption、降低错误环境使用、还是 AI-ready platform story？
4. **组织是否接受 GitOps 维护 registry？**  
    即用 PR-reviewed YAML/JSON 管理 source/topic/authority metadata，而不是做 admin UI。GitOps 指“把配置变更放进 Git，通过 Pull Request 审核、审计、合并后生效”。
5. **Atlas Portal 允许展示多少正文？**  
    只展示 excerpt + citation，还是允许展示完整文档内容？这会决定它是“context router”还是开始变成 CMS。CMS 指“内容管理系统”，例如 Confluence 那类直接承载正文和编辑流程的系统。
6. **Ask Atlas 是 demo，还是 V1 核心卖点？**  
    如果只是 demo，Context API 是主产品；如果是核心卖点，就必须更早做权限、提示词注入防护、引用校验、输出审计。

---

# 我的核心判断

**Atlas 不应该被定义成“内部开发者门户”。这个说法太泛，容易被领导理解成 Backstage / service catalog / link portal 的弱替代。**

更准确的定位应该是：

> **Atlas 是 Cloud Platform 的 governed context layer：用 authority、ownership、freshness、source locator 和 citations，把分散的 Git / Confluence / TFE / Harness / policy source 组织成可被人和 AI 共同消费的可信上下文。Portal 只是第一个 UI consumer。**

你的文档本身已经很接近这个方向：Atlas 被定义为 governed information layer，不替代 TFE/Harness/Confluence/Git，而是组织它们并返回 citation-ready evidence；V1 成功标准也是发现 capability / landing zone、看 owner/support/tools/authoritative sources、生成 context bundle、让 Ask Atlas 只基于 bundle 回答。

粘贴的 markdown (1)。md

公开资料也支持这个方向。CNCF 对 platform 的描述重点不是“做一个网站”，而是把通用 capability、framework、experience 组织起来，降低产品团队认知负担、复用知识和工具、嵌入治理；同时平台团队应持续收集反馈、衡量用户活动。[CNCF TAG App Delivery](https://tag-app-delivery.cncf.io/whitepapers/platforms/) DORA 2024 也指出 internal developer platform 能提升个人、团队和组织表现，但要注意稳定性和 throughput tradeoff，不能只堆工具。[Dora](https://dora.dev/research/2024/dora-report/)

---

# 对几个开放问题的推荐

## 1. Source management：不要做 admin UI，做 registry-as-code

**推荐：V1 用 GitOps YAML/JSON 作为 registry 的 source of truth。**

不要在 V1 做 admin UI。原因很简单：admin UI 会把产品重心从“可信上下文层”拖到“维护后台”，而且你们还没有稳定的 stewardship model。先用 PR-reviewed registry 文件，反而更符合企业内部治理。

Backstage 的 catalog 也是一个参考：它的 metadata YAML 存在 source control 里，团队用正常 Git workflow 维护 metadata，合并后 catalog 自动展示更新。[Backstage](https://backstage.io/docs/features/software-catalog/) HashiCorp 对 GitOps 的说明也强调 Git 作为 single source of truth、PR 审核、审计轨迹、减少 drift。[HashiCorp Developer](https://developer.hashicorp.com/well-architected-framework/define-and-automate-processes/process-automation/gitops)

建议 V1 registry 文件拆成：

```
data/
  sources/
    aws-textract-module.yaml
    cloud-policy-baseline.yaml
  topics/
    textract.yaml
    api-gateway.yaml
    agentcore.yaml
  mappings/
    textract-authority.yaml
    landing-zone-authority.yaml
  owners/
    cloud-platform.yaml
    security-architecture.yaml
```

核心字段建议：

```YAML
id: aws-textract-module
type: git
title: AWS Textract Terraform Module
system: GitHub Enterprise
locator:
  repo: cloud-platform/terraform-modules
  path: modules/textract/README.md
  ref: main
  anchors:
    - id: usage
      selector: "#usage"
authority:
  level: canonical
  scope:
    capability: textract
    environment: aws-federated
owner:
  team: cloud-platform
  contact: "#cloud-platform-support"
freshness:
  last_reviewed_at: "2026-05-01"
  review_cycle_days: 90
status: active
visibility: internal
warnings: []
```

**关键点：Atlas 存 metadata 和 locator，不存正文。**  
正文仍在 Git/Confluence/policy repo。Atlas 只回答：“这是什么、谁负责、在哪、对什么范围权威、是否过期、能否被 Context API 包装”。

---

## 2. Maintenance：必须把 “source steward” 变成一等概念

现在最大缺口不是 DynamoDB，也不是 fetcher，而是：

> **source-native 不等于 ownership-free。**

你们说 source systems 是 system of record，Atlas 不做 shadow doc library；这个原则是对的。文档也明确 V1 没有 registry admin UI，cloud platform / stewardship teams 负责维护 registry 和 mappings，并在自己的系统里维护 authoritative content。

粘贴的 markdown (1)。md

但这里必须补一个机制：**每条 source 必须有 steward、review SLA、health check、feedback routing。**

建议维护闭环：

| 事件 | Atlas 行为 | Owner 行为 |
| --- | --- | --- |
| source 新增 | registry PR + schema validation | steward 审核 authority scope |
| doc 修改 | nightly checker 检查 last modified / anchors | steward 判断是否更新 registry |
| anchor 失效 | Portal 显示 broken warning | ticket 自动指给 owner |
| source 超过 review cycle | Portal 显示 stale warning | owner 重新 review |
| 用户反馈“文档错了” | feedback 记录 + 自动路由 | owner triage |
| source retired | status 改 deprecated/retired | capability detail 替换 authoritative source |

建议加 4 个状态：

```
proposed -> active -> stale/deprecated -> retired
```

再加 4 类 warning：

```
STALE_SOURCE
BROKEN_LOCATOR
RESTRICTED_VISIBILITY
AUTHORITY_CONFLICT
```

其中 **AUTHORITY_CONFLICT** 很重要。它能让 Atlas 超越 link site：当两个文档都声称自己是 AWS landing zone 的官方指引时，Atlas 应该能明确告诉用户哪个 source 对哪个 scope 权威，而不是只按搜索相关性排序。

---

## 3. “是不是 link aggregator”：现在有这个风险，但不是必然

**诚实判断：当前实现如果停在 TS seed + in-memory excerpts + outbound links，它在体验上会很像 link aggregator。**

你的文档也承认当前 registry 只是 TypeScript pilot seed，sources/topics/anchors/mappings 都不是 durable registry；live Git/Confluence/policy fetchers 没有接入；pilot content 用的是 in-memory excerpts。

粘贴的 markdown (1)。md

所以现在不能向 stakeholder 暗示它已经是完整 source governance system。

但产品设计本身不是 link aggregator。区别在这里：

| Link site | Atlas 应该交付 |
| --- | --- |
| 给链接 | 给 source + authority + scope + owner + freshness |
| 依赖标题搜索 | 依赖 topic registry + authority mapping |
| 用户自己判断哪个可信 | 系统告诉用户哪个 source 对哪个 scope 权威 |
| 只服务人 | 同时服务 Portal、Ask Atlas、agent、CLI、automation |
| 链接坏了用户才发现 | health check 主动提示 broken/stale |
| AI 随便搜文档 | AI 只能用 Context API bundle + citation |

所以 leadership narrative 不要说：

> “We are building a developer portal.”

要说：

> “We are building the governed context layer for platform knowledge. The portal is the visible entry point; the Context API is the reusable asset.”

---

## 4. Documentation inside Portal vs source-native：只做 “reader preview”，不要做 CMS

推荐 V1 做：

```
Capability Page
  - Summary: Atlas-owned lightweight description
  - Authoritative Sources: source cards
  - Context Preview: short excerpts from source systems
  - Open Canonical Source: deep link
  - Ask Atlas: cited answer
  - Feedback: wrong/stale/missing
```

不要做：

```
Full documentation authoring
Inline long-form editing
Atlas-owned rewritten docs
Duplicate policy copies
```

原因：一旦 Portal 里承载太多正文，用户会分不清“Atlas 展示的内容”和“canonical source”谁才是真相。你们的原则是 source-native、request-time content、不做 durable mirror，这很合理。

粘贴的 markdown (1)。md

但也不要极端到只放链接。只放链接体验太弱。最佳形态是：

> **Inline enough to decide, deep link for authority.**

也就是 Portal 里展示足够信息让用户判断下一步：owner、支持路径、适用环境、最新 review 时间、warning、关键 excerpt、citation。真正的正文、编辑、版本历史仍回到 Git / Confluence / policy repo。

---

## 5. Ask Atlas：可以作为 V1 proof，但不要让它反客为主

Ask Atlas 的价值不是“聊天”，而是证明 Context API 有价值：

> **同一个 governed context bundle，可以被 Portal、agent、CLI、workflow、future MCP server 复用。**

这里需要注意安全边界。OWASP LLM Top 10 把 prompt injection、敏感信息泄露、过度代理、misinformation 等列为 LLM 应用风险；对 RAG 场景，OWASP 也明确说 RAG 和微调不能完全缓解 prompt injection，需要输出格式校验、source citation、least privilege、外部内容隔离等控制。[OWASP Foundation](https://owasp.org/www-project-top-10-for-large-language-model-applications/) [OWASP Gen AI Security Project](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)

所以 V1 的 Ask Atlas 建议只做：

```
read-only Q&A
no tool action
no provisioning
no write-back
no ticket creation by LLM directly
only cite bundle source
uncited claim stripped or flagged
```

不要做：

```
Ask Atlas 帮你创建 landing zone
Ask Atlas 修改 TFE workspace
Ask Atlas 自动改 policy
Ask Atlas 自动更新 registry
```

它应该是 **trust demo**，不是 agentic automation demo。

---

# 推荐的 V1 产品边界

## V1 不要追求“大而全 portal”

建议 V1 的边界是：

| Area | V1 做 | V1 不做 |
| --- | --- | --- |
| Capability discovery | 10–15 个 pilot capabilities | 全量 platform catalog |
| Landing zone navigator | 只做信息导航 | 创建/修改 landing zone |
| Registry | GitOps YAML/JSON + validation | Admin UI |
| Source fetcher | 接 1–2 个真实 source 类型 | 全部系统集成 |
| Context API | bundle + citation + warnings | 通用搜索引擎 |
| Ask Atlas | read-only cited Q&A | agentic execution |
| Feedback | 提交 + owner routing | 完整 workflow system |
| Auth | trusted internal/no-auth warning model | 复杂 RBAC/SSO |

Microsoft 对 platform engineering 的建议也类似：平台建设应 incremental，不建议 big bang；要用 product mindset，做 thinnest viable platform / MVP，再逐步扩展。[Microsoft Learn](https://learn.microsoft.com/en-us/platform-engineering/what-is-platform-engineering) CNCF maturity model 也提醒，不是成熟度越高越好，每一层成熟度都需要更多资金和人力，应该根据组织上下文判断是否值得。[cloudnativeplatforms.com](https://cloudnativeplatforms.com/whitepapers/platform-eng-maturity-model/)

---

# 技术实现推荐

## 1. 立即把 TS seed 降级为 demo seed

现在代码和文档有一个 stakeholder 风险：文档讲的是未来 registry / YAML / Dynamo，代码是 TS seed + optional feedback Dynamo。

粘贴的 markdown (1)。md

建议直接在文档里写：

```
Current pilot status:
- Registry is in-memory TS seed.
- Feedback can persist to DynamoDB when configured.
- Source resolvers are structurally present but live Git/Confluence fetchers are not yet wired.
- Therefore, current pilot proves UX + contract + authority model, not full registry operations.
```

这不是自曝短板，而是建立信任。否则别人 demo 后会问：“那怎么维护？”你会被迫现场解释。

## 2. Registry 持久化不要急着上 DynamoDB

我的建议顺序：

```
Phase 1: YAML/JSON registry in Git + CI validation
Phase 2: build-time or deploy-time compile to JSON artifact
Phase 3: Context Layer reads compiled registry
Phase 4: optional DynamoDB read model/cache
Phase 5: future admin API/UI
```

DynamoDB 适合 runtime query 和 feedback，不适合一开始当 source of truth。原因：source governance 需要 review、diff、audit、rollback；Git 天然更适合。

## 3. Real source fetcher 先接 Git，再接 Confluence

优先级：

1. **Git fetcher**：最适合工程文档、module README、policy-as-code、版本化 locator。
2. **Confluence fetcher**：适合组织说明和 guide，但 anchor 稳定性、权限、页面移动会更麻烦。
3. **TFE/Harness metadata adapter**：先只做 link + metadata，不急着深度集成。
4. **Policy repo adapter**：适合展示 enforced policy 和 authority scope。

Git 先做成一个完整闭环：

```
registry source -> fetch Git markdown -> resolve anchor -> assemble excerpt -> citation -> Ask Atlas answer
```

这个闭环比同时接 5 个系统更能证明价值。

---

# Business value 怎么讲

不要讲“减少找文档时间”这么弱。这个当然有价值，但太像 link site。

建议对领导这样讲：

## 版本 A：偏平台成熟度

> Atlas turns scattered platform knowledge into governed, reusable context. It helps application teams find the right capability, understand which guidance is authoritative, know who owns it, and consume the same trusted context through Portal, API, and AI experiences.

## 版本 B：偏风险治理

> Atlas reduces platform guidance risk. Instead of developers relying on outdated Confluence pages or tribal knowledge, Atlas exposes authority, scope, freshness, owner, and warnings for each source. Ask Atlas is constrained to registered context and citations, preventing AI from inventing platform policy.

## 版本 C：偏 AI-ready

> Atlas is the context control plane for future platform agents. Before agents can safely recommend or automate cloud workflows, the organization needs a governed layer that defines which sources are authoritative, current, and citable.

CNCF 的 platform 价值里包含降低认知负担、复用工具和知识、治理平台 capability；这正好支撑 Atlas 的 business case。[CNCF TAG App Delivery](https://tag-app-delivery.cncf.io/whitepapers/platforms/) DORA 的发现也可以作为外部背书：IDP 能提升生产力和组织表现，但要围绕 developer independence 和稳定性谨慎实施。[Dora](https://dora.dev/research/2024/dora-report/)

---

# 最推荐的决策

## 直接定 5 条原则

1. **Atlas is not a CMS.**  
    不承载 canonical docs，不做长文档编辑。
2. **Atlas is not just a portal.**  
    Portal 是 consumer，Context API 才是核心资产。
3. **Registry is managed as code in V1.**  
    YAML/JSON + PR review + schema validation + CI health checks。
4. **Every authoritative source must have an owner and freshness policy.**  
    没 owner 的 source 不允许成为 canonical。
5. **Ask Atlas is read-only and citation-bound.**  
    它证明 governed context，不做自动操作。

---

# 具体落地路线

## Week 1–2：产品口径收敛

交付物：

```
Atlas V1 Product Boundary
Atlas Registry Stewardship Model
Atlas Source Object Schema
Atlas Context Bundle Contract
Pilot Limitation Statement
```

关键修改：

* 明确当前 pilot 是 “contract + UX proof”。
* 明确 registry-as-code 是 V1 维护方式。
* 明确 source steward、review SLA、warning model。
* 明确 Portal 不 bypass Context API。

## Week 3–4：registry-as-code

交付物：

```
data/*.yaml
schema validation
registry compile script
CI check:
  - duplicated id
  - missing owner
  - invalid authority scope
  - invalid locator
  - stale last_reviewed_at
```

## Week 5–6：真实 source fetcher

优先做 Git fetcher：

```
Git markdown -> anchor resolution -> excerpt -> citation -> context bundle
```

这一步完成后，Atlas 就不再只是“假数据 demo”。

## Week 7–8：feedback 到 ownership

交付物：

```
feedback type:
  - stale
  - wrong
  - missing
  - broken link
  - authority conflict

routing:
  source.owner.team
  support channel
  optional Jira/ServiceNow integration later
```

## Week 9+：Ask Atlas hardening

交付物：

```
citation validator
uncited claim remover
answer confidence/warning display
prompt injection test cases
read-only limitation banner
```

---

# 最后判断

**Atlas 这个方向值得做，但必须把“维护机制”提前到 V1。**

否则它会变成：

```
漂亮首页 + capability cards + links + AI demo
```

这类东西短期 demo 好看，长期没人信。

真正能站住的 V1 应该是：

```
GitOps registry
+ source steward model
+ authority/freshness/warning
+ real Git source fetcher
+ Context API bundle
+ Portal as first consumer
+ Ask Atlas as citation-bound proof
```

这样它不是 link site，而是一个很清晰的内部平台资产：**Platform Knowledge 的 governance layer / context control plane**。

* * *

**You:**

Registry是cloud platform team和capability steward自己负责。V1接这些所有的。领导最在意的指标应该是减少Onboarding时间,AI ready platform storage这个也说得通,然后减少context switch。 在guideline里面都有说明。接受GitOps维护Registry就没问题。允许展示多少正文,我觉得如果展示正文的话,可能最简单,对我们产品也最好,但是从难度和问题来讲,它会变成第二个truth of source,这不太合理,除非它能够变成first and only truth of source,我觉得它可以变为CMS。Ask Atlas这个不是这个讨论的重点,所以可以全部去掉,后续。

* * *

**ChatGPT:**

基于你的补充，方案应该明显收敛：

> **V1 不再把 Ask Atlas 当核心讨论点。Atlas V1 应该定义为 Cloud Platform 的 governed knowledge portal + source registry，而不是 AI Q&A 产品。AI-ready 是架构收益，不是 V1 主叙事。**

---

# 结论先说

我建议 V1 定位改成：

> **Atlas is a governed Cloud Platform knowledge portal that helps application teams discover capabilities, landing zones, authoritative guidance, owners, support paths, and source-of-truth documents with reduced onboarding time and context switching.**

中文就是：

> **Atlas 是 Cloud Platform 的可信知识入口，用 registry、authority、ownership、freshness 和 source links，把分散在 Git / Confluence / TFE / Harness / policy repo 里的平台知识组织起来，减少新人上手时间和跨工具切换成本。**

这比之前更稳，因为你的领导关心的是：

1. **减少 onboarding 时间**
2. **减少 context switch**
3. **AI-ready platform storage / context foundation**
4. **平台成熟度从 tooling 走向 experience**

这些本来就在 guideline 的叙事里：当前没有统一开发者门户，文档分散且过时，discoverability 差，未来方向是 information-centric DevEx portal，并探索 AI-based documentation discovery and maintenance。

粘贴的 markdown (1)。md

---

# 产品边界重新定义

## V1 应该保留

| 模块 | 是否 V1 | 原因 |
| --- | --- | --- |
| Home | 是 | 做统一入口 |
| Capability discovery | 是 | 直接减少 onboarding |
| Capability detail | 是 | 展示 owner、support path、tools、source |
| Landing zone navigator | 是 | 解决环境/平台入口混乱 |
| Authoritative source registry | 是 | 核心资产 |
| GitOps registry maintenance | 是 | 不做 admin UI 的前提下最合理 |
| Source freshness / warning | 是 | 避免“又一个过时链接站” |
| Feedback path | 是 | 维护闭环 |
| Context API | 是，但降级为内部能力 | 为 Portal 和未来 AI consumer 准备 |
| Ask Atlas | 否 / 后续 | 当前不是重点，先移出 V1 |

## V1 应该去掉或弱化

| 模块 | 处理 |
| --- | --- |
| Ask Atlas | 从 V1 product scope 移出 |
| LLM adapters | 作为实验/后续，不放进主叙事 |
| citation validation | 暂时不是 V1 关键路径 |
| AI answer contract | 保留为未来 consumer 设计，不作为 demo 重点 |
| admin UI | 不做 |
| provisioning workflow | 不做 |
| full CMDB/service catalog | 不做 |

---

# 关于 “展示正文” 与 “CMS” 的判断

你这个判断是对的：

> **展示正文对用户体验最好，但产品风险最大。**

因为一旦 Atlas 展示太多正文，用户会自然把 Atlas 当成 source of truth。问题是：如果真正的 canonical source 还在 Confluence / Git / policy repo，那么 Atlas 就会变成第二个 truth source。

这会引发几个问题：

1. **内容漂移**  
    Git/Confluence 改了，Atlas 没同步，用户信谁？
2. **责任模糊**  
    原文档 owner 和 Atlas maintainer 谁负责内容正确性？
3. **审计困难**  
    policy / landing zone guidance 这种内容一旦涉及合规，重复存储会制造审计风险。
4. **维护成本失控**  
    Atlas 从 portal 变成 CMS 后，就要处理编辑、权限、版本、审批、发布、回滚、审计。

所以我建议分两阶段：

---

## V1：不要做 CMS，只做 “source-native preview”

V1 展示：

```
- capability summary
- owner
- support path
- related tools
- authoritative sources
- source scope
- source freshness
- warning
- short excerpt / preview
- deep link to canonical source
```

不要展示：

```
- 完整正文
- Atlas 内编辑
- Atlas 内重写文档
- Atlas 独立版本历史
- Atlas 作为唯一政策发布平台
```

这样 Atlas 仍然是：

> **可信知识入口 + source registry + experience layer**

而不是：

> **第二个 Confluence**

这和当前文档里的 source-native 原则一致：source systems 仍是 system of record，Atlas 持有 metadata、authority、locator，不做 shadow doc library。

粘贴的 markdown (1)。md

---

## V2 / V3：可以考虑 CMS，但必须满足一个前提

只有当组织明确决定：

> **Atlas becomes the first and only truth source for selected Cloud Platform knowledge.**

也就是：

> **某些类型的 Cloud Platform 文档以后只在 Atlas 里 author、review、publish。**

那它才可以变 CMS。

但这不是一个 UI 选择，而是组织治理选择。

如果 Atlas 要成为 CMS，必须补：

| 能力 | 为什么需要 |
| --- | --- |
| Authoring workflow | 谁能写、谁能改 |
| Review / approval | 防止错误 guidance 发布 |
| Version history | 审计和回滚 |
| Ownership model | 每篇文档 owner |
| Publishing status | draft / review / published / deprecated |
| Permission model | 谁能看、谁能编辑 |
| Migration plan | Confluence/Git 旧内容怎么办 |
| Search / IA governance | 信息架构治理 |
| Retention / audit | 合规要求 |

所以我建议现在不要把 CMS 放进 V1。可以在 roadmap 里写成：

> **Potential future direction: Atlas may become the canonical publishing surface for selected Cloud Platform knowledge categories, but V1 remains source-native to avoid duplicating truth.**

---

# Registry ownership 模型

你补充说：

> Registry 由 Cloud Platform team 和 capability steward 共同负责。

这个很好，建议直接固化成 **shared ownership model**。

## 推荐职责划分

| 角色 | 负责什么 |
| --- | --- |
| Cloud Platform Team | Registry schema、CI validation、Portal experience、source connector、overall governance |
| Capability Steward | Capability 内容准确性、authoritative source、owner/support path、freshness review |
| Source Owner | 原始文档内容维护，例如 Git/Confluence/policy repo |
| Consumer Team | 使用、反馈、报告 stale / missing / wrong guidance |

## Registry 变更流程

```
1. Capability steward 提 PR
2. CI 校验 schema / owner / authority scope / locator / freshness
3. Cloud Platform team review registry structure
4. Capability steward review content ownership
5. merge 后自动发布到 Atlas
6. Portal 显示更新
```

这比 admin UI 更适合 V1。原因：

* 有审计
* 有 diff
* 有 approval
* 易回滚
* 更符合工程团队习惯
* 不需要先建设后台权限模型

---

# V1 接所有 source 的处理方式

你说 V1 会接这些所有的：

* Git
* Confluence
* TFE
* Harness
* policy repo
* 可能还有 landing zone / internal portal / support path

这里我建议分清楚 **source connector** 和 **source card**。

不要一开始每个系统都做深度 fetcher。V1 可以所有都接，但接入深度不同。

## 推荐分级

| Source 类型 | V1 接入深度 |
| --- | --- |
| Git / policy repo | 深度接入：metadata + locator + excerpt + anchor health check |
| Confluence | 中度接入：metadata + locator + excerpt，先不做复杂权限 |
| TFE | 轻接入：workspace/module link + owner + usage guidance |
| Harness | 轻接入：pipeline link + owner + support path |
| Landing zone portal | 轻接入：deep link + environment scope |
| Support channel | metadata link |
| Jira/ServiceNow | 后续，先不强依赖 |

也就是说，V1 口径可以是：

> Atlas supports all major platform source types as registered sources, but V1 resolver depth varies by source type.

不要承诺所有 source 都能完整正文解析、anchor resolution、freshness tracking。否则工作量会爆。

---

# V1 的页面结构建议

## 1. Home

目标：减少 context switch。

内容：

```
- Search / jump to capability
- Popular capabilities
- Landing zone navigator
- Recently updated platform guidance
- Support entry
- Getting started path
```

## 2. Capability list

例如：

```
Capabilities
- API Gateway
- Textract
- AgentCore
- Landing Zone
- TFE Module
- Harness Deployment
- Logging
- Monitoring
- IAM / Access
- Network
- Security Baseline
```

每个 card 展示：

```
- capability name
- short description
- owner
- maturity
- support path
- authoritative source count
- warning badge
```

## 3. Capability detail

这是 V1 最重要页面。

建议结构：

```
Capability: AWS Textract

What it is
- 一句话说明

When to use
- 适用场景

How to start
- 推荐入口
- TFE module
- required policy / landing zone notes

Owners
- capability steward
- support channel

Authoritative sources
- Git module README
- Policy baseline
- Confluence onboarding guide
- TFE module registry
- Harness pipeline

Warnings
- stale
- broken locator
- restricted visibility
- authority conflict

Feedback
- this is wrong
- source is stale
- missing guidance
```

## 4. Landing Zone Navigator

目标：帮助用户理解不同环境。

展示：

```
- landing zone name
- owner
- environment
- supported capabilities
- provisioning tool
- documentation
- support path
- restrictions
```

## 5. Source detail

这个页面很关键，因为它证明 Atlas 不只是链接站。

展示：

```
Source
- title
- type
- system
- owner
- authority level
- authority scope
- last reviewed
- freshness status
- linked capabilities
- locator
- warnings
- open canonical source
```

---

# 指标设计

既然领导关注 onboarding、context switch、AI-ready，那么指标不要泛泛地说“访问量”。

## Primary metrics

| 指标 | 含义 |
| --- | --- |
| Time-to-first-capability | 新用户从进入 Atlas 到找到目标 capability 的时间 |
| Time-to-authoritative-source | 从搜索问题到打开权威 source 的时间 |
| Onboarding path completion | 新用户完成 getting started path 的比例 |
| Context switch reduction | 用户完成一个任务所需跨工具跳转次数减少 |
| Support deflection | 原本会问 support 的问题，通过 Atlas 自助解决 |
| Stale source detection | 被发现并修复的 stale/broken source 数量 |

## Secondary metrics

| 指标 | 含义 |
| --- | --- |
| Capability coverage | 已纳入 Atlas 的 capability 数 |
| Source coverage | 已注册 source 数 |
| Owner completeness | source / capability owner 填写率 |
| Freshness compliance | review 未过期的 source 比例 |
| Feedback resolution time | stale/wrong/missing feedback 解决时间 |

## AI-ready 指标

先不要做 Ask Atlas，但可以做 readiness 指标：

| 指标 | 含义 |
| --- | --- |
| Context bundle coverage | 有完整 context bundle 的 capability 比例 |
| Citation-ready source ratio | 能提供 locator / excerpt / provenance 的 source 比例 |
| Authority mapping completeness | capability 到 authoritative source 的映射完整度 |
| Machine-readable registry completeness | owner、scope、freshness、locator 等字段完整率 |

这样 AI-ready 不需要靠 chatbot demo 来证明。

---

# V1 文档应该怎么改

我建议你把原文档里的 Ask Atlas 相关内容降级：

## 原本

```
Atlas Portal
Atlas Context Layer
Ask Atlas
```

## 改成

```
Atlas Portal
Atlas Registry & Context Layer
Future AI Consumers
```

### 新表述

```
Atlas has two V1 surfaces:

1. Atlas Portal
Human-facing internal Cloud Platform knowledge portal.

2. Atlas Registry & Context Layer
Governed source registry, topic registry, authority mapping, locator resolution, freshness/warning model, and context bundle assembly.

Ask Atlas and other AI consumers are future consumers of the Context Layer, not part of the V1 product scope.
```

---

# 推荐新的 V1 success criterion

原来的成功标准里有 Ask Atlas，可以改成：

```
V1 success criterion:

A user can:
1. Find a cloud platform capability or landing zone from one internal entry point.
2. Understand what it is, when to use it, who owns it, and where to get support.
3. Identify the authoritative source-of-truth documents for that capability or landing zone.
4. See source authority, freshness, scope, and warnings before following a link.
5. Open the right tool or canonical document without manually searching across Git, Confluence, TFE, Harness, and policy repositories.
6. Submit feedback when guidance is stale, missing, broken, or unclear.
```

这个更贴近你的 leadership metrics。

---

# 推荐新的产品定位

## 一句话

> **Atlas reduces cloud platform onboarding time and context switching by turning fragmented platform knowledge into a governed, source-native knowledge portal.**

## 中文

> **Atlas 通过 governed registry、authority mapping 和 source-native preview，把分散的平台知识组织成可信入口，从而减少新人上手时间和跨工具切换成本。**

## 稍长版

> **Atlas is not a provisioning portal, not a CMS, and not an AI chatbot. V1 is a governed Cloud Platform knowledge portal. It helps application teams discover capabilities and landing zones, understand ownership and support paths, identify authoritative sources, and navigate to the right tools and documents with confidence.**

---

# 我会这样定最终方向

## V1 产品名义

**Cloud Platform Knowledge Portal**

## V1 技术核心

**Registry & Context Layer**

## V1 维护模式

**GitOps registry owned by Cloud Platform Team + Capability Stewards**

## V1 价值指标

**Onboarding time reduction + context switch reduction + source trust/freshness**

## V1 不做

**Ask Atlas、CMS、provisioning、admin UI**

## V1 可保留的未来叙事

**AI-ready platform context foundation**

---

# 最终建议

你现在应该把方案从：

```
DevEx portal + Context API + Ask Atlas
```

改成：

```
Governed Cloud Platform Knowledge Portal
+ GitOps Source Registry
+ Authority / Freshness / Ownership Model
+ Source-native Preview
+ Future AI-ready Context Layer
```

这会更符合你当前组织阶段，也更容易过评审。

因为真正的问题不是“能不能做一个 portal”，而是：

> **团队能不能在一个入口里快速找到可信的平台知识，并知道它是否权威、是否新、谁负责、下一步去哪。**

Atlas V1 只要把这个问题解决，就已经足够有价值。

* * *

**You:**

注意后面只讨论产品不要给任何代码，你说的定位与我当前的想法是完全贴合的，但是我对于如何管理sources这部分还想不清楚。当前实现只是v1，本地以及demo purpose，现在还不是一个完整的已经发布的产品。别说week123，说方向123。GitOps registry
+ source steward model
+ authority/freshness/warning
+ real Git source fetcher
+ Context API bundle
+ Portal as first consumer
+ Ask Atlas as citation-bound proof这些站得住。landingzone navigator改为通用navigator 可以提供不同场景的guidance比如如何申请权限如何onboard 如何选择landingzone如何配置。 sources 我想讨论的是如何长期维护，一是不同的系统，二是权限问题 三是如何新增比如confluence的一篇文章，如何追踪改动，四是如何自动化维护过程。
展开

* * *

**ChatGPT:**

# Source management 的核心问题

你这里真正要设计的不是“怎么存 source list”，而是：

> **Atlas 如何长期知道：哪些 source 存在、谁负责、对什么问题权威、是否还能访问、是否已经过期、是否和别的 source 冲突。**

所以 source management 不应该被理解成一个简单的表：

```
source title
source url
owner
```

而应该是一个 **source lifecycle system**。

V1 可以很轻，但模型必须从一开始站得住。

---

# 先定产品原则

## 1. Atlas 不拥有 source 内容

Atlas V1 不应该复制完整正文，也不应该成为第二个 Confluence / Git / SharePoint。

它拥有的是：

```
- source metadata
- authority scope
- owner / steward
- locator
- freshness status
- health status
- warning
- preview / excerpt
- relationship to capabilities / scenarios / navigators
```

这和你文档里的 source-native 原则一致：source systems 仍是 system of record，Atlas 保存 metadata、authority、locators，不做 shadow doc library。

粘贴的 markdown (1)。md

---

## 2. Source 不是“链接”，而是“被治理的证据单元”

一个普通 link 只回答：

> 去哪里看？

一个 Atlas source 应该回答：

> 这个东西是谁维护的？对什么问题权威？最后什么时候 review？现在还能不能访问？有没有权限限制？是否已过期？是否被别的 source 替代？它能支撑哪些 scenario guidance？

所以 source 是 Atlas 的核心产品对象。

---

## 3. Source management 要分成两层

这是最关键的拆分。

| 层 | 负责什么 | 例子 |
| --- | --- | --- |
| **Source Registry** | 记录 source 是什么、谁负责、权威范围、locator、freshness policy | 某篇 Confluence 文档、某个 Git README、某个 TFE module page |
| **Source Resolver** | 去原系统检查 source 是否存在、是否更新、能否读取、能否生成 preview | Confluence API、Git fetcher、TFE metadata adapter |

Registry 是治理层。  
Resolver 是技术连接层。

长期维护时，**不要让 resolver 决定 source 是否权威**。Resolver 只能告诉你：这个 source 现在是什么状态。权威性必须由 registry + steward 显式声明。

---

# Source 的生命周期

我建议 source lifecycle 这样设计：

```
Proposed
→ Active
→ Needs Review
→ Stale
→ Deprecated
→ Retired
```

## 各状态含义

| 状态 | 含义 |
| --- | --- |
| **Proposed** | 有人提议新增 source，但还没被接受为 Atlas source |
| **Active** | 当前有效，可展示，可被 navigator / capability 使用 |
| **Needs Review** | source 有变化、过期、或被反馈，需要 steward review |
| **Stale** | 超过 freshness policy，仍可展示，但必须明显 warning |
| **Deprecated** | 不再推荐使用，但保留用于过渡或历史说明 |
| **Retired** | 不再展示给普通用户，只保留审计记录 |

这个生命周期能解决长期维护的基本问题。

---

# 一、不同系统怎么管理

你提到的系统可以分成几类，不要一刀切。

## Source system 分类

| 类型 | 例子 | Atlas 应该怎么处理 |
| --- | --- | --- |
| **Document source** | Confluence、SharePoint、Git Markdown | 可 preview，可 freshness check，可用于 guidance |
| **Engineering source** | Git repo、module README、policy repo | 权威性强，适合做 canonical source |
| **Tool source** | TFE、Harness、ServiceNow、Jira | 更多是 action entry，不一定适合做正文 source |
| **Support source** | Slack/Teams channel、mail group、support queue | 是 support path，不是 authoritative document |
| **Policy source** | policy repo、security baseline、standard document | 高权威，需要强 owner 和 review |
| **Capability source** | module registry、landing zone guide、onboarding doc | 面向用户的主要 source |

不要把所有东西都叫 source。否则 source 会膨胀成垃圾桶。

建议产品对象分成：

```
Source
Tool
Support Path
Scenario
Capability
Navigator Item
```

其中：

* **Source**：承载知识或规则。
* **Tool**：用户下一步去操作的系统。
* **Support Path**：用户遇到问题找谁。
* **Scenario**：用户要完成的任务，例如“申请权限”“选择 landing zone”。
* **Capability**：平台能力，例如 Textract、API Gateway、Logging。
* **Navigator Item**：把 scenario 和 capability 组织成可浏览路径。

---

## 不同系统的推荐接入方式

| 系统 | 是否作为 source | 推荐方式 |
| --- | --- | --- |
| Git README | 是 | 强 source，适合作 canonical |
| Git policy repo | 是 | 强 source，适合作 canonical |
| Confluence page | 是 | 中强 source，适合作 guide / how-to |
| SharePoint doc | 是 | 可作为 document source，但权限和版本要注意 |
| TFE module page | 部分是 | 更多是 tool entry + metadata source |
| Harness pipeline | 通常不是 | 多数是 tool entry，不是知识 source |
| Jira ticket | 通常不是 | 不适合作 authoritative source |
| ServiceNow KB | 可能是 | 如果组织把 KB 当官方流程，可以作为 source |
| Slack/Teams | 不建议 | 只能作为 support path 或 signal，不作为权威 source |

这会让你的 source registry 保持干净。

---

# 二、权限问题怎么处理

权限问题要分两层：

```
Atlas 能不能知道这个 source 存在？
用户能不能打开这个 source？
```

这两个不是一回事。

---

## 推荐权限模型

## 1. Registry metadata 默认可见

Atlas 可以展示：

```
- source title
- source type
- owner
- authority scope
- freshness status
- visibility label
- support path
```

即使用户没有源系统权限，也可以知道：

> 有这么一个官方 source，但你可能没有权限，需要申请。

这对 onboarding 很有价值。

---

## 2. Source content preview 按权限降级

不同权限下展示不同内容。

| 用户权限情况 | Portal 展示 |
| --- | --- |
| 用户可访问 source | 展示 preview / excerpt + open link |
| 用户不可访问 source | 不展示正文，只展示 metadata + 申请权限 guidance |
| Atlas service account 不可访问 | 显示 resolver warning，提示 source health issue |
| source 权限未知 | 显示 restricted / unknown warning |

这样不会把受限内容泄露到 Portal，也不会因为权限问题让用户完全迷路。

---

## 3. Visibility 应该是 source metadata 的一部分

每个 source 应该有 visibility 分类：

```
Public Internal
Restricted Internal
Confidential
Team Only
Unknown
```

产品上不要暴露太技术化的权限细节。用户只需要知道：

```
You may need access to view this source.
Request access here.
Contact owner here.
```

---

## 4. V1 可以先不做 per-user authorization，但要预留语义

你现在是 demo / local / V1，不一定要做完整权限系统。但 source model 里必须预留：

```
visibility
access_note
access_request_path
restricted_preview_policy
```

这样未来接 SSO / group / source system ACL 时不会推翻产品模型。

---

# 三、如何新增一篇 Confluence 文章

这个流程需要产品化，而不是只说“加一条链接”。

## 推荐新增流程

```
1. Steward 发现或创建一篇 Confluence 文档
2. 判断它是否应该进入 Atlas
3. 提交 registry change
4. 声明 source 类型、owner、authority scope、freshness policy
5. Atlas 自动检查 locator 是否有效
6. Atlas 检查是否能读取标题、更新时间、preview
7. Reviewer 检查是否和已有 source 冲突
8. 合并后进入 Active
9. Portal 在相关 capability / scenario / navigator 中展示
```

---

## 新增 source 时必须回答的问题

不要让 steward 只填 URL。应该让他回答这些问题：

| 问题 | 目的 |
| --- | --- |
| 这篇文章解决什么问题？ | 绑定 scenario |
| 它属于哪个 capability？ | 绑定 capability |
| 它是 canonical、recommended、reference，还是 background？ | 确定权威级别 |
| 它适用于哪些环境？ | 确定 scope |
| 谁负责维护？ | 防止没人管 |
| 多久 review 一次？ | freshness policy |
| 如果用户没权限，怎么申请？ | onboarding |
| 它是否替代了旧 source？ | 避免冲突 |
| 它是否依赖其他 source？ | 建立关系 |

---

## Authority level 建议

source 不能都叫“官方”。建议分层：

| 级别 | 含义 |
| --- | --- |
| **Canonical** | 对某个 scope 是最终权威 |
| **Recommended** | 推荐阅读，通常可信，但不是最终裁决 |
| **Reference** | 背景资料、补充说明 |
| **Example** | 示例、案例、历史参考 |
| **Deprecated** | 不推荐使用，仅保留迁移说明 |

一个 scenario 下最好只有一个 canonical source。  
如果有多个 canonical source，Atlas 应该提示 **authority conflict**。

---

# 四、如何追踪 Confluence / Git 改动

这里不要试图一开始做“内容理解”。先做 **change detection**，再做人类 review。

## 推荐追踪策略

### 1. 追踪 source metadata

每次 resolver 读取 source 时记录：

```
- source exists or not
- last modified time
- author / modifier
- version number
- title
- url / locator
- anchors still valid or not
- preview can be generated or not
```

对于 Git：

```
- repo
- path
- branch / tag
- latest commit hash
- last commit date
```

对于 Confluence：

```
- page id
- version number
- last updated time
- last updated by
```

---

## 2. 有变化不代表自动变更 authority

这是重点。

Confluence 改了内容，Atlas 不应该自动认为它仍然正确。Atlas 应该变成：

```
Active → Needs Review
```

或者至少显示：

```
Content changed since last steward review.
```

这才是 governed source 的意义。

---

## 3. Freshness 和 Change 是两种不同 warning

不要混在一起。

| 类型 | 含义 |
| --- | --- |
| **Freshness warning** | 太久没有 review |
| **Change warning** | source 内容自上次 review 后发生了变化 |
| **Health warning** | source 不能访问、链接坏了、anchor 失效 |
| **Authority warning** | 权威关系冲突 |
| **Permission warning** | 用户或 Atlas 可能无权限 |

这样用户看到 warning 时知道问题是什么。

---

## 4. 不建议自动同步正文

可以自动抓 preview，但不要自动变成 Atlas 正文。

推荐：

```
source changed
→ Atlas detects change
→ mark needs review
→ notify steward
→ steward confirms still valid
→ update last_reviewed_at
```

而不是：

```
source changed
→ Atlas silently updates content
→ Portal shows new content as trusted
```

后者会削弱 governance。

---

# 五、如何自动化维护过程

自动化不要替代 steward，而是替 steward 减负。

## 自动化分 5 类

---

## 1. Health automation

回答：

> source 还活着吗？

自动检查：

```
- URL 是否可访问
- Git path 是否存在
- Confluence page 是否存在
- anchor 是否还存在
- title 是否变化
- source system 是否返回权限错误
```

输出 warning：

```
Broken locator
Permission denied
Anchor missing
Source moved
```

---

## 2. Freshness automation

回答：

> 这个 source 是否太久没人 review？

自动检查：

```
current date - last_reviewed_at > review_cycle
```

输出：

```
Needs review
Stale
```

这里 review cycle 可以按 source 类型不同：

| Source 类型 | 建议 review 周期 |
| --- | --- |
| Security / policy | 短 |
| Landing zone onboarding | 中 |
| Tool usage guide | 中 |
| Example / reference | 长 |
| Deprecated source | 固定迁移窗口 |

---

## 3. Change automation

回答：

> source 自上次 review 后有没有变？

自动检查：

```
- Git commit changed
- Confluence version changed
- page title changed
- modified by changed
```

输出：

```
Changed since last review
```

这对 Confluence 特别重要，因为很多页面会被随手改。

---

## 4. Relationship automation

回答：

> source 和 capability / scenario 的关系是否还合理？

这部分可以半自动。

比如系统发现：

```
Confluence page title changed from "AWS Textract Onboarding" to "Legacy Textract Guide"
```

可以提示 steward：

```
This source may need reclassification or deprecation.
```

但不要自动改 authority。

---

## 5. Feedback automation

回答：

> 用户反馈如何进入维护闭环？

反馈类型建议固定：

```
- wrong guidance
- stale source
- missing source
- broken link
- permission issue
- unclear ownership
- authority conflict
```

每种反馈自动路由：

| Feedback | 路由 |
| --- | --- |
| broken link | source owner + platform registry owner |
| stale source | capability steward |
| permission issue | source owner / access owner |
| wrong guidance | capability steward |
| missing source | Cloud Platform team |
| authority conflict | Cloud Platform team + affected stewards |

Atlas 不一定要自己做 ticket system，但要能生成明确的 action。

---

# 六、Navigator 与 Source 的关系

你把 landing zone navigator 改成通用 navigator 是对的。

Navigator 不应该只是 landing zone browser，而应该是：

> **scenario-based guidance surface**

也就是围绕用户任务组织信息。

---

## 推荐 Navigator 分类

```
- How to onboard to Cloud Platform
- How to choose a landing zone
- How to request access
- How to deploy through Harness
- How to use Terraform Enterprise modules
- How to onboard a new application
- How to meet security baseline
- How to troubleshoot common issues
```

Navigator 的本质是：

```
Scenario → Guidance → Sources → Tools → Support Path
```

例如：

## Scenario: 如何申请权限

展示：

```
Goal
- 申请访问某个 landing zone / AWS account / TFE workspace

Before you start
- 需要 app id
- 需要 manager approval
- 需要 environment type

Steps
- open access request tool
- select correct group
- wait for approval

Authoritative sources
- IAM access policy
- onboarding guide
- support FAQ

Tools
- ServiceNow request form
- Entra group management
- TFE workspace

Support
- Cloud Platform support channel
```

这个页面不是纯文档，而是一个 **guided entry point**。

---

# 七、Source object 应该支持哪些关系

为了长期维护，source 不能只挂在 capability 下。它要能被多个产品对象引用。

建议关系模型：

```
Source
  belongs to zero or more capabilities
  supports zero or more scenarios
  references zero or more tools
  applies to zero or more environments
  owned by one steward
  may replace another source
  may be replaced by another source
  may conflict with another source
```

产品上不用展示成复杂图，但底层语义要有。

这样你可以回答：

```
哪些 source 支撑 “如何选择 landing zone”？
哪些 source 是 Textract onboarding 的 canonical source？
哪些 source 已经过期但仍被 navigator 引用？
哪些 source 没有 owner？
哪些 source 有权限问题？
```

这就是 Atlas 从 link site 变成 governed knowledge system 的关键。

---

# 八、权限与正文展示的具体建议

你说“展示正文可能对产品最好，但会变成第二个 truth source”，这个判断很准。

我建议用三档展示策略：

## Level 1：Metadata only

适合：

```
- restricted source
- policy source
- source owner 不允许 inline preview
```

展示：

```
title
owner
authority
freshness
open source link
access request
```

---

## Level 2：Preview / excerpt

适合 V1 默认。

展示：

```
short excerpt
key section title
last modified
last reviewed
citation / locator
open canonical source
```

Portal 明确标注：

```
Preview from canonical source. Open source for full content.
```

---

## Level 3：Managed content

这是未来 CMS 模式。

只有当 Atlas 成为 first and only truth source 时才启用。

展示：

```
full content
version
editor
reviewer
approval status
publish history
```

V1 不走 Level 3。

---

# 九、Source 新增的产品体验

即使没有 admin UI，也可以定义“新增 source playbook”。

## 新增 source 的决策树

```
1. Is this source authoritative, recommended, or just helpful?
2. Does it have an owner?
3. Does it map to a capability or scenario?
4. Is it stable enough to be registered?
5. Is it accessible to intended users?
6. Does it duplicate or conflict with existing source?
7. Does it need freshness review?
```

如果答案不清楚，不要让它进入 Active。可以进入 Proposed。

---

## 新 source 的最低准入标准

| 字段 | 必须吗 |
| --- | --- |
| Title | 必须 |
| Source system | 必须 |
| Locator | 必须 |
| Owner / steward | 必须 |
| Authority level | 必须 |
| Authority scope | 必须 |
| Related capability or scenario | 必须 |
| Freshness policy | 必须 |
| Access note | 建议 |
| Replacement relationship | 如适用 |
| Warning policy | 建议 |

这能防止 Atlas 被塞满“感觉有用的链接”。

---

# 十、长期维护的组织机制

Source 维护不能只靠工具。必须有 operating model。

## 推荐机制

## 1. Capability review

每个 capability 有 steward。

定期 review：

```
- capability summary 是否还对
- authoritative sources 是否还对
- support path 是否还对
- tools 是否还对
- related scenarios 是否还对
```

---

## 2. Source review

每个 source 有 owner。

review 时只回答几个问题：

```
- 这个 source 是否仍然有效？
- 是否仍然适用于当前 authority scope？
- 是否有替代 source？
- 是否需要更新 preview / warning？
- 是否需要降级为 deprecated？
```

---

## 3. Scenario review

Navigator 里的每个 scenario 也要有 owner。

例如：

```
How to onboard to Cloud Platform
How to request access
How to choose landing zone
```

这些 scenario 往往跨 capability，所以不能只靠单个 capability steward。

---

# 十一、产品形态上怎么表达 source trust

用户不应该看到一堆复杂字段。应该看到几个简单 badge。

## 推荐 badge

```
Canonical
Recommended
Needs Review
Stale
Restricted
Broken Link
Changed Since Review
Deprecated
```

## Source card 示例，纯产品概念

```
AWS Textract Terraform Module README

Canonical · Cloud Platform owned · Reviewed 2026-04-20
Applies to: AWS Federated / Textract onboarding

Preview available
Open in Git

Warning:
Changed since last review
```

或者：

```
Landing Zone Access Request Guide

Recommended · IAM Steward owned · Reviewed 2026-03-15
Applies to: Access request / onboarding

Restricted source
You may need permission to view this document.
Request access
```

---

# 十二、我建议的方向拆分

你说不要 week 1/2/3，那我建议用 **方向** 来组织。

## 方向一：Registry Governance

目标：

> 定义什么 source 可以进入 Atlas，以及谁负责它。

包含：

```
- source lifecycle
- owner / steward model
- authority level
- authority scope
- freshness policy
- GitOps maintenance
- review process
```

这是防止 Atlas 变成链接站的根。

---

## 方向二：Source Connectivity

目标：

> Atlas 能理解不同 source system 的基本状态。

包含：

```
- Git source resolver
- Confluence source resolver
- policy repo resolver
- TFE metadata resolver
- Harness metadata resolver
- health check
- change detection
- preview generation
```

重点不是“全量同步”，而是：

```
exists?
changed?
accessible?
previewable?
fresh?
```

---

## 方向三：Permission-aware Experience

目标：

> 用户即使没有权限，也知道 source 存在、为什么需要、怎么申请。

包含：

```
- visibility labels
- restricted preview policy
- access request guidance
- permission warning
- no content leakage
```

---

## 方向四：Scenario Navigator

目标：

> 用用户任务组织 source，而不是用系统分类组织 source。

包含：

```
- onboard
- request access
- choose landing zone
- configure capability
- troubleshoot
- deploy
- meet security baseline
```

Navigator 连接：

```
scenario → guidance → source → tool → support path
```

---

## 方向五：Maintenance Automation

目标：

> 自动发现问题，人类做权威判断。

包含：

```
- broken locator detection
- stale source detection
- changed since review
- owner missing
- authority conflict
- feedback routing
- review reminders
```

自动化的边界是：

```
Automation detects.
Steward decides.
Atlas displays trust state.
```

---

# 最终建议

你的 Source Management 应该用一句话定义：

> **Atlas manages source trust, not source content.**

也就是：

```
不管理正文
管理来源
管理权威
管理范围
管理 owner
管理 freshness
管理 warning
管理关系
管理用户下一步去哪里
```

这样它长期能站住。

如果未来某一天组织决定 Atlas 变成 CMS，那是另一个阶段：

> **Atlas manages content, workflow, approval, versioning, and publishing.**

但那不是 V1，也不是现在这个问题的最佳解。

当前最稳的产品路线是：

```
GitOps registry
+ Cloud Platform Team / Capability Steward shared ownership
+ source lifecycle
+ authority / freshness / warning
+ permission-aware source preview
+ scenario-based navigator
+ automated health/change/freshness checks
+ Portal as first consumer
+ Context API as future AI-ready foundation
```

这套既能解释长期维护，也能解释为什么 Atlas 不是 link aggregator。

* * *

**You:**

不要给我列什么能成为source，我需要的是如何管理这些source，现在你可以只拿confluence来举例，围绕它设计完整的生命周期，注意是落到实处的细节设计而不是高大上泛泛而谈，比如你提到steward创建文章，但第二步的对象是谁？这可能不是同一个人同一个team，谁来提交？ 新增source回答的问题太多太泛应该使用AI总结。这是企业产品，不是单个人就可以走完完整生命周期，也无法让很多人参与这么小的一个东西，source 作者只维护source内容本身而不是给他们增加负担。自动化没问题。 暂不继续讨论navigator了。 深度思考，围绕source management完整生命周期以及涉及到的角色清楚表明，尽可能自动化是原则。方向一到五都挺合理，整合。

* * *

**ChatGPT:**

# Source Management：以 Confluence 为例的完整生命周期设计

核心原则先定死：

> **Source 作者只维护 Confluence 内容本身，不额外维护 Atlas。  
> Atlas 尽量自动发现、自动总结、自动分类、自动监测。  
> 真正需要人工判断的地方，只交给 Cloud Platform team / Capability Steward 做轻量确认。**

所以不要设计成：

```
作者写完 Confluence → 作者理解 Atlas schema → 作者提交 registry → 作者声明 authority → 作者定 freshness → 作者维护 relationship
```

这个在企业里跑不动。

应该设计成：

```
作者写 Confluence
→ Atlas 自动发现候选 source
→ AI 自动抽取摘要、owner、适用范围、可能 capability、freshness、权限状态
→ Source Curator 轻量确认
→ Capability Steward 只确认“是否权威 / 是否适用”
→ Cloud Platform team 管 registry lifecycle
→ 后续改动由 Atlas 自动监测和提醒
```

这里最重要的是把角色拆清楚。

---

# 1. 角色设计

## 1.1 Source Author

**是谁：**  
Confluence 页面作者、页面维护人、某个团队里的工程师、架构师、support 人员。

**职责：**

```
只维护 Confluence 页面内容。
```

**不要求他做：**

```
不要求理解 Atlas registry
不要求提交 Atlas source
不要求声明 authority scope
不要求维护 freshness metadata
不要求处理 Atlas relationship
```

这是关键。否则 Atlas 会变成额外负担。

---

## 1.2 Source Curator

**是谁：**  
Cloud Platform team 内部的人，或者 Atlas owner team 内部的人。

这个角色是 Source Management 的实际操作者。

**职责：**

```
- 审核 Atlas 自动发现的候选 source
- 判断是否纳入 registry
- 确认 AI 抽取的 metadata 是否合理
- 发起 capability steward confirmation
- 维护 source lifecycle status
- 处理 broken / stale / changed warning
```

**注意：**  
Source Curator 不一定懂每个 capability 的细节，但他懂 Atlas 的治理模型。

---

## 1.3 Capability Steward

**是谁：**  
每个 capability 的业务/技术负责人，例如 Textract capability steward、API Gateway steward、Landing Zone steward。

**职责：**

```
只确认 source 对某个 capability / scope 是否权威、推荐、过期或无关。
```

**不要求他做：**

```
不要求提交 source
不要求写 registry
不要求长期盯 Confluence 改动
不要求维护所有 metadata
```

他只做少量判断：

```
Approve as canonical
Approve as recommended
Reject
Mark as deprecated
Needs discussion
```

---

## 1.4 Cloud Platform Team / Atlas Owner

**是谁：**  
Atlas 产品和平台治理的 owner。

**职责：**

```
- 定义 source lifecycle
- 定义 registry schema
- 维护 resolver / automation
- 维护 source health check
- 维护 review workflow
- 维护 Portal 展示规则
- 仲裁 authority conflict
```

Cloud Platform team 是系统 owner，不是每篇 source 的内容 owner。

---

## 1.5 Source System Owner

**是谁：**  
Confluence admin / workspace owner / enterprise tooling team。

**职责：**

```
- 提供 Confluence API access
- 管理 service account 权限
- 提供 page metadata / version / permission signal
```

他们不参与内容判断。

---

# 2. Source 生命周期总览

以 Confluence source 为例，完整生命周期建议是：

```
Discovered
→ Candidate
→ Proposed
→ Active
→ Changed
→ Needs Review
→ Stale
→ Deprecated
→ Retired
```

但产品上不一定都展示给终端用户。内部管理需要这些状态。

---

## 2.1 Discovered

**含义：**  
Atlas 自动发现了一篇可能有价值的 Confluence 页面。

**来源可以是：**

```
- Confluence space 扫描
- 指定 label 扫描
- 指定 parent page 下的子页面扫描
- 用户在 Portal 反馈“这里应该加一篇文档”
- Cloud Platform team 手动丢一个 URL
- Capability steward 提供一个 URL
- 从已有 source 的链接中发现
```

**关键点：**  
进入 Discovered 不需要任何人填表。

---

## 2.2 Candidate

**含义：**  
Atlas 判断这篇页面可能值得进入 registry。

Atlas 自动做：

```
- 读取标题
- 读取页面 owner / last updated by
- 读取更新时间
- 读取页面 label
- 读取 parent page / space
- 读取可访问性
- 生成摘要
- 抽取可能 capability
- 抽取可能 scenario
- 抽取关键操作步骤
- 抽取工具链接
- 判断是否像 onboarding / how-to / policy / reference
- 判断是否重复已有 source
- 判断是否疑似过期
```

这一步主要由 AI 完成，但 AI 只产出 **建议**，不产出最终权威判断。

---

## 2.3 Proposed

**含义：**  
Source Curator 认为它值得进入 Atlas，发起轻量确认。

这里的对象不是 Source Author，而是 **Capability Steward**。

原因：

* Source Author 只负责内容。
* Source Author 未必知道这篇文章是否应该成为官方入口。
* Capability Steward 才能判断它对某个 capability 是否 authoritative。

**Proposed 阶段需要确认的问题应该极少。**

不要让人回答一堆字段。AI 先填好，人工只确认。

建议 UI / workflow 里只问 steward 四个问题：

```
1. 这篇文档是否应该出现在 Atlas？
2. 它对这个 capability / scope 的权威级别是什么？
3. 它现在是否可以被用户使用？
4. 如果不可以，原因是什么？
```

对应选项：

```
Approve as canonical
Approve as recommended
Approve as reference
Reject as not relevant
Mark as outdated
Need another owner
```

这就够了。

---

## 2.4 Active

**含义：**  
Source 正式进入 Atlas registry，可以在 Portal 被引用。

Active source 必须有：

```
- source id
- title
- canonical Confluence URL / page id
- source system
- owner signal
- Atlas curator
- capability steward
- authority level
- authority scope
- freshness policy
- last reviewed time
- current source version
- visibility status
- health status
```

但这些字段不应该全靠人填。大部分应该自动生成。

人工真正确认的只有：

```
authority level
authority scope
whether active
responsible steward
```

---

## 2.5 Changed

**含义：**  
Confluence 页面在 last reviewed 之后发生了变化。

Atlas 自动检测：

```
- page version 变化
- title 变化
- parent page 变化
- label 变化
- last updated by 变化
- body 内容 hash 变化
- 关键 section 变化
```

Changed 不一定代表有问题。它只是说明：

> 这篇 source 的内容已经和上次 steward 确认时不一样了。

产品上可以这样展示：

```
Changed since last review
```

---

## 2.6 Needs Review

**含义：**  
变化或风险足够重要，需要 steward 重新确认。

不是所有 changed 都需要 review。

例如：

| 变化 | 是否 Needs Review |
| --- | --- |
| typo 修正 | 否 |
| 标题改了 | 可能 |
| owner section 改了 | 是 |
| step-by-step 操作改了 | 是 |
| policy wording 改了 | 是 |
| landing zone 适用范围改了 | 是 |
| 页面被移动 | 可能 |
| 页面大幅删除 | 是 |
| 页面访问权限变化 | 是 |
| 页面超过 review cycle | 是 |

AI 可以帮忙判断 change severity。

---

## 2.7 Stale

**含义：**  
超过 freshness policy 仍未 review。

Stale 不是 source 失效，而是：

> Atlas 不再保证它仍然是最新可信状态。

Portal 上应该明显展示，但不一定隐藏。

例如：

```
This source has not been reviewed for 180 days.
Use with caution.
```

---

## 2.8 Deprecated

**含义：**  
Source 不再推荐使用，但还保留给用户理解历史迁移。

触发原因：

```
- 被新文档替代
- 对应 capability 改版
- 只适用于旧 landing zone
- 旧流程下线
- 权威 source 迁移到别处
```

Deprecated 必须有 replacement 或说明。

---

## 2.9 Retired

**含义：**  
不再对普通用户展示，只保留审计记录。

触发原因：

```
- Confluence 页面删除
- 内容完全失效
- owner 明确要求下线
- capability 下线
- source 长期 stale 且无人认领
```

---

# 3. 新增 Confluence Source 的具体流程

这里用一个真实场景来落地：

> 某团队写了一篇 Confluence：  
> “How to onboard an application to AWS Federated Landing Zone”

---

## 3.1 页面产生

**Source Author 做什么：**

```
正常写 Confluence。
```

他不需要知道 Atlas。

但可以鼓励作者用已有 Confluence 习惯，例如：

```
- 放在 Cloud Platform space 下
- 加 cloud-platform / onboarding / landing-zone label
- 页面有 owner section
- 页面有 last reviewed section
```

这些是鼓励，不是强制。

---

## 3.2 Atlas 自动发现

发现方式可以有几种。

最实用的是三种组合：

### A. Space / label scan

Atlas 定期扫描指定 Confluence space：

```
Cloud Platform
Cloud Security
Developer Experience
Infrastructure
```

重点扫描带有相关 label 的页面：

```
cloud-platform
landing-zone
onboarding
terraform
access-request
```

### B. Seed URL intake

Cloud Platform team 或 steward 可以把 URL 丢给 Atlas。

不是写 registry，只是说：

```
请评估这篇页面是否值得纳入 Atlas。
```

### C. User feedback intake

Portal 里用户反馈：

```
I found this useful Confluence page. Should it be added to Atlas?
```

这也进入 discovered queue。

---

## 3.3 AI 自动生成 Candidate Profile

Atlas 对页面生成一个 **Candidate Profile**。

内容大概是：

```
Page title:
How to onboard an application to AWS Federated Landing Zone

Detected type:
How-to / onboarding guide

Likely capability:
AWS Federated Landing Zone

Likely scenario:
Application onboarding
Landing zone selection
Access request

Likely audience:
Application teams

Detected owner:
Cloud Platform Enablement Team

Detected support path:
#cloud-platform-support

Detected tools:
Terraform Enterprise
Harness
ServiceNow

Detected authority:
Likely recommended, possibly canonical

Detected freshness:
Last updated 2026-05-02
No explicit reviewed date found

Detected risk:
No clear steward section
Contains links to two older landing zone pages
```

这个是给 Source Curator 看，不是给终端用户看。

---

## 3.4 Source Curator 初筛

Source Curator 看 AI 生成的 Candidate Profile，只做三件事：

```
1. 这是不是垃圾 / 重复 / 明显无关？
2. 它应该关联哪个 capability steward？
3. 是否值得发起 steward confirmation？
```

如果不值得，状态变成：

```
Rejected Candidate
```

如果值得，进入 Proposed。

---

## 3.5 发给 Capability Steward 轻量确认

这里不要让 steward 填复杂表。

给他一个很短的确认卡：

```
Atlas found a Confluence page that may be relevant to AWS Federated Landing Zone.

Page:
How to onboard an application to AWS Federated Landing Zone

AI summary:
This page explains the onboarding process for application teams, including prerequisites, access request, TFE workspace setup, and support channel.

Detected scope:
AWS Federated Landing Zone / Application onboarding

Suggested authority:
Recommended or Canonical

Please confirm:
[Canonical] [Recommended] [Reference] [Reject] [Needs another owner]
```

如果 steward 点 **Canonical**，再问一个二级问题：

```
Is this the final authoritative source for this scope?
[Yes] [No, recommended only] [There is another canonical source]
```

这样避免一上来让他填一堆字段。

---

## 3.6 Active 入库

确认后，Atlas 自动生成正式 source record。

其中：

| 字段 | 来源 |
| --- | --- |
| title | Confluence API |
| page id | Confluence API |
| URL | Confluence API |
| source type | 自动 |
| source summary | AI |
| owner candidate | AI + page metadata |
| capability | AI + curator 确认 |
| authority | steward 确认 |
| authority scope | AI 建议 + steward 确认 |
| freshness policy | 按 source type 默认 |
| last reviewed | steward approve 时间 |
| reviewed version | 当前 Confluence version |
| visibility | Confluence permission signal |
| warnings | 自动 |

人工不是填完整信息，而是在关键点确认 AI 的建议。

---

# 4. Confluence 改动追踪机制

Source active 之后，维护的核心是：

> **页面变了，Atlas 怎么知道？知道后怎么判断是否需要人管？**

---

## 4.1 Atlas 定期读取 Confluence metadata

对每个 active Confluence source，Atlas 记录上次确认时的状态：

```
reviewed version
reviewed updated time
reviewed title
reviewed content fingerprint
reviewed important section fingerprints
reviewed labels
reviewed parent page
reviewed permission visibility
```

之后每次检查时比较：

```
current version vs reviewed version
current title vs reviewed title
current content fingerprint vs reviewed fingerprint
current permission vs reviewed permission
```

---

## 4.2 变化分级

不要所有变化都打扰 steward。

变化应该分成四级：

| 等级 | 含义 | 动作 |
| --- | --- | --- |
| **Minor** | 小改动，不影响 guidance | 记录，不提醒 |
| **Moderate** | 可能影响摘要或步骤 | 标记 Changed，进入 curator queue |
| **Major** | 可能影响权威内容 | 通知 steward 确认 |
| **Critical** | 访问失败、页面删除、权限变化、canonical 冲突 | 立即 warning |

---

## 4.3 AI 做 change summary

当 Confluence 页面变化时，Atlas 不应该只告诉人：

```
Page version changed from 12 to 13.
```

这没有用。

应该生成：

```
Change summary:
- Added a new prerequisite about ServiceNow approval.
- Removed the old AWS account request step.
- Updated TFE workspace naming convention.
- No change detected in support path.
- No change detected in landing zone selection rule.

Suggested impact:
Moderate

Suggested action:
Curator review. Steward confirmation may be needed if this source is canonical.
```

这样 Source Curator 才能快速判断要不要打扰 steward。

---

## 4.4 什么情况下通知 Capability Steward

只有以下情况通知 steward：

```
- canonical source 发生 major change
- source authority scope 相关内容变化
- source 中的操作步骤变化
- source 中的 policy / constraint 变化
- source 中的 owner / support path 变化
- source 超过 review cycle
- 用户反馈 wrong / stale / conflicting
- AI 检测到与其他 source 冲突
```

其他 minor / moderate change 可以先进入 Source Curator queue。

---

# 5. 权限问题的完整处理

Confluence 权限特别麻烦，所以要从产品上承认它。

---

## 5.1 三种权限主体

有三个主体：

```
1. Atlas service account
2. 当前 Portal 用户
3. Source Author / Owner
```

这三者权限不一定一致。

---

## 5.2 四种权限状态

| 状态 | 含义 | Portal 怎么展示 |
| --- | --- | --- |
| **Readable** | Atlas 可读，用户大概率可读 | 展示 preview + open link |
| **Restricted** | Atlas 可读，但用户可能没权限 | 展示 metadata + limited preview 或不展示正文 |
| **Service Blocked** | Atlas service account 读不了 | 展示 source registered，但 preview unavailable |
| **Unknown** | 无法判断权限 | 展示 caution |

---

## 5.3 不能把 Atlas 变成权限绕过器

如果用户没权限看 Confluence，Atlas 不应该通过 preview 泄露完整内容。

所以 preview 策略要按 visibility 控制：

| Source 权限 | Preview 策略 |
| --- | --- |
| broadly internal | 可以展示短 preview |
| restricted | 不展示正文，只展示摘要或 metadata |
| confidential | 只展示标题、owner、申请方式 |
| unknown | 默认保守展示 |

摘要也要小心。对于 restricted source，AI 摘要也可能泄露内容。  
所以 restricted source 最稳的是：

```
title
owner
purpose
access request path
open source link
```

不要展示正文摘要。

---

## 5.4 Access request 应该是 source metadata 的一部分

每个 source 最好自动或半自动带上：

```
How to request access
Who owns access
Expected approval path
Fallback support contact
```

这对 onboarding 很重要。

当用户打不开 Confluence 时，Atlas 不应该只是让用户撞 403，而是告诉他：

```
This source is restricted.
Request access via [Access Request Tool].
If unsure, contact [Cloud Platform Support].
```

---

# 6. Freshness 设计

Freshness 不是 “last updated”。

这是很多系统会做错的地方。

```
last updated ≠ last reviewed
```

Confluence 最近被编辑，不代表内容被正式确认过。  
有时只是改了错别字。

所以 Atlas 必须维护两个时间：

```
Last updated in source system
Last reviewed by steward / Atlas workflow
```

---

## 6.1 Freshness policy 从默认规则来，不让人填

不要让每篇 source 手动定 review cycle。

按 source 类型和 authority level 自动给默认值：

| Source 类型 | Authority | Review 频率 |
| --- | --- | --- |
| onboarding guide | canonical | 较短 |
| access request guide | canonical | 较短 |
| policy / security guidance | canonical | 很短 |
| how-to guide | recommended | 中等 |
| reference | reference | 较长 |
| deprecated | deprecated | 只看 retirement date |

人工可以 override，但不是必填。

---

## 6.2 Stale 的产品含义

超过 review cycle 后：

```
Active → Stale
```

但不要自动下线。Portal 显示 warning：

```
This source is past its review date.
It may still be useful, but should be verified.
```

如果是 canonical source stale，warning 更强：

```
Canonical source is stale.
Use caution and contact the owner if guidance is business-critical.
```

---

# 7. Authority Conflict 设计

这是 Source Management 里最有价值的部分之一。

---

## 7.1 冲突怎么产生

例如两个 Confluence 页面都被标为：

```
Canonical for AWS Federated Landing Zone onboarding
```

或者：

```
一个页面说申请权限走 ServiceNow
另一个页面说申请权限走 email
```

Atlas 应该识别为 authority conflict。

---

## 7.2 冲突来源

冲突可以来自：

```
- registry 里两个 source 的 authority scope 重叠
- AI 检测到两个 active source 指向不同流程
- 用户反馈 conflicting guidance
- source title / content 改动后变成旧流程
```

---

## 7.3 冲突处理

不要让普通 source author 处理。  
冲突应该进 Cloud Platform / Capability Steward 的治理队列。

处理选项：

```
- Keep A canonical, downgrade B to reference
- Keep B canonical, deprecate A
- Split scope: A applies to legacy, B applies to new platform
- Mark both needs review
- Escalate to governance owner
```

这是 Atlas 真正超越 link site 的地方。

---

# 8. 自动化维护队列

不要让维护靠邮件散落。Atlas 应该有一个内部 **Source Maintenance Queue**。

注意，这不是 admin UI 的大型后台，可以很轻。

队列里的 item 来自自动化：

```
- new candidate discovered
- page changed
- page stale
- page broken
- permission changed
- authority conflict
- owner missing
- user feedback
```

每个 item 都应该有：

```
issue type
source
suggested owner
AI summary
suggested action
severity
due date
```

---

## 8.1 队列分工

| 队列类型 | 默认处理人 |
| --- | --- |
| Candidate source | Source Curator |
| Broken source | Source Curator |
| Permission issue | Source Curator + source system owner |
| Canonical source changed | Capability Steward |
| Authority conflict | Cloud Platform team + steward |
| Stale source | Capability Steward |
| Missing owner | Cloud Platform team |
| User says wrong guidance | Capability Steward |

---

## 8.2 人工动作必须少

每个 queue item 的人工动作最多 4–5 个按钮：

```
Confirm still valid
Send to steward
Downgrade authority
Mark deprecated
Retire source
Ignore minor change
```

不要让人编辑 20 个字段。

---

# 9. Source Author 如何被最小化打扰

Source Author 只在两种情况下被打扰：

## 9.1 找不到 owner

如果 Atlas 发现页面 owner 不清楚，或者页面属于个人空间，可以问作者：

```
Who should own this page long-term?
```

不是问他 Atlas metadata。

## 9.2 内容疑似错误，但 steward 需要作者确认

例如 steward 说：

```
This page is outdated. Please update or confirm retirement.
```

但这个动作最好由 steward / curator 发起，不是 Atlas 自动骚扰作者。

---

# 10. Source 新增应该如何自动化到“不填表”

你说“新增 source 回答的问题太多太泛应该使用 AI 总结”，对。

正确流程应该是：

```
URL / discovery
→ AI prefill
→ curator verify
→ steward approve
```

而不是：

```
human fills source form
```

---

## AI prefill 应该生成什么

AI 生成：

```
- short summary
- detected purpose
- detected capability
- detected scenario
- detected audience
- detected owner
- detected support path
- detected tools
- detected authority candidate
- detected freshness risk
- duplicate source candidates
- suggested visibility
- suggested warning
```

人只确认：

```
- include or not
- authority level
- steward
- scope
```

---

# 11. Confluence 页面删除 / 移动 / 改名

这些都要有明确策略。

## 页面改名

自动更新显示 title，但保留历史 title。  
如果 title 变化很大，进入 Changed queue。

## 页面移动

如果 page id 不变，locator 仍有效。记录 move event。  
如果 move 到 restricted space，触发 permission warning。

## 页面删除

状态：

```
Active → Broken → Retired candidate
```

先不要马上 Retired，因为可能是误删或权限问题。

动作：

```
notify curator
check replacement
ask steward
```

## 页面权限变更

如果以前可读，现在不可读：

```
Readable → Restricted / Service Blocked
```

Portal 显示：

```
Preview unavailable due to source permission change.
```

---

# 12. Portal 终端用户看到什么

终端用户不需要看到 lifecycle 复杂度。

他们只看 source trust signals：

```
Canonical
Recommended
Reviewed
Changed since review
Stale
Restricted
Broken
Deprecated
```

例如：

```
AWS Federated Landing Zone Onboarding

Canonical
Reviewed by Landing Zone Steward on 2026-04-18
Updated in Confluence on 2026-05-06
Changed since review

Open in Confluence
Report issue
```

这里 “Updated in Confluence” 和 “Reviewed by Steward” 分开展示，非常重要。

---

# 13. 后台产品对象：Source Record

不用代码，只讲产品字段。

一个 Confluence Source Record 应该包含：

## Identity

```
source id
source system
Confluence page id
canonical URL
title
space
parent page
```

## Ownership

```
source author signal
source owner signal
capability steward
Atlas curator
support path
```

## Trust

```
authority level
authority scope
review status
last reviewed by
last reviewed at
reviewed source version
freshness policy
```

## Health

```
current source version
last updated at
last updated by
last checked at
access status
locator status
preview status
```

## Relationship

```
related capabilities
related scenarios
replaces
replaced by
conflicts with
depends on
```

## User experience

```
summary
preview policy
access request path
warnings
display status
```

这些字段大部分自动生成或系统维护，不是让人手填。

---

# 14. 整合后的五个方向

你前面说方向一到五合理，这里整合成一个完整 Source Management 产品方案。

---

## 方向一：Source Intake & Discovery

目标：

> 让 source 进入 Atlas 的过程尽量不依赖人工填表。

设计：

```
- Confluence space / label scan
- URL intake
- user feedback intake
- existing source link discovery
- AI candidate profile generation
- duplicate detection
```

人工角色：

```
Source Curator 初筛
Capability Steward 轻量确认
```

---

## 方向二：Source Governance

目标：

> 明确 source 是否可信、谁负责、对什么范围权威。

设计：

```
- source lifecycle
- authority level
- authority scope
- owner / steward
- review status
- deprecated / retired policy
- conflict handling
```

人工角色：

```
Cloud Platform team owns model
Capability Steward owns authority decision
Source Curator operates process
```

---

## 方向三：Source Monitoring

目标：

> 自动知道 source 是否变了、坏了、过期了、受限了。

设计：

```
- Confluence metadata tracking
- version tracking
- content fingerprint
- section-level change detection
- permission status check
- freshness check
- broken link check
```

自动化输出：

```
Changed
Needs Review
Stale
Broken
Restricted
Conflict
```

---

## 方向四：Permission-aware Source Experience

目标：

> 不泄露受限内容，同时让用户知道下一步怎么办。

设计：

```
- visibility classification
- preview policy
- access request guidance
- restricted source display
- no permission bypass
```

用户体验：

```
能看就 preview
不能看就显示 metadata + access request
Atlas 读不了就显示 source health warning
```

---

## 方向五：Maintenance Workflow

目标：

> 把自动发现的问题变成可处理的轻量队列，而不是邮件和口头沟通。

设计：

```
- source maintenance queue
- AI change summary
- suggested actions
- severity
- owner routing
- feedback routing
- minimal approval actions
```

人工动作：

```
Confirm valid
Send to steward
Mark stale
Deprecate
Retire
Change authority
```

---

# 15. 最终推荐的生命周期闭环

完整闭环如下：

```
1. Source Author 正常写 Confluence，不维护 Atlas。

2. Atlas 通过 space / label / URL / feedback 自动发现页面。

3. AI 生成 Candidate Profile：
   摘要、用途、owner、capability、scenario、权限、重复项、风险。

4. Source Curator 初筛：
   无关则拒绝；
   有价值则进入 Proposed。

5. Capability Steward 轻量确认：
   canonical / recommended / reference / reject。

6. Atlas 生成 Active Source Record：
   metadata 自动填充，authority 和 scope 来自确认。

7. Portal 展示 source：
   显示权威级别、review 状态、权限状态、preview 或 access guidance。

8. Atlas 持续监测：
   Confluence version、更新时间、权限、标题、内容变化、链接健康。

9. AI 生成 change summary：
   判断 minor / moderate / major / critical。

10. Maintenance Queue 路由：
   curator 处理普通变化；
   steward 处理 canonical / authority / stale / conflict。

11. Steward 确认后：
   更新 reviewed version 和 reviewed time；
   或降级、废弃、退休 source。

12. 用户反馈进入同一个 queue：
   stale、wrong、permission、missing、conflict 分别路由。
```

---

# 关键判断

这个设计里，Atlas 管理的是：

```
source trust lifecycle
```

不是：

```
source content authoring lifecycle
```

所以 Source Author 不会被拖进 Atlas 流程。  
Capability Steward 也不会被要求维护复杂字段。  
Cloud Platform team / Source Curator 负责流程。  
AI 和 automation 负责发现、总结、比对、提醒。  
人工只在“是否权威、是否仍有效、是否下线”这些关键判断点介入。

这才适合企业内部长期运行。

* * *

**You:**

当前流程和角色分布描述是合理的但是每一项都缺失关键信息，如2.2在哪提出？ 2.3在哪确认？ 2.4确认进入后发生了什么，如何展示到页面上？ 2.6怎么识别到changed？ 怎么判断不同情况？ 什么叫把url 丢给atlas？ 注意这些都需要工程实现，你需要结合实际。3.3在哪执行？在哪看？ 3.5 在哪看在哪点？5.4atlas怎么知道用户打不开没权限？ 

* * *

**ChatGPT:**

你问得对。上一版是“产品机制”，但没有把它落到**实际系统在哪里发生、谁在什么界面点什么、后台如何感知变化、Portal 如何消费**。下面我把 Confluence source management 重新拆成一条完整可实现的产品/工程闭环。

先声明边界：这里只讨论 **Source Management**，不继续展开 Navigator / Ask Atlas。

---

# 0. 先定义 Atlas 里必须有的几个产品表面

否则后面所有“提出、确认、变更、展示”都会悬空。

Atlas 至少需要 4 个内部/外部表面：

## 1. Portal 用户表面

给普通 application team / platform consumer 用。

看到：

```
Capability / Scenario 页面
Source cards
Source detail
Open in Confluence
Report issue
Request access guidance
```

他们不维护 source，只消费 source。

---

## 2. Source Intake 表面

给 Source Curator / Cloud Platform team 用。

作用：

```
接收一个 Confluence URL
查看自动发现的 candidate source
触发 AI profiling
决定是否送交 steward 确认
```

这可以是一个很轻的内部页面，也可以先是 Cloud Platform team 自用的 ops 页面。

“把 URL 丢给 Atlas”具体就是这里：

```
Atlas Portal / Source Intake / Add Confluence Source
→ paste Confluence URL
→ Atlas fetches metadata
→ AI generates Candidate Profile
→ Curator reviews
```

不是让用户写 registry，也不是让 Confluence 作者提交表单。

---

## 3. Steward Review 表面

给 Capability Steward 用。

作用：

```
确认 source 是否应该进入 Atlas
确认 authority level
确认 authority scope
确认是否仍有效
确认是否 deprecated / retired
```

这可以是：

```
Atlas 内部 review 页面
或邮件 / Teams / Slack 通知里的 deep link
```

但最终动作应该回到 Atlas review 页面，因为需要记录谁确认、何时确认、确认了哪个版本。

---

## 4. Source Maintenance Queue 表面

给 Source Curator / Cloud Platform team 用。

作用：

```
处理 changed / stale / broken / permission / conflict / feedback
查看 AI change summary
决定是否通知 steward
决定是否自动更新展示状态
```

这是长期维护的核心。

---

# 1. Source 生命周期：每一步“在哪里发生”

下面按你提到的 2.2 / 2.3 / 2.4 / 2.6 这类问题展开。

---

# 2.2 Candidate：在哪里提出？

**Candidate 不是某个人手动“提出”的，而是 Atlas 自动生成的。**

它的来源有三类。

---

## A. Curator 手动 URL intake

发生位置：

```
Atlas Source Intake 页面
```

操作人：

```
Source Curator
Cloud Platform team member
Capability Steward 也可以，但不是必须
```

流程：

```
1. Curator 打开 Atlas Source Intake
2. 粘贴 Confluence URL
3. Atlas 解析 URL，拿到 Confluence page id
4. Atlas 调 Confluence API 获取 metadata + body
5. Atlas 生成 Candidate Profile
6. Candidate 出现在 Source Intake Queue
```

这里的“URL 丢给 Atlas”就是一个具体入口，不是口头动作。

---

## B. 自动扫描 Confluence space / label

发生位置：

```
Atlas 后台扫描任务
```

输入：

```
被允许扫描的 Confluence spaces
被允许识别的 labels
被允许的 parent pages
```

例如：

```
Cloud Platform space
Cloud Security space
Landing Zone parent page
```

扫描任务发现新页面后，不直接进入 Active，而是进入：

```
Discovered → Candidate
```

它会出现在：

```
Source Intake Queue / Auto-discovered Candidates
```

---

## C. Portal 用户反馈推荐 URL

发生位置：

```
Portal 的 Report missing source / Suggest source 入口
```

普通用户可以提交：

```
I found a useful Confluence page
URL: xxx
Reason: this helped me onboard to AWS Federated
```

这不会直接入库，只会生成：

```
Candidate source
```

然后进入 Source Curator queue。

---

# 2.2 Candidate Profile 在哪里执行？在哪里看？

## 在哪里执行？

发生在 Atlas backend，不在浏览器。

原因：

```
Confluence API token / service account 不能暴露给浏览器
AI profiling 需要读取页面内容，也不能在前端直接做
权限判断和 metadata 抽取也需要服务端
```

执行链路是：

```
Source Intake request
→ Atlas backend
→ Confluence resolver
→ Metadata extractor
→ Content normalizer
→ AI profiler
→ Duplicate detector
→ Candidate Profile created
```

---

## 在哪里看？

在：

```
Source Intake Queue
```

Candidate card 应该长这样：

```
Candidate Source

Title:
How to onboard an application to AWS Federated Landing Zone

Source:
Confluence / Cloud Platform space

Detected purpose:
Application onboarding guide

AI summary:
This page explains prerequisites, access request, TFE workspace setup, Harness deployment, and support path for onboarding applications to AWS Federated Landing Zone.

Suggested capability:
AWS Federated Landing Zone

Suggested scenario:
Application onboarding

Suggested authority:
Recommended / possibly Canonical

Detected owner:
Cloud Platform Enablement

Detected support path:
#cloud-platform-support

Duplicate candidates:
- Legacy AWS Landing Zone Onboarding Guide
- AWS Account Request FAQ

Risks:
- No explicit reviewed date found
- Mentions legacy account request process
- Last updated 11 months ago

Actions:
[Reject]
[Send to Steward]
[Mark as Reference]
[Merge with existing source]
```

这就是 3.3 “在哪执行、在哪看”的答案。

---

# 2.3 Proposed：在哪里确认？

Candidate 经过 Source Curator 初筛后，才会进入 Proposed。

## 谁提出 Proposed？

不是 Source Author。  
是 **Source Curator**。

发生位置：

```
Source Intake Queue
```

动作：

```
Curator 点击 Send to Steward
```

同时选择或确认：

```
which capability steward should review this
suggested authority level
suggested authority scope
reason for review
```

但这些应该由 AI 预填，Curator 只改错。

---

## 谁确认 Proposed？

**Capability Steward** 确认。

发生位置：

```
Steward Review 页面
```

Steward 通过 deep link 进入，例如：

```
Atlas / Steward Review / pending source proposal
```

不是让 steward 去看 registry，也不是让他写 schema。

---

## Steward 看到什么？

他应该看到一个极简确认卡：

```
Source proposal for: AWS Federated Landing Zone

Confluence page:
How to onboard an application to AWS Federated Landing Zone

AI summary:
This page describes onboarding steps for application teams, including access request, TFE workspace setup, Harness deployment, and support path.

Suggested scope:
AWS Federated Landing Zone / Application onboarding

Detected source version:
Confluence version 14
Last updated:
2026-05-05 by Alice

Potential duplicate:
Legacy AWS Landing Zone Guide

Question:
How should Atlas treat this source?

Actions:
[Canonical for this scope]
[Recommended]
[Reference only]
[Not relevant]
[Outdated]
[Wrong steward]
```

如果点 **Canonical**，再问一次：

```
Is this the final authoritative source for this scope?

[Yes]
[No, recommended only]
[There is another canonical source]
```

这就是 3.5 “在哪看、在哪点”的答案。

---

# 2.4 Active：确认进入后发生什么？

当 steward 确认后，Atlas 不能只是保存一个链接。它要生成一个 **Active Source Record**，然后被 Portal 页面消费。

---

## 2.4.1 后台发生什么

确认动作会产生这些结果：

```
1. Source status: Proposed → Active
2. 保存 reviewed Confluence version
3. 保存 reviewed_at
4. 保存 reviewed_by
5. 保存 authority level
6. 保存 authority scope
7. 保存 capability relationship
8. 保存 source summary
9. 保存 visibility / permission status
10. 保存 health status
11. 生成 Portal source card data
12. 触发页面索引 / cache 更新
```

重点是：

```
reviewed version = steward 确认时的 Confluence version
```

这非常重要。之后判断 changed 就靠它。

---

## 2.4.2 Portal 如何展示

Active 后，Source 会出现在几个地方，取决于 relationship。

例如 steward 确认它属于：

```
Capability: AWS Federated Landing Zone
Scenario: Application onboarding
Authority: Canonical
```

那么 Portal 上：

### Capability detail 页面

会出现：

```
Authoritative Sources

[Canonical] How to onboard an application to AWS Federated Landing Zone
Confluence · Reviewed by Landing Zone Steward on 2026-05-11
Last updated in Confluence on 2026-05-05
Open in Confluence
```

### Source detail 页面

会出现：

```
Source: How to onboard an application to AWS Federated Landing Zone

Authority:
Canonical for AWS Federated Landing Zone / Application onboarding

Owner:
Cloud Platform Enablement

Reviewed:
2026-05-11 by Landing Zone Steward

Source version:
Confluence version 14

Current source status:
Readable / Healthy

Open canonical source:
Confluence link
```

### Search / discovery

用户搜：

```
onboard landing zone
AWS Federated
application onboarding
```

这个 source 会被召回，因为它已经和 capability / scenario / summary 关联。

---

## 2.4.3 如果页面展示正文 preview

V1 建议只展示 preview，不展示完整正文。

Active 后可以展示：

```
AI summary
key sections
short preview
open source link
```

但要标注：

```
Preview from Confluence. Open canonical source for full content.
```

如果 source 是 restricted，则不展示正文 preview，只展示 metadata + access request guidance。

---

# 2.6 Changed：怎么识别？

Changed 的识别必须靠 **source snapshot comparison**。

当 source 被确认 Active 时，Atlas 保存一个 reviewed snapshot。

---

## 2.6.1 Active 时保存什么 snapshot

对于 Confluence source，Atlas 保存：

```
reviewed_page_id
reviewed_version
reviewed_title
reviewed_updated_at
reviewed_updated_by
reviewed_body_fingerprint
reviewed_key_section_fingerprints
reviewed_labels
reviewed_parent_page
reviewed_visibility_state
reviewed_outgoing_links
reviewed_extracted_summary
reviewed_detected_steps
```

不需要保存完整正文，但要保存足够判断变化的 fingerprint 和结构化抽取结果。

---

## 2.6.2 定期检查什么

Atlas 后台任务定期检查 active Confluence sources：

```
current page exists?
current version changed?
current title changed?
current body fingerprint changed?
current important sections changed?
current labels changed?
current parent page changed?
current visibility changed?
current outgoing links changed?
current owner/support section changed?
```

如果完全没变：

```
status remains Active
```

如果变了：

```
Active → Changed
```

但 Changed 只是内部状态，不一定立刻影响用户展示。

---

# 2.6.3 怎么判断不同情况？

判断要分两步：

```
机械判断：Confluence metadata / fingerprint 是否变化
语义判断：变化是否影响 source trust
```

---

## 机械判断

这一步不需要 AI。

| 检查项 | 判断 |
| --- | --- |
| page id 不存在 | Broken |
| API 返回 403 | Permission issue |
| version 增加 | Changed |
| title 变化 | Changed |
| parent page 变化 | Changed |
| labels 变化 | Changed |
| body hash 变化 | Changed |
| anchor 找不到 | Broken anchor |
| last updated 超过 reviewed version | Changed |
| review cycle 超过 | Stale |

---

## 语义判断

这一步用 AI 帮忙，但 AI 不直接决定最终权威状态。

AI 比较：

```
reviewed snapshot
current extracted content
```

然后生成：

```
Change summary
Change severity
Suggested action
```

例如：

```
Change summary:
- Added a new step requiring ServiceNow approval.
- Removed the old email-based access request process.
- Updated TFE workspace naming convention.
- Support channel unchanged.

Severity:
Major

Suggested action:
Capability steward should confirm whether this source remains canonical.
```

---

## Severity 分级

| Severity | 例子 | 动作 |
| --- | --- | --- |
| Minor | typo、格式、标题小修 | 自动记录，不打扰 steward |
| Moderate | 新增 FAQ、补充说明、轻微流程说明 | 进入 Curator Queue |
| Major | onboarding step、access path、policy、scope 改动 | 进入 Steward Review |
| Critical | 页面删除、权限丢失、canonical 冲突、核心链接失效 | Portal 显示 warning，通知 Curator + Steward |

---

# 2.6.4 不同变化的具体处理

## 情况 A：页面只改了错别字

Atlas 检测到：

```
Confluence version changed
body fingerprint changed
AI severity = Minor
```

动作：

```
记录 change event
不改变 Portal 展示
不通知 steward
```

Source 状态可以仍然是：

```
Active
```

但 source detail 里可看到：

```
Last checked: xxx
Minor change detected after review
```

也可以不对终端用户展示。

---

## 情况 B：页面改了操作步骤

Atlas 检测到：

```
version changed
key section "Steps" changed
AI severity = Major
```

动作：

```
Source status: Active → Needs Review
创建 Maintenance Queue item
通知 Capability Steward
Portal 显示 Changed since review
```

Portal 展示：

```
Canonical · Changed since last review
Reviewed version: 14
Current Confluence version: 16
```

---

## 情况 C：页面权限变了

Atlas 检测到：

```
之前 service account 可读
现在 API 403
```

动作：

```
status: Permission Issue
preview unavailable
通知 Source Curator
Portal 显示 Restricted / Preview unavailable
```

如果只是用户个人打不开，见后面的 5.4。

---

## 情况 D：页面被删除

Atlas 检测到：

```
Confluence API 404
```

动作：

```
status: Broken
Portal 显示 broken warning
Source Curator queue 创建 item
Curator 联系 steward 确认 replacement / retire
```

---

## 情况 E：页面超过 review 周期

Atlas 检测到：

```
today - last_reviewed_at > freshness policy
```

动作：

```
status: Stale
Portal 显示 stale warning
Maintenance Queue 创建 review item
```

---

# 3. 新增 Confluence Source 的完整落地流程

现在把它串起来。

---

## Step 1：Confluence 作者正常写文档

发生位置：

```
Confluence
```

角色：

```
Source Author
```

动作：

```
写内容、更新内容、维护文档本身
```

Source Author 不需要进 Atlas。

---

## Step 2：Atlas 发现或接收 URL

发生位置：

```
Atlas Source Intake
或自动扫描任务
或 Portal suggest source
```

角色：

```
Source Curator / automation / 普通用户反馈
```

“把 URL 丢给 Atlas”具体是：

```
Source Intake 页面有一个 Add source by URL
粘贴 Confluence URL
点击 Analyze
```

后台：

```
解析 Confluence page id
调用 Confluence API
读取 metadata + body
生成 Candidate Profile
```

---

## Step 3：Candidate Profile 生成

发生位置：

```
Atlas backend
```

查看位置：

```
Source Intake Queue
```

角色：

```
Source Curator
```

内容：

```
AI summary
suggested capability
suggested scenario
detected owner
detected support path
detected tools
possible duplicate
risk
permission status
suggested authority
```

---

## Step 4：Curator 初筛

发生位置：

```
Source Intake Queue
```

角色：

```
Source Curator
```

动作：

```
Reject
Send to Steward
Merge with existing
Mark as low-value reference
```

如果 Send to Steward，需要确认：

```
which steward
which capability/scope
```

但 AI 预填。

---

## Step 5：Steward 确认

发生位置：

```
Steward Review 页面
```

角色：

```
Capability Steward
```

动作按钮：

```
Canonical
Recommended
Reference
Reject
Wrong steward
Outdated
```

所有按钮都记录：

```
reviewed_by
reviewed_at
reviewed_confluence_version
decision
```

---

## Step 6：Active Source Record 创建

发生位置：

```
Atlas backend / registry store
```

角色：

```
系统自动
```

结果：

```
Source 进入 Active
生成 source card
建立 capability relationship
建立 authority scope
保存 reviewed snapshot
进入 monitoring
```

---

## Step 7：Portal 展示

发生位置：

```
Portal
```

用户看到：

```
Source card
Authority badge
Freshness status
Open in Confluence
Preview / restricted notice
Report issue
```

Portal 不直接读 Confluence。  
Portal 读 Atlas Context API / Source API。

这符合文档里的原则：Portal 是 consumer，不应该绕过 API 直接拥有 registry data。

粘贴的 markdown (1)。md

---

## Step 8：持续监控

发生位置：

```
Atlas backend scheduled job
```

检查：

```
version
updated time
title
permission
body fingerprint
key section fingerprint
links
freshness
```

结果进入：

```
Source Maintenance Queue
```

---

## Step 9：Maintenance Queue 处理

发生位置：

```
Source Maintenance Queue
```

角色：

```
Source Curator
Capability Steward
Cloud Platform team
```

如果是 minor change：

```
Curator dismiss
```

如果是 major canonical change：

```
Send to Steward Review
```

如果是 broken / permission：

```
Curator investigates
```

如果是 stale：

```
Steward confirms still valid
或 marks deprecated
```

---

# 4. 5.4：Atlas 怎么知道用户打不开、没权限？

这里要分清楚两种情况。

---

# 情况一：Atlas service account 读不了

这个最容易判断。

后台调用 Confluence API 时返回：

```
403 / 401
```

Atlas 立刻知道：

```
service account has no access
```

状态：

```
Service blocked
```

Portal 展示：

```
Preview unavailable because Atlas cannot access this source.
Open in Confluence or contact source owner.
```

这是系统级权限问题。

---

# 情况二：Atlas 读得到，但当前用户打不开

这需要用户身份和 Confluence 权限的某种映射。V1 可以有三种实现深度。

---

## Level 0：不做 per-user 权限判断

适合当前 local / demo / early V1。

Atlas 只展示 source visibility label：

```
Internal
Restricted
Confidential
Unknown
```

Portal 提示：

```
You may need access to view this source.
```

Atlas 不声称“你一定能打开”。

这是最简单，也最安全。

---

## Level 1：基于 Confluence page restriction 做粗粒度判断

Atlas service account 读取 page restriction metadata。

它可以知道：

```
这个页面是否有 read restriction
允许哪些 group / user
```

如果 Portal 用户身份已经接入 SSO，并且能拿到用户 group，则 Atlas 可以做近似判断：

```
user groups ∩ allowed groups 是否有交集
```

如果没有交集：

```
Likely no access
```

Portal 展示：

```
You may not have access to this Confluence page.
Request access here.
```

注意用 **may not**，因为 Confluence 权限可能继承、嵌套、外部组映射复杂。

---

## Level 2：实时代表用户检查权限

最准确，但最复杂。

方式：

```
用户登录 Atlas
Atlas 使用用户身份或 delegated token 调 Confluence permission check
```

然后知道：

```
current user can read page: yes/no
```

这需要：

```
SSO
Confluence delegated auth
token exchange
source-system permission integration
```

V1 不建议一开始做。

---

# 推荐 V1 权限策略

结合你当前阶段，我建议：

```
V1 使用 Level 0 + 部分 Level 1
```

也就是：

```
- Atlas service account 能否读取：必须做
- source 是否 restricted：尽量通过 Confluence metadata 判断
- 当前用户是否一定有权限：不强承诺
- Portal 展示保守提示
```

终端文案：

```
This source may require Confluence access.
If you cannot open it, request access via Cloud Platform Support.
```

如果能拿到 restriction metadata，则展示更具体：

```
This source is restricted to Cloud Platform and Application Owner groups.
Request access if needed.
```

---

# 5. Confluence Source 的工程对象流

不用代码，但需要明确对象从哪里到哪里。

---

## 5.1 SourceCandidate

产生于：

```
URL intake
auto discovery
user suggestion
```

保存：

```
Confluence page id
URL
title
AI profile
detected owner
detected capability
detected risks
duplicate candidates
status = Candidate
```

展示在：

```
Source Intake Queue
```

---

## 5.2 SourceProposal

产生于：

```
Curator 点击 Send to Steward
```

保存：

```
candidate id
assigned steward
suggested authority
suggested scope
AI summary
curator note
status = Proposed
```

展示在：

```
Steward Review
```

---

## 5.3 SourceRecord

产生于：

```
Steward approve
```

保存：

```
source identity
authority
scope
reviewed version
reviewed snapshot
freshness policy
visibility policy
relationships
status = Active
```

展示在：

```
Portal source card
Source detail
Capability source list
```

---

## 5.4 SourceCheckResult

产生于：

```
scheduled source monitor
manual recheck
```

保存：

```
current version
current access status
current title
current content fingerprint
change severity
AI change summary
health status
```

展示在：

```
Source Maintenance Queue
Source detail internal panel
Portal warning badge if relevant
```

---

## 5.5 SourceMaintenanceItem

产生于：

```
changed
stale
broken
permission issue
authority conflict
user feedback
```

保存：

```
issue type
severity
suggested action
assigned owner
due status
AI summary
```

展示在：

```
Source Maintenance Queue
```

---

# 6. 具体问题逐条回答

## 2.2 在哪提出？

在三个地方产生 Candidate：

```
Atlas Source Intake 页面：Curator 粘贴 URL，点击 Analyze
Atlas 自动扫描：后台扫描 Confluence space / label
Portal 用户反馈：Suggest source
```

Candidate 提出后，出现在：

```
Source Intake Queue
```

---

## 2.3 在哪确认？

Curator 初筛在：

```
Source Intake Queue
```

Steward 确认在：

```
Steward Review 页面
```

Steward 通过通知 deep link 进入，不需要懂 registry。

---

## 2.4 确认进入后发生什么？

后台：

```
SourceProposal → SourceRecord
保存 reviewed version
保存 reviewed snapshot
建立 authority scope
建立 capability relationship
进入 monitoring
```

Portal：

```
Capability 页面出现 source card
Source detail 可访问
Search 可召回
显示 authority / freshness / warning / open Confluence
```

---

## 2.6 怎么识别 changed？

通过 Confluence metadata + snapshot comparison：

```
page version
updated_at
title
body fingerprint
key section fingerprint
labels
parent page
permission status
links
```

再用 AI 做 change summary 和 severity classification。

---

## 怎么判断不同情况？

先机械判断，再语义判断。

机械判断：

```
404 = broken
403 = permission issue
version changed = changed
review cycle expired = stale
anchor missing = broken anchor
```

语义判断：

```
AI 比较 reviewed snapshot 和 current source
生成 minor / moderate / major / critical
```

然后决定：

```
minor: record only
moderate: curator queue
major: steward review
critical: warning + curator/steward action
```

---

## 什么叫把 URL 丢给 Atlas？

具体就是：

```
Atlas Source Intake 页面
Add Confluence Source
Paste URL
Analyze
```

后台解析、读取、总结、生成 Candidate Profile。

---

## 3.3 在哪执行？在哪看？

执行在：

```
Atlas backend
Confluence resolver + AI profiler
```

查看在：

```
Source Intake Queue / Candidate detail
```

---

## 3.5 在哪看在哪点？

看和点都在：

```
Steward Review 页面
```

入口可以来自：

```
邮件通知
Teams / Slack 通知
Atlas pending review list
```

按钮：

```
Canonical
Recommended
Reference
Reject
Wrong steward
Outdated
```

---

## 5.4 Atlas 怎么知道用户打不开没权限？

三种深度：

```
Level 0：不知道当前用户是否能打开，只展示 may require access
Level 1：读取 Confluence restriction metadata + 用户 group，做粗判断
Level 2：用用户 delegated token 实时检查 Confluence permission
```

V1 推荐：

```
先做 service account access check
再做 source restricted metadata
不强做 per-user permission
```

---

# 7. 最终落地版生命周期

把所有东西合成一条真正可实现的流程：

```
1. Source Author 在 Confluence 正常写文档。

2. Atlas 通过三种方式发现页面：
   - Curator paste URL in Source Intake
   - scheduled Confluence scan
   - Portal user suggests source

3. Atlas backend 读取 Confluence：
   - page id
   - title
   - version
   - updated_at
   - author/updater
   - restrictions if available
   - body content if service account can read

4. Atlas 生成 Candidate Profile：
   - AI summary
   - detected capability
   - detected scenario
   - detected owner/support path
   - duplicate candidates
   - suggested authority
   - risks

5. Candidate 出现在 Source Intake Queue。

6. Source Curator 初筛：
   - reject
   - merge
   - send to steward

7. Steward 在 Steward Review 页面确认：
   - canonical
   - recommended
   - reference
   - reject
   - wrong steward
   - outdated

8. Steward approve 后：
   - 创建 Active Source Record
   - 保存 reviewed Confluence version
   - 保存 reviewed snapshot
   - 建立 authority scope
   - 建立 capability relationship
   - 进入 monitoring

9. Portal 消费 Atlas API：
   - 在相关 capability / source detail 页面展示 source card
   - 显示 authority、review、freshness、permission、warning
   - 提供 open Confluence 和 feedback

10. Atlas 定期 monitor：
   - version changed?
   - body fingerprint changed?
   - key section changed?
   - page deleted?
   - permission changed?
   - review expired?

11. Atlas 生成 SourceCheckResult：
   - no change
   - minor change
   - moderate change
   - major change
   - critical issue

12. 有问题则进入 Source Maintenance Queue：
   - curator 处理普通问题
   - steward 处理 canonical / major / stale / conflict
   - Cloud Platform team 处理 systemic issue

13. Review 后更新：
   - reviewed version
   - reviewed_at
   - status
   - warning
   - authority
   - deprecated / retired if needed
```

---

# 8. 这个设计的关键取舍

最重要的是这几条：

```
Source Author 不维护 Atlas。
Source Curator 维护 Atlas source lifecycle。
Capability Steward 只做 authority / validity 判断。
Atlas 自动做发现、总结、监测、变更识别、权限状态识别。
Portal 只消费 Active SourceRecord，不直接读 Confluence。
Changed 不等于有问题，Needs Review 才需要人处理。
last updated 不等于 last reviewed。
Atlas 不承诺用户一定有源系统权限，除非做 delegated permission check。
```

这样它才不是一句“source lifecycle system”，而是一个可以被工程团队实现、被企业团队长期运营的产品机制。

* * *

**You:**

234surface都是portal的新页面了意思是？那不还是admin ui吗？？？

* * *

**ChatGPT:**

对，这个质疑是对的。

我上一版把 **Source Intake / Steward Review / Maintenance Queue** 都说成 Portal 页面，实际上这会滑向 **admin UI**。如果 V1 明确“不做 admin UI”，那 2/3/4 surface 不应该是 Portal 里的正式产品页面。

应该改成：

> **Portal 只给普通用户消费 source；source 管理发生在 GitOps + automation + existing workflow tools 里。**

也就是：

```
Portal
= 展示、搜索、反馈、suggest source

Source management
= Git repo + CI validation + bot/PR comments + issue tracker + notification approval
```

---

# 正确拆法

## 1. Portal 只保留两个用户-facing 能力

### A. Source 展示

普通用户看到：

```
- Source card
- Authority badge
- Reviewed / stale / changed warning
- Open in Confluence
- Access guidance
- Report issue
```

### B. Suggest source / Report issue

普通用户最多能做：

```
- suggest a Confluence URL
- report stale / broken / wrong / permission issue
```

但提交后不是进 Portal admin queue，而是：

```
创建 Git issue / Jira ticket / ServiceNow item / backlog item
```

Portal 不承载管理工作流。

---

# 那 2/3/4 发生在哪里？

## 2. Source Intake：不是 Portal 页面，而是 intake workflow

“把 URL 丢给 Atlas”不应该是 Portal admin 页面。

更合理的是三种入口：

### 入口 A：GitOps PR

Source Curator 在 registry repo 里新增一个 minimal source proposal。

但不是手填一堆字段，只填最少：

```
Confluence URL
target capability / approximate area
reason / optional note
```

然后 automation 自动补全：

```
title
page id
AI summary
detected owner
detected scope
detected duplicate
permission status
suggested authority
risk
```

AI 结果以 PR comment 形式出现。

---

### 入口 B：Issue / Jira / ServiceNow intake

普通用户或 steward 提交：

```
Please add this Confluence page to Atlas:
<url>
```

automation 读取 ticket，生成 source proposal，或者自动开 registry PR。

这个更企业化。

---

### 入口 C：Confluence label / page property

Confluence 作者不维护 Atlas，但如果团队已有习惯，可以允许他们加一个轻量 label：

```
atlas-candidate
```

然后 Atlas 自动扫描。

但这不是强制流程，只是低成本发现机制。

---

# 3. Steward Review：不要做 Steward Review 页面

如果不做 admin UI，steward 确认应该发生在现有协作系统里。

推荐方式：

## 方式 A：PR review

Automation 在 registry PR 里生成评论：

```
Candidate source:
How to onboard an application to AWS Federated Landing Zone

AI summary:
...

Suggested authority:
Recommended / possibly Canonical

Suggested scope:
AWS Federated Landing Zone / Application onboarding

Steward decision required:
- canonical
- recommended
- reference
- reject
```

Capability Steward 作为 CODEOWNER / required reviewer 审 PR。

他不编辑复杂字段，只通过 PR comment 或 checkbox 确认。

最后 Source Curator merge。

这不是 Portal admin UI，是 GitOps governance。

---

## 方式 B：Jira approval

如果组织更偏流程工具：

```
Automation 创建 Jira approval task
Steward 在 Jira 点 approve / reject
Automation 更新 registry PR
```

但这比 PR review 重。

---

## 方式 C：Teams / Slack interactive approval

可以有按钮：

```
[Canonical] [Recommended] [Reference] [Reject]
```

但最终还是写回 registry PR 或 issue，不直接改生产 registry。

这个适合后续增强，不是 V1 必须。

---

# 4. Maintenance Queue：也不要做 Portal 页面

我之前说的 Maintenance Queue，确实听起来像 admin UI。V1 应该换成：

> **Maintenance backlog generated by automation.**

它可以存在于：

```
GitHub Issues
Jira
ServiceNow
ADO Boards
```

而不是 Atlas Portal。

---

## Maintenance 怎么落地

Atlas scheduled job 检测到问题后，不在 Portal 里创建 queue，而是：

```
1. 写 SourceCheckResult 到 registry report / state store
2. 创建或更新 issue
3. 标记 source warning
4. 必要时开自动 PR
```

例如：

### Confluence 页面 version changed

Automation 创建 issue：

```
Source changed since last review

Source:
AWS Federated Landing Zone Onboarding

Reviewed version:
14

Current version:
16

AI change summary:
- Added ServiceNow approval step
- Removed email request path
- Updated TFE workspace naming rule

Suggested severity:
Major

Requested action:
Capability steward confirm if still canonical.
```

然后 assigned 给 capability steward。

如果 steward 确认：

```
仍有效
```

automation 更新 registry：

```
reviewed_version = 16
last_reviewed_at = today
```

这个更新可以通过 PR 完成。

---

# 所以最终架构应该是这样

```
Portal
  - read-only source experience
  - suggest/report only

Registry repo
  - source records
  - authority mapping
  - freshness policy
  - ownership metadata

Automation
  - Confluence resolver
  - AI profiler
  - duplicate detector
  - change detector
  - health checker
  - PR/comment generator
  - issue generator

Existing workflow tools
  - PR review
  - Jira/ServiceNow issue
  - Teams/Slack notification

Stewards
  - approve authority / validity through PR or issue
```

---

# “admin UI” 与 “ops workflow” 的边界

## 不做 admin UI 的意思是

V1 不做这些：

```
- Portal 里新增 Source 管理后台
- Portal 里编辑 source metadata
- Portal 里审批 source
- Portal 里维护 owner / authority / lifecycle
- Portal 里做 queue 管理
```

## 但仍然需要 source ops

否则 source lifecycle 没法跑。

V1 的 source ops 应该靠：

```
- GitOps registry
- automation-generated PR
- CI validation
- PR review
- issue tracking
- notifications
```

这才和“不做 admin UI”一致。

---

# 修正后的生命周期

## 1. 发现

来源：

```
- Confluence label scan
- 用户 Portal suggest source
- Curator manually creates issue / PR with URL
- automation discovers linked page
```

落地位置：

```
Issue / registry PR / automation report
```

不是 Portal admin 页面。

---

## 2. AI profiling

发生在：

```
CI job / scheduled job / bot workflow
```

输出到：

```
PR comment
Issue comment
generated source proposal
```

---

## 3. Curator 初筛

发生在：

```
PR review / issue triage
```

动作：

```
close
request steward review
adjust generated metadata
merge duplicate
```

---

## 4. Steward 确认

发生在：

```
PR review
issue approval
comment command
```

不是 Portal 页面。

Steward 只确认：

```
canonical / recommended / reference / reject
scope 是否正确
是否仍有效
```

---

## 5. Active

发生在：

```
registry PR merged
```

之后：

```
Atlas backend reloads registry
Portal displays source
monitoring starts
```

---

## 6. Changed / Stale / Broken

发生在：

```
scheduled checker
```

输出到：

```
source warning
issue
PR
notification
```

---

## 7. Review / update

发生在：

```
PR / issue workflow
```

不是 Portal 管理后台。

---

# 一句话修正

你可以这样定义：

> **Atlas V1 has no admin UI. Source management is operated through GitOps and existing enterprise workflow tools. Portal is read-only for governed source consumption, with lightweight feedback and source suggestion only.**

这个更准确，也更符合你当前想法。

* * *

**You:**

听起来这个维护流程一定需要某个surface，当前我的想法是GitHub PR可能是最简单的地方但是实际情况应该不行因为公司里面当前没法automation创建PR，创建Agent根据PR内容做识别扫描分析，review等等，如果有的话这条路可能是最简单的，或许可以借助PR under the hood 但对于用户入口是portal某个page

* * *

**ChatGPT:**

对，这里需要修正成一个更现实的判断：

> **长期 source maintenance 一定需要一个 operational surface。  
> 区别不是“有没有 surface”，而是这个 surface 是不是完整 admin UI。**

你现在的直觉是对的：  
**GitHub PR 是最理想的治理底座，但不一定是最现实的用户入口。**  
所以更适合的设计是：

```
Portal 提供轻量 source operations surface
↓
后台仍然以 registry change / review record / audit log 的方式治理
↓
未来如果公司具备 GitHub automation，再把 PR 作为 under-the-hood approval / persistence layer
```

也就是：

> **Portal 可以有 source management surface，但不要做成 full admin UI。**

---

# 关键区分：Source Ops Surface ≠ Admin UI

## Full Admin UI 是什么

你不想做的是这个：

```
- Portal 里手工维护所有 registry 字段
- Portal 里编辑 source schema
- Portal 里配置复杂 authority rule
- Portal 里管理用户权限
- Portal 里手动创建/修改所有 metadata
- Portal 变成 Atlas 后台管理系统
```

这会膨胀，而且和 V1 边界冲突。

## Source Ops Surface 是什么

可以做的是这个：

```
- 提交一个 Confluence URL
- 查看 AI 解析结果
- 确认/拒绝纳入 Atlas
- 标记 canonical / recommended / reference
- 确认 changed source 是否仍有效
- 处理 stale / broken / permission issue
- 记录 review decision
```

这不是“配置后台”，而是 **治理工作流界面**。

所以产品上可以这样命名，避免叫 admin：

```
Source Review
Source Intake
Source Health
Steward Actions
```

而不是：

```
Admin Console
Registry Management
Source Admin
```

---

# 推荐架构：Portal as Workflow Surface, Registry as Governance Backend

你的场景里，最合适的是：

```
Portal
  普通用户：看 source、report issue、suggest source
  Curator/Steward：处理 source review / source health action

Atlas Backend
  source candidate
  AI profile
  source record
  review decision
  source check result
  audit event

Registry Store
  当前可以是 DB / file / internal config
  未来可以接 GitOps / PR under the hood

Automation
  Confluence resolver
  AI profiler
  change detector
  freshness checker
  notification
```

这保留了产品可用性，也不把 V1 卡死在 GitHub automation 上。

---

# 最现实的三层设计

## Layer 1：Portal 轻量操作入口

给人用，完成最少动作。

### 普通用户入口

```
Suggest source
Report issue
Open source
Request access guidance
```

### Source Curator 入口

```
Review candidates
Validate AI extraction
Assign steward
Reject duplicate
Send for steward decision
```

### Capability Steward 入口

```
Approve as canonical
Approve as recommended
Approve as reference
Reject
Confirm still valid
Mark deprecated
```

这里的关键是：  
**Portal 只让人做决策，不让人维护复杂字段。**

---

## Layer 2：后台自动生成和维护 metadata

人不填大表。后台自动做：

```
- Confluence page id
- title
- space
- author / last updater
- last updated time
- version
- permission signal
- AI summary
- suggested capability
- suggested scope
- duplicate detection
- stale detection
- changed detection
- source health check
```

人只在关键判断点介入：

```
- 是否纳入 Atlas
- 对哪个 scope 有效
- authority level 是什么
- changed 后是否仍有效
- 是否 deprecated / retired
```

---

## Layer 3：Registry persistence 可以先不绑定 GitHub PR

你现在的实际约束是：

> 公司当前可能没法让 automation 自动创建 PR、让 agent 基于 PR 扫描分析、review 等。

那就不要强绑 GitOps。

可以定义为：

```
Registry-backed source lifecycle
```

而不是：

```
GitOps-only registry
```

V1 可以是：

```
Portal workflow + backend registry store + audit log
```

未来演进成：

```
Portal workflow + PR under the hood + registry generated from repo
```

---

# 新的产品判断

之前我说 “不做 admin UI，所以 source ops 走 GitOps/PR”，这在理想状态没错，但对你当前组织条件可能过重。

更合适的判断是：

> **V1 不做通用 admin UI，但需要一个 narrow source governance surface。**

这个 surface 只服务 source lifecycle，不做全局配置后台。

---

# Source Management 的实际页面应该有哪些

如果你决定让 Portal 承载入口，我建议最多做 3 个内部页面。

---

## 1. Source Intake

使用者：

```
Source Curator
Cloud Platform team
```

功能：

```
- paste Confluence URL
- Analyze
- 查看 AI Candidate Profile
- reject
- merge duplicate
- send to steward
```

不让用户手填几十个字段。

### 页面核心内容

```
Confluence URL
Detected title
AI summary
Detected owner
Detected capability
Detected duplicate sources
Detected permission status
Detected freshness risk
Suggested authority
Suggested steward
```

### 人工动作

```
Reject
Send to steward
Mark as reference
Merge duplicate
```

---

## 2. Steward Review

使用者：

```
Capability Steward
```

功能：

```
- 查看待确认 source
- 看 AI summary
- 看 source preview / Confluence link
- 确认 authority
- 确认 scope
- 确认 changed source 是否仍有效
```

### 人工动作

```
Canonical
Recommended
Reference
Reject
Wrong steward
Still valid
Deprecated
Retire
```

这里不叫 admin，因为 steward 不是在管理系统，而是在确认自己负责 capability 的知识权威状态。

---

## 3. Source Health / Review Queue

使用者：

```
Source Curator
Cloud Platform team
```

功能：

```
- 看 broken / stale / changed / permission issue
- 看 AI change summary
- 路由给 steward
- dismiss minor change
- mark warning
```

### 人工动作

```
Dismiss minor
Send to steward
Mark stale
Mark deprecated
Retire
Recheck
```

---

# Portal 普通用户侧仍然是只读

普通用户看不到这些内部 source ops 页面，或者只看到极简入口：

```
Suggest source
Report issue
```

所以它不会变成面向所有人的 admin UI。

权限上可以分：

```
Consumer
Curator
Steward
Platform Owner
```

但是 V1 可以很轻：

| 角色 | 能做什么 |
| --- | --- |
| Consumer | 看、搜、反馈、suggest |
| Curator | intake、triage、route、dismiss |
| Steward | approve authority、confirm validity |
| Platform Owner | override、retire、resolve conflict |

---

# 这套流程怎么跑：以 Confluence 新增为例

## 1. Source Author 写 Confluence

不管 Atlas。

---

## 2. Curator 在 Portal Source Intake 粘贴 URL

这就是“把 URL 丢给 Atlas”的实际含义：

```
Portal / Source Intake / Add Confluence Source
```

输入：

```
Confluence URL
optional note
```

---

## 3. Atlas backend 分析

后台做：

```
resolve page id
fetch metadata
fetch body if permitted
generate AI summary
detect capability
detect steward
detect duplicates
detect visibility
detect source type
detect risks
```

结果生成：

```
SourceCandidate
```

---

## 4. Curator 看 Candidate Profile

Curator 不写复杂字段，只做判断：

```
看起来是有效文档？
是否重复？
应该给哪个 steward？
```

动作：

```
Send to steward
```

---

## 5. Steward 在 Portal Steward Review 确认

Steward 收到通知，打开 review link。

看到：

```
标题
摘要
来源链接
AI 建议 scope
AI 建议 authority
可能重复文档
当前风险
```

点：

```
Canonical / Recommended / Reference / Reject
```

---

## 6. 确认后 Active

后台生成：

```
Active SourceRecord
reviewed version
reviewed snapshot
authority scope
source summary
relationship
audit event
```

Portal 消费它，在相关页面显示 source card。

---

# Changed / Stale / Broken 怎么跑

## 1. Atlas 定期检查 Confluence

后台任务检查：

```
page exists?
service account can read?
version changed?
title changed?
body fingerprint changed?
key sections changed?
permissions changed?
review cycle expired?
```

---

## 2. 生成 SourceCheckResult

例如：

```
Source changed since review
Reviewed version: 12
Current version: 15

AI change summary:
- Added new access request step
- Removed old email request
- Changed TFE workspace naming rule

Severity:
Major
```

---

## 3. 出现在 Source Health / Review Queue

Curator 看到：

```
Major change on canonical source
Suggested action: send to steward
```

Curator 点：

```
Send to steward
```

---

## 4. Steward 确认

Steward 看到：

```
This canonical source changed since your last review.
Do you confirm the current version remains canonical?
```

点：

```
Still valid
Needs update
Deprecated
Wrong source
```

---

## 5. 系统更新状态

如果 Still valid：

```
reviewed version = current version
last reviewed = now
warning removed
```

如果 Needs update：

```
status = Needs Review
Portal warning remains
```

如果 Deprecated：

```
status = Deprecated
Portal shows replacement if available
```

---

# 你提到 PR under the hood：这是合理演进

我建议不要在 V1 强依赖 GitHub PR，但可以把模型设计成未来能接。

## 当前 V1

```
Portal workflow
→ backend writes registry store
→ audit log records all decisions
```

## 未来 GitOps-ready

```
Portal workflow
→ backend generates registry change
→ opens PR under the hood
→ steward review maps to PR approval
→ merge updates registry
```

也就是说，Portal 是用户入口，PR 是治理底座。

这两者不冲突。

---

# 关键产品表述可以这样写

> **Atlas V1 does not provide a general-purpose admin UI.  
> It provides a narrow source governance workflow for intake, steward review, and source health actions. Most metadata is generated automatically from Confluence and AI profiling. Human users only confirm authority, scope, and validity.**

中文：

> **Atlas V1 不做通用后台管理系统，但需要一个窄范围的 Source Governance 工作流界面。它只处理 source 纳入、权威确认、变更复核和健康状态，不让用户手工维护复杂 registry。**

---

# 这个设计为什么站得住

因为它满足你的几个约束：

## 1. 不依赖 GitHub automation

当前可以直接在 Atlas backend 持久化 source record 和 review decision。

## 2. 不增加 Source Author 负担

作者只写 Confluence。

## 3. Steward 参与很少

只点几个决策按钮，不填复杂表。

## 4. 尽可能自动化

AI 负责摘要、分类、重复检测、变化总结。  
系统负责 Confluence metadata、version、permission、freshness。

## 5. 不是 full admin UI

它不管理所有配置，只处理 source lifecycle。

## 6. 未来可以迁移 GitOps

Portal 可以继续是入口，PR 可以成为 under-the-hood persistence / approval mechanism。

---

# 最终建议

你现在应该把 source management 定义成：

```
Narrow Source Governance Workflow
```

而不是：

```
No admin UI at all
```

更准确的边界是：

```
做：
- Source intake
- AI profiling review
- Steward authority confirmation
- Source health review
- Audit trail
- Portal source display

不做：
- Generic registry editor
- Full admin console
- Manual metadata management
- Source content editing
- Permission administration
- CMS workflow
```

这会比“全部走 GitHub PR”更现实，也比“做 admin UI”更克制。

* * *

**You:**

我只接受portal 新增source intake 页面， health，考虑后台接入PR以此为流程，intake创建PR，后端服务扫描开始分析，放到PR，ask review这样子。完整阐述confluence每个角色在生命周期中的任务

* * *

**ChatGPT:**

可以。按你的边界收敛成一个非常明确的方案：

> **Portal 只新增 Source Intake 页面。  
> Source Health 不做 Portal 页面，只作为后台状态、warning、PR/issue 事件流存在。  
> Source 生命周期的治理底座是 PR。  
> Intake 创建 PR，后台服务基于 PR 触发 Confluence 分析，把 AI profiling、风险、建议、review 请求写回 PR。  
> Steward 在 PR 里 review/approve。  
> PR merge 后，Atlas registry 更新，Portal 展示 source。**

这条路是最克制、也最符合企业治理习惯的。

---

# 1. 最终架构边界

## Portal 负责什么

Portal 只负责两个用户侧能力：

```
1. Source display
   - 普通用户查看 source card / authority / freshness / warning / open Confluence

2. Source Intake
   - Curator 或授权用户提交 Confluence URL
   - 填最少信息
   - 创建 registry PR
   - 展示 PR 状态链接
```

Portal 不做：

```
- Source 编辑后台
- Steward Review 页面
- Health Queue 页面
- Registry 字段管理
- 权限管理
- CMS 内容编辑
```

这符合你们文档里 “Portal is a consumer” 的原则：Portal 不应该绕过 Context API / registry 直接拥有数据模型。Atlas 是 source-native 的 governed information layer，不替代 Confluence / Git 等 source-of-truth 系统。

粘贴的 markdown (1)。md

---

## PR 负责什么

PR 是 source lifecycle 的正式治理表面。

PR 里承载：

```
- source proposal
- AI analysis
- duplicate check
- authority recommendation
- freshness recommendation
- permission signal
- health check result
- steward review
- approval history
- final registry change
```

PR merge 是进入 Active 的边界。

---

## 后台服务负责什么

后台服务负责自动化：

```
- 根据 Intake 创建 PR
- 根据 PR 内容触发 Confluence resolver
- 读取 Confluence metadata / body / version / restriction
- 生成 AI source profile
- 检测 duplicate / risk / possible owner / possible steward
- 写 PR comment
- 请求 steward review
- PR merge 后更新 registry / reload Context Layer
- 持续监测 Active source 的 health / changed / stale
- 必要时创建 follow-up PR
```

---

# 2. Confluence Source 生命周期总览

完整生命周期：

```
Confluence page created / updated
→ Source Intake submitted
→ Registry PR created
→ Backend analysis starts
→ AI profiling comment added to PR
→ Curator verifies PR
→ Steward reviews PR
→ PR merged
→ Source becomes Active
→ Portal displays source
→ Backend monitors Confluence source
→ Changed / stale / broken detected
→ Follow-up PR created
→ Steward confirms / updates / deprecates / retires
```

重点：

> **Source Author 不进入 Atlas 流程。  
> Curator 发起和整理。  
> AI/automation 做分析。  
> Capability Steward 只在 PR 里确认 authority / validity。  
> PR merge 是状态变更的正式边界。**

---

# 3. 角色与任务

## 3.1 Source Author

**对象：**  
Confluence 页面作者或维护人。

**任务：**

```
- 在 Confluence 正常创建、修改、维护内容
- 保持页面本身可读、准确、结构清楚
```

**不负责：**

```
- 不提交 Atlas registry
- 不维护 source metadata
- 不判断 authority scope
- 不维护 freshness policy
- 不处理 PR
- 不处理 Atlas warning
```

Source Author 只在少数情况下被动参与：

```
- Steward 认为内容需要更新
- Curator 找不到长期 owner
- 页面权限或 ownership 不清楚
```

---

## 3.2 Source Curator

**对象：**  
Cloud Platform team / Atlas owner team 内负责 source governance 的人。

**任务：**

```
- 在 Portal Source Intake 提交 Confluence URL
- 触发 PR 创建
- 查看后台写入 PR 的 AI profiling
- 判断是否明显重复、无关、低质量
- 修正 AI 识别错误的 steward / capability / scope
- @ 对应 Capability Steward review
- 处理 PR 上的 automation warning
- merge 前确保必要 approval 完成
```

**不是他的任务：**

```
- 不判断每个 capability 的最终技术权威
- 不手写大量 metadata
- 不维护 Confluence 原文内容
```

他是流程 operator。

---

## 3.3 Capability Steward

**对象：**  
某个 capability / domain 的负责人。

例如：

```
- Landing Zone Steward
- Access Management Steward
- Terraform Module Steward
- Security Baseline Steward
```

**任务：**

在 PR 里确认：

```
- 这篇 Confluence source 是否应该进入 Atlas
- 它对哪个 capability / scope 有效
- 它是 canonical / recommended / reference / rejected
- AI 摘要是否明显误导
- 是否存在更权威 source
- 是否应该 deprecate 旧 source
```

**不负责：**

```
- 不创建 PR
- 不维护复杂 registry 字段
- 不监控 Confluence 变化
- 不管理 Portal 展示
```

他只做 authority / validity decision。

---

## 3.4 Atlas Backend Service

**对象：**  
Atlas 的后台自动化服务。

**任务：**

```
- 接收 Portal Intake 请求
- 创建 registry PR
- 解析 Confluence URL
- 获取 page id / title / version / updated_at / author / restrictions
- 读取正文并生成 AI profile
- 检测重复 source
- 检测可能的 authority conflict
- 生成 PR comment
- 自动请求 steward review
- PR merge 后更新 registry read model
- 定期检查 active sources
- 发现 changed / stale / broken 后创建 follow-up PR
```

后台服务是 source lifecycle 的自动化执行者。

---

## 3.5 Registry Repository

**对象：**  
存储 Atlas source registry 的 repo。

**任务：**

```
- 保存 source records
- 保存 authority mappings
- 保存 reviewed version
- 保存 freshness policy
- 保存 status
- 提供 PR review / audit / history
```

Registry repo 是治理事实来源。

---

## 3.6 Portal Consumer

**对象：**  
普通 application team / platform consumer。

**任务：**

```
- 查找 capability / source
- 打开 Confluence canonical source
- 看 authority / freshness / warning
- 报告 issue
- 可选：通过 Source Intake 建议 source，若被授权
```

普通用户不参与 source governance。

---

# 4. 新增 Confluence Source：完整流程

## 4.1 Confluence 页面存在

Source Author 正常维护页面。

例如：

```
How to onboard an application to AWS Federated Landing Zone
```

页面可能已经存在，也可能刚被某团队创建。

---

## 4.2 Source Curator 在 Portal Source Intake 提交

**位置：**

```
Portal → Source Intake
```

**输入只保留最少：**

```
- Confluence URL
- optional: suggested capability / area
- optional: reason
```

不要让 Curator 填：

```
- authority scope
- freshness policy
- all metadata
- owner details
- source summary
```

这些由后台自动生成。

---

## 4.3 Portal 调后台创建 PR

Source Intake 提交后，Portal 调 Atlas Backend。

后台做：

```
1. 校验 URL 是否是允许的 Confluence domain
2. 解析 page id
3. 创建 registry PR
4. PR 初始内容只包含最小 proposal
5. 返回 PR link 给 Portal
```

Portal 展示：

```
Source proposal created.
PR: <link>
Analysis is running.
```

Portal 到这里基本结束。后续主要在 PR 里发生。

---

# 5. PR 创建后的自动分析

## 5.1 后台服务监听 PR

PR 创建后，后台服务开始分析。

触发方式可以是：

```
- PR created event
- registry proposal file changed event
- scheduled poller
```

如果公司 webhook 不方便，poller 也可以。重点是工程上可实现，不依赖复杂 agent infra。

---

## 5.2 Confluence resolver 读取页面

后台读取：

```
- page id
- title
- space
- parent page
- page version
- created by
- last updated by
- last updated at
- labels
- restrictions / visibility signal
- body content if service account can read
- outgoing links
```

如果读不了：

```
- PR comment 标记 service account cannot access
- PR 暂不能 merge 为 Active
- Curator 需要处理权限或改成 metadata-only source
```

---

## 5.3 AI profiling

后台对 Confluence 内容生成：

```
- short summary
- detected purpose
- detected audience
- detected capability
- detected scenario / use case
- detected owner / support path
- detected tools mentioned
- detected prerequisites
- detected risks
- suggested authority level
- suggested freshness policy
- duplicate source candidates
- possible authority conflicts
```

注意：AI 只建议，不直接决定。

---

## 5.4 后台把分析结果写入 PR comment

PR comment 应该是 steward 可读的，不是机器字段堆砌。

示例：

```
Atlas Source Analysis

Confluence page:
How to onboard an application to AWS Federated Landing Zone

Detected purpose:
Application onboarding guide for AWS Federated Landing Zone.

AI summary:
This page explains prerequisites, access request, TFE workspace setup, Harness deployment, and support path for onboarding applications.

Detected scope:
AWS Federated Landing Zone / Application onboarding

Suggested authority:
Recommended, possibly Canonical

Detected owner:
Cloud Platform Enablement Team

Detected support path:
#cloud-platform-support

Confluence status:
Readable by Atlas service account
Version: 14
Last updated: 2026-05-05

Potential duplicates:
- Legacy AWS Landing Zone Onboarding Guide
- AWS Account Request FAQ

Risks:
- No explicit reviewed date found
- Mentions legacy account request process
- Potential overlap with existing onboarding guide

Requested steward decision:
- canonical
- recommended
- reference
- reject
```

---

# 6. PR Review 阶段

## 6.1 Curator 先看 PR

Curator 检查：

```
- AI 有没有识别错 capability
- 是否明显重复
- 是否应该找另一个 steward
- 是否存在权限问题
- 是否需要补充说明
```

Curator 可以修改 PR 里的 proposal metadata，但只改少数关键字段：

```
- target capability
- assigned steward
- proposed authority
- reason
```

---

## 6.2 Steward 在 PR 里 review

Steward 不需要进 Portal。

他在 PR 里看：

```
- Confluence link
- AI summary
- suggested scope
- duplicate candidates
- risks
- source preview
```

然后给 review decision。

建议用固定评论格式或 PR checkbox，而不是自由文本。

例如：

```
/steward-decision canonical
```

或：

```
Decision: Canonical
Scope: AWS Federated Landing Zone / Application onboarding
```

也可以 PR template 里有：

```
[ ] Canonical
[ ] Recommended
[ ] Reference
[ ] Reject
[ ] Wrong steward
[ ] Outdated
```

---

## 6.3 Steward decision 的含义

| Decision | 后续动作 |
| --- | --- |
| Canonical | 作为该 scope 的权威 source |
| Recommended | 推荐 source，但不是最终裁决 |
| Reference | 背景资料，低权威 |
| Reject | 不进入 Atlas |
| Wrong steward | Curator 重新分派 |
| Outdated | 不进入 Active，可考虑 deprecated |
| Duplicate | 与已有 source 合并或替代 |

---

## 6.4 如果出现 authority conflict

例如 AI 检测到已有 canonical source。

PR comment 显示：

```
Authority conflict detected:
Existing canonical source:
Legacy AWS Federated Onboarding Guide

New proposed source:
How to onboard an application to AWS Federated Landing Zone

Resolution required:
- replace existing canonical
- keep existing canonical, add new as recommended
- split scope
- reject new source
```

这时必须由 Capability Steward 或 Cloud Platform owner 明确处理，不能自动 merge。

---

# 7. PR Merge：进入 Active

## 7.1 Merge 前必须满足

```
- Confluence page resolved
- AI analysis completed
- Curator check completed
- Required steward decision exists
- No unresolved authority conflict
- Registry validation passed
```

---

## 7.2 Merge 后后台发生什么

PR merge 后：

```
1. Registry repo 更新 source record
2. Atlas backend reload / sync registry
3. Source 状态变成 Active
4. 保存 reviewed Confluence version
5. 保存 reviewed_at = merge / steward approval time
6. 保存 reviewed_by = steward
7. 保存 AI summary / source profile
8. 保存 authority scope
9. 保存 freshness policy
10. Source 进入 monitor list
```

---

## 7.3 Portal 如何展示

Portal 从 Atlas API 读取 Active SourceRecord。

在相关 capability / source area 展示：

```
How to onboard an application to AWS Federated Landing Zone

Canonical
Confluence
Reviewed by Landing Zone Steward on 2026-05-11
Confluence version reviewed: 14
Last updated in Confluence: 2026-05-05

Open in Confluence
Report issue
```

如果 Atlas 可以读取 preview，并且 source 非 restricted：

```
Preview from Confluence.
Open canonical source for full content.
```

如果 restricted：

```
This source may require Confluence access.
Open in Confluence or request access via Cloud Platform Support.
```

---

# 8. 持续维护：Changed / Stale / Broken

你接受 Health，但不是 Portal 页面。那 Health 应该这样做：

> **Source Health 是后台监测能力，结果通过 Portal warning + follow-up PR 表达。**

---

## 8.1 后台定期检查 Active Confluence source

检查项：

```
- page exists?
- Atlas service account can read?
- Confluence version changed?
- title changed?
- labels changed?
- parent changed?
- body fingerprint changed?
- key section changed?
- outgoing links changed?
- restrictions changed?
- review cycle expired?
```

---

## 8.2 Changed 怎么识别

Active 时保存：

```
- reviewed page id
- reviewed Confluence version
- reviewed title
- reviewed body fingerprint
- reviewed key section fingerprints
- reviewed outgoing links
- reviewed visibility state
- reviewed AI extraction
```

检查时对比当前状态。

机械判断：

```
version changed → changed
body fingerprint changed → content changed
key section fingerprint changed → important content changed
restriction changed → permission changed
page 404 → broken
page 403 → service access issue
today > next_review_due → stale
```

语义判断：

后台 AI 比较 reviewed snapshot 和 current page，生成：

```
- change summary
- severity
- suggested action
```

Severity：

```
Minor      typo / formatting
Moderate   explanation changed, low risk
Major      steps / policy / scope / support path changed
Critical   page deleted, unreadable, canonical conflict, key link broken
```

---

## 8.3 Health 结果如何表达

### Minor change

后台只记录，不开 PR。

Portal 不显示 warning。

---

### Moderate change

后台可以创建 follow-up PR，或者只记录为 pending review。

如果 V1 简化，可以不打扰 steward。

---

### Major change

后台自动创建 PR：

```
Review changed Confluence source: AWS Federated Landing Zone Onboarding
```

PR 内容：

```
This source changed since last steward review.

Reviewed version:
14

Current version:
16

AI change summary:
- Added ServiceNow approval step
- Removed email-based request path
- Updated TFE workspace naming convention

Suggested severity:
Major

Requested decision:
- confirm current version still valid
- keep warning
- downgrade authority
- deprecate source
- retire source
```

PR assign/review 请求给 Capability Steward。

Portal 同时显示 warning：

```
Changed since last review
```

---

### Critical issue

例如页面删除、Atlas 无法读取、canonical source 失效。

后台创建 PR + 可能通知 Curator。

Portal 显示强 warning：

```
Source currently unavailable
```

或：

```
Canonical source cannot be verified
```

---

### Stale

超过 review cycle 后，后台创建 PR：

```
Freshness review required: <source>
```

PR 里列出：

```
Last reviewed:
2026-01-10

Review policy:
90 days

Current Confluence version:
same / changed

Requested decision:
- still valid
- needs update
- downgrade
- deprecate
- retire
```

Portal 显示：

```
Review overdue
```

直到 PR merge 更新 reviewed_at。

---

# 9. 维护 PR 的处理方式

## 9.1 Confirm still valid

Steward 在 PR 里确认：

```
Current Confluence version remains valid.
```

Merge 后：

```
- reviewed_version 更新为 current version
- reviewed_at 更新
- warning 清除
```

---

## 9.2 Needs update

如果 steward 认为 source 内容需要更新：

```
- PR 不直接修 Confluence
- Source 保持 warning
- Source Author / owner 去 Confluence 更新正文
- 后台下一次检测到新 version
- 再开 review PR 或更新当前 PR
```

这里体现边界：Atlas 不管理 Confluence 内容。

---

## 9.3 Deprecated

Merge 后：

```
- source status = Deprecated
- Portal 显示 deprecated badge
- 如果有 replacement，展示 replacement
```

---

## 9.4 Retired

Merge 后：

```
- source status = Retired
- 普通 Portal 页面不再展示
- 保留审计记录
```

---

# 10. 权限问题：Confluence 怎么处理

## 10.1 Atlas service account 权限

后台 resolver 如果读 Confluence 时：

```
200 → readable
403 / 401 → service blocked
404 → missing or no access
```

如果 service account 读不到：

```
- PR comment 标记无法读取
- AI profiling 无法完整生成
- source 不能作为 previewable source
- 可以作为 metadata-only source，但必须有 warning
```

---

## 10.2 用户个人打不开

V1 不做强 per-user permission。

Portal 展示保守文案：

```
This source may require Confluence access.
If you cannot open it, request access via Cloud Platform Support.
```

如果后台可以读取 Confluence restriction metadata，则显示：

```
Restricted source
Access may be limited to specific groups.
```

不承诺：

```
You have access
```

除非未来做 delegated Confluence permission check。

---

# 11. PR under the hood 的状态模型

每个 SourceRecord 的状态可以和 PR 生命周期绑定。

## 新增 source

```
Intake Submitted
→ PR Created
→ Analysis Running
→ Analysis Completed
→ Steward Review Requested
→ Approved
→ Merged
→ Active
```

## 维护 source

```
Active
→ Changed Detected
→ Review PR Created
→ Steward Confirmed
→ Merged
→ Active / Stale / Deprecated / Retired
```

---

# 12. 各角色在每个阶段的任务矩阵

| 阶段 | Source Author | Source Curator | Capability Steward | Backend Service | Registry PR | Portal |
| --- | --- | --- | --- | --- | --- | --- |
| Confluence 内容创建 | 写内容 | 无 | 无 | 无 | 无 | 无 |
| Intake | 无 | 在 Portal 提交 URL | 无 | 创建 PR | 初始 proposal | Source Intake |
| 分析 | 无 | 等待 / 查看 PR | 无 | 解析 Confluence + AI profiling | 写分析 comment | 显示 PR link |
| 初筛 | 无 | 判断是否继续 | 无 | 辅助 duplicate/risk | Curator comment / edit | 无 |
| Steward review | 无 | @ steward / 协调 | 确认 authority/scope | 检查决策格式 | review / approve | 无 |
| Merge | 无 | 合并或推动合并 | approval 已完成 | 同步 registry | merged | 后续展示 |
| Active 展示 | 无 | 无 | 无 | 提供 API / context | source record | 展示 source |
| Monitoring | 无 | 无 | 无 | 检查 version/health/stale | 无或自动 PR | 显示 warning |
| Changed review | 可能被要求更新 Confluence | 查看自动 PR | 确认仍有效/废弃 | 生成 change summary | review PR | warning |
| Deprecate/Retire | 可能处理原文档 | 协调 | 决策 | 更新状态 | PR merge | 更新展示 |

---

# 13. 这个方案的产品定义

可以写成：

> **Atlas Source Management uses Portal only as the intake entry point. The source governance workflow is PR-backed: every new source, authority decision, freshness review, and lifecycle change is captured as a registry PR with automated Confluence analysis and AI-generated review context.**

中文：

> **Atlas 的 Source Management 只把 Portal 作为新增 source 的入口。真正的治理流程由 PR 承载：新增、权威确认、freshness review、变更复核、废弃和退休都通过 registry PR 记录，并由后台服务自动读取 Confluence、生成 AI 分析、请求 steward review。**

---

# 14. 最终边界

## 做

```
- Portal Source Intake
- PR-backed source proposal
- Confluence resolver
- AI source profiling
- AI change summary
- Steward PR review
- PR merge → Active
- Background health monitoring
- Follow-up PR for changed / stale / broken
- Portal source display with warning
```

## 不做

```
- Portal admin console
- Portal health queue
- Portal steward review page
- Manual registry editor
- CMS authoring
- Source content editing
- Per-user Confluence permission guarantee
- Ask Atlas
```

这个版本是目前最稳的：  
**Portal 有入口，但不承载治理后台；PR 有审计和 review；后台做自动化；steward 只做必要决策；Source Author 不增加负担。**