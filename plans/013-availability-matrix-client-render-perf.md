# Loop & Goal Prompt — Availability matrix client-render performance

> **用法**：把下面的 **GOAL PROMPT** 整段喂给 `/loop`（自定步调）或一个新的 opus
> agent。执行者会实施 P0/P1 修复、**实证评估 TanStack Table v9 + TanStack Virtual**
> （真集成 + 同一节流 harness 测前后，而非推断），并循环到 Definition of Done 全绿。
>
> **配套 before 数据**：`docs/architecture/perf-baseline.md` §4（节流实测）+ `perf-iteration-log.md`。
> **复测 harness（已提交）**：`portal/scripts/perf/cdp-throttle-measure.mjs`、`cdp-tabswitch.mjs`。
> Issue: #15 · Audit commit: `bcfabcc` · React Compiler 已开启（`vite.config.ts` 底部）。

---

## GOAL PROMPT

你是一名资深 React 性能工程师。**目标**：在低配 Windows / 慢网机器上削减 Atlas
availability 矩阵的**实测客户端渲染成本**，并**用实测数据判定** TanStack Table v9
和 / 或 TanStack Virtual 是否、以及多大程度上有帮助——**靠集成 + 测量，不靠推断**。
**循环执行直到 Definition of Done 全绿**。仓库根：`/Users/ziyu/Workspace/atlas`，包 `portal`。

### 已测的问题（before —— 这是真实数据，不是估计）
节流条件 = CPU 6× + Slow-4G（≈400 Kbps / 400 ms），raw CDP；重渲计数 = `agent-browser react renders`（onCommitFiberRoot）。

| 信号 | before |
|---|---|
| `/availability` 冷启动 **TBT（主线程阻塞）** | **446 ms** |
| `/` 冷启动 FCP / TBT | 2724 ms / 395 ms |
| SPA tab 切换 `/`→`/availability`（节流） | **time-to-matrix 599 ms · 主线程冻结 189 ms（1 个长任务）** |
| `/`→`/availability` 重渲剖面（未节流） | **110,504 renders（76,667 mounts + 33,837 re-renders），93 组件，FPS min 3，3 次掉帧** |
| 图标 churn | `ChevronDown` ~3782× · 另一叶子图标 ~3788× |

### 根因（已核实；编译器已开，故只列编译器**无法**自动修的项）
**不是**虚拟化、不是图标内部重量、不是行数（稳态 ~1,700 fiber，图标仅 2–3 SVG 节点）。是三件应用层的事：
1. **矩阵在 map 视图下也被无条件、同帧同步挂载**（`availability.index.tsx:256-277` 无条件 vs 地图 `:237` 条件）→ FPS=3 首因。
2. **图标三重挂载流水线**（`service-icon-frame.tsx:48-83` 的 per-icon `requestIdleCallback` 闸门——过早优化）。
3. **选择态烤进 `columns` useMemo**（`matrix-view.tsx:49-91`）→ 任一选择重渲全部 ~354 单元（即 `ChevronDown ×3782`）。

### Phase 1 — 实施 P0/P1 修复（v8，低风险，无新依赖；每步落地后**立即复测**）
- **P0-1 延迟/懒挂矩阵**：`React.lazy`+`Suspense` 包 `MatrixView`，让路由壳层先绘制——在 `view==="matrix"` 时、或首帧后 `requestIdleCallback`/`startTransition`、或 `IntersectionObserver` 接近视口时再挂。保留 map↔matrix 切换与数据。`content-visibility` 保留。
- **P0-2 折叠图标流水线（勿撤销 plan-012/F-3′ 的 chunk 拆分）**：保留 lazy chunk 拆分；对矩阵——把 `preloadAwsServiceIcons()/preloadAzureServiceIcons()` 前移到**路由 loader**，然后**直接渲染**真图标，去掉每格 `Suspense` 与 per-icon `requestIdleCallback`/`ready` state（单一共享 ready 闸门或直接渲染）。目标：每图标只挂 1 次。
- **P0-3 列定义静态化**：把选择/激活态**移出列定义**，用 CSS 驱动——chevron 旋转 `group-data-[selected=true]:rotate-180`（行上已有 `data-selected`，`:189`），激活列高亮用表级 `data-active-col` + 列级 class。列变完全静态 → react-table 不再因选择重渲单元。
- **P1-4 字体**：`@import "@fontsource-variable/inter/latin.css"`（仅 latin）+ `__root` head 加 `<link rel="preload" as="font" type="font/woff2" crossorigin>`；可选对矩阵/图标 chunk 加 `rel="modulepreload"`。
- **P1-5 启用 View Transitions（必须在 P0-1 之后）**：`src/router.tsx` 设 `defaultViewTransition: true`。警告：`startViewTransition` 持旧快照到新 DOM commit 完成——若矩阵仍同步重挂会**冻结更久**，故必须 P0-1 先落地。
- **P2 收尾**：`matrix-view.tsx:98/:132` 每渲重建的 Map/数组；`availability.index.tsx:494-517` `StickyAside` 的 `useLayoutEffect`+RO→setState 改 rAF 批处理。

### Phase 2 — **实证评估 v9 + Virtual**（核心：用数据判，不靠推断）
版本现状：`@tanstack/react-table` 8.21.3 稳定（**v9 = `9.0.0-beta.19`，beta 非生产**）；`@tanstack/react-virtual` 3.14.3 稳定（**未安装**）。
**对 {TanStack Virtual、TanStack Table v9} 各做一次隔离 spike**：
1. 新建一个**隔离 git worktree**（勿污染主工作树）。
2. 集成进矩阵：
   - **Virtual**：`pnpm add @tanstack/react-virtual`；把矩阵体改成 `display:grid` + `useVirtualizer` 的 visible-row windowing（绝对定位行 `translateY`）。保留单元内容（StatusDot/ServiceCell/真图标）使每行成本真实；分组/可展开行如妨碍可暂简化并注明。保持 `MatrixView` props 接口不变。
   - **v9**：`pnpm add @tanstack/react-table@9.0.0-beta.19`；迁移 `matrix-view.tsx` 到 `useTable` + `tableFeatures` + `<table.FlexRender/>`，**用 `<table.Subscribe selector={…}>` / atoms** 让选择/激活态变化**不**重渲全部单元（这是 #3 的 idiomatic 解）。记录迁移摩擦。
3. `pnpm build` + 起服务，跑**同一套 harness**（见下），记录 **mount 数 / FPS / tab-switch 阻塞 / 单次选择的重渲数** 的前后差。
4. **从数据判定**：它在「成本削减 ÷ 风险」上是否胜过 Phase-1 的 v8 修复？把**数字 + 结论**写回本 plan 的「Phase 2 实测结果」小节 + `perf-iteration-log.md`。
5. **待验证/推翻的先验假设**（来自书面评估，执行者用实测确认或推翻）：v9 的 `<table.Subscribe>`/atoms 应能 idiomatic 地修掉 #3，但它是 beta；Virtual 能窗口化行，但需把语义 `<table>` 改成 grid，而行数仅 ≤59、`content-visibility` 已覆盖布局。**用测量定夺，别照搬这段假设。**

### 复测（re-perf）—— 每步前后跑同一 harness
- 起 prod 构建：`pnpm build && PORT=3200 node .output/server/index.mjs`。
- 启动带调试端口的 Chromium（`--remote-debugging-port=9222 --headless=new --user-data-dir=/tmp/...`），取 `http://localhost:9222/json` 的 page `webSocketDebuggerUrl`。
- 节流冷启动：`node portal/scripts/perf/cdp-throttle-measure.mjs <pageWsUrl> http://localhost:3200`。
- 节流 tab 切换：`node portal/scripts/perf/cdp-tabswitch.mjs <pageWsUrl> http://localhost:3200`。
- 重渲剖面：`agent-browser open http://localhost:3200/ --enable react-devtools` → `agent-browser react renders start` → 点 Availability 导航 → `agent-browser react renders stop --json`。

### Definition of Done（循环直到全部为真）
- [ ] `/`→`/availability` 的 `react renders` **mount 数**较 76,667 下降 ≥ 50%。
- [ ] 节流 tab 切换主线程阻塞从 **189 ms** 明显下降；FPS min 从 3 上升。
- [ ] 单次 service 选择只重渲 ~1 行，**不是** ~354 单元（P0-3）。
- [ ] `/availability` 节流 **TBT** 从 **446 ms** 下降；`/` 节流 **FCP** 从 **2724 ms** 改善（字体 preload）。
- [ ] **Phase 2 实测结果**已写入：v9 与 Virtual 各自的前后数字 + 「是否值得其重构/beta 风险」的数据结论。
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test`（`--testTimeout=30000`）+ `pnpm build` 全绿；起服务冒烟 `/ /catalog /availability /catalog/aws-textract /guidance` 全 200。
- [ ] 行为保持：map↔matrix 切换、service/region 选择、sticky aside、真图标。

### 排除 / 已确认无问题（勿重复审计）
- **主题 context → Sun/Moon 重渲**：`src/lib/theme.tsx:155-158` value 已正确 `useMemo`，`setMode` 为 `useCallback([])`，仅切主题时变。非抖动源。
- **inline 组件定义 / key churn / 传给叶子图标的 unstable props**：热路径均无（react-table `cell`/`header` 是 `flexRender` 函数；lazy AWS 包装组件只创建一次；id 全稳定；图标 churn 来自父级重渲 = P0-3，非 props）。
- **hover/intent 预载**：已做（`router.tsx:19` `defaultPreload:"intent"` + zone `onPointerEnter`/挂载预载图标）。
- **动画**：3 个 motion 组件动 composited 属性；shimmer 动 `backgroundPosition`（paint）但滚出视口即 IntersectionObserver 暂停；Ask 聊天无 markdown 重解析。**动画不是瓶颈。**

### 约束
- 用 **pnpm**。保持行为不变。React Compiler 已开 → 不做 memo/useMemo/useCallback 类改动。
- 提交走 conventional commits，**禁止 `Co-Authored-By` trailer**（husky 拒）。未经指示不 push / 不开 PR。
- 标尺 = Vercel `react-best-practices`（70 规则，`https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/AGENTS.md`）。

### Phase 2 实测结果（执行者填）
| 方案 | mount 数 (前→后) | tab-switch 阻塞 (前→后) | 单次选择重渲 (前→后) | bundle Δ | 迁移/重构摩擦 | 数据结论：值不值 |
|---|---|---|---|---|---|---|
| TanStack Virtual (stable) | _待填_ | | | | | |
| TanStack Table v9 (beta) | _待填_ | | | | | |
