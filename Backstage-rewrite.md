对，目标需要再抬高一层：

> 本文中的仓库、账号、版本、提交哈希、运行数量、团队和环境均为虚构示例，仅用于说明通用设计。

> **Day 0 的产物不是 Terraform，也不是一个成功的 plan，而是一套已经在目标环境运行、可以被预期用户访问、并有证据证明可用的最小工作负载。**

Terraform 只是实现这个结果的代码载体。

同时，“通用”不应该意味着建立 ECS/EKS/EC2/Lambda 的统一资源模型。真正应该通用的是：

> **创建、执行、验证、记录和修复的生命周期。**

每一种具体结果仍然由一个具体的 Scaffold 提供。

---

# 一、重新定义 Day 0 的完成标准

一次 Scaffold Run 只有满足以下条件才算完成：

| 阶段 | 完成条件 |
|---|---|
| Generate | 生成基础设施和最小示例工作负载代码 |
| Validate | Terraform 静态验证通过 |
| Plan | 目标环境 plan 通过 |
| Apply | 目标环境 apply 成功 |
| Deploy | 示例应用确实已经启动 |
| Verify | 从预期访问边界访问成功 |
| Handoff | Git、运行地址、日志、输出和维护 Skill 已交付 |

例如 ECS：

```text
没有基础设施代码
    ↓
生成 ECS Terraform + 最小应用配置
    ↓
PR / 审批
    ↓
terraform apply
    ↓
ECS task healthy
    ↓
ALB endpoint 可访问
    ↓
GET /healthz 返回本次 Scaffold Run ID
    ↓
Day 0 Complete
```

对于受限网络中的服务，“accessible”不代表 Scaffold Server 本身必须访问得到，而是：

```text
从受限网络中的 probe runner
访问成功
```

对于 public service，则可以从外部 probe。

为了证明访问到的不是旧服务，示例应用应该返回：

- 本次 `scaffoldRunId`
- Git commit
- 构建版本

这样结果是可验证的，不只是“某个 URL 返回了 200”。

---

# 二、系统只需要两个层次

不需要 Capability、统一 Runtime Model 或通用 IaC DSL。

## 1. 通用 Scaffold Service

它只理解一套固定生命周期：

```text
选择 Scaffold
获取用户输入
解析组织上下文
生成文件
验证
创建 PR
等待审批和合并
触发 / 观察 Apply
验证示例应用
记录证据
必要时修复
```

## 2. 具体 Scaffold Package

每个 Package 只描述一种明确结果，例如：

- `ecs-http-service`
- `lambda-http-function`
- `ec2-container-service`
- `eks-workload-existing-cluster`
- `eks-cluster-with-sample-service`

这里需要特别区分：

> “创建一个新的 EKS Cluster”与“向已有 EKS Cluster 部署一个 workload”不是同一个 Day 0，它们应该是两个 Scaffold。

服务端不需要理解 ECS 和 EKS 的统一抽象，只需要知道：

> 这个 Scaffold 最终是否完成了 Apply，以及它如何报告 endpoint 和验证结果。

---

# 三、通用 API 不再编码 ECS

API 应该是围绕 Scaffold Run，而不是基础设施类型：

```text
GET  /api/scaffolds
GET  /api/scaffolds/:scaffoldId

POST /api/scaffold-runs
GET  /api/scaffold-runs/:runId

POST /api/repair-campaigns
GET  /api/repair-campaigns/:campaignId
```

创建 ECS 时，请求体里选择：

```text
scaffoldId = ecs-http-service
```

以后 Lambda、EC2、EKS 使用完全相同的 Run API。

UI 第一页就是：

## What do you want to run?

```text
Container service on ECS
HTTP function on Lambda
Container service on EC2
Workload on an existing EKS cluster
New EKS cluster with a sample workload
```

选择之后，才展示该 Scaffold 真正需要的少量问题。

---

# 四、Scaffold Package：不是 TS 代码，而是可热更新的 Git 内容

你指出的 TS 问题成立：

> 如果具体生成逻辑写在 `renderEcs.ts` 中并打进服务端 bundle，那么每改一次模板都需要编译、构建和重新部署服务。

所以应该明确拆开：

```text
Scaffold Engine
    TypeScript，编译部署

Scaffold Package
    Git 中的普通文件，运行时加载
```

目录可以非常简单：

```text
infra-scaffolds/
├── ecs-http-service/
│   ├── scaffold.json
│   ├── form.schema.json
│   ├── template/
│   │   ├── infra/
│   │   │   ├── terraform.tf.njk
│   │   │   ├── backend.tf.njk
│   │   │   ├── runtime.tf.njk
│   │   │   └── outputs.tf.njk
│   │   └── pipeline/
│   └── fixtures/
│       ├── dev-internal/
│       └── prod-public/
│
├── lambda-http-function/
└── ec2-container-service/
```

V1 里 Package 只使用：

- JSON Schema：描述 UI 要问什么；
- Nunjucks 等普通文本模板；
- fixtures；
- 少量元数据。

**Package 不写 TypeScript，也不需要编译。**

模板变更流程：

```text
修改 .tf.njk
    ↓
提交 Scaffold Repo PR
    ↓
自动测试
    ↓
合并并生成 Git tag / commit SHA
    ↓
标记为 recommended
    ↓
Scaffold Server 通过 webhook 刷新缓存
```

不需要重新构建服务端。

TypeScript 服务端只有在以下情况才重新部署：

- API 改变；
- 渲染引擎改变；
- Git、Terraform、Pipeline 集成改变；
- 新增通用安全能力。

普通 Terraform 模板和输入表单变化不需要部署。

---

# 五、不要堆积 Template

避免以下结构：

```text
ecs-v1/
ecs-v2/
ecs-v3/
ecs-prod-v3/
ecs-public-v3/
ecs-internal-v4/
```

每一种 Scaffold 只保留一个主线目录：

```text
ecs-http-service/
```

版本由 Git 提供：

```text
commit SHA
tag
release
```

不同环境和 public/internal 是输入，不是不同模板目录。

历史版本不复制在主分支中，历史来源有两处：

1. Git commit/tag；
2. 每次生成时保存的原始产物快照。

这意味着长期维护的是：

```text
一份当前 ECS Scaffold
一份当前 Lambda Scaffold
一份当前 EC2 Scaffold
```

而不是 N 个版本乘以 N 个变体。

另外，V1 不建议做跨 Scaffold 的模板继承体系：

```text
base-template
  └── cloud-template
       └── container-template
            └── ecs-template
```

少量重复比模板继承链更容易理解和修复。

---

# 六、Scaffold Package 的唯一公共约定

为了让服务端保持通用，需要一个很小的“完成协议”，但不需要统一 ECS/EKS 领域模型。

每个 Scaffold 最终必须向服务端报告：

```text
applyStatus
endpoint
accessScope
probeStatus
probeEvidence
deploymentCommit
```

并且生成的 Terraform 应暴露标准化输出，例如：

```text
scaffold_endpoint
scaffold_access_scope
scaffold_workload_id
```

具体内部实现可以完全不同：

| Scaffold | 内部实现 |
|---|---|
| ECS | ALB DNS + ECS Service |
| EKS | Ingress / LoadBalancer |
| EC2 | ALB / Public DNS |
| Lambda | API Gateway / Function URL |

服务端只关心标准结果：

```text
Apply 成功了吗？
示例工作负载启动了吗？
应该从哪里访问？
实际验证通过了吗？
```

这就是通用性的边界。

---

# 七、示例应用不要每个模板复制一份

为了减少生成代码和模板维护量，可以维护一个统一的 Probe Workload。

对于 ECS、EKS 和 EC2：

```text
registry.example.com/example/scaffold-probe:<immutable-version>
```

这是一个极小 OCI Image：

```text
GET /
GET /healthz
GET /metadata
```

返回：

```text
scaffoldRunId
commit
runtime
timestamp
```

对于 Lambda，使用对应的固定 ZIP / Layer artifact。

这样 ECS Scaffold 不需要生成一份 Node/Java sample app，EKS 又生成另一份。

Scaffold 只需要：

```text
引用一个精确版本的 probe artifact
注入 scaffoldRunId
暴露 endpoint
```

Day 0 验证完成后，应用团队再把 probe image 替换成真实应用。这属于 Day 2。

---

# 八、一次 Run 的具体执行过程

服务端状态不需要通用 Workflow Engine，只需要一组固定状态：

```text
CREATED
  ↓
RENDERED
  ↓
STATIC_VALIDATED
  ↓
PR_OPEN
  ↓
WAITING_FOR_MERGE
  ↓
APPLYING
  ↓
WORKLOAD_STARTING
  ↓
VERIFYING
  ↓
COMPLETED
```

失败则停在对应阶段：

```text
PLAN_FAILED
APPLY_FAILED
WORKLOAD_FAILED
VERIFY_FAILED
```

## 实际流程

### 1. 用户输入

例如 ECS：

```text
Application
Environment
Exposure
Size
```

### 2. 服务端解析上下文

```text
Repository
AWS account
Region
VPC / subnet
Owner
Billing label
Tags
Pipeline
```

### 3. 按精确 Scaffold Commit 渲染

例如：

```text
ecs-http-service@8e7f3ab
```

### 4. 静态验证

```text
terraform fmt
terraform init -backend=false
terraform validate
```

### 5. 创建 PR

UI 开始持续展示状态。

### 6. 调用已有 Terraform 执行平面

Scaffold Service 不应该自己长期持有生产云凭证。

它应当触发或观察：

- 现有 CI；
- 基础设施自动化服务；
- 交付自动化服务；
- 已有 Terraform Pipeline。

### 7. Apply 完成后部署 Probe Workload

### 8. 验证访问

Public：

```text
Scaffold Worker → Endpoint
```

Internal：

```text
VPC Probe Runner → Endpoint
```

### 9. 保存 Evidence

```text
Terraform plan summary
Apply result
Runtime resource ID
Endpoint
Probe response
Git commit
Scaffold version
```

用户最终看到的不是：

```text
Terraform generated successfully
```

而是：

```text
Your ECS starter is running

Endpoint: ...
Access: Internal
Health check: Passed
Git commit: ...
Terraform apply: Passed
```

---

# 九、模板修改后，如何修复正在进行中的 Run

这是最简单也最应该完全自动化的场景。

例如某个 Run 在 `terraform plan` 阶段失败，原因是模板把变量名写错了。

Scaffold 团队：

1. 修改 Git 中的 `.tf.njk`；
2. 新版本通过测试；
3. 标记旧版本有缺陷；
4. 对失败 Run 执行 `Retry with fixed release`。

服务端不要求用户重新填写表单，而是复用：

```text
原始用户输入
原始上下文快照
目标 repo
目标 environment
```

重新生成文件，更新同一条 PR branch，然后继续：

```text
validate
plan
apply
probe
```

这种 In-flight Repair 应该做到用户无感。

---

# 十、已经生成并被修改的代码，如何自动修复

这里有一个不能回避的第一性限制：

> 只要生成后的 Terraform 允许应用团队自由修改，就不可能同时无条件保证“自动覆盖”和“绝不破坏用户修改”。

所以不能承诺所有问题都完全无人干预。

严谨目标应该是：

> **安全子集自动修复；冲突子集自动准备好修复上下文，让本地 Agent 快速解决。**

## 每次生成必须保存这些信息

```text
run ID
scaffold ID
scaffold commit SHA
用户输入
非敏感上下文快照
原始生成文件
原始文件 hash
目标 repo 和路径
PR / merged commit
plan / apply / probe 证据
```

不要保存 secret，只保存引用或非敏感渲染值。

---

## 自动修复的核心：Base / Current / Fixed

发生模板 Bug 后：

### Base

该 Run 当时原始生成的文件。

### Current

应用 Repo 现在的实际文件。

### Fixed

使用修复后的 Scaffold、原始输入和原始上下文生成的新结果。

然后：

```text
Base → Fixed 的改动
       ↓
三方合并到 Current
```

### 情况一：应用团队没有修改相关文件

直接自动替换。

### 情况二：修改了其他位置

三方合并通常可以自动完成。

### 情况三：修改了同一位置

不应该强行覆盖，进入 Agent-assisted repair。

---

# 十一、什么情况下可以真正自动完成修复

满足全部条件时，系统可以自动创建 PR，甚至按仓库策略自动合并：

```text
三方合并无冲突
terraform validate 通过
terraform plan 通过
无 destroy
无 replace，或 replace 在明确允许范围内
安全策略通过
Apply 成功
Probe 成功
```

这已经能够覆盖大量实际模板缺陷：

- module source/version 写错；
- backend/provider 缺项；
- subnet 选择错误；
- tag 缺失；
- 参数名错误；
- sample image 版本错误；
- health check 配置错误。

但以下情况不应该完全自动：

- 应用团队重写了 runtime module；
- 修复需要资源替换；
- L1 breaking change 导致参数语义不明确；
- 当前环境和最初 Context 已发生显著变化；
- 用户删除了原生成文件；
- Terraform plan 出现无法解释的额外变化。

---

# 十二、快速修复方案：给本地 Agent 一个完整 Repair Bundle

对于无法自动合并的项目，服务端不应该只报：

```text
Merge conflict
```

它应该自动生成 Repair Bundle：

```text
原始 Scaffold 版本
修复目标版本
原始生成文件
当前应用文件
修复后目标文件
Base → Fixed diff
Current modifications
Terraform 错误
Plan 结果
预期修复目标
```

Scaffold 团队的本地 Agent 可以直接得到类似任务：

> 将 ECS Scaffold 版本 `a13f` 的 subnet 修复应用到当前 Repo。保留应用团队对 CPU、memory 和 logging 的修改。不得产生 destroy 或 replace。完成后运行 validate 和 plan。

Agent 不需要重新研究整个项目。

这可以把原本数小时的排查压缩成：

```text
检查自动生成的 patch
解决一个局部冲突
重新运行验证
提交 PR
```

Scaffold Service 应提供一个 Evidence/Repair API，作为本地 Agent 的输入：

```text
GET /api/scaffold-runs/:runId/evidence
GET /api/repair-campaigns/:campaignId/items/:itemId/context
```

不要求第一版就集成中心 LLM。

---

# 十三、Scaffold 团队实际需要的维护后台

Scaffold Team 不只需要一个创建 UI，还需要一个运维界面。

## 1. Run Failure Inbox

按以下维度聚合失败：

```text
Scaffold
Scaffold version
Failure stage
Error fingerprint
Target account / region
```

例如：

```text
ecs-http-service@8e7f3ab

17 runs failed at PLAN
14 share the same missing variable error
```

这会让模板问题很快暴露，而不是由 17 个用户分别报 Ticket。

## 2. Release 页面

展示：

```text
Static fixtures
Sandbox plan
Sandbox apply
Probe result
Current recommendation status
```

## 3. Repair Campaign

维护者选择：

```text
Affected releases: 8e7f3ab–ac912fe
Fixed release: b812a91
Reason: private subnet incorrectly resolved
```

系统先运行 canary：

```text
5 个 Repo
```

然后显示：

```text
Clean auto-repair       83
Merge conflicts          7
Unsafe plan              2
Repo missing             1
```

再决定是否展开到全部。

---

# 十四、模板 Release 必须先通过完整的 E2E

只做 `terraform validate` 不够。

每个 Scaffold Release 至少需要：

```text
Render fixture
Terraform validate
Sandbox plan
Sandbox apply
Sample workload healthy
Endpoint probe
Terraform destroy
```

ECS 第一版至少覆盖：

- dev internal；
- prod internal；
- public service。

每次 PR 可以跑静态测试和部分 plan。

真正标记为 `recommended` 之前，必须有一次完整：

```text
apply → probe → destroy
```

这样 Scaffolder 的承诺才是：

> 这个 Scaffold Release 曾经完整运行成功。

而不是：

> 这个 HCL 看起来语法没问题。

---

# 十五、AI 在 Scaffold 团队的具体作用

AI 不进入确定性的运行时生成链路，但应该深度参与维护。

## Scaffold 开发

本地 Agent 读取：

```text
旧/new L1
模板
fixtures
失败 Run
plan/apply 日志
```

帮助：

- 更新模板；
- 更新输入 Schema；
- 更新 fixture；
- 分析是否影响历史生成结果；
- 生成 repair campaign 描述；
- 解决三方合并冲突。

## Platform 团队

当 L1 发生变化时，其本地 Agent生成面向 Scaffold 团队的变化摘要：

```text
新建项目需要修改什么
哪些变量 breaking
哪些默认行为变化
是否需要新的 sample verification
```

## 应用团队

Day 0 完成后，其本地 Agent使用随 Repo 交付的 Skill 维护真实 Terraform。

因此三种 Agent 的连接点是：

```text
结构化 Evidence
版本化源码
真实 Terraform
可执行验证
```

而不是让它们共享一个新的领域 DSL。

---

# 十六、V1 的具体开发范围

## 服务端

```text
Scaffold Catalog
Git-backed Package Loader
Nunjucks Renderer
Context Resolver
Run State
Git PR Publisher
Terraform Pipeline Integration
Deployment Callback
Probe Verification
Evidence Store
Repair Renderer / Three-way Merge
```

## UI

```text
Scaffold 选择
输入表单
Preview
Run Progress
最终 Endpoint / Evidence
失败详情
Scaffold Team Repair Console
```

## 数据

最少三个表：

```text
scaffold_release
scaffold_run
repair_campaign
```

## 第一份 Scaffold

```text
ecs-http-service
```

它必须完整完成：

```text
生成
plan
apply
ECS healthy
endpoint accessible
probe 返回 run ID
```

## 第二份 Scaffold

我不会立刻选 EKS，而会选 Lambda HTTP Function。

原因是 ECS 和 Lambda 的执行形态差异很大：

- container vs function；
- load balancer vs API Gateway / Function URL；
- long-running service vs invocation。

如果同一个 Scaffold Service 能不增加 ECS 特例地支持 Lambda，说明通用生命周期边界是合理的。

EKS 再明确拆成：

```text
existing-cluster-workload
new-cluster-with-workload
```

之后分别实现。

---

# 最终架构

```text
                         Git Scaffold Repository

          ECS Scaffold      Lambda Scaffold      EC2 Scaffold
               │                  │                    │
               └──────────────────┼────────────────────┘
                                  │ runtime load by SHA
                                  ▼
                         Scaffold Service
                     ┌────────────────────────┐
                     │ Generic Run Lifecycle  │
                     │ Context                │
                     │ Render                 │
                     │ Git                    │
                     │ Apply Observation      │
                     │ Verification           │
                     │ Evidence               │
                     │ Repair                 │
                     └────────────┬───────────┘
                                  │
                                  ▼
                          Terraform Pipeline
                                  │
                                  ▼
                       Target Runtime + Probe
                                  │
                                  ▼
                            Verified Starter
```

模板维护链路：

```text
修改 Git 模板
    ↓
E2E apply + probe
    ↓
发布新 Scaffold Commit
    ↓
服务端热加载
```

历史修复链路：

```text
Original Generated Output
           +
Current Application Repo
           +
Fixed Scaffold Output
           ↓
Three-way Repair
           ↓
Validate / Plan / Apply / Probe
           ↓
Auto-complete or Agent-assisted PR
```

最核心的决策可以压缩成四句：

1. **Day 0 交付的是已运行且已验证的 Starter，不是 Terraform 文件。**
2. **通用的是 Run 生命周期，不是 ECS/EKS/Lambda 的领域模型。**
3. **具体模板放在 Git 中运行时加载，不打进 TypeScript bundle。**
4. **每次生成都保存原始快照，使模板缺陷可以通过重新渲染和三方合并自动修复；无法安全自动化的部分直接给本地 Agent 完整 Repair Bundle。**




这次我会把 **AI 当成一等公民**，而不是在传统 Scaffolder 上外挂一个 AI。

你的约束实际上已经把设计空间限定得很清楚：

1. **L2 Terraform 是真实源码**，不能再造 L3。
2. **L1 可能 breaking**，不能依赖“平台保证兼容”解决问题。
3. **应用团队、平台团队、Scaffolder 团队都有本地 coding agent**。
4. 人不应该记住 L1 几十个参数和升级细节，**这些知识应该交给 Agent**。
5. AI 可以改代码，但**正确性必须由 Terraform / policy / plan 验证**。

基于这五条，我会把产品重新定义成：

> **Scaffolder = Day 0 的 Human Interface + Day 2 的 Agent Handoff。**

也就是说，它生成的不应该只有 `.tf`。

它应该一次性交付：

```text
1. Terraform L2        ← 给 Terraform runtime
2. Agent Skill         ← 给未来维护代码的 AI
3. Validation Rules    ← 判断 AI 改得对不对
```

这三个东西就是整个设计的核心。

---

# 一、先把三个角色彻底分开

## 1. Platform Team

他们真正拥有的是：

```text
L1 Terraform Module
+
如何正确使用这个 Module 的知识
```

比如 ECS 平台团队最清楚：

- `cpu` 怎么配；
- public/private network 怎么配；
- 什么参数组合非法；
- logging 怎么开启；
- WAF 怎么添加；
- 4.x → 5.x 为什么 breaking；
- 哪些 Terraform plan 是预期的；
- 哪些东西绝对不能自己绕过 L1。

所以：

> **这些知识不应该由 Scaffolder 团队维护。**

而应该直接跟 L1 放在一起。

---

## 2. Scaffolder Team

他们真正应该拥有的只有：

```text
Human UX
+
Scaffold framework
+
Skill installation
+
validation pipeline
```

他们不应该理解：

> `ecs-service v5` 为什么把 `subnet_ids` 改成 `network.subnets`。

否则 Scaffolder 团队会变成所有平台团队的知识中转站。

---

## 3. Application Team

他们拥有：

```text
L2 Terraform
```

但之后大部分维护过程变成：

```text
Developer:
"把这个 service memory 调到 4G"

        ↓

Local Agent:
读取 Terraform
读取 ECS Skill
读取当前 L1 module
修改
terraform validate
terraform plan

        ↓

Developer review
```

应用开发者甚至不需要知道：

> 到底应该修改 `memory`、`task_memory` 还是 `container.resources.memory`。

Agent 应该知道。

---

# 二、所以真正的核心不是 Template，而是「Scaffold Pack」

每个 L1 平台能力提供一个版本化的 **Scaffold Pack**。

注意：

**这不是 L3。**

它不是应用源码，也不是用户需要理解的配置语言。

它就是类似：

```text
library
+
docs
+
examples
+
tests
```

的平台工程交付物。

例如 ECS L1 repo：

```text
terraform-ecs-service/

├── main.tf
├── variables.tf
├── outputs.tf
├── README.md
├── examples/
│
├── scaffolder/
│   ├── template.yaml
│   ├── skeleton/
│   │   └── main.tf
│   └── tests/
│       ├── basic/
│       ├── public/
│       └── production/
│
└── skills/
    └── ecs-service/
        ├── SKILL.md
        └── references/
            ├── common-changes.md
            ├── networking.md
            ├── observability.md
            └── upgrading.md
```

一个 PR 就可能同时改变：

```text
variables.tf

+ skill

+ scaffold

+ tests
```

所有 ownership 都在：

> **ECS Platform Team**

而不是 Scaffolder Team。

---

# 三、Scaffolder 本身反而变得很薄

架构：

```text
              Platform-owned Scaffold Packs

         ECS             RDS             Lambda
          │               │                 │
          │ TF + Skill    │ TF + Skill      │
          └───────────────┼─────────────────┘
                          │
                          ▼
                 ┌────────────────┐
                 │   Scaffolder   │
                 │                │
Human ──────────▶│ Form           │
                 │ Render         │
                 │ Validate       │
                 │ Install Skill  │
                 │ Create PR      │
                 └───────┬────────┘
                         │
                         ▼
                   Application Repo
```

Backstage 本身很适合只承担这一层：Software Template 本来就是参数表单 + actions + skeleton + Git publish，并支持 custom actions、dry-run 和权限控制。

---

# 四、一次 Scaffolding 到底生成什么？

比如用户选择：

```text
Create ECS Service

Name        payment-api
Environment prod
Exposure    internal
Size        medium
```

Scaffolder 最终 PR：

```text
payment-api/

├── infra/
│   ├── main.tf
│   ├── providers.tf
│   └── backend.tf
│
└── .agents/
    └── skills/
        └── example-ecs-service/
            ├── SKILL.md
            └── references/
                ├── common-changes.md
                └── upgrading.md
```

Terraform 还是普通 Terraform：

```hcl
module "service" {
  source  = "registry.example.com/platform/ecs-service/aws"
  version = "4.7.2"

  name        = "payment-api"
  environment = "prod"

  cpu    = 1024
  memory = 2048

  exposure = "internal"
}
```

**这就是 Source of Truth。**

没有：

```text
iac.yaml
blueprint.yaml
intent.yaml
generator.lock
```

---

# 五、真正改变游戏规则的是 SKILL.md

比如：

```markdown
---
name: example-ecs-service
description: Maintain infrastructure using the example ECS Terraform module.
---

# Example ECS Service

Use this skill whenever modifying Terraform under `infra/`
that consumes the example ECS service module.

## Before making changes

1. Read the existing module block.
2. Determine its exact module version.
3. Never assume an input exists.
4. Inspect that exact version of the L1 module before changing arguments.
5. Prefer existing L1 capabilities over direct AWS resources.

## Changing existing configuration

For ordinary changes:

1. Identify the requested platform capability.
2. Check whether the currently pinned L1 version supports it.
3. Make the smallest possible Terraform change.
4. Run:
   - terraform fmt
   - terraform validate
   - terraform plan
5. Explain the resulting plan.

Never run terraform apply.

## When the current L1 does not support the request

Do not immediately add raw AWS resources.

First:

1. Inspect newer L1 versions.
2. Find the minimum version that supports the requested capability.
3. Read the upgrade instructions.
4. Upgrade only when necessary.
5. Run Terraform plan.

## Module upgrades

Treat an L1 version change separately from a normal parameter change.

Before upgrading:

- read release notes
- inspect changed variables
- inspect migration instructions

After upgrading:

- terraform init -upgrade
- terraform validate
- terraform plan

Stop and require human review if the plan contains:

- resource deletion
- resource replacement
- IAM privilege expansion
- public network exposure
```

这就是：

> **Platform Team 在教 Application Team 的 Agent 怎么工作。**

而不是写一份人类读过一次就忘掉的 Wiki。

现在 Agent Skills 已经有一个非常适合这种用途的开放格式：一个 Skill 本身就是 `SKILL.md + scripts + references + assets`，而且强调 progressive disclosure。

甚至 Backstage 自己现在就在用这个模式给 coding assistants 发布 migration skill。

所以这不是一个很奇怪的自定义体系。

---

# 六、为什么 Skill 应该属于 L1 Platform Team

这是整个 ownership 设计里我认为最重要的一条。

假如 L1：

```hcl
variable "cpu" {}
variable "memory" {}
```

变成：

```hcl
variable "resources" {
  type = object({
    cpu    = number
    memory = number
  })
}
```

谁最先知道？

当然是：

> Platform Team。

所以他们改 L1 的同一个 PR：

```diff
terraform-ecs-service/

 variables.tf
 main.tf

+skills/
+  ecs-service/
+    references/upgrading.md

 scaffolder/
   skeleton/main.tf
```

`upgrading.md`：

```markdown
# v4 → v5

## Breaking change

The following:

cpu    = 1024
memory = 2048

becomes:

resources = {
  cpu    = 1024
  memory = 2048
}

No ECS service recreation is expected from this interface
change alone.

Always confirm with terraform plan.
```

然后他们自己的 Agent 也可以帮他们维护这些。

---

# 七、Platform Team 自己的 Agent workflow

这时候 AI 开始真正贯穿开发链路。

平台开发者说：

> 把 ECS module 的 resource 配置收敛到一个 object，并发布 v5。

Platform Agent 应该知道：

```text
修改 L1
     ↓
检测 public interface change
     ↓
发现 breaking
     ↓
同时更新：

variables.tf
README
examples
SKILL.md / upgrading.md
Scaffold starter
fixtures
```

PR：

```text
ECS L1 v5

Terraform
✓ module tests

Breaking API
✓ upgrade guide added

Agent Skill
✓ v4 → v5 migration documented

Scaffolder
✓ starter updated

Fixtures
✓ internal service
✓ public service
✓ prod service
```

---

# 八、这里甚至只需要一个非常简单的 CI Rule

不需要什么“Terraform Lifecycle Platform”。

比较：

```text
old variables.tf
        ↓
       diff
        ↑
new variables.tf
```

如果发现：

```text
required input added

input removed

input type changed

output removed
```

就：

```text
Breaking L1 interface detected.

Required:
[ ] upgrade documentation updated
[ ] Agent Skill updated
[ ] scaffold fixture validated
```

CI 不需要懂怎么 migration。

**只负责逼知识和代码一起交付。**

AI 可以判断语义变化，但这个 deterministic diff 可以防止人忘记。

---

# 九、Scaffolder Form 也应该重新设计

这里有另一个很容易犯的错误：

> 把 L1 的 60 个 Terraform variables 全部映射成 Backstage Form。

不要这么做。

Scaffolder 只解决：

> **创建时必须由人做出的重要决定。**

比如 ECS：

```text
Service Name

Environment

Region

Exposure
○ Internal
○ Public

Capacity
○ Small
○ Medium
○ Large

High Availability
○ Yes
○ No
```

只有 5～10 个问题。

生成：

```hcl
module "service" {
  ...
}
```

剩下长尾：

```text
调整 health check
增加 autoscaling
修改 log retention
增加 domain
开启 WAF
修改 scaling policy
```

全部变成：

> **Day 2 Agent operations**

而不是继续膨胀 Scaffolder UI。

---

# 十、这实际上产生了两个入口

以前：

```text
Human
  ↓
Scaffolder
  ↓
Terraform
```

现在：

```text
                 Day 0

Human ─────────▶ Scaffolder
                     │
                     ▼
                  Terraform


                 Day 2

Human ─────────▶ Local Agent
                     │
                 Agent Skill
                     │
                     ▼
                  Terraform
```

这是我认为整个设计最重要的产品变化。

**Backstage 不需要成为所有 infrastructure 操作的 UI。**

---

# 十一、举几个真实 Day 2 场景

## 场景 A：改内存

用户：

> 把 payment-api 内存改成 4G。

Agent：

```text
读取 main.tf

发现:
ecs-service 4.7.2

读取 ecs-service skill

确认当前版本:
memory 参数存在

修改:
2048 → 4096

terraform fmt
terraform validate
terraform plan
```

然后告诉用户：

```text
Plan

0 create
1 update
0 delete
0 replace

Only the ECS task definition changes.
```

结束。

**不需要 Scaffolder。**

---

# 十二、场景 B：增加一个当前版本没有的能力

用户：

> 给这个 service 开启 WAF。

Agent 查当前：

```text
ecs-service = 4.7.2
```

Skill 告诉它：

> 不要直接创建 `aws_wafv2_web_acl_association`，优先使用 L1。

Agent 检查 L1：

```text
4.7.2
没有 WAF

5.2.0
新增:
waf = {...}
```

于是回答：

```text
Current L1 4.7.2 does not expose WAF.

The capability is available from 5.2.

This requires:
4.7.2 → 5.2.0

The v5 upgrade also changes:
cpu/memory → resources

I will migrate both and validate the resulting plan.
```

然后修改。

这就是 AI 真正降低 L1/L2 abstraction friction 的地方。

---

# 十三、场景 C：Breaking Change

现在：

```hcl
version = "4.7.2"

cpu    = 1024
memory = 2048
```

用户要求升级。

Agent：

### Step 1

读自己的 repo。

### Step 2

读当前 L1 4.7.2 Skill / module。

### Step 3

读目标 v5 release 中：

```text
skills/ecs-service/references/upgrading.md
```

### Step 4

修改：

```diff
-version = "4.7.2"
+version = "5.2.0"

-cpu    = 1024
-memory = 2048
+resources = {
+  cpu    = 1024
+  memory = 2048
+}
```

### Step 5

更新 repo 里的 Skill 到 v5 版本。

### Step 6

Plan。

这时候：

> migration 是一次 AI coding task。

而不是平台必须提前开发一个 generalized migration engine。

---

# 十四、Skill 为什么最好跟 L1 Version 一起版本化

这里我会做一个非常具体的决定：

**Skill 放在 L1 repo 里面，跟 Git tag 一起发布。**

例如：

```text
terraform-ecs-service

tag v4.7.2
    Terraform
    examples
    skill

tag v5.2.0
    Terraform
    examples
    skill
```

这解决一个非常棘手的问题：

> “AI 到底应该相信哪一版文档？”

答案非常简单：

```text
main.tf

version = "4.7.2"

        ↓

优先读取 v4.7.2 对应的 module + skill
```

绝对不要：

```text
Terraform v4
+
Wiki latest
```

这种组合。

---

# 十五、甚至不一定需要把整个 Module 文档复制进 repo

Skill 只复制最重要的：

```text
rules
workflow
common recipes
upgrade instructions
```

具体 variables 的事实来源仍然应该是：

> **当前版本的真实 Terraform Module。**

应用 Agent 可以：

```text
terraform init
```

然后直接读取下载下来的 module：

```text
.terraform/modules/...
```

包括：

```text
variables.tf
outputs.tf
main.tf
README
examples
```

这样 AI 不需要相信一份重新生成的 schema。

---

# 十六、三个 Agent 其实应该各自有不同 Skill

这里我会明确拆成三个。

## Platform Agent Skill

安装在 L1 repo：

```text
develop-example-terraform-module
```

教 Agent：

```text
怎么开发 L1
如何识别 breaking interface
如何写 migration guidance
什么时候更新 scaffold
如何更新 application skill
怎么测试
```

---

## Scaffolder Agent Skill

安装在 Scaffolder repo：

```text
develop-example-scaffolder
```

教 Agent：

```text
如何创建 Scaffolder capability
UI field 应该怎么选
不要 mirror 所有 TF variables
如何 install platform-owned skill
怎么运行 dry-run
怎么跑 fixture
```

---

## Application Agent Skill

随 scaffolding 进入应用 repo：

```text
maintain-example-ecs-service
```

教 Agent：

```text
如何修改 L2
如何读取当前 L1
如何加 parameter
如何升级
什么情况下不能绕过 L1
如何 validate / plan
什么时候必须停下来问人
```

三方知识完全符合各自 ownership。

---

# 十七、Scaffolder Team 最终维护什么？

非常少。

我会让 Scaffolder 平台最终只有一个核心框架：

```text
@example/backstage-iac-scaffolder
```

负责：

```text
renderTerraform()

installAgentSkill()

runStaticValidation()

publishPullRequest()
```

以及统一 UI：

```text
owner
application
environment
account
region
```

具体：

```text
ECS 参数
RDS 参数
S3 参数
```

由 Platform Pack 提供。

所以新增 RDS：

### 不应该：

```text
RDS Team
 ↓
提 ticket 给 Scaffolder Team
 ↓
解释 module
 ↓
Scaffolder Team 写 template
```

而应该：

```text
RDS Platform Agent

"为这个 L1 创建 Scaffold Pack"

        ↓

scaffolder/
skill/
fixtures/

        ↓

PR

        ↓

Backstage 自动发现
```

Backstage 的 Software Templates 本身就是 Catalog `Template` entity，也支持通过 discovery/provider 发现模板，所以这套 ownership 模式和它的机制是匹配的。

---

# 十八、我会把完整系统压缩成这个图

```text
                         PLATFORM TEAM
                              │
                    ┌─────────▼─────────┐
                    │     L1 Repo       │
                    │                   │
                    │ Terraform Module  │
                    │ Examples          │
                    │ Scaffold          │
                    │ Agent Skill       │
                    │ Upgrade Guidance  │
                    └─────────┬─────────┘
                              │
                           release
                              │
                              ▼
                   ┌────────────────────┐
                   │     Backstage      │
                   │                    │
                   │ Human questions    │
                   │ Generate TF        │
                   │ Install Skill      │
                   │ Validate           │
                   │ Create PR          │
                   └─────────┬──────────┘
                             │
                             ▼
                    APPLICATION REPO
                    ┌───────────────────┐
                    │                   │
                    │ infra/*.tf        │ ← Source of Truth
                    │                   │
                    │ Agent Skill       │ ← How to maintain
                    │                   │
                    └────────┬──────────┘
                             │
                       days / months
                             │
                             ▼
                    Application Agent
                             │
                ┌────────────┼────────────┐
                ▼            ▼            ▼
             modify       upgrade       diagnose
                │            │            │
                └────────────┼────────────┘
                             ▼
                     terraform validate
                             +
                       terraform plan
                             │
                             ▼
                         Human review
```

这就是我认为应该做的 Scaffolder。

---

# 十九、AI 在这里不是“帮忙”，而是改变了 Scaffolder 的边界

传统思路：

> 我应该把所有可能的未来操作都做进 Portal。

于是：

```text
Create service
Resize service
Add WAF
Add database
Change subnet
Change logging
Upgrade module
...
```

Portal 无限膨胀。

AI-native 之后：

### Portal 最擅长的

```text
discover
choose
onboard
collect high-level intent
authorization
```

### Agent 最擅长的

```text
理解已有代码
理解用户自然语言
处理长尾 configuration
修改 source
migration
diagnosis
```

所以：

> **Scaffolder 应该刻意只解决高频、结构稳定的 Day 0；Skill 把长尾 Day 2 交给 Agent。**

这会让你之前 Atlas / Golden Path 里那个“Journey 不可能覆盖现实里所有原子操作”的问题也自然解决掉。

---

# 二十、V1 我实际只会开发这 5 个东西

我不会先搞 registry、migration engine、IaC compiler。

### ① 一个标准 Scaffold Pack 目录规范

```text
scaffolder/
skills/
fixtures/
```

就一个约定。

---

### ② 一个通用 Scaffolder action

```text
platform:terraformScaffold
```

负责：

```text
copy skeleton
render parameters
copy skill
terraform fmt
terraform validate
publish PR
```

---

### ③ 一个 Application Skill 模板

所有平台团队从这里开始：

```text
SKILL.md

Rules
Common changes
Adding capabilities
Upgrading L1
Validation
Escalation
```

使用标准 Agent Skills 形式，而不是发明自己的 agent DSL。Agent Skills 当前规范原生支持 `SKILL.md`、references 和 scripts。

---

### ④ 一个 Platform Skill

重点就是一句：

> **L1 public interface 改变时，同时更新 Skill / Scaffold / fixtures。**

让平台团队自己的 Agent 帮忙做。

---

### ⑤ CI

只验证：

```text
L1 tests                 ✓

Scaffold example
terraform init            ✓
terraform validate        ✓

fixtures                  ✓

Skill exists              ✓
```

如果 detect 到明显 breaking input change：

```text
require upgrade guidance
```

到此为止。

---

# 最后的产品定义

如果要给这个 Scaffolder 写一句设计原则，我会写：

> **Scaffold for humans once; teach their agents for everything after.**

在采用这一模型的组织中：

**Day 0**

```text
平台能力
→ Backstage Scaffolder
→ 正确、标准的 L2 Terraform
```

**Day 2**

```text
用户需求
→ Application Local Agent
→ Platform-owned Skill
→ 修改真实 L2 Terraform
→ validate / plan
```

**L1 Evolution**

```text
Platform Local Agent
→ 修改 L1
→ 同时修改 Skill / Scaffold / Upgrade Guidance
→ release
```

这里没有新增 L3，没有中心化 lifecycle engine，也不要求 L1 永远兼容。

真正新加的东西只有一个：

> **把“平台团队脑子里的维护知识”，变成 versioned、agent-readable、和 L1 一起发布的 Skill。**

我认为这是 AI 时代重新设计 Backstage Scaffolder 时最值得下注的那个核心抽象。
