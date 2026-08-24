# Atlas 核心用户体验与产品数据模型设计

**状态：** UX shaping draft
**日期：** 2026-08-24
**范围：** Atlas 面向应用团队成员的核心终端体验，包括全局入口、Application Workbench、Onboarding、Infrastructure Change、Promote、Diagnosis，以及支撑这些体验的数据模型和实现方向。
**不包含：** Platform Support Member 工作台、管理层专属 Dashboard、通用 Workflow Builder、完整 Cloud Console、通用 Observability、Atlas 内审批。

---

# 1. 文档结论摘要

## 1.1 产品信息架构

Atlas 使用两层信息架构：

### 全局层

```text
Home
Onboard
Catalog
```

### Application Workbench

```text
Overview
Tasks
Architecture
```

其中不再设置：

```text
Release
Activity
Details
Access
Tickets
Cost
Settings
Scaffold
Debug
Support
```

作为默认一级 sidebar 页面。

这些内容并没有被删除，而是回到与用户任务相关的上下文中：

| 原内容                  | 新位置                                                                     |
| -------------------- | ----------------------------------------------------------------------- |
| Deployment / Release | Overview 摘要、Promote Journey、Deployment detail                           |
| Activity             | Overview 最近变化、Tasks 历史、各次 operation timeline                            |
| Application details  | Application header 的 About panel                                        |
| Access               | Onboarding step、Task item、具体阻塞现场                                        |
| Tickets              | Journey、Diagnosis、Support handoff                                       |
| Cost                 | Overview signal、Infrastructure Change Review、Promote Review             |
| Support              | 当前 step、失败对象和当前上下文                                                      |
| Scaffolder           | 用户侧命名为 `Add capability`、`Change infrastructure`、`Infrastructure change` |
| Debug                | 用户侧命名为 `Diagnose`，从具体失败或已知 Application symptom 进入                       |

## 1.2 Application Workbench Sidebar

Application Workbench 的稳定 sidebar 调整为：

```text
Overview
Tasks
Architecture
```

### 第二项命名：Tasks

建议使用：

> **Tasks**

不再使用 `Work`。

`Work` 过于抽象，用户无法预判页面中会看到什么；`Activity` 更像历史记录；`Operations` 容易被理解为生产运维；`Processes` 偏企业流程和审批；`Journeys` 又无法覆盖 Infrastructure Change、Promotion、Diagnosis 和独立 Action。

`Tasks` 虽然不是对底层对象最严格的领域定义，但它对用户最容易识别：

> 与当前 Application 相关、可以继续、Review、观察或处理的事情。

Atlas 原有 Experience Contract 已将 `Task` 定义为“用户希望完成的目标”，因此这一名称与产品语言是兼容的。

这里的 `Tasks` 是一个**用户侧导航概念和读取投影**，不要求底层所有对象继承同一个 Task 数据模型。

页面可以聚合：

```text
Onboarding Journey
Promotion Journey
Infrastructure Change
Diagnosis Case
Access Request
Delegated Operation
Manual Review
```

每一项通过类型标签说明来源：

```text
[JOURNEY]        AWSF application onboarding
[PROMOTION]      Promote v2.4.1 to UAT
[CHANGE]         Add PostgreSQL capability
[INVESTIGATION]  Diagnose deployment #1428
[REQUEST]        AWSF deployment access
```

### 页面标题与说明

```text
Tasks

Things to continue, review, monitor or resolve for this application.
```

页面按照用户当前与任务的关系组织，而不是按照底层对象类型组织：

```text
Needs you
Running
Waiting
Recently completed
```

示例：

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Tasks                                             All types ▾        │
│ Things to continue, review, monitor or resolve.                      │
│                                                                      │
│ NEEDS YOU · 2                                                        │
│ [CHANGE] Add PostgreSQL capability                                   │
│ Proposed architecture is ready for review.              [ Review ]  │
│                                                                      │
│ [JOURNEY] AWSF application onboarding                                │
│ Runtime configuration requires two values.              [ Continue ]│
│                                                                      │
│ RUNNING                                                              │
│ [PROMOTION] Promote v2.4.1 to UAT                                    │
│ Readiness checks are running.                           [ Open ]     │
│                                                                      │
│ WAITING                                                              │
│ [REQUEST] AWSF deployment access                                     │
│ Waiting for Identity Platform · REQ-4821                 [ View ]    │
│                                                                      │
│ RECENTLY COMPLETED                                                   │
│ [CHANGE] Add S3 backup capability · Verified by TFE                  │
└──────────────────────────────────────────────────────────────────────┘
```

Sidebar label需要优化的是**识别速度**，而不是精确复述内部数据结构。Atlas 的底层 `JourneyRun`、`InfrastructureChangeRun`、`PromotionRun` 和 `DiagnosisCase` 仍然独立建模，只投影到统一的 Tasks 页面。

## 1.3 Application 顶栏提供 `Start`

Application Workbench 提供一个直接、稳定、上下文相关的启动入口。

在 Application 顶栏右侧提供：

```text
[ Start ▾ ]
```

它不放在 sidebar，也不成为独立页面。Start Launcher 根据 Application Context 筛选事项，默认显示 2–4 个推荐结果、少量其他可用结果和搜索入口。

具体页面中的上下文 CTA 仍然保留：

```text
Architecture → Add capability
Environment version → Promote
Failed deployment → Diagnose
Journey step → Request access
```

## 1.4 核心产品边界

Atlas 是一个 application-centric、multi-cloud Developer Experience Platform。它拥有体验、指导、状态、证据和跨系统衔接；底层平台继续拥有执行、审批、授权和领域事实。

这意味着：

```text
Atlas 负责：
Intent
Context
Guidance
Validation
Delegated trigger
Tracking
Evidence
Diagnosis
Support handoff

Source systems 负责：
Execution
Authorization
Approval
Domain truth
Actual cloud and SDLC state
```

Atlas 不替代 SailPoint、ServiceNow、TFE、Harness、云控制台和 Observability 平台。它解决的是用户必须亲自理解和拼接这些系统的问题。

---

# 2. 产品目标与价值主张

## 2.1 核心用户

唯一核心用户是：

> 负责将应用接入、建设和维护在云平台上的应用团队成员。

他可能是 Developer、Tech Lead 或 Application Owner，但 Atlas 不为三者设计三套独立 persona。

他可能：

* 没有 App Code；
* 没有 repository；
* 没有 deployable artifact；
* 不熟悉云平台；
* 不熟悉 Terraform；
* 已经有应用，需要增加或修改资源；
* 需要 Promote version；
* 日常确认应用状态；
* 正在处理一个具体错误。

## 2.2 用户真正来 Atlas 的原因

Atlas 的设计应从用户意图开始，而不是从 Atlas 连接了什么系统开始。现有产品定义已经将主要意图归纳为理解、观察、决定、行动、完成和恢复。

在实际界面中，可以进一步收敛成四种用户动机：

| 用户动机           | 用户心里的问题                                           |
| -------------- | ------------------------------------------------- |
| **Understand** | 我的应用现在是什么情况？                                      |
| **Complete**   | 我怎样完成 Onboarding、Promote 或 Infrastructure Change？ |
| **Recover**    | 为什么失败？下一步怎么办？                                     |
| **Find**       | 正确的信息、参数、平台能力和支持在哪里？                              |

## 2.3 对用户的价值

Atlas 的价值不在于将多个链接放在同一个页面，而在于减少以下成本：

| 用户成本   | Atlas 提供的改善                                |
| ------ | ------------------------------------------ |
| 发现成本   | 告诉用户去哪里、使用哪个流程、找哪个团队                       |
| 判断成本   | 自动填值、推荐值、解释影响和命名规则                         |
| 协调成本   | 管理跨系统依赖、责任方、等待和 handoff                    |
| 输入成本   | 避免重复输入 Application、Environment、Account 等信息 |
| 切换成本   | 在可行时直接提交，否则带着预填数据进入外部系统                    |
| 等待不确定性 | 显示当前卡在哪里、谁负责、最后更新时间                        |
| 恢复成本   | 自动聚合失败上下文，给出证据和下一步                         |
| 验证成本   | 用真实 evidence 证明结果是否完成                      |

Atlas 的关键体验不是：

> “所有系统都能从这里打开。”

而是：

> “我不需要理解所有组织和工具边界，也能完成结果。”

这也是现有战略定义的最终目标。

## 2.4 对管理层的价值

管理层初期不需要一个新的管理驾驶舱。

最容易理解 Atlas 价值的证明是：

```text
一个真实 Application Team
        ↓
从零或已有 Application context 开始
        ↓
跨多个已有平台完成 Onboarding
        ↓
中途出现真实失败
        ↓
Atlas 定位问题并提供恢复路径
        ↓
完成第一次成功 DEV Deployment
        ↓
留下可验证 Evidence
```

现有战略也将“真实团队通过 Atlas 完成 AWSF Onboarding 和第一次成功 DEV Deployment”定义为首个 proof point。

管理层得到的是：

* 受治理的 Golden Path；
* 跨系统状态透明度；
* 责任与阻塞可见性；
* 标准化的平台消费方式；
* 可测量的 onboarding 和 diagnosis 效率；
* 不重建底层执行平台的较低实施成本。

---

# 3. UX 核心原则

## 3.1 Application 是上下文，不是所有体验的唯一入口

进入 Application 后，所有页面都继承：

```text
Application
Environment
Identity
Team
Permissions
Related platform context
```

但 Onboarding 可以在 canonical Application 创建之前开始。

Catalog 也可以在没有 Application context 时浏览。

## 3.2 稳定导航与动态工作分离

Sidebar 表达长期稳定的工作空间：

```text
Overview
Tasks
Architecture
```

动态任务不成为永久 sidebar item。

例如：

```text
Continue AWSF onboarding
Review PostgreSQL change
Promote v2.4.1 to UAT
Diagnose deployment #1428
```

这些都出现在 Overview、Tasks 或相关对象中。

## 3.3 操作入口必须与上下文绑定

不设置：

```text
Generic Debug
Generic Promote
Generic Add resource
```

而是：

```text
Promote v2.4.1 from DEV to UAT
Add a database capability to payments-api
Change ECS scaling in DEV
Diagnose deployment #1428
Investigate why DEV is not reachable
```

## 3.4 直接开始新事务的入口

仅依赖 Overview、Architecture、Environment 或已有错误对象中的间接入口，会产生一个明显问题：

> 用户知道自己要做一件新事情，但不知道应该先进入哪个页面。

因此，Application Workbench 需要一个直接、稳定、上下文相关的启动入口。

### 入口位置

在 Application 顶栏右侧提供：

```text
[ Start ▾ ]
```

它不放在 sidebar，也不成为独立页面。

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Atlas   Ask about payments-api...    payments-api ▾  DEV ▾ [ Start ]│
└──────────────────────────────────────────────────────────────────────┘
```

`Start` 比以下名称更合适：

* `New`：容易被理解为创建新资源；
* `Create`：无法覆盖 Promote 和 Diagnose；
* `Action`：过于产品内部化；
* `Start a task`：文案较重；
* `Quick Start`：更像某种产品模块。

### Start Launcher

点击后打开轻量 launcher：

```text
┌─────────────────────────────────────────────────────────────┐
│ Start for payments-api                                   ×  │
│                                                             │
│ What do you want to achieve?                                │
│ [ Search available journeys and actions...               ]  │
│                                                             │
│ RECOMMENDED                                                 │
│                                                             │
│ Promote v2.4.1 to UAT                                       │
│ A newer verified version is available in DEV.               │
│ Promotion                                             →     │
│                                                             │
│ Add a PostgreSQL database                                   │
│ Recommended for the current ECS architecture.               │
│ Infrastructure change                                 →     │
│                                                             │
│ Start production readiness                                  │
│ Prepare payments-api for the PROD environment.              │
│ Journey                                               →     │
│                                                             │
│ MORE AVAILABLE                                              │
│ Request access                                              │
│ Change infrastructure                                       │
│ Validate runtime configuration                              │
│ Investigate a problem                                       │
└─────────────────────────────────────────────────────────────┘
```

### Launcher 的设计规则

1. **使用用户结果语言**

   显示：

   ```text
   Add a PostgreSQL database
   Promote v2.4.1 to UAT
   Request deployment access
   Investigate a problem
   ```

   不显示：

   ```text
   Start InfrastructureChangeRun
   Launch Scaffolder
   Create RDS resource
   Execute Harness workflow
   ```

2. **根据 Application Context 筛选**

   Atlas 只展示当前 Application 实际适用的事项：

   * 当前 cloud 和 workload 支持；
   * 当前用户有权限查看或发起；
   * prerequisites 已满足，或能够解释缺失项；
   * 当前没有冲突的同类 operation；
   * 有合理的 environment 或 version context。

3. **提供推荐原因**

   例如：

   ```text
   Recommended because DEV has v2.4.1 and UAT is still running v2.4.0.
   ```

4. **不退化为模板目录**

   Start Launcher 应保持较短，默认只显示：

   * 2–4 个推荐结果；
   * 少量其他可用结果；
   * 搜索入口。

   完整 capability 和文档发现仍然属于 Catalog。

5. **上下文入口仍然保留**

   Header `Start` 解决可发现性；具体页面中的 CTA 提供更精准的上下文：

   ```text
   Architecture → Add capability
   Environment version → Promote
   Failed deployment → Diagnose
   Journey step → Request access
   ```

Atlas 的设计应从用户任务而不是产品入口开始，Task Center 和 Quick Start 也应完成 `Intent → Context → Recommended choice → Minimal inputs → Action → Result`，而不是展示表单目录。

### 实现投影

Start Launcher 使用独立的 read projection，而不是创建万能领域模型：

```text
LaunchableItemProjection
├── Source type
├── Source definition ID
├── User-facing title
├── User-facing description
├── Application context
├── Environment context
├── Eligibility
├── Unavailable reason
├── Recommendation reason
├── Priority
└── Entry route
```

其来源可以分别是：

```text
JourneyDefinition
CapabilityDefinition
GovernedActionDefinition
PromotionEligibility
DiagnosisEntryDefinition
```

## 3.5 最少提问

Atlas 按以下优先级获取参数：

```text
1. 从已知 Application context 获取
2. 从可信 source system 获取
3. 使用平台治理默认值
4. 生成推荐值
5. 最后才询问用户
```

用户只决定 Atlas 无法安全推断的事项。

## 3.6 状态必须诚实

Atlas 必须区分：

* 已观察到的事实；
* 根据多个事实推导出的状态；
* 用户主动确认；
* Atlas 自己拥有的选择；
* 当前未知或数据过期。

现有产品定义已经规定 `Observed / Derived / Declared / Atlas-owned / Unknown` 等状态来源，并要求 Done 原则上关联 Evidence。

## 3.7 Delegated execution

Atlas 可以准备、触发和追踪操作，但不应让用户误以为 Atlas 自己拥有底层执行。

例如：

```text
Atlas prepared the request
SailPoint owns authorization

Atlas triggered the deployment
Harness owns deployment execution

Atlas generated the proposed IaC
TFE owns plan and apply
```

现有职责边界也明确将 Provision、Deploy、Access、Approval 和 Operate 的实际执行保留给相应平台。

---

# 4. 全局信息架构

## 4.1 全局 Shell

### 用户为什么来到这里

用户进入 Atlas，首先需要：

* 回到自己的工作；
* Onboard 新应用；
* 查找平台能力、文档或支持；
* 进入某个 Application。

### Atlas 需要提供

```text
Home
Onboard
Catalog
Global search / Ask
Identity and profile
```

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Atlas        Home        Onboard        Catalog          Search / Ask    User │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         Current global destination                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

`Home / Onboard / Catalog` 是全局目的地，不进入 Application sidebar。

---

## 4.2 Application Workbench Shell

### 用户为什么来到这里

用户已经进入某个 Application，需要持续在该上下文下查看状态、继续工作或修改架构。

### Atlas 需要提供

* Application selector；
* Environment selector；
* Contextual Ask；
* Application verdict；
* 稳定 sidebar；
* About 和 contextual help；
* 当前数据 freshness。

### Sidebar

```text
Overview
Tasks
Architecture
```

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Atlas   Ask about payments-api... payments-api ▾ All environments ▾ [ Start ]│
├───────────────────┬──────────────────────────────────────────────────────────┤
│ payments-api      │                                                          │
│ Action required   │                                                          │
│                   │                                                          │
│ Overview          │                   Current page                           │
│ Tasks          3  │                                                          │
│ Architecture      │                                                          │
│                   │                                                          │
│                   │                                                          │
│                   │                                                          │
│                   │                                                          │
│ APP-4821          │                                                          │
└───────────────────┴──────────────────────────────────────────────────────────┘
```

Sidebar 不包含：

```text
About
Support
Settings
```

About 由顶栏 Application 名称或信息图标打开。

Help 由当前页面、当前 step 或错误对象提供。

---

## 4.3 Focused Workspace Shell

Onboarding、Promotion、Infrastructure Change 和完整 Diagnosis 都是需要持续专注的任务。

进入这些任务时，Application sidebar 被替换成场景自己的导航。

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Atlas   payments-api   Promote v2.4.1 to UAT                    Exit work    │
├───────────────────────┬──────────────────────────────────────────────────────┤
│ Version & target      │                                                      │
│ Compare               │                                                      │
│ Readiness             │              Current focused step                    │
│ Review                │                                                      │
│ Execute               │                                                      │
│ Validate              │                                                      │
│                       │                                                      │
└───────────────────────┴──────────────────────────────────────────────────────┘
```

不同时显示：

```text
Application sidebar
+
Journey step sidebar
```

避免两套导航争夺注意力。

---

# 5. Home UX

## 5.1 用户为什么来到这里

用户想知道：

* 哪些 Application 需要自己处理；
* 是否有工作可以继续；
* 自己有哪些 Application；
* 是否需要进入某个 Application。

## 5.2 用户此刻要完成什么

Home 不用于完成复杂操作。

它只用于：

```text
跨 Application 分诊
→ 选择正确 Application
→ 进入具体工作
```

## 5.3 用户不知道什么、被什么阻塞

用户可能不知道：

* 哪个 Application 出了问题；
* 哪项工作在等自己；
* 自己是否被正确映射到 Application；
* 某个状态是否只是外部等待；
* 哪个 Application 应该优先进入。

## 5.4 Atlas 提供什么

对于不同身份解析结果：

### 没有解析到 Application

不能直接断言用户没有 Application。

Atlas 应显示：

* 当前没有 Application 与该身份关联；
* 查找已有 Application；
* Onboard 新 Application；
* 报告身份或映射问题。

### 一个 Application

直接进入该 Application 的 Overview。

### 多个 Application

显示跨 Application 分诊台：

* Needs your attention；
* Work in progress；
* Waiting；
* Application list。

## 5.5 多 Application ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Atlas        Home        Onboard        Catalog          Search / Ask    User │
├──────────────────────────────────────────────────────────────────────────────┤
│ Hi, Ziyu                                                                  │
│ 4 applications · 2 require your attention                                  │
│                                                                              │
│ NEEDS YOUR ATTENTION                                                         │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ payments-api · DEV deployment failed                                    │ │
│ │ Deployment #1428 · 18 minutes ago                         [ Diagnose ]   │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ ledger-api · Runtime configuration requires input                       │ │
│ │ AWSF onboarding · Step 6 of 9                             [ Continue ]   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ IN PROGRESS / WAITING                                                        │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ inventory-api · Access request                                          │ │
│ │ Waiting for Identity Platform · REQ-4821 · Last checked 6 min ago       │ │
│ │                                                               [ View ] │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ MY APPLICATIONS                                                              │
│ payments-api       Action required      DEV / UAT / PROD                    │
│ ledger-api         Action required      Onboarding                          │
│ inventory-api      Waiting              DEV                                 │
│ report-service     No action required   DEV / PROD                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 5.6 零 Application ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ No applications are linked to your profile                                  │
│                                                                              │
│ This may mean:                                                               │
│ · You are onboarding your first application                                 │
│ · An existing application has not been mapped to your identity              │
│ · You need access to another team's application                             │
│                                                                              │
│ [ Onboard an application ]   [ Find an existing application ]                │
│ [ Report an identity mapping issue ]                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 6. Catalog UX

Catalog 不是当前文档的核心工作流，但它承担 Atlas 的 Discover / Understand 能力。

## 6.1 用户为什么来到这里

用户需要：

* 找到平台能力；
* 阅读权威文档；
* 了解某项能力是否支持自己的 cloud、region 或 workload；
* 找到正确 support route；
* 理解平台变化。

## 6.2 用户此刻要完成什么

```text
表达需求
→ 找到正确 capability 或指导
→ 理解适用条件
→ 返回具体 Application context
```

## 6.3 用户不知道什么

* 不知道平台产品名称；
* 不知道某个业务目标对应哪个技术资源；
* 不知道文档是否权威或过期；
* 不知道是否适用于当前 Application；
* 不知道该找哪个团队。

## 6.4 Atlas 提供什么

* Intent-based search；
* Capability mapping；
* 官方文档和来源；
* Availability；
* Known limitations；
* Application relevance；
* Support route；
* 相关 Journey 和 Architecture action 入口。

## 6.5 ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Catalog                                                                      │
│                                                                              │
│ What are you trying to achieve?                                              │
│ [ Add a database, expose a service, deploy to AWSF...                  ]     │
│                                                                              │
│ COMMON OUTCOMES                                                              │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐   │
│ │ Add a database       │ │ Expose a service     │ │ Store application    │   │
│ │ PostgreSQL / Aurora  │ │ Load balancing       │ │ secrets              │   │
│ │ AWSF · ECS           │ │ AWSF · ECS           │ │ Vault / AWS          │   │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘   │
│                                                                              │
│ AUTHORITATIVE GUIDANCE                                                       │
│ Runtime configuration guide          Platform Engineering · Updated 3d ago  │
│ AWSF onboarding runbook              DevEx · Updated 1w ago                  │
│ ECS supported regions                AWSF · Updated 2d ago                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Catalog 只帮助用户理解和定位，不应变成第二个 Scaffolder Catalog。

---

# 7. Application Overview UX

## 7.1 页面定位

Sidebar 中仍使用：

> **Overview**

产品和设计文档中可以将其描述为：

> **Application Dashboard**

`Dashboard` 描述的是页面的展示形态；`Overview` 是更合适的导航名称，因为页面不仅展示 metrics，也包含用户行动、Tasks、状态和上下文入口。

Overview 需要同时回答三个问题：

```text
1. Application 当前是否健康？
2. 当前是否需要用户行动？
3. 最近发生了什么，接下来可以做什么？
```

它不是纯文字状态列表，也不是把所有 Application 数据平铺成企业全景大屏。

统一视图的原则仍然是：展示当前判断所需的上下文，而不是把 Cost、Resources、Tickets、Logs 和全部历史都塞到同一页。

## 7.2 信息层级

Overview 使用四层信息层级。

### 第一层：Application Context 和直接行动

始终可见：

```text
Application
Environment
Time range
Data freshness
Start
```

```text
payments-api     All environments ▾     Last 24 hours ▾
Updated 3 minutes ago                                  [ Start ▾ ]
```

### 第二层：健康与用户行动

第一视区只回答：

* Application 是否健康；
* 哪些 environment 有问题；
* 是否需要当前用户处理；
* 最重要的 primary action 是什么。

### 第三层：运行趋势与正在进行的工作

展示：

* health metrics；
* environment/version；
* deployment；
* active Tasks；
* waiting operation。

### 第四层：辅助判断信息

展示较轻量的：

* cost；
* log signal；
* architecture summary；
* recent changes。

它们不与健康裁决和用户行动使用同等视觉重量。

---

## 7.3 Overview ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Overview                                                                    │
│ payments-api    All environments ▾    Last 24 hours ▾    [ Start ▾ ]       │
│ Sources updated 3 minutes ago                                               │
│                                                                              │
│ ┌─ HEALTH & TRAFFIC ────────────────────────────┬─ NEEDS YOUR ATTENTION ───┐ │
│ │                                               │                           │ │
│ │  DEGRADED                                     │ 2 items                   │ │
│ │  DEV has an elevated error rate               │                           │ │
│ │                                               │ ● DEV deployment failed  │ │
│ │  DEV ● Degraded   UAT ● Healthy               │   #1428 · 18 min ago     │ │
│ │  PROD ● Healthy                               │             [ Diagnose ] │ │
│ │                                               │                           │ │
│ │  Error rate        1.84%                      │ ● Runtime config missing │ │
│ │  0%   ▁▁▂▂▃▆█▅▃▂                threshold ┄  │   2 required values      │ │
│ │                                               │             [ Continue ] │ │
│ │  P95 latency       428 ms                     │                           │ │
│ │  0    ▁▂▂▃▂▅█▆▃▂                               │ [ View all tasks ]        │ │
│ │                                               │                           │ │
│ │  Availability      99.91%                     │                           │ │
│ │       99.99 ─────────╲─────                    │                           │ │
│ └───────────────────────────────────────────────┴───────────────────────────┘ │
│                                                                              │
│ ┌─ ENVIRONMENTS & DEPLOYMENTS ──────────────────┬─ ACTIVE TASKS ───────────┐ │
│ │                                               │                           │ │
│ │  DEV              UAT              PROD       │ AWSF onboarding           │ │
│ │  v2.4.1           v2.4.0           v2.3.9     │ Step 6 of 9               │ │
│ │  Failed           Healthy          Healthy    │ ██████░░░ 67%             │ │
│ │     │                 │                │       │             [ Continue ] │ │
│ │     └──── newer ──────┘                │       │                           │ │
│ │                       └── version drift┘       │ Promote v2.4.1 to UAT    │ │
│ │                                               │ 5 of 6 gates passed      │ │
│ │  Deployment success · Last 7 days             │                 [ Open ] │ │
│ │  Mon  Tue  Wed  Thu  Fri  Sat  Sun             │                           │ │
│ │   8    7    9    6    4    8    5             │ Access request           │ │
│ │  ███  ███  ███  ██   ██   ███  ██             │ Waiting for platform     │ │
│ │              × 1 failed                       │                 [ View ] │ │
│ │                                               │                           │ │
│ │  Latest deployment #1428 · DEV · Failed       │ [ View all tasks ]       │ │
│ └───────────────────────────────────────────────┴───────────────────────────┘ │
│                                                                              │
│ ┌─ COST ───────────────────┬─ LOG SIGNALS ─────────────┬─ ARCHITECTURE ─────┐ │
│ │                          │                            │                     │ │
│ │ $2,420                   │ 27 error events           │ Internet            │ │
│ │ Estimated this month     │ Last 60 minutes           │    │                │ │
│ │                          │                            │   ALB               │ │
│ │ ▁▂▂▃▄▅▅▆                 │ ▁▁▂▃▇█▅▂                   │    │                │ │
│ │ +7% from last month      │                            │   ECS ── Secrets    │ │
│ │                          │ Top error signature       │    └── Logs         │ │
│ │ No anomaly detected      │ Missing secret reference │                     │ │
│ │ [ View cost source ]     │ [ Open related logs ]    │ 7 managed resources │ │
│ │                          │                            │ [ Open architecture]│ │
│ └──────────────────────────┴────────────────────────────┴─────────────────────┘ │
│                                                                              │
│ RECENT CHANGES                                                               │
│ 10:42  Deployment #1428 failed in DEV                                       │
│ 09:15  SailPoint request REQ-4821 moved to In progress                      │
│ Yesterday  Runtime configuration changed                                    │
│                                                         [ View more ]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 7.4 不同信息使用不同视觉形式

Overview 不应把所有内容表现为同样大小的文字卡片。

| 信息类型                  | 推荐形式                                    |
| --------------------- | --------------------------------------- |
| Application health    | 大型状态、tone、简短 verdict                    |
| Environment health    | 横向状态 rail / dots                        |
| Error、latency、traffic | 数值 + sparkline / line chart             |
| Availability          | 数值 + threshold line                     |
| Deployment success    | 小型柱状图或成功/失败分布                           |
| Journey / Promotion   | progress bar + step count               |
| Needs attention       | 紧凑 action list                          |
| Cost                  | 当前值 + delta + mini trend                |
| Logs                  | error event trend + top error signature |
| Architecture          | 小型静态拓扑摘要                                |
| Recent changes        | 时间线                                     |
| Source freshness      | 轻量 provenance text / chip               |

### Logs 的展示边界

Overview 不展示完整原始日志流。

Atlas 只显示：

```text
Error event count
Trend
Top error signatures
Affected environment
Relevant failed run
```

然后提供：

```text
Open related logs
Diagnose
```

Atlas 可以聚合日志和运行状态用于判断和诊断，但不替代 Observability 平台。底层平台继续拥有执行和领域事实，Atlas 拥有上下文、体验、状态和证据。

---

## 7.5 防止信息淹没的规则

### 规则一：首屏只突出两个决策

第一视区只突出：

```text
Health
Needs your attention
```

Cost、Architecture、Logs 和 Recent Changes 使用较低视觉权重。

### 规则二：按异常程度动态调整

健康状态下：

* Health 区压缩；
* Needs Attention 区不存在；
* Environment、Tasks 和 Trends 上移；
* 不保留空白 warning 卡。

异常状态下：

* Health 和 Needs Attention 扩大；
* Cost、Architecture 等次级信息下移。

### 规则三：限制列表长度

默认最多展示：

```text
Needs attention        3
Active Tasks           3
Recent changes         4
Top log signatures     2
```

其余通过 `View all` 展开。

### 规则四：摘要与详情分离

Overview 只显示：

```text
判断所需摘要
+
明确入口
```

完整内容进入：

```text
Tasks
Architecture
Promotion workspace
Diagnosis workspace
Source system
```

### 规则五：不重复展示同一件事

如果 deployment failure 已经作为最高优先级 `Needs Attention`：

* Health 区只表达其对 Application 的影响；
* Active Tasks 不再复制一张相同失败卡；
* Recent Changes 只保留一行时间事件。

### 规则六：图表必须有决策价值

不展示：

* 没有真实时间序列的假 sparkline；
* 没有 threshold 或比较基准的孤立数字；
* 无法解释来源的 health score；
* 仅为填充空间的 donut chart；
* 无明确意义的总资源数。

Workbench 默认内容必须能够帮助用户做决定、执行下一步、理解失败、找到责任人或验证结果，否则不进入 Overview。

---

## 7.6 Overview Read Model 调整

`ApplicationOverviewProjection` 扩展为：

```text
ApplicationOverviewProjection
├── Application context
├── Environment filter
├── Time range
├── Freshness summary
│
├── Verdict
│   ├── Actionability
│   ├── Technical health
│   ├── Primary explanation
│   └── Primary action
│
├── Environment health[]
├── Metric series[]
│   ├── Error rate
│   ├── Latency
│   ├── Traffic
│   └── Availability
│
├── Attention items[]
├── Active task summaries[]
├── Deployment summary
├── Cost signal
├── Log signal
├── Architecture summary
└── Recent significant changes[]
```

其中：

```text
Metric series
Cost signal
Log signal
```

必须包含：

```text
Source
Retrieved at
Time range
Unit
Threshold or comparison baseline
Freshness
```

Overview Projection 只负责组合适合展示的读取数据，不成为任何底层领域事实的 System of Record。

---

# 8. Application Tasks UX

## 8.1 页面命名

Sidebar：

```text
Tasks
```

页面标题：

```text
Tasks
```

辅助说明：

```text
Things to continue, review, monitor or resolve for this application.
```

## 8.2 用户为什么来到这里

用户需要：

* 找到当前 Application 正在进行的所有任务；
* 继续某项 Journey；
* Review 某个 Infrastructure Change；
* 查看 Promotion；
* 查看正在等待平台处理的事项；
* 回看最近完成的结果。

## 8.3 用户此刻要完成什么

```text
找到正确任务
→ 理解当前状态与责任方
→ 继续、Review、Diagnose 或查看结果
```

Tasks 页面聚合已有任务。启动新事务由顶栏 `Start` 和上下文 CTA 负责。

## 8.4 用户不知道什么、被什么阻塞

用户可能不知道：

* 哪项工作需要自己处理；
* 哪项工作仍在平台运行；
* 哪项工作在等待外部团队；
* 某个 Journey 和某个失败是否属于同一个工作；
* 某个操作最终是否真的完成；
* 该从哪里继续。

## 8.5 Atlas 提供什么

Tasks 按用户与任务的关系分组，而不是按领域对象类型分组：

```text
Needs you
Running
Waiting
Recently completed
```

可提供次级筛选：

```text
All
Onboarding
Infrastructure
Promotion
Diagnosis
```

这些类型只作为筛选，不作为一级 IA。

## 8.6 ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Tasks                                                   [ All types ▾ ]      │
│ Things to continue, review, monitor or resolve.                             │
│                                                                              │
│ NEEDS YOU · 2                                                                │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Review PostgreSQL capability change                                    │ │
│ │ Infrastructure change · DEV                                             │ │
│ │ Proposed architecture is ready · Cost estimate available                │ │
│ │ Updated 12 minutes ago                                    [ Review ]    │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ Provide runtime configuration                                           │ │
│ │ AWSF onboarding · Step 6 of 9                                           │ │
│ │ Two values cannot be safely inferred                     [ Continue ]   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ RUNNING                                                                      │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Promote v2.4.1 from DEV to UAT                                          │ │
│ │ Readiness · 5 of 6 gates passed                                         │ │
│ │ Current responsibility: Application Team                 [ Open ]       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ WAITING                                                                      │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ AWSF deployment access                                                  │ │
│ │ Responsible team: Identity Platform                                     │ │
│ │ SailPoint request REQ-4821 · Waiting 2 days · Checked 6 min ago         │ │
│ │                                                               [ View ] │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ RECENTLY COMPLETED                                                           │
│ Add S3 backup capability        Verified by TFE apply       Yesterday        │
│ Promote v2.3.9 to PROD          Verified by Harness         3 days ago       │
│ Diagnose connector mismatch     Resolution confirmed        5 days ago       │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 8.7 Task item 的 UX 内容

每个 Task item 至少包含：

| 内容             | 示例                                   |
| -------------- | ------------------------------------ |
| 用户目标           | Promote v2.4.1 to UAT                |
| 工作类型           | Promotion                            |
| 当前状态           | Waiting / Needs review / Failed      |
| 当前责任方          | Application Team / Identity Platform |
| 执行系统           | Harness / TFE / SailPoint            |
| 进度             | 5 of 6 gates                         |
| 当前阻塞           | Runtime validation failed            |
| 最后更新时间         | 6 minutes ago                        |
| Primary action | Continue / Review / Diagnose / View  |
| Evidence       | Run、request、plan、deployment          |

---

# 9. Architecture UX

## 9.1 用户为什么来到这里

用户需要：

* 理解当前 Application 的云上结构；
* 查看 resource 和 connection；
* 增加某项 capability；
* 修改现有 infrastructure；
* 理解当前状态和 proposed state；
* Review 正在进行的 infrastructure change。

## 9.2 用户此刻要完成什么

```text
理解当前架构
或
表达一个基础设施结果
→ 配置少数必要决定
→ Review change
→ Execute and track
```

## 9.3 用户不知道什么、被什么阻塞

用户可能不知道：

* 需要哪些底层 resources；
* capability pack 包含什么；
* 某个 resource 与其他 resource 如何连接；
* 哪些资源由 Atlas 管理；
* 当前数据是否完整；
* 改动会造成 replacement、downtime 或 cost change；
* 应该填写什么 Terraform variable。

## 9.4 Atlas 需要提供什么

Architecture 页面以 Graph 为主要视觉对象。

Graph 表达：

* current resources；
* relationships；
* environments；
* managed / unmanaged；
* unknown / stale；
* active proposed change；
* capability pack；
* selected resource detail。

主要动作：

```text
Add capability
Change infrastructure
```

不提供默认自由拖拽式架构编辑器。

不向低知识用户暴露完整 Terraform provider resource catalog。

## 9.5 ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Architecture                 Environment: DEV ▾        Refreshed 4 min ago   │
│                                                                              │
│ [ Add capability ]   [ Change infrastructure ]                              │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────┬───────────────┐ │
│ │ CURRENT ARCHITECTURE                                     │ CONTEXT       │ │
│ │                                                          │               │ │
│ │                      Internet                            │ 7 managed     │ │
│ │                         │                                │ resources     │ │
│ │                         ▼                                │               │ │
│ │                  Application LB                          │ 1 unmanaged   │ │
│ │                         │                                │ dependency    │ │
│ │                         ▼                                │               │ │
│ │                    ECS Service                           │ Data source   │ │
│ │                    /         \                           │ warnings · 1  │ │
│ │                   ▼           ▼                          │               │ │
│ │              Secrets        Logs                         │ ACTIVE CHANGE │ │
│ │                   \                                      │ Add PostgreSQL│ │
│ │                    ─ ─ ─ Unknown dependency              │ Ready review  │ │
│ │                                                          │ [ Continue ]  │ │
│ └──────────────────────────────────────────────────────────┴───────────────┘ │
│                                                                              │
│ Selected: ECS Service                                                        │
│ Current state · Runtime · Connections · Source · Freshness                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 9.6 Graph 的复用定义

复用的是：

* Application resource identity；
* connection identity；
* current infrastructure；
* proposed additions and modifications；
* execution state；
* post-execution actual state。

不强制复用：

* 同一布局；
* 同一 zoom；
* 同一环境范围；
* 同一信息密度；
* 同一种 projection。

同一个 Application Architecture Model 可以产生：

```text
Application-wide view
Environment-specific view
Focused change subgraph
Capability pack grouped view
Current vs proposed overlay
Execution status overlay
```

---

# 10. Application About Panel

`Details` 不作为 sidebar item。

## 10.1 用户为什么来到这里

用户需要快速确认：

* Application identity；
* Owner 和 Team；
* App Code；
* repository；
* account；
* workspace；
* pipeline；
* support route；
* source freshness。

## 10.2 Atlas 提供什么

点击 Application 名称或 `About` 图标，打开右侧 panel。

## 10.3 ASCII

```text
┌──────────────────────────────────────┐
│ About payments-api               ×  │
│                                      │
│ Identity                             │
│ App Code        APP-4821             │
│ Owning team     Payments Platform    │
│ Owner           Alex Chen            │
│                                      │
│ Connected systems                    │
│ Repository      payments-api      ↗  │
│ AWS account     awsf-dev-4821     ↗  │
│ TFE workspace   app-4821-dev      ↗  │
│ Harness project payments-api      ↗  │
│                                      │
│ Support                              │
│ Default route   Cloud Platform       │
│                                      │
│ Data freshness                       │
│ 6 sources current                    │
│ 1 source delayed                     │
└──────────────────────────────────────┘
```

所有外部事实都显示 source 和 freshness。

---

# 11. Onboarding Start UX

## 11.1 用户为什么来到这里

用户需要将一个尚未完全建立的平台 Application 带到第一次成功 DEV Deployment。

他可能没有：

* App Code；
* repository；
* source code；
* artifact；
* platform account；
* Terraform knowledge。

## 11.2 用户此刻要完成什么

创建一个可以跨会话保存的 Onboarding context，并开始固定的 AWSF Onboarding Journey。

## 11.3 用户不知道什么、被什么阻塞

用户可能不知道：

* 是否已经存在同名 Application；
* 自己属于哪个 owning team；
* 是否需要 App Code；
* repository 是否必须已有；
* 后续会经过哪些平台；
* 自己需要准备什么。

## 11.4 Atlas 需要提供什么

Atlas 创建一个 provisional onboarding subject。

它至少关联：

* Initiating user；
* Owning team；
* Participants；
* Working application name；
* 已知 identifier；
* Onboarding Golden Path version。

开始时只询问建立 provisional identity 所需的最低信息。

## 11.5 ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Onboard an application to AWSF                                               │
│                                                                              │
│ Atlas will guide your team to the first successful DEV deployment.           │
│ You do not need an App Code, repository or Terraform configuration to start. │
│                                                                              │
│ INITIATOR                                                                    │
│ Ziyu · Application Platform Team                                             │
│                                                                              │
│ Application working name                                                     │
│ [ inventory-service                                                    ]     │
│ Used to create a temporary onboarding record.                                │
│                                                                              │
│ Owning team                                                                  │
│ [ Application Platform Team ▾ ]                                              │
│                                                                              │
│ Known identifiers · Optional                                                 │
│ App Code        [                            ]                                │
│ Repository      [                            ]                                │
│                                                                              │
│ Atlas will check for existing applications before creating a new record.     │
│                                                                              │
│ [ Start onboarding ]                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

如果发现匹配的 canonical Application，Atlas 应要求用户确认绑定，而不是创建重复对象。

---

# 12. Onboarding Journey UX

## 12.1 用户为什么来到这里

用户要继续一条已开始的 Onboarding Journey。

他想知道：

* 当前到哪一步；
* 哪些步骤已经满足；
* 当前卡在哪里；
* 谁负责；
* 下一步要做什么；
* 是否已经产生可验证证据。

## 12.2 用户此刻要完成什么

完成当前最合适的 Journey step，并推动整个 Onboarding 到第一次成功 DEV Deployment。

## 12.3 用户不知道什么、被什么阻塞

用户可能不知道：

* 当前推荐步骤；
* 是否有多个步骤可以并行；
* 某一步为什么 blocked；
* 一个 field 应该填什么；
* 外部系统操作是否完成；
* support 应该找谁；
* 用户手动确认是否足够；
* 某个步骤是否已经被已有 evidence 满足。

## 12.4 Atlas 需要提供什么

* 真实 phases 和 steps；
* DAG dependency；
* selected step；
* recommended next step；
* multiple ready steps；
* current responsibility；
* source system；
* completion evidence；
* parameter assistance；
* external action assistance；
* step-level support；
* inline diagnosis。

## 12.5 Journey Navigation

不使用：

```text
Progress
Completed
Current
Upcoming
Overall Support
```

只显示真实阶段和步骤。

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ AWSF Application Onboarding · inventory-service             Exit onboarding │
├──────────────────────────┬───────────────────────────────────────────────────┤
│ 6 of 9 steps verified    │ Step 4.2 · Environment mapping                    │
│ Active 1h 18m            │ Ready · Recommended next                          │
│ Blocked 2d 4h            │                                                   │
│                          │                                                   │
│ 1. Application identity  │                                                   │
│    ✓ Application record  │                                                   │
│                          │                                                   │
│ 2. Access                │                                                   │
│    ✓ Team access         │              Current step workspace               │
│    ⏳ Deploy access       │                                                   │
│                          │                                                   │
│ 3. Cloud setup           │                                                   │
│    ⏳ Account request     │                                                   │
│    ◇ Environment map  ←  │                                                   │
│                          │                                                   │
│ 4. Source & artifact     │                                                   │
│    ◇ Repository          │                                                   │
│    🔒 Artifact           │                                                   │
│                          │                                                   │
│ 5. Infrastructure        │                                                   │
│ 6. Delivery setup        │                                                   │
│ 7. Runtime config        │                                                   │
│ 8. First deployment      │                                                   │
│ 9. Validation            │                                                   │
└──────────────────────────┴───────────────────────────────────────────────────┘
```

### 导航状态语义

| 图形   | 含义                     |
| ---- | ---------------------- |
| `✓`  | Completed and verified |
| `◇`  | Ready                  |
| `●`  | In progress            |
| `⏳`  | Waiting                |
| `!`  | Needs user input       |
| `×`  | Failed                 |
| `🔒` | Blocked by dependency  |
| `—`  | Not applicable         |

如果存在多个 Ready step，Atlas 可以标记其中一个为 `Recommended next`，但不能将另一个 Ready step 隐藏。

---

# 13. Onboarding Step UX

每个 Journey step 都使用同一内容顺序，但不强迫所有 step 共享同一个表单结构。

## 13.1 Step 页面结构

```text
1. What this step achieves
2. Current status and responsibility
3. What Atlas already knows
4. What the user needs to decide or do
5. What will happen next
6. Validation and evidence
7. Step-level support
```

## 13.2 参数配置 Step

### 用户为什么来到这里

用户需要提供当前步骤无法安全推断的参数。

### 用户不知道什么

* 参数用途；
* 应该使用什么值；
* 命名规则；
* 影响范围；
* 推荐值从哪里来；
* 错误选择会造成什么。

### Atlas 提供什么

每个字段提供：

* recommendation；
* source；
* why；
* impact；
* example；
* naming guidance；
* reference image；
* support。

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 7 · Runtime configuration                         Needs your input      │
│                                                                              │
│ Configure the values required for the first DEV deployment.                  │
│ Current responsibility: Application Team                                    │
│                                                                              │
│ ATLAS ALREADY KNOWS                                                          │
│ Application       inventory-service               Source: App Registry       │
│ Environment       DEV                             Source: AWSF account map    │
│ Harness service   inventory-service-dev           Source: Harness            │
│                                                                              │
│ YOU NEED TO DECIDE                                                           │
│                                                                              │
│ Expected traffic                                                             │
│ [ Low · under 10 requests/sec ▾ ]             Recommended                    │
│ Why this matters: Used to select safe default capacity.                      │
│ Recommendation source: Similar DEV workloads                                 │
│ [ View impact ]                                                              │
│                                                                              │
│ Runtime configuration name                                                   │
│ [ inventory-service-dev-runtime                                      ]       │
│ ✓ Matches the platform naming standard                                      │
│ [ Why this name? ] [ View example ]                                          │
│                                                                              │
│ Secret path                                                                  │
│ [ /applications/inventory-service/dev                                ]       │
│ Recommended from application and environment context.                        │
│                                                                              │
│ [ Save and validate ]                                                        │
│                                                                              │
│ NEED HELP WITH THIS STEP                                                     │
│ Runtime Platform · #runtime-support                                          │
│ Prepared context: Application, Environment, Harness service, validation      │
│ [ Open support route ]                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

参数不按照 Terraform variables 顺序组织，而是按用户决策组织。

---

## 13.3 Delegated Action Step

### Atlas 支持的四种用户可见模式

| 用户可见模式                              | 实现方式示例                           |
| ----------------------------------- | -------------------------------- |
| Atlas can complete this             | API 或 MCP delegated action       |
| Review and submit                   | Atlas 预填，用户确认后提交                 |
| Continue with guided assistance     | Browser / Local Agent assistance |
| Open prepared data in source system | Deep link + prefilled context    |

用户不需要首先理解 MCP、Local Agent 或 browser automation。

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 2.2 · Request deployment access                   Ready                │
│                                                                              │
│ Atlas can prepare and submit the access request using your identity.          │
│ Authorization remains with the Identity Platform.                            │
│                                                                              │
│ REQUEST SUMMARY                                                              │
│ Application      inventory-service                                           │
│ Team             Application Platform                                        │
│ Environment      DEV                                                         │
│ Requested role   Deployer                                                    │
│ Group name       grp-inventory-service-dev-deployer                           │
│                                                                              │
│ Validation                                                                    │
│ ✓ Naming rule passed                                                         │
│ ✓ Team ownership resolved                                                    │
│ ✓ No duplicate active request                                                │
│                                                                              │
│ [ Review and submit request ]                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

提交后不将 step 立即标记为 Completed。

状态变为：

```text
Request submitted
→ Waiting for Identity Platform
→ Access observed
→ Completion verified
```

---

## 13.4 External Waiting Step

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 3.1 · AWSF account request                         Waiting              │
│                                                                              │
│ Waiting for Cloud Platform                                                   │
│ ServiceNow request REQ-5824                                                  │
│ Submitted 2 days ago · Last checked 6 minutes ago                            │
│                                                                              │
│ No action is currently required from you.                                    │
│                                                                              │
│ CURRENT STATUS                                                               │
│ Assigned to       Cloud Platform Queue                                       │
│ Current state     In progress                                                │
│ Expected result   DEV account and environment mapping                        │
│                                                                              │
│ Evidence                                                                    │
│ Request created   REQ-5824                                                   │
│ Assignment        Cloud Platform Queue                                       │
│                                                                              │
│ [ Open in ServiceNow ]   [ Refresh status ]                                  │
│                                                                              │
│ NEED HELP                                                                    │
│ Escalation route available after the configured waiting threshold.           │
│ [ Open support route ]                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

这里必须区分：

```text
Responsible party: Cloud Platform
Execution or tracking system: ServiceNow
```

不能显示为“Waiting for ServiceNow”。

---

## 13.5 用户手动确认

用户可以主动标注某些 manual step 已完成，但 UI 必须说明验证强度：

```text
Completed
Confirmed by you · Not independently verified
```

如果之后外部数据与用户确认冲突：

```text
Verification conflict
External evidence indicates this requirement is not satisfied.
```

该 step 应重新进入：

```text
Needs review
```

而不是继续保持绿色 Done。

---

## 13.6 Onboarding Completion

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ First successful DEV deployment verified                                    │
│                                                                              │
│ inventory-service is now available in DEV.                                   │
│                                                                              │
│ VERIFIED OUTCOME                                                             │
│ Deployment       Harness run #1429 · Successful                              │
│ Application URL  https://...                                             ↗   │
│ Health check     Passed                                                      │
│ Infrastructure   TFE apply #842 · Successful                                 │
│ Artifact         inventory-service:1.0.0                                     │
│                                                                              │
│ Evidence package                                                             │
│ [ View deployment ] [ View infrastructure ] [ View all evidence ]            │
│                                                                              │
│ The onboarding record is now linked to Application APP-4928.                 │
│                                                                              │
│ [ Open Application Overview ]                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 14. Infrastructure Change UX

用户侧不使用 `Scaffolder` 作为功能名称。

## 14.1 用户可见命名

| 场景                  | 用户可见名称                |
| ------------------- | --------------------- |
| 从 Architecture 增加能力 | Add capability        |
| 修改已有资源              | Change infrastructure |
| Focused workspace   | Infrastructure change |
| 内部生成能力              | Scaffolder，可保留为工程术语   |

## 14.2 四个阶段

```text
Select goal
→ Configure
→ Review
→ Execute & track
```

已知上下文直接跳过，不强制所有用户经过完整选择链。

---

## 14.3 Select Goal

### 用户为什么来到这里

用户希望增加或改变某项云能力。

### 用户此刻要完成什么

表达业务或平台结果，而不是选择 Terraform resource。

### 用户不知道什么

* 实现某个结果需要哪些资源；
* 应选择 capability pack 还是原子资源；
* 当前 Application 已经拥有什么；
* 某个 capability 是否适用于当前 workload。

### Atlas 提供什么

默认显示 capability：

```text
Add a database
Add asynchronous messaging
Expose the service externally
Add secret management
Increase availability
```

原子 resource 只在平台明确支持其独立、安全消费时出现。

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Infrastructure change · Select goal                                          │
│ payments-api · DEV                                                           │
│                                                                              │
│ What do you want this application to be able to do?                          │
│                                                                              │
│ RECOMMENDED                                                                  │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Add a PostgreSQL database                                               │ │
│ │ Includes network access, credentials, backup and application connection │ │
│ │ Recommended for the current ECS architecture                [ Select ]  │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ Add asynchronous messaging                                              │ │
│ │ Queue, permissions, dead-letter handling and application connection     │ │
│ │                                                             [ Select ]  │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ OTHER CAPABILITIES                                                           │
│ Expose externally · Secret management · Object storage                       │
│                                                                              │
│ Advanced: Add an individually supported resource                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

如果入口已经确定 goal，例如从 Journey step 进入 `Add PostgreSQL`，则跳过此页面。

---

## 14.4 Configure

### 用户为什么来到这里

用户需要确认无法安全推断的少量设计决策。

### 用户此刻要完成什么

配置 proposed architecture，并理解每项选择如何影响 Graph。

### 用户不知道什么

* 需要选择哪些数据库参数；
* 推荐值是否适用；
* current 和 proposed architecture 有什么差异；
* capability pack 内包含什么；
* 哪些设置影响成本、可靠性和恢复能力。

### Atlas 提供什么

* Graph 为主视觉；
* current / new / modified；
* capability pack grouping；
* 决策面板；
* recommended defaults；
* impact explanation；
* live Graph update；
* provenance；
* advanced options 按需展开。

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Infrastructure change       Select goal  →  Configure  →  Review  → Execute │
├──────────────────────────────────────────────────────────┬───────────────────┤
│ PROPOSED ARCHITECTURE                                    │ DECISIONS         │
│                                                          │                   │
│                     Internet                             │ Database engine   │
│                        │                                 │ PostgreSQL  ✓     │
│                        ▼                                 │                   │
│                 Application LB                           │ Size              │
│                        │                                 │ Small DEV         │
│                        ▼                                 │ Recommended       │
│                   ECS Service                            │                   │
│                        │                                 │ Availability      │
│                        ▼                                 │ Single AZ         │
│              ┌────────────────────┐                      │ Recommended DEV   │
│              │ PostgreSQL pack    │  NEW                 │                   │
│              │ RDS                │                      │ Backups           │
│              │ Secret             │                      │ 7 days            │
│              │ Security rules     │                      │                   │
│              │ Backup config      │                      │ Naming            │
│              └────────────────────┘                      │ payments-dev-db   │
│                                                          │ ✓ Valid           │
│ Existing   New   Modified   Unknown                       │                   │
│                                                          │ [ Continue ]      │
└──────────────────────────────────────────────────────────┴───────────────────┘
```

Graph 不是右侧辅助插图。它占据主空间，用户决策面板是辅助控制面。

---

## 14.5 Review

### 用户为什么来到这里

用户需要确认 proposed change 是否安全、合规、可执行。

### 用户此刻要完成什么

理解：

* Architecture delta；
* IaC delta；
* Resource impact；
* Readiness；
* Validation；
* Cost；
* Warning；
* Exclusion。

### Atlas 提供什么

```text
Proposed architecture
Current vs proposed
IaC change summary
Resource replacement and deletion
Policy and security impact
Validation
Readiness
Cost estimate
Unknowns and exclusions
```

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Infrastructure change        Select goal  →  Configure  →  Review  → Execute│
│                                                                              │
│ ┌─ CHANGE SUMMARY ─────────────────────────────────────────────────────────┐ │
│ │ Add PostgreSQL capability pack                                          │ │
│ │ 5 resources added · 1 connection modified · 0 deleted                   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌───────────────────────────────────────────────────┬──────────────────────┐ │
│ │ CURRENT VS PROPOSED                               │ IMPACT               │ │
│ │                                                   │                      │ │
│ │ Current                    Proposed               │ Validation   Passed  │ │
│ │ ALB                        ALB                    │ Readiness    Ready   │ │
│ │  │                          │                     │ Cost         +$92/mo│ │
│ │ ECS                        ECS ───── RDS          │ Replacement  None    │ │
│ │                             ├────── Secret        │ Downtime     None    │ │
│ │                             └────── Backup        │                      │ │
│ │                                                   │ WARNINGS             │ │
│ │                                                   │ Estimate only        │ │
│ └───────────────────────────────────────────────────┴──────────────────────┘ │
│                                                                              │
│ IaC change                                                                  │
│ Generated modules · Plan summary · Policy checks · Exclusions               │
│                                                                              │
│ [ Back to configure ]                          [ Execute change ]             │
└──────────────────────────────────────────────────────────────────────────────┘
```

Graph 不能替代 plan、replacement、security 和 unknown value 等详细影响。

---

## 14.6 Execute & Track

### 用户为什么来到这里

用户已经确认 change，希望知道它实际执行到哪里。

### 用户此刻要完成什么

* 追踪 delegated execution；
* 完成用户必须参与的步骤；
* 查看 artifacts；
* 在失败时开始 Diagnosis；
* 验证 actual state。

### Atlas 提供什么

* 同一 Architecture Graph 的 execution overlay；
* delegated system；
* current responsibility；
* run timeline；
* artifacts；
* logs；
* failure location；
* Diagnosis；
* final evidence。

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Infrastructure change        Configure  →  Review  →  Execute & track       │
│                                                                              │
│ ┌───────────────────────────────────────────────────┬──────────────────────┐ │
│ │ EXECUTION ARCHITECTURE                            │ RUN                  │ │
│ │                                                   │                      │ │
│ │ ALB · Existing                                    │ ✓ IaC generated      │ │
│ │  │                                                │ ✓ Pull request open  │ │
│ │ ECS · Existing                                    │ ✓ TFE plan           │ │
│ │  │                                                │ ● TFE apply          │ │
│ │ RDS · Provisioning                                │ ○ Validate resource  │ │
│ │  ├ Secret · Pending                               │ ○ Update app config  │ │
│ │  └ Backup · Pending                               │ ○ Final validation   │ │
│ │                                                   │                      │ │
│ │ Current executor: TFE                             │ ARTIFACTS            │ │
│ │ Current responsibility: Cloud Platform automation│ Pull request      ↗  │ │
│ │                                                   │ TFE plan          ↗  │ │
│ │                                                   │ Apply log         ↗  │ │
│ └───────────────────────────────────────────────────┴──────────────────────┘ │
│                                                                              │
│ No action is currently required from you.                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

失败时：

```text
RDS · Failed
TFE apply #842
[ Diagnose failure ]
```

不能将：

```text
Pull request created
```

显示为：

```text
Infrastructure created
```

---

# 15. Promote UX

Promote 是一条具体 Journey，不是通用 Journey Definition 页面。

## 15.1 用户为什么来到这里

用户希望将已存在的 Application version 从较低环境推进到较高环境。

## 15.2 用户此刻要完成什么

```text
选择 version 和 target
→ 比较 source 与 target
→ 通过 readiness gates
→ Review impact
→ Execute and track
→ Validate
```

## 15.3 用户不知道什么、被什么阻塞

用户可能不知道：

* 哪个 version 可 Promote；
* source 和 target 的差异；
* target 是否准备好；
* 哪个 readiness gate 阻塞；
* 是否存在 infrastructure 或 configuration drift；
* 本次 Promote 是否带来 cost impact；
* 失败后应找哪个对象和哪个团队。

## 15.4 Atlas 提供什么

* version selection；
* source / target comparison；
* readiness gates；
* environment difference；
* cost signal；
* approval status；
* delegated deployment；
* validation；
* Diagnosis；
* evidence。

## 15.5 入口

Promote 不作为 sidebar item。

入口来自：

* Overview environment/version row；
* 当前 deployment result；
* existing Promotion task；
* readiness signal。

例如：

```text
UAT · v2.4.0
DEV has v2.4.1 available
[ Promote v2.4.1 ]
```

## 15.6 ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Promote v2.4.1 to UAT                                      Exit promotion   │
├───────────────────────┬──────────────────────────────────────────────────────┤
│ ✓ Version & target    │ Readiness                                            │
│ ✓ Compare             │                                                      │
│ ● Readiness        ←  │ SOURCE                                               │
│ ○ Review              │ DEV · v2.4.1                                         │
│ ○ Execute             │                                                      │
│ ○ Validate            │ TARGET                                               │
│                       │ UAT · v2.4.0                                          │
│                       │                                                      │
│                       │ READINESS GATES                                       │
│                       │ ✓ Artifact available                                 │
│                       │ ✓ Infrastructure compatible                          │
│                       │ ✓ Runtime configuration complete                     │
│                       │ ✓ Required access available                          │
│                       │ ✓ Security checks passed                             │
│                       │ × Database migration validation                      │
│                       │   Responsible: Application Team                      │
│                       │   [ Review evidence ] [ Resolve ]                    │
│                       │                                                      │
│                       │ No aggregated percentage score is used.              │
└───────────────────────┴──────────────────────────────────────────────────────┘
```

Readiness 不默认压缩成 `82% ready`。

用户需要知道的是：

```text
哪一项 gate 阻塞
为什么
谁负责
如何修复
验证依据是什么
```

## 15.7 Target Environment 不存在

如果 Promote 发现 target environment 不存在：

```text
Prepare target environment
```

成为当前 Promotion Journey 中的一个 blocking step。

该 step 可以引用独立的 `InfrastructureChangeRun`，但不复制 Infrastructure Change 的完整数据结构。

## 15.8 Promote Review

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Review promotion                                                             │
│                                                                              │
│ Version           v2.4.1                                                     │
│ Source            DEV                                                        │
│ Target            UAT                                                        │
│                                                                              │
│ CHANGES                                                                      │
│ Application       v2.4.0 → v2.4.1                                            │
│ Configuration     2 values differ                                            │
│ Infrastructure    No structural change                                       │
│ Database          Migration required                                         │
│                                                                              │
│ READINESS                                                                   │
│ All required gates passed                                                    │
│                                                                              │
│ COST SIGNAL                                                                  │
│ No material cost change detected                                             │
│                                                                              │
│ VALIDATION PLAN                                                              │
│ Health endpoint · Smoke test · Deployment evidence                           │
│                                                                              │
│ [ Back ]                                      [ Promote and track ]           │
└──────────────────────────────────────────────────────────────────────────────┘
```

Cost 只在存在实际变化或可信 estimate 时增强显示。

---

# 16. Diagnosis UX

## 16.1 入口原则

Diagnosis 优先从已有错误对象进入：

* failed Journey step；
* failed Infrastructure Change；
* failed Promotion；
* failed deployment；
* Dashboard anomaly。

但不是唯一入口。

当不存在明确 failed object 时，可以从：

```text
Application
+ Environment
+ Structured symptom
```

开始。

例如：

```text
DEV application cannot be reached
Access was approved but is not active
Expected resource is missing
Deployment succeeded but runtime validation failed
```

不以空白聊天框作为起点。

## 16.2 Diagnosis 内容结构

固定包含：

```text
Failure location
Likely causes
Supporting evidence
Recommended actions
Validation method
Support route
```

---

## 16.3 Inline Diagnosis

### 用户为什么来到这里

用户正在 Journey、Promotion 或 Infrastructure Change 中，某一步突然失败。

他不希望离开当前现场。

### 用户此刻要完成什么

快速理解：

```text
最可能原因是什么
现在最应该做什么
```

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Deployment failed                                                           │
│ Harness run #1428 · Runtime stage                                            │
│                                                                              │
│ MOST LIKELY CAUSE · High confidence                                          │
│ The task definition is missing the required secret reference.                │
│                                                                              │
│ WHY ATLAS THINKS THIS                                                        │
│ Runtime configuration expects `/payments/dev/db-password`.                   │
│ The deployed task definition contains no matching secret reference.          │
│                                                                              │
│ RECOMMENDED ACTION                                                           │
│ Add the recommended secret reference and rerun the failed stage.              │
│                                                                              │
│ [ Review prepared change ]   [ Rerun after correction ]                      │
│                                                                              │
│ Supporting evidence · 4 items ▸                                              │
│                                                                              │
│ [ Open full diagnosis ]   [ Get help ]                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

证据默认折叠，结论和首要动作优先。

---

## 16.4 Full Diagnosis

### 用户为什么来到这里

用户专门来调查一个失败，需要查看完整证据、不同假设和恢复路径。

### ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Diagnose DEV deployment #1428                                               │
│ payments-api · DEV · 18 minutes ago                                         │
│                                                                              │
│ ┌──────────────────────────────────────────┬────────────────────────────────┐ │
│ │ WHY                                      │ WHAT TO DO                     │ │
│ │                                          │                                │ │
│ │ Failure location                         │ Recommended action             │ │
│ │ Runtime deployment stage                 │ Add missing secret reference   │ │
│ │                                          │                                │ │
│ │ Likely causes                            │ Validation                     │ │
│ │ 1. Missing secret reference · High       │ Rerun runtime stage            │ │
│ │ 2. TFE output not propagated · Medium    │ Confirm health endpoint        │ │
│ │ 3. Connector version mismatch · Low      │                                │ │
│ │                                          │ Prepared remediation           │ │
│ │ Evidence chain                           │ Configuration change ready     │ │
│ │ Harness log                       ↗      │ [ Review change ]              │ │
│ │ Task definition                   ↗      │                                │ │
│ │ TFE output                        ↗      │ Support route                  │ │
│ │ Runtime configuration             ↗      │ Runtime Platform              │ │
│ │ Recent platform change            ↗      │ #runtime-support              │ │
│ │                                          │ [ Open prepared handoff ]      │ │
│ └──────────────────────────────────────────┴────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 16.5 Symptom-based Entry

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Investigate a problem                                                        │
│ payments-api · DEV                                                           │
│                                                                              │
│ What is not working?                                                         │
│                                                                              │
│ ( ) Application cannot be reached                                            │
│ ( ) Access is approved but not active                                        │
│ ( ) Expected resource is missing                                             │
│ ( ) Deployment succeeded but validation failed                              │
│ ( ) Something else                                                           │
│                                                                              │
│ Atlas will identify relevant runs and recent changes before diagnosis.       │
│                                                                              │
│ [ Continue ]                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

只有选择 `Something else` 时才允许简短补充描述。

---

# 17. Contextual Support UX

Support 不作为 Journey 级固定右栏，也不成为默认 sidebar page。

## 17.1 Support Route 的解析维度

```text
Application
Environment
Current Journey or operation
Selected step
Failure category
Responsible platform
Current evidence
Attempted actions
```

## 17.2 Support Route 内容

```text
Responsible domain or team
Current queue or channel
Current responder or on-call, if authoritative
Escalation path
Required parameters
Current status
Evidence
Attempts
Source system links
Prepared handoff
```

## 17.3 Step-level Support ASCII

```text
┌─ NEED HELP WITH THIS STEP ────────────────────────────────────────────────────┐
│ Responsible team     Identity Platform                                       │
│ Support route        #identity-help                                           │
│ Current request      REQ-4821                                                 │
│ Current status       Waiting · 2 days                                         │
│ Evidence included    Application, group name, request state, validation       │
│ Attempts included    Refresh status · Recheck group mapping                   │
│                                                                              │
│ [ Open support route ]   [ Prepare escalation ]                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

`Step Owner` 和 `Current Responder` 必须分开：

```text
Step Owner
= 对该步骤的设计和治理负责

Current Responder
= 处理当前具体 request 或 failure 的团队、队列或人员
```

---

# 18. 状态与责任模型

Journey step 的状态不能由单个 enum 完整表达。

## 18.1 四个独立维度

### A. Lifecycle state

```text
Not started
Active
Waiting
Failed
Completed
Not applicable
Canceled
```

### B. Availability

```text
Blocked
Ready
```

### C. Actionability

```text
Needs user input
Needs user review
Atlas running
Waiting on external party
No action required
```

### D. Verification

```text
Verified
Self-declared
Unverified
Conflicting evidence
Stale
Unknown
```

## 18.2 Completion basis

```text
Observed
Derived
Declared
Atlas-owned
Approved exception
```

## 18.3 Responsibility

责任方必须是能够承担行动的人或组织：

```text
Current user
Application Team
Platform Team
Approver
Atlas automation
```

以下对象不是责任方：

```text
ServiceNow
SailPoint
Harness
TFE
```

它们是：

```text
Execution system
Tracking system
State source
```

## 18.4 UI 组合语句

不要仅显示：

```text
Waiting
Completed
Failed
```

而应组合为：

```text
Needs your input
Waiting for Identity Platform
Atlas is validating the deployment
Completed · Verified by Harness run #1429
Completed · Confirmed by you, not yet verified
Verification conflict · External evidence does not match
Blocked by AWSF account request
```

---

# 19. Application Verdict 模型

Application verdict 与技术 health 分开。

## 19.1 Verdict

```text
Action required
No action required
Unable to determine
```

## 19.2 Technical state

```text
Healthy
Degraded
Failed
Running
Unknown
```

## 19.3 推导优先级

```text
1. 关键 source 不可用或过期
   → Unable to determine

2. 存在当前用户可执行的 critical item
   → Action required

3. 只有外部等待，当前用户无需行动
   → No action required
     Waiting externally

4. 没有用户行动且数据可信
   → No action required
```

一个 Application 可以同时是：

```text
Technical state: Healthy
Verdict: Action required
```

例如应用运行正常，但用户需要完成 Production readiness input。

也可以是：

```text
Technical state: Degraded
Verdict: No action required
```

例如平台团队已接手恢复，当前用户无需行动。

---

# 20. 产品数据模型总体设计

## 20.1 设计原则

不创建万能领域对象：

```text
Goal
Work
Decision
Change
Issue
```

然后要求所有场景继承。

采用三层模型：

```text
Scenario-specific domain models
        ↓
Thin shared contracts
        ↓
UI read projections
```

## 20.2 总体关系

```text
Actor ───────────────┐
                     │ initiates / participates
Team ────────────────┤
                     ▼
          Onboarding Subject
                     │ binds when verified
                     ▼
                Application
                     │
       ┌─────────────┼─────────────────────┐
       │             │                     │
       ▼             ▼                     ▼
 Environments   Context Projection   Scenario Runs
                                         │
                    ┌────────────────────┼─────────────────────┐
                    ▼                    ▼                     ▼
             Onboarding Run     Infrastructure Change    Promotion Run
                    │                                          │
                    └────────────────┬─────────────────────────┘
                                     ▼
                              Delegated Operations
                                     │
                                     ▼
                                  Evidence

Diagnosis Case references:
Application + Environment + Run / Step / Symptom + Evidence
```

---

# 21. Identity 与临时 Onboarding 对象

## 21.1 Actor

表示可信企业身份。

主要属性：

| 属性                  | 含义                    |
| ------------------- | --------------------- |
| Actor ID            | Atlas 内稳定身份           |
| Enterprise identity | Entra 等可信主体           |
| Display name        | 显示名称                  |
| Team memberships    | 所属团队                  |
| Roles               | 在 Application 或平台上的角色 |
| Permission context  | 可查看和可执行范围             |

Identity 是 Atlas 的 P0 基础，因为 Atlas 必须知道谁在执行、谁确认了 manual step、谁触发了 deployment。

## 21.2 Team

主要属性：

* Team ID；
* Name；
* Source；
* Members；
* Application relationships；
* Support relationships。

## 21.3 OnboardingSubject

在 canonical Application 尚未建立时承载 Onboarding 状态。

主要属性：

| 属性                       | 含义                    |
| ------------------------ | --------------------- |
| Subject ID               | 临时稳定身份                |
| Initiator                | 发起人                   |
| Owning team              | 所属团队                  |
| Participants             | 可继续 Journey 的团队成员     |
| Working name             | 临时 Application 名称     |
| Known identifiers        | App Code、repo 等已知标识   |
| Golden Path version      | 当前使用的路径版本             |
| Status                   | Active、Bound、Canceled |
| Canonical Application ID | 完成绑定后填写               |
| Access policy            | 谁可以查看和继续              |
| Created / updated        | 审计时间                  |

## 21.4 绑定规则

```text
OnboardingSubject
→ 发现或创建 canonical Application
→ 验证身份和归属
→ 建立 binding
→ 后续所有 context 使用 canonical Application
→ Onboarding 历史和 evidence 保留
```

OnboardingSubject 首先关联团队和发起人，而不只关联个人。

即使发起人离开团队，团队成员仍应能够继续 Journey。

---

# 22. Application Context Model

## 22.1 Application

主要属性：

* Canonical Application ID；
* App Code；
* Display name；
* Owning team；
* Owners；
* Lifecycle state；
* Support route；
* source references。

## 22.2 Environment

主要属性：

* Environment ID；
* Application ID；
* Environment name；
* Stage，例如 DEV、UAT、PROD；
* Cloud；
* Account / subscription；
* Region；
* current version；
* technical state；
* readiness summary。

## 22.3 ApplicationContextProjection

Atlas 不拥有底层事实，只拥有规范化投影。现有产品定义要求 Application Projection 覆盖 Team、Environment、Account、Repository、TFE、Harness、Resources、Tickets、Documents、Cost 和 Journeys，并为每项事实保留 source、external ID、retrieval time 和 freshness。

投影包含：

```text
Application
├── Team / Owner
├── Environments
├── Accounts / Subscriptions
├── Repositories
├── TFE Workspaces
├── Harness Projects / Pipelines
├── Resources
├── Requests / Tickets / Changes
├── Documents
├── Cost signals
├── Active work
└── Support routes
```

每个事实包含：

| 字段                | 含义                             |
| ----------------- | ------------------------------ |
| Source system     | 来源系统                           |
| External ID       | 源系统标识                          |
| Retrieved at      | 获取时间                           |
| Freshness         | Current、stale、unknown          |
| Resolution method | Direct、mapped、derived、declared |
| Quality warning   | 映射冲突或数据缺口                      |

---

# 23. Journey 模型

## 23.1 Definition 与 Run 分离

```text
Golden Path Definition
= 经过治理、版本化的推荐完成方式

Journey Run
= 某个 Application 或 OnboardingSubject 对 Golden Path 的一次执行
```

现有产品定义也明确区分 Golden Path、Journey 和 Action。

## 23.2 GoldenPathVersion

主要属性：

* Golden Path ID；
* Version；
* Applicable scope；
* Outcome；
* Journey owner；
* Step definitions；
* Dependency graph；
* completion criteria；
* evidence rules；
* review date。

## 23.3 OnboardingJourneyRun

主要属性：

| 属性                       | 含义                              |
| ------------------------ | ------------------------------- |
| Run ID                   | Journey instance                |
| Subject reference        | OnboardingSubject 或 Application |
| Golden Path version      | 固定版本                            |
| Initiator / participants | 用户和团队                           |
| Current recommendation   | 推荐下一步                           |
| Step runs                | 所有步骤状态                          |
| Active duration          | 用户和系统实际执行时间                     |
| Blocked duration         | 等待外部时间                          |
| Overall outcome          | 未完成、完成、取消                       |
| Completion evidence      | First DEV evidence package      |

## 23.4 StepRun

主要属性：

* Step definition ID；
* lifecycle state；
* availability；
* actionability；
* verification；
* completion basis；
* responsible party；
* execution system；
* source system；
* dependency status；
* inputs and decisions；
* evidence references；
* operation references；
* support route；
* attempts；
* active time；
* blocked time；
* last updated。

## 23.5 DAG 与条件

```text
StepRun
├── prerequisites
├── dependencies
├── condition result
├── parallel group
├── optional / required
└── exception path
```

UI 根据这些信息生成真实 step 导航，而不是生成 `Upcoming` 区域。

---

# 24. Infrastructure Change Model

## 24.1 InfrastructureChangeRun

主要属性：

| 属性                        | 含义                                 |
| ------------------------- | ---------------------------------- |
| Change ID                 | 变更实例                               |
| Application / Environment | 变更上下文                              |
| Initiating context        | Architecture、Journey 或 resource    |
| Goal type                 | Add capability、add resource、modify |
| Capability pack           | 可选                                 |
| Target resource           | 修改已有资源时使用                          |
| Decisions                 | 用户必须确认的参数                          |
| Current snapshot          | 当前 architecture                    |
| Proposed snapshot         | Proposed architecture              |
| Change set                | Add、modify、remove、connection       |
| Validation results        | Preflight 和 policy                 |
| Impact                    | Replacement、downtime、security      |
| Cost impact               | Estimate 和 confidence              |
| Warnings / exclusions     | 不确定项                               |
| Delegated operations      | PR、plan、apply、validation           |
| Final actual snapshot     | 执行后实际状态                            |
| Evidence                  | Artifacts 和结果                      |

## 24.2 CapabilityPackDefinition

表示用户可消费的业务或平台能力。

主要属性：

* Capability ID；
* user-facing name；
* supported platforms；
* applicable workloads；
* required decisions；
* default decisions；
* contained resources；
* required connections；
* validation rules；
* cost model；
* support route。

Capability pack 是默认消费单位。

## 24.3 ArchitectureSnapshot

```text
ArchitectureSnapshot
├── Scope
├── Environment
├── Captured at
├── Nodes
├── Edges
├── Groups
├── Source coverage
└── Quality warnings
```

## 24.4 ArchitectureNode

主要属性：

* Stable resource identity；
* Resource type；
* Provider；
* Environment；
* managed / unmanaged；
* current state；
* execution state；
* change state；
* source；
* freshness；
* capability group。

## 24.5 ArchitectureEdge

主要属性：

* Source node；
* Target node；
* relationship type；
* current / proposed；
* source；
* confidence；
* unknown or unresolved state。

---

# 25. Promotion Model

Promotion 不直接复用 Onboarding 的业务字段。

## 25.1 PromotionRun

主要属性：

| 属性                         | 含义                       |
| -------------------------- | ------------------------ |
| Promotion ID               | 运行实例                     |
| Application                | Application reference    |
| Source environment         | DEV 等                    |
| Target environment         | UAT / PROD               |
| Version                    | 被推进的 artifact version    |
| Source snapshot            | Source environment state |
| Target snapshot            | Target environment state |
| Readiness gates            | Gate results             |
| Configuration differences  | Source / target delta    |
| Infrastructure differences | Source / target delta    |
| Cost signal                | 可能的 cost impact          |
| Approval references        | 外部审批状态                   |
| Deployment operation       | Harness 等 delegated run  |
| Validation plan            | 验证标准                     |
| Rollback information       | 恢复信息                     |
| Evidence                   | 最终 promotion evidence    |

## 25.2 ReadinessGateResult

主要属性：

* Gate ID；
* status；
* blocking or informational；
* responsibility；
* source；
* evidence；
* failure reason；
* remediation；
* freshness。

Readiness 是 gate 集合，不默认生成单一分数。

---

# 26. Diagnosis Model

## 26.1 DiagnosisCase

主要属性：

| 属性                        | 含义                            |
| ------------------------- | ----------------------------- |
| Diagnosis ID              | 诊断实例                          |
| Application / Environment | 上下文                           |
| Trigger                   | Failed object 或 symptom       |
| Failed object reference   | Run、step、resource 等           |
| Time window               | 相关时间范围                        |
| Evidence set              | 所有支持证据                        |
| Hypotheses                | 可能原因                          |
| Recommended actions       | 推荐动作                          |
| Validation methods        | 如何确认修复                        |
| Support route             | 兜底路径                          |
| Status                    | Open、action prepared、resolved |
| Outcome feedback          | 最终原因与是否有效                     |

## 26.2 Hypothesis

主要属性：

* Hypothesis ID；
* explanation；
* confidence category；
* supporting evidence；
* contradicting evidence；
* known rule；
* recommended action；
* status。

置信度建议使用：

```text
High
Medium
Low
```

而不是表现为精确但无法解释的百分比。

## 26.3 DiagnosisAction

可以是：

```text
Open source system
Rerun stage
Review prepared configuration change
Prepare pull request
Prepare support ticket
Run validation
Contact support
```

实际执行仍遵守 delegated execution 边界。

---

# 27. Delegated Operation Model

## 27.1 DelegatedOperation

用于表示 Atlas 发起或追踪的真实外部执行。

主要属性：

| 属性                        | 含义                                               |
| ------------------------- | ------------------------------------------------ |
| Operation ID              | Atlas 内操作标识                                      |
| Action definition         | 操作类型                                             |
| Parent context            | Journey、Change、Promotion、Diagnosis               |
| Application / Environment | 目标上下文                                            |
| Requested by              | 发起人                                              |
| Execution mode            | API、guided、deep link、manual                      |
| Execution system          | TFE、Harness、SailPoint 等                          |
| External run ID           | 源系统标识                                            |
| Lifecycle state           | Draft、submitted、running、waiting、failed、succeeded |
| Current responsibility    | 用户、平台团队或 automation                              |
| Artifacts                 | PR、run、request、URL                               |
| Evidence                  | 状态和结果                                            |
| Audit events              | 发起、确认、更新                                         |

## 27.2 Execution Mode

```text
Direct delegated action
Review and submit
Guided browser or local assistance
Prepared deep link
Manual external action
```

## 27.3 Operation 与完成结果

Operation 成功不一定意味着上层 step 完成。

例如：

```text
Access request submitted
≠
Access granted

Pull request created
≠
Infrastructure applied

Deployment triggered
≠
Application healthy
```

上层 Journey 必须继续验证 outcome evidence。

---

# 28. Evidence Model

## 28.1 Evidence

主要属性：

* Evidence ID；
* evidence type；
* source system；
* external ID；
* captured at；
* effective time；
* freshness；
* subject；
* result；
* payload summary；
* source link；
* integrity or quality warning。

## 28.2 Evidence 类型

```text
Request status
Run result
Pipeline stage
Terraform plan
Terraform apply
Repository or commit
Artifact version
Configuration snapshot
Validation output
Health check
User confirmation
Approval result
Support handoff
```

## 28.3 Evidence Package

用于完成 Journey 或 Operation 时聚合：

```text
Outcome
Completion criteria
Supporting evidence
Source links
Timestamps
Responsible actors
Exceptions
Remaining warnings
```

---

# 29. Support Route Model

## 29.1 SupportRoute

主要属性：

* Issue category；
* Platform；
* applicable scope；
* responsible team；
* channel or queue；
* current on-call or member，如果来源可信；
* escalation path；
* waiting threshold；
* required handoff fields；
* source；
* freshness。

## 29.2 SupportHandoff

主要属性：

* Parent context；
* current status；
* relevant parameters；
* evidence；
* attempted operations；
* source links；
* prepared message or ticket；
* destination；
* handoff result。

Support Member 不是 Atlas 的新 persona。

---

# 30. Tasks Read Model

`Tasks` 页面不能要求所有领域对象继承同一个 Task 数据模型。

它使用 read projection。

## 30.1 WorkProjection

以下不同对象分别生成统一展示投影：

```text
OnboardingJourneyRun ─────────┐
PromotionRun ─────────────────┤
InfrastructureChangeRun ──────┤
DiagnosisCase ────────────────┼──→ WorkProjection
DelegatedOperation ───────────┤
Manual Step / Review ─────────┘
```

## 30.2 WorkItemProjection

仅用于 UI 查询和展示，不作为领域真相。

主要字段：

| 字段               | 含义                            |
| ---------------- | ----------------------------- |
| Source type      | 来源领域对象类型                      |
| Source ID        | 来源对象 ID                       |
| Application      | Application reference         |
| Title            | 用户目标语言                        |
| Summary          | 当前状态摘要                        |
| Actionability    | 用户是否需要行动                      |
| Lifecycle        | Running、waiting、failed 等      |
| Responsibility   | 当前责任方                         |
| Progress         | 例如 6 of 9                     |
| Priority         | 用户体验优先级                       |
| Last updated     | 最后更新时间                        |
| Primary action   | Continue、Review、Diagnose、View |
| Evidence summary | 当前 evidence                   |
| Deep link        | 打开原始 focused workspace        |

## 30.3 Tasks 分组规则

```text
Needs you
= actionability 为 needs user input / review / recovery

Running
= 当前正在执行，用户可能需要观察

Waiting
= 当前责任方为外部平台团队或 approver

Recently completed
= 已验证完成，并处于近期时间窗口
```

分组依据是 actionability 和 responsibility，而不是领域对象类型。

---

# 31. Overview Read Model

## 31.1 ApplicationOverviewProjection

`ApplicationOverviewProjection` 组合以下展示数据：

```text
ApplicationOverviewProjection
├── Application context
├── Environment filter
├── Time range
├── Freshness summary
│
├── Verdict
│   ├── Actionability
│   ├── Technical health
│   ├── Primary explanation
│   └── Primary action
│
├── Environment health[]
├── Metric series[]
│   ├── Error rate
│   ├── Latency
│   ├── Traffic
│   └── Availability
│
├── Attention items[]
├── Active task summaries[]
├── Deployment summary
├── Cost signal
├── Log signal
├── Architecture summary
└── Recent significant changes[]
```

`Metric series`、`Cost signal` 和 `Log signal` 必须包含：

```text
Source
Retrieved at
Time range
Unit
Threshold or comparison baseline
Freshness
```

## 31.2 AttentionItemProjection

可能来自：

* failed Journey step；
* required user input；
* failed deployment；
* review-ready Infrastructure Change；
* failed readiness gate；
* stale critical data。

它同样是 UI read model，不是领域父类。

## 31.3 RecentChangeProjection

只保留对用户判断有帮助的事件：

```text
Deployment
Infrastructure change
Configuration change
Access result
Platform change impact
Journey milestone
Diagnosis outcome
```

完整 event log 仍保存在 operation 和 audit 数据中。

---

# 32. 系统实现方向

## 32.1 总体架构

```text
SailPoint   ServiceNow   TFE   Harness   Cloud   Repositories
    │            │        │       │        │           │
    └────────────┴────────┴───────┴────────┴───────────┘
                              │
                     Source Adapters
                              │
             ┌────────────────┴────────────────┐
             │                                 │
      Source Facts / Evidence           Operation Tracking
             │                                 │
             └────────────────┬────────────────┘
                              │
                Application Context Projection
                              │
        ┌─────────────────────┼─────────────────────────┐
        │                     │                         │
 Journey Runtime      Architecture Model        Diagnosis Engine
        │                     │                         │
        └─────────────────────┼─────────────────────────┘
                              │
                    UI Read Projections
                              │
        Home / Overview / Tasks / Architecture / Focused Workspaces
```

## 32.2 Source Adapter

每个外部系统 adapter 负责：

* identity mapping；
* read current status；
* normalize source fact；
* submit supported delegated action；
* poll or receive updates；
* create evidence；
* expose source links；
* report freshness and errors。

## 32.3 状态更新

优先级：

```text
Webhook / event
→ Scheduled polling
→ User-triggered refresh
→ Manual confirmation
```

不能依赖用户刷新页面后才更新 Journey。

## 32.4 Journey Runtime

负责：

* dependency evaluation；
* condition evaluation；
* recommended next step；
* completion criteria；
* evidence evaluation；
* active and blocked time；
* support route resolution；
* state conflict detection。

Journey Runtime 不负责实现 TFE 或 Harness 的业务执行逻辑。

## 32.5 Architecture Model

Architecture Model 合并：

```text
Current discovered state
+
Governed application mapping
+
Proposed change set
+
Execution state
+
Post-execution actual state
```

同一个稳定 node identity 贯穿：

```text
Current
→ Proposed
→ Provisioning
→ Actual
```

## 32.6 Diagnosis Engine

Diagnosis Engine 负责：

```text
Resolve context
→ Identify relevant time window
→ Collect evidence
→ Apply known rules
→ Correlate recent changes
→ Produce hypotheses
→ Recommend actions
→ Prepare support handoff
```

AI 只能在 evidence-grounded 的范围内：

```text
Read
Explain
Diagnose
Prepare
```

不能自主进行生产修改。

## 32.7 Authorization 与 Audit

每个 delegated action 必须记录：

* 当前企业身份；
* Application；
* Environment；
* requested action；
* input；
* permission decision；
* confirmation；
* source operation；
* result；
* evidence。

Atlas 不代理 approver 身份，也不复制外部审批规则。

---

# 33. 用户可见命名规范

## 33.1 使用结果语言

推荐：

```text
Add a database
Promote v2.4.1 to UAT
Request deployment access
Validate runtime configuration
Diagnose deployment failure
```

避免：

```text
Create RDS
Run Scaffolder
Create SailPoint request
Open Terraform workflow
Run debug
```

系统名称放在次级信息：

```text
Request deployment access
Handled by SailPoint
```

## 33.2 页面名称

| 产品概念                 | 用户可见名称                            |
| -------------------- | --------------------------------- |
| Task Center          | Tasks                             |
| Scaffolder           | Infrastructure change             |
| Capability Pack      | Capability                        |
| Diagnosis            | Diagnose / Investigation          |
| Application metadata | About this application            |
| SupportRoute         | Get help                          |
| DelegatedOperation   | Run / Request / Change，按具体场景      |
| Golden Path          | Journey 名称，不要求用户理解 Golden Path 术语 |

---

# 34. 错误、空状态与数据缺口

## 34.1 Empty Tasks

```text
No active tasks

There are no journeys, changes or diagnoses currently in progress for this
application. Use Start to find an applicable journey or action.
```

## 34.2 Empty Architecture

```text
Architecture is not available yet

Atlas has not resolved enough infrastructure data to build a reliable graph.
Known sources:
✓ AWS account
× TFE workspace mapping
? Unmanaged resources

[ Resolve workspace mapping ] [ Open support route ]
```

## 34.3 Source Disagreement

```text
Conflicting application state

Harness reports deployment success, but runtime validation is failing.
Atlas cannot mark this deployment as verified.
[ Diagnose ]
```

## 34.4 Stale Data

所有关键状态必须显示：

```text
Last checked
Source
Freshness
Last known state
```

---

# 35. Accessibility 与交互约束

* 状态不能只依赖颜色；
* Graph 节点必须支持 keyboard focus；
* 每个 status icon 有文字说明；
* Animation 支持 reduced motion；
* Graph transition 不应影响 state comprehension；
* External links 明确说明将离开 Atlas；
* 用户提交 delegated action 前必须看到责任系统；
* 失败时焦点自动移动到错误摘要；
* 长 Journey 导航支持搜索或折叠 phase，但不能隐藏 blocking step；
* Reference image 必须有文字说明和替代内容。

---

# 36. 产品指标

Atlas 的 North Star 是第一次成功 DEV Deployment，但必须拆分 total lead time、active user time 和 blocked time。现有产品定义也明确要求关注工具切换、重复输入、人工 handoff、Action success、Journey completion 和 diagnosis time，而不是只关注 page view。

## 36.1 用户结果指标

```text
Median time to first successful DEV deployment
P75 time to first successful DEV deployment
Journey completion rate
First deployment success rate
Mean time to diagnose
Diagnosis to resolution rate
```

## 36.2 Atlas 可控指标

```text
Manual input count
Repeated input count
System switches
Manual handoffs
Automatically resolved steps
Blocked duration visibility
Action success rate
Evidence-backed completion rate
Diagnosis without support handoff
Mean time to identify responsible team
```

## 36.3 产品质量指标

```text
Recommendation acceptance
Recommendation override rate
State freshness coverage
Unknown state frequency
Conflicting evidence frequency
Support route accuracy
Architecture graph source coverage
```

---

# 37. 对管理层的低成本价值展示

不需要先制作管理层专属页面。

推荐 Demo 叙事：

```text
1. 用户使用企业身份进入 Atlas
2. Atlas 创建 provisional onboarding subject
3. 已知信息自动带入
4. 用户只决定少数无法推断的信息
5. Atlas 提交 delegated access request
6. Atlas 显示当前责任方和等待状态
7. Atlas 帮助创建 infrastructure 和 delivery setup
8. 一次 deployment 失败
9. Atlas 自动定位失败 stage、证据和推荐动作
10. 用户修复并重新执行
11. 第一次 DEV deployment 成功
12. Atlas 展示完整 evidence package
```

管理层可以直观看到：

* Atlas 没有重建 SailPoint、TFE 或 Harness；
* Atlas 把碎片化系统变成一条受治理的 outcome；
* 用户减少输入、切换和协调；
* 平台团队获得标准化消费路径；
* 每个步骤、等待和失败都可测量。

---

# 38. 分阶段实现建议

## Phase 1：Onboarding 纵向证明

实现：

```text
Identity
OnboardingSubject
Application resolution
Global shell
Onboarding Journey
Step-level support
Delegated access action
Harness setup and deployment tracking
Targeted inline Diagnosis
Overview Lite
Tasks Lite
Evidence
Analytics
```

这一阶段优先证明真实团队完成第一次 DEV Deployment。

## Phase 2：日常 Application Workbench

实现：

```text
Full Overview priority model
Tasks aggregation
Start launcher
About panel
Environment and version summary
Recent changes
Cross-application Home triage
Contextual support
```

## Phase 3：Architecture 与 Infrastructure Change

实现：

```text
Application Architecture Model
Graph current state
Capability definitions
Add capability
Change infrastructure
Configure / Review / Execute & track
TFE plan and apply evidence
```

## Phase 4：Promote

实现：

```text
Version and environment projection
Promotion Journey
Readiness gates
Source / target comparison
Delegated execution
Validation
Diagnosis
```

## Phase 5：Diagnosis 扩展

实现：

```text
Symptom-based entry
Multi-source evidence correlation
Prepared remediation
Diagnosis feedback
Known issue and platform change correlation
```

---

# 39. 尚需通过真实用户验证的问题

以下不是产品方向缺口，而是需要通过原型和真实 Application 验证的 UX 参数：

1. Overview 中最多展示多少 Needs Your Attention；
2. Application verdict 的 critical source 集合；
3. Journey 左栏在 15 个以上 steps 时如何折叠；
4. 多个 Ready steps 的推荐表达；
5. 用户手动确认后，多久等待外部 verification；
6. Graph 默认展示整个 Application 还是当前 Environment；
7. capability pack 的首批用户语言；
8. Review 中 Architecture、IaC、Cost 和 Validation 的信息密度；
9. Promote 的 version source of truth；
10. Support route 和 current responder 的权威数据来源；
11. 哪些步骤允许 browser 或 Local Agent assistance；
12. Diagnosis 的 confidence 使用 High / Medium / Low 是否足够；
13. Tasks 页面最近完成项的保留时间。

---

# 40. 最终 UX 骨架

```text
GLOBAL
├── Home
│   ├── Identity resolution
│   ├── Multi-application triage
│   └── Application selection
│
├── Onboard
│   ├── Onboarding start
│   └── Onboarding focused workspace
│
└── Catalog
    ├── Capability discovery
    ├── Official guidance
    ├── Availability
    └── Support discovery


APPLICATION WORKBENCH
├── Header
│   └── Start launcher
│
├── Overview
│   ├── Application verdict
│   ├── Needs your attention
│   ├── In progress / waiting
│   ├── Environment and version summary
│   ├── Cost and readiness signals
│   ├── Architecture summary
│   └── Recent significant changes
│
├── Tasks
│   ├── Needs you
│   ├── Running
│   ├── Waiting
│   └── Recently completed
│
└── Architecture
    ├── Current graph
    ├── Resource and connection context
    ├── Add capability
    └── Change infrastructure


FOCUSED WORKSPACES
├── Onboarding Journey
├── Infrastructure Change
│   ├── Select goal
│   ├── Configure
│   ├── Review
│   └── Execute & track
│
├── Promotion Journey
│   ├── Version and target
│   ├── Compare
│   ├── Readiness
│   ├── Review
│   ├── Execute
│   └── Validate
│
└── Diagnosis
    ├── Inline conclusion-first view
    └── Full evidence and remediation view
```

最终 sidebar：

```text
Overview
Tasks
Architecture
```

其背后的产品逻辑是：

> **Overview 用于判断，Tasks 用于继续，Architecture 用于理解和改变。**

而具体动作始终出现在最接近用户意图和对象的上下文中：

```text
Onboard → 全局入口
Start → Application 顶栏
Promote → version / environment
Add capability → Architecture
Diagnose → failure / symptom
Continue → Tasks
```

Header `Start` 解决可发现性，具体页面中的 CTA 提供更精准的上下文。
