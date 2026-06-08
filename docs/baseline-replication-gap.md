# 新 Baseline 执行清单（已定稿范围）

> 目标：把当前个人树对齐到公司侧实现，建立新 baseline。

## 前提修正（重要）

报告里的 `baseline` **不是** `80fe220`：

- 报告全程未提 `capabilities` / `landing-zones`，却把 `catalog` / `availability` / `guidance` / `guardrails` / `skills` 当作已存在文件改图标。
- `80fe220` 有 capabilities/landing-zones/explore，**没有** catalog/guidance/skills/guardrails。

结论：**公司 baseline 比 `80fe220` 更靠后**，已完成 capabilities→catalog、explore→availability、加 guidance 的重构，并已有 **skills 页面 + guardrail 详情页**。当前个人树是从 `80fe220` 平行演进，做了类似重构，但 **skills / guardrail 详情页从未存在**（`git log --all` 为空）。

报告是 delta，无法描述这两个页面的实现，也无法枚举公司完整功能集。按仓库 public-safe 规则不凭记忆重建公司代码 → 这两页走**通用版（待 spec）**。

## 范围决策

| 项 | 决定 |
| --- | --- |
| 字体（Geist）、设计系统 | ❌ 按当前 Inter，不动 |
| 卡片细节、journey-grid、首页 hero、skip-link、导航指示条 | ❌ 不做 |
| footer | ✅ 加 |
| 搜索框视觉统一 | ✅ 做 |
| 图标 ESM 单图导入（44 文件）+ vite `.mjs` | ✅ 做 |
| AWS/Azure 图标懒加载 | ✅ 做（先评估当前 azure 方案）|
| skills 页面 + guardrail 详情页 | ✅ 通用版，**待 spec** |

---

## 任务清单

### 1. Footer ✅ 已完成
- [x] 新建 `portal/src/components/portal-footer.tsx`：当前年份版权 + Terms/Privacy（占位链接）；移动纵向 / 桌面横向；hover + focus-visible
- [x] `portal/src/components/portal-shell.tsx`：挂载 `<PortalFooter />`（仅 footer，不动导航激活态、不加 main 锚点）

### 2. 搜索框视觉统一 ✅ 已完成（按当前设计系统，不上 rounded-xl）
- [x] `catalog-search-field.tsx`：补 `hover:border-border-strong`，与 intent-search 对齐 hover 反馈
- [x] `intent-search.tsx`：`max-w-[600px]` → `max-w-150`（写法统一，像素不变）
- 其余样式本就一致（`h-11 / rounded-lg / border-input / bg-card / shadow-xs`），保持当前
- 待定：Ask Atlas 弹层内的搜索 input 是否也纳入统一

### 3. availability tab 卡顿优化 ✅ 已完成（替代报告的"逐图标懒加载"）
> 报告的逐图标动态 import 会变成几十个小请求（差网络逆优化），已弃用，改为：
- [x] `service-icon-frame.tsx`：`useDeferredIconMount` —— 首帧渲染字母占位，`requestIdleCallback` 空闲再升级真 SVG（一处覆盖 AWS+Azure，保持单 chunk 不增请求）
- [x] `matrix-view.tsx` 行 + `service-card.tsx` 卡：`[content-visibility:auto]` 跳过屏幕外绘制
- 验证点（公司 Windows laptop）：每 tab 首点卡顿、字母→图标闪烁、表格行高/滚动条

### 4. 图标 ESM 单图导入 ❌ 已评估，不做
当前是 Vite 8 + Rolldown，vite.config 已有 `tabler-icons` 等手动分组，生产已 tree-shake + 合并。重写 44 文件生产收益≈0；dev 冷启动如需可加一行 `optimizeDeps.include`。

### 5. AWS/Azure 图标懒加载 ❌ 已评估，不做
当前 aws/azure 各自独立 chunk + 路由分割，不在首屏包。逐图标懒加载在差网络下是负收益。卡顿已由任务 3 解决。

### 6. skills 页面 + guardrail 详情页 ✅ 已完成（通用版）
- [x] `/skills`（`lib/skills.ts` + `routes/skills.index.tsx`）：本地静态数据、卡片网格、安装弹窗（安装/列表命令块 + 复制 toast + 两个外链）、加入顶部导航
- [x] `/guardrails/$guardrailId`（`routes/guardrails.$guardrailId.tsx` + `lib/guardrail-rules.ts`）：复用 detail-shell/EntryToolsGrid/EvidenceSection/RelatedColumn/FeedbackInlineForm + 新增 Rules 区（severity + enforcement status）；guardrail 走服务端 topic 数据，Rule 用通用本地 mock + TODO
- [x] catalog guardrails tab 的卡片/表格行改链到 `/guardrails/$id`；返回链接回到 `?tab=guardrails`
- 偏差：Rule 为本地 mock（无 schema/API）；RelatedColumn 等共享组件仍链到 `/catalog/$topicId`（未改共享组件，避免波及其它类型）
- [ ] `/skills`（`routes/skills.index.tsx`）：报告图标暗示有**安装命令 / CLI 片段 UI**（copy / download / terminal）。需 spec：页面布局、skill 数据字段、安装命令展示形式
- [ ] `/guardrails/$id`（`routes/guardrails.$guardrailId.tsx`）：guardrail 详情（check / shield / x）。schema 已有 `guardrail-area` 概念。需 spec：详情页内容结构
- [ ] 路由注册进 `routeTree.gen.ts`（生成），导航入口

---

## 明确跳过
infra、依赖升级、lockfile、tsconfig、纯文档、删测试、字体、设计系统、卡片细节、journey-grid、首页 hero、skip-link、导航指示条。
