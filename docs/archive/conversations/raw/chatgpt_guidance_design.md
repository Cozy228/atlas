你的判断是对的：**不要上 React Flow / Mermaid / XState / BPMN**。
它们解决的是“画流程图 / 执行状态机 / 建模业务流程”，而你要的是：

> 一个轻量的、地图式的、可以引导用户完成平台任务的 Guidance Journey。

所以 Atlas Guidance 应该自己实现一个 **map renderer**，底层用 YAML/JSON，前端用 SVG + HTML nodes + 轻动画就够了。

---

# 1. `milestone` 可以去掉，直接用 `step + task`

我之前用 `milestone` 是想表达“地图上的节点”，但你说得对，放在 schema 里有点重。

更好的命名：

```text
Guidance
  -> steps
      -> tasks
```

够了。

## 为什么不用 milestone

`milestone` 容易让人理解成：

* 项目里程碑
* 长周期阶段
* 大型 roadmap
* 重流程管理

但你的 Guidance 更像：

> 用户当前要走的一条指引路线。

所以叫 `step` 更自然。

---

# 2. `step` 和 `task` 的边界

我建议这样定：

## Step

地图上的一个节点。

它回答：

> 用户现在到哪一步了？

例如：

```text
Choose Landing Zone
Request Access
Open TFE Workspace
Connect Harness Pipeline
Production Readiness
```

---

## Task

当前 step 内部要做的一件小事。

它回答：

> 用户在这个节点里要完成什么动作？

例如：

```text
Step: Request Access

Tasks:
- Open access request form
- Fill application name
- Select target landing zone
- Submit request
```

---

# 3. Guidance type 不是三种存储模型，而是三种“展示/行为预设”

你说得也对：理论上所有 Guidance 都可以是：

```text
几个 step + 每个 step 下面几个 task
```

所以不应该拆成三套模型。

正确做法是：

```yaml
type: route | decision | checklist | troubleshooting
```

但它们共用一个 schema。

type 的作用只是告诉 renderer：

* 怎么排版
* 怎么展示 step
* 默认怎么完成
* 是否突出分支
* 是否突出 checklist
* 是否突出诊断路径

---

# 4. 为什么还需要 type

不是为了存储，而是为了 **渲染和体验**。

同一个 `steps + tasks` 模型，不同场景的 UI 重心不一样。

## `route`

适合 onboarding、request、setup。

重点是：

* 当前走到哪
* 下一站是哪
* 进度如何
* 完成后地图往前推进

展示上像：

```text
Start -> Step 1 -> Step 2 -> Step 3 -> Destination
```

---

## `decision`

适合 landing zone 选择、region 选择、路径选择。

重点是：

* 当前要做选择
* 选 A 去哪里
* 选 B 去哪里
* 不同选择对应不同下一步

展示上仍然是地图，但节点会有分叉。

---

## `checklist`

适合 readiness、review、validation。

重点不是“路线”，而是：

* 当前 step 下面的 task 是否都完成
* 完成后才能进入下一步

比如 production readiness：

```text
Step: Production readiness

Tasks:
- Logging enabled
- Tags applied
- IAM reviewed
- KMS configured
```

---

## `troubleshooting`

适合故障排查。

重点是：

* 当前症状是什么
* 先检查什么
* 如果不是这个原因，下一步查什么
* 最后 escalate 到哪里

它本质上也是 decision map，只是 UI 文案和布局更像诊断树。

---

# 5. 所以最优模型是：统一 schema + type 影响 renderer

不要做：

```text
RouteGuidance
DecisionGuidance
ChecklistGuidance
TroubleshootingGuidance
```

做这个就重了。

应该做：

```yaml
guidance:
  type: route
  steps:
    - ...
```

不同 type 只是 renderer preset。

---

# 6. 推荐的最小 Guidance schema

我会把它压到这个程度：

```yaml
id: new-app-onboarding
title: New App Onboarding
type: route
scenario: onboarding

objective: Help an application team onboard a new cloud workload.

destination:
  title: Application ready for standard cloud deployment
  description: The app has the required access, deployment path, and readiness checks.

owner:
  team: Cloud Platform
  support: cloud-platform-support

status: published
version: 1.0.0

appliesTo:
  landingZones:
    - central-lz
  regions:
    - ap-southeast-1
  environments:
    - dev
    - test
    - prod

steps:
  - id: choose-landing-zone
    title: Choose landing zone
    kind: decision
    description: Select the right landing zone for this workload.
    tasks:
      - id: review-options
        title: Review landing zone options
        action:
          type: atlas_page
          target: /landing-zones
      - id: confirm-choice
        title: Confirm selected landing zone
        completion: user_confirm
    next:
      default: request-access

  - id: request-access
    title: Request access
    kind: action
    description: Submit an access request for the selected landing zone.
    tasks:
      - id: open-request-form
        title: Open access request form
        action:
          type: external_link
          ref: access-request-form
    completion: user_confirm
    next:
      default: open-tfe

  - id: open-tfe
    title: Open Terraform Enterprise
    kind: action
    description: Use the approved TFE workspace or module.
    tasks:
      - id: open-tfe-workspace
        title: Open TFE workspace
        action:
          type: external_link
          ref: tfe-standard-workspace
    sources:
      - tfe-onboarding-guide
    completion: user_confirm
    next:
      default: connect-harness

  - id: connect-harness
    title: Connect Harness pipeline
    kind: action
    description: Connect the standard deployment path.
    tasks:
      - id: open-harness
        title: Open Harness setup guide
        action:
          type: external_link
          ref: harness-standard-guide
    completion: user_confirm
    next:
      default: production-readiness

  - id: production-readiness
    title: Production readiness
    kind: checklist
    description: Complete required checks before production use.
    tasks:
      - id: logging
        title: Logging enabled
      - id: tags
        title: Required tags applied
      - id: iam
        title: IAM role pattern reviewed
      - id: support-owner
        title: Support owner confirmed
    completion: all_tasks_checked
    next:
      default: done

  - id: done
    title: Onboarding complete
    kind: destination
    description: The application is ready for standard cloud deployment.

sources:
  - cloud-onboarding-guide
  - landing-zone-overview
  - tfe-onboarding-guide
  - harness-standard-guide
```

这个已经够表达：

* scenario
* objective
* destination
* steps
* tasks
* source
* next
* completion
* status
* owner
* applicability

---

# 7. `type` 和 `kind` 的区别

这里建议保留两个字段。

## `type`

Guidance 整体类型。

```yaml
type: route
```

影响整个页面的布局。

---

## `kind`

单个 step 的类型。

```yaml
kind: action
kind: decision
kind: checklist
kind: destination
```

影响单个节点怎么显示。

这样会比拆成三种 Guidance 模型更自然。

---

# 8. 关于你说的 Option A / Option B

我现在建议你在数据模型上选 **Option A**，在渲染上逐步靠近 **Option B**。

## Option A：Ordered Steps Model

也就是：

```yaml
steps:
  - id: a
    next:
      default: b
  - id: b
    next:
      default: c
```

优点：

* 简单
* Git diff 清楚
* AI 容易生成
* 人容易手写
* schema validation 简单
* UI renderer 好做

缺点：

* 不适合特别复杂的多分支流程
* 不适合复杂并行路径

但这正好符合 V1。

---

## Option B：Graph Model

也就是：

```yaml
nodes:
  - id: a
  - id: b

edges:
  - from: a
    to: b
```

优点：

* 更通用
* 更接近 React Flow / BPMN / graph renderer
* 适合复杂流程

缺点：

* 写起来更抽象
* 对人不友好
* Git review 不如 steps 直观
* 很容易滑向“流程图工具”

---

## 我的建议

V1 用 Option A：

```text
steps + next
```

内部编译成 graph：

```text
steps -> renderGraph
```

也就是：

```text
Authoring model: steps
Runtime model: graph
Rendering model: map
```

这个组合最稳。

---

# 9. UI 不要像流程图，要像 route map

你说的“不是游戏化，但是像地图一样指引你到下一步”，这个方向很准确。

我建议 UI 参考这些方向，而不是流程图工具。

---

## 方向 A：Route Map

核心视觉：

* 一条柔和曲线路径
* step 是路径上的节点
* 当前 step 高亮
* 已完成路径点亮
* 下一步路径预览
* viewport 自动移动到当前 step

视觉感受：

```text
像地图路线，不像流程图
```

---

## 方向 B：Quest Path，但不要游戏化

可以借一点“任务路线”的体验：

* 当前节点 pulse
* 完成后 check
* 连接线流光
* 下一个节点轻微解锁
* 右侧/底部出现当前任务卡

但不要：

* XP
* ranking
* badge wall
* 夸张奖励
* 游戏文案

---

## 方向 C：Modern Timeline Map

比传统 vertical timeline 更自由一点：

* 节点不一定直线排列
* 可以轻微左右错位
* 有 curved path
* 每个节点像地图 pin / station
* 当前 step 有 floating card

---

# 10. 轻量自研 renderer 怎么做

不需要 React Flow。

推荐：

```text
SVG path + absolutely positioned step nodes + Framer Motion / CSS transition
```

SVG 很适合这个，因为它是 Web 标准的二维矢量图，可以和 CSS / DOM / JavaScript 配合，并且能在不同尺寸下清晰缩放。MDN 对 SVG 的说明也强调它是用于二维矢量图的 XML 标记语言，可搜索、可脚本化、可压缩，并且能和 CSS、DOM、JavaScript 协作。([MDN Web Docs][1])

---

# 11. Renderer 的最小结构

```text
Guidance YAML
  -> parse
  -> validate
  -> normalize
  -> compute layout
  -> render SVG route
  -> render HTML step nodes
  -> animate current state
```

---

## DOM 结构大概这样

```text
<div class="guidance-map">
  <svg class="route-layer">
    <path class="route-base" />
    <path class="route-progress" />
    <path class="route-glow" />
  </svg>

  <div class="step-node completed" />
  <div class="step-node active" />
  <div class="step-node locked" />

  <div class="current-step-card" />
</div>
```

---

# 12. 路径动画怎么做

有两种简单方式。

## 方式 1：SVG stroke-dashoffset

用 SVG path 的描边动画：

```text
灰色 base path
彩色 progress path
通过 stroke-dasharray / stroke-dashoffset 控制进度
```

这个最稳。

适合：

* edge 逐渐点亮
* 完成 step 后路径往前流动
* 当前 step 到下一 step 的过渡

---

## 方式 2：CSS offset-path

CSS `offset-path` 可以让元素沿着路径运动，MDN 说明它可以指定元素跟随的路径，并配合 `offset-distance`、`offset-rotate` 等控制元素沿路径的位置和方向；这个能力从 2022 年 3 月起已是 Baseline widely available。([MDN Web Docs][2])

适合：

* 一个小光点沿路径移动
* 用户完成 step 后，小 marker 平滑移动到下一个节点

但我建议 V1 主要用 SVG stroke 动画，`offset-path` 作为增强。

---

# 13. 可参考的开源/组件方向

不建议直接套，但可以借视觉语言。

## Magic UI / Animated Beam

Magic UI 是 React + TypeScript + Tailwind + Motion 的开源动画组件集合，它的 Animated Beam 组件就是“光束沿路径移动”的视觉效果，适合参考“路径上有能量流动”的感觉。([Magic UI][3])

你可以借它的思路：

* SVG path
* gradient stroke
* moving beam
* soft glow
* connection line

但不要把整个 Guidance 做成 integration diagram。

---

## React Bits / Stepper

React Bits 是一个开源 animated React components 集合，它有 Stepper 组件方向，可参考“step 切换、过渡、动效”的交互思路。([React Bits][4])

但它更偏组件，不是 map renderer。

---

## Product Tour 类库

Driver.js、Shepherd.js、React Joyride 这些解决的是“在已有 UI 上做引导浮层”，不是你这个“地图式 Guidance”。2026 年一些产品 tour library 对比也主要围绕 Shepherd.js、Driver.js、Intro.js、React Joyride、Reactour 等 in-app walkthrough 工具。([Userorbit][5])

可以借：

* step progress
* next / back
* spotlight
* contextual help

但不要直接用它们做主界面。

---

## Journey Map UX

NN/g 对 journey map 的定义是“把一个人为了完成目标所经历的过程可视化”，并且常见结构包括 actor、scenario + expectation、journey phases、actions / mindsets / emotions、opportunities。([Nielsen Norman Group][6])

这对你的 Guidance 很有参考价值：

* 一条 Guidance 应该有明确 scenario
* 应该有目标 / destination
* 应该按阶段或步骤组织
* 应该围绕用户行动，而不是系统结构

但你不需要照搬 journey map 的完整研究格式。

---

# 14. 我建议的地图布局

不要让 author 在 YAML 里写坐标。

由 renderer 自动 layout。

## V1 支持 3 个 layout

```yaml
layout: vertical-route
layout: horizontal-route
layout: curved-map
```

---

## `vertical-route`

最稳，适合 enterprise。

```text
Start
  |
Step 1
  |
Step 2
  |
Step 3
  |
Destination
```

但视觉上可以做得不传统：

* 曲线连接
* 节点左右错位
* 当前节点放大
* 任务卡浮在旁边

---

## `horizontal-route`

适合短流程。

```text
Start -> Step 1 -> Step 2 -> Destination
```

适合：

* 3~5 步
* 首页卡片
* capability page 内嵌 guidance

---

## `curved-map`

最接近你想要的。

```text
      Step 2
     /
Start
     \
      Step 1 -> Step 3 -> Destination
```

但 V1 里不要让它任意复杂。

可以限制：

* 最多 8 个 step
* 最多 2 层分支
* 分支必须回到主路径或到 destination
* 不支持任意网状图

---

# 15. UI 体验建议

## 页面整体

```text
---------------------------------------------------
Guidance: New App Onboarding
Goal: Application ready for standard cloud deployment
---------------------------------------------------

[Map Area]

    Step 1 ✅
       ╲
        Step 2  ← active
           ╲
            Step 3
               ╲
              Destination

[Current Step Panel]
- Why this step matters
- Tasks
- Open link
- Mark complete
- Sources
- Need help?
---------------------------------------------------
```

---

## 当前 Step Card

每一步最好有一个固定 card：

```text
Current step: Open Terraform Enterprise

What to do:
1. Open the approved TFE workspace
2. Review required variables
3. Confirm workspace owner

Actions:
[Open TFE Workspace] [Open Source] [Mark Complete]

Sources:
- TFE onboarding guide
- Module README
```

---

## 完成动作

用户点击：

```text
Mark Complete
```

然后：

1. 当前 node 变成 check
2. path progress 动画推进
3. 小 marker 移动到下一 node
4. viewport 平滑滚动
5. 下一个 node pulse 一下
6. step card 切换内容

这已经足够有“地图引导感”。

---

# 16. 状态模型也可以很简单

不需要状态机。

```ts
type StepStatus =
  | "locked"
  | "available"
  | "active"
  | "completed"
  | "blocked"
  | "skipped";
```

Guidance progress：

```json
{
  "guidanceId": "new-app-onboarding",
  "currentStepId": "open-tfe",
  "completedStepIds": ["choose-landing-zone", "request-access"],
  "completedTaskIds": ["review-options", "open-request-form"]
}
```

计算逻辑自己写就行。

---

# 17. Completion mode 也要少

我建议 V1 只保留这几个：

```yaml
completion: user_confirm
completion: all_tasks_checked
completion: optional
```

先不要做：

```yaml
external_status
auto
```

这些会把你拉向 workflow automation。

如果以后要从 TFE / Harness / ServiceNow 同步状态，再加：

```yaml
completion: external_status
```

但 V1 先不要。

---

# 18. 最小 renderer 需要支持哪些 node

V1 只要这些：

```yaml
kind:
  - start
  - info
  - action
  - decision
  - checklist
  - support
  - destination
```

但你甚至可以先压成：

```yaml
kind:
  - action
  - decision
  - checklist
  - destination
```

`start` 可以自动生成。

---

# 19. Guidance 的关键不是复杂流程，而是“下一步感”

你这个产品要赢，不是靠流程表达能力强，而是靠：

* 用户一眼知道自己在哪
* 用户知道下一步做什么
* 用户知道点哪里
* 用户知道完成标准是什么
* 用户知道卡住了找谁
* 用户能看到自己在向目标靠近

所以 renderer 的优先级应该是：

```text
清晰 > 动效 > 灵活性 > 流程复杂度
```

不要为了表达所有流程，把 schema 做成通用图系统。

---

# 20. 我建议当前定稿方向

## 数据模型

```text
Guidance
  - id
  - title
  - type
  - scenario
  - objective
  - destination
  - appliesTo
  - steps
    - id
    - title
    - kind
    - description
    - tasks
    - action
    - completion
    - next
    - sources
  - sources
  - owner
  - status
```

---

## 渲染模型

```text
Guidance -> route layout -> SVG path -> step nodes -> active card
```

---

## UI 风格

```text
modern route map
not flowchart
not BPMN
not React Flow
not game UI
```

---

## 技术实现

```text
React
+ SVG
+ CSS transition / Framer Motion
+ YAML/JSON schema
+ Git-based management
```

---

## V1 支持

```text
linear route
simple branch
checklist step
progress recording
source links
external action links
```

---

## V1 不支持

```text
workflow execution
external status sync
complex DAG
parallel branches
drag-and-drop editor
React Flow canvas
BPMN import/export
```

---

我的判断：**你应该自研一个 Guidance Map Renderer**。

不要拿通用 flow editor 改。
你要的是产品化体验，不是流程图能力。

最小闭环是：

```text
YAML Guidance
  -> schema validation
  -> normalized JSON
  -> route map renderer
  -> user progress
  -> Context API
```

这条路线轻、可控、视觉上能做出差异化，也不会把 Atlas 拖进 workflow engine 的坑。

[1]: https://developer.mozilla.org/en-US/docs/Web/SVG "SVG: Scalable Vector Graphics | MDN"
[2]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/offset-path "offset-path CSS property - CSS | MDN"
[3]: https://magicui.design/ "Magic UI"
[4]: https://www.reactbits.dev/components/stepper?utm_source=chatgpt.com "Stepper"
[5]: https://userorbit.com/blog/best-open-source-product-tour-libraries?utm_source=chatgpt.com "Best Open-Source Product Tour Libraries in 2026"
[6]: https://www.nngroup.com/articles/journey-mapping-101/ "Journey Mapping 101 - NN/G"
