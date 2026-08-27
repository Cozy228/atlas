# Atlas - App-Centric Experience Architecture

> **状态:** 决策草案 · 2026-08-17
> **范围:** 信息架构与体验骨架的决策记录。视觉系统沿用 [DESIGN.md](../../DESIGN.md)(Blueprint)，
> 产品意图与边界见 [Atlas.md](../../Atlas.md) 与 [DevExPortalStrategy.md](../../DevExPortalStrategy.md)。
> 本文档**不**重述那些内容，只固化"页面长什么样、意图怎么导航、复杂度关在哪"的决策。

---

## 0. 这份文档要回答的问题

Atlas 的产品定位是 "application-centric multi-cloud developer experience platform"。
但 **app-centric 是一个内容/上下文原则，不是一个导航结构**。这份文档的核心工作就是把这个区别落实成可实现的界面骨架，避免两个常见误读:

- ❌ "app-centric = 导航锚点是 app" → 会做成一个 app switcher 当脊柱的列表式产品。
- ❌ "所有体验都包进 Journey" → 会做成 Backstage 式的、必须先进流程才能干活的向导。

正确的模型见下。

---

## 1. 锚点是身份，不是 app

进入 Atlas 的第一件事不是选 app，而是**企业身份解析出这个人的处境**:


```

Entra ID  →  SailPoint role  →  这个人拥有 / 负责哪些 application

```

解析结果落在三种情况。**Home 不是一个有固定内容的页，而是一个按身份分流的路由**(见 §6b)，把用户送到三个不同的**目的地**之一:

| 情况 | 身份解析结果 | Home 路由到的目的地 | 主意图 |
|---|---|---|---|
| **1. 无 app** | 名下没有已上平台的 app | **Onboard 起步态**(§6c) | Complete(走 Golden Path) |
| **2. 一个 app** | 解析到 1 个 app | **直落那个 app 的 Workbench Overview**(§6d,无中间层) | Observe / Act / Recover |
| **3. 多个 app** | 解析到 N 个 app | **分诊台**:跨 app 待办 + 选一个 app 进去(§6b) | 先 Observe,再下钻 |

关键判断:

- 这三种是**三个不同的目的地**，不是同一页的三种形态。Home 只负责分流，自身无固定内容。
- **情况 2 不再有独立的 "Home 页"**——它会等于 Workbench Overview，强行分两页只会让单 app 用户看两遍几乎相同的内容。直接落进 Workbench，消除冗余。
- **分诊台(情况 3)是 Home 唯一真正独立的新形态**:Home 的独立价值随 app 数量增长——1 个 app 时没有独立存在的必要，N 个 app 时才真正需要(跨 app 收件箱 + 入口)。
- 情况 3 **不做**企业数据全景大屏(Atlas.md §四.2 明确警告)。N 个 app 时先收敛到"选一个"。

---

## 2. App switcher 在意图之外

顺序永远是:


```

先确定"我在哪个 app 里"(或"我要起一个新 app")    ← app 级 context
↓
再回答"在这个 app 里我要做到什么"              ← 意图,活在 context 之下

```

因此 **app switcher 是 app 级的持久全局 context**，不是一个导航目的地，也不是脊柱。

但它**不占左上、也不在全局态常驻**:

- **左上恒为 logo + "Atlas" 产品名**，雷打不动，不承载任何 app 信息。
- **全局态**(还没进任何 app):选 app 这件事发生在 **Home 工作台内容里**(情况 2/3 在那里选)，顶栏中间是意图 tab，**没有独立 app switcher**。
- **App 态**(进入某个 app):顶栏中间的意图整体**让位**，换成 **常驻 Ask 输入框**(见 §3); app 身份 + switcher `[ ❖ app-name ▾ ]` 收到**右上角**。想跳到别的 app，点右上下拉即可，不必回 Home。

---

## 3. 布局:混合(顶栏 + app 内 sidebar)

**顶栏是一条不变的锚**，复杂度关在 app 内部。Shell 只有两个稳定状态，顶栏结构在两态间不重构——logo + 字标永远在左上角，app switcher 永远在顶栏同一位置。

**全局态**(Home / Onboard / Catalog)—— 左上纯 logo，中间是意图 tab，无 sidebar、无 app switcher:


```

+-----------------------------------------------------------------------+
| [logo] Atlas         Home    Onboard    Catalog             ⌕  Ask  ⚙ |
+-----------------------------------------------------------------------+
| 内容直接铺满(选 app 发生在 Home 内容里)                               |
+-----------------------------------------------------------------------+

```

**App 态**(进入某个 app)—— 意图让位，中间变成常驻 Ask 输入框，app 身份收到右上，左侧长出 rail:


```

+-----------------------------------------------------------------------+
| [logo] Atlas   [ ⌕ Ask about payments-api... ]    ❖ payments-api ▾  ⚙ |
+--------------+--------------------------------------------------------+
| Overview     |                                                        |
| Delivery     | payments-api 的某个面                                  |
| Access       |                                                        |
| Tickets      |                                                        |
| Docs         |                                                        |
| Support      |                                                        |
+--------------+--------------------------------------------------------+

```

规则:

- **不变的锚:** logo + "Atlas" 产品名永远在左上角，不承载 app 信息。顶栏不因进 app 而重构结构，只有**中间区**与**右侧区**的内容在两态间切换。
- **全局态中间 = 意图 tab**(Home/Onboard/Catalog);右侧 = 搜索 · Ask · 主题;右下角有全局 **Ask Atlas FAB**。无独立 app switcher。
- **App 态中间 = 常驻 Ask 输入框**(占位符带 app 名 `Ask about {app}...`，天然带上下文，呼应 §6 诊断"必须解析到 app");右侧 = **app switcher `❖ app-name ▾`**(+ 当前环境/状态) · 主题。切别的 app 点右上下拉即可，不必回 Home。左侧同时长出 rail 承载该 app 的内部面。
- **App 态隐藏右下角 FAB**——Ask 已是顶栏一等公民，避免两个 Ask 入口重复。
- **回全局:** 点左上 logo → Home。
- **sidebar = 进入任何"纵深工作区"时的左栏导航**，不是 app 态专属:
  - **App workbench**:左栏导航该 app 的各个面(Overview / Delivery / Access ...)，顶栏切 app 态。
  - **Onboard**(§6c):左栏导航 golden path 的各步骤，顶栏**保持全局态**(Onboard 是全局意图)。
  两者共用同一 shell 形制，只是左栏内容不同(app 面 vs 路径步)。
- 沿用现有 pilot 的 56px opaque 顶栏、坐标网格、密度美学(DESIGN.md); sidebar 按 Blueprint 校准(surface + hairline，不引入 Port/Backstage 的重灰视觉)。

---

## 4. 顶层意图:Home · Onboard · Catalog

只有三项真正的"目的地意图"，全部是 MVP 真能做到的事:

| 意图 tab | 承载 | 来源 |
|---|---|---|
| **Home** | **身份路由**(无固定内容，按身份分流，§6b) \| 语义从 pilot 的落地页转为路由 | |
| **Onboard** | 把一个新 app 带上 AWSF → 首次 DEV 部署(唯一 Golden Path) \| Atlas.md §四.4 / §八.4 | |
| **Catalog** | 平台能力 / 文档 / 区域可用性 / 变更 / 支持(参考型意图) \| **收编现有 pilot 的 Welcome-desk 发现型内容** + Availability / Newsletter / Support / Sources | |

- **现有 pilot 的 Home**(Welcome desk:hero 意图搜索 + JourneyGrid + 服务索引 + 变更 timeline)是**发现型落地页**，气质属 Catalog。其内容**整体流入 Catalog**(界面 5);顶栏 Home tab 的位置改为**身份路由**。这是产品重心从"信息中心"(Discover 为主)转向"我的应用 + 完成任务"的体现。
- **新增只有 Onboard 一项**——最直白，且是 October MVP 唯一的 Golden Path。
- **行动**(在某个 app 里干活)不占顶栏，靠 app switcher + workbench sidebar 承载。
- **Diagnose 不占顶栏**，见 §6。

---

## 5. Onboarding 只属于情况 1

- Onboarding 是"让一个 app 从无到有、走到第一次 DEV 部署"的 Golden Path，是一条 **Journey**(需要跨步骤、跨系统、跨会话持久保存进度/阻塞/证据)。
- 起点是**空的起步向导**，用户**手动开始**。App Code、repo **不是前置条件**，而是 Golden Path 沿途逐步产出 / 确认的内容。
- 进入一个**已存在**的 app 后触发的是**别的** Golden Path(production readiness、Vault、pipeline migration...)，**不再是 onboarding**。这些 MVP 不做。
- Onboarding **中途临时冒出的 app 半成品 / 特殊状态**(如流程未走完但已有部分资源)，归 **workbench** 承载。

October MVP 只做 onboarding 这一条 Golden Path。

---

## 6. Diagnose 是失败对象上的能力，不是导航目的地

Atlas.md §七.6 硬约束:诊断**必须解析到 `Application + Environment + Failed Run / Symptom`** 才能开始上下文聚合。因此**不存在脱离 app 和某次失败的诊断**——它不是一个会空着走进去的目的地，不占顶栏。

诊断覆盖的是具体断点(Atlas.md §四.6 / §八.6):SailPoint group 未生效、account/connector 不匹配、Harness 命名错、Black Duck 失败、TFE output 未进 task definition、deployment stage 失败等。**每一个都挂在某次失败的执行上**，不是通用 chatbot。

### 内容五块(恒定，复用现有 `diagnosis-data`)

回答卡住的人的两个问题——"为什么挂了" + "我下一步干什么":


```

① 失败定位  —— 哪个 run / stage 失败，何时(红框锚定)
② 可能原因  —— 一个或多个 hypothesis，各带 confidence，按置信度排序
③ 证据      —— 支撑原因的日志 / 版本 / 近期平台变化，每条带 provenance(诚实，可点源)
④ 推荐操作  —— 受治理的下一步(re-run / 改配置 / 预填 PR)，human trigger，Atlas 不自动执行
⑤ 兜底      —— 预填 ticket + support route(不确定或需要人时)

```

①②③ 回答"为什么"，④⑤ 回答"怎么办"。内容恒定，不随呈现方式变。

### 两种同源视图(按用户处境，可升级)

同一份诊断，两种视图，由用户此刻的处境决定:

| | **就地铺开(聚焦版)** | **独立页(完整版)** |
|---|---|---|
| **处境** | **打断式**:在别的主任务里撞到失败 | **目的式**:专程来排查一个失败 |
| **心智** | 别让我离开现场，给结论 | 给我专注 + 完整的空间，给全貌 |
| **触发** | Onboard 失败步 · Workbench Delivery 失败 run \| 分诊台跨 app 待办点失败 · 告警链接 · 深挖 | |
| **布局** | **C 结论先行**:结论卡(最可能原因 + 首要动作)+ 证据**默认折叠** + "打开完整诊断 →" | **A 双栏**:左=为什么(原因 + confidence + 证据链**全展开**)，右=怎么办(fix + action + support) |

**两种视图各用各的布局逻辑，不是一种布局两种密度:**

- **独立页 = A 双栏，证据全展开**。用户专程来排查，就是来看证据的——镜像"为什么 → 怎么办"两个问题同时在眼前。复用现有 `investigate` 双栏(排名板 `triage` 弃用)。
- **就地版 = C 结论先行，证据折叠**。用户被打断、要的是结论——顶部结论卡(最可能原因 + 首要动作)，证据默认收起(想深究点开)，留 **"打开完整诊断 →"** 升级到独立页。右侧工作区窄，单列，折叠正合适。

呼应 §6d 抽屉通则:诊断内容密集、要停留 → 就是**右侧铺开**(非抽屉)。

> 全局入口(如 Ask Atlas 里问"我的 xx 部署为什么挂了")**允许**存在，但同样先解析上下文再聚合，不需要顶栏常驻。

---

## 6b. Home = 身份路由;分诊台 = 它唯一独立的新形态

**Home 不是一个有固定内容的页，是一个按身份分流的路由。**点 Home(或进 Atlas) → 身份解析 → 送到三个目的地之一:


```

点 Home / 进 Atlas
↓ 身份解析(Entra → SailPoint)
├── 无 app    → Onboard 起步态(§6c)
├── 1 个 app  → 直落那个 app 的 Workbench Overview(§6d,无中间层)
└── N 个 app  → 分诊台(下方)，唯一有独立内容的 Home 形态

```

**为什么这样:** 情况 2 下，原来设想的"Home 页"和 Workbench Overview 几乎逐块重合(环境带、待办、失败项)。强行分两页 = 让单 app 用户看两遍。合并后:单 app 用户点 Home 直接回到自己 app 的 Overview; Home 的独立价值只在多 app 时出现。

**顶栏 Home tab 语义:** "回到我的起点 / 重新分流"，不是"一个固定页面"。

### 分诊台(仅情况 3:N 个 app)

多 app 用户的**跨 app 收件箱 + 入口**。全局态(顶栏 Home/Onboard/Catalog，无 sidebar)，单列铺开:


```

+-----------------------------------------------------------------------+
| [logo] Atlas     Home  Onboard  Catalog                     ⌕  Ask  ⚙ |
+-----------------------------------------------------------------------+
|  Hi Ziyu · 4 applications · 2 need attention            ← 招呼 + 处境 |
|                                                                       |
|  Continue(跨所有 app)                                   ← 进行中可恢复|
|  [ ↻ AWSF Onboarding · payments-api · TFE · 4/9           Resume→ ]   |
|                                                                       |
|  Needs you · across 4 apps · 3                          ← 跨 app 待办 |
|  [ ⚠ payments-api   DEV deploy failed 🟩#1428             Diagnose→ ] |
|  [ ⏳ ledger-service access pending 3d                         View→ ] |
|  [ ⚠ ledger-service Black Duck high finding               Diagnose→ ] |
|                                                                       |
|  My applications                                        ← app 分诊选择|
|  Needs attention · ⚠ payments-api · ⚠ ledger-service                  |

| Healthy · notify-worker · audit-log                     [ All → ] |
| --- |
| + Onboard a new application      Announcements · ECS v2 |
| +-----------------------------------------------------------------------+ |

```

区块(仅分诊台):


```

① 招呼行 + 处境        —— N applications · M need attention
② 继续进行(跨 app)    —— 进行中、可恢复的 Golden Path / 任务
③ 需要你处理(跨 app)  —— 聚合所有 app 的失败 / 阻塞 / 待审批，每项标明所属 app
④ 我的应用(分诊)      —— needs attention 组(带就地诊断入口)/ healthy 组(折叠成一行)
⑤ 尾巴                —— + Onboard a new application · 公告

```

- **全宽单列**，每组 card + hairline;区块间用间距分隔，不用全宽分割线(DESIGN.md §5)。
- **③ 处理项跳转:** 一律**进对应 app 的 Workbench 相关面**(点失败 → 该 app Delivery + 就地诊断;点待审批 → 该 app Access 面)。换 app context + 直达具体面，统一"干活在 app 内"，不在分诊台弹面板。
- **不做 portfolio 大屏**——只做"分诊 + 选一个进去"，健康的 app 折叠成安静一行。

三方分工(消除边界模糊):

| | **Home** | **Onboard** | **分诊台**(仅 N app) | **App Workbench** |
|---|---|---|---|---|
| **角色** | 身份路由，无内容 | 发起新 Golden Path | 跨 app 收件箱 + 入口 | 单 app 纵深 |
| **内容** | 分流 | 路径起步 + 执行 | 跨 app 待办 + 选 app | Overview 首屏 = 裁决 + 待办 |

---

## 6c. Onboard Golden Path(界面 3)

**回答:** "把我这个还没上平台的 app，一路带到第一次成功的 DEV 部署——现在到哪、卡在哪、下一步做什么、有没有证据。" 是情况 1 的主角、October MVP 的核心。

**入口:** 顶层 `Onboard` tab(发起新的)或 Home 情况 1 的起步卡。onboarding 是"app 从无到有"，进入时**还没有真正的 app context**——这正解释了它为什么是顶层意图，而不在某个 app workbench 里。

### 布局:sidebar 做垂直路径，右侧是当前步工作区

顶栏**保持全局态**(Home/Onboard/Catalog，随时跳回);进入后是"纵深工作区"形制(§3):


```

+-----------------------------------------------------------------------+
| ONBOARD            | Step 4 · Provision TFE workspace    🔒 Blocked   |
| Wolfram Ledger     |                                                  |
| 4 / 9 · 2d         | 右侧 = 当前步工作区(主角):                       |
|                    | · 要我做什么 / 卡在哪                            |
| ✓ 1 Access         | · Diagnosis(摘要:失败阶段/可能原因/推荐操作)     |
| ↻ 3 Repository     | · 完整证据(日志 / 关联近期变化 / run 详情)       |
| [ 🔒 4 TFE      ← ]| · action(re-run / 预填 ticket / open in TFE)     |
| ⚪ 5 Harness       |                                                  |
| ⚪ ...9 Health     | 当前步选中时，右侧就是它的完整内容;              |
|                    | 失败步 → 右侧直接铺开完整诊断(见下 ②)。           |
| Assets (5) ▸       |                                                  |
| Elapsed 2d 4h      |                                                  |
+--------------------+--------------------------------------------------+

```

- **左栏 sidebar = 垂直路径**:9 步可点跳(done 回看证据，pending 预览"这步要做什么")，当前步高亮;是 DAG(可并行分支)。**底部**放次要但需常驻的 Assets 计数(点开看清单)+ Elapsed 计时。
- **右侧 = 当前步工作区**(主角):切步即换内容。

**保留现有 `onboarding-view` 的精华**(迁入新布局):DAG 分支、每步内联记时(took/blocked/running，呼应 North Star active vs blocked)、asset tracker(移入左栏底部)、Harness 步内嵌 scaffold action(现有 `scaffold-view` 即此步执行界面)。

**在此之上补三处**(现有实战、新架构要求):

1. **① 起步态:** 情况 1 刚发起、还没 context 时，第一屏是**只填 App Code 一个输入**的起步卡(其余 team/owner/account/repo 由 Atlas 沿途解析或询问——零摩擦，不让用户猜字段)。填完才生成路径。
2. **② 失败步就地诊断:** onboarding 中途失败是诊断的**最主要入口**(§6)。选中 blocked 步，**右侧工作区本身就是诊断的完整形态**——摘要(失败阶段/可能原因/推荐操作)+ 完整证据(日志/关联近期变化/run 详情)+ action，全部在右侧纵向铺开。**不用抽屉**(右侧本来就宽，放得下;抽屉是为窄主区设计的，这里不需要)。
3. **③ 完成态 / 证据:** 走到第 9 步成功 = 完成面(app is live in DEV + 部署 URL + 证据); onboarding 完成意味着**这个 app 正式进入 portfolio**(情况 1 → 情况 2 的转变)。

**风格:** 全 Blueprint、全英文文案。失败步诊断用 critical-tinted 在右侧就地铺开。

---

## 6d. App Workbench(界面 4)

**回答:** "这个 app 的一切——各环境状态、最近部署、谁能访问、有什么工单、文档、找谁支持。" 是情况 2/3 进入某 app 后的**纵深**(对比 Home 的横切)。

**入口:** Home 处理项跳转 / 情况 2 "Open workbench" / app switcher 切换。进入后**顶栏切 app 态**(中间 Ask 输入框，右上 app switcher)。

### 布局:纵深工作区(与 Onboard 同壳)


```

+-----------------------------------------------------------------------+
| [logo] Atlas   [ ⌕ Ask about payments-api... ]    ❖ payments-api ▾  ⚙ | ← app 态顶栏
+------------------+----------------------------------------------------+
| payments-api     | Overview                                           |
| ● Degraded       | ● DEV deployed  ● UAT deployed  ● PROD degraded ⚠  | ← 环境状态带
|                  |                                                    |
| Overview   ←     | Needs attention · 2                                |
| Delivery         | ⚠ PROD error rate elevated · hotfix mid-pipeline      |
| Scaffold         |   [Diagnose→]                                      |
| Access           | ⏳ SailPoint access pending [View→]                 |
| Tickets          |                                                    |
| Docs             | Recent deployments                                 |
| Support          | ◻ #1432 PROD hotfix ↻ · ◼ #1428 DEV failed ⚠       |
| (+ 5 后续面)     |   [Diagnose→]                                      |
|                  |                                                    |
| APP-4821·team    |                                                    |
+------------------+----------------------------------------------------+

```

- **左栏 sidebar** = app 的面;顶部 app 名 + 健康点，底部 app code + team。
- **右侧** = 当前面内容;切面只换右侧，canvas 宽度一致。

### IA:sidebar 显完整 11 面，MVP 先实现核心几面

左栏完整展示 Atlas.md §七.2 的 11 面(体现产品全貌);MVP 阶段只有核心面有真实内容，其余显示为占位 / "后续"(尊重 §八.2 的克制)。**各面按内容性质选展示形式**(不都套 card 列表):

**Overview 是单 app 用户的落地首屏**(合并后不再有独立 Home 缓冲，见 §6b)，它**就是一个 app 级 dashboard**——不回避这个定性。判断每个元素上不上的标准**不是"像不像 dashboard"，而是:**

> 该元素是否 (1) 过五条测试之一(帮用户做决定 / 执行下一步 / 理解失败 / 找责任人 / 验证结果)，
> **且** (2) MVP 有真实数据支撑(无数据则不放，或按 governed honesty 显示为诚实缺口)。

只要 make sense，静态 stat / metric / sparkline / 身份锚 / 薄入口都可以上——密度是 feature(PRODUCT.md)。要避免的从来不是形式，是**装饰性指标、假趋势、无决定价值的全景堆砌**。

### Overview 需要四类内容(从"用户为何来"倒推)

进入已存在 app 的第一屏，看它的人(owner / 开发 / tech lead)在四个时刻打开:例行检查、出事了、要动手、交接找人。据此，一个诚实的 app dashboard 需要且只需要四类内容:

| 类别 | 回答的时刻 | 是什么 | 五条测试 |
|---|---|---|---|
| **A 健康裁决** | 例行检查 / 出事 | 整体好不好 + 关键 metric(error/latency/uptime)+ 各环境健康 | 理解失败 ✓ |
| **B 要我处理的** | 出事 / 要动手 | 失败/阻塞/待审批，**跨来源聚合到这一个 app** \| 执行下一步 ✓ | |
| **C 最近动静** | 例行检查 / 出事 | 最近部署/变更/事件时间线("这 app 最近的动静") | 验证结果 ✓ |
| **D 归属 / 连接** | 交接 / 找人 | owner/team/contact + repo/account/workspace/pipeline 外链 | 找责任人 ✓ |

**关于环境不是冗余:** Overview 的 A 需要**环境层面的健康点**(各环境好不好); Delivery 需要的是**部署流程细节**(run 历史 / 版本漂移 / pipeline)。同一个"环境"在两面回答不同问题——**是详略层级，不是重复**。

### 布局:左 sidebar + 中主区(A+B+C)+ D 抽屉(默认不占空间)


```

+------------------+----------------------------------+-----------------------+
|                  |                                  | About 抽屉(默认收起) ⌝|
| workbench        | Overview           [ ⓘ About ]   |                       |
| sidebar          |                                  | D: 归属 / 连接        |
| (导航各面)       | A ⚠ DEGRADED  [error][p95][uptime] | owner · team          |
| ● Overview ←     |   各环境健康点                   | contact  ↗            |
| Delivery         |                                  | repo     ↗            |
| Access  ...      | B 要我处理 · 2                   | account  ↗            |
|                  |   ⚠ ... [Diagnose→]  ⏳ ... [View→]| workspace ↗           |
|                  | C 最近动静                       | pipeline ↗            |
|                  |   ● today deploy · ● 2d incident |                       |
+------------------+----------------------------------+-----------------------+

```

- **中主区 = A+B+C 纵向**，是 Overview 主体。
- **D 归属/连接默认不占空间**，由主区顶部 `About` / `ⓘ` 按钮触发**右侧抽屉**——低频元信息按需取，不和高频的健康/待办抢首屏。

**每类形式:**

- **A 健康裁决**:tone 块(critical/warning/success)+ verdict headline + notice; **metric = stat 卡组**(error/p95/uptime,tabular; **有真实时间序列则配 sparkline**，没有则只显数字);各环境健康点一行;底 provenance chip + primary action(Diagnose)。复用 `deriveVerdict`。健康时整块收成安静一行。
- **B 要我处理**: **图标分类列表**——每行类型图标(⚠失败 / ⏳等待 / ⚙未配置)+ 描述 + 右侧就地动作(跳对应面)，hairline 分隔。
- **C 最近动静**:日期引导时间线(近的在上)，部署/变更/事件混排，状态 chip。
- **D 归属/连接**(抽屉):归属(owner/team/contact,"找责任人")+ 连接(repo/account/workspace/pipeline 外链,"跳源系统")，每项带 provenance。

> **通则(抽屉 vs 就地):** 主任务、内容密集、需要停留 → **右侧就地铺开**(如 Onboard/Delivery 的诊断);参考性元信息、低频、看完即走 → **右侧抽屉**(如 Overview 的 D)。

**Delivery**(交付纵深面)形式 = **环境流 + run 表**:


```

+-------------------------------------------------------+
| DEV ──→ UAT ──→ PROD                                  | ← 横向环境流
| v2.4.1   v2.4.1   v2.3.9 ⚠ drift                      |
| ✓gates   ✓gates   1.84% err          [ Diagnose → ]   |
+-------------------------------------------------------+
| Runs                                                  | ← run 历史表(tabular)
| ◻ #1432 PROD v2.4.1 ↻ running  2m                     |
| ◼ #1428 DEV  v2.4.1 ⚠ failed   -   [ Diagnose → ]     |   ← 失败行展开右侧就地诊断
| ◼ #1425 UAT  v2.4.1 ✓ success  4m                     |
+-------------------------------------------------------+

```

| 面 | MVP | 展示形式 | 就地动作 |
|---|---|---|---|
| **Overview** | ✅ | **混合 A+C 四块**:裁决 + 待办 + 身份锚 + 薄入口(见下) | 各项跳对应面 |
| **Delivery** | ✅ | **环境流 + run 表**:顶部横向环境流(dev→uat→prod rail,显版本漂移 / gates / 当前 run),下方 run 历史表(# / env / 版本 / 结果 / 时长,tabular) | 失败 run 行展开右侧就地诊断 |
| **Scaffold** | ✅ | **独立 action tab**:provision a new workload(命名 + 决定 + 代码预览 → 生成 PR + 触发 Harness) \| 复用 `scaffold-view` | |
| **Access** | ✅ | 表格:who / role / grant status / source(SailPoint);pending 顶部高亮 | Request access(受治理 action) |
| **Tickets & Changes** | ✅ | 时间线/列表:聚合到该 app 的 ticket/change/incident,状态 chip | Open pre-filled ticket |
| **Documentation** | ✅ | 文档源列表(复用 Document Sources 组件):编号 + 标题 + type·id + owner·freshness·link \| 跳源系统 | |
| **Support** | ✅ | support route 卡:问题类型 → 责任团队 + 升级路径 + channel | Contact / escalate |
| Cloud & Environments | ⏭ 后续 | 占位 | - |
| Resources | ⏭ 后续 | 占位 | - |
| Cost | ⏭ 后续 | 占位(§八.2 不进关键路径) | - |
| Journeys | ⏭ 后续 | 占位(已存在 app 的其他 golden path) | - |
| Diagnostics | ⏭ 后续 | 占位(诊断主要从失败对象就地进;此面是历史归档) | - |

**Access / Tickets / Docs / Support 各面低保真:**


```

Access ── pending 顶部高亮 + 授权表 + request action
+---------------------------------------------------------------+
| Pending · 1                                                   |
| ⏳ Ziyu · Deployer · SailPoint req ◻ #4821 · 2d [View↗]        |
| WHO         ROLE       STATUS    SOURCE                       | ← 表格 tabular
| Ziyu        Owner      ● granted SailPoint grp-...            |
| A. Mensah   Deployer   ● granted SailPoint grp-...            |
|                                  [ Request access → ]         | ← 受治理 action
+---------------------------------------------------------------+

Tickets & Changes ── 类型筛选 + 日期引导时间线
+---------------------------------------------------------------+
| Open · 3       [All][Tickets][Changes][Incidents]             |
| ● today   CHG-2891 Deploy hotfix v2.4.1    ↻ in progress      |
| ● 2d      INC-1204 PROD retry spike        ⚠ open             |
| ○ 1w      TCK-8830 Update runtime config   ✓ closed           |
|                                  [ Open ticket → ]            |
+---------------------------------------------------------------+

Documentation ── 编号文档源列表(复用 Document Sources 组件)
+---------------------------------------------------------------+
| 1  Runtime configuration guide                                |
|    doc · conf-4821   Platform · 3d ago · source ↗             | ← type·id mono · owner·freshness·link
| 2  AWSF onboarding runbook                                    |
|    runbook · rb-118  DevEx · 2w ago · source ↗                |
+---------------------------------------------------------------+

Support ── 按问题类型分组的 support route 卡
+---------------------------------------------------------------+
| Deployment / pipeline failures                                |
| → DevEx Platform  #devex-support  escalate: ... [↗]           |
| Access / SailPoint                                            |
| → Identity & Access  #iam-help    escalate: ... [↗]           |
+---------------------------------------------------------------+

```

- **Access**:pending 区顶部高亮(带 source link)+ 授权表(who/role/status dot/source,group id 用 mono); 底部 `Request access` 受治理 action(选 role → 提交 SailPoint,带身份/审计)。
- **Tickets & Changes**:日期引导时间线(近的在上,recency 层级)+ 顶部类型筛选 chip + 每条状态 chip; 底部 `Open pre-filled ticket`(预填 app context 的 ServiceNow ticket)。
- **Documentation**:DESIGN.md §4 的 Document Sources 组件——编号 + 标题 + `type·id` mono + 右对齐 meta(owner · freshness · source link);governed honesty:freshness / broken anchor 如实显示。
- **Support**:按问题类型分组的 support route 卡(问题类型 → 责任团队 + channel + 升级 + Contact),呼应 Atlas.md 的 Support Route 对象。

**四面统一约定**:纵深工作区右侧内容区,同 canvas 宽度;表格 tabular-nums、状态 dot/chip、mono 只给 id/slug、无全宽分割线(DESIGN.md)。就地动作(Request access / Open ticket / Contact)为受治理动作或跳源系统。

### scaffold = 左栏一个独立 tab(详见 §6e)

scaffold 是**可从多处触发的受治理 action**。在 workbench 里它是 **sidebar 上一个独立 tab**("Scaffold"),不塞进 Delivery 顶部。完整设计见 §6e。

### 就地诊断

失败 run / 阻塞的 `Diagnose` → **切到 Delivery 面,右侧就地铺开完整诊断**(和 Onboard §6c 同形态,不用抽屉),统一"从失败对象就地进、诊断总在右侧铺开"的心智。

### 复用现有沉淀

保留现有 `workbench.tsx` 的 **Application 数据模型、诊断数据(`diagnosis-data`)、provenance/证据组件、部署时间线、依赖图、Document Sources**;重组进"一面一内容区"结构,替换掉原来的三种炫技全景布局。

---

## 6e. Scaffold(界面 6)

**定位:** 一个受治理 action 的执行界面——把"给这个 app 加一个新 workload"变成"确认几个决定 → Atlas 生成 IaC + pipeline → 开 PR → 触发 Harness → 首次部署"。灵魂是**反 Backstage 模板**(Atlas.md §三.2):不猜字段、不填一堆表单、提交前看得到会生成什么。

### 两层结构


```

Scaffold(workbench sidebar tab)
├── scaffolder list —— 可用配方目录(MVP 只有 "ECS service" 一项可用 + 其余占位;未来 database/queue/new-env 留位)
└── 选中一个 → scaffolder 页(决定 → 预览 → 生成 → 完成)

```

- **scaffolder 页**是从"我要加个 X"到"它上线了"的完整流程界面。
- **同一个 scaffolder 页,入口/上下文不同**:onboarding 入口(从无到有的 ECS, **全局态**顶栏,app 尚不存在) / workbench 入口(给已有 app 增量加, **app 态**顶栏,未来可从 list 选不同配方)。
- **顶栏跟随入口**——scaffolder 页是嵌入式执行区,不自带顶栏态,继承宿主的壳。

### 整体布局:进 Scaffold 收起 sidebar,内容区分"决定 | 图"

scaffolder 页嵌套在 Shell 里,但它是**专注型任务**——选中 Scaffold tab 后,**workbench 左栏 sidebar 收起(变窄/图标态)**,把横向空间让给内容区的"决定 | 图"双栏(避免"sidebar + 双栏"三层左右过挤)。


```

workbench 入口(app 态):
+-------------------------------------------------------------------------------+
| [logo] Atlas   [ ⌕ Ask about ledger... ]    ❖ ledger-api ▾  ⚙ | ← app 态顶栏  |
+---+---------------------------------------------------------------------------+
|   | Scaffold > ECS service                                                    |
|   | ┌── Decide(主体) ────────┐ ┌── 图(辅助反馈) ──────────────────┐ ← sidebar |
| • | │ name / decisions /     │ │ 改决定 → 图即时反映 · code folded│   收起    |
| • | │ Atlas knows / preflight│ └──────────────────────────────────┘  (图标态) |
| • | └────────────────────────┘                                    内容区全宽双栏
+---+---------------------------------------------------------------------------+

```

- **onboarding 入口**(全局态,app 尚不存在):没有 workbench sidebar;scaffolder 页作为 Onboard golden-path 的 Harness 步、在**右侧当前步内容区**展开(内容区内部仍是"决定 | 图")。

> **通则(sidebar 收放):** 专注型任务(scaffolder 执行、诊断深挖)可**收起 sidebar 争宽度**;浏览型面(Overview/Delivery/Access...)**保留 sidebar** 便于切面。

### 两阶段(跨越"生成"这道不可逆门槛)

点"生成"之前一切可改(配置者);点下去后真实系统被触发(观察者)。任务性质不同,界面必须换。

**① 决定阶段** —— **决定为主体(左),图为辅助反馈(右)**。用户此刻在"做决定",决定是主角,图帮他确认后果。三样同框(反 Backstage 的直接体现):


```

┌── Decide(主体,左侧主导)──┐ ┌── 图(辅助反馈,右)──────────────┐
│ name  [ledger-api]       │ │ 改决定 → 图即时反映            │
│ decisions ( ) ( )        │ │   ecs-svc → task → alb         │
│ (推荐项预选)              │ │      ↓                        │
│ ── Atlas knows ───────── │ │     logs        iam-role       │
│ account awsf-dev  (prov) │ │ ▶ code (folded): main.tf ...   │
│ repo ledger       (prov) │ └────────────────────────────────┘
│ preflight ✓✓⚠            │
│ [ Generate & open PR ]   │
└──────────────────────────┘

```

- **我要定的(主体)**:服务名(预填可改)+ 少数关键选择(推荐预选);workload 类型固定 ECS Fargate(展示不问)。
- **Atlas 已知的**:account / repo / workspace 等 resolved context(展示不问,带 provenance)+ preflight。
- **图(辅助反馈)**:画出会创建的资源拓扑(节点=资源,边=关系),**改一个决定 → 图即时反映**,让因果可见; 代码(main.tf / pipeline.yml)折叠在图内,作为节点可展开的细节。此阶段图**不是主角**,是决定的镜子。

**② 执行阶段**(点生成后)—— **图升为主 view(左)+ run 侧栏(右)**。用户从配置者变观察者,图这时才成为主角(独立视觉,不与 Onboard 路径 spine 刻意统一):


```

┌── 架构图(分阶段渲染)───────┐ ┌── Run ──────────────────────────┐
│ 节点随执行逐个点亮/落地:    │ │ ● commit         ✓             │
│   pending 灰 → provisioning 动│ │   ● connector    ✓             │
│              → created 实   │ │   ○ infra...                   │
│                             │ │   ○ build                      │
│ "看着架构被一块块建起来"    │ │ ○ deploy                       │
│                             │ │ artifacts:                     │
│                             │ │   PR ↗ · plan ↗  ← 逐步出现     │
└─────────────────────────────┘ └────────────────────────────────┘

```

- **架构图为舞台**:同一张图,节点随执行时间线逐个落地(pending→provisioning→created)。
- **侧时间线**:命名步骤(commit → connector → infra → build → deploy),每步状态 + 可折叠日志(出错自动展开);**artifacts 随每步完成逐个出现**(PR / TFE plan / image / 部署 URL,带外链)。
- 失败步就地接**诊断**(§6,C 结论先行版)。

**③ 完成态** —— **功能性 CTA**(非庆祝):全绿时间线 + 架构图全部落地 + 真实 artifact 链接(PR to review / pipeline / 部署 URL)作 CTA + "run again"。与 onboarding 完成态(§6c ③)**各自独立**。

### 阶段转场:图为连贯主体的平滑过渡

点 `Generate` 时,不是硬切两个布局,而是一段演出"用户角色从配置者→观察者"的转场——**图是连贯主体,不重建,跟着注意力从右辅助位移到左主位**:


```

点 [Generate & open PR]
① 决定栏(左)向左滑出淡出        —— 配置者的工具收走
② 同一张图从右辅助位 → 放大 + 平滑滑到左主位(layout 动画,~250-400ms ease-out)—— "图现在是主角"
③ 右侧腾出 → run(时间线 + artifacts)滑入
④ 执行中:图节点逐个落地,右侧步骤/artifacts 同步
⑤ 全部完成 → CTA 条从下方滑入浮现(View PR / pipeline / URL · Run again)

```

- 图**同一实例做 layout 动画**(不 unmount 重建),视觉上"跟着你的注意力走"。
- 决定栏滑出、run 滑入、CTA 下方浮现——三个次要元素围绕连贯的图傲进出。
- 必须提供 `prefers-reduced-motion` 替代(crossfade / 瞬切),DESIGN.md 硬要求。

### 业界对照(2026-08 调研 Backstage / Port / Humanitec / Cortex / OpsLevel / Vercel / Netlify / Amplify)

我们的几个关键决定**命中业界普遍缺失的机会点**,不是拍脑袋:

- **对齐共识**:智能默认 + 少数决定(确认而非填写) · 执行阶段命名步骤时间线 + 每步可折叠日志(出错自动展开) · 完成态功能性 CTA(confetti 是消费级做法,内部门户用功能性)。
- **故意分歧、且踩中空白**:
  - **提交前的代码/plan 预览** —— 全行业最大空白(仅 Humanitec 的 delta 接近);契合 governed honesty。
  - **右侧 context / preflight 治理面板** —— 这些工具都没做;契合 governed-honesty invariant。
  - **artifacts 逐步出现** —— 几乎没人做的、横跨 repo+CI+deploy 的清晰机会点。
- **超出所有被调研产品**: **架构图贯穿两阶段 + 执行时分阶段渲染**——无一产品在决定阶段用图预览、执行阶段分阶段建图(仅 Humanitec 有部署后 Resource Graph、Port 有 DAG run 页)。对零经验 persona (PRODUCT.md primary)价值最高:读不懂 Terraform,但看得懂架构被一块块建起来。

### 复用现有沉淀

保留现有 `scaffold-view` 的**三步流程、resolved context 面板、preflight、代码预览、执行时间线、artifacts 逐步出现**;新增**架构图(复用 workbench 的 `dependency-graph` 视觉语言)**贯穿两阶段;去掉 confetti 改功能性完成态;外层套上 scaffolder list 两层结构。

---

## 7. 界面清单与推进顺序

按依赖顺序,逐个先出低保真描述讨论,确认后再用 prototype 落到新 route path。

| # | 界面 | 作用 | 状态 |
|---|---|---|---|
| 1 | **Shell**(顶栏两态 + app 内 sidebar) | 地基 | ✅ 结构定稿(§2-§3) |
| 2 | **Home = 身份路由 + 分诊台**(仅 N app 有独立内容) | 消除单 app 冗余 | ✅ 骨架定稿(§6b);分诊台内容待加厚 |
| 3 | **Onboard Golden Path**(含 scaffold 执行 + 中途失败就地 Diagnose) | 情况 1 主角 | ✅ 骨架定稿(§6c);保留现有精华 + 补三处 |
| 4 | **App Workbench** 各面(sidebar 11 面 / MVP 核心 6 面) | app 内干活 | ✅ 骨架定稿(§6d);各面展示形式已定 |
| 5 | **Catalog**(收编 Welcome-desk 发现型内容 + 老参考面) | 参考型意图 | ✅ 直接复用现有实现,不改 |
| 6 | **Scaffold**(scaffolder list → scaffolder 页;两阶段 + 架构图贯穿) | 受治理 action 执行界面 | ✅ 定稿(§6e) 业界调研背书 |
| - | **Diagnose**(内容五块 + 两种同源视图) | 跨 1/3/4 复用 | ✅ 定稿(§6);就地=C 结论先行,独立页=A 双栏 |

- **scaffold 归位:** 现有 `proto-app/scaffold`(低摩擦"命名 + 决定 + 代码预览 → 生成 PR + 触发 Harness")是 **Onboard Golden Path 里 "provision" 那一步的执行界面**,归入界面 3,可作为其执行流的参考实现。
- **内容待加厚(不丢):** Home 三情况的骨架已定,但每段的真实内容(处理项种类、聚合维度、建议来源、公告结构)还需继续补充,后续迭代。

**落地约定(prototype 施工决定):**

- **Route path:** `/prototype` 下(不动现有 pilot 与 `/proto-app`)。路由示例:
  - `/prototype`(Home 身份路由) · `/prototype/onboard` · `/prototype/$appId/overview`(及各面) · `/prototype/$appId/scaffold` · `/prototype/$appId/diagnose`。
- **数据:** 复用现有 `proto-app` 虚构数据(Application / diagnosis-data / scaffold-data 模型与 fixture);架构图所需的资源拓扑数据 + 分阶段渲染状态机为新增。
- **视觉系统:** Blueprint(DESIGN.md);全英文 UI 文案。
- **施工顺序(分批,每批跑起来给用户确认再下一批):**
  1. **首批 = Shell** —— 顶栏两态(全局态 / app 态)+ 纵深工作区 sidebar 框架(含收放),内容页先占位。
  2. **之后:** Home 路由 + Workbench Overview → Onboard → Scaffold → 其余面 → Diagnose。
- **复用现有组件:** workbench 数据模型 / diagnosis-data / provenance·证据组件 / 部署时间线 / dependency-graph / Document Sources / scaffold-view 流程。

---

## 8. 决策摘要

| 决策项 | 结论 |
|---|---|
| 锚点 | 身份(Entra ID → SailPoint role),不是 app |
| 身份三情况 | 无 app / 一个 app / 多个 app,驱动 Home 变形 |
| N app 处理 | 先选一个,不做 portfolio 大屏 |
| app switcher | 全局 context,在意图之外(顶栏那层) |
| 布局 | 混合:全局轻顶栏 + app 内 sidebar |
| 顶层意图 | Home · Onboard · Catalog(仅三项) |
| 老导航 | Availability / Newsletter / Support / Sources 收进 Catalog |
| Onboarding | 只属情况 1;空向导手动起步;App Code/repo 是沿途产出 |
| 已有 app 的 Golden Path | production readiness / Vault / migration 等,MVP 不做 |
| Diagnose | 失败对象上的就地动作,带 app+env+run 上下文,不占顶栏 |
| MVP Golden Path | 仅 AWSF onboarding → first DEV deploy |
