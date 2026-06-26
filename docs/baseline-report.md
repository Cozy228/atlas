# baseline 与 local-dev 变更对比报告

## 成功条件与验证方式

验证命令：

```powershell
Set-Location -Path 'C:\Users\e631495\AWSF\atlas'
git --no-pager diff --name-status baseline...local-dev
git --no-pager diff --stat baseline...local-dev
git --no-pager diff --dirstat=files,0 baseline...local-dev

```

## 总览

`local-dev` 相对 `baseline` 主要完成了 8 类变化：

1. **工作区和依赖升级**：移除 `infra` workspace，升级 pnpm、Vite、Vitest、React、TanStack、AI SDK、Hono、AWS SDK 等依赖。
2. **基础设施计划代码移除**：删除原 TypeScript 生成 Terraform 的 `infra` 包和相关测试。
3. **DNS/浏览器访问文档深化**：补充 Route 53 Profile、Infoblox、Inbound Endpoint 的解析链路和根因。
4. **Portal 设计系统刷新**：引入 Geist/Geist Mono、自托管字体、圆角、间距、标题和特效规范调整。
5. **Portal 导航、首页和页面结构重塑**：新增 footer、skip-to-content、导航激活指示器、首页卡片/旅程网格/资源视图升级。
6. **Ask Atlas 与搜索体验统一**：搜索输入、Ask Atlas FAB、聊天、AI message/citation/source/prompt 组件完成图标导入优化，并统一搜索框视觉。
7. **图标与 bundle 性能优化**：Tabler 改为单图标 ESM 导入，AWS/Azure 服务图标改为按需动态加载，Vite 增加依赖预优化和 warmup。
8. **UI 基础组件和业务组件视觉细节精修**：卡片 hover、边框、阴影、状态 chip、证据 badge、guidance/detail/explore 组件统一视觉语言。

---

## ## 1. 工作区、依赖与包管理升级

### ### 功能变化

仓库从包含 `infra` workspace 的多包结构，变为以 portal、context-layer、schema、acceptance、azure-icons 为核心的工作区；同时整体依赖进行了升级。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| `package.json` | `packageManager` 从 `pnpm@11.1.3` 升级到 `pnpm@11.5.0`；根级 `vite`、`vitest` 升级到 `8.0.16`、`4.1.8`。 |
| `pnpm-workspace.yaml` | 删除 `"infra"` workspace 条目，表示基础设施包不再由当前 monorepo 管理。 |
| `pnpm-lock.yaml` | 重新锁版本。 |

---

## ## 2. 基础设施计划模块移除

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| `infra/package.json` | 删除整个 `infra` 目录及相关 TypeScript 代码。 |
| `infra/src/atlasInfraPlan.ts` | 删除 `local`、`test`、`production-like` 环境配置、DynamoDB/Lambda/API Gateway 等 tf 字符串的逻辑。 |
| `infra/src/atlasInfraPlan.test.ts` | 删除基础设施计划测试，包括预测资源列表、特定服务、secret 引用、observability metrics 等。 |
| `pnpm-workspace.yaml` | 配合删除 infra workspace，使根 workspace 不再安装或测试该包。 |

---

## ## 3. Context discovery 测试覆盖调整

### ### 功能变化

`context-layer` 中 discovery routes 的单元测试被删除。被删测试原本验证 source discovery 和 topic discovery 能通过路由正常清除。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `context-layer/src/api/discoveryRoutes.test.ts` | 删除两个 Vitest 用例：`terraform-module` source discovery 和 topic discovery response schema 的解析验证。 |

---

## ## 4. ECS 浏览器访问与 DNS 根因文档深化

### ### 功能变化

访问指南从“CloudMap-managed PHZ 可解析、手动 PHZ 不可解析且根因未知”扩展为更明确的 Route 53 Profile 根因说明。文档现在解密了 CloudMap PHZ 通过平台自动化注册到共享 Profile，而手工 PHZ 未注册导致外部解析超时。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `docs/ecs-browser-access-guide.md` | 增加 Federated Landing Zone DNS 参考链接；将企业 DNS 描述改为 Infoblox；新增“Root Cause - Route 53 Profile”章节、解析链路图、组件职责表、Profile association 解释、CloudMap 与手工 PHZ 差异、验证命令和发现步骤更新。 |

---

## ## 5. Portal 设计系统刷新

### ### 功能变化

Portal 的设计方向从 “Control Room” 调整为 “Precision Instrument”。核心视觉语言从系统字体迁移到自托管 Geist 字体，强调更现代、技术化、精密的界面感；卡片圆角、标题行高、字距、hover shadow、动画和 reduced-motion 行为也被重新规范。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `PORTAL/DESIGN.md` | 将字体体系统改为 Geist/Geist Mono；display line-height 从 1.1 收紧到 1.05，tracking 从 `-0.03em` 到 `-0.04em`；`rounded.xl` 从 10px 到 12px；北极星叙事从 “The Control Room” 改为 “The Precision Instrument”；新增自托管字体、hover shadow、200ms transition、Fade-in-up 动画、reduced-motion 等设计原则。 |
| `portal/public/fonts/GeistVF.woff2` | 新增自托管 Geist variable font，供 UI 主字体使用。 |
| `portal/public/fonts/GeistMonoVF.woff2` | 新增自托管 Geist Mono variable font，供结构化标签、代码风格文本和元数据使用。 |
| `portal/src/styles/globals.css` | 新增 Geist/Geist Mono `@font-face`；`--font-sans`、`--font-mono` fallback；新增 smooth scroll，并在 `prefers-reduced-motion: reduce` 下关闭 smooth scroll；文件注释更新为 Geist Edition。 |
| `portal/src/components/page-section.tsx` | 页面 header 的 border 变轻；eyebrow 字号/字距精确化；h1 更粗、更紧凑；body gap 从 `gap-7/gap-12` 调整为 `gap-8/gap-14`，匹配新版设计节奏。 |
| `portal/src/components/section-eyebrow.tsx` | `eyebrow` 从必须属性变为可选；字号和字距精确化；section title 从设计 token 类改为更明确的 `text-xl` 组合。 |
| `portal/src/components/theme-toggle.tsx` | 保持功能不变，图标导入改为单图标 ESM 单图导入，配合整体 bundle 优化。 |

---

## ## 6. Portal shell、导航、页脚与无障碍

### ### 功能变化

Portal 应用外壳增加全局 footer 与主内容锚点；顶部导航从激活背景色改为底部细条指示器；文档常规新增 skip-to-content 链接，提升键盘用户和屏幕阅读器体验。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `portal/src/components/portal-shell.tsx` | 引入 `PortalFooter`；`main` 增加 `id="main-content"`；酒吧背景透明度、blur、saturate、间距、边框透明度调整；导航常规精简更细腻，激活状态从背景 tint 改为底部 2px primary indicator；Tabler 图标改为 ESM 单图导入。 |
| `portal/src/components/portal-footer.tsx` | 新增全局 footer，显示当前年份版权和 Terms of use / Privacy policy 法律链接；移动端两列布局、桌面端横向布局；包含 hover 和 focus-visible 样式。 |
| `portal/src/routes/__root.tsx` | 在 document body 中新增 `Skip to content` 链接，默认仅屏幕阅读器可见，键盘聚焦时显示，并指向 `#main-content`。 |

---

## ## 7. 首页体验重塑

### ### 功能变化

首页从更平铺的信息密度，转向更精细的卡片和网格体验：Hero 变得更紧凑且有入场动画；developer journey 从 flex 流式布局改为响应式 grid；入口卡片、更新列表和资源链接都采用了统一 hover shadow、12px 圆角和更精确的字号。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `portal/src/routes/index.tsx` | Hero 增加 `animate-fade-in-up` 并尊重 reduced motion；标题更粗、行高更紧、字距更强；描述文案从 “Platform services, tools, and teams” 简化为 “Services, tools, and teams”；部分 section 移除 eyebrow，仅保留 title，做新 `SectionEyebrow` 的可选 eyebrow 支持。 |
| `portal/src/components/home/entry-cards.tsx` | 入口卡片使用更紧凑 padding，放统一的 200ms transition、hover shadow、active scale、简化 selected border；“Launch” 类图标从 rocket 替换为 layers/intersect 风格；图标导入改为单图 ESM 路径，并用 `ComponentType` 定义本地 icon 类型。 |
| `portal/src/components/home/journey-grid.tsx` | Developer journey 从 flex 布局改为 `grid`；移动端 1 列，sm 2 列，lg 4 列；使用 `gap-px` 和 `bg-border` 构造分割线；移除 ghost ordinal、`index/isFirst/isLast` props，步骤模型变为独立卡片。 |
| `portal/src/components/home/platform-updates.tsx` | 更新列表外层去掉卡片背景，把背景下放到每行；行 padding、tag 颜色、字号、日期、描述文本对齐方式调整，使列表更像精密信息表。 |
| `portal/src/components/home/resource-link-grid.tsx` | 资源链接卡片增加 hover shadow、统一 `rounded-xl`、边框容器从外边框变更为 muted 背景，hover 时转为 brand tint；标题/描述字号精确化；Tabler 图标改为 ESM 单图引导入。 |

---

## ## 8. Ask Atlas、搜索框与 AI 元素

### ### 功能变化

Ask Atlas 的可见业务逻辑基本保持不变，主要变化集中在两处：一是所有相关图标改为精确 ESM 导入；二是 intent/catalog 搜索框视觉统一为更圆润、带 hover shadow、200ms transition 的新设计语言。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `portal/src/components/ask-atlas-fab.tsx` | Ask Atlas FAB 的 message/search 图标改为单图路径 ESM 导入；FAB 行为未见业务逻辑变化。 |
| `portal/src/components/ask-atlas-chat.tsx` | 聊天界面的发送、文档、错误图标改为 ESM 单图导入；消息提示和 mutation 行为未见业务变化。 |
| `portal/src/components/ask-atlas-search.tsx` | 搜索面板中的 home、catalog、map、database、search 图标改为 ESM 单图导入；导航/搜索交互逻辑保持。 |
| `portal/src/components/ai-elements/conversation.tsx` | conversation 的 scroll/download 图标改为 ESM 单图导入。 |
| `portal/src/components/ai-elements/inline-citation.tsx` | citation 前后导航图标改为 ESM 单图导入。 |
| `portal/src/components/ai-elements/message.tsx` | message 分页/导航图标改为 ESM 单图导入。 |
| `portal/src/components/ai-elements/prompt-input.tsx` | prompt input 中发送、停止、图片、桌面、添加、关闭等图标改为 ESM 单图导入。 |
| `portal/src/components/ai-elements/sources.tsx` | source 展开/书籍图标改为 ESM 单图导入。 |
| `portal/src/components/intent-search.tsx` | 搜索输入框 `rounded-lg` 改为 `rounded-xl`，最大宽度从 600px 缩到 560px；hover 阴影明显；快速提建议背景改为 muted，字号改为 11px；图标改为 ESM 单图导入。 |
| `portal/src/components/catalog-search-field.tsx` | Catalog 搜索框采用与 intent search 一致的 `rounded-xl`、`border-border`、`px-4`、200ms transition、hover shadow 和 14px 文本；图标改为 ESM 单图导入。 |

---

## ## 9. Catalog、availability、explore、detail 与 guidance 组件精修

### ### 功能变化

这些页面和组件的主要变化是统一新视觉语言与图标导入策略：服务卡片、availability matrix、detail action、guidance step 等组件在视觉上更圆润、hover 更轻，状态展示更直观。路由层面大多只是原图导入优化。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `portal/src/routes/catalog.index.tsx` | Catalog route 的箭头图标修改为 ESM 单图导入。 |
| `portal/src/routes/availability.index.tsx` | Availability route 的 table/layout 图标修改为 ESM 单图导入。 |
| `portal/src/routes/guidance.index.tsx` | Guidance route 的前头、grid/list 图标修改为 ESM 单图导入。 |
| `portal/src/components/explore/matrix-view.tsx` | Matrix view 的外链和 chevron 图标改为 ESM 单图导入，配合服务图标按需加载。 |
| `portal/src/components/explore/expand-panel.tsx` | Expand panel 的外链/关闭图标改为 ESM 单图导入。 |
| `portal/src/components/explore/service-card.tsx` | 服务卡片从 `rounded-lg` 到 `rounded-xl`；hover shadow 更细；selected border 从强 primary 降为 `primary/40`；标签背景从 background 改为 muted；标题字号精确化。 |
| `portal/src/components/explore/service-icon.tsx` | 服务图标从同步组件映射改为异步 loader；新增模块 resolved cache 和 in-flight promise cache，按 provider 和 serviceId 选择 AWS/Azure loader，加载失败时继续使用 fallback icon。 |
| `portal/src/components/explore/status-chip.tsx` | 'not-planned' 状态背景从 card 改为 muted，视觉上更像次级状态。 |
| `portal/src/components/detail/availability-strip.tsx` | 外链图标修改为 ESM 单图导入。 |
| `portal/src/components/detail/detail-shell.tsx` | 返回箭头图标修改为 ESM 单图导入。 |
| `portal/src/components/detail/entry-tools-grid.tsx` | 外链/link 图标修改为 ESM 单图导入。 |
| `portal/src/components/detail/evidence-section.tsx` | chevron 图标修改为 ESM 单图导入。 |
| `portal/src/components/detail/tool-action-button.tsx` | 工具动作按钮的外链/link 图标修改为 ESM 单图导入。 |
| `portal/src/components/guidance/guidance-step-content.tsx` | step 内容中的前进、后退、外链图标修改为 ESM 单图导入。 |
| `portal/src/components/guidance/guidance-step-item.tsx` | step item 的 check 图标修改为 ESM 单图导入。 |
| `portal/src/components/guidance/guidance-task-list.tsx` | task list 的 check 图标修改为 ESM 单图导入。 |

---

## ## 10. Evidence、guardrails、sources 与 skills 页面图标/视觉一致性

### ### 功能变化

证据、警告、guardrail、source、skills 等页面主要完成图标导入策略统一，减少 bundle 对 Tabler 稀导导入的依赖；证据相关视觉状态保持原语义，但图标来源更精确。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `portal/src/components/evidence/badges.tsx` | check、clock、lock、route、shield、star 等 evidence badge 图标改为 ESM 单图导入。 |
| `portal/src/components/evidence/evidence-panel.tsx` | 外链/users 图标修改为 ESM 单图导入。 |
| `portal/src/components/evidence/feedback-inline-form.tsx` | feedback/report 图标修改为 ESM 单图导入。 |
| `portal/src/components/evidence/warning-stack.tsx` | alert、ban、help、lock、shield 等 warning 图标改为 ESM 单图导入。 |
| `portal/src/routes/guardrails.$guardrailId.tsx` | guardrail detail 的 check/shield/x 图标改为 ESM 单图导入。 |
| `portal/src/routes/sources.$sourceId.tsx` | source detail 的外链图标修改为 ESM 单图导入。 |
| `portal/src/routes/skills.index.tsx` | skills 页面 copy/download/external-link/terminal 图标改为 ESM 单图导入。 |

---

## ## 11. AWS/Azure 服务图标按需加载

### ### 功能变化

服务图标系统从“启动时静态导入所有图标组件”改为“为每个 service id 对应一个动态 import loader”。这会降低初始模块四，同时通过 `ServiceIcon` 的缓存避免重复请求同一个图标。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `portal/src/lib/aws-icon-map.tsx` | 删除 60+ 个 AWS icon 静态 import；新增 `IconLoader` 类型：`AWS_ICON_MAP` 的值从组件引用改为动态 `() => import(...)` loader；注明明确是避免大量 SVG 模块拉入启动树。 |
| `portal/src/lib/azure-icon-map.tsx` | 删除 Azure icon 静态 import；新增 `IconLoader` 类型；`AZURE_ICON_MAP` 的值从组件引用改为动态 import loader。避免 39 个 Azure SVG 模块进入启动树。 |
| `portal/src/components/explore/service-icon.tsx` | 消费新的 AWS/Azure lazy loader；新增 `iconCache` 和 `promiseCache`；provider 明确时只查对应云，未明确时 AWS/Azure fallback；加载期间和失败时继续显示 provider fallback 图标。 |
| `portal/src/lib/aws-icon-map.test.tsx` | 测试从 "map 值是函数" 调整为异步验证 loader 能 resolve 到 default component，适配懒加载模型。 |

---

## ## 12. Vite 开发体验与 bundle 预优化

### ### 功能变化

Portal 的 Vite 配置增加了 `.mjs` resolve 支持、依赖预优化 include/exclude、开发服务器 warmup，重点是支持单图标 `.mjs` 导入和避免某些包根线入口在浏览器其时打包时碰壁 server-only 模块。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `portal/vite.config.ts` | `resolve.extensions` 增加 `.mjs`；`optimizeDeps.include` 固定 React、TanStack、clsx、tailwind-merge、CVA、zod 等常用依赖；`optimizeDeps.exclude` 排除 `@atlas/azure-icons` 和 `@tanstack/react-start`，避免预打包包括引入 server-only 上下文；新增 server warmup，预热 root route、index route、portal shell、route tree 和 utils。 |

---

## ## 13. UI primitives 图标导入统一

### ### 功能变化

shadcn/Base UI 风格基础组件没有明显 API 或交互重写，主要把 Tabler 稀导导入换成单图标 ESM 导入，配合整体 tree-shaking 策略。

### ### 相关文件

| 文件 | 变更说明 |
| --- | --- |
| 文件 | 变更说明 |
| --- | --- |
| `portal/src/components/ui/accordion.tsx` | chevron down/up 图标改为 ESM 单图导入。 |
| `portal/src/components/ui/carousel.tsx` | arrow left/right 图标改为 ESM 单图导入。 |
| `portal/src/components/ui/command.tsx` | search 图标改为 ESM 单图导入。 |
| `portal/src/components/ui/dialog.tsx` | close 图标改为 ESM 单图导入。 |
| `portal/src/components/ui/dropdown-menu.tsx` | chevron/check 图标改为 ESM 单图导入。 |
| `portal/src/components/ui/select.tsx` | selector、check、chevron up/down 图标改为 ESM 单图导入。 |
| `portal/src/components/ui/sheet.tsx` | close 图标改为 ESM 单图导入。 |
| `portal/src/components/ui/banner.tsx` | toast 状态图标改为 ESM 单图导入。 |
| `portal/src/components/ui/spinner.tsx` | loader 图标改为 ESM 单图导入。 |

---

## ## 风险与建议验证点

| 风险点 | 原因 | 建议验证 |
| --- | --- | --- |
| `@hono/node-server` 1.x 到 2.x | 主版本升级可能影响 `context-layer` server 行为。 | 运行 `context-layer` 单元测试和本地 API smoke test。 |
| `infra` workspace 删除 | 当前 diff 未体现替代 IaC 实现。 | 确认 `infra` 已迁移外部仓库或平台流水线。 |
| discovery route 测试删除 | 测试覆盖减少，运行时代码是否仍有覆盖需确认。 | 搜索其它 `discovery` 测试或补充 API/E2E 覆盖。 |
| 自托管字体 | 新增约 140KB woff2 原始资源。 | 检查 network waterfall、缓存头、FCP。 |
| 动态图标加载 | 首次显示服务图标时异步加载。 | 验证 availability/explore 页面图标 fallback、加载后替换和错误路径。 |
| Vite `optimizeDeps` exclude | 避免 server-only 模块进入浏览器，但可能影响 dev prebundle。 | 运行 `portal` dev server 与 production build。 |

---

## ## 完整变更文件覆盖清单

以下 75 个文件均已在上文按功能分组说明：

```text
context-layer/package.json
context-layer/src/api/discoveryRoutes.test.ts
docs/ecs-browser-access-guide.md
infra/package.json
infra/src/atlasInfraPlan.test.ts
infra/src/atlasInfraPlan.ts
infra/tsconfig.json
package.json
packages/atlas-acceptance/package.json
packages/atlas-schema/package.json
packages/azure-icons/package.json
pnpm-lock.yaml
pnpm-workspace.yaml
portal/DESIGN.md
portal/package.json
portal/public/fonts/GeistMonoVF.woff2
portal/public/fonts/GeistVF.woff2
portal/src/components/ai-elements/conversation.tsx
portal/src/components/ai-elements/inline-citation.tsx
portal/src/components/ai-elements/message.tsx
portal/src/components/ai-elements/prompt-input.tsx
portal/src/components/ai-elements/sources.tsx
portal/src/components/ask-atlas-chat.tsx
portal/src/components/ask-atlas-fab.tsx
portal/src/components/ask-atlas-search.tsx
portal/src/components/catalog-search-field.tsx
portal/src/components/detail/availability-strip.tsx
portal/src/components/detail/detail-shell.tsx
portal/src/components/detail/entry-tools-grid.tsx
portal/src/components/detail/evidence-section.tsx
portal/src/components/detail/tool-action-button.tsx
portal/src/components/evidence/badges.tsx
portal/src/components/evidence/evidence-panel.tsx
portal/src/components/evidence/feedback-inline-form.tsx
portal/src/components/evidence/warning-stack.tsx
portal/src/components/explore/expand-panel.tsx
portal/src/components/explore/matrix-view.tsx
portal/src/components/explore/service-card.tsx
portal/src/components/explore/service-icon.tsx
portal/src/components/explore/status-chip.tsx
portal/src/components/guidance/guidance-step-content.tsx
portal/src/components/guidance/guidance-step-item.tsx
portal/src/components/guidance/guidance-task-list.tsx
portal/src/components/home/entry-cards.tsx
portal/src/components/home/journey-grid.tsx
portal/src/components/home/platform-updates.tsx
portal/src/components/home/resource-link-grid.tsx
portal/src/components/intent-search.tsx
portal/src/components/page-section.tsx
portal/src/components/portal-footer.tsx
portal/src/components/portal-shell.tsx
portal/src/components/section-eyebrow.tsx
portal/src/components/theme-toggle.tsx
portal/src/components/ui/accordion.tsx
portal/src/components/ui/carousel.tsx
portal/src/components/ui/command.tsx
portal/src/components/ui/dialog.tsx
portal/src/components/ui/dropdown-menu.tsx
portal/src/components/ui/select.tsx
portal/src/components/ui/sheet.tsx
portal/src/components/ui/banner.tsx
portal/src/components/ui/spinner.tsx
portal/src/lib/aws-icon-map.test.tsx
portal/src/lib/aws-icon-map.tsx
portal/src/lib/azure-icon-map.tsx
portal/src/routes/__root.tsx
portal/src/routes/availability.index.tsx
portal/src/routes/catalog.index.tsx
portal/src/routes/guidance.index.tsx
portal/src/routes/guardrails.$guardrailId.tsx
portal/src/routes/index.tsx
portal/src/routes/skills.index.tsx
portal/src/routes/sources.$sourceId.tsx
portal/src/styles/globals.css
portal/vite.config.ts

```

```

```