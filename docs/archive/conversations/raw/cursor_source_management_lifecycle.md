# Source management lifecycle and roles
_Exported on 2026/5/11 at GMT+8 14:46:34 from Cursor (3.3.30)_

---

**User**

@docs/product/atlas_v1_design_status_snapshot.md 针对里面提出的问题，特别是 source management, 使用 confluence page
  作为例子，详细阐述生命周期的全过程，包括涉及到的角色，角色在什么地方进行什么操作，说清楚，注意当前的产品只是 V1，demo 阶段，还没有发布，所以设计都可以修改，另外还有一个产品分析的对话你也可以参考，但是最后你需要形成你的判断，原则在于不增加人的负担（能不增加 surface 就不增加），source management 应该尽量自动，可审计。

---

**Cursor**

Let me continue reading the key remaining sections.

我已经仔细阅读了 design status snapshot 和完整的产品分析对话记录，也检查了当前代码实现。下面是我的独立判断。

---

## 我的核心判断

产品分析对话方向大体正确，但有几个关键问题：

1. **角色过度拆分**：Source Curator 在 V1 就是 Cloud Platform team 自己，不需要单独命名一个角色增加概念负担
2. **PR 流程对 V1 来说太重了**：当前连 Confluence API 都没接，先跑通一个手动 + 半自动闭环比搭完整 PR automation 更务实
3. **生命周期状态过多**：V1 三个状态就够

我的设计原则：

> **能不增加 surface 就不增加。Source Author 零感知 Atlas。自动化做发现和监测，人只做权威判断。可审计是底线。**

---

## 一、角色定义（V1 只需要三个）

| 角色 | 是谁 | 与 Atlas 的关系 |
|------|------|----------------|
| **Source Author** | Confluence 页面作者 | **完全不知道 Atlas 存在**，只在 Confluence 写东西 |
| **Platform Team** | Cloud Platform team，同时也是 Atlas owner | 负责 source 的发现、纳入、监测、整个 registry 的运营 |
| **Capability Steward** | 某个 capability 的业务/技术负责人 | 只做一件事：确认某个 source 对自己负责的 capability 是否权威，以及权威到什么程度 |

产品分析里单独拆了 Source Curator——V1 不需要。Platform Team 人不多，他们既是 Atlas 的 owner，也是实际操作 registry 的人，再拆一个 curator 只增加概念而不增加价值。

---

## 二、生命周期（以 Confluence 页面为例）

### V1 只保留三个状态

```
Candidate → Active → Inactive
```

Inactive 覆盖 stale / deprecated / retired / broken 所有"不再完全可信"的情况，通过 `warning` 字段区分具体原因。不需要一开始就定义 8 个状态转换——那是给成熟产品用的。

---

### 完整流程：一篇 Confluence 文章的一生

#### Phase 1: 发现 — Source Author 不参与

**场景**：Cloud Platform team 的 Alice 知道有一篇有价值的 Confluence 文章 "How to onboard to AWS Federated Landing Zone"，或者 Atlas 的定时扫描发现了它。

**发现有三种方式，都不需要 Source Author 做任何事：**

| 发现方式 | 谁操作 | 在哪里 | 做什么 |
|----------|--------|--------|--------|
| 手动提交 URL | Platform Team (Alice) | Portal → Source Intake 页面 | 粘贴 Confluence URL，点 Submit |
| 定时扫描 | Atlas Backend (自动) | 后台定时任务 | 扫描预配置的 Confluence space/label，发现新页面 |
| 用户反馈 | Portal 普通用户 | Portal → 任意 capability 页面 → "Suggest a source" | 提交 URL + 简短说明 |

**发现后 Atlas backend 自动做：**

1. 调用 Confluence REST API（用 service account），拿到 page id、title、version、updated_at、author、labels、restrictions
2. 如果能读到正文，生成 AI summary：检测用途、适用 capability、owner 信号、support path、是否与已有 source 重复
3. 创建 `SourceCandidate` 记录，状态 = `candidate`

**关键**：到这一步为止，没有任何人填过表单。AI 预填了所有 metadata。

---

#### Phase 2: 确认 — Platform Team 初筛 + Steward 定性

**这是唯一需要人工判断的环节。**

##### Step 1: Platform Team 初筛

**在哪里**：取决于 V1 选择的治理底座。两种可行方案：

| 方案 | 操作位置 | 优点 | 缺点 |
|------|---------|------|------|
| **A: Portal Source Intake 页面** | Portal 内部页面，只 Platform Team 可见 | 不依赖外部系统自动化 | 是一个新 surface，但非常窄 |
| **B: Registry PR** | Git repo PR，Portal 只负责触发创建 | 天然审计、diff、rollback | 依赖公司 Git 平台支持 automation |

**V1 推荐方案 A**，原因：你已经说了公司当前无法自动创建 PR / 做 PR automation。Portal 加一个极窄的内部页面比搭 PR 流水线务实得多。这个页面不是 admin UI——它只显示 AI 生成的 candidate profile，让 Platform Team 做 reject / send to steward 这两个动作。

**Platform Team 看到什么（Source Intake Queue）：**

```
Candidate: How to onboard to AWS Federated Landing Zone

AI Summary: Application onboarding guide covering prerequisites, 
access request, TFE workspace setup, and Harness deployment.

Detected capability: AWS Federated Landing Zone
Suggested authority: Recommended (possibly Canonical)
Detected owner: Cloud Platform Enablement
Confluence version: 14 | Last updated: 2026-05-05
Permission: Readable by Atlas service account
Duplicate risk: Legacy AWS Landing Zone Guide (similar scope)

[Reject]  [Send to Steward ▾]
```

**Platform Team 的操作只有两个按钮**：Reject（不纳入）或 Send to Steward（选择哪个 steward）。AI 已经建议了 steward，Platform Team 只需确认或改。

##### Step 2: Capability Steward 确认权威性

**在哪里**：Steward 收到通知（邮件/Teams/Slack），点 deep link 进入 Portal 的一个极简确认页面。

**为什么不让 Steward 在 PR 里操作**：V1 阶段公司 Git 平台不支持自动化。让 steward 去看一个 PR 里的 markdown 文件变更对非工程角色不友好。一个 Portal 页面上 4 个按钮比 PR review 简单得多。

**Steward 看到什么：**

```
Source review request for: AWS Federated Landing Zone

Page: How to onboard to AWS Federated Landing Zone
AI Summary: [简短摘要]
Suggested scope: AWS Federated Landing Zone / Application onboarding

[Canonical]  [Recommended]  [Reference]  [Reject]
```

**Steward 只点一个按钮。** 没有表单，没有填字段。如果选 Canonical，系统再问一个二级确认："Is this the sole authoritative source for this scope?" — Yes / No。

**所有操作都记录审计日志**：谁、什么时间、对哪个 source、做了什么决定、基于哪个 Confluence version。

---

#### Phase 3: Active — 自动生效，Portal 展示

Steward 确认后，系统自动：

1. Source 状态 `candidate → active`
2. 保存 `reviewed_version`（Steward 确认时的 Confluence page version）
3. 保存 `reviewed_at`、`reviewed_by`
4. 保存 `authority_level`（canonical / recommended / reference）
5. 保存 `authority_scope`（哪个 capability + 什么范围）
6. 建立 source ↔ capability 关联
7. 按 authority level 自动设置 `review_frequency`（canonical 较短，reference 较长）

**Portal 上普通用户看到什么（在 capability detail 页面）：**

```
Authoritative Sources

[Canonical] How to onboard to AWS Federated Landing Zone
Confluence · Reviewed 2026-05-11 · Updated in Confluence 2026-05-05
[Open in Confluence]  [Report issue]
```

**关键区分**：Portal 显示两个时间——"Reviewed"（steward 确认时间）和 "Updated in Confluence"（源系统最后修改时间）。这两个时间的差异就是 trust signal。

---

#### Phase 4: 监测 — 完全自动

Atlas backend 定时任务（比如每天一次）对所有 Active source 检查：

| 检查项 | 方法 | 产出 |
|--------|------|------|
| 页面是否存在 | Confluence API → 200/404/403 | broken / permission_issue |
| version 是否变化 | 对比 `current_version` vs `reviewed_version` | changed_since_review |
| 内容是否实质变化 | body content hash 对比 | content_changed |
| review 是否过期 | `today - reviewed_at > review_frequency` | stale |
| 权限是否变化 | Confluence restriction metadata | permission_changed |

**变化分级（AI 辅助）：**

- **Minor**（typo、格式）：只记录，不打扰任何人，Portal 不显示 warning
- **Major**（操作步骤、policy 规则、scope 变化）：Portal 显示 "Changed since review"，通知 Steward
- **Critical**（页面删除、Atlas 无法读取、canonical 冲突）：Portal 显示强 warning，通知 Platform Team + Steward

**Portal warning 展示示例：**

```
[Canonical] [⚠ Changed since review] 
How to onboard to AWS Federated Landing Zone
Reviewed version: 14 | Current Confluence version: 16
Confluence · Reviewed 2026-05-11
```

---

#### Phase 5: 复核 — Steward 最小化介入

当 Major/Critical 变化被检测到，Steward 收到通知，点 deep link 进入确认页面：

```
Source changed: How to onboard to AWS Federated Landing Zone

Change summary (AI generated):
- Added ServiceNow approval as prerequisite
- Removed email-based access request path  
- TFE workspace naming convention updated

Reviewed version: 14 → Current version: 16
Severity: Major

[Still valid]  [Needs update]  [Deprecate]
```

- **Still valid**：`reviewed_version` 更新为 16，`reviewed_at` 更新，warning 清除
- **Needs update**：warning 保留，Source Author 自己去 Confluence 改（Atlas 不管 Confluence 内容）
- **Deprecate**：状态变 `inactive`，Portal 显示 deprecated badge + replacement 链接

---

#### Phase 6: 退出 — 同样通过确认

触发条件：页面删除（404）、长期 stale 无人确认、Steward 主动 deprecate、capability 下线。

状态变为 `inactive`，Portal 不再在主展示区显示，但保留审计记录。

---

## 三、权限问题的 V1 处理

不要试图解决 Confluence 权限的完整问题。V1 的策略是**诚实 + 保守**：

| Atlas service account 状态 | Source visibility | Portal 展示 |
|---------------------------|------------------|-------------|
| 能读 + 页面无限制 | `internal` | preview + "Open in Confluence" |
| 能读 + 页面有 restriction | `restricted` | metadata only + "This source may require access. Contact [support]" |
| 读不了 (403) | `service_blocked` | metadata only + "Preview unavailable" |
| 返回 404 | broken | warning badge |

**不做**：per-user permission check、delegated token、实时 Confluence ACL 查询。

**做**：在 source 注册时记录 Confluence restriction metadata（如果 service account 能读到），用于展示时的保守降级。

---

## 四、可审计性

所有人工决策都有审计记录：

```typescript
interface SourceAuditEvent {
  source_id: string;
  action: 'submitted' | 'rejected' | 'approved' | 'confirmed' | 'deprecated' | 'retired';
  actor: string;       // 谁操作的
  timestamp: string;
  confluence_version: number;  // 基于哪个 Confluence 版本做的决定
  decision: string;    // canonical / recommended / still_valid / ...
  context?: string;    // 可选说明
}
```

自动化事件同样记录：

```typescript
interface SourceCheckEvent {
  source_id: string;
  checked_at: string;
  confluence_version: number;
  health_status: 'healthy' | 'changed' | 'stale' | 'broken' | 'permission_issue';
  change_severity?: 'minor' | 'major' | 'critical';
  change_summary?: string;  // AI 生成
}
```

这些日志即使没有 PR，也能回答"谁在什么时候基于什么版本做了什么决定"。

---

## 五、与当前代码的关系

当前代码实现情况：

- `source_class: "confluence-page"` 已定义，但 resolver 只做 locator 格式校验（不以 `#` 开头），没有真正的 Confluence API 调用
- 所有 source 数据来自 `context-layer/src/seeds/pilotRegistry.ts`，内存加载
- `SourceSchema` 已有 `authority_level`、`last_reviewed_at`、`review_frequency`、`visibility` 等字段
- 没有 Source Intake、没有审计日志、没有 Confluence resolver

**V1 实现路径建议：**

1. 先接 Confluence REST API → 能读 page metadata + body
2. 加 Source Intake API（接收 URL → 调 Confluence → AI profile → 返回 candidate）
3. 加确认 API（steward approve → 写入 registry）
4. 加定时健康检查（version / access / freshness）
5. Portal 加 Source Intake 页面 + Steward 确认页面（极窄 surface）

**不需要先做**：PR 流程、完整 change detection、AI change summary。这些是 source 基本闭环跑通之后的增强。

---

## 六、总结：V1 Source Management 的设计原则

| 原则 | 具体含义 |
|------|---------|
| **Source Author 零负担** | 他只写 Confluence，不知道 Atlas 存在 |
| **AI 先行，人只确认** | metadata 自动提取 + AI 摘要，人只点按钮 |
| **最少 surface** | Portal 只加 Source Intake（给 Platform Team）+ Steward Confirm（极简确认页） |
| **可审计** | 每个人工决策和自动检查都有记录 |
| **状态最简** | candidate → active → inactive，warning 字段区分具体原因 |
| **权限诚实** | 不承诺用户一定能打开，保守展示 + access guidance |
| **Portal 是 consumer** | Portal 读 Atlas API，不直接调 Confluence |

---

**User**

Portal → Source Intake 页面
粘贴 Confluence URL，点 Submit 这就是填的表单吧。V1 这个 scope 合理，把 curator 和 owner 合并，但是长期呢？operating model 是否还是偏向于新增一个 surface 或者 gitops PR？

---

**Cursor**

好问题。两个分开说。

## 关于"填表"

是的，粘贴 URL 点 Submit 就是一个表单。但设计意图是区分**人输入什么**和**系统输入什么**：

| 人输入 | 系统自动填充 |
|--------|------------|
| 1 个字段：Confluence URL | title, page id, version, author, updated_at, labels, restrictions, AI summary, detected capability, detected owner, suggested authority, duplicate candidates, risks... |

所以它是表单，但是一个**单字段表单**。人的贡献是"指向一个 source"，剩下全靠 Confluence API + AI。这和传统 admin UI 里让人填 15 个字段是本质不同的。

---

## 长期 operating model 的判断

这其实是一个关于**治理记录应该住在哪里**的问题。

### 三种长期选项对比

| | Portal 内 ops surface | GitOps PR | Portal 触发 + PR under the hood |
|---|---|---|---|
| **人的交互** | Portal 页面点按钮 | 写 YAML + PR review | Portal 页面点按钮 |
| **治理记录** | 数据库 + audit log | Git history + PR review 记录 | Git history + PR review 记录 |
| **审计能力** | 需要自己建 | Git 天然提供 diff/rollback/blame | Git 天然提供 |
| **权限控制** | 需要自己建 RBAC | CODEOWNERS + branch protection | CODEOWNERS + branch protection |
| **steward 门槛** | 低（点按钮） | 中（需要 Git 基础知识） | 低（点按钮） |
| **对 Platform Team** | 维护 Portal ops 页面 | 维护 registry repo + CI | 两者都维护 |
| **V1 可行性** | 可行 | 受限（无 PR automation） | 受限 |

### 我的判断

**长期应该走 Portal 触发 + PR under the hood，但不是现在。**

原因：

1. **审计需求会增长**。V1 audit log 在数据库里就够了。但当 source 数量到几十上百，leadership 问 "谁在什么时候把这个 policy source 从 canonical 降级了" 的时候，Git history 比数据库查询直观得多。

2. **权限控制是天然的**。CODEOWNERS 可以按 capability 目录分配 steward review 权限，不需要在 Portal 里自建一套 RBAC。

3. **但 steward 不应该被要求学 Git**。所以 Portal 仍然是交互层——steward 在 Portal 点 "Canonical"，背后系统生成一个 PR、写入 registry change、自动请求 steward 作为 reviewer（steward 可以在 Git 平台点 approve，也可以在 Portal 确认后由系统代为 approve）。

4. **当前的真正约束是公司的 Git 平台 automation 能力**。你说了公司无法让 automation 创建 PR、跑 CI、让 agent 分析——那在这个能力到位之前，Portal ops surface 就是最现实的选择。

### 所以演进路径是

```
V1 (现在)
  Portal Source Intake → Backend 写 DB → Audit log in DB
  Steward 在 Portal 确认

V2 (公司 Git automation 到位后)
  Portal Source Intake → Backend 创建 PR → AI 分析写 PR comment
  Steward 在 Portal 确认 → Backend 代为 approve PR → merge 更新 registry
  DB audit log + Git history 并行

V3 (规模化后)
  自动扫描 + Portal intake 并行 → PR under the hood
  CODEOWNERS 按 capability 分派 steward
  Portal 是交互层，Git 是治理底座
  steward 可选 Portal 或 Git 平台操作
```

**关键设计决策**：V1 的 data model 和 API 不要和 "Portal-only" 耦合。也就是说，`SourceCandidate`、`SourceRecord`、steward decision 这些对象应该是 Context Layer 的 domain 概念，Portal 只是 consumer。这样未来切到 PR-backed 时，只需要加一个 "PR adapter"，不需要重写 domain model。

### 关于是否"新增 surface"

V1 确实新增了 surface（Source Intake 页面 + Steward Confirm 页面）。但这两个页面加起来可能就 2-3 个按钮。它们不是 admin UI，更像是 **governance checkpoint**——嵌入在 source lifecycle 里的最小决策点。

长期走 PR under the hood 之后，这两个 surface 不会消失，而是变成 PR 操作的**前端壳**。人看到的还是那几个按钮，只是背后写的不是 DB 而是 PR。

所以答案是：**长期一定有 surface，但它始终是极窄的决策入口，不是管理后台。PR 是治理底座，Portal 是交互层。二者不矛盾。**

