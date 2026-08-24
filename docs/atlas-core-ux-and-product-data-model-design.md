# Atlas 核心用户体验与产品数据模型设计

**状态：** UX shaping draft
**日期：** 2026-08-24
**来源与依据：**
* [`Atlas.md`](../Atlas.md)：产品定位与愿景、四项核心体验原语（View / Action / Journey / Diagnosis）、状态真实性（Honesty Model）及职责边界。
* [`Atlas_Strategy.md`](../Atlas_Strategy.md)：成果导向平台策略、分阶段演进路线（Phase 1–2 与扩展）及三大典型业务场景（Onboarding / Diagnosis / Daily Workbench）。
* [`docs/app-centric-experience-architecture.md`](./app-centric-experience-architecture.md)：以身份为锚点的信息架构、全局与应用工作台双层 Shell、稳定导航与动态任务分离规范。
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

这些内容并没有被删除，而是回归到与用户任务相关的具体上下文中：

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

`Work` 语义过于抽象，用户难以预判页面内容；`Activity` 偏向历史日志；`Operations` 容易被误解为生产运维；`Processes` 偏向企业审批与流程；`Journeys` 又无法覆盖 Infrastructure Change、Promotion、Diagnosis 与独立 Action。

`Tasks` 虽非底层对象最严格的领域抽象，但最符合用户直觉：

> 与当前 Application 相关、可以继续推进、评审、观察或处理的事项。

`Tasks` 与系统的交互契约一致，直接代表用户希望完成的目标。

这里的 `Tasks` 是**用户侧的导航概念与读取投影（Read Projection）**，不要求底层所有对象继承同一个 Task 数据模型。

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

页面按照用户当前与任务的协作关系组织，而非按底层对象类型分类：

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

Sidebar 导航标签的核心在于**提升用户的识别速度**，而非机械复述内部数据结构。Atlas 底层的 `JourneyRun`、`InfrastructureChangeRun`、`PromotionRun` 和 `DiagnosisCase` 保持独立建模，仅投影到统一的 Tasks 页面。

## 1.3 Application 顶栏提供 `Start`

Application Workbench 提供一个直观、稳定且具备上下文感知能力的启动入口。

在 Application 顶栏右侧提供：

```text
[ Start ▾ ]
```

它不占用 sidebar，也不跳转为独立页面。Start Launcher 会根据 Application Context 动态筛选事项，默认展示 2–4 个推荐操作、少量其他可用操作以及全局搜索入口。

具体页面中的上下文 CTA 依然保留：

```text
Architecture → Add capability
Environment version → Promote
Failed deployment → Diagnose
Journey step → Request access
```

## 1.4 核心产品边界

Atlas 是一个以应用为中心（Application-centric）、面向多云的 Developer Experience Platform。Atlas 负责体验编排、指导建议、状态聚合、可信证据与跨系统协同；底层平台继续掌管资源执行、授权审批与领域事实。

职责划分如下：

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

Atlas 不替代 SailPoint、ServiceNow、TFE、Harness、云控制台和 Observability 平台，其核心价值在于消除用户在多个系统之间手动理解与拼接上下文的负担。

---

# 2. 产品目标与价值主张

## 2.1 核心用户

核心用户定义为：

> 负责将应用接入、建设和维护在云平台上的应用团队成员。

具体角色可能是 Developer、Tech Lead 或 Application Owner，Atlas 统一其核心工作流，不设计三套独立 persona。

用户可能面临的典型场景包括：

* 尚未创建 App Code；
* 尚未建立 repository；
* 尚未生成可部署的 deployable artifact；
* 对目标云平台不熟悉；
* 对 Terraform 等 IaC 工具不熟悉；
* 已有存量应用，需要扩充或修改云资源；
* 需要跨环境 Promote version；
* 日常检查应用运行与健康状态；
* 正在排查并恢复具体运行错误。

## 2.2 用户真正来 Atlas 的原因

Atlas 的设计围绕用户意图展开，而非始于底层系统的连接关系。核心意图涵盖：理解、观察、决定、行动、完成与恢复。

在实际界面中，可收敛为四种核心用户动机：

| 用户动机           | 用户心里的问题                                           |
| -------------- | ------------------------------------------------- |
| **Understand** | 我的应用现在是什么情况？                                      |
| **Complete**   | 我怎样完成 Onboarding、Promote 或 Infrastructure Change？ |
| **Recover**    | 为什么失败？下一步怎么办？                                     |
| **Find**       | 正确的信息、参数、平台能力和支持在哪里？                              |

## 2.3 对用户的价值

Atlas 的价值不在于将多个外部链接简单聚合在同一页面，而在于实质降低以下认知与操作成本：

| 用户成本   | Atlas 提供的改善                                |
| ------ | ------------------------------------------ |
| 发现成本   | 明确指引目标位置、适用流程与负责团队                       |
| 判断成本   | 自动注入上下文、推荐合理配置、解释影响与命名规则                         |
| 协调成本   | 统一管理跨系统依赖、责任方、等待状态与 handoff                    |
| 输入成本   | 避免重复填报 Application、Environment、Account 等基础信息 |
| 切换成本   | 在可行时直接代理提交，必要时携带预填数据直达外部系统                    |
| 等待不确定性 | 明确显示阻塞节点、当前负责团队及最后更新时间                        |
| 恢复成本   | 自动聚合失败现场上下文，输出可信证据与下一步修复路径                         |
| 验证成本   | 基于真实源系统凭证（Evidence）验证交付结果是否达成                      |

Atlas 的核心体验目标是：

> 让用户无需感知异构组织与工具边界，即可端到端交付业务结果。

## 2.4 对管理层的价值

管理层初期无需单独构建管理大屏。

最具说服力的价值验证闭环为：

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

战略首个关键验证点（Proof Point）即：真实业务团队通过 Atlas 完成 AWSF Onboarding 并顺利实现首次 DEV 环境成功部署。

管理层由此获得：

* 受治理的 Golden Path；
* 跨系统执行状态端到端透明；
* 责任边界与阻塞原因清晰可见；
* 标准化的平台能力消费方式；
* 可精确度量的 onboarding 和 diagnosis 效率；
* 无需重构底层基础设施执行平台的较低实施成本。

---

# 3. UX 核心原则

## 3.1 Application 是上下文，不是所有体验的唯一入口

进入 Application 后，所有页面统一继承以下上下文：

```text
Application
Environment
Identity
Team
Permissions
Related platform context
```

但 Onboarding 允许在标准 Canonical Application 创建之前发起；Catalog 也支持在脱离具体 Application 上下文时全局浏览。

## 3.2 稳定导航与动态工作分离

Sidebar 表达长期稳定的工作空间：

```text
Overview
Tasks
Architecture
```

动态任务不作为常驻 sidebar item。

例如：

```text
Continue AWSF onboarding
Review PostgreSQL change
Promote v2.4.1 to UAT
Diagnose deployment #1428
```

这些事项均由 Overview、Tasks 或具体关联对象承载。

## 3.3 操作入口必须与上下文绑定

避免设置宽泛的泛化操作入口：

```text
Generic Debug
Generic Promote
Generic Add resource
```

所有操作入口均携带明确上下文：

```text
Promote v2.4.1 from DEV to UAT
Add a database capability to payments-api
Change ECS scaling in DEV
Diagnose deployment #1428
Investigate why DEV is not reachable
```

## 3.4 直接开始新事务的入口

若仅依赖 Overview、Architecture、Environment 或已有错误对象中的间接入口，会导致用户在想发起新任务时不知道该先进入哪个页面。

因此，Application Workbench 需要一个直接、稳定且具备上下文感知能力的启动入口。

### 入口位置

在 Application 顶栏右侧提供：

```text
[ Start ▾ ]
```

它不占用 sidebar，也不跳转为独立页面。

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Atlas   Ask about payments-api...    payments-api ▾  DEV ▾ [ Start ]│
└──────────────────────────────────────────────────────────────────────┘
```

`Start` 相比其他命名的优势：

* `New`：容易被狭义理解为新建云资源；
* `Create`：无法准确涵盖 Promote 与 Diagnose；
* `Action`：偏向产品内部实现术语；
* `Start a task`：文案偏重；
* `Quick Start`：更像静态新手教程模块。

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

1. **使用面向用户目标的业务语言**

   展示：

   ```text
   Add a PostgreSQL database
   Promote v2.4.1 to UAT
   Request deployment access
   Investigate a problem
   ```

   避免直接暴露底层执行细节：

   ```text
   Start InfrastructureChangeRun
   Launch Scaffolder
   Create RDS resource
   Execute Harness workflow
   ```

2. **根据 Application Context 智能筛选**

   Atlas 仅展示当前 Application 实际适用的事项：

   * 匹配当前 cloud 与 workload 支持范围；
   * 当前用户具备查看或发起权限；
   * 前置条件（prerequisites）已满足，或能清晰解释缺失项；
   * 当前无同类冲突操作在执行；
   * 具备合理的环境与版本上下文。

3. **提供明确的推荐理由**

   例如：

   ```text
   Recommended because DEV has v2.4.1 and UAT is still running v2.4.0.
   ```

4. **保持聚焦，不退化为静态模板目录**

   Start Launcher 保持紧凑，默认展示：

   * 2–4 个高优先级推荐结果；
   * 少量其他可用常用操作；
   * 搜索入口。

   全量 capability 与文档发现依然归属 Catalog。

5. **就近上下文入口依然保留**

   Header `Start` 解决全局操作的可发现性；具体页面内的 CTA 提供精准的就近直达：

   ```text
   Architecture → Add capability
   Environment version → Promote
   Failed deployment → Diagnose
   Journey step → Request access
   ```

   交互路径遵循 `Intent → Context → Recommended choice → Minimal inputs → Action → Result` 的高效收敛。

### 实现投影

Start Launcher 使用独立的读取投影（Read Projection），无需绑定重型领域模型：

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

其来源分别映射自：

```text
JourneyDefinition
CapabilityDefinition
GovernedActionDefinition
PromotionEligibility
DiagnosisEntryDefinition
```

## 3.5 最少提问

Atlas 按照以下优先级获取参数：

```text
1. 从已知 Application context 推导
2. 从权威 source system 获取
3. 使用平台治理默认值
4. 生成推荐默认值
5. 最终才向用户确认必要决策
```

用户仅需决定系统无法安全推断的事项。

## 3.6 状态必须诚实

Atlas 清晰标明每项状态的事实来源：

* 实际观测到的源系统事实（Observed）；
* 根据多项事实推导的复合状态（Derived）；
* 用户主动填报的声明（Declared）；
* Atlas 自身维护的状态（Atlas-owned）；
* 当前未知或数据源离线（Unknown）。

任务完成（Done）原则上必须关联可信的 Evidence 凭据。

## 3.7 Delegated execution

Atlas 负责准备、触发和追踪操作，并向用户明确展示实际掌管底层执行的系统：

```text
Atlas prepared the request
SailPoint owns authorization

Atlas triggered the deployment
Harness owns deployment execution

Atlas generated the proposed IaC
TFE owns plan and apply
```

Provision、Deploy、Access、Approval 和 Operate 的实际执行职责完整保留在相应领域平台。

---

# 4. 全局信息架构

## 4.1 全局 Shell

### 用户为什么来到这里

用户进入 Atlas 全局层，核心诉求包括：

* 回到未完成的工作流；
* 发起新应用接入（Onboard）；
* 查找平台能力、权威文档或支持渠道；
* 切换进入目标 Application 工作台。

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

`Home / Onboard / Catalog` 属于全局目的地，不进入具体 Application 的 sidebar 导航。

---

## 4.2 Application Workbench Shell

### 用户为什么来到这里

用户已选定特定 Application，需要在其上下文内持续查看健康状态、推进任务或调整架构。

### Atlas 需要提供

* Application selector；
* Environment selector；
* Contextual Ask；
* Application verdict；
* 稳定的三项一级 sidebar；
* About 和上下文帮助；
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

Sidebar 不设置独立常驻项：

```text
About
Support
Settings
```

About 由顶栏 Application 名称或信息图标直接唤出抽屉；Help 与 Support 由当前页面、具体步骤或错误对象就近提供。

---

## 4.3 Focused Workspace Shell

Onboarding、Promotion、Infrastructure Change 和完整 Diagnosis 均属于需要高专注度的任务流程。

进入这些任务时，Application Workbench 整体切换为全屏沉浸式的 Focused Workspace：

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

避免常规 Application sidebar 与步骤导航同时并存，减少多层导航对注意力的分散。

---

# 5. Home UX

## 5.1 用户为什么来到这里

用户需要了解：

* 哪些 Application 存在待办或异常；
* 是否有未完成的工作可以继续；
* 自身团队拥有哪些 Application；
* 是否需要切换进入某个具体 Application。

## 5.2 用户此刻要完成什么

Home 不承载复杂的单应用运维操作，其核心目标为：

```text
跨 Application 分诊
→ 选择正确 Application
→ 进入具体工作
```

## 5.3 用户不知道什么、被什么阻塞

用户可能面临的不确定性包括：

* 哪个 Application 出现了故障或告警；
* 哪项任务当前正等待自己处理；
* 自身企业身份是否已正确映射至应用；
* 某个阻塞状态是由于外部等待还是缺失配置；
* 多个 Application 中应该优先处理哪一个。

## 5.4 Atlas 提供什么

根据身份解析结果提供针对性界面：

### 没有解析到 Application

不直接断言用户名下无应用，而是提供清晰的排查与创建路径：

* 提示当前身份尚未关联 Application；
* 提供存量 Application 查找入口；
* 提供新 Application 接入（Onboard）入口；
* 提供身份映射异常反馈渠道。

### 一个 Application

直接进入该 Application 的 Overview 页面。

### 多个 Application

展示跨 Application 分诊台：

* Needs your attention（需当前用户处理的事项）；
* Work in progress（进行中的任务）；
* Waiting（等待外部处理的事项）；
* Application list（全量应用列表）。

## 5.5 多 Application ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Atlas        Home        Onboard        Catalog          Search / Ask    User │
├──────────────────────────────────────────────────────────────────────────────┤
│ Hi, Ziyu                                                                     │
│ 4 applications · 2 require your attention                                    │
│                                                                              │
│ NEEDS YOUR ATTENTION                                                         │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ payments-api · DEV deployment failed                                     │ │
│ │ Deployment #1428 · 18 minutes ago                         [ Diagnose ]   │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ ledger-api · Runtime configuration requires input                        │ │
│ │ AWSF onboarding · Step 6 of 9                             [ Continue ]   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ IN PROGRESS / WAITING                                                        │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ inventory-api · Access request                                           │ │
│ │ Waiting for Identity Platform · REQ-4821 · Last checked 6 min ago        │ │
│ │                                                               [ View ]   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ MY APPLICATIONS                                                              │
│ payments-api       Action required      DEV / UAT / PROD                     │
│ ledger-api         Action required      Onboarding                           │
│ inventory-api      Waiting              DEV                                  │
│ report-service     No action required   DEV / PROD                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 5.6 零 Application ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ No applications are linked to your profile                                   │
│                                                                              │
│ This may mean:                                                               │
│ · You are onboarding your first application                                  │
│ · An existing application has not been mapped to your identity               │
│ · You need access to another team's application                              │
│                                                                              │
│ [ Onboard an application ]   [ Find an existing application ]                 │
│ [ Report an identity mapping issue ]                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 6. Catalog UX

Catalog 承担 Atlas 全局的发现（Discover）与理解（Understand）能力。

## 6.1 用户为什么来到这里

用户需要：

* 查找平台支持的技术能力与组件；
* 查阅权威的平台文档与 Runbook；
* 确认某项能力是否适配自身的 cloud、region 或 workload；
* 找到正确的官方 support route；
* 了解平台近期的演进与规范更新。

## 6.2 用户此刻要完成什么

```text
表达需求
→ 找到正确 capability 或指导
→ 理解适用条件
→ 返回具体 Application context
```

## 6.3 用户不知道什么

* 不清楚平台内部的具体产品代号；
* 无法准确将业务目标映射到底层技术资源；
* 难以辨别散落文档的权威性与时效性；
* 无法确认特定能力是否适用于当前 Application；
* 不明确特定问题应联系哪个平台团队。

## 6.4 Atlas 提供什么

* Intent-based search（基于意图的搜索）；
* Capability mapping（能力与资源映射）；
* 官方文档与更新溯源；
* Availability（支持范围与可用性）；
* Known limitations（已知限制与约束）；
* Application relevance（当前应用的适用性分析）；
* Support route（支持渠道指引）；
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
│ Runtime configuration guide          Platform Engineering · Updated 3d ago   │
│ AWSF onboarding runbook              DevEx · Updated 1w ago                  │
│ ECS supported regions                AWSF · Updated 2d ago                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Catalog 侧重于能力认知、规范指导与意图定位，避免退化为底层表单模板的简单罗列。

---

# 7. Application Overview UX

## 7.1 页面定位

Sidebar 采用：

> **Overview**

其定位为应用的工作大盘（Application Dashboard）。采用 `Overview` 作为导航标签，更能准确体现页面兼顾运行指标监控、任务协同处理、状态判据及全局操作入口的综合定位。

Overview 聚焦回答三个核心问题：

```text
1. Application 当前是否健康？
2. 当前是否需要用户行动？
3. 最近发生了什么，接下来可以做什么？
```

Overview 提供决策所需的上下文摘要，而非平铺所有 Application 数据的监控大屏，避免将 Cost、Resources、Tickets、Logs 和全部历史记录无节制堆叠在单页。

## 7.2 信息层级

Overview 使用四层清晰的信息层级：

### 第一层：Application Context 和直接行动

全局常驻：

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

首屏核心视区直接回答：

* Application 是否健康；
* 哪些 environment 存在异常；
* 是否需要当前用户介入处理；
* 最重要的 primary action 是什么。

### 第三层：运行趋势与正在进行的工作

展示核心运行与交付状态：

* health metrics；
* environment/version；
* deployment；
* active Tasks；
* waiting operation。

### 第四层：辅助判断信息

轻量呈现关联上下文：

* cost；
* log signal；
* architecture summary；
* recent changes。

辅助信号保持克制的视觉权重，不干扰核心健康裁决与待办决策。

---

## 7.3 Overview ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Overview                                                                     │
│ payments-api    All environments ▾    Last 24 hours ▾    [ Start ▾ ]         │
│ Sources updated 3 minutes ago                                                │
│                                                                              │
│ ┌─ HEALTH & TRAFFIC ────────────────────────────┬─ NEEDS YOUR ATTENTION ───┐ │
│ │                                               │                           │ │
│ │  DEGRADED                                     │ 2 items                   │ │
│ │  DEV has an elevated error rate               │                           │ │
│ │                                               │ ● DEV deployment failed   │ │
│ │  DEV ● Degraded   UAT ● Healthy               │   #1428 · 18 min ago      │ │
│ │  PROD ● Healthy                               │             [ Diagnose ]  │ │
│ │                                               │                           │ │
│ │  Error rate        1.84%                      │ ● Runtime config missing  │ │
│ │  0%   ▁▁▂▂▃▆█▅▃▂                threshold ┄   │   2 required values       │ │
│ │                                               │             [ Continue ]  │ │
│ │  P95 latency       428 ms                     │                           │ │
│ │  0    ▁▂▂▃▂▅█▆▃▂                               │ [ View all tasks ]         │ │
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
│ │     │                 │                │       │             [ Continue ]  │ │
│ │     └──── newer ──────┘                │       │                           │ │
│ │                       └── version drift┘       │ Promote v2.4.1 to UAT     │ │
│ │                                               │ 5 of 6 gates passed       │ │
│ │  Deployment success · Last 7 days             │                 [ Open ]  │ │
│ │  Mon  Tue  Wed  Thu  Fri  Sat  Sun             │                           │ │
│ │   8    7    9    6    4    8    5             │ Access request            │ │
│ │  ███  ███  ███  ██   ██   ███  ██             │ Waiting for platform      │ │
│ │              × 1 failed                       │                 [ View ]  │ │
│ │                                               │                           │ │
│ │  Latest deployment #1428 · DEV · Failed       │ [ View all tasks ]        │ │
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
│ │ No anomaly detected      │ Missing secret reference  │                     │ │
│ │ [ View cost source ]     │ [ Open related logs ]     │ 7 managed resources │ │
│ │                          │                            │ [ Open architecture]│ │
│ └──────────────────────────┴────────────────────────────┴─────────────────────┘ │
│                                                                              │
│ RECENT CHANGES                                                               │
│ 10:42  Deployment #1428 failed in DEV                                        │
│ 09:15  SailPoint request REQ-4821 moved to In progress                       │
│ Yesterday  Runtime configuration changed                                     │
│                                                         [ View more ]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 7.4 不同信息使用不同视觉形式

Overview 避免将所有内容呈现为完全相同大小的文字卡片：

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

Overview 不平铺展示完整原始日志流。

Atlas 仅提取用于异常识别的高阶摘要：

```text
Error event count
Trend
Top error signatures
Affected environment
Relevant failed run
```

然后提供直达下钻入口：

```text
Open related logs
Diagnose
```

Atlas 聚合运行时状态与日志以辅助决策与排障，并不替代专业 Observability 平台。底层平台继续拥有执行和领域事实，Atlas 掌管上下文、体验、状态与证据。

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
* Needs Attention 区收起或隐藏；
* Environment、Tasks 和 Trends 上移；
* 不保留空白占位卡。

异常状态下：

* Health 和 Needs Attention 扩大；
* Cost、Architecture 等次级信息下移以强化聚焦。

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

Overview 仅承载：

```text
判断所需摘要
+
明确入口
```

完整工作流进入专用页面：

```text
Tasks
Architecture
Promotion workspace
Diagnosis workspace
Source system
```

### 规则五：不重复展示同一件事

如果 deployment failure 已经作为最高优先级 `Needs Attention`：

* Health 区只表达其对 Application 可用性的影响；
* Active Tasks 不再复制一张完全相同的失败卡片；
* Recent Changes 仅保留单行时间线事件。

### 规则六：图表必须有决策价值

避免引入无效修饰：

* 禁止缺少真实时间序列的假 sparkline；
* 禁止缺少 threshold 或比较基准的孤立数字；
* 禁止无法解释来源算法的综合 health score；
* 禁止仅为填充空间的占位图表；
* 禁止脱离上下文的总资源数罗列。

Workbench 默认内容必须能够直接帮助用户做出决定、执行下一步、理解故障、定位责任人或验证结果，否则不进入 Overview。

---

## 7.6 Overview Read Model 调整

`ApplicationOverviewProjection` 模型结构为：

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

必须包含来源溯源元数据：

```text
Source
Retrieved at
Time range
Unit
Threshold or comparison baseline
Freshness
```

Overview Projection 专用于前端视图渲染，不充当底层领域实体的 System of Record。

---

# 8. Application Tasks UX

## 8.1 页面命名

Sidebar 导航：

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

* 查阅当前 Application 正在进行的所有异步任务；
* 继续推进某项暂存的 Journey；
* Review 某个待确认的 Infrastructure Change；
* 查看 Promotion 进度与审批状态；
* 确认正在等待平台处理的申请事项；
* 回看近期完成的任务结果与留存凭证。

## 8.3 用户此刻要完成什么

```text
找到正确任务
→ 理解当前状态与责任方
→ 继续、Review、Diagnose 或查看结果
```

Tasks 页面聚合已有任务。启动新事务由顶栏 `Start` 和就近上下文 CTA 负责。

## 8.4 用户不知道什么、被什么阻塞

用户可能面临的不确定性：

* 哪项工作需要自己立即处理；
* 哪项工作仍在平台后台自动化运行；
* 哪项工作正等待外部团队审批或处理；
* 某个 Journey 和某个具体失败是否属于同一工作流；
* 某个变更操作最终是否通过了实际环境验证；
* 该从哪个具体步骤恢复执行。

## 8.5 Atlas 提供什么

Tasks 按用户与任务的协作关系分组，而非按领域对象类型分类：

```text
Needs you
Running
Waiting
Recently completed
```

提供次级筛选维度：

```text
All
Onboarding
Infrastructure
Promotion
Diagnosis
```

这些类型仅作为筛选器，不作为一级信息架构。

## 8.6 ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Tasks                                                   [ All types ▾ ]      │
│ Things to continue, review, monitor or resolve.                              │
│                                                                              │
│ NEEDS YOU · 2                                                                │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Review PostgreSQL capability change                                      │ │
│ │ Infrastructure change · DEV                                              │ │
│ │ Proposed architecture is ready · Cost estimate available                 │ │
│ │ Updated 12 minutes ago                                    [ Review ]     │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ Provide runtime configuration                                            │ │
│ │ AWSF onboarding · Step 6 of 9                                            │ │
│ │ Two values cannot be safely inferred                     [ Continue ]    │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ RUNNING                                                                      │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Promote v2.4.1 from DEV to UAT                                           │ │
│ │ Readiness · 5 of 6 gates passed                                          │ │
│ │ Current responsibility: Application Team                  [ Open ]       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ WAITING                                                                      │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ AWSF deployment access                                                   │ │
│ │ Responsible team: Identity Platform                                      │ │
│ │ SailPoint request REQ-4821 · Waiting 2 days · Checked 6 min ago          │ │
│ │                                                               [ View ]   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ RECENTLY COMPLETED                                                           │
│ Add S3 backup capability        Verified by TFE apply       Yesterday        │
│ Promote v2.3.9 to PROD          Verified by Harness         3 days ago       │
│ Diagnose connector mismatch     Resolution confirmed        5 days ago       │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 8.7 Task item 的 UX 内容

每个 Task item 包含以下核心内容：

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

* 理解当前 Application 在各环境下的云上结构；
* 查看 resource 和 connection 拓扑；
* 为应用增加某项 capability；
* 修改现有 infrastructure 配置；
* 对比当前状态（Current state）与变更方案（Proposed state）；
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

用户可能面临的不确定性：

* 达成目标需要哪些底层原子 resources；
* capability pack 内部封装了什么；
* 某个 resource 与其他 resource 如何连通与鉴权；
* 哪些资源由 Atlas 托管，哪些是外部依赖；
* 当前架构拓扑数据是否完整与实时；
* 改动是否会造成 replacement 销毁重建、downtime 或成本剧增；
* 应该如何填写复杂的 Terraform 变量。

## 9.4 Atlas 需要提供什么

Architecture 页面以 Graph 作为主要视觉交互对象。

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

界面不提供自由无约束的空白画板式拖拽连线，也不向业务用户倾倒全量底层 Terraform provider resource catalog，而是以治理后的 Capability Pack 作为主要消费单元。

## 9.5 ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Architecture                 Environment: DEV ▾        Refreshed 4 min ago   │
│                                                                              │
│ [ Add capability ]   [ Change infrastructure ]                               │
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
│ │                    /                                    │ warnings · 1  │ │
│ │                   ▼           ▼                          │               │ │
│ │              Secrets        Logs                         │ ACTIVE CHANGE │ │
│ │                                                         │ Add PostgreSQL│ │
│ │                    ─ ─ ─ Unknown dependency              │ Ready review  │ │
│ │                                                          │ [ Continue ]  │ │
│ └──────────────────────────────────────────────────────────┴───────────────┘ │
│                                                                              │
│ Selected: ECS Service                                                        │
│ Current state · Runtime · Connections · Source · Freshness                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 9.6 Graph 的复用定义

跨生命周期统一复用的是：

* Application resource identity；
* connection identity；
* current infrastructure；
* proposed additions and modifications；
* execution state；
* post-execution actual state。

不强制复用单一视觉形式：

* 同一布局；
* 同一 zoom；
* 同一环境范围；
* 同一信息密度；
* 同一种 projection。

同一个 Application Architecture Model 可以生成：

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

`Details` 不作为独立 sidebar item。

## 10.1 用户为什么来到这里

用户需要快速确认应用级元数据：

* Application identity；
* Owner 和 Team；
* App Code；
* repository；
* account / subscription；
* workspace；
* pipeline；
* support route；
* source freshness。

## 10.2 Atlas 提供什么

点击顶栏 Application 名称或 `About` 图标，打开右侧抽屉面板。

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

所有外部事实均标注来源系统与数据同步时效。

---

# 11. Onboarding Start UX

## 11.1 用户为什么来到这里

用户需要将一个尚未在平台完全建立的应用推进至第一次成功 DEV Deployment。

用户在此阶段可能处于零资产状态：

* 没有 App Code；
* 没有 repository；
* 没有 source code；
* 没有 artifact；
* 没有 platform account；
* 不掌握 Terraform 知识。

## 11.2 用户此刻要完成什么

创建一个可以跨会话保存的 Onboarding context，并启动标准的 AWSF Onboarding Journey。

## 11.3 用户不知道什么、被什么阻塞

用户可能面临的不确定性：

* 平台内是否已存在同名 Application；
* 自己归属于哪个 owning team；
* 当前是否必须具备 App Code；
* repository 是否必须先行创建；
* 后续流转会经过哪些平台；
* 自己当前需要准备什么材料。

## 11.4 Atlas 需要提供什么

Atlas 初始化一个临时主体 `OnboardingSubject`。

它关联：

* Initiating user；
* Owning team；
* Participants；
* Working application name；
* 已知的前置 identifier；
* Onboarding Golden Path version。

开始时仅向用户收集建立临时身份所需的最小信息。

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

如果检测到匹配的 canonical Application，Atlas 提示用户确认绑定，避免产生重复实体。

---

# 12. Onboarding Journey UX

## 12.1 用户为什么来到这里

用户要继续推进一条已开始的 Onboarding Journey。

他需要了解：

* 当前推进到哪一步；
* 哪些步骤已经通过验证；
* 当前卡在哪里及阻塞原因；
* 当前步骤由谁负责；
* 下一步推荐的操作是什么；
* 是否已经产出可验证凭证（Evidence）。

## 12.2 用户此刻要完成什么

完成当前就绪的 Journey step，并推动整个 Onboarding 直至达成首次成功 DEV Deployment。

## 12.3 用户不知道什么、被什么阻塞

用户可能面临的不确定性：

* 哪些步骤属于推荐的下一步；
* 是否存在可并行执行的步骤；
* 某一步骤受阻的具体原因；
* 某个输入字段应该填什么；
* 外部系统的异步操作是否已完成；
* 遇到问题应该向谁求助；
* 用户手动确认是否具备最终效力；
* 某个步骤是否已被已有 evidence 自动满足。

## 12.4 Atlas 需要提供什么

* 真实 phases 和 steps；
* DAG dependency 依赖拓扑；
* selected step；
* recommended next step；
* multiple ready steps 并行展示；
* current responsibility；
* source system 状态同步；
* completion evidence 校验；
* parameter assistance 参数辅助；
* external action assistance 代理支持；
* step-level support 步骤级求助；
* inline diagnosis 行内诊断。

## 12.5 Journey Navigation

不使用泛化的状态标签：

```text
Progress
Completed
Current
Upcoming
Overall Support
```

而是直接呈现真实的阶段与步骤。

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

如果存在多个 Ready step，Atlas 可以标记其中一个为 `Recommended next`，但保持其他 Ready step 完整可见并支持点击切换。

---

# 13. Onboarding Step UX

各 Journey step 遵循统一的信息顺序，同时根据任务类型灵活组织交互。

## 13.1 Step 页面结构

```text
1. What this step achieves（步骤目标说明）
2. Current status and responsibility（当前状态与责任归属）
3. What Atlas already knows（系统已获取的上下文事实）
4. What the user needs to decide or do（用户需决策或操作的内容）
5. What will happen next（后续流转说明）
6. Validation and evidence（验证依据与凭据展示）
7. Step-level support（步骤级支持通道）
```

## 13.2 参数配置 Step

### 用户为什么来到这里

用户需要提供当前步骤无法安全自动推断的配置参数。

### 用户不知道什么

* 参数的实际用途；
* 应该填报什么值；
* 平台命名规则；
* 选项对性能与成本的影响范围；
* 推荐值的来源依据；
* 错误选择可能导致的问题。

### Atlas 提供什么

每个字段提供：

* recommendation（推荐默认值）；
* source（来源溯源）；
* why（推荐依据）；
* impact（影响分析）；
* example（正确示例）；
* naming guidance（命名规范校验）；
* reference image（参考图解）；
* support（求助渠道）。

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

参数按照用户的业务决策维度编排，而非机械按 Terraform variables 顺序平铺。

---

## 13.3 Delegated Action Step

### Atlas 支持的四种用户可见模式

| 用户可见模式                              | 实现方式示例                           |
| ----------------------------------- | -------------------------------- |
| Atlas can complete this             | API 或 MCP delegated action       |
| Review and submit                   | Atlas 预填，用户确认后一键提交                 |
| Continue with guided assistance     | Browser / Local Agent 引导辅助 |
| Open prepared data in source system | 携带预填上下文的 Deep link 跳转    |

用户专注于业务操作本身，无需首先理解 MCP、Local Agent 或 browser automation 的底层机制。

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

提交后不将 step 立即置为 Completed，而是进入异步追踪状态链：

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

明确区分责任团队与底层系统：

```text
Responsible party: Cloud Platform
Execution or tracking system: ServiceNow
```

避免显示为 “Waiting for ServiceNow”。

---

## 13.5 用户手动确认

用户可以主动标记某些线下 manual step 已完成，但 UI 明确说明其验证强度：

```text
Completed
Confirmed by you · Not independently verified
```

如果之后外部源系统同步的数据与用户确认产生冲突：

```text
Verification conflict
External evidence indicates this requirement is not satisfied.
```

该 step 自动重置为：

```text
Needs review
```

避免在存在冲突事实时继续维持绿色的 Done 状态。

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

用户侧采用业务化语汇，不使用 `Scaffolder` 作为功能名称。

## 14.1 用户可见命名

| 场景                  | 用户可见名称                |
| ------------------- | --------------------- |
| 从 Architecture 增加能力 | Add capability        |
| 修改已有资源              | Change infrastructure |
| Focused workspace   | Infrastructure change |
| 内部生成能力              | Scaffolder（保留为工程术语）   |

## 14.2 四个阶段

```text
Select goal
→ Configure
→ Review
→ Execute & track
```

已知上下文直接跳过，不强迫所有用户经历完整选择链。

---

## 14.3 Select Goal

### 用户为什么来到这里

用户希望为应用新增或变更某项云能力。

### 用户此刻要完成什么

表达业务或平台目标，而非直接挑选底层 Terraform resource。

### 用户不知道什么

* 实现目标需要开通哪些底层资源；
* 应该选择 capability pack 还是原子资源；
* 当前 Application 已经开通了什么；
* 某个 capability 是否适用于当前 workload。

### Atlas 提供什么

默认展示 capability pack：

```text
Add a database
Add asynchronous messaging
Expose the service externally
Add secret management
Increase availability
```

原子 resource 仅在平台明确支持其独立、安全消费时开放高级入口。

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

如果入口已明确指定目标（如从 Journey step 进入 `Add PostgreSQL`），则跳过此页面。

---

## 14.4 Configure

### 用户为什么来到这里

用户需要确认无法安全推断的少数设计决策。

### 用户此刻要完成什么

配置 proposed architecture，并直观理解每项选择对 Graph 产生的影响。

### 用户不知道什么

* 必须配置哪些数据库参数；
* 推荐值是否适用于当前环境；
* current 与 proposed architecture 的具体差异；
* capability pack 内部包含的组件明细；
* 哪些设置会影响成本、可靠性与容灾。

### Atlas 提供什么

* Graph 作为主工作区核心视觉；
* current / new / modified 差异标注；
* capability pack grouping 分组；
* 决策面板；
* recommended defaults 与影响说明；
* live Graph 实时响应刷新；
* provenance 来源信息；
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

Graph 占据主空间，决策面板作为辅助控制面。

---

## 14.5 Review

### 用户为什么来到这里

用户需要确认 proposed change 是否安全、合规且可执行。

### 用户此刻要完成什么

全面理解：

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

Graph 与 plan、replacement、security 和 unknown value 等结构化影响清单协同呈现。

---

## 14.6 Execute & Track

### 用户为什么来到这里

用户已经确认 change，希望实时跟踪其异步执行进度。

### 用户此刻要完成什么

* 追踪 delegated execution；
* 完成需要人工介入的操作环节；
* 查阅生成的 artifacts；
* 在失败时启动 Diagnosis；
* 验证 actual state。

### Atlas 提供什么

* 同一 Architecture Graph 的 execution overlay；
* delegated system 状态；
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

代码提交或 PR 创建仅代表变更发起，不作为资源开通完成的判定依据。

---

# 15. Promote UX

Promote 是一条针对特定版本与环境的晋级工作流，而非通用模板页面。

## 15.1 用户为什么来到这里

用户希望将已存在的 Application version 从较低环境安全推进至较高环境。

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

用户可能面临的不确定性：

* 哪个 version 可供 Promote；
* source 和 target 环境的具体配置与架构差异；
* target 环境是否已准备就绪；
* 哪个具体的 readiness gate 产生阻塞；
* 是否存在 infrastructure 或 configuration drift；
* 本次 Promote 是否会带来 cost impact；
* 失败后应向哪个对象和团队求助。

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

Promote 不作为 sidebar item，而是从具体上下文唤出：

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

Readiness 不使用 `82% ready` 这类抽象百分比，而是直观呈现离散的门禁清单：

```text
哪一项 gate 阻塞
为什么
谁负责
如何修复
验证依据是什么
```

## 15.7 Target Environment 不存在

如果 Promote 发现 target environment 尚未开通：

```text
Prepare target environment
```

成为当前 Promotion Journey 中的一个 blocking step。该 step 引用独立的 `InfrastructureChangeRun`，但不复制其完整数据结构。

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

Cost 仅在存在实际变化或可信预估时强化呈现。

---

# 16. Diagnosis UX

## 16.1 入口原则

Diagnosis 优先从已有错误对象启动：

* failed Journey step；
* failed Infrastructure Change；
* failed Promotion；
* failed deployment；
* Dashboard anomaly。

当不存在明确 failed object 时，支持从结构化症状发起：

```text
Application
+ Environment
+ Structured symptom
```

例如：

```text
DEV application cannot be reached
Access was approved but is not active
Expected resource is missing
Deployment succeeded but runtime validation failed
```

不以空白聊天框作为排障起点。

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

用户正在 Journey、Promotion 或 Infrastructure Change 中，某一步突然失败，需在当前现场快速获得诊断。

### 用户此刻要完成什么

快速掌握：

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

证据默认折叠，结论与推荐动作优先呈现。

---

## 16.4 Full Diagnosis

### 用户为什么来到这里

用户专门调查复杂或复合型失败，需要查看完整证据链、不同归因假设和恢复路径。

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

仅在选择 `Something else` 时允许补充简要描述。

---

# 17. Contextual Support UX

Support 不作为 Journey 级固定右栏，也不作为默认 sidebar 独立页面。

## 17.1 Support Route 的解析维度

系统根据多维上下文自动匹配对应的平台支持渠道：

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

`Step Owner` 与 `Current Responder` 明确分离：

```text
Step Owner
= 对该步骤的设计和治理负责

Current Responder
= 处理当前具体 request 或 failure 的团队、队列或人员
```

---

# 18. 状态与责任模型

Journey step 的状态不能由单一 enum 完整表达。

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

责任方必须是指向具备实际处理与行动能力的实体或组织：

```text
Current user
Application Team
Platform Team
Approver
Atlas automation
```

以下底层系统不是责任方：

```text
ServiceNow
SailPoint
Harness
TFE
```

它们属于：

```text
Execution system
Tracking system
State source
```

## 18.4 UI 组合语句

避免仅展示宽泛的单一状态字眼（如 `Waiting / Completed / Failed`），而是组合呈现具体上下文：

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

Application verdict 与技术 health 明确解耦。

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

一个 Application 可以同时处于：

```text
Technical state: Healthy
Verdict: Action required
```

例如应用运行正常，但用户需要补充完成 Production readiness input。

也可以同时处于：

```text
Technical state: Degraded
Verdict: No action required
```

例如平台运维团队已接手故障恢复，当前用户无需操作。

---

# 20. 产品数据模型总体设计

## 20.1 设计原则

不创建膨胀的全局领域模型（如通用的 `Goal / Work / Decision / Change / Issue`）并强制所有场景继承，而是采用三层架构体系：

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

表示可信的企业员工身份：

| 属性                  | 含义                    |
| ------------------- | --------------------- |
| Actor ID            | Atlas 内稳定身份           |
| Enterprise identity | Entra 等可信主体           |
| Display name        | 显示名称                  |
| Team memberships    | 所属团队                  |
| Roles               | 在 Application 或平台上的角色 |
| Permission context  | 可查看和可执行范围             |

Identity 是 Atlas 的核心基础，Atlas 必须明确记录谁在执行操作、谁确认了 manual step、谁触发了 deployment。

## 21.2 Team

主要属性：

* Team ID；
* Name；
* Source；
* Members；
* Application relationships；
* Support relationships。

## 21.3 OnboardingSubject

在 canonical Application 尚未建立时承载 Onboarding 状态：

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

OnboardingSubject 关联团队与发起人，确保在人员变动时团队其他成员仍能继续推进 Journey。

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

Atlas 不直接拥有底层事实，而是维护规范化的上下文投影：

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

每个聚合事实均包含来源元数据：

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

系统明确区分 Golden Path、Journey 和 Action。

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

UI 根据这些依赖信息生成真实的步骤导航。

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

Capability pack 是默认的消费单元。

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

Promotion 采用独立模型，不混用 Onboarding 专属业务字段。

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

Readiness 表现为门禁集合，不默认生成单一复合分数。

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

而非输出缺乏可解释性的精确百分比。

## 26.3 DiagnosisAction

可以包括：

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

用于表示 Atlas 发起或追踪的外部系统真实执行。

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

Operation 执行成功并不直接等同于上层 step 达成目标：

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

Support Member 属于平台角色，Atlas 不为其构建多余的独立 persona。

---

# 30. Tasks Read Model

`Tasks` 页面采用 read projection，不要求所有领域对象继承同一个 Task 数据模型。

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

仅用于 UI 查询与展示，不作为领域真相：

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

分组依据是 actionability 与 responsibility，而非领域对象类型。

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

聚合来源包括：

* failed Journey step；
* required user input；
* failed deployment；
* review-ready Infrastructure Change；
* failed readiness gate；
* stale critical data。

它同样是 UI read model，而非领域父类。

## 31.3 RecentChangeProjection

仅保留对用户判断有帮助的关键变更：

```text
Deployment
Infrastructure change
Configuration change
Access result
Platform change impact
Journey milestone
Diagnosis outcome
```

完整事件日志仍保存在 operation 和 audit 数据中。

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

系统主动维护状态同步，不依赖用户反复刷新页面。

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

Journey Runtime 不负责实现 TFE 或 Harness 的具体执行逻辑。

## 32.5 Architecture Model

Architecture Model 合并以下多维状态：

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

同一个稳定 node identity 贯穿全生命周期：

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

AI 严格在 evidence-grounded 范围内：

```text
Read
Explain
Diagnose
Prepare
```

不能自主向生产环境发起非托管变更。

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

Atlas 不代理 approver 身份，也不复写外部审批规则。

---

# 33. 用户可见命名规范

## 33.1 使用结果语言

推荐采用直观的业务目标表述：

```text
Add a database
Promote v2.4.1 to UAT
Request deployment access
Validate runtime configuration
Diagnose deployment failure
```

避免直接暴露底层系统与命令：

```text
Create RDS
Run Scaffolder
Create SailPoint request
Open Terraform workflow
Run debug
```

系统名称置于次级辅助信息：

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

所有关键状态必须显示时效元数据：

```text
Last checked
Source
Freshness
Last known state
```

---

# 35. Accessibility 与交互约束

* 状态不能仅依赖颜色，必须辅以明确图标与文本说明；
* Graph 节点必须支持 keyboard focus 与全键盘导航；
* 每个 status icon 配备无障碍文字说明；
* Animation 支持系统级 reduced motion；
* Graph transition 不应干扰对状态的理解；
* External links 明确说明将离开 Atlas；
* 用户提交 delegated action 前必须清晰知晓责任系统；
* 失败时焦点自动移动到错误摘要卡片；
* 长 Journey 导航支持搜索或折叠 phase，但不能隐藏 blocking step；
* Reference image 必须提供文字说明与替代文本。

---

# 36. 产品指标

Atlas 的 North Star 是第一次成功 DEV Deployment，同时度量 total lead time、active user time 和 blocked time。重点关注工具切换频次、重复输入、人工 handoff、Action success、Journey completion 和 diagnosis time，而非单纯关注 page view。

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

* Atlas 没有重建 SailPoint、TFE 或 Harness，保护存量投资；
* Atlas 把碎片化系统编排为一条受治理的 outcome；
* 用户减少输入、切换与协调成本；
* 平台团队获得标准化的云原生消费路径；
* 每个步骤、等待和失败都精准可测量。

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
