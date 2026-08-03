# Atlas Nitro/Start → Hono 迁移最终报告

**分支：** `feat/nitro-removal-migration`

**报告日期：** 2026-08-03

**状态：** 最终路线已实现并通过本地、浏览器和 Linux/amd64 容器验证；真实 AWS Valkey/Confluence staging 验证仍是上线门槛。

## 1. 一句话结论

**建议采用这次迁移作为最终路线：单 ECS task、单 Hono Node 进程、TanStack Router SPA、首屏静态 HTML shell、进程内 Context Layer、iovalkey Cluster + IAM。**

它不是单项性能跑分最高的方案；优化过的 Hybrid SSR 首屏更快。但在 Atlas 当前产品定位不变、没有 SEO 和身份相关 SSR 硬需求的前提下，这一方案在首屏观感、数据可用时间、部署复杂度、故障面和长期维护成本之间最平衡。

最重要的判断是：

- **用户不需要等 12 秒才“整体可用”。** FCP、React 接管、数据 ready 都是从导航开始计时的绝对时间，不能相加。
- 静态 shell 的链接在 HTML 绘制后就能使用；React 交互和 live data 稍后到达。
- 真正受 Confluence 延迟影响的是“数据可决策时间”，不是首屏骨架；这部分应由 revision-aware Valkey cache 解决，而不是用 SSR 掩盖。
- Hybrid SSR 能进一步压低 LCP，但会重新引入双构建、服务端渲染、序列化/水合和更复杂的 dev/runtime 边界；目前收益不足以支付这个永久成本。

## 2. 迁移前后架构

### 迁移前

```text
ALB
  -> ECS / Node
       -> Nitro production runtime
            -> TanStack Start SSR / hydration / server functions
            -> filesystem server routes
            -> Portal UI
            -> Context Layer / source adapters

Separate deployment concern:
  -> Context Layer Lambda build/handler
```

主要特征：

- TanStack Start 和 Nitro 同时参与请求、渲染、构建与产物组织。
- 浏览器初始 HTML 有 SSR 内容，但仍需下载和 hydration 才能完成 React 交互。
- server functions、Start routes、Nitro host 和 Context Layer 边界彼此耦合。
- 同时存在 ECS 与 Lambda 的构建/部署形态。

### 迁移后

```text
ALB
  -> one ECS Fargate task
       -> one Hono Node process
            -> /health, /api, /mcp, discovery, resources
            -> immutable static assets + SPA fallback
                 -> meaningful static HTML shell
                 -> TanStack Router SPA takeover
            -> in-process framework-neutral Context Layer
                 -> source adapters
                 -> iovalkey Cluster cache
                      -> TLS + IAM authentication
                      -> token refresh every 14 minutes
```

### 核心变化对照

| 维度 | 迁移前 | 迁移后 | 影响 |
| --- | --- | --- | --- |
| HTTP host | Nitro | Hono Node | 单一、显式的 HTTP 边界 |
| 前端框架 | TanStack Start | TanStack Router SPA | 删除 SSR/server function 运行时 |
| 首屏 | 请求时 SSR HTML | 构建时固定 meaningful shell | 不等 live source，也不需要服务端 React |
| 动态数据 | SSR/Start data path | 显式 Hono JSON contracts | 调试和缓存边界更清楚 |
| Context Layer | 与 host/runtime 有交叉 | 进程内、framework-neutral | 可测试、可复用，不再需要 Lambda |
| Server routes | filesystem/Start routes | `portal/server/hono/**` | 路由、静态资源和 shutdown 逻辑集中 |
| 缓存 | 缺少完整生产闭环 | iovalkey Cluster + IAM + revision keys | 直接改善 live source tail latency |
| 部署 | Start/Nitro + ECS，并保留 Lambda 形态 | 一个 ECS task / 一个 Node 进程 | 更少构建和运行边界 |
| 产物 | Start/Nitro server + client artifact | Atlas-owned `.output` | Docker/CI 合同仍保留，但内容更小 |

## 3. 用户可感知性能

### 3.1 先定义“可用”

本报告区分三个时间点：

1. **HTML/FCP：** 用户看到品牌、说明、主导航；静态链接已可跳转。
2. **React shell ready：** React 已接管，selector、Popover 和客户端导航可用。
3. **Data ready：** announcements、availability、Confluence 等 live data 已完成，可进行数据驱动决策。

因此不能把 `FCP + interaction-ready` 相加。比如 FCP 6.5 秒、data ready 8.1 秒，表示从开始到最终数据可用约 8.1 秒，而不是 14.6 秒。

### 3.2 同一 Profile C 下的直接对照

条件：600/250 Kbit/s、350 ms RTT、8x CPU slowdown、冷浏览器；下表各时间均从 navigation start 起算。

| 冷首页 | TTFB | FCP/LCP | Load | React shell | Data ready | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Nitro/Start 冻结基线 | 824 ms | 2,716 ms | 6,401 ms | 未单独埋点 | 未单独埋点 | 59 ms |
| 初始 Hono SPA | 1,156 ms | 6,768 ms | 5,131 ms | 未单独埋点 | 未单独埋点 | 7 ms |
| 优化后 SPA，source 0 ms | 1,113 ms | 6,496 ms | 5,194 ms | 6,214 ms | 6,236 ms | 0 ms |
| 优化后 SPA，source 500 ms，冷 cache | 1,129 ms | 6,584 ms | 5,284 ms | 6,305 ms | 8,097 ms | 0 ms |
| 优化后 SPA，source 500 ms，暖 cache | 1,115 ms | 6,600 ms | 5,165 ms | 6,233 ms | 6,262 ms | 5 ms |

结论：

- 从纯 SSR 切到最初的纯 CSR，LCP 的确回退约 4 秒；这是真实代价，不能包装成性能持平。
- JS 主线程阻塞明显下降：TBT 从 59 ms 降到 0–5 ms。
- 500 ms source delay 对 LCP 只增加 88 ms，但冷 cache 下 Data ready 增加 1,861 ms。慢的是数据 fan-out/tail，不是 paint。
- cache 预热后 Data ready 从 8,097 ms 恢复到 6,262 ms，收回约 98.6% 的冷数据惩罚。

### 3.3 最终静态 shell 的效果

最终产物在 SPA document 中加入稳定、非个性化的首屏 HTML。五次本地 CDP 冷上下文近似测试得到：

| 指标 | 中位数 |
| --- | ---: |
| FCP/LCP | 1,928 ms |
| Load | 2,738 ms |
| React shell ready | 3,414 ms |
| Data ready | 3,424 ms |

这组 localhost 测量绕过了 Profile C 配置中的文档 RTT，**不能与上表做绝对数值比较**。它证明的是时间顺序和间隔：静态首屏及原生链接可以明显早于 React 接管，不再需要等 SPA bundle 才第一次看到有意义内容。

### 3.4 为什么有时快、为什么有时慢

**变快的原因：**

- 删除 React 服务端运行时和 hydration 对齐工作，浏览器主线程阻塞更少。
- route-level lazy split、preload 调整和 query 合并减少冷首页关键请求。
- Hono 直接处理 API/MCP/static assets，没有 Nitro/Start 的中间层。
- meaningful shell 直接随 HTML 返回，不等待 React 或 live source。
- Valkey 命中后 Confluence 相关 API 从数百/数千毫秒降到数毫秒量级。

**变慢的原因：**

- SPA 的动态正文必须等待 JS 下载、解析和 React mount；纯 Start SSR 可以更早返回 route-specific HTML。
- 冷 cache 时仍要访问 Confluence 等外部源；多个读取会放大 500 ms 单源延迟，形成 tail latency。
- 静态 shell 只能包含稳定内容，不能提前包含请求身份相关或最新 live data。

## 4. Bundle、请求与产物大小

### 4.1 最终 SPA 冷首页优化

这些数字使用同一套 build effective-transfer 口径，可直接比较：

| 冷首页/客户端产物 | 早期 Hono SPA | 优化后 SPA | 最终 static-shell SPA |
| --- | ---: | ---: | ---: |
| 冷首页 JS requests | 21 | 14 | 11 |
| 冷首页 JS transfer | 未保留同口径数据 | 202,476 B | 151,335 B |
| Portal JSON requests | 4 | 2 | 2 |
| 全部 client JS files | 58 | 55 | 59 |
| 全部 client JS transfer | 未保留同口径数据 | 483,917 B | 477,013 B |

最终版本相对优化后 SPA：

- 冷首页少 3 个 JS 请求。
- 冷首页 JS 少 51,141 B，下降约 25.3%。
- 全部 client JS transfer 仍低于 500 KB gate。
- 总文件数从 55 增至 59，是 route lazy splitting 产生更多小 chunk；冷首页请求和传输量反而下降，因此不算用户路径回退。

### 4.2 构建产物对照

| 方案 | `.output` 大小 | 说明 |
| --- | ---: | --- |
| fresh `origin/main` Start/Nitro SSR control | 10,644 KiB | 292 个 output files |
| 优化后的 Hybrid SSR prototype | 8,952 KiB | 仍包含 Start SSR client/server runtime |
| 最终 Hono + static-shell SPA | 5,444 KiB | 209 entries；public 3,068 KiB，server 2,372 KiB |

最终产物相对 fresh Start/Nitro control 小约 48.9%，相对 Hybrid prototype 小约 39.2%。

最终 Linux/amd64 容器镜像为 231,773,443 bytes（约 221 MiB）。镜像以非 root `node` 用户运行，Docker healthcheck 能达到 `healthy`。

## 5. 500 ms live fetch 与缓存

### 5.1 当前测量含义

MSW 0 ms 与 500 ms 都已测。生产 build 不注册浏览器 MSW；500 ms 场景通过受控 source fixture 注入，目的是模拟外部源延迟，而不是声称等同于真实 Confluence 网络分布。

结果说明：

- **冷 cache：** Data ready 8,097 ms。
- **暖 source cache：** Data ready 6,262 ms。
- **回收：** 1,835 ms，约 98.6% 的额外冷延迟。

所以静态 shell 解决“先看到、先导航”，Valkey 解决“live data 何时可决策”；两者不是替代关系。

### 5.2 最终缓存策略

Confluence 不使用 HTTP `HEAD`。这里的 “head query” 是较轻的 metadata/version 请求：

1. 请求页面 metadata/revision，不带 storage body。
2. 用 auth scope + page id + revision 构造 body cache key。
3. revision 未变化时直接返回已缓存 body。
4. revision 变化时获取新 body，写入新的 revision key。
5. cache 不可用时 fail open 到 source；不把 stale body 冒充 current。

缓存还覆盖 single-flight、negative caching、hard expiry 和 token lifecycle。Valkey 是加速层，不是内容的持久化 source of truth；Confluence 仍是权威数据源，ECS 本地磁盘也不承载内容持久化。

生产客户端选择 **iovalkey Cluster**：

- TLS 强制开启。
- ElastiCache IAM token 自动签名，并每 14 分钟刷新连接凭证。
- Cluster topology 由客户端管理。
- token 刷新逻辑很小、可测；仅为了隐藏这段刷新而换 GLIDE，不足以抵消其 native packaging/runtime 风险。

## 6. SPA、SSR、Hybrid 的最终判断

| 方案 | 首屏 | 最终交互/数据 | Bundle/产物 | 维护与部署 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 纯 Start SSR | route HTML 最早 | 仍等 hydration/live data | 最大 | 保留 Start + Nitro 双运行时 | 不选 |
| 纯空白/骨架 SPA | 首屏最慢 | 暖 cache 可很好 | 最小/简单 | 最简单 | 单独使用不够好 |
| Hybrid SSR | LCP 最强 | 优化后与 SPA 接近 | 8,952 KiB | 双构建、SSR、序列化/水合、custom dev host | 性能冠军，但整体不最佳 |
| Static-shell SPA + Hono | 静态内容很早，动态内容后到 | cache 命中后接近最优 | 5,444 KiB | 单进程、单 client build | **最终选择** |

优化 Hybrid 在 0 ms source 下的 LCP 为 3,060 ms、Data ready 为 6,414 ms；暖 500 ms cache 下分别为 3,260 ms 和 6,097 ms。它确实比普通 SPA 更漂亮，但代价是：

- custom Vite middleware-mode dev host；
- 分开的 client/server app builds；
- isomorphic loader 约束；
- SSR serialization/hydration；
- Start release-candidate 升级与调试风险；
- 更大的 deploy artifact 和更多故障组合。

在 Atlas 当前是内部 API/MCP 产品、Portal 是一个客户端、没有 SEO 或请求身份相关 HTML 硬需求的前提下，这些是永久成本，而 SSR 优势主要集中在首屏。meaningful static shell 已经覆盖了最重要的首屏观感，因此没有必要保留完整 SSR 系统。

只有出现以下硬需求时才应重新考虑 Hybrid/SSR：

- 身份相关 HTML 必须在 JS 前返回；
- 文档级 404/redirect/status/header/cookie 必须由页面请求决定；
- SEO 或非浏览器消费者必须读取完整 route HTML；
- 静态 shell + cache 仍无法达到已定义的真实用户 SLO。

## 7. 可维护性、目录与故障面

### 改善

- `portal/server/hono/**` 成为唯一 HTTP host：app、server、production、static assets、request context、graceful shutdown 各自边界明确。
- `portal/src/**` 只负责 Router SPA 和浏览器交互，不再同时理解 server functions/SSR。
- `context-layer/**` 是 framework-neutral domain/data layer，可由 Hono 直接组合。
- 删除 Lambda handler/build config，避免单 ECS 项目维护第二种部署形态。
- 所有 Portal 数据通过显式 HTTP contracts，浏览器、MCP、测试共享相同服务边界。
- `.output` 仍是稳定运维合同，Docker 与 smoke test 不需要理解 Vite 内部目录。

### 没有被美化的成本

- 迁移不是简单删代码：相对 `origin/main` 涉及 170 个文件，约 7,614 additions / 3,470 deletions，其中包含显式 host、cache 和大量回归测试。
- 自己拥有 static asset serving、precompression metadata、SPA fallback 和 shutdown，代码比依赖框架默认值更显式。
- meaningful shell 和 React 首屏存在内容一致性责任；生产 smoke 已覆盖 JavaScript disabled 和 React takeover，但以后修改首屏必须同步检查。
- Valkey IAM、revision cache 和 source failure policy 增加了数据层复杂度，不过它们直接解决真实 tail latency，且无论 SPA/SSR 都需要。

因此“整体更可维护”的依据不是 LOC 更少，而是运行模型从多个隐式框架层收敛为一个 HTTP host、一个部署单元和明确的数据/cache 合同。

## 8. 已完成验证

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：通过，共 446 tests。
  - Context Layer：179。
  - Portal：231。
  - 其余 workspace/acceptance：36。
- Primary Playwright：31/31。
- Production smoke：13/13。
- JavaScript disabled 时 meaningful shell 可见，heading/nav/catalog link 可用。
- React 接管后 static marker 消失；landing-zone selector 能更新 React state；native mobile Popover 可开关。
- Production artifact 中不存在 TanStack Start、Nitro、Lambda output、MSW 和 dev mocks。
- Linux/amd64 Docker build 成功，非 root 运行，healthcheck 正常，`/`、`/health`、`/openapi.json` 可访问。

## 9. 上线前剩余门槛

以下不是架构重新选型，而是 production-specific proof：

1. 在 staging 验证真实 IAM-authenticated ElastiCache/Valkey Cluster handshake、token rotation 和 fail-open。
2. 用代表性 Confluence 页面和权限 scope 测 revision query、body miss、warm hit 及错误分布。
3. 在真实 ALB/ECS 网络下重跑最终 static-shell artifact 的 Profile C/RUM 指标，建立最终 SLO 基线。
4. 多 ECS task 高并发时观察跨进程 stampede；只有实际出现问题再引入 distributed lock，不预先复杂化。

## 10. 最终建议

**Start。采用这条最终路线，不采用纯 SSR，也不采用运行时 Hybrid。**

发布判断应基于：

- 首屏通过 static shell 达到“立即有意义、原生链接先可用”；
- React 和动态数据分别有明确 readiness 指标；
- 500 ms source latency 由 Valkey warm path 收回，而不是隐藏在 SSR TTFB 中；
- 一个 ECS task/一个 Node 进程明显降低部署和故障组合；
- bundle、冷首页请求和 `.output` 都显著小于 Start/Nitro control；
- Hybrid 的额外复杂度只在出现真正 SSR-only 需求时才值得重新承担。

## 11. 证据索引

- [迁移前性能基线](./architecture/nitro-removal-pre-migration-baseline.md)
- [迁移后验证与性能迭代](./architecture/nitro-removal-post-migration-verification.md)
- [Hybrid prototype 对照（已淘汰，仅保留决策证据）](./architecture/hono-start-hybrid-prototype-verification.md)
- [Source content cache 设计](./architecture/source-content-cache.md)
- [TanStack Start/Hono 架构调研](./research/tanstack-start-hono-architecture-landscape-2026.md)
