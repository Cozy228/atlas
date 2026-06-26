# 1. 检查项

Cloudflare 官方把检查分成 5 类：Discoverability、Content Accessibility、Bot Access Control、Protocol Discovery、Commerce。站点页面也列出了当前可自定义检查项：`robots.txt`、Sitemap、Link headers、Markdown negotiation、AI bot rules、Content Signals、Web Bot Auth、API Catalog、OAuth discovery、OAuth Protected Resource、MCP Server Card、A2A Agent Card、Agent Skills、WebMCP、x402、MPP、UCP、ACP。([Is Your Site Agent-Ready?][1])

## A. 必做：Agent 能发现你

| 检查项          | 路径/机制                   | 做什么                                       | 对你的 DevEx Portal 价值                          |
| ------------ | ----------------------- | ----------------------------------------- | -------------------------------------------- |
| `robots.txt` | `/robots.txt`           | 明确哪些路径允许 crawler / agent 访问               | 基础入口                                         |
| Sitemap      | `/sitemap.xml`          | 列出 canonical URLs                         | 让 agent 找到 docs、capability catalog、health 页面 |
| Link headers | 首页 HTTP response header | 不解析 HTML，也能发现 API catalog、docs、skills、MCP | 很适合 portal                                   |
| `llms.txt`   | `/llms.txt`             | 给 LLM 的文档索引                               | scanner 默认不一定检查，但实际很有用                       |

Cloudflare 博文明确说 Discoverability 包括 `robots.txt`、`sitemap.xml` 和 Link response headers；`Link` header 的价值是 agent 不必解析 HTML 就能发现相关资源。([The Cloudflare Blog][2])

---

## B. 必做：Agent 能低成本读取内容

| 检查项                  | 路径/机制                               | 做什么                                    | 验收                            |
| -------------------- | ----------------------------------- | -------------------------------------- | ----------------------------- |
| Markdown negotiation | `Accept: text/markdown`             | 同一个页面，浏览器拿 HTML，agent 拿 Markdown       | `Content-Type: text/markdown` |
| `/index.md` fallback | `/docs/foo/index.md`                | 给不会发 `Accept` header 的 agent 一个 URL 兜底 | 返回 Markdown                   |
| `llms-full.txt`      | `/llms-full.txt`                    | 全量文档，适合 indexing / embedding           | 可选                            |
| scoped `llms.txt`    | `/aws/llms.txt`、`/sources/llms.txt` | 大站不要一个巨型文件                             | 推荐                            |

Cloudflare 的做法是：每个页面都可以通过 `/index.md` 获取 Markdown，同时 root `llms.txt` 指向各产品目录的 scoped `llms.txt`，避免单个文件过大导致 agent 进入 grep loop。([The Cloudflare Blog][2])

---

## C. 必做：Agent / Bot 访问控制

| 检查项             | 路径/机制                                            | 做什么                                       | 你的策略                                                     |
| --------------- | ------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------- |
| AI bot rules    | `/robots.txt`                                    | 针对 GPTBot、Claude-Web 等显式 allow / disallow | public docs 可 allow；internal/private 禁止或走 auth           |
| Content Signals | `/robots.txt`                                    | 声明 `ai-train`、`search`、`ai-input`         | 企业内 portal 通常 `ai-train=no, search=no/yes, ai-input=yes` |
| Web Bot Auth    | `/.well-known/http-message-signatures-directory` | bot 用签名证明身份                               | 先不做，除非你们自己也提供 outbound agent/bot                         |

Content Signals 允许细分内容用途：是否用于训练、搜索、AI inference/grounding。Cloudflare 例子是 `Content-Signal: ai-train=no, search=yes, ai-input=yes`。([The Cloudflare Blog][2])

---

## D. Portal / API 型项目强相关

| 检查项                      | 路径                                                                              | 做什么                                             | 你的项目里怎么理解                                 |
| ------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| API Catalog              | `/.well-known/api-catalog`                                                      | 统一暴露 API spec、docs、status                       | Agent 不用 scrape portal UI                 |
| OpenAPI                  | `/openapi.json`                                                                 | 机器可读 API 合约                                     | Hono / Spring 都应生成                        |
| OAuth discovery          | `/.well-known/oauth-authorization-server` 或 `/.well-known/openid-configuration` | 发现认证服务器                                         | 如果你们用 Entra ID / Cloudflare Access，需要准确暴露 |
| OAuth Protected Resource | `/.well-known/oauth-protected-resource`                                         | 告诉 agent 某资源需要哪些 authorization servers / scopes | 对 internal portal 很重要                     |
| MCP Server Card          | `/.well-known/mcp/server-card.json`                                             | 描述 MCP server tools、transport、auth              | 有 MCP endpoint 才做                         |
| Agent Skills index       | `/.well-known/agent-skills/index.json`                                          | 让 agent 发现 task-specific instructions           | 你应该做                                      |
| WebMCP                   | browser `navigator.modelContext`                                                | 页面内暴露 JS tools 给浏览器 agent                       | V1 不建议，太前沿                                |
| A2A Agent Card           | `/.well-known/agent.json` 一类路径                                                  | Agent-to-Agent 能力发现                             | 先观察，不放 V1                                 |

Cloudflare 对 API Catalog 的解释是：如果服务有 public APIs，`/.well-known/api-catalog` 可以列出 API、spec、docs、status endpoint，避免 agent scrape developer portal。MCP Server Card 则是在 agent 连接 MCP server 前描述 tools、transport 和 auth。([The Cloudflare Blog][2])

---

## E. Commerce：你的 DevEx Portal 暂时不用

| 检查项  | 说明                          | 你的项目建议 |
| ---- | --------------------------- | ------ |
| x402 | HTTP 402 machine payment    | 不做     |
| MPP  | Machine Payment Protocol    | 不做     |
| UCP  | Universal Commerce Protocol | 不做     |
| ACP  | Agentic Commerce Protocol   | 不做     |

除非你的 portal 未来支持内部 chargeback / quota purchase / paid API access，否则 commerce 不该进 V1。

---

# 2. 如何检查

## 手动检查

```bash
BASE="https://portal.example.com"

# 1. robots.txt
curl -i "$BASE/robots.txt"

# 2. sitemap
curl -i "$BASE/sitemap.xml"

# 3. 首页 Link headers
curl -I "$BASE/" | grep -i '^link:'

# 4. Markdown negotiation
curl -i "$BASE/docs/getting-started" \
  -H "Accept: text/markdown"

# 5. Markdown fallback
curl -i "$BASE/docs/getting-started/index.md"

# 6. llms.txt
curl -i "$BASE/llms.txt"

# 7. API Catalog
curl -i "$BASE/.well-known/api-catalog" \
  -H "Accept: application/linkset+json, application/json"

# 8. OAuth discovery
curl -i "$BASE/.well-known/oauth-authorization-server"
curl -i "$BASE/.well-known/openid-configuration"

# 9. OAuth Protected Resource
curl -i "$BASE/.well-known/oauth-protected-resource"

# 10. MCP Server Card
curl -i "$BASE/.well-known/mcp/server-card.json"

# 11. Agent Skills index
curl -i "$BASE/.well-known/agent-skills/index.json"

# 12. Web Bot Auth
curl -i "$BASE/.well-known/http-message-signatures-directory"
```

---

## CI smoke test

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE_URL:?BASE_URL is required}"

check_200() {
  local path="$1"
  echo "checking $path"
  curl -fsS -o /dev/null "$BASE$path"
}

check_header() {
  local path="$1"
  local header="$2"
  local expected="$3"
  echo "checking $path with $header"
  curl -fsSI "$BASE$path" -H "$header" | grep -i "$expected"
}

check_200 "/robots.txt"
check_200 "/sitemap.xml"
check_200 "/llms.txt"
check_200 "/.well-known/agent-skills/index.json"

curl -fsSI "$BASE/" | grep -i '^link:'

curl -fsSI "$BASE/.well-known/api-catalog" \
  -H "Accept: application/linkset+json, application/json" \
  | grep -Ei 'content-type:.*(application/linkset\+json|application/json)'

curl -fsSI "$BASE/docs/getting-started" \
  -H "Accept: text/markdown" \
  | grep -i 'content-type: text/markdown'
```

---

## Cloudflare scanner/API 检查

Cloudflare 博文说，URL Scanner API 已经支持 Agent Readiness，只要传 `options.agentReadiness=true`。([The Cloudflare Blog][2])

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/urlscanner/v2/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d '{
    "url": "https://portal.example.com",
    "options": {
      "agentReadiness": true
    }
  }'
```

此外，Cloudflare 博文说 `isitagentready.com` 自己暴露了一个 MCP server，路径是 `/.well-known/mcp.json`，有 `scan_site` tool；也发布了 Agent Skills index。这个适合未来接到 Claude Code / OpenCode / Cursor 里做自动扫描。([The Cloudflare Blog][2])

---

# 3. 如何把相关 prompt / skill 拿过来

有 3 条路。

## 路径 A：UI 直接复制

1. 打开 `isitagentready.com`
2. 输入你的站点
3. 展开失败项
4. 点每个失败项的 `Copy prompt`
5. 或者点 `Improve the score` / `Copy all instructions`

站点页面明确写了：`How to improve your score` 下方可以复制 instructions，粘贴到 Cursor、Claude Code、Windsurf、Copilot 等 coding agent。([Is Your Site Agent-Ready?][1])

---

## 路径 B：从 Skill URL 模式拿

公开 GitHub issue 里能看到 scanner 生成的修复项，每个都有 `Skill:` URL。例如：

| 检查项                      | Skill URL slug                       |
| ------------------------ | ------------------------------------ |
| Sitemap                  | `/sitemap/SKILL.md`                  |
| Link headers             | `/link-headers/SKILL.md`             |
| Markdown negotiation     | `/markdown-negotiation/SKILL.md`     |
| Content Signals          | `/content-signals/SKILL.md`          |
| API Catalog              | `/api-catalog/SKILL.md`              |
| OAuth discovery          | `/oauth-discovery/SKILL.md`          |
| OAuth Protected Resource | `/oauth-protected-resource/SKILL.md` |
| MCP Server Card          | `/mcp-server-card/SKILL.md`          |
| Agent Skills             | `/agent-skills/SKILL.md`             |
| WebMCP                   | `/webmcp/SKILL.md`                   |

这个 issue 里还列了每项的 Goal / Issue / Fix / Docs，是可以直接转成 coding-agent prompt 的结构。([GitHub][3])

实际路径形式：

```txt
https://isitagentready.com/.well-known/agent-skills/markdown-negotiation/SKILL.md
https://isitagentready.com/.well-known/agent-skills/api-catalog/SKILL.md
https://isitagentready.com/.well-known/agent-skills/agent-skills/SKILL.md
```

---

## 路径 C：自己发布一套项目内 Skills

Cloudflare 的 Agent Skills Discovery RFC v0.2.0 要求发布：

```txt
/.well-known/agent-skills/index.json
/.well-known/agent-skills/{skill-name}/SKILL.md
```

`index.json` 必须包含 `$schema` 和 `skills[]`；每个 skill entry 要有 `name`、`type`、`description`、`url`、`digest`。`SKILL.md` 必须有 YAML frontmatter，至少包括 `name` 和 `description`。([GitHub][4])

这就是你项目里应该实现的方式：**不是只拿 Cloudflare 的 prompt，而是把你们自己的 portal 操作规范也变成可发现 Skill**。

---

# 4. 如何在你的项目里实现

假设你的项目是 DevEx Portal，可能是：

* 前端：React / TanStack / shadcn
* BFF：Hono / Node
* 后端：Java / Spring Boot 或平台 API
* 认证：Entra ID / Cloudflare Access / 企业 SSO
* 核心功能：source intake、source health、capability catalog、docs discovery、review flow

我建议这么拆。

---

## 4.1 文件结构

```txt
public/
  robots.txt
  sitemap.xml
  llms.txt
  llms-full.txt
  .well-known/
    api-catalog
    oauth-protected-resource
    agent-skills/
      index.json
      devex-source-intake/
        SKILL.md
      devex-source-health/
        SKILL.md
      devex-agent-readiness/
        SKILL.md
    mcp/
      server-card.json

src/
  routes/
    markdown.ts
    openapi.ts
    mcp.ts
  docs/
    getting-started.md
    source-intake.md
    source-health.md
```

---

## 4.2 `robots.txt`

企业 internal portal 不能照抄 public docs。建议：

```txt
User-agent: *
Allow: /docs/
Allow: /capabilities/
Allow: /llms.txt
Allow: /.well-known/
Disallow: /admin/
Disallow: /api/
Disallow: /source-intake/
Disallow: /review/
Disallow: /health/internal/

Content-Signal: ai-train=no, search=no, ai-input=yes

Sitemap: https://portal.example.com/sitemap.xml
```

解释：

* `ai-train=no`：不要训练。
* `search=no`：internal portal 通常不应该被外部搜索索引。
* `ai-input=yes`：允许被用户授权的 agent 用作任务上下文。
* `Disallow` 不是安全边界，private API 仍然必须鉴权。

---

## 4.3 首页 `Link` headers

BFF 或 edge middleware 加：

```http
Link: </llms.txt>; rel="service-doc"; type="text/plain"
Link: </.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"
Link: </.well-known/agent-skills/index.json>; rel="service-desc"; type="application/json"
Link: </.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"
Link: </sitemap.xml>; rel="sitemap"; type="application/xml"
```

Hono 示例：

```ts
app.use("*", async (c, next) => {
  await next();

  if (new URL(c.req.url).pathname === "/") {
    c.header("Link", [
      '</llms.txt>; rel="service-doc"; type="text/plain"',
      '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
      '</.well-known/agent-skills/index.json>; rel="service-desc"; type="application/json"',
      '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
      '</sitemap.xml>; rel="sitemap"; type="application/xml"',
    ].join(", "));
  }
});
```

---

## 4.4 Markdown negotiation

不要把整个 React admin UI 转 Markdown。应该只对这些页面支持：

* `/docs/*`
* `/capabilities/*`
* `/runbooks/*`
* `/source-health/public-summary/*`
* `/api-docs/*`

Hono 示例：

```ts
app.get("/docs/:slug", async (c) => {
  const slug = c.req.param("slug");
  const accept = c.req.header("accept") ?? "";

  const doc = await loadDoc(slug); // { html, markdown, tokenCount }

  if (accept.includes("text/markdown")) {
    return new Response(doc.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Vary": "Accept",
        "x-markdown-tokens": String(doc.tokenCount),
      },
    });
  }

  return c.html(renderDocPage(doc.html));
});

app.get("/docs/:slug/index.md", async (c) => {
  const slug = c.req.param("slug");
  const doc = await loadDoc(slug);

  return new Response(doc.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "x-markdown-tokens": String(doc.tokenCount),
    },
  });
});
```

Cloudflare Docs 也提供三种 Markdown 获取方式：页面复制、追加 `/index.md`、或者发送 `Accept: text/markdown` header；响应里还可以带 `x-markdown-tokens`。([Cloudflare Docs][5])

---

## 4.5 `llms.txt`

Root 只做索引，不塞全量内容。

```txt
# DevEx Portal

> Internal developer experience portal for platform capabilities, source intake, source health, and operational runbooks.

## Core documentation

- [Getting Started](https://portal.example.com/docs/getting-started/index.md): Start here to understand the portal, supported workflows, and access model.
- [Source Intake](https://portal.example.com/docs/source-intake/index.md): How to onboard a new source into the portal.
- [Source Health](https://portal.example.com/docs/source-health/index.md): How to interpret source freshness, ownership, documentation quality, and API readiness.
- [Capability Catalog](https://portal.example.com/docs/capability-catalog/index.md): Platform capabilities available to application teams.
- [Agent Skills](https://portal.example.com/.well-known/agent-skills/index.json): Machine-readable task instructions for AI agents.

## API

- [API Catalog](https://portal.example.com/.well-known/api-catalog): Discover OpenAPI specs, docs, and health endpoints.
- [OpenAPI](https://portal.example.com/openapi.json): Machine-readable API contract.
```

---

## 4.6 API Catalog

```json
{
  "linkset": [
    {
      "anchor": "https://portal.example.com/api",
      "service-desc": [
        {
          "href": "https://portal.example.com/openapi.json",
          "type": "application/vnd.oai.openapi+json"
        }
      ],
      "service-doc": [
        {
          "href": "https://portal.example.com/docs/api/index.md",
          "type": "text/markdown"
        }
      ],
      "status": [
        {
          "href": "https://portal.example.com/api/health",
          "type": "application/json"
        }
      ]
    }
  ]
}
```

HTTP header：

```http
Content-Type: application/linkset+json
Cache-Control: public, max-age=300
```

---

## 4.7 OAuth Protected Resource

如果你们 portal/API 是 SSO 后访问，建议至少发布 protected resource metadata：

```json
{
  "resource": "https://portal.example.com",
  "authorization_servers": [
    "https://login.microsoftonline.com/{tenant-id}/v2.0"
  ],
  "scopes_supported": [
    "openid",
    "profile",
    "email",
    "api://devex-portal/source.read",
    "api://devex-portal/source.write",
    "api://devex-portal/health.read"
  ],
  "bearer_methods_supported": [
    "header"
  ],
  "resource_documentation": "https://portal.example.com/docs/auth/index.md"
}
```

注意：这个 metadata 不能伪造。如果你们没有真实 OAuth scope，就先别写 scope，避免 agent 以为可以自动授权。

---

## 4.8 MCP Server Card

只有你真有 MCP endpoint 才发布。比如 V1 只暴露 read-only tools：

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
  "version": "1.0",
  "protocolVersion": "2025-06-18",
  "serverInfo": {
    "name": "devex-portal-mcp",
    "title": "DevEx Portal MCP Server",
    "version": "0.1.0"
  },
  "description": "Search DevEx documentation, inspect source health, and discover platform capabilities.",
  "transport": {
    "type": "streamable-http",
    "endpoint": "https://portal.example.com/mcp"
  },
  "authentication": {
    "required": true,
    "schemes": ["oauth2"]
  },
  "tools": [
    {
      "name": "search_docs",
      "title": "Search documentation",
      "description": "Search DevEx Portal documentation and runbooks.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string" }
        },
        "required": ["query"]
      }
    },
    {
      "name": "get_source_health",
      "title": "Get source health",
      "description": "Return source readiness, freshness, owner, docs, and API metadata.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "sourceId": { "type": "string" }
        },
        "required": ["sourceId"]
      }
    }
  ]
}
```

V1 不建议让 MCP 直接 mutate，比如创建 source、approve review、改 owner。先 read-only，写操作走 portal form + human confirmation。

---

# 5. 直接产出一个 Skill

放到：

```txt
public/.well-known/agent-skills/devex-agent-readiness/SKILL.md
```

内容：

````md
---
name: devex-agent-readiness
description: Audit and improve a DevEx Portal so AI agents can discover documentation, read Markdown, understand API/auth metadata, and safely use published agent skills. Use when implementing or reviewing agent-readiness standards for an internal developer portal.
---

# DevEx Agent Readiness

Use this skill when working on a DevEx Portal, internal developer platform, platform capability catalog, source intake workflow, source health dashboard, or documentation portal that should be usable by AI agents.

The goal is not to maximize a vanity score. The goal is to make the portal safe and useful for agents by exposing stable discovery metadata, Markdown documentation, API contracts, authentication metadata, and task-specific skills.

## Definitions

- Agent: An AI tool that can browse pages, read documentation, call APIs, or use tools on behalf of a user.
- DevEx Portal: A developer-facing internal portal for documentation, platform capabilities, source intake, health checks, reviews, and operational workflows.
- Markdown negotiation: Returning Markdown when the request has `Accept: text/markdown`, while keeping HTML as the default for browsers.
- Well-known endpoint: A predictable path under `/.well-known/` used for machine discovery.
- Skill: A task-specific instruction file that an agent can load only when relevant.

## First principles

1. Prefer machine-readable metadata over UI scraping.
2. Prefer Markdown documentation over HTML for agent reading.
3. Prefer read-only agent operations before write operations.
4. Never treat `robots.txt` as an access-control boundary.
5. Do not publish fake metadata. Only advertise APIs, scopes, MCP tools, or skills that actually exist.
6. Keep public discovery documents free of secrets, internal tokens, private hostnames, and sensitive environment details.
7. Internal/private content must still require authentication and authorization.
8. Agent readiness should improve user workflows, not bypass governance.

## Required checks

Audit the following items.

### 1. robots.txt

Check:

```bash
curl -i "$BASE_URL/robots.txt"
````

Required:

* Returns HTTP 200.
* Uses `Content-Type: text/plain`.
* Contains `User-agent` rules.
* References sitemap with `Sitemap:`.
* Contains explicit AI usage policy when applicable.

Recommended internal portal example:

```txt
User-agent: *
Allow: /docs/
Allow: /capabilities/
Allow: /llms.txt
Allow: /.well-known/
Disallow: /admin/
Disallow: /api/
Disallow: /source-intake/
Disallow: /review/
Disallow: /health/internal/

Content-Signal: ai-train=no, search=no, ai-input=yes

Sitemap: https://portal.example.com/sitemap.xml
```

Do not expose sensitive private paths in `robots.txt` if their names themselves reveal confidential information.

### 2. sitemap.xml

Check:

```bash
curl -i "$BASE_URL/sitemap.xml"
```

Required:

* Returns HTTP 200.
* Uses XML sitemap format.
* Lists canonical documentation and portal information pages.
* Excludes private transactional pages such as source creation forms, review approval pages, and admin views.

Include:

* `/docs/*`
* `/capabilities/*`
* `/runbooks/*`
* public source health summary pages if allowed

Exclude:

* `/api/*`
* `/admin/*`
* `/review/*`
* authenticated mutation flows
* temporary preview URLs

### 3. Link response headers

Check:

```bash
curl -I "$BASE_URL/" | grep -i '^link:'
```

Required:

Add useful discovery links from the homepage response headers.

Recommended:

```http
Link: </llms.txt>; rel="service-doc"; type="text/plain"
Link: </.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"
Link: </.well-known/agent-skills/index.json>; rel="service-desc"; type="application/json"
Link: </.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"
Link: </sitemap.xml>; rel="sitemap"; type="application/xml"
```

If no MCP server exists, do not include the MCP Server Card link.

### 4. Markdown negotiation

Check:

```bash
curl -i "$BASE_URL/docs/getting-started" \
  -H "Accept: text/markdown"
```

Required:

* Returns `Content-Type: text/markdown`.
* Adds `Vary: Accept`.
* Returns clean Markdown without nav bars, cookie banners, JS, footer clutter, or hidden UI-only content.
* Preserves headings, tables, code blocks, links, warnings, and ownership metadata.

Recommended:

* Include `x-markdown-tokens` if token counting is available.
* Add `/index.md` fallback for agents that do not send `Accept: text/markdown`.

Check fallback:

```bash
curl -i "$BASE_URL/docs/getting-started/index.md"
```

Do not convert interactive React admin pages into fake Markdown. Instead, provide a corresponding documentation page or workflow guide.

### 5. llms.txt

Check:

```bash
curl -i "$BASE_URL/llms.txt"
```

Required:

* Describes what the portal is.
* Links to important Markdown pages.
* Uses human-readable link descriptions.
* Avoids huge unstructured dumps.

Recommended structure:

```txt
# DevEx Portal

> Internal developer experience portal for platform capabilities, source intake, source health, and operational runbooks.

## Core documentation

- [Getting Started](https://portal.example.com/docs/getting-started/index.md): Understand portal workflows and access model.
- [Source Intake](https://portal.example.com/docs/source-intake/index.md): Onboard a new source.
- [Source Health](https://portal.example.com/docs/source-health/index.md): Interpret source health signals.
- [Capability Catalog](https://portal.example.com/docs/capability-catalog/index.md): Discover supported platform capabilities.

## Machine-readable resources

- [API Catalog](https://portal.example.com/.well-known/api-catalog): API discovery metadata.
- [Agent Skills](https://portal.example.com/.well-known/agent-skills/index.json): Task-specific agent instructions.
```

For large portals, create scoped files such as:

* `/docs/llms.txt`
* `/capabilities/llms.txt`
* `/runbooks/llms.txt`
* `/aws/llms.txt`

### 6. API Catalog

Check:

```bash
curl -i "$BASE_URL/.well-known/api-catalog" \
  -H "Accept: application/linkset+json, application/json"
```

Required:

* Returns HTTP 200.
* Uses `application/linkset+json` or `application/json`.
* Contains a top-level `linkset` array.
* Links to OpenAPI, API docs, and status/health endpoint.

Example:

```json
{
  "linkset": [
    {
      "anchor": "https://portal.example.com/api",
      "service-desc": [
        {
          "href": "https://portal.example.com/openapi.json",
          "type": "application/vnd.oai.openapi+json"
        }
      ],
      "service-doc": [
        {
          "href": "https://portal.example.com/docs/api/index.md",
          "type": "text/markdown"
        }
      ],
      "status": [
        {
          "href": "https://portal.example.com/api/health",
          "type": "application/json"
        }
      ]
    }
  ]
}
```

Do not include undocumented, unstable, or private admin APIs unless access-controlled and intentionally supported.

### 7. OpenAPI

Check:

```bash
curl -i "$BASE_URL/openapi.json"
```

Required:

* Describes stable API endpoints.
* Includes auth requirements.
* Includes request and response schemas.
* Marks mutation endpoints clearly.
* Describes error responses.

For DevEx Portal, useful APIs may include:

* search documentation
* list platform capabilities
* get capability details
* get source health summary
* create source intake draft
* submit source intake for review
* get review status

Mutation APIs must require authentication and human authorization.

### 8. OAuth discovery

Check:

```bash
curl -i "$BASE_URL/.well-known/oauth-authorization-server"
curl -i "$BASE_URL/.well-known/openid-configuration"
```

Required if the portal exposes authenticated APIs:

* issuer
* authorization endpoint
* token endpoint
* JWKS URI
* supported grant types
* supported scopes

If authentication is delegated to Entra ID, Okta, Cloudflare Access, or another provider, point to the real issuer. Do not invent an issuer.

### 9. OAuth Protected Resource

Check:

```bash
curl -i "$BASE_URL/.well-known/oauth-protected-resource"
```

Required if protected APIs exist:

```json
{
  "resource": "https://portal.example.com",
  "authorization_servers": [
    "https://login.microsoftonline.com/{tenant-id}/v2.0"
  ],
  "scopes_supported": [
    "openid",
    "profile",
    "email",
    "api://devex-portal/source.read",
    "api://devex-portal/source.write",
    "api://devex-portal/health.read"
  ],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://portal.example.com/docs/auth/index.md"
}
```

Only list scopes that actually exist.

### 10. MCP Server Card

Check:

```bash
curl -i "$BASE_URL/.well-known/mcp/server-card.json"
```

Only publish this if an MCP server exists.

Recommended V1 tools:

* `search_docs`
* `get_capability`
* `list_capabilities`
* `get_source_health`
* `get_runbook`

Avoid V1 write tools unless governance is mature.

Allowed V1 pattern:

* read-only tools
* authenticated user context
* audit logs
* least-privilege scopes
* no silent approval
* human confirmation for mutation

Do not expose:

* production credential retrieval
* admin mutation
* source approval
* policy bypass
* secrets
* raw internal network details

### 11. Agent Skills index

Check:

```bash
curl -i "$BASE_URL/.well-known/agent-skills/index.json"
```

Required:

* Returns HTTP 200.
* Uses `application/json`.
* Has `$schema`.
* Has `skills[]`.
* Each skill has `name`, `type`, `description`, `url`, `digest`.

Example:

```json
{
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "devex-agent-readiness",
      "type": "skill-md",
      "description": "Audit and improve a DevEx Portal so AI agents can discover documentation, read Markdown, understand API/auth metadata, and safely use published agent skills.",
      "url": "/.well-known/agent-skills/devex-agent-readiness/SKILL.md",
      "digest": "sha256:<replace-with-actual-sha256>"
    }
  ]
}
```

Compute digest:

```bash
shasum -a 256 public/.well-known/agent-skills/devex-agent-readiness/SKILL.md
```

Then format it as:

```txt
sha256:<64-char-lowercase-hex>
```

### 12. WebMCP

Check manually with browser automation only if you intentionally support browser-side tools.

Do not implement WebMCP in V1 unless:

* the browser environment supports it
* you have a clear user-facing agent workflow
* all tool calls are safe
* auth and confirmation are handled

For DevEx Portal V1, prefer server-side MCP and API Catalog.

## Implementation order

Use this order.

### Phase 1: discovery and content

1. Add `/robots.txt`.
2. Add `/sitemap.xml`.
3. Add homepage `Link` headers.
4. Add `/llms.txt`.
5. Add Markdown negotiation for `/docs/*`.
6. Add `/index.md` fallback.

### Phase 2: API and auth

1. Generate `/openapi.json`.
2. Add `/.well-known/api-catalog`.
3. Add OAuth/OIDC discovery if applicable.
4. Add OAuth Protected Resource metadata if protected APIs exist.

### Phase 3: agent-native workflows

1. Add Agent Skills index.
2. Publish skills for:

   * source intake
   * source health review
   * capability discovery
   * runbook lookup
   * agent readiness audit
3. Add MCP Server Card only after MCP server exists.
4. Keep MCP tools read-only until audit and authorization are mature.

## DevEx-specific skill candidates

Create these skills next:

### devex-source-intake

Use when a user wants to onboard a new source.

Should collect:

* source name
* source URL
* owner team
* system tier
* business criticality
* environment
* documentation URL
* OpenAPI URL
* support channel
* data classification
* review owner

Should output:

* missing fields
* risk flags
* readiness score
* review checklist
* next action

### devex-source-health

Use when reviewing source quality.

Should check:

* owner exists
* docs reachable
* API spec reachable
* status endpoint exists
* last successful scan
* broken links
* stale documentation
* missing runbook
* missing escalation path
* missing auth metadata

Should output:

* health status
* reasons
* remediation tasks
* owner questions

### devex-capability-discovery

Use when a user asks what platform capability exists.

Should search:

* capability catalog
* docs
* runbooks
* API catalog
* owner metadata

Should output:

* recommended capability
* when to use it
* prerequisites
* onboarding steps
* limitations
* owner/support path

## Safety rules

Never:

* expose secrets
* invent OAuth scopes
* invent MCP tools
* approve production changes without explicit human approval
* treat `robots.txt` as security
* publish internal-only hostnames in public discovery files
* expose admin APIs in API Catalog unless intended and protected
* allow agent mutation without audit logs

Always:

* prefer Markdown over HTML
* prefer OpenAPI over UI scraping
* prefer read-only tools first
* include ownership metadata
* include support/escalation path
* include freshness timestamps for docs and source health
* require authentication for private workflows
* log agent-initiated operations

## Output format for audit

When auditing a project, return:

```md
# Agent Readiness Audit

## Overall judgment

- Level:
- Main blocker:
- Recommended next step:

## Findings

| Area | Check | Status | Evidence | Fix |
|---|---|---|---|---|

## P0 TODO

1.
2.
3.

## P1 TODO

1.
2.
3.

## Not recommended for V1

1.
2.

## Implementation notes

- Files to add:
- Routes to add:
- Middleware to add:
- Auth assumptions:
- Security concerns:
```

## Completion criteria

The portal is considered V1 agent-ready when:

* `/robots.txt` exists and declares sitemap and content usage policy.
* `/sitemap.xml` lists canonical docs and capability pages.
* Homepage response includes useful `Link` headers.
* `/llms.txt` exists and points to Markdown docs.
* Core docs support `Accept: text/markdown`.
* Core docs support `/index.md` fallback.
* `/.well-known/api-catalog` exists if APIs exist.
* `/openapi.json` exists for stable APIs.
* OAuth metadata exists if authenticated APIs are intended for agent use.
* `/.well-known/agent-skills/index.json` exists.
* At least one useful portal-specific skill exists.
* MCP Server Card exists only if MCP server exists.
* All private workflows remain authenticated and audited.

````

---

# 6. `index.json` 模板

放到：

```txt
public/.well-known/agent-skills/index.json
````

```json
{
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "devex-agent-readiness",
      "type": "skill-md",
      "description": "Audit and improve a DevEx Portal so AI agents can discover documentation, read Markdown, understand API/auth metadata, and safely use published agent skills.",
      "url": "/.well-known/agent-skills/devex-agent-readiness/SKILL.md",
      "digest": "sha256:<replace-with-actual-sha256>"
    }
  ]
}
```

计算 digest：

```bash
shasum -a 256 public/.well-known/agent-skills/devex-agent-readiness/SKILL.md
```

Cloudflare 的 RFC 要求 digest 是 skill artifact 原始字节的 SHA-256，格式为 `sha256:{hex}`，client 应验证 digest，不匹配就不能使用。([GitHub][4])

---

# 7. 我对你项目的取舍建议

V1 不要追全项。按这个做：

## 必须做

1. `robots.txt`
2. `sitemap.xml`
3. homepage `Link` headers
4. `/llms.txt`
5. Markdown negotiation
6. `/index.md` fallback
7. `/openapi.json`
8. `/.well-known/api-catalog`
9. `/.well-known/oauth-protected-resource`
10. `/.well-known/agent-skills/index.json`
11. 3 个项目 Skill：

* `devex-source-intake`
* `devex-source-health`
* `devex-agent-readiness`

## 暂缓

1. Web Bot Auth
2. WebMCP
3. A2A Agent Card
4. Commerce protocols
5. mutation-capable MCP tools

## 核心方向

你的 portal 如果未来要做 source intake / health / review，那么 agent-friendly 不是“让 agent 操作页面”，而是：

> 页面给人用；API / OpenAPI / Skills / Markdown / MCP 给 agent 用。

PR 可以作为底层流程，但 agent 入口应该先是 portal 的 intake / health / review surface；agent 根据 Skill 和 API metadata 辅助用户填表、检查缺口、生成 review summary。

[1]: https://isitagentready.com/ "Is Your Site Agent-Ready?"
[2]: https://blog.cloudflare.com/agent-readiness/ "Introducing the Agent Readiness score. Is your site agent-ready?"
[3]: https://github.com/wesbos/wesbos/issues/495 "Make site agents ready · Issue #495 · wesbos/wesbos · GitHub"
[4]: https://github.com/cloudflare/agent-skills-discovery-rfc "GitHub - cloudflare/agent-skills-discovery-rfc: A mechanism for discovering Agent Skills using the .well-known URI path prefix as specified in RFC 8615 for discovering Agent Skills. · GitHub"
[5]: https://developers.cloudflare.com/docs-for-agents/ "Docs for agents · Docs for agents docs"
