# Current Implementation vs V1 Design — Hard Review

## 核心判断

【品味评分】🔴 红偏黄：合同骨架有点品味，产品实现还没到 V1。

【结论】当前实现不能被称为完整的 `Atlas V1 implementation`。它更像一个“本地 pilot simulator”：schema、内存 registry、resolver、HTML 字符串渲染、acceptance smoke tests 都能跑通，但设计里最关键的 Source-native、request-time source retrieval、真实 Context API、DynamoDB 边界、TanStack Start Portal 都还没真正落地。

验证结果：

- `pnpm -C /Users/ziyu/Workspace/atlas test`：通过。
- `pnpm -C /Users/ziyu/Workspace/atlas typecheck`：通过。
- `git -C /Users/ziyu/Workspace/atlas --no-pager diff --check`：通过。
- 工作区干净。

测试绿不等于设计实现完成。这里的测试主要证明“本地模拟链路可运行”，不是证明 V1 架构已经满足设计。

## 关键洞察

- 数据结构：`Source` / `Topic` / `Anchor` / `SourceTopicMapping` / `Feedback` 被拆开了，这是对的；但 Source content 被硬编码进仓库，直接破坏 Source-native 原则。
- 复杂度：现在用“本地 seed + 字符串 HTML + in-process handlers”绕过了真正难的问题。代码简单，但简单在错误边界上。
- 最大风险：一旦把这个当成 V1 交付，用户会以为 Atlas 已经是 governed context layer；实际它没有真实 source fetcher、没有真实 API surface、没有真实 Portal app、没有 DynamoDB-backed registry。

## 做得对的部分

- 共享 schema 包是正确方向：`@atlas/schema` 定义 Source、Topic、Anchor、Feedback、ContextBundle、ApiError 等合同，且用 strict Zod schema。
- 数据模型没有把 governance 字段复制到 `Topic` 或 mapping。
- `context-layer` 和 `portal` 没有互相乱 import 内部实现；Portal 当前只依赖 `@atlas/schema`。
- resolver registry 按 `source_class` 注册，避免了 route handler 里硬编码 switch。
- LLM 逻辑没有进入 Context Layer；Ask Atlas 在 Portal 层通过 adapter 和 citation validation 做了基本边界。
- restricted / broken / stale / no-source 等 warning 的基本测试覆盖存在。

## 阻塞问题

### 1. Source-native 原则被硬编码 source content 破坏

设计要求 Atlas 不替代 Terraform repo、Confluence、policy docs；source systems remain the system of record。V1 要做 request-time resolution，不做 pre-ingested content index。

实现现状：

- 默认 service 直接 import 本地 source content provider：`context-layer/src/services/contextBundleService.ts`
- 默认 service 用 `createPilotSourceContentProvider()`
- provider 把 excerpt 文本直接写在代码里：`context-layer/src/sourceContent/pilotSourceContent.ts`
- `docs/pilot-readiness.md` 也承认 source content 是 local provider。

这是致命问题。Seed registry 可以接受，seeded source content 作为默认 Context Layer 不行。它把“source-native context broker”降级成了“内置摘录仓库”。

修复方向：

1. 把 `pilotSourceContent` 降级为测试 fixture / local demo fixture。
2. Context Layer 默认路径必须通过 source-class fetcher 在 request time 获取内容。
3. 三类 fetcher 至少要有明确接口和 production/stub 分离：Git repo / Confluence / policy document。
4. fetch failure 必须变成 `source_unavailable` warning，不要伪装成本地内容存在。

### 2. Context API 不是设计里的 API surface

设计要求 endpoint sketch：

- `GET /topics`
- `GET /topics/{id}`
- `GET /topics/{id}/context`
- `GET /sources/{id}`
- `GET /sources/{id}/content`
- `POST /feedback`

实现现状：

- `context-layer/src/index.ts` 只 export 三个 in-process handler。
- `infra/src/atlasInfraPlan.ts` 只生成 `POST /context-bundle` 一条 API Gateway route。
- 没有 Lambda handler 文件。
- 没有 HTTP router。
- 没有 `GET /topics/{id}`、`GET /sources/{id}`、`GET /sources/{id}/content`、`POST /feedback`。
- repositories 全是 in-memory class，没有 DynamoDB-backed module。

这不是 Context Layer API，只是几个可直接调用的函数。Acceptance test 直接 import `handleContextRequest`，所以绕过了真实消费者边界。

修复方向：

1. 实现 Lambda/APIGW handler。
2. 把 endpoint sketch 全部落成 route。
3. repository 层增加 DynamoDB implementation，并保留 in-memory implementation 给测试。
4. API tests 走 route boundary，不要只测 service 函数。

### 3. Portal 不是 TanStack Start Portal

设计要求 Portal 有 route map、global shell、TanStack Start app shell、loader boundary、discovery surfaces。

实现现状：

- 没有 `portal/src/routes`。
- 没有 `.tsx` 文件。
- 没有 `components.json`。
- `portal/src/framework.ts` 只是声明 `portalFramework` 常量。
- `portal/src/views/portalViews.ts` 是字符串拼 HTML。
- `docs/pilot-readiness.md` 承认目前只是 HTML rendering tests。

这不是 Portal implementation。它最多是 view formatter。设计要求的是产品 UI：sidebar、route loaders、shell、source lookup、capability detail、landing zone navigator、evidence rail。现在没有浏览器应用边界。

修复方向：

1. 建真实 TanStack Start root route 和 route tree。
2. 建 `PortalShell`，不要继续堆字符串 renderer。
3. Context API calls 放在 server-side loader / server function boundary。
4. Browser components 只接收 schema-parsed data。

### 4. Feedback 和 expansion 合同没有实现

设计里 `POST /feedback` 是 V1 API。Schema 里也有 `FeedbackSchema`，还有 `ExpansionRequestSchema`。

实现问题：

- 没有 feedback route。
- 没有 source/anchor expansion route。
- Portal 的 `buildFeedbackPayload` 返回 `{ bundle_id, reason, message }`，这和 shared `FeedbackSchema` 的 `{ target_type, target_id, feedback_type, message, submitted_at }` 不是一个合同。
- 这会导致 Portal 反馈路径一上线就和 API/schema 不兼容。

修复方向：

- 删除 Portal 自造 feedback payload。
- 用 shared schema 定义 request/response。
- Context Layer 实现 `POST /feedback`。
- Portal 表单提交 `target_type`、`target_id`、`feedback_type`、`message`，不要提交 `bundle_id/reason` 这种 UI 私货。

## 重要问题

### 5. Freshness 不是 read-time，日期被钉死

设计要求 V1 read-time staleness。当前默认 service 固定 `now` 为 `2026-05-06T00:00:00.000Z`。

这会让系统在真实时间流逝后继续给出过期的 freshness 判断。测试稳定了，产品坏了。

修复方向：

- production default 使用 `new Date()`。
- 测试通过 injected clock 固定时间。
- `review_frequency` 最好解析成明确 duration model，别只靠 `P(\d+)D`。

### 6. Broken anchor status 没有被当成一等信号

`resolveAnchor` 只看 anchor 是否存在、locator 是否存在、locator 是否符合格式。它没有检查 `anchor.status`。

如果一个 anchor 标为 `broken`，但 locator 恰好还能取到 text，当前实现会返回 excerpt 而不是 warning。这违背“broken anchors are flagged”的治理语义。

修复方向：

- `anchor.status === "broken"` 直接产生 `broken_anchor` warning。
- `weak` 产生 `weak_anchoring` warning，可按 disclosure level 决定是否返回 source-level context。
- `unvalidated` 也应该进入 warnings，不要静默当 valid 用。

### 7. Authority routing 只是 token match，不是 authority-aware ranking

当前 source selection 是 deterministic token match，但没有显式 authority ranking，没有按 scope relevance 排序，没有 tie-break rule。

`authorityConflictWarnings` 能报冲突，但 warning 没有绑定具体 source IDs。冲突被“说出来”了，但证据关系不够可操作。

修复方向：

- 明确 authority sort order：`authoritative > reference > example > draft > deprecated`。
- selection rationale 要包含匹配的 topic/source/scope。
- conflict warning 至少包含 involved source ids 或 scope + source refs。
- deprecated source 不应该和 authoritative source 混在一起时只靠顺序碰运气。

### 8. Infrastructure 只是字符串计划，不是可交付 IaC 模块

当前 `infra/src/atlasInfraPlan.ts` 生成 typed plan，Terraform 内容也是字符串。它可以作为 architecture sketch，但不该被叫做“express Atlas infrastructure as Terraform”的完成态。

至少缺：

- 实际 `.tf` 文件或生成命令。
- Lambda package wiring。
- API routes 全量映射。
- DynamoDB access pattern/table schema 与 repo 实现对齐。
- seed loading path。

## 次要但必须修

- `context-layer/src/seeds/pilotRegistry.ts` 505 行，违反每文件 500 行限制。别争 5 行，这种规则就是为了逼你拆数据。拆成 topics/sources/anchors/mappings/feedback。
- `portal/src/api/contextApiClient.ts` 是 static client；它不接受 filters，也不打 HTTP。作为 fixture client 可以，不能当 Portal Context API client。
- `handleContextRequest` 对 explicit restricted source 直接 403。这和“restricted as visibility warning”在 topic context path 上有张力。建议区分 metadata/context bundle 和 content expansion：metadata 可见，content expansion 可拒绝。
- `handleContextRequest` 对 explicit unavailable source 直接 503。单 source expansion 可以报错，但 bundle request 应尽量返回 partial bundle + warning。

## 设计符合度概览

| 设计项                               | 当前状态 | 判断       |
| ------------------------------------ | -------: | ---------- |
| Shared schema-first contract         | 基本完成 | 可接受     |
| Source/Topic/Anchor/Mapping 分离     | 基本完成 | 可接受     |
| Context Layer 不调用 LLM             |     完成 | 可接受     |
| Ask Atlas citation validation        | 初版完成 | 可接受但薄 |
| Request-time source retrieval        |   未完成 | 阻塞       |
| Git/Confluence/policy fetchers       |   未完成 | 阻塞       |
| DynamoDB-backed registry             |   未完成 | 阻塞       |
| Full Context API endpoint surface    |   未完成 | 阻塞       |
| Feedback API                         |   未完成 | 阻塞       |
| Source/anchor expansion endpoint     |   未完成 | 阻塞       |
| TanStack Start Portal                |   未完成 | 阻塞       |
| Portal route loaders/server boundary |   未完成 | 阻塞       |
| Freshness read-time behavior         | 错误实现 | 重要       |
| Anchor status propagation            |   不完整 | 重要       |
| Authority-aware ranking              |   不完整 | 重要       |
| File under 500 lines                 |   有违规 | 次要       |
## Bridging Plan: 从当前实现补齐到 V1 设计

### Phase 1 — 修 Context Layer 数据边界

目标：把 Atlas 从“本地 excerpt simulator”拉回“source-native context broker”。

必须做：

1. 把 `context-layer/src/sourceContent/pilotSourceContent.ts` 移到测试 fixture 或 demo-only adapter。
2. 定义 production `SourceFetcher` 接口。
3. 为三类 source class 建独立 fetcher：
   - Terraform module Git fetcher
   - Confluence page fetcher
   - Policy document fetcher
4. resolver 输入从本地 map 改成 request-time fetch 结果。
5. fetch timeout / unavailable / malformed response 全部转成 structured warning。
6. `createDefaultContextBundleService()` 不能默认使用 committed excerpts。

验收标准：

- 删除默认 production 路径对 `pilotSourceContent` 的依赖。
- source unavailable 时返回 partial bundle + `source_unavailable` warning。
- resolver tests 仍覆盖 success、broken anchor、source unavailable、malformed anchor input。
- 新增测试证明 committed fixture 不参与 production default service。

### Phase 2 — 补真实 Context API surface

目标：让消费者通过 API contract 使用 Atlas，而不是 import in-process 函数。

必须做：

1. 实现 HTTP router / Lambda handler。
2. 落地这些 endpoint：
   - `GET /topics`
   - `GET /topics/{id}`
   - `GET /topics/{id}/context`
   - `GET /sources/{id}`
   - `GET /sources/{id}/content`
   - `POST /feedback`
3. 所有 endpoint 返回 shared schema 兼容 response。
4. 所有错误返回 structured `ApiErrorResponse`。
5. API tests 走 route boundary，不直接调用 service 当产品入口。

验收标准：

- 每个 endpoint 有 success test。
- 每个 error code 有 API-level test。
- acceptance tests 不再直接绕过 API boundary。
- explicit expansion failure 可以返回 error；topic context bundle failure 应返回 partial bundle + warning。

### Phase 3 — 落 DynamoDB-backed registry

目标：让 registry storage 对齐 V1 AWS Lambda + DynamoDB 设计，而不是只靠内存 map。

必须做：

1. 定义 repository interface。
2. 保留 in-memory repository 给 unit tests。
3. 新增 DynamoDB repository implementation：
   - Source repository
   - Topic repository
   - Anchor repository
   - SourceTopicMapping repository
   - Feedback repository
4. 明确 DynamoDB table key design。
5. Seed loading path 从 structured seed 写入 DynamoDB。
6. route handler 不得包含 raw DynamoDB logic。

验收标准：

- repository tests 覆盖 in-memory 和 DynamoDB/local equivalent 行为。
- API tests 不 mock data model layer。
- Portal 不直接读 DynamoDB。
- Source/Topic/Mapping 仍保持显式分离。

### Phase 4 — 修治理语义

目标：让 warning、freshness、authority 和 anchor status 成为真正的治理信号。

必须做：

1. production clock 使用 `new Date()`；测试注入 fixed clock。
2. `anchor.status` 参与 resolution：
   - `broken` → `broken_anchor`
   - `weak` → `weak_anchoring`
   - `unvalidated` → warning
3. authority routing 加排序和 rationale：
   - authoritative
   - reference
   - example
   - draft
   - deprecated
4. conflict warning 绑定 source ids / scope。
5. deprecated source 不应在没有说明的情况下和 authoritative source 同等展示。

验收标准：

- 新增测试：标记为 broken 的 anchor 即使 locator 可解析，也必须 warning。
- 新增测试：staleness 随当前时间变化。
- 新增测试：authority ranking 稳定且 deterministic。
- 新增测试：conflict warning 可定位涉及 source。

### Phase 5 — 替换 Portal 字符串 renderer 为 TanStack Start app

目标：把 Portal 从 view formatter 变成真实产品 UI。

必须做：

1. 建 TanStack Start root route。
2. 建 route tree：
   - `/`
   - `/capabilities`
   - `/capabilities/$topicId`
   - `/landing-zones`
   - `/landing-zones/$topicId`
   - `/sources`
   - `/sources/$sourceId`
   - `/ask`
3. 建 `PortalShell`：
   - left sidebar
   - logo slot
   - top query
   - main content
   - optional evidence rail
4. API calls 放在 server-side loader / server function boundary。
5. Browser components 只消费 parsed data。
6. 删除或降级字符串 renderer，避免它假装是 Portal。

验收标准：

- route renders 不是字符串拼接。
- Portal 不 import Context Layer internals。
- Capability / Landing Zone / Source 页面从 Context API response 渲染。
- Warning states 可见。
- Ask Atlas 保持 visible-but-bounded，不冒充完整 AI 产品。

### Phase 6 — 修 Portal API client 和 Feedback path

目标：让 Portal 与 shared contract 对齐。

必须做：

1. `ContextApiClient` 改成 HTTP/schema-backed client。
2. 支持 filters：
   - topic type
   - category
   - source class
   - authority level
   - warning state
3. 删除 `buildFeedbackPayload` 的 `{ bundle_id, reason, message }`。
4. 用 shared feedback request contract：
   - `target_type`
   - `target_id`
   - `feedback_type`
   - `message`
5. feedback submit 走 `POST /feedback`。

验收标准：

- Portal feedback payload 能被 shared schema parse。
- API error code 能映射到 UI state。
- Browser bundle 不包含 source-system 或 LLM credentials。
- Static client 只存在于 tests/fixtures。

### Phase 7 — 把 infra 从 typed sketch 变成可交付 IaC

目标：基础设施和 runtime 实现对齐。

必须做：

1. 生成或提交实际 Terraform files。
2. API Gateway routes 覆盖完整 endpoint surface。
3. Lambda handler path 和 package path 真实存在。
4. DynamoDB table key design 与 repository implementation 对齐。
5. Secrets Manager / Parameter Store 引用进入 source fetcher config。
6. 加 seed loading command 或 script。
7. CloudWatch metrics 覆盖：
   - source selection
   - anchor resolution failure
   - context bundle warning
   - API error

验收标准：

- Terraform validate 可跑。
- Lambda package entrypoint 存在。
- Infra tests 不只是 assert 字符串存在，还要覆盖 route completeness。
- local/test 环境不需要 committed secrets。

### Phase 8 — 重写 acceptance tests，让它们证明 V1，而不是证明 mock chain

目标：测试证明设计，而不是安慰自己。

必须做：

1. acceptance tests 走 API boundary。
2. Portal tests 走真实 routes 或 interaction tests。
3. Ask Atlas tests 保留 adapter，但 context bundle 来自 API。
4. 加失败模式验收：
   - no registered source
   - stale source
   - broken anchor
   - weak anchor
   - restricted source
   - source unavailable
   - authority conflict
5. 加 contract compatibility tests：
   - Portal client parses API response
   - feedback request/response schema compatible
   - expansion path works

验收标准：

- 当前 V1 三场景仍通过：
   - Capability Discovery
   - Landing Zone Navigation
   - AI Consumer Discovery
- 失败模式不是 snapshot-only，而是 explicit assertions。
- Known limitations 只保留真实 post-V1 范围，不再把 V1 核心缺口写成 limitation。

## 推荐执行顺序

1. Context Layer source fetcher boundary
2. Full Context API routes
3. DynamoDB-backed repositories
4. Governance semantics fixes
5. Portal TanStack Start shell/routes
6. Portal API client + feedback flow
7. Terraform/IaC completion
8. Acceptance tests rewrite

不要先做 UI。现在最大的问题在数据边界。UI 先做只会把错误架构包装得更像真的。

## 最终判断

如果目标只是“证明 schema 和本地 happy path 能串起来”，当前实现凑合。

如果目标是“对齐 `current_design.md` / `constraints.md` / `implementation_plan.md` 的 Atlas V1”，当前实现不合格。最糟糕的不是缺 UI，而是把 source-native request-time retrieval 偷换成了 committed local excerpts。这正好破坏了 Atlas 这个产品最核心的设计。


