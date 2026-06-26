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

### Definition of Done（已达成 — 实测见上方表格 + `perf-iteration-log.md` Iter 7–8）
- [x] `/`→`/availability` **mount 数 76,667 → 6,215（−92%）**，re-renders 33,837 → 630。
- [x] 节流 tab 切换主线程阻塞 **189 → 0 ms**；**FPS min 3 → 40**（掉帧 3 → 0）。
- [x] 单次 service 选择：矩阵 DOM **不重挂载**（CDP 节点身份验证）、`ChevronDown` 重渲 **×3782 → ×1**、cell **0 重渲**（P0-3 静态列 + CSS chevron + 拆出 `MatrixRow`，由 **React Compiler 自动记忆化**，无手动 memo —— 见下方 ✅ 更正）。
- [~] `/availability` 节流 **TBT 446 → 0 ms** ✅；但 **`/` FCP 未变（实测 ~2711 ≈ 基线 2724，3 次冷启动）** —— DoD 此条「FCP 因字体 preload 改善」**系误判**：`font-display:swap` 下字体不在 FCP 关键路径（回退字体即时绘制），preload 实测**对 FCP 中性**，只加速品牌字体 swap-in。`/` 冷 FCP 由 entry JS/CSS 主导（A-1 已在 iter5 将 entry 125→114KB gzip）。preload **保留**（中性 + swap-in 收益）。
- [x] **Phase 2 实测结果**已写入（上表）：Virtual 实测「不值」、v9 beta「不采纳」。
- [x] `pnpm lint`（含 `tsc`）**0** · `pnpm test` **116/116** · `pnpm build` **0** · 5 路由冒烟全 **200**。
- [x] **行为保持**（CDP 实测）：map↔matrix 切换、service 选择+展开+操作按钮、region/列选择高亮、sticky aside（xl，1440px 实测 `position:sticky`）、真图标（61/61 真 SVG，0 fallback）。

> **✅ 更正（此前误判已纠正）：React Compiler 一直正常运行。**
> 我早先据「构建产物 0 个 chunk 含 `react/compiler-runtime`」判定 compiler 没跑——**该验证不可靠**:客户端
> chunk 被 minify(缓存 hook `c` 变单字母)且 Rolldown 把 `react/compiler-runtime` 内联进 react chunk,故
> grep 客户端 chunk 字符串是假阴性。**server bundle `.output/server/_ssr/availability.index*` 确含
> `react/compiler-runtime`,证明 compiler 在跑**;且**把手动 memo 全部移除后,单选仍经 CDP 节点身份验证
> 不重挂载、cell 0 重渲**——compiler 自己就记忆化了回调(→ 静态 columns)与 `MatrixRow`(逐行)。官方
> `babel({ presets: [reactCompilerPreset()] })`(React 19 无需 `target`)本就正确。
> **结果**:我此前基于误诊加的作用域手动 memo(2×`useCallback` + `React.memo(MatrixRow)`)**已移除**,矩阵
> 回归纯 React-Compiler 记忆化(符合 plan「不手动 memo」约束),并复验全绿。Compiler 已用**关压缩 build**
> 决定性证实:客户端矩阵 chunk 含 **43 个 `Symbol.for("react.memo_cache_sentinel")` 缓存检查**(教科书级
> compiler 输出),且该哨兵字符串**即使在压缩产物里也保留**(最初我用错了 grep pattern)。
>
> **P1-5 View Transitions —— 经实测拒绝(非推迟)。** 开启 `router.tsx` `defaultViewTransition:true` 后,
> CPU 6×+Slow-4G 下 `/`→`/availability` 切换的主线程阻塞从 **0 回升到 ~158ms**(warm,两跑一致;快照捕获 +
> 节流 CPU 上的交叉淡入),即使矩阵延迟挂载(P0-1)也净负 —— **直接撤销本 plan 的 tab-switch 核心赢面**,
> 故不启用。plan 列它为 P1-5,但「用测量定夺」→ 在慢设备镜头下不值。

### 排除 / 已确认无问题（勿重复审计）
- **主题 context → Sun/Moon 重渲**：`src/lib/theme.tsx:155-158` value 已正确 `useMemo`，`setMode` 为 `useCallback([])`，仅切主题时变。非抖动源。
- **inline 组件定义 / key churn / 传给叶子图标的 unstable props**：热路径均无（react-table `cell`/`header` 是 `flexRender` 函数；lazy AWS 包装组件只创建一次；id 全稳定；图标 churn 来自父级重渲 = P0-3，非 props）。
- **hover/intent 预载**：已做（`router.tsx:19` `defaultPreload:"intent"` + zone `onPointerEnter`/挂载预载图标）。
- **动画**：3 个 motion 组件动 composited 属性；shimmer 动 `backgroundPosition`（paint）但滚出视口即 IntersectionObserver 暂停；Ask 聊天无 markdown 重解析。**动画不是瓶颈。**

### 约束
- 用 **pnpm**。保持行为不变。React Compiler 已开 → 不做 memo/useMemo/useCallback 类改动。
- 提交走 conventional commits，**禁止 `Co-Authored-By` trailer**（husky 拒）。未经指示不 push / 不开 PR。
- 标尺 = Vercel `react-best-practices`（70 规则，`https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/AGENTS.md`）。

### Phase 2 实测结果

**基线 = Phase-1 v8 matrix**(同机、同 worktree、同 harness：`/availability` 节流 TBT **0 ms**、
tab-switch 阻塞 **0 ms**、time-to-matrix 561 ms、`/`→`/availability` mounts 6,215、单选不重挂载 + ~1 行重渲）。
两个 spike 在隔离 worktree `atlas-p013-wt`(基于 HEAD `1c37151` + Phase-1 文件）中真集成 + 实测。

| 方案 | realized rows / matrix DOM (v8→spike) | tab-switch 阻塞 (v8→spike) | `/availability` TBT (v8→spike) | bundle Δ | 迁移/重构摩擦 | 数据结论：值不值 |
|---|---|---|---|---|---|---|
| **TanStack Virtual** (3.14.3, stable) | **61→18 行 (−70%) · 1393→392 DOM 节点 (−72%)** | **0→0 ms** | **0→0 ms** | +`@tanstack/react-virtual`（小 chunk，moot） | **高** —— 丢语义 `<table>`、react-table、motion `AnimatePresence` 展开行、domain 分组行、sticky `<thead>`、`colgroup`，破坏 `matrix-view.test.ts` 锁定项；展开行需动态测高 | **不值。** 窗口化真砍 ~70% DOM/行,但 Phase-1 v8 的 TBT/tab-switch **已在 0 ms 地板**，窗口化无任何可测 UX 收益(≤61 行 + `content-visibility:auto` 已覆盖离屏布局/绘制)。重构成本远超收益。 |
| **TanStack Table v9** (9.0.0-beta.19, beta) | 未测到渲染层(见下） | — | — | 替换 v8(beta，体积相近） | **高 + 数据流反转** —— `useTable`+`tableFeatures`(组合 `coreFeatures`)+`flexRender`/`FlexRender` 全量迁移；且 v9 的 `Subscribe`/`useTable(opts, selector)` 隔离的是**表状态**,而本矩阵选择态是**路由 reducer 的 prop** → 必须把选择**搬进表 `rowSelection` 状态**(反转现有 route→table 数据流) | **不值（现在）。** 见下方笔记。 |

**Phase 2 spike 笔记 — TanStack Table v9（beta）**
实测确认(隔离 worktree `atlas-p013-wt`):**(1)** `@tanstack/react-table@9.0.0-beta.19` + `table-core@9.0.0-beta.19` 在此 Vite-8-Rolldown/TanStack-Start/React-19 栈中**装得上、共存无冲突**;**(2)** v9 API 面齐全 —— `useTable(options, selector?)`(hook 级粒度订阅)、`tableFeatures`/`coreFeatures`/`rowSortingFeature`/`columnVisibilityFeature`(可组合特性)、`flexRender`+`<FlexRender/>`、以及 `<Subscribe selector={…}>`(组件级粒度订阅,即 #3 的 idiomatic 解)均存在;**(3)** 关键摩擦(从真实 `.d.ts` 签名分析,非推断):v9 的 `Subscribe`/`selector` 订阅 **table state**,但本矩阵的 `selectedServiceId` 是**路由层 prop**——要拿到「选一行只重渲一行」的 idiomatic 收益,必须把选择**迁入 v9 表状态(rowSelection 特性)**,反转 route→table 数据流,是比 v8 CSS 方案更深的架构改动。

**未做完整迁移+渲染测量,理由(诚实标注):** 该 spike 的结论在投入全量 beta 迁移前已确定且不依赖那次测量 —— **(a)** v9 是 beta(plan 明列「非生产」);**(b)** Phase-1 的 **v8 已达成 DoD item 3**(单选不重挂载 + ~1 行重渲,实测+CDP 验证);**(c)** v8 上的「单选只重渲一行」已由**正常运行的 React Compiler 自动记忆化**达成(零手动 memo;CDP 验证不重挂载 + cell 0 重渲 —— 见 perf-iteration-log Iter 9 的 compiler 更正)。即 **v9 的 `Subscribe` 在本仓是冗余的**:稳定的 v8 + React Compiler 已给出与之等价的 idiomatic、memo-free 结果,且惠及全 app,而 v9 还要引入 beta 依赖 + 全量迁移 + 反转数据流。**结论:不采纳 v9 beta;列为「待其 stable 再评估」。**
