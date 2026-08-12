# 一、产品定位

## 正式定位

> **Atlas 是一个以 Application 为上下文的多云 Developer Experience Platform。它为应用团队提供统一入口，用于发现平台能力、理解应用状态、执行受治理的原子操作、完成 Golden Paths，并诊断跨 AWS、Azure 和内部 SDLC 系统的故障。Atlas 负责体验、指导、状态、证据和跨系统衔接；底层平台继续负责实际执行、审批和领域事实。**

英文表述：

> **Atlas is an application-centric, multi-cloud developer experience platform that provides a unified workbench for discovery, contextual visibility, governed actions, guided journeys, and assisted diagnosis across cloud and SDLC systems.**

## 产品愿景

> **One Portal. One Experience. Multiple Clouds.**

> **One onboarding journey, from App Code to the first successful DEV deployment.**

---

# 二、问题定义：Atlas 解决什么问题

Atlas 的设计以用户任务为起点，而非以产品入口为起点。

用户在工作中只有五类基本意图：

| 用户意图                  | 典型问题                                            | Atlas 应提供的体验                     |
| --------------------- | ----------------------------------------------- | -------------------------------- |
| **Find / Understand** | 官方文档在哪里？这个服务支持哪个 Region？该找谁？                    | Context View                     |
| **Observe**           | 我的 Account、Pipeline、Ticket、Resource、Cost 是什么状态？ | Application Workbench            |
| **Decide**            | 我应该选择哪个路径、Connector、Role、Module、配置？             | Guidance / Quick Start           |
| **Act**               | 帮我申请权限、创建 Harness Project、触发 Pipeline           | Governed Action                  |
| **Complete**          | 帮我完成 AWSF Onboarding 或首次部署                      | Journey / Golden Path            |
| **Recover**           | 为什么失败？下一步如何修复？                                  | Diagnosis / Assisted Remediation |

上述意图可归纳为六类，其中 Journey 是“完成复杂结果”的模式。

现有调研材料中的问题体现了这些意图的组合：

* 用户需要权威文档和 Quick Start；
* 需要知道 Support 和联系人；
* 需要理解 Account、Connector、Permission、Environment 的关系；
* 需要完成跨 SailPoint、ServiceNow、TFE、Harness、Vault 的 Onboarding；
* 需要理解 Black Duck、Pipeline、TFE output、Task Definition 和 Secret 的失败。

其根因也不是某一个工具功能不足，而是用户需要自己把多个系统的局部流程拼成完整结果。

因此，Atlas 的本质可以表达成：

```text
Developer Intent
       ↓
Resolve Application Context
       ↓
Present the right View / Action / Journey / Diagnosis
       ↓
Delegate execution to source systems
       ↓
Collect status and evidence
       ↓
Return a verified outcome or recovery path
```

---

# 三、Atlas 的四个核心体验原语

这是比“所有东西都是 Journey”更稳定的产品模型。

## 1. View：上下文视图

用于只读的信息与状态需求。

包括：

* 权威文档；
* Service / Capability；
* Availability；
* Application Profile；
* AWS Account / Azure Subscription；
* TFE Workspace；
* Harness Project / Pipeline；
* Resources；
* Cost；
* Tickets / Changes / Incidents；
* Deployment status；
* Support contact；
* Release impact；
* Logs 和 Observability 入口。

统一视图需遵循以下约束：

> **统一视图不是把所有数据放在同一页，而是把当前任务需要的上下文放在一起。**

例如，用户查看 Deployment Failure 时，所需的核心上下文是：

```text
当前 Application
+ Environment
+ Deployment Run
+ Pipeline Stage
+ 当前 Artifact Version
+ Infrastructure Version
+ Relevant Logs
+ Recent Platform Changes
+ Known Issues
+ Support Route
```

而不是同时展示完整 Cost Dashboard、所有 Cloud Resources 和全部历史 Tickets。

所以 Cost、Resources、Tickets 是 **Application Context 的不同 Lens**，不是三个独立产品。

---

## 2. Action：受治理的原子操作

用于一次可以完成的独立动作，例如：

* 提交 SailPoint access request；
* 创建 Harness Project；
* 创建 Connector；
* 创建 Pipeline；
* 触发 DEV Deployment；
* 创建预填 ServiceNow Ticket；
* 运行 prerequisite check；
* 重新运行某个失败阶段；
* 获取或验证某个状态。

Action 的特点是：

* 有明确输入；
* 有明确责任系统；
* 有明确结果；
* 可以单独使用；
* 不一定属于 Journey；
* 必须有身份、权限、审计和运行状态。

旧 Backstage Template 在这一能力上需要改进。

Atlas 不能重新变成：

```text
打开表单
→ 用户猜字段
→ 提交
→ 不知道后面发生什么
```

Atlas 的目标交互应为：

```text
识别 Application
→ 自动填入已知上下文
→ 只询问未知且必须由用户决定的信息
→ 验证 Account / Connector / Environment / Version 兼容性
→ 触发底层系统
→ 返回执行状态、错误和证据
```

---

## 3. Journey：状态化的复杂任务

Journey 用于多个步骤、多个系统、多个责任人共同完成一个 Outcome 的情况。

例如：

* Onboard Application to AWSF；
* First DEV Deployment；
* Onboard Vault；
* Prepare Production Readiness；
* Migrate Pipeline Version；
* Resolve a Security Finding；
* Perform DR Exercise。

Journey 不等于一条固定线性 Workflow。它可以包含：

* Decision；
* View；
* Action；
* Manual Step；
* External Approval；
* Validation；
* Optional Branch；
* Exception Path；
* Support Escalation。

因此更准确的关系是：

```text
Golden Path
= 经过治理、版本化的推荐完成方式

Journey
= 某个 Application 对 Golden Path 的一次状态化执行

Action
= Journey 中可调用、也可独立使用的原子能力
```

---

## 4. Diagnosis：诊断与恢复

Diagnosis 处理的是异常路径：

```text
收集相关上下文
→ 定位失败阶段
→ 获取日志和状态
→ 检查已知规则
→ 关联版本与近期变化
→ 给出可能原因和置信度
→ 推荐下一步
→ 准备 Action / Ticket / Runbook
```

第一阶段聚焦于 **Journey 和 Delivery Diagnosis**，不扩展为通用 Observability 产品。

优先诊断：

* SailPoint Group / Mapping 未生效；
* Account、Connector、Role 不匹配；
* Harness Project / Pipeline 命名错误；
* Black Duck 版本、权限或规则失败；
* Package Promotion 版本解析失败；
* TFE output 未生成或未正确传入 Task Definition；
* Secret reference 错误；
* Deployment Stage 失败；
* 缺少 prerequisite 或 approval。

现有调研材料表明，这些断点具有普遍性。

---

# 四、核心产品能力

基于上述四个体验原语，Atlas 的能力应收敛成六个产品支柱。

## 1. Discover & Understand

解决“我应该去哪里、什么是官方、我应该怎么做”。

包括：

* Service / Capability Catalog；
* AWS、Azure Capability Mapping；
* 权威文档；
* Task-based Navigation；
* Availability；
* Application-facing Release Notes；
* Support Routing；
* Search；
* Contextual Guidance。

Atlas 当前的 Service Catalog、Availability Matrix、Release Notes、Support、Feedback、Context API 等 Pilot 能力，保留并重新组织到这一支柱下。

### 产品原则

不要只按技术产品组织：

```text
ECS
TFE
Harness
Vault
```

还要按用户任务组织：

```text
我要 onboard 一个 Application
我要创建 Harness CI
我要接入 Vault
我要部署 ECS
我要解决 Security Group Finding
我要把 TFE Output 配进 Task Definition
```

---

## 2. Application Workbench

Atlas 的主要上下文锚点是 Application，但不是所有页面都必须从 Application 开始。

Application Workbench 聚合：

* App Code、Owner、Support；
* AWS Account / Azure Subscription；
* Environment；
* Repository；
* TFE Workspace；
* Harness Project / Service / Pipeline；
* Resource summary；
* Recent Deployment；
* Open Tickets / Changes / Incidents；
* Documents；
* Cost summary；
* Current Journeys；
* Blockers；
* Suggested Actions。

现有 Application Profile 蓝图已包含这些主要关系。

但需要避免做成“企业数据全景大屏”。

每一块内容必须至少满足一个条件：

1. 能帮助用户做决定；
2. 能帮助用户执行下一步；
3. 能帮助用户理解失败；
4. 能帮助用户找到责任人；
5. 能帮助用户验证结果。

否则就不进入默认视图。

---

## 3. Task Center & Quick Starts

这是 Journey 和普通信息页面之间的重要层。

Quick Start 适用于：

* 用户目标明确；
* 可以在少数步骤内得到第一项有用结果；
* 不需要完整 Journey；
* 用户熟练度接近零。

例如：

* Find my AWSF Account；
* Request AWSF Access；
* Create Harness CI；
* Connect Repository；
* Check TFE Workspace；
* Validate Task Definition；
* Prepare Vault Request；
* Diagnose Black Duck Failure。

Quick Start 不是表单目录，而是：

```text
Intent
→ Context
→ Recommended choice
→ Minimal inputs
→ Preflight
→ Action
→ Result
```

---

## 4. Guided Journeys & Golden Paths

Journey 是 Atlas 最重要的差异化能力，但不再作为唯一产品定位。

首个 Golden Path 定义为：

> **AWSF Application Onboarding：从 App Code 到第一次成功的 DEV Deployment。**

完成标准采用 C：

```text
Application identified
→ Required access ready
→ AWSF account mapped
→ Repository ready
→ TFE workspace and infrastructure workflow completed
→ Harness project / connector / pipeline ready
→ Artifact / package available
→ Runtime and secret configuration ready
→ First DEV deployment successful
→ Minimal runtime validation passed
```

Atlas 不执行 Terraform 或 Deployment Logic，但必须能够：

* 展示 Journey 阶段；
* 自动带入 Application 信息；
* 显示 prerequisites；
* 触发受支持的外部 Action；
* 读取外部执行状态；
* 识别 blockers；
* 显示责任人；
* 聚合 Tickets；
* 验证完成结果；
* 记录 Evidence。

现有 Onboarding 设计要求显示当前阶段、完成项、阻塞项、责任方、输入、状态、失败原因和下一步，并将多个 Ticket 聚合为同一条 Journey。

---

## 5. Delegated Self-Service

Atlas 可以覆盖 Provision、Deploy、Operate 的**体验**，但不拥有这些领域的**执行引擎**。

这是一个重要的边界修正：

> **Atlas 的范围不应该由动词划分，而应该由责任归属划分。**

例如：

| 行为          | Atlas 负责          | 底层平台负责                             |
| ----------- | ----------------- | ---------------------------------- |
| Provision   | 意图、参数、指导、触发、状态、证据 | TFE / Cloud Platform 执行            |
| Deploy      | 触发、状态、失败解释、结果确认   | Harness 执行                         |
| Access      | Request、状态和映射     | SailPoint / IAM 授权                 |
| Approval    | 展示、通知、跳转、读取结果     | 原审批系统决定                            |
| Operate     | 上下文、诊断、推荐操作       | Observability / Cloud / Runtime 执行 |
| Remediation | 推荐、准备输入、触发受控流程    | 原系统实际修改                            |

这使 Atlas 可以贯穿 SDLC，但不会变成 Full IDP：

> **Atlas follows the application across the SDLC, but it does not own the SDLC.**

---

## 6. Intelligent Diagnosis & Assisted Remediation

Atlas 的 AI 是能力模块，不是产品身份。

AI 的近期最高权限为：

```text
Read
→ Explain
→ Diagnose
```

Assisted Remediation 可以做到：

```text
Collect Context
→ Diagnose
→ Explain Evidence
→ Recommend Next Action
→ Prepare Ticket / Workflow Input / PR Draft
→ Human Trigger
→ Track Result
```

近期不做：

* AI 自动 Apply Terraform；
* AI 自动部署生产；
* AI 自动重启生产资源；
* AI 自动授予权限；
* AI 自动审批；
* AI 自动改变安全策略。

Port 将统一 Context、Workflows、AI 与 Governance 划分为不同产品层；其 Workflow 调用既有后端并回传执行状态，而非由 Portal 实现每一种执行逻辑。Atlas 采用相同的职责分层原则。([Port][1])

Port 已进一步探索自动诊断和自动修复，但在其示例中，AI 主要输出结构化判断，实际修改仍由显式 Workflow 分支控制。Atlas 当前采用更保守的 Assisted Remediation 边界。([Port][2])

---

# 五、Atlas 的产品基础

六个用户能力背后，需要五项稳定基础。

## 1. Identity

Identity 是 P0，不是后续增强。

因为 Atlas 需要知道：

* 谁在操作；
* 他属于哪个 Team；
* 可以看到哪些 Application；
* 是否可以触发 Action；
* Action 代表谁执行；
* 谁提交了 SailPoint Request；
* 谁触发了 Deployment；
* 谁确认了 Manual Step。

Atlas 不一定自己实现身份平台，但必须消费可信企业身份。

---

## 2. Application Context Projection

底层系统仍然是 System of Record，Atlas 拥有规范化投影。

```text
Application
├── Team / Owner
├── Environments
├── Accounts / Subscriptions
├── Repositories
├── TFE Workspaces
├── Harness Projects / Pipelines
├── Resources
├── Tickets / Changes
├── Documents
├── Costs
└── Journeys
```

每个投影事实必须带：

* Source；
* External ID；
* Retrieved At；
* Freshness；
* Resolution method；
* Data-quality warning。

Atlas拥有投影，不拥有底层事实：

> **Atlas owns the normalized projection and experience semantics, not the underlying domain truth.**

---

## 3. Experience Contracts

Atlas 需要正式管理以下产品对象：

| 对象            | 含义                              |
| ------------- | ------------------------------- |
| Capability    | 企业允许应用团队消费的能力                   |
| Task          | 用户希望完成的目标                       |
| View          | 某个任务需要的上下文                      |
| Action        | 可独立执行的受治理操作                     |
| Golden Path   | 推荐且版本化的完成方式                     |
| Journey       | Application 对 Golden Path 的一次运行 |
| Step          | Journey 的步骤                     |
| Evidence      | 完成或失败的依据                        |
| Diagnosis     | 对异常的解释与置信度                      |
| Remediation   | 推荐的恢复路径                         |
| Support Route | 问题类型对应的责任团队和升级路径                |

这些对象构成 Atlas 拥有的产品数据。

---

## 4. Evidence and State

状态不能只是用户自己打勾。

Atlas 要区分：

| 状态类型            | 示例                          |
| --------------- | --------------------------- |
| **Observed**    | SailPoint Request 已批准       |
| **Derived**     | 所有 required access 已完成      |
| **Declared**    | 用户确认 Architecture Review 完成 |
| **Atlas-owned** | 当前选择的是 AWSF ECS Golden Path |
| **Unknown**     | Source 无法访问或尚无映射            |

每个 `Done` 原则上应包含 Evidence：

* Request ID；
* Run ID；
* Pipeline result；
* API response；
* Repository；
* Validation output；
* 用户确认；
* Timestamp。

---

## 5. Product Analytics

Sponsor 看重 Adoption 和 Onboarding，因此 Analytics 必须进入 P0。

不能只统计：

* 登录；
* Page View；
* Search 次数。

核心度量包括：

* Journey started；
* Journey completed；
* 每一步耗时；
* Blocked duration；
* Manual handoffs；
* Tool switches；
* Action success rate；
* Diagnosis usage；
* Repeated failure；
* Golden Path adoption；
* First DEV deployment result。

现有调研材料也将从申请到 DEV Ready 的耗时、首次成功部署时间、人工交互次数、工具数量、Self-service completion rate、Golden Path adoption 和问题定位时间列为核心指标，而非仅衡量 Portal 流量。

---

# 六、Action 与审批边界

审批能力采用以下明确边界：

| 风险级别 | Atlas 能力                  | 当前边界                   |
| ---- | ------------------------- | ---------------------- |
| L0   | 读取信息                      | 允许                     |
| L1   | 预填参数、生成 Draft             | 允许                     |
| L2   | 提交 Request、触发低风险 Workflow | 允许，需要 Identity 和 Audit |
| L3   | 触发 DEV Deployment         | 允许，需权限检查和明确确认          |
| L4   | 触发 UAT / PROD 变更          | 后续评估                   |
| L5   | 代用户审批、自动授权                | 不允许                    |
| L6   | AI 自主生产变更                 | 不允许                    |

审批设计应为：

```text
Atlas 显示：
- 为什么需要审批
- 当前由谁审批
- 当前状态
- 等待时间
- Source System Link

用户在 Source System：
- 做出审批决定

Atlas：
- 重新读取审批结果
- 更新 Journey State
```

Atlas 禁止：

* 代理 Approver 身份；
* 在 Atlas 内复制完整审批逻辑；
* 自动点击批准；
* 将“触发请求”与“完成授权”混为一谈。

---

# 七、信息架构

## 1. Home / My Work

展示：

* 我的 Applications；
* Continue Journey；
* Blocked items；
* Pending actions；
* Recent failures；
* Suggested quick starts；
* Relevant announcements。

## 2. Applications

进入 Application Workbench：

```text
Overview
Cloud & Environments
Delivery
Resources
Access
Tickets & Changes
Cost
Documentation
Journeys
Diagnostics
Support
```

不要求第一版全部完成。

## 3. Explore

用于：

* Service / Capability Catalog；
* AWS / Azure 支持矩阵；
* Docs；
* Golden Paths；
* Platform changes；
* Search。

## 4. Tasks

面向原子意图：

* Request Access；
* Create Harness Resources；
* Check Workspace；
* Start Deployment；
* Open Support Request；
* Validate Configuration。

## 5. Journeys

用于：

* Onboarding；
* First Deployment；
* Production Readiness；
* Migration；
* DR Exercise。

## 6. Diagnose

Diagnosis 可从全局入口进入，但必须解析到：

```text
Application
+ Environment
+ Failed Run / Symptom
```

然后再开始上下文聚合。

---

# 八、到 2026 年 10 月的 MVP

MVP 范围必须保持克制。

以五人团队和目前 Pilot 状态，10 月不适合同时完成：

* Full Application 360；
* AWS、Azure 三套完整 Journey；
* 通用 Cost；
* 全量 Cloud Resources；
* 通用 Observability；
* 多个 Golden Paths；
* 完整 AI Troubleshooting；
* 自助 Provisioning。

同时覆盖上述能力会形成“什么都有一点、但没有一个 Outcome 真正完成”的 Portal。

## October Pilot 的主题

> **Atlas AWSF First DEV**

目标：

> 一个零云和零 Terraform 经验的 Application Team，可以从 App Code 开始，通过 Atlas 走到第一次成功的 DEV Deployment，并在失败时知道原因和下一步。

## October 必须包含

### 1. Identity 与 Application Resolution

* 企业身份；
* App Code；
* Team / Owner；
* Application selector；
* 基础权限。

### 2. Application Workbench Lite

第一版只聚合完成 Onboarding 必须的信息：

* Application；
* AWSF Account / Environment；
* Repository；
* TFE Workspace；
* Harness Project / Connector / Pipeline；
* Open Requests / Tickets；
* Onboarding status；
* Docs；
* Support。

完整 Cost 和 Resource Inventory 不应成为 10 月关键路径。

### 3. Discover / Task Navigation

至少覆盖：

* AWSF Onboarding；
* Access；
* Harness CI/CD；
* TFE；
* Vault / Secret；
* Deployment；
* Support；
* 常见失败。

### 4. 一条完整 AWSF Golden Path

首版锁定一个经过验证的 Workload 分支，优先采用 ECS：

```text
Start
→ Resolve Application
→ Check prerequisites
→ Request access
→ Resolve account and environment
→ Verify repository
→ Track TFE infrastructure
→ Create Harness project / connector / pipeline
→ Verify artifact
→ Validate runtime configuration
→ Trigger DEV deployment
→ Observe result
→ Minimal health verification
→ Complete
```

### 5. 三类 Delegated Action

为达到“第一次成功 DEV Deployment”，首版至少需要三类 Action：

1. **提交 SailPoint Group / Access Request**；
2. **创建 Harness Project / Connector / Pipeline**；
3. **触发 Harness DEV Deployment 并读取状态**。

TFE 首版范围限定为：

* 状态读取；
* Workspace 映射；
* Workflow deep link；
* Plan / Apply result 观察。

后续再决定是否由 Atlas 触发。

### 6. Targeted Diagnosis V0

不做通用聊天机器人，只覆盖最常见断点：

* Access / Group Mapping；
* Account / Connector 不匹配；
* Pipeline Prefix / Project Naming；
* Black Duck；
* TFE Output / Task Definition / Secret；
* Harness Deployment Failure。

输出：

* 失败阶段；
* 可能原因；
* Supporting evidence；
* 推荐操作；
* Runbook；
* Support；
* 预填 Ticket。

### 7. Journey Analytics

必须能够回答：

* 哪些 App 开始了；
* 卡在哪一步；
* 卡了多久；
* 哪些 Action 最常失败；
* 哪些步骤仍需要人工；
* 是否完成 First DEV Deployment。

### 8. 最小治理

每条正式 Golden Path 必须有：

* Journey Owner；
* Version；
* Applicable scope；
* Step Owners；
* Completion criteria；
* Evidence rules；
* Review date。

Multi-cloud Head 有能力推动 Journey Owner 和 Step Owner，因此这一项可以作为真实产品承诺，而不只是愿景。

---

## October 明确不做

* 完整 Azure Onboarding；
* AWS Central 深度 Journey；
* 通用 Workflow Builder；
* 任意资源 Provisioning；
* 全量 Cost Management；
* 全量 Cloud Inventory；
* 通用 Production Operations；
* 通用 Incident Management；
* Atlas 内审批；
* AI 自动执行；
* 全公司级 CMDB；
* 大量 Golden Paths；
* 复杂 Scorecard 系统。

---

# 九、后续 Roadmap

## Horizon 1：2026 年 10 月——验证垂直 Outcome

核心问题：

> Atlas 是否真的能让一个 Application Team 更顺畅地完成 AWSF First DEV Deployment？

交付：

* Application Workbench Lite；
* AWSF Onboarding Journey；
* 三类 Delegated Action；
* Journey Diagnosis；
* Identity；
* Owners；
* Analytics。

成功门槛不是“页面上线”，而是：

* 有真实 Application 完成；
* 能看见真实状态；
* 能识别真实阻塞；
* Action 有成功和失败闭环；
* First DEV Deployment 有证据；
* 团队愿意继续用 Atlas 做下一次任务。

---

## Horizon 2：2026 Q4–2027 Q1——从一次 Journey 变成日常 Workbench

目标：

> 即使用户暂时没有完整 Journey，也有理由日常进入 Atlas。

扩展：

* Application 360 v1；
* Account / Connector / Permission Map；
* Resource summary；
* Deployment history；
* Ticket / Change aggregation；
* Cost summary；
* Task Center；
* Quick Starts；
* Vault onboarding status；
* Package Promotion Advisor；
* TFE Output / Task Definition Guide；
* Application-facing Release Impact；
* Known Issues；
* Diagnostics v1。

现有机会清单中的权威文档、Support Routing、Onboarding、Release Impact、Terraform Quick Start、Account/Permission/Connector Map、CI/CD Checklist 和 Runtime Config Guide 均对应这一阶段。

---

## Horizon 3：2027 H1——扩展多云与多 Journey

目标：

> 证明 Atlas 的模型不是只适用于 AWSF。

扩展：

* Azure Onboarding；
* AWS Central；
* 云无关的 Journey Contract；
* 云特定分支；
* ECS / AKS Golden Path；
* VM / Container / Database Quick Starts；
* Production Readiness Journey；
* Vault Journey；
* Pipeline Migration Journey；
* Cross-cloud Capability Mapping。

该阶段遵循以下原则：

> 统一 Experience、State 和 Outcome，不强行统一 AWS 与 Azure 的底层概念。

现有调研材料同样支持统一体验和状态模型，同时保留 AWS Account 与 Azure Subscription 等关键原生差异。

---

## Horizon 4：后续——主动治理与 Assisted Remediation

目标：

> 从用户主动找答案，发展到 Atlas 主动发现风险并提供可执行建议。

扩展：

* Production readiness score；
* Platform change impact；
* Module / image / pipeline upgrade advisor；
* Compliance gaps；
* Cost anomaly；
* Resource ownership gaps；
* Proactive issue detection；
* Assisted remediation；
* PR / Ticket / Workflow Draft；
* Diagnosis feedback learning；
* Journey quality analytics。

Port 当前用 Context Lake、Scorecards、Workflows 和 AI 构建从发现问题到执行修复的闭环，可以作为长期能力结构的参考，但 Atlas 不需要复制其完整通用平台范围。([Port][3])

---

# 十、成功指标

## North Star

> **Time to First Successful DEV Deployment**

但需要拆成三个指标：

```text
Total Lead Time
= 从开始 Onboarding 到第一次成功 DEV Deployment

Active User Time
= 用户实际阅读、填写、切换系统、排障的时间

Blocked Time
= 等待 Ticket、权限、审批、Support 或外部团队的时间
```

Atlas 对 Active User Time 的控制力最大，对 Blocked Time 只能部分改善。

因此，“改善 Onboarding 50%”不能作为一个未定义的指标。

指标目标定义如下：

### Primary

* Median Time to First Successful DEV Deployment；
* P75 Time to First Successful DEV Deployment。

### Controllable Leading Indicators

* 用户必须访问的工具数量；
* 手工输入次数；
* 重复输入次数；
* 人工 Handoff 数量；
* 每个 Journey 的 Blocker 数量；
* Action success rate；
* Journey completion rate；
* 自动识别状态的 Step 比例；
* Diagnosis 后无需 Support 的比例；
* Mean Time to Identify Owner；
* Mean Time to Diagnose。

在尚无 Baseline 的情况下，不承诺“总时间减少 50%”。

首阶段采用以下可控目标：

> **将 Onboarding 中用户的手工操作、重复输入和系统切换减少 50%。**

同时持续测量端到端 Lead Time。

---

# 十一、产品边界

## Atlas 是什么

* Application-centric Developer Workbench；
* Multi-cloud Developer Experience Platform；
* Governed Experience & Orchestration Layer；
* Unified Context Surface；
* Task and Quick Start Center；
* Journey and Golden Path Runtime；
* Delegated Action Layer；
* Diagnosis and Assisted Remediation Layer。

## Atlas 不是什么

* Terraform 替代品；
* Harness 替代品；
* SailPoint 替代品；
* ServiceNow 替代品；
* Cloud Console；
* CMDB；
* 通用 Observability 平台；
* 通用 Workflow Engine；
* 全功能 IDP；
* 自动审批平台；
* 自动生产运维 Agent；
* 文档 CMS；
* 只有链接的 Portal。

---

# 十二、决策摘要

| 决策项                   | 设计选择                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| **产品类别**              | Application-centric Multi-Cloud Developer Experience Platform            |
| **体验形态**              | Developer Workbench / Portal                                             |
| **愿景**                | One Portal. One Experience. Multiple Clouds.                             |
| **Primary Persona**   | 第一次使用 Public Cloud 的 Application Developer                               |
| **Secondary Persona** | 已在云上运行的 Developer、Application Owner / Tech Lead                          |
| **Primary Outcome**   | First Successful DEV Deployment                                          |
| **首个切口**              | AWSF Onboarding                                                          |
| **核心体验原语**            | View、Action、Journey、Diagnosis                                            |
| **核心差异化**             | Golden Paths、跨系统状态、上下文动作、智能诊断                                            |
| **Atlas 拥有**          | Experience Contract、Guidance、Journey State、Evidence、Diagnosis、Projection |
| **外部系统拥有**            | Domain Truth、Execution、Approval、Authorization                            |
| **首批 Action**         | SailPoint Request、Harness Resource Creation、DEV Deployment Trigger       |
| **审批边界**              | 只展示、跳转、读取结果，不代理审批                                                        |
| **AI 边界**             | Read、Explain、Diagnose、Prepare；不自主执行                                      |
| **October 目标**        | 一条真实 AWSF Journey 完成到 First DEV Deployment                               |
| **长期方向**              | 从 Onboarding 垂直切口扩展为多云日常 Developer Workbench                             |

Atlas 的核心价值主张是：

> **Atlas 不只是把系统放进同一个 Portal，而是让用户在不理解组织和工具边界的情况下，获得完成任务所需的上下文、动作、路径、状态和诊断。**

[1]: https://docs.port.io/?utm_source=chatgpt.com "Port Documentation"
[2]: https://docs.port.io/guides/all/heal-unhealthy-k8s-pods/?utm_source=chatgpt.com "Auto-heal unhealthy Kubernetes pods with Port workflows"
[3]: https://docs.port.io/context-lake/overview/?utm_source=chatgpt.com "Context lake"
