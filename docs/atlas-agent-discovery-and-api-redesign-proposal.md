# Atlas Agent 发现与调用接口改造建议

> 状态：设计建议稿  
> 日期：2026-06-26  
> 范围：Atlas 对未知或低上下文 Agent 暴露的 Web 发现入口、OpenAPI、机器可读内容接口与配套文件  
> 不包含：在 Atlas 内引入大模型、自然语言问答服务、MCP Server 实现、内容生产流程重构

---

## 0. 架构前提：Source Authority 与 Resource Materialization

> 决策记录见 [ADR-0013](./adr/0013-resource-projection-not-materialization.md)，与 [ADR-0003](./adr/0003-evidence-vs-live-status-split.md)、[ADR-0006](./adr/0006-governed-honesty-model.md)、[ADR-0009](./adr/0009-availability-matrix-resolver.md) 一致。

本文所有 Resource / Section 接口都建立在一个不可妥协的前提上：

**选择 α — Live resource projection（实时资源投影）。Atlas 不是 CMS，外部 Source 始终是 system of record。**

Atlas 持久化的，只有构造投影所需的元数据：

- Resource 身份与 aliases；
- Resource → Section 的映射；
- Source / Anchor 引用；
- Resolver 配置；
- 排序与展示元数据。

Atlas **不持久化**：解析后的来源摘录、镜像的来源正文、预拼装的 Resource 文档、stale 兜底副本。

`GET /api/resources/{kind}/{slug}` 与 `GET /resources/{kind}/{slug}.md` 是**动态 representation endpoint**，不是静态内容产物。每次请求：加载 Section 投影映射 → live resolve 引用的 Source/Anchor → 按 Section 聚合成功结果 → 返回 Citation、per-Section 解析状态与 warning → 解析失败时**绝不**回退到此前解析过的摘录。

> **稳定 URL ≠ 静态文件；确定性模板 ≠ 持久化正文；预定义结构 ≠ 预存正文。**

缓存的边界（ADR-0009 §1）：存在 lazy-TTL 性能缓存（`sourceContentCache`），它**仅是性能优化**——TTL 内命中、绝不作为 resilience fallback、解析失败时绝不当作 stale 内容返回。

**拒绝 β — Durable resource materialization**：不为了简化 Agent 消费而持久化策划/解析后的 Section 正文。采用 β 会把 Atlas 变成内容 system of record / CMS，使 live-resolution 保证与 governed-honesty moat（ADR-0006）失效，须由单独的产品与架构决策推翻 ADR-0009——不能藏在本次 Agent Discovery 改造里顺带发生。

---

## 1. 背景

Atlas 当前已经提供：

- `/llms.txt`
- `/openapi.json`
- `/.well-known/api-catalog` 或类似机器目录
- 首页 `/` 中通过 HTTP Header 指向 `llms.txt`
- 通用内容 API，例如：
  - `GET /topics?query=...`
  - `GET /topics/{id}/context`

测试 Prompt：

```text
can aws textract be used in private subnet,
and which regions is it available in,
use url to discover
```

出现两类稳定失败。

### 1.1 失败 A：Bootstrapping / 发现失败

Agent 获得 Atlas 根 URL 后，通常会：

1. 打开 `/`；
2. 或执行普通 `curl https://atlas.example.com/`；
3. 读取 HTML 正文；
4. 停止。

虽然响应 Header 中存在指向 `/llms.txt` 的 Link，但很多 Agent 工具：

- 默认不向模型暴露响应 Header；
- 不主动使用 `curl -I` 或 `curl -i`；
- 不主动猜测 `/llms.txt`、`/openapi.json` 或 `/.well-known/...`；
- 不把 HTML `<head>` 中的 `<link>` 视为后续操作指令。

因此，机器入口存在，不代表未知 Agent 能够发现它。

### 1.2 失败 B：Actionability / 调用失败

部分 Agent 能发现 `/openapi.json`，但仍不能回答问题，因为现有 API 暴露的是 Atlas 的内部内容模型：

```text
搜索 Topic
→ 选择 Topic
→ 获取 Topic Context
→ 判断是否还要搜索第二个 Topic
→ 合并两个 Context
```

对于测试问题，Agent 必须自行推断：

- `AWS Textract` 对应哪个资源；
- “private subnet” 应搜索什么关键词；
- “which regions” 是否需要第二次搜索；
- 哪个 Topic 回答网络问题；
- 哪个 Topic 回答区域问题；
- 空结果表示“不支持”，还是“Atlas 没有数据”；
- 两个结果是否已经覆盖完整问题。

OpenAPI 可以描述 endpoint、参数和返回类型，但如果 API 本身以 Topic、Context 等内部资源为中心，Agent 仍需要承担 Atlas 内部检索编排工作。

---

## 2. 核心结论

### 2.1 发现和调用是两个独立问题

完整链路至少分为四层：

```text
Bootstrap
从任意入口找到机器接口

→ Capability Discovery
理解 Atlas 能提供什么能力

→ Invocation
知道应调用哪个 operation，以及参数如何传递

→ Content Consumption
获得足够完整、结构稳定、带证据的数据并形成回答
```

不同文件的职责不能混在一起：

| 层 | 主要载体 | 解决的问题 |
|---|---|---|
| Bootstrap | 首页正文、HTTP Link、HTML `<link>`、well-known 路径 | 从第一跳进入机器接口 |
| Capability Discovery | `ai-catalog.json`、`llms.txt` | Atlas 能做什么，入口在哪里 |
| Invocation | 精简的 Agent OpenAPI | 调用哪个 endpoint，参数怎么传 |
| Content Consumption | Resource Markdown / JSON | 返回可直接用于回答的资源上下文 |

### 2.2 不能把 `/llms.txt` 当作关键发现路径

`llms.txt` 是面向 LLM 的精选内容地图和解释文档，不是浏览器或 Agent 必须探测的 Web 标准。

它适合：

- 已经找到文件后的内容导航；
- 解释 Atlas 的能力、限制与推荐操作；
- 链接 OpenAPI、机器目录和重要文档；
- 为 Agent 提供少量稳定的行为指导。

它不适合独自承担：

- 未知 Agent 的冷启动发现；
- API operation 选择；
- 参数 Schema；
- 多步骤调用编排。

补充：大规模 LLM bot 流量研究显示通用爬虫几乎不主动抓取 `/llms.txt`。但该数据测量的是爬虫与引用流量，不能直接代表「拿到 URL 后实时访问」的交互式 Agent（Claude Code、Codex CLI 等）。因此结论是「不能期待通用 Agent 主动探测 `/llms.txt`」，而非「`llms.txt` 对被明确引导的交互式 Agent 无价值」。

### 2.3 Atlas 当前不应提供自然语言 Question API

不建议增加：

```http
POST /v1/context/query
```

```json
{
  "question": "Can AWS Textract be used in a private subnet?"
}
```

因为 Atlas 当前没有模型或自然语言规则引擎，无法真实承诺：

- 问题拆解；
- 实体识别；
- 意图分类；
- 信息检索；
- 多源合并；
- 覆盖度判断；
- 自然语言回答。

接口契约必须与实际能力一致。

### 2.4 Agent 负责理解问题，Atlas 负责提供清晰、完整、可枚举的数据

职责边界建议为：

```text
Agent：
- 识别资源，例如 AWS Textract
- 判断问题涉及 network、availability 等信息域
- 调用 OpenAPI 中明确的 operation
- 根据 Atlas 返回的数据生成最终回答

Atlas：
- 解析或查找标准资源 ID
- 按资源返回完整或指定 Section 的上下文
- 返回来源、更新时间和数据缺失状态
- 不进行自然语言推理
```

### 2.5 应学习 Cloudflare 的“小型 Agent OpenAPI”思路

Atlas 根目录的 `/openapi.json` 不应等于完整后端 API 文档。

它应是经过策划的、面向 Agent 的窄接口，只暴露真正应该由 Agent 调用的少量 operation。

```text
完整后端可能有 20～50 个 endpoint
Agent OpenAPI 只暴露 2～5 个稳定 operation
```

现有 Topic、Source、Content、Admin、Ingestion 等 API 可以继续存在，但不应出现在根目录推荐给未知 Agent 的 OpenAPI 中。

---

## 3. 设计目标

### 3.1 必须达到

1. 只有根 URL 的 Agent，可以从首页正文找到机器入口。
2. 找到 `/openapi.json` 后，不需要理解 Atlas 内部 Topic 模型。
3. 已知资源时，一个外部调用即可触发所有相关 Section 的实时解析，返回已成功解析的内容、Citation、缺失状态与 warning（不保证“完整”，见 §0）。
4. 不知道标准资源 slug 时，最多增加一次搜索调用。
5. 不依赖 Atlas 内的大模型。
6. 返回内容区分：
   - 有数据；
   - 明确否定；
   - Atlas 未收录；
   - 数据可能过期。
7. 所有机器入口都由少量权威源自动生成，避免描述漂移。

### 3.2 非目标

本次不解决：

- Atlas 内直接回答任意自然语言问题；
- 自动把任意问题拆成多步工作流；
- 让所有互联网上的 Agent 必然支持某个新标准；
- 用 `agents.json` 取代 OpenAPI；
- 立即提供 MCP Server；
- 替换现有内容存储和编辑流程。

---

## 4. 目标机器接口结构

```text
/
├── 首页 HTML
│   └── 正文中直接显示 Machine-readable access
│
├── /llms.txt
│   └── Atlas 的精简解释、使用流程和关键链接
│
├── /.well-known/ai-catalog.json
│   └── 能力发现：Atlas 能提供哪些机器资源
│
├── /.well-known/agents.json
│   └── 可选兼容输出，不作为关键路径
│
├── /openapi.json
│   └── 面向 Agent 的精简 OpenAPI
│
├── /resources/{kind}/{slug}.md
│   └── 面向 Agent 阅读的资源 Markdown representation（请求时实时投影，非静态文件）
│
├── /api/resources
│   └── 资源搜索与 canonical ID 解析
│
├── /api/resources/{kind}/{slug}
│   └── 结构化 Resource JSON，可选择 Sections
│
├── /sitemap.xml
│   └── 人类页面与机器友好文档页面的爬取地图
│
└── /api/internal/openapi.json
    └── 完整内部 API，可鉴权，不向未知 Agent 推荐
```

其中真正的主调用路径只有：

```text
已知资源：
GET /api/resources/service/aws/textract

不知道资源 slug：
GET /api/resources?query=AWS%20Textract
→ GET 返回的 resourceUrl
```

---

## 5. API 改造建议

## 5.1 从 Topic-centric 改为 Resource-centric

不建议继续让 Agent 直接使用：

```http
GET /topics?query=textract
GET /topics/{id}/context
```

Topic 是 Atlas 的内部内容单元，不是用户任务中的稳定对象。

建议 Agent API 以业务资源为中心：

```http
GET /api/resources?query=AWS%20Textract
GET /api/resources/{kind}/{slug}
```

示例：

```http
GET /api/resources/service/aws/textract
```

### 5.1.1 Resource 的含义（kind-first，覆盖系统所有 resource kind）

Resource 是 Agent 和人类都能稳定识别的业务对象。它**不止 cloud service**，而是 Atlas 编目的**所有 resource kind**，由一个**可扩展的 resource-kind registry** 定义，例如：

- `service/aws/textract`、`service/azure/document-intelligence`（`service` kind，provider 折进 slug 尾部）
- `landing-zone/secure-baseline`
- `guardrail/network-egress`
- `guidance/<id>`、`skill/<id>` …（以及未来新增的 kind）

推荐 canonical ID：

```text
{kind}/{slug}
```

`kind` 来自 registry、可扩展，不是写死枚举。不同 kind 由不同 backing records 组成（service→Topic + availability resolver；guidance→Guidance；skill→Skill；…），但对外统一为 `{kind}/{slug}` + 该 kind 的 Section 词表。Agent 不自己拼 URL——`searchResources` 直接返回 `resourceUrl`。

## 5.2 整资源投影优先（非预拼装文档）

默认调用：

```http
GET /api/resources/service/aws/textract
```

应触发该资源当前所有已注册 Section 的实时投影，而不是要求 Agent 逐条探索 Topic。Atlas 为每个 Resource 维护一份稳定的 **Section Projection Plan**——把 Section 映射到现有 Source、Anchor 与 Resolver，请求时通过 live resolution 动态组装 JSON 或 Markdown，**不持久化解析后的正文或摘录**（见 §0）：

```yaml
resource: aws/textract
sections:
  network:
    - sourceId: aws-textract-vpc-doc
      anchorId: private-connectivity
      resolverId: markdown-anchor
      order: 10
  availability:
    - sourceId: aws-regional-services
      anchorId: textract-regions
      resolverId: availability-cell
      order: 10
```

Projection Plan 持有的是**引用关系与解析规则**，不是内容副本。

这与 Cloudflare 体验相似但内容所有权不同——必须限定类比：

```text
Cloudflare: product slug → maintained product document（CF 自有权威正文）
Atlas:      resource slug → registered live source projections（外部 Source 的实时引用）
```

Cloudflare 的 `{slug}.md` 本身就是可直接提供的权威内容；Atlas 是外部 Source 的实时引用与解析层，因此 `.md` 只能是请求时投影出的 representation，不能是构建时落盘的静态文档。

### 5.2.1 推荐 Section

Section 使用粗粒度、稳定、易理解的分类：

```text
overview
availability
network
security
compliance
pricing
limits
guidance
examples
sources
```

不建议一开始把外部参数设计得过细：

```text
network.private-connectivity.vpc-endpoint
security.encryption.at-rest.customer-managed-key
```

过细的 Facet 会再次把复杂语义映射责任推给 Agent。

细粒度分类可以作为 Atlas 内部元数据存在，外部先按 Section 聚合。

## 5.3 支持可选 Section 过滤

完整资源可能较大，因此支持：

```http
GET /api/resources/service/aws/textract?sections=network,availability
```

规则：

- `sections` 可选；
- 未传时返回所有可用 Section；
- 可一次请求多个 Section；
- 参数值必须是 OpenAPI 中的枚举；
- 未收录 Section 必须显式返回 `missingSections`。

## 5.4 支持 Markdown 和 JSON 两种表现形式

### JSON

```http
GET /api/resources/service/aws/textract
Accept: application/json
```

适合：

- 程序处理；
- 精确读取 regions、状态、证据和时间；
- 后续工具链。

### Markdown

```http
GET /resources/service/aws/textract.md
```

或：

```http
GET /api/resources/service/aws/textract
Accept: text/markdown
```

适合：

- Agent 直接阅读；
- 普通 URL 工具；
- 无 OpenAPI tool runtime 的 blind agent；
- 降低 HTML 清洗成本。

推荐同时支持显式 `.md` URL 和 `Accept: text/markdown` 内容协商。

## 5.5 Resource JSON 推荐响应

```json
{
  "resource": {
    "id": "aws:textract",
    "provider": "aws",
    "slug": "textract",
    "name": "Amazon Textract",
    "aliases": ["AWS Textract", "Textract"],
    "canonicalUrl": "https://atlas.example.com/resources/service/aws/textract.md"
  },
  "requestedSections": ["network", "availability"],
  "sections": {
    "network": {
      "status": "available",
      "summary": "Live-resolved Atlas network information.",
      "facts": [
        {
          "id": "private-connectivity",
          "label": "Private connectivity",
          "value": "...",
          "status": "documented"
        }
      ],
      "content": "...",
      "citations": [
        {
          "sourceId": "aws-textract-vpc-doc",
          "title": "AWS documentation",
          "url": "https://...",
          "anchor": "private-connectivity",
          "resolvedAt": "2026-06-26T10:30:00Z"
        }
      ],
      "warnings": []
    },
    "availability": {
      "status": "available",
      "facts": [
        {
          "id": "supported-regions",
          "label": "Supported regions",
          "value": ["..."],
          "status": "documented"
        }
      ],
      "content": "...",
      "citations": [
        {
          "sourceId": "aws-regional-services",
          "title": "AWS regional availability",
          "url": "https://...",
          "anchor": "textract-regions",
          "resolvedAt": "2026-06-26T10:30:00Z"
        }
      ],
      "warnings": []
    }
  },
  "missingSections": [],
  "resolvedAt": "2026-06-26T10:30:00Z"
}
```

字段说明（见 §0 与 §5.6）：

- `resolvedAt` 是内容**真正从 Source 解析的时刻**。**perf-cache 命中时，用该 excerpt 当初被解析的时间**（随 excerpt 一起存），不是 request 时刻、也不是 cache 命中时刻——否则 cache 命中的旧值会自称"刚解析"。
- `section.warnings` 与 `missingSections[].code` 复用 `@atlas/schema` 的 `warningCodes`（见 §5.6），不引入新词表；
- 顶层 `resolvedAt`（不是 `generatedAt`）强调响应来自一次 live projection，而非读取静态文档；
- 若某来源在请求时不可解析，对应 Section 不得返回上一次解析过的旧内容（不 stale 兜底）。

**两个时钟必须分开（perf-cache vs staleness）**：lazy-TTL 性能缓存（ADR-0009 §1）冻结的只有 *已解析的 excerpt + 它的 `resolvedAt`*；**`stale_source`/freshness 不进 cache**，每次投影时按 registry 当前 `review_frequency`/记录版本 vs now **重新计算**，与 cache 命中与否无关。因此一次 cache 命中可以（且必须）照样带上 `stale_source` warning——perf-TTL（"别狂打 Confluence"）绝不能吞掉 `review_frequency` 触发的 staleness。

## 5.6 明确区分“无数据”和“否定结论”

错误设计：

```json
{
  "regions": []
}
```

Agent 无法判断这是：

- 没有任何支持区域；
- Atlas 没有抓到数据；
- 查询条件错误；
- 数据源不可用。

这里要区分**两个正交的轴**，不要混进一个枚举：

**轴 1 — Section 解析结果 `status`**（这次 live projection 产出了什么）：

```text
available    成功解析出内容
partial      部分来源解析成功
unresolved   注册了来源但本次未能解析出任何内容
```

**轴 2 — 原因 `warnings[].code` / `missingSections[].code`**：直接复用 `@atlas/schema` 的 `warningCodes`，不自创新词：

```text
no_registered_source     该 Section 没有注册任何来源
source_unavailable       来源当前不可访问
broken_anchor            注册的 Anchor 与当前来源不匹配（原 anchor_not_found）
availability_unavailable 可用性矩阵无法 fetch/parse（ADR-0009 §4 的诚实 dead-end）
stale_source             实时内容相对记录基线发生 drift（作用在 live 内容上的 warning）
restricted_source / authority_conflict / weak_anchoring  其余既有 governance warning
```

推荐：

```json
{
  "missingSections": [
    {
      "section": "availability",
      "code": "no_registered_source",
      "message": "Atlas has no registered availability source for this resource."
    }
  ]
}
```

来源不可解析时，对应 Section 返回 `status: unresolved` + warning，而**不是**旧内容：

```json
{
  "sections": {
    "availability": {
      "status": "unresolved",
      "content": null,
      "citations": [],
      "warnings": [
        { "code": "source_unavailable", "message": "The registered source could not be resolved." }
      ]
    }
  }
}
```

关键语义（governed-honesty，ADR-0006）：

```text
No data is not a negative fact.
Resolution failure is not a negative fact.
No registered source is not a negative fact.
Only source-backed explicit evidence may state an unsupported conclusion.
```

「明确否定」不是一个状态码，而是**有 Citation 支撑的内容**——它出现在 `status: available` 的 Section 的 `content` 里，由来源原文证据表达，不通过 enum 标记。

## 5.7 搜索只用于解析资源 ID

```http
GET /api/resources?query=AWS%20Textract
```

推荐响应：

```json
{
  "items": [
    {
      "id": "aws:textract",
      "provider": "aws",
      "slug": "textract",
      "name": "Amazon Textract",
      "aliases": ["AWS Textract", "Textract"],
      "matchReason": "Exact alias match",
      "resourceUrl": "https://atlas.example.com/api/resources/service/aws/textract",
      "markdownUrl": "https://atlas.example.com/resources/service/aws/textract.md"
    }
  ]
}
```

搜索 API 不负责回答问题，只负责把自然语言名称映射到 canonical resource。

## 5.8 现有 Topic API 的定位

现有 Topic API 可以保留用于：

- Atlas Portal；
- 编辑器；
- 管理功能；
- 内部内容聚合；
- 调试；
- 高级客户端。

但它应：

- 从根 `/openapi.json` 中移除；
- 移到 `/api/internal/openapi.json`；
- 或被标记为非 Agent 推荐接口；
- 不出现在 `llms.txt` 的主要调用流程中。

---

## 6. `/openapi.json` 改造建议

## 6.1 定位

根 `/openapi.json` 是：

> Atlas 面向 Agent 的精简可执行契约。

它不是：

- 完整后端路由导出；
- 数据库 CRUD 文档；
- Admin API；
- Topic 内部模型说明；
- 大量 API 的自动生成转储。

## 6.2 推荐只暴露四个 operation

```text
getAtlasInstructions
getAtlasCapabilityCatalog
searchResources
getResourceContext
```

前两个属于冗余发现入口；后两个是主要业务操作。

也可以进一步压缩为两个主要业务 operation：

```text
searchResources
getResourceContext
```

## 6.3 operationId 必须表达任务

推荐：

```text
searchResources
getResourceContext
getAtlasInstructions
getAtlasCapabilityCatalog
```

避免：

```text
getTopics
listData
query
getById
getContext
```

## 6.4 Description 必须包含决策信息

每个主要 operation 的 description 应包含：

1. 什么时候使用；
2. 什么时候不使用；
3. 前置条件；
4. 参数如何从用户问题映射；
5. 返回内容是否能直接用于回答；
6. 空结果如何解释；
7. 失败后下一步调用什么；
8. 至少一个完整用户问题示例。

## 6.5 推荐 OpenAPI 核心内容

以下为建议结构，实际 Schema 可根据现有技术栈调整。

```yaml
openapi: 3.1.0

info:
  title: Atlas Agent API
  version: 1.0.0
  description: |
    Machine-readable access to approved Atlas resources, context,
    guidance, freshness metadata, and supporting evidence.

    Atlas is a read-only data service. It does not interpret or answer
    arbitrary natural-language questions. Calling agents identify the
    relevant resource, retrieve its available context, and synthesize
    the final answer from returned facts and evidence.

servers:
  - url: https://atlas.example.com

paths:
  /llms.txt:
    get:
      operationId: getAtlasInstructions
      summary: Read concise instructions for discovering and using Atlas
      responses:
        "200":
          description: Atlas instructions and machine-readable entry points
          content:
            text/markdown:
              schema:
                type: string

  /.well-known/ai-catalog.json:
    get:
      operationId: getAtlasCapabilityCatalog
      summary: Discover Atlas machine-readable capabilities
      responses:
        "200":
          description: Atlas capability catalog
          content:
            application/json:
              schema:
                type: object

  /api/resources:
    get:
      operationId: searchResources
      summary: Find the canonical Atlas resource for a product or service
      description: |
        Use this operation only when the canonical provider and resource
        slug are unknown.

        For example, searching for "AWS Textract" returns the canonical
        resource identifier `aws/textract`, a JSON resource URL, and a
        Markdown resource URL.

        Do not use this operation to answer product questions directly.
        After selecting the correct result, call getResourceContext.
      parameters:
        - name: query
          in: query
          required: true
          description: Product, service, platform, or resource name.
          schema:
            type: string
          examples:
            textract:
              value: AWS Textract
      responses:
        "200":
          description: Matching canonical Atlas resources
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ResourceSearchResponse"

  /api/resources/{kind}/{slug}:
    get:
      operationId: getResourceContext
      summary: Live-resolve the registered sources for a known resource's sections
      description: |
        Primary Atlas operation for answering questions about a known product
        or service.

        This operation attempts LIVE resolution of the sources and anchors
        registered for the requested resource sections. Atlas does not persist
        resolved excerpts and does not return stale cached content when a source
        cannot be resolved. By default it resolves all registered sections; use
        `sections` to narrow the request.

        The response may contain partial results and per-section warnings. A
        missing or failed section MUST NOT be interpreted as a negative answer
        (see `missingSections[].code` and `sections[].warnings[].code`). A
        negative conclusion is only valid when source-backed evidence in a
        resolved section's `content` states it.

        Example user request:
        "Can AWS Textract be used in a private subnet, and which regions is
        it available in?"

        Recommended call:
        GET /api/resources/service/aws/textract?sections=network,availability

        The calling agent constructs the final answer from returned content,
        facts, citations, and freshness metadata.

        If the canonical {kind}/{slug} is unknown, call searchResources first.
      parameters:
        - name: kind
          in: path
          required: true
          description: |
            Resource kind from the Atlas resource-kind registry (extensible,
            authoritative; not a frozen list). Examples: service, landing-zone,
            guardrail, guidance, skill.
          schema:
            type: string

        - name: slug
          in: path
          required: true
          description: |
            Canonical slug within the kind, returned by searchResources. For
            kind=service the slug is provider-qualified (e.g. aws/textract).
          schema:
            type: string

        - name: sections
          in: query
          required: false
          description: |
            Comma-separated context sections to return. Omit to retrieve every
            available section. The valid set is PER KIND (advertised by the
            resource and the facets registry); the enum below is the union.

            Use `network` for private subnet, VPC endpoint, PrivateLink,
            NAT, internet egress, firewall, DNS, or connectivity questions.

            Use `availability` for supported regions, partitions, GovCloud,
            China regions, or regional feature availability.
          style: form
          explode: false
          schema:
            type: array
            uniqueItems: true
            items:
              type: string
              enum:
                - overview
                - availability
                - network
                - security
                - compliance
                - pricing
                - limits
                - guidance
                - examples
                - sources

      responses:
        "200":
          description: Atlas context grouped by stable sections
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ResourceContextResponse"
              examples:
                textractNetworkAndAvailability:
                  summary: Private connectivity and regional availability
                  value:
                    resource:
                      id: aws:textract
                      provider: aws
                      slug: textract
                      name: Amazon Textract
                    requestedSections: [network, availability]
                    sections:
                      network:
                        status: available
                        content: "..."
                        facts: []
                        citations: []
                        warnings: []
                      availability:
                        status: available
                        content: "..."
                        facts: []
                        citations: []
                        warnings: []
                    missingSections: []
                    resolvedAt: "2026-06-26T10:30:00Z"

            text/markdown:
              schema:
                type: string

        "404":
          description: |
            The {kind}/{slug} was not found. Call searchResources to resolve
            the canonical resource identifier.

components:
  schemas:
    ResourceSearchResponse:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items:
            $ref: "#/components/schemas/ResourceSearchItem"

    ResourceSearchItem:
      type: object
      required: [id, provider, slug, name, resourceUrl, markdownUrl]
      properties:
        id:
          type: string
          examples: ["aws:textract"]
        provider:
          type: string
        slug:
          type: string
        name:
          type: string
        aliases:
          type: array
          items:
            type: string
        matchReason:
          type: string
        resourceUrl:
          type: string
          format: uri
        markdownUrl:
          type: string
          format: uri

    ResourceContextResponse:
      type: object
      required:
        - resource
        - sections
        - missingSections
        - resolvedAt
      properties:
        resource:
          type: object
        requestedSections:
          type: array
          items:
            type: string
        sections:
          type: object
          additionalProperties:
            $ref: "#/components/schemas/ContextSection"
        missingSections:
          type: array
          items:
            $ref: "#/components/schemas/MissingSection"
        resolvedAt:
          type: string
          format: date-time
          description: Timestamp of this live projection. Not a cache/build time.

    ContextSection:
      type: object
      required: [status, citations, warnings]
      properties:
        # Axis 1 — what this live projection produced.
        status:
          type: string
          enum:
            - available
            - partial
            - unresolved
        summary:
          type: string
        content:
          type: ["string", "null"]
        facts:
          type: array
          items:
            type: object
        citations:
          type: array
          items:
            $ref: "#/components/schemas/Citation"
        # Axis 2 — reason codes, reusing @atlas/schema warningCodes.
        warnings:
          type: array
          items:
            $ref: "#/components/schemas/Warning"

    Citation:
      type: object
      required: [sourceId, url, resolvedAt]
      properties:
        sourceId:
          type: string
        title:
          type: string
        url:
          type: string
          format: uri
        anchor:
          type: string
        resolvedAt:
          type: string
          format: date-time

    Warning:
      type: object
      required: [code]
      properties:
        code:
          # Reuse @atlas/schema WarningCode — do not invent new values.
          type: string
          enum:
            - stale_source
            - broken_anchor
            - authority_conflict
            - restricted_source
            - source_unavailable
            - weak_anchoring
            - no_registered_source
            - availability_unavailable
        message:
          type: string

    MissingSection:
      type: object
      required: [section, code]
      properties:
        section:
          type: string
        code:
          $ref: "#/components/schemas/Warning/properties/code"
        message:
          type: string
```

## 6.6 OpenAPI Link 的使用

OpenAPI 3.1 支持 Link Object，可以在搜索响应中声明后续 operation：

```yaml
responses:
  "200":
    links:
      GetSelectedResource:
        operationId: getResourceContext
```

但数组结果仍需要 Agent 选择正确条目，因此 Link 只是辅助，不应替代响应中的：

```text
resourceUrl
markdownUrl
```

动态 URL 字段通常更容易被通用 Agent 使用。

## 6.7 两份 OpenAPI

推荐：

```text
/openapi.json
→ 精简 Agent API

/api/internal/openapi.json
→ 完整后端与管理 API
```

必须避免根 OpenAPI 自动暴露全部内部 route。

**测试不变量随之调整**（`portal/src/api/server/openapiDocument.test.ts`）：现有「documented paths 与 router **精确镜像**」是双向的。拆分后改为——根 agent OpenAPI 只保留 **forward：agent-openapi ⊆ router**（每个 documented path 都能 dispatch）；把 reverse（**无未文档化 route**）**移到 internal openapi**，要求 `router == internal-openapi`。净不变量 `agent ⊆ router == internal`，没有 route 会漏文档。同步更新该测试里的 `mutations` 期望集与 `dispatched.size` 下限。

---

## 7. `/llms.txt` 推荐写法

## 7.1 定位

`llms.txt` 应负责：

- Atlas 是什么；
- Atlas 不是什么；
- Agent 从哪里开始；
- 推荐调用顺序；
- 如何解释缺失数据；
- 链接机器目录、OpenAPI 和重要文档。

它不应：

- 复制完整 OpenAPI；
- 列出全部 Resource；
- 塞入所有 Topic；
- 维护另一套与 API 不一致的参数表；
- 声称 Atlas 可以回答任意自然语言问题。

## 7.2 推荐内容

```markdown
# Atlas

> Atlas is the internal source of approved service metadata, operational
> guidance, availability information, and supporting evidence.

Atlas is a read-only data and context service.

Atlas does not execute arbitrary natural-language questions and does not
produce generated answers. The calling agent identifies the relevant resource,
retrieves its available context, and constructs the answer from returned facts
and evidence.

Recommended procedure:

1. Identify the provider and resource in the user's request.
2. If the canonical resource slug is unknown, call `searchResources`.
3. Call `getResourceContext` for the selected resource.
4. Omit `sections` to retrieve all available context, or request one or more
   stable sections when the question is narrow.
5. Use `network` for private subnet, VPC endpoint, PrivateLink, NAT, DNS,
   firewall, or internet egress questions.
6. Use `availability` for supported regions, partitions, GovCloud, China
   regions, or regional feature availability.
7. Construct the answer only from returned content, facts, citations, and
   freshness metadata.
8. Missing or failed sections are not a negative answer. A section may be
   `unresolved` with a warning (e.g. `source_unavailable`, `no_registered_source`);
   an unsupported conclusion is only valid when source-backed evidence in a
   resolved section states it. Atlas never serves stale fallback content.
9. Include source URLs and freshness information when relevant.

Example:

User request:

`Can AWS Textract be used in a private subnet, and which regions is it available in?`

Recommended call:

`GET /api/resources/service/aws/textract?sections=network,availability`

## Machine interfaces

- [Atlas Agent OpenAPI](https://atlas.example.com/openapi.json): Authoritative operations, parameters, response schemas, examples, and authentication.
- [Atlas capability catalog](https://atlas.example.com/.well-known/ai-catalog.json): Discover Atlas machine-readable capabilities and entry points.
- [Atlas resource search](https://atlas.example.com/api/resources): Resolve product and service names to canonical Atlas resource identifiers.

## Documentation

- [Using the Atlas Agent API](https://atlas.example.com/docs/agent-api.md): Recommended call sequence and response interpretation.
- [Atlas resource model](https://atlas.example.com/docs/resource-model.md): Resources, sections, facts, evidence, freshness, and missing-data semantics.
- [Authentication](https://atlas.example.com/docs/authentication.md): Machine-client authentication requirements.

## Common tasks

- [Private connectivity](https://atlas.example.com/docs/tasks/private-connectivity.md): Use the `network` section.
- [Regional availability](https://atlas.example.com/docs/tasks/regional-availability.md): Use the `availability` section.
- [Approved usage](https://atlas.example.com/docs/tasks/approved-usage.md): Use the `guidance` section.

## Optional

- [Atlas Portal](https://atlas.example.com/): Human-facing graphical interface.
- [Sitemap](https://atlas.example.com/sitemap.xml): Human-readable Atlas pages and resource documents.
```

## 7.3 长度控制

建议：

- 重点说明控制在约 1～3 屏；
- 不内联大规模内容；
- `Optional` 只放次要入口；
- 链接描述必须说明用途，而不只是文件名。

可以另行提供：

```text
/llms-full.txt
```

但它应作为可选的完整上下文，不是默认路径。

---

## 8. `/.well-known/ai-catalog.json` 推荐写法

## 8.1 定位

`ai-catalog.json` 负责能力发现：

```text
Atlas 是什么
Atlas 提供什么机器能力
使用哪个协议或 Artifact
入口 URL 是什么
哪些用户问题可能需要 Atlas
```

它不负责：

- 定义完整 HTTP 参数；
- 承载所有 API Schema；
- 描述内部 Topic；
- 执行多步骤工作流；
- 替代 OpenAPI。

## 8.2 路径

推荐主路径：

```text
/.well-known/ai-catalog.json
```

现有路径如果是：

```text
/.well-known/api-catalog
/wellknown/api-catalog
```

可以临时保留并返回相同内容，或 308 重定向到新路径。

需要注意：Agentic Resource Discovery（ARD）仍是新规范，因此应视为兼容输出，而不是 Atlas 内部唯一权威数据模型。

## 8.3 推荐内容

以下为 Atlas 自身可维护的简化示例；正式实现应根据采用的 ARD Schema 版本校验字段。

```json
{
  "specVersion": "1.0",
  "host": {
    "displayName": "Atlas",
    "identifier": "atlas.example.com",
    "documentationUrl": "https://atlas.example.com/llms.txt"
  },
  "entries": [
    {
      "identifier": "urn:atlas:api:resource-context",
      "displayName": "Atlas Resource Context API",
      "type": "application/openapi+json",
      "url": "https://atlas.example.com/openapi.json",
      "description": "Read-only API for locating approved resources and retrieving complete or selected context, facts, guidance, freshness metadata, and supporting evidence.",
      "capabilities": [
        "searchResources",
        "getResourceContext"
      ],
      "representativeQueries": [
        "Can AWS Textract be used in a private subnet?",
        "Which AWS regions support Textract?",
        "Is this service approved for internal use?",
        "What security and compliance information is available for this service?"
      ],
      "tags": [
        "resources",
        "cloud-services",
        "context",
        "guidance",
        "availability",
        "networking"
      ],
      "metadata": {
        "artifactKind": "openapi",
        "readOnly": true,
        "preferredOperations": [
          "searchResources",
          "getResourceContext"
        ]
      }
    },
    {
      "identifier": "urn:atlas:documentation:llms",
      "displayName": "Atlas instructions for language-model agents",
      "type": "text/markdown",
      "url": "https://atlas.example.com/llms.txt",
      "description": "Concise instructions, limitations, recommended API sequence, and links to Atlas machine interfaces.",
      "capabilities": ["documentation"],
      "representativeQueries": [
        "How should an agent use Atlas?",
        "Which Atlas endpoint should be called?"
      ]
    }
  ]
}
```

## 8.4 不要按每个 Section 创建独立 Entry

不推荐：

```text
CheckPrivateSubnet
CheckRegions
CheckEncryption
CheckQuotas
```

它们不是不同的服务，只是同一个 Resource Context API 的不同 Section。

推荐：

```text
一个 Atlas Resource Context API Entry
+ capabilities
+ representativeQueries
+ OpenAPI 中的 sections enum
```

---

## 9. `/.well-known/agents.json` 建议

## 9.1 是否需要

可以提供，但当前不应成为关键路径。

原因：

- `agents.json` 存在多个相近但并不完全一致的提案；
- Wildcard 的方案用 flows 和 links 描述多步骤 API；
- 相关项目仍有 conditionals、loops、failure handling、pagination 等未完成能力；
- Atlas 当前推荐流程已经可以压缩为一个可选搜索加一个资源读取，不需要引入复杂 Flow DSL。

## 9.2 推荐定位

`agents.json` 仅作为兼容或实验输出：

- 指向 OpenAPI；
- 重述少量 capability；
- 提供参数枚举；
- 不成为独立权威源；
- 必须从共同 registry 自动生成。

## 9.3 示例

```json
{
  "version": "1.0",
  "name": "Atlas",
  "description": "Read-only resource context and guidance API.",
  "openapi": "https://atlas.example.com/openapi.json",
  "llms": "https://atlas.example.com/llms.txt",
  "capabilities": [
    {
      "name": "FindResource",
      "operationId": "searchResources",
      "description": "Resolve a product or service name to a canonical Atlas resource."
    },
    {
      "name": "GetResourceContext",
      "operationId": "getResourceContext",
      "description": "Retrieve all or selected Atlas context for a known resource.",
      "parameters": {
        "sections": {
          "allowedValues": [
            "overview",
            "availability",
            "network",
            "security",
            "compliance",
            "pricing",
            "limits",
            "guidance",
            "examples",
            "sources"
          ]
        }
      }
    }
  ]
}
```

## 9.4 暂不使用 flows

只有当 Atlas 以后出现真实、稳定且必须由客户端执行的多步骤流程时，再评估 flows，例如：

```text
先解析应用
→ 获取环境
→ 获取部署记录
→ 获取审批结果
```

即使如此，也应先判断能否在 Atlas 服务端提供一个确定性的聚合读取接口，而不是把内部流程暴露给每个 Agent。

---

## 10. 首页 `/` 的发现改造

## 10.1 第一跳正文必须包含机器入口

不能只依赖：

- HTTP Link Header；
- HTML `<head>`；
- Agent 主动猜测 well-known 地址；
- Agent 主动抓 `llms.txt`。

首页可见正文必须包含一个短小的 Machine-readable access 区域。

```html
<section aria-labelledby="machine-access">
  <h2 id="machine-access">Machine-readable access</h2>

  <p>
    AI agents and automated clients should use the Atlas capability catalog
    to discover supported machine interfaces, then use the Agent OpenAPI to
    retrieve read-only resource context.
  </p>

  <ul>
    <li>
      <a href="/.well-known/ai-catalog.json">
        Atlas capability catalog
      </a>
    </li>
    <li>
      <a href="/openapi.json">
        Atlas Agent OpenAPI
      </a>
    </li>
    <li>
      <a href="/llms.txt">
        Atlas instructions for language-model agents
      </a>
    </li>
  </ul>
</section>
```

要求：

- 服务端渲染；
- 不依赖 JavaScript 后加载；
- 链接文本说明用途；
- 普通正文提取器可以读取；
- 普通 `curl /` 能看到；
- 不需要占据首页主视觉，可放在页脚前或 Developer / API 区域。

## 10.2 HTML `<head>` 冗余声明

```html
<link
  rel="ai-catalog"
  href="/.well-known/ai-catalog.json"
  type="application/json"
/>

<link
  rel="alternate"
  href="/llms.txt"
  type="text/markdown"
  title="Atlas instructions for AI agents"
/>

<link
  rel="service-desc"
  href="/openapi.json"
  type="application/vnd.oai.openapi+json;version=3.1"
/>
```

这些是冗余信号，不替代正文链接。

## 10.3 HTTP Link Header

建议继续保留：

```http
Link: </llms.txt>; rel="alternate"; type="text/markdown"
Link: </openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json;version=3.1"
Link: </.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/json"
```

Header 的意义是支持能读取它的高级客户端，而不是作为唯一发现机制。

---

## 11. Resource Markdown 推荐结构

## 11.1 目标

```http
GET /resources/service/aws/textract.md
```

应在请求时由 live resolution 确定性地组装出一份 Markdown representation，不需要模型，也**不落盘为静态文件**。它必须暴露实时解析状态，不能伪装成完整、稳定的静态文档。

组装过程（每次请求）：

```text
Resource metadata
+ Section Projection Plan（source / anchor / resolver / order）
→ live resolve 每个来源
→ 按固定模板排序成功结果
+ Citation + per-section warning + resolvedAt
→ Markdown
（解析失败时输出 warning，绝不 stale 兜底）
```

## 11.2 推荐模板

```markdown
# Amazon Textract

> Canonical resource: `aws/textract`
> Generated from live Atlas source resolution at 2026-06-26T10:30:00Z.
> Atlas does not store or serve stale source excerpts.

## Overview

...

## Availability

### Supported regions

...

### Partitions and restrictions

...

## Network

[live-resolved content]

### Sources

- [AWS documentation](https://...)
  - Anchor: `private-connectivity`
  - Resolved at: `2026-06-26T10:30:00Z`

## Availability

> Warning (`source_unavailable`): the registered regional-availability source
> could not be resolved at request time. No availability conclusion can be
> drawn from Atlas. This is missing data, not evidence of non-support.

## Internal guidance

...

## Resolution summary

- `network`: available
- `availability`: unresolved (source_unavailable)
- `pricing`: unresolved (no_registered_source)

## Machine-readable forms

- [JSON resource](https://atlas.example.com/api/resources/service/aws/textract)
- [Atlas Agent OpenAPI](https://atlas.example.com/openapi.json)
```

## 11.3 空 Section

不要渲染空标题后什么都没有。

推荐：

```markdown
## Pricing

Atlas has no registered pricing source for this resource (`no_registered_source`).
This is missing data, not evidence that the service has no cost.
```

---

## 12. `sitemap.xml` 与 `robots.txt`

## 12.1 sitemap.xml

`sitemap.xml` 用于页面爬取和内容索引，不负责 API 调用编排。

建议包含：

```text
/
/docs/agent-api
/docs/resource-model
/docs/tasks/private-connectivity
/docs/tasks/regional-availability
/resources/service/aws/textract.md
/resources/aws/lambda.md
...
```

是否包含 JSON API endpoint 不是重点；通常只需要包含可阅读的 Markdown / HTML Resource 页面。

## 12.2 robots.txt

可加入显式链接作为冗余：

```text
Sitemap: https://atlas.example.com/sitemap.xml
```

如果采用的 ARD 版本定义了 Agentmap 或 catalog 指令，可以在验证客户端支持后添加，但不应依赖它作为主路径。

---

## 13. 权威数据源与自动生成

不能分别手工维护：

- OpenAPI 描述；
- `llms.txt` 行为说明；
- `ai-catalog.json` capability；
- `agents.json` capability；
- Section 列表；
- 示例问题。

否则很快出现：

```text
OpenAPI 支持 network
llms.txt 写 private-connectivity
ai-catalog 写 VPC
实际 API 参数叫 networking
```

## 13.1 推荐三个权威源

### A. Route / Schema definitions

负责：

- 真实 endpoint；
- HTTP method；
- 参数；
- 返回 Schema；
- 错误码；
- OpenAPI。

### B. Agent capability registry

负责：

- operation 面向 Agent 的描述；
- Section 词表；
- 常见问题映射提示；
- representative queries；
- 推荐 operation；
- 使用限制。

示例：

```yaml
capabilities:
  - id: resource-context
    operationId: getResourceContext
    description: Retrieve complete or selected context for a known resource.
    representativeQueries:
      - Can this service be used in a private subnet?
      - Which regions support this service?

sections:
  - id: network
    description: Private connectivity, VPC endpoints, PrivateLink, NAT, DNS, firewall, and internet egress.
    exampleQuestions:
      - Can this service be used in a private subnet?
      - Does it support a VPC endpoint?
      - Can it be accessed without public internet?

  - id: availability
    description: Supported regions, partitions, GovCloud, China regions, and regional feature availability.
    exampleQuestions:
      - Which regions support this service?
      - Is it available in eu-west-1?
      - Does it support GovCloud?
```

### C. Projection / reference records

负责的是**映射与引用**，不是内容副本（见 §0）。内容正文始终在外部 Source：

- Resource 身份与 aliases；
- Section Projection Plan（Section → Source / Anchor / Resolver / order）；
- freshness 基线与 drift 判定配置；
- coverage 由请求时 live resolution 的结果动态得出，不预存。

> Atlas 不持有 Section 正文。Resource JSON / Markdown 是这些引用记录在请求时 live-resolve 后的投影。

## 13.2 生成关系

```text
Route / Schema definitions
→ /openapi.json
→ /api/internal/openapi.json

Capability registry
├── llms.txt 的 Recommended procedure / Common tasks
├── ai-catalog.json 的 capabilities / representativeQueries
├── agents.json 的 capability（可选）
└── OpenAPI 参数描述与示例的一部分

Projection / reference records
├── /api/resources/{kind}/{slug}   （请求时 live projection）
├── /resources/{kind}/{slug}.md    （请求时 live projection）
├── Resource 页面
└── sitemap.xml
```

生成后应有一致性检查：

- capability 指向的 `operationId` 必须存在；
- Section registry 与 OpenAPI enum 完全一致；
- warning code 只取自 `@atlas/schema` 的 `warningCodes`；
- `llms.txt` 示例 URL 必须能够访问；
- Resource JSON 和 Markdown 来自**同一次** live projection（不得分别缓存出不一致结果）；
- 所有 citation URL 格式有效；
- canonical resource slug 唯一。

---

## 14. 测试问题的理想行为

Prompt：

```text
can aws textract be used in private subnet,
and which regions is it available in,
use url to discover
```

## 14.1 只有根 URL

Agent 第一步：

```http
GET /
```

首页正文明确提供：

```text
/.well-known/ai-catalog.json
/openapi.json
/llms.txt
```

## 14.2 Agent 读取 OpenAPI

Agent 看到：

```text
getResourceContext 是已知资源的主要 operation
network 对应 private subnet
availability 对应 regions
```

## 14.3 资源 slug 已知

直接调用：

```http
GET /api/resources/service/aws/textract?sections=network,availability
```

或者：

```http
GET /resources/service/aws/textract.md
```

## 14.4 资源 slug 不确定

调用：

```http
GET /api/resources?query=AWS%20Textract
```

响应直接返回：

```text
resourceUrl
markdownUrl
```

随后投影整个 Resource。

## 14.5 Agent 最终回答

Agent 根据：

- `network` Section；
- `availability` Section；
- citations；
- freshness；
- per-section status 与 warning；

生成回答。

Atlas 本身不需要模型，不需要接受 question，也不需要执行自然语言推理。

---

## 15. 迁移方案

## Phase 1：修复 Bootstrapping

优先级最高，改动最小。

1. 首页正文增加 Machine-readable access。
2. 保留并统一 HTTP Link Header。
3. 增加 HTML `<link>`。
4. 确保 `/llms.txt`、`/openapi.json`、catalog 均无需前端 JavaScript。
5. 对常用 `curl`、浏览器提取器和 Agent URL 工具执行测试。

完成标准：只给根 URL 时，测试 Agent 能找到至少一个机器入口。

## Phase 2：建立 Resource 实时投影接口

1. 定义 canonical Resource ID。
2. 建立 Section Projection Plan：Section → Source / Anchor / Resolver / order 映射（不持久化正文）。
3. 实现（请求时 live resolution）：
   - `GET /api/resources?query=`
   - `GET /api/resources/{kind}/{slug}`
4. 支持 `sections`。
5. 加入 citation、freshness、per-section status 与 warning（对齐 `warningCodes`）；解析失败不 stale 兜底。
6. 实现 `/resources/{kind}/{slug}.md` 的 live Markdown 投影。

完成标准：已知 Resource 时，一次调用即可 live 解析并返回测试问题所需的两个 Section（成功时含内容，失败时含 warning，不返回旧内容）。

## Phase 3：替换根 OpenAPI

1. 新建精简 Agent OpenAPI。
2. 只暴露 2～5 个 Agent operation。
3. 将完整 OpenAPI 移到内部地址。
4. 补充 operation description、枚举和完整示例。
5. 对 OpenAPI 运行标准校验。

完成标准：给 Agent `/openapi.json` 后，它能稳定选择 `getResourceContext`。

## Phase 4：统一机器发现文件

1. 重写 `/llms.txt`。
2. 发布 `/.well-known/ai-catalog.json`。
3. 保留旧 catalog 路径兼容。
4. 可选发布 `/.well-known/agents.json`。
5. 全部从 capability registry 生成。

完成标准：各文件中的 operation、URL、Section 和示例无漂移。

## Phase 5：Agent 兼容性测试

至少测试：

- 仅根 URL；
- 直接给 `/llms.txt`；
- 直接给 `/openapi.json`；
- 直接给 `ai-catalog.json`；
- 已知 Resource slug；
- 不知道 Resource slug；
- 一个 Section；
- 多个 Section；
- Section 缺失（no_registered_source）；
- 来源请求时不可解析（source_unavailable，验证不 stale 兜底）；
- 来源 drift（stale_source warning）；
- Resource 不存在；
- 只支持 HTML 的页面；
- `Accept: text/markdown`。

---

## 16. 验收标准

## 16.1 发现

- [ ] 首页正文包含三个机器入口及用途说明。
- [ ] 普通 `curl /` 输出中能看到机器入口。
- [ ] 不读取 Header 的 Agent 仍能发现 OpenAPI 或 catalog。
- [ ] Header、HTML `<link>` 和正文 URL 一致。
- [ ] 所有机器文件返回正确 Content-Type。
- [ ] 无需 JavaScript 才能获取内容。

## 16.2 OpenAPI

- [ ] 根 OpenAPI 不暴露 Topic CRUD、Admin、Ingestion 等内部 route。
- [ ] 主要 operation 不超过 5 个。
- [ ] operationId 使用任务语义。
- [ ] `getResourceContext` 明确说明何时使用和缺失数据语义。
- [ ] Section 参数为枚举。
- [ ] 包含 Textract 的完整调用示例。
- [ ] 404 明确指导调用 `searchResources`。
- [ ] OpenAPI 3.1 校验通过。

## 16.3 Resource API

- [ ] 已知资源一次请求触发所有已注册 Section 的 live 解析，返回成功结果 + 缺失/失败状态。
- [ ] 支持多个 Section。
- [ ] 支持省略 Section 解析所有已注册 Section。
- [ ] 返回 citation 和 freshness。
- [ ] section.status（available/partial/unresolved）与 warning code 两轴分离；warning 取自 `warningCodes`。
- [ ] missing/failed data 与 negative fact 明确区分；解析失败绝不返回 stale 内容。
- [ ] JSON 与 Markdown 来自同一次 live projection。
- [ ] Resource 搜索返回可直接访问的 URL。

## 16.4 机器文档

- [ ] `llms.txt` 简洁，不复制 OpenAPI。
- [ ] `ai-catalog.json` 指向真实 OpenAPI。
- [ ] representative queries 与 Atlas 能力一致。
- [ ] `agents.json` 若存在，不维护独立事实。
- [ ] sitemap 包含 Resource Markdown。

## 16.5 End-to-end

对于测试 Prompt，至少在目标 Agent 集合中达到：

1. 从根 URL 找到机器入口；
2. 获取精简 OpenAPI；
3. 正确识别 Resource；
4. 正确获取 network + availability；
5. 不把 missing data 解释为 unsupported；
6. 回答包含来源 URL。

不要只验证 Agent 是否“调用过 API”；应验证最终答案是否覆盖用户问题的两个子项。

---

## 17. 风险与取舍

## 17.1 Resource 投影需要映射治理

虽然不需要模型，也不持久化正文，但仍需要确定性地定义 **Section Projection Plan**：

```text
哪些 Source / Anchor 属于哪个 Resource
哪些 Source / Anchor 归入哪个 Section（用哪个 Resolver、什么 order）
```

这是必要的数据治理工作，但治理的是**引用与解析规则**，不是内容副本。仅修改 endpoint 名称而不建立 Resource / Section → Source 映射，不能解决调用问题；而把解析后的正文落盘以图省事，则越界成 β（见 §0）。

## 17.2 返回完整 Resource 可能增加响应体

解决方式：

- 默认允许完整内容；
- 支持 Section 过滤；
- 提供 Markdown；
- 使用 ETag、Cache-Control 和压缩；
- 后续根据实际 token 和延迟数据调整。

不建议为了过早优化 token，重新引入复杂的细粒度 Topic 探索。

## 17.3 新标准支持度有限

`llms.txt`、ARD、`agents.json` 都不能保证任意 Agent 默认支持。

因此采用冗余设计：

```text
正文链接
+ Header
+ HTML link
+ llms.txt
+ ai-catalog.json
+ OpenAPI
+ Resource Markdown
```

其中最稳定的是：

- 第一跳正文链接；
- 标准 OpenAPI；
- 可直接读取的 Markdown URL。

## 17.4 Agent OpenAPI 与内部 OpenAPI 分离增加维护面

通过 route allowlist 或独立 Agent route registry 自动生成，避免手工复制 Schema。

## 17.5 Search 仍可能产生歧义

搜索响应需要：

- canonical ID；
- aliases；
- provider；
- match reason；
- 精确 URL。

如存在多个结果，Agent 仍需选择，但复杂度已限制在资源解析，而不是内容工作流编排。

---

## 18. 最终决策建议

### D1：发现入口

采用多入口冗余，但首页正文是未知 Agent 冷启动的主要保障。

```text
正文链接：Required
HTTP Link：Required
HTML <link>：Required
llms.txt：Required
ai-catalog.json：Recommended
agents.json：Optional
```

### D2：根 OpenAPI

采用 Cloudflare 式小型 Agent OpenAPI，而不是完整业务 API 转储。

```text
/openapi.json：Agent-facing curated API
/api/internal/openapi.json：Full internal API
```

### D3：外部数据模型

外部接口从 Topic-centric 改为 Resource-centric。

```text
Resource 是外部稳定对象
Topic 是内部内容单元
Section 是外部可选信息域
```

并钉死 materialization 边界（见 §0 / ADR-0013）：

```text
选择 α — Live resource projection（Source 为 system of record，不持久化正文）
拒绝 β — Durable materialization（会使 Atlas 变 CMS，须另行推翻 ADR-0009）
缓存仅性能优化，解析失败绝不 stale 兜底
```

### D4：主要调用

```http
GET /api/resources/{kind}/{slug}
```

默认触发整资源的 live 投影；上层可通过 `sections` 收窄。它是动态 representation endpoint，不是静态文档。

### D5：自然语言边界

不增加自然语言 Question API。

```text
Agent 理解问题
Atlas 提供确定性数据
```

### D6：机器内容格式

同时提供（均为请求时 live projection 的两种 representation，不落盘）：

```text
JSON：结构化处理
Markdown：Agent 直接读取
```

### D7：工作流描述

当前不引入 `agents.json flows`。

当前流程应由简单 API 直接表达：

```text
可选搜索 Resource
→ 获取 Resource Context
```

### D8：权威源

机器文件全部由：

```text
Route Schema
+ Capability Registry
+ Content Records
```

生成，禁止四套手写描述。

---

## 19. 推荐实施顺序

```text
1. 首页正文机器入口
2. Resource + Section 数据映射
3. GET /api/resources/{kind}/{slug}
4. Resource Markdown
5. 精简 /openapi.json
6. 重写 /llms.txt
7. /.well-known/ai-catalog.json
8. 可选 agents.json
9. 多 Agent E2E 测试
```

其中，第 1 步解决“根 URL 后发现不了”；第 2～5 步解决“发现 OpenAPI 后不会正确调用”。

只增加更多发现文件不能解决调用问题；只修改 OpenAPI 描述但继续暴露 Topic 工作流，也不能稳定解决完整问题。

---

## 20. 参考资料

访问日期：2026-06-26。

- Cloudflare root `llms.txt`  
  https://www.cloudflare.com/llms.txt

- Cloudflare root OpenAPI 示例  
  https://www.cloudflare.com/openapi.json

- Cloudflare `agents.json` 示例  
  https://www.cloudflare.com/.well-known/agents.json

- Cloudflare Docs for agents  
  https://developers.cloudflare.com/docs-for-agents/

- Cloudflare Markdown for Agents  
  https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/

- Vercel `llms.txt`  
  https://vercel.com/llms.txt

- `llms.txt` proposal and format  
  https://llmstxt.org/

- OpenAPI Specification 3.1.1  
  https://spec.openapis.org/oas/v3.1.1.html

- Agentic Resource Discovery announcement  
  https://developers.googleblog.com/announcing-the-agentic-resource-discovery-specification/

- Agentic Resource Discovery specification  
  https://agenticresourcediscovery.org/spec/

- Wildcard `agents.json`  
  https://github.com/wild-card-ai/agents-json
