# Regional Availability Map Design

## Summary

This spec defines a new Atlas surface for showing AWS federated service and capability availability across STT regions and outposts.

The page should not be a direct table transplant from source documentation. It should become a portal-native **availability decision surface** that helps users:

1. find the service they care about quickly
2. understand whether it is available in the relevant region or outpost
3. know what to do if it is not available
4. continue to the right service catalog, user guide, onboarding path, or support route

The chosen direction is a **Map-Grid Hybrid**.

## Product Role

This surface extends Atlas as a **collection of maps**.

It is not a dashboard and not a spreadsheet-like registry tool. It is a map for capability availability, showing where a service is usable, where it is planned, and what path a user should take next.

## Goals

1. Make regional and outpost availability easy to scan without requiring users to read a dense matrix.
2. Help users locate relevant services quickly, even when they do not arrive with a strict service-versus-region lookup workflow.
3. Make availability status actionable by showing fallback paths, ETA, and next-step links.
4. Keep the page aligned with Atlas portal UX rather than Confluence-table UX.

## Non-Goals

1. Do not recreate the raw markdown table in portal form.
2. Do not optimize for operations monitoring or dashboard behavior.
3. Do not force users into a pure "pick region first" or "pick service first" flow.
4. Do not rely on emoji-only status language.

## Primary User Job

The primary job is:

**"Help me quickly find the service I want to use, understand its availability status, and know what to do next if it is unavailable or partially available."**

## Chosen Direction

The selected concept is **Map-Grid Hybrid**:

- discovery and browsing use a service-card grid
- availability is expressed through a persistent status-map layer
- detailed availability opens in a focused service panel

This combines the scanability and visual recognition of cards with the clarity of a structured availability map.

## Information Architecture

The page has three major layers.

### 1. Search and Filters Header

This is the query and orientation layer.

It includes:

- service search
- filters for status
- filters for region or outpost
- filters for catalog domain
- filters for landing zone level when relevant

This layer should feel lightweight and utility-focused, not like an advanced reporting tool.

### 2. Structured Service Grid

This is the browse layer.

Results are shown as a grid of service cards. The grid should not become a generic card wall. Each card must be information-led and status-led.

Each card includes:

- AWS service icon
- service name
- catalog domain label
- compact availability summary
- clear affordance to open the detailed availability view

### 3. Focused Service Panel

This is the decision layer.

When a user selects a service, the page opens a focused panel or in-place expanded view showing:

- region and outpost status details
- ETA for planned availability
- interim notes when applicable
- recommended fallback or alternative path when unavailable
- links to service catalog, user guide, onboarding path, owner, or support route

## Card Anatomy

Each service card has four parts.

### Header

- AWS service icon
- service name
- catalog domain

### Status Summary Strip

This is a compact strip of the most important availability signals, for example:

- US-East-1 Available
- Canada Central Available
- GDC Planned

If the summary cannot show every location cleanly, it should use a `+N more` pattern rather than collapsing into unreadable density.

### Orientation Copy

A short line explains the broad status, for example:

- Available in primary federated regions
- Outposts in rollout
- Planned for selected environments

### Action

A clear action such as:

- View availability map

## Status Model

Status language should be explicit and consistent.

Use:

- Available
- Interim
- Planned
- Not planned

Do not depend on raw emoji or symbols as the primary language. Icons and color can support the meaning, but text labels must carry it.

## Interaction Model

The page uses a three-step interaction rhythm:

1. browse relevant services quickly
2. inspect status summary on the card
3. open the focused service panel for full availability decision-making

The page should not ask users to consume all regional detail at once.

## Fallback and Next-Step UX

Availability is only useful if it supports action.

The focused service panel must answer:

1. **Can I use it?**
2. **If not now, then what?**
3. **Where do I go next?**

For unavailable or planned states, the page should show one or more of:

- target availability date
- interim capability notes
- recommended fallback service or path
- different landing zone suggestion
- support path

For available states, the page should expose:

- service catalog link
- user guide or documentation link
- onboarding path when relevant

## Why This Should Not Be a Table

The source documentation table is acceptable as reference material, but it is too dense and too documentation-native for Atlas.

A portal-native version must prioritize:

- scanability
- service recognition
- decision support
- next-step routing

before it prioritizes showing every cell at once.

## Visual Direction

- Restrained product styling
- Light theme
- AWS icons for fast recognition
- Status chips and rails as map legend language
- Quiet, structured card grid rather than a decorative card wall

The page should feel like a map and explorer, not a dashboard and not a spreadsheet.

## Content Requirements

Each service should support these content elements where available:

- service name
- domain or category
- availability by region or outpost
- ETA for planned states
- interim notes
- fallback or next-step guidance
- service catalog link
- user guide link
- onboarding path link
- owner or support route

## Acceptance Criteria

The design is successful when:

1. users can find a relevant service quickly without reading a large matrix
2. service availability is understandable at a glance
3. unavailable states always provide a next step
4. available states always provide a path to documentation or user guidance
5. the page feels native to Atlas and not like transplanted documentation
6. the page communicates availability as a navigable map, not as a reporting table

## Craft Handoff

This section records the page contract and implementation inventory needed before later `impeccable craft`.

### Craft Gate Notes

- **Shape status:** confirmed
- **Visual probe status:** skipped, because the current harness lacks native image generation
- **North-star decision:** preserve the approved map-grid hybrid direction without introducing a literal map visual or reverting to a matrix-first table

### What Must Carry Into Code

The later implementation must preserve these visible ingredients:

1. a utility-first search and filters header at the top
2. a structured service-card grid using AWS service icons for recognition
3. a compact status summary strip on each card
4. a focused service panel for selected-service decision-making
5. explicit fallback and next-step actions for non-available states
6. text-first status language: Available, Interim, Planned, Not planned

### What Must Not Be Literalized

The later implementation must avoid these regressions:

1. pasting the source markdown table into the page
2. turning the page into a spreadsheet-like matrix as the default view
3. relying on emoji as the primary status language
4. building a decorative card wall with weak status visibility
5. making the focused panel a passive detail area without next-step guidance

## Page Contract

### Route and Placement Contract

- **Suggested page name:** Regional Availability Map
- **Suggested nav label:** Availability
- **Suggested portal placement:** a secondary discovery surface reachable from Capability Pathways, Quick Links, and relevant Capability Detail pages
- **Suggested deep-link pattern:** the page should support preselected query or service context when entered from other Atlas surfaces

### Page-Level Responsibilities

The page is responsible for:

1. helping users locate a relevant service or capability
2. showing a clear cross-region or cross-outpost availability summary
3. letting users inspect one selected service in more detail
4. routing users to service catalog, user guide, onboarding, or support

The page is not responsible for:

1. rendering long-form documentation
2. replacing Capability Detail
3. acting as a system health dashboard
4. exposing the full source table by default

### Top-Level Composition Contract

The page should be composed in this order:

1. **Page header**
   - title
   - short orientation copy
   - optional legend entry point
2. **Search and filters header**
   - service search
   - status filters
   - region or outpost filters
   - domain filters
   - landing-zone-level filters when relevant
3. **Results summary row**
   - result count
   - active filters
   - clear filters action
4. **Structured service grid**
   - service cards with compact summaries
5. **Focused service panel**
   - selected-service detail and actions
6. **Empty, stale, or fallback messaging**
   - visible only when needed

## Component Contract

### AvailabilityPageHeader

- **Purpose:** orient the user to the page's job
- **Must include:** page title, one-sentence explanation, optional legend affordance
- **Must not include:** dense filter logic or primary data content

### AvailabilitySearchFilters

- **Purpose:** help users narrow to relevant services quickly
- **Must include:** search, filter controls, reset path
- **Must not include:** complex reporting-style control density

### AvailabilityResultsSummary

- **Purpose:** confirm what the current result set represents
- **Must include:** result count, active filter chips, clear-filters action
- **Must not include:** secondary analytics or chart summaries

### AvailabilityServiceGrid

- **Purpose:** provide scan-friendly browsing across services
- **Must include:** predictable responsive grid behavior and consistent card boundaries
- **Must not include:** mixed card sizes or decorative filler cards

### AvailabilityServiceCard

- **Purpose:** make one service easy to recognize and triage
- **Must include:** AWS icon, service name, domain label, status summary strip, orientation copy, open-detail action
- **Must not include:** full region table or long-form notes

### AvailabilityStatusSummaryStrip

- **Purpose:** expose the most important status signals at card level
- **Must include:** a short set of status chips and an overflow pattern such as `+N more`
- **Must not include:** all regions or all outposts when density becomes unreadable

### AvailabilityFocusedPanel

- **Purpose:** help users make a decision about one selected service
- **Must include:** full status breakdown, ETA, interim notes, fallback guidance, next-step links
- **Must not include:** passive metadata without action paths

### AvailabilityLegend

- **Purpose:** explain status language clearly and consistently
- **Must include:** status names and meaning
- **Must not include:** emoji-only legend language

### AvailabilityNoResultsState

- **Purpose:** recover from empty result sets
- **Must include:** acknowledgement, likely reason, one or more next-step actions
- **Must not include:** dead-end copy such as "No results"

## Data Contract

The implementation should assume a service-centric data shape.

### Service Availability Record

Each service record should support:

- `serviceId`
- `serviceName`
- `serviceIconKey`
- `domainLabel`
- `summaryLine`
- `ownerLabel`
- `serviceCatalogUrl`
- `userGuideUrl`
- `onboardingUrl`
- `supportUrl`
- `locations`

### Location Availability Record

Each location entry should support:

- `locationId`
- `locationLabel`
- `locationType` (`region` or `outpost`)
- `status` (`available`, `interim`, `planned`, `not-planned`)
- `etaLabel`
- `interimNote`
- `fallbackGuidance`
- `landingZoneLevels`
- `isPrimary`

### Derived Display Data

The interface should derive:

1. card-level summary chips from the most important location entries
2. broad orientation copy from the location mix
3. selected-service detail rows for the focused panel
4. result count and active filter text for the summary row

## State Contract

The implementation should explicitly cover these states:

### Default

The page shows search, filters, a populated service grid, and either no selected service or a sensible default selected service.

### Filtered Results

The page shows a narrowed service set and clearly reflects active filters.

### No Results

The page explains that no services matched the current criteria and offers a reset or broader path.

### Loading

The page uses skeletons for cards and panel content rather than a generic blocking spinner.

### Stale or Partial Data

The page shows that some availability data may be dated or incomplete without making the whole page unusable.

### Selected Service With Mixed Statuses

The focused panel makes mixed availability legible without flattening important differences.

### Planned or Unavailable

The focused panel must show ETA, fallback, or support path, not just the unavailable label.

## Responsive Contract

### Mobile Narrow

- filters may collapse into progressive disclosure


1. 信息架构与检索体验优化 (UX/Search)
当前设计盲区： 用户如果需要横向对比两个相似服务（例如 ECS Fargate vs ECS EC2）在不同区域的状态，当前的 "Focused Service Panel"（单选聚焦模式）会让他们不得不在两个卡片之间来回点击。

💡 优化建议：加入“对比篮子 (Comparison Tray)”
允许用户在卡片上勾选 2-3 个服务，底部浮现一个 "Compare" 栏。点击后，进入一个专门的对比视图，此时可以临时借用表格或并排卡片的布局，精准对比这几个选定服务的可用性。

💡 优化建议：语义化/同义词搜索
很多时候用户搜索的词不是标准的 AWS 官方命名（比如搜 "K8s" 而不是 "EKS"，搜 "Serverless DB" 而不是 "Aurora Serverless"）。Search 引擎需要支持 Tag 或同义词映射。

2. 视觉与认知负荷优化 (UI/Visual)
当前设计盲区： 虽然用卡片代替了表格，但如果服务（Card）达到 50-100 个，这依然是一堵“卡片墙”。文档提到了 +N more 模式，但这只是卡片内部的折叠。

💡 优化建议：按域 (Domain) 分组的粘性标题
将卡片流按 Compute, Storage, AI Services 等进行段落分组（Sectioning）。在页面滚动时，当前的类别标题具有吸顶效果（Sticky Header），这会极大地增强“浏览感”。

💡 优化建议：状态色彩心理学与色弱友好 (a11y)
文档强调了 text-first status language（好评），但在视觉扫视时，颜色依然是第一梯队的信号。

Available -> 柔和的绿色系

Interim -> 警告黄/橙色系

Planned -> 科技蓝/紫色系（暗示未来）

Not planned -> 灰色系
确保这些颜色在 Light Theme 下不仅对比度足够，且要引入图标辅助（如 ✅, ⏳, 🚫），以满足 WCAG 可访问性标准。

3. 交互细节与反馈流 (Interaction)
当前设计盲区： 针对处于 Planned (计划中) 状态的服务，用户看完 ETA (预计到达时间) 之后，除了等待，还能做什么？

💡 优化建议：增加 "Notify Me" (上线提醒) 动线
在 Focused Service Panel 中，对于 Planned 状态的服务，提供一个类似小铃铛的 "Subscribe for updates" 按钮。当该服务在所选 Region 上线时，可以通过邮件、Slack 或内部系统推送通知用户。这能形成良好的业务闭环。

4. 架构与数据设计补充 (Data Contract)
当前设计盲区： 没有提到数据的时效性感知。由于可用性是动态变化的，用户可能会怀疑他们看到的是不是最新的状态。

💡 优化建议：数据来源与最后更新时间
在页面 Header 或者 Footer 区域，或者在 Focused Panel 的底部，明确标注 Last synced: 2 hours ago。

数据结构扩展 (Data Contract 层面):
在 Location Availability Record 中，可以增加一个 readinessScore (准备就绪度百分比) 或 dependencies 字段，以帮助前端在某些场景下做更复杂的渲染策略。