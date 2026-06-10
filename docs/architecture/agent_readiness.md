# Atlas Agent Readiness Plan

This document is the active implementation plan for making Atlas Portal usable by
AI agents — not by scraping the React UI, but through machine-readable discovery
and content protocols backed by the existing Context API.

It supersedes the exhaustive standards reference in
`docs/archive/product/agent_readiness.md`. That archived file remains the full
catalog of the underlying standards (Cloudflare Agent Readiness categories,
Agent Skills Discovery RFC v0.2.0, MCP Server Card, content negotiation). This
document only records **what Atlas will actually build, against which data, in
what order** — read the archive when you need the full spec text for one item.

## Framing

Atlas already exists to deliver governed, citable context to consumers other than
a human browser (see `PRODUCT.md`, `CONTEXT.md`). Agent readiness is therefore not
a new product surface — it is exposing the surface that already exists through the
protocols agents speak.

> Pages are for humans. `llms.txt` / Markdown / OpenAPI / MCP are for agents.
> Both are served from the same Context API contract; neither mirrors source content.

The highest-leverage move for Atlas is therefore **not** the web-crawler checklist
(robots/sitemap/Markdown). It is **describing, discovering, and publishing a
consumer skill for the agent API that already exists** — the Context Layer's
Lambda HTTP contract (`context-layer/src/api/*`, `contracts.ts`). Today that API
is real and tested but has no machine-readable description, no discovery entry,
and no published consumer skill. Closing that is worth more than any robots.txt.

A read-only **MCP facade over the same `handleHttpRequest`** is the natural
agent-native delivery (consumer-neutral is already a stated product principle —
Portal, skills, and agents are all just consumers of one bundle contract). Markdown
content negotiation matters mainly for the human-facing pages and is secondary if
the primary agent path is API/MCP rather than page-scraping.

## Standards background

The reference standard is Cloudflare's Agent Readiness score (isitagentready.com),
which groups checks into five categories: Discoverability, Content Accessibility,
Bot Access Control, Protocol Discovery, Commerce. As of mid-2026 the relevant
specs are stable: Agent Skills Discovery is still Cloudflare RFC v0.2.0 (SHA-256
digest per skill), WebMCP is still a W3C draft (`navigator.modelContext.registerTool`),
`llms.txt` is unchanged. Emerging alternatives (`agents.txt`, specification.website)
are not yet established and are out of scope. Full per-item spec detail lives in
the archived reference.

**Reality checks from 2026 field data (these reshaped the priorities):**

- **`llms.txt` is largely ignored by production AI crawlers.** In a 90-day study,
  llms.txt was 0.1% of AI-bot traffic (84 of 62,100 hits); no major AI company
  (OpenAI, Google, Anthropic, Meta, Mistral) commits to reading it. It is **not**
  an AI-visibility lever — `robots.txt` is what actually governs AI crawler
  behavior. llms.txt's real value is **DevEx**: it measurably helps agents *inside
  AI IDEs* that are pointed at a URL. Atlas's users are exactly that audience
  (engineers in flow using AI-assisted tools), so llms.txt is justified **for our
  users**, not as discovery SEO. Frame and size it accordingly — small, honest, not
  a centerpiece.
- **The agent interface that matters is the API contract (OpenAPI), not pages.**
  Across 2026 guidance, OpenAPI is "the critical interface between AI systems and
  the outside world," auto-convertible to function/MCP tool definitions. Error
  schemas and clear, business-mapped field names are the highest-value content.
- **Two different "Agent Skills" senses, both apply.** Anthropic *Agent Skills*
  define the SKILL.md authoring format (frontmatter, progressive disclosure) for
  Claude/Claude Code; Cloudflare *Agent Skills Discovery* defines how to publish
  SKILL.md over the web at `.well-known`. The `atlas-context-consumer` skill should
  be **authored** per Anthropic best practices and **published** per the Cloudflare
  RFC. See the best-practices section below.

## Best practices (researched, June 2026)

These are the concrete rules the implementation must follow. Sources at the end.

### OpenAPI (the core surface — Phase 1)

- Field names must map to Atlas's domain vocabulary (`CONTEXT.md`: Source, Anchor,
  Excerpt, Citation, `restricted_source`, `stale_source`). Put those term
  definitions into the spec `description`s — agents need the glossary inline.
- Document **all error responses** with status + schema, including the warning
  codes (`restricted_source`, `stale_source`) and auth failures. Error schemas are
  the single highest-value content for agent code-gen.
- Include request/response **examples** and mark the auth model (Bearer pipe,
  ADR 0001) and the one mutation endpoint (feedback) explicitly.
- Treat the spec as the source of truth from which MCP tools / function defs are
  derived — do not hand-maintain two contracts.

### MCP / tool design (Phase 2)

- **Few, curated tools**, not one-per-endpoint. More tools ≠ better; tool defs are
  loaded upfront and cost tokens (58 tools ≈ 55K tokens before the first turn).
- **Search, not list:** `atlas_search_capability`, not `list_capabilities`.
- **Namespace every tool** with the `atlas_` prefix; **unambiguous params**
  (`source_id`, not `source`).
- **Return high-signal fields only**; prefer Atlas's **semantic ids** over opaque
  UUIDs (it already uses `source_class`-style ids — keep them, drop UUIDs from
  responses). Always include the Citation (Atlas's evidence principle).
- Offer a `response_format` (`CONCISE` | `DETAILED`) and **paginate/truncate** with
  a sane default (keep responses well under ~25K tokens); on truncation, tell the
  agent to narrow its search.
- **Concise tool descriptions**; **actionable error messages** with an example of a
  correctly-formed input.
- Forward-looking: Anthropic's "code execution with MCP" pattern (expose tools as a
  code API the agent imports) cut a 150K-token workflow to ~2K. Not V1, but design
  the MCP facade so it could be presented that way later.

### Agent Skill authoring (`atlas-context-consumer`, Phase 2)

- Frontmatter: `name` (≤64 chars, lowercase-hyphen, **no** "claude"/"anthropic")
  + `description` (≤1024 chars, **third person**, state *what it does* **and** *when
  to use it*). The description is the discovery key — make it specific.
- SKILL.md body **< 500 lines**; progressive disclosure — overview in SKILL.md,
  details in referenced files **one level deep**; reference files > 100 lines get a
  table of contents.
- **Build evaluations first** (≥3 representative tasks) before writing prose; write
  the minimum instructions that pass them.
- Reuse Atlas's **consistent terminology** verbatim from `CONTEXT.md`; no
  time-sensitive statements; concrete examples over abstract description.
- If the skill references MCP tools, use fully-qualified names (`Atlas:atlas_search_capability`).

### Agent Skills Discovery — exact wire spec (Cloudflare RFC v0.2.0)

This is the publication contract for the `.well-known` surface (distinct from how
the SKILL.md is *authored*, above). Source: the RFC repo.

**Paths.** Discovery entry point is `/.well-known/agent-skills/index.json`. Skill
artifacts are conventionally under `/.well-known/agent-skills/<name>/SKILL.md`, but
may live anywhere the entry's `url` points (resolved per RFC 3986 §5).

**`index.json` schema:**

| Field | Required | Notes |
|---|---|---|
| `$schema` | yes | `https://schemas.agentskills.io/discovery/0.2.0/schema.json` (identifies version) |
| `skills[]` | yes | array of skill entries |

**Each `skills[]` entry:**

| Field | Required | Rule |
|---|---|---|
| `name` | yes | 1–64 chars, lowercase alphanumeric + hyphens only |
| `type` | yes | `"skill-md"` or `"archive"` |
| `description` | yes | ≤1024 chars; should match the SKILL.md frontmatter `description` |
| `url` | yes | artifact location (absolute or relative per RFC 3986 §5) |
| `digest` | yes | `sha256:{hex}` — SHA-256 of the artifact's **raw bytes**, 64 lowercase hex |

**SKILL.md:** MUST have YAML frontmatter with at least `name` and `description`,
then Markdown instructions.

**Digest is the gotcha.** Clients MUST verify the downloaded artifact against
`digest` and MUST NOT use unverified content. So **every edit to a SKILL.md changes
its bytes and requires recomputing the digest** in `index.json` — otherwise
spec-aware clients reject it. This is the concrete mechanism behind the handoff's
"pick one publication source of truth": if root `.well-known` and
`portal/public/.well-known` both ship the file, their digests drift and one breaks.
Generate `index.json` (and digests) from the files at build time; do not hand-maintain.

**Serving requirements.** `index.json` → `application/json`; `SKILL.md` →
`text/markdown` (or `text/plain`); archives → `application/gzip` / `application/zip`.
Support `GET` and `HEAD`; `404` for missing. Clients warn on unrecognized `$schema`
(absent ⇒ treat as v0.1.0), do **not** execute `scripts/` by default, validate
archive safety (reject `..`/absolute paths/symlinks, cap unpacked size), and SHOULD
keep a trusted-domain allowlist.

**Concrete Atlas example (public-safe):**

```json
// /.well-known/agent-skills/index.json
{
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "atlas-context-consumer",
      "type": "skill-md",
      "description": "Resolve governed, citation-backed platform context from Atlas (capabilities, sources, regional availability) through the Context API bundle. Use when an agent needs an authoritative, sourced answer about a cloud platform capability instead of guessing.",
      "url": "/.well-known/agent-skills/atlas-context-consumer/SKILL.md",
      "digest": "sha256:<recomputed-from-file-bytes-at-build>"
    }
  ]
}
```

```markdown
---
name: atlas-context-consumer
description: Resolve governed, citation-backed platform context from Atlas (capabilities, sources, regional availability) through the Context API bundle. Use when an agent needs an authoritative, sourced answer about a cloud platform capability instead of guessing.
---

# Consuming Atlas context

Atlas returns Excerpts that are always paired with a Citation; never present an
Excerpt without its Citation. See `CONTEXT.md` vocabulary (Source, Anchor,
Excerpt, Citation, restricted_source, stale_source).

## Steps
1. Discover the capability: `GET /api/topics?query=...`  (or MCP `atlas_search_capability`)
2. Fetch the context bundle for the chosen topic/source.
3. Surface each claim with its Citation; honor `restricted_source` / `stale_source`
   warnings verbatim — do not hide or soften them.

## Auth
Forward the caller's bearer token unchanged (Bearer pipe, ADR 0001); if none,
Atlas applies its narrow service-token fallback. Never fabricate credentials.
```

Compute the digest with `shasum -a 256 <file>` and prefix `sha256:` — but wire it
into the build, not by hand.

## Codebase facts this plan depends on

- **Stack:** TanStack Start + Nitro (`portal/vite.config.ts`). Server routes and
  response middleware are available, so dynamic behavior (`Link` headers, `Accept:
  text/markdown` negotiation, digest-bearing well-known files) is feasible — we are
  not limited to static files.
- **No `public/` directory yet.** Truly static artifacts (`robots.txt`) can live in
  a new `public/`; anything dynamic or data-derived should be a server route.
- **The real agent API is the Context Layer's Lambda HTTP contract**, not the
  Portal. `context-layer/src/api/*` (`handleHttpRequest` plus topic-discovery,
  topic, source-discovery, source, context-bundle, feedback routes) is deployed as
  an AWS API Gateway HTTP Lambda (`context-layer/src/lambda/handler.ts`) and has a
  typed contract (`contracts.ts`) with contract tests. `portal/src/api/server` is a
  BFF wrapper over the same contract. **OpenAPI / api-catalog / llms.txt should
  describe this contract**, which is already real, tested, and consumer-neutral.
- **Deployment is AWS, not Cloudflare** (`infra/src/atlasInfraPlan.ts`; Lambda +
  API Gateway + DynamoDB + Bedrock). The Cloudflare Agent Readiness "score" is only
  a checklist here — there is no CF scanner, Content-Signal, or Web Bot Auth
  enforcement for free. robots/sitemap/Link/well-known will be served by the
  Portal (Nitro) and/or API Gateway and must be wired by hand.
- **Public-safe constraint** (repo-wide rule): every published discovery file must
  use fictional hosts (`portal.example.com`), generic scopes, and no internal
  hostnames, tokens, schemas, or business rules. Discovery files are committed
  artifacts and must stay export-safe.

## What already exists — and what was reverted

This is not a greenfield. Three separate things are easy to conflate; keep them distinct.

- **`skills-lock.json`** — dev-time coding skills used to *build* Atlas (shadcn,
  vercel-react-best-practices, taste-skill). Irrelevant to agent readiness; do not
  touch.
- **`/skills` route + `portal/src/lib/skills.ts`** — a *product* "Skills registry"
  UI shown to platform users (fictional placeholders: Terraform Baseline, Service
  Onboarding…). Static, human-facing. **This is not Agent Skills Discovery** and
  must not be conflated with it.
- **`.well-known/agent-skills/` (Agent Skills Discovery)** — already implemented
  once and **reverted**. See `docs/archive/handoffs/demo_skills_routes_handoff.md`.
  The reverted work added `portal/public/.well-known/agent-skills/{index.json,
  atlas-context-consumer/SKILL.md}`, `portal/src/api/server/{agentSkills,
  agentSkillsDigest,loadAgentSkillsRegistry}.ts`, `portal/src/lib/{agent-skills,
  skill-install}.ts`, with discovery v0.2 shape (`type: "skill-md"`) and a
  validated install command:
  `npx skills add https://portal.example.com --skill atlas-context-consumer -y`.

It was reverted **not** because the idea was wrong, but because it was bundled with
a large route-reshaping change and the demo scenario drifted (Textract / Central
Landing Zone vs. an S3 variant). The intended published skill, `atlas-context-consumer`,
teaches an agent to consume the Context API bundle — which is exactly the
agent-native surface this plan wants. So Phase 3 below is **resume, not rebuild**,
with these constraints from the handoff:

- Pick **one** demo scenario first and stop the drift.
- Prove **Context-API bundle parity** (Portal and skill consume the same contract)
  with a test — a route existing in the Portal is not proof.
- Choose **one** publication source of truth: root `.well-known` vs.
  `portal/public/.well-known` previously diverged.
- Do not re-bundle this with route churn; do not hand-edit `routeTree.gen.ts`.

## Scope decisions

Priority reflects the corrected framing: **describe and publish the API that
already exists** before the web-crawler checklist.

| Item | Decision | Rationale |
|---|---|---|
| `/openapi.json` from `contracts.ts` | **Build (P1)** | The Context API is real + tested but undescribed; this is the core agent surface |
| `/.well-known/api-catalog` | **Build (P1)** | Points agents at OpenAPI + docs + health |
| `llms.txt` (points at API + docs) | **Build (P1)** | Index that leads agents to the API, not just pages |
| Resume `.well-known/agent-skills` + `atlas-context-consumer` | **Build (P2, resume)** | Already built+reverted; teaches agents to consume the bundle |
| MCP facade over `handleHttpRequest` + Server Card | **Build (P2)** | Consumer-neutral; agent-native delivery of the same contract |
| `robots.txt` + Content-Signal | **Build (P3)** | Cheap discoverability + AI usage policy |
| `sitemap.xml` | **Build (P3)** | Canonical catalog/source/guidance pages |
| Homepage `Link` headers | **Build (P3)** | Advertise llms.txt/api-catalog/agent-skills/mcp once they exist |
| `/.well-known/oauth-protected-resource` | **Build (P3, generic)** | Declares Bearer-pipe auth model; generic placeholder only |
| Markdown negotiation + `/index.md` | **Build (P3, optional)** | Useful for page-scraping agents; secondary to API/MCP path |
| WebMCP (`navigator.modelContext`) | **Defer** | W3C draft; no clear V1 workflow |
| A2A Agent Card | **Defer** | Observe only |
| Web Bot Auth | **Defer** | Only if Atlas issues outbound bots; no CF support here |
| Commerce (x402/MPP/UCP/ACP) | **Skip** | Not a commerce surface |
| Mutation-capable MCP tools | **Skip (V1)** | Reads first; writes need audit + human confirm |

## Data mapping (Context API → agent surface)

| Agent surface | Backed by | Notes |
|---|---|---|
| `llms.txt` links, `sitemap.xml` | Topic/Source discovery responses | Enumerate canonical detail URLs |
| Markdown of a capability/source/guidance page | Context bundle for that record | Render the same data the route loader uses, as clean Markdown |
| `openapi.json` | `contextApiClient` interface + contract test | Describe discovery + bundle + feedback endpoints |
| MCP `atlas_search_capability` / `atlas_get_source` / `atlas_get_availability` | Topic discovery / Source response / availability projection | Read-only, namespaced, search-first; semantic ids + Citation in responses |

## Phased implementation

### Phase 1 — Describe & discover the API that exists (start here)

The Context API is already real, tested, and consumer-neutral; it just has no
machine-readable description or discovery entry. Close that first.

1. `/openapi.json` — generate from `context-layer/src/contracts.ts` (the typed
   contract, with contract tests as the honesty check). Cover topic/source
   discovery, the context bundle, and feedback; mark the bundle's auth (Bearer
   pipe, ADR 0001) and the one mutation endpoint (feedback).
2. `/.well-known/api-catalog` (`application/linkset+json`) — `service-desc` →
   OpenAPI, `service-doc` → API docs Markdown, `status` → health endpoint.
3. `/llms.txt` — short description that leads agents to the **API** (OpenAPI,
   api-catalog) and the core docs, not just to HTML pages.

**Verify (P1):**

```bash
BASE=http://localhost:3000   # dev server
curl -fsS  "$BASE/openapi.json" | grep -i '"openapi"'
curl -fsSI "$BASE/.well-known/api-catalog" -H 'Accept: application/linkset+json' | grep -i 'linkset'
curl -fsS  "$BASE/llms.txt" | head
```

### Phase 2 — Agent-native consumption (resume + MCP)

1. **Resume** `.well-known/agent-skills/index.json` + `atlas-context-consumer/SKILL.md`
   from the reverted work, decoupled from any route change. One demo scenario; one
   publication source of truth; a Context-API bundle parity test before claiming
   done (see the handoff constraints above). discovery v0.2 shape, `sha256:` digest.
2. Read-only **MCP facade** over `handleHttpRequest` + `/.well-known/mcp/server-card.json`.
   A small, curated, namespaced, search-first tool set: `atlas_search_capability`,
   `atlas_get_source`, `atlas_get_availability`, `atlas_get_context_bundle` — not
   one-tool-per-endpoint. Responses carry semantic ids + the Citation; support
   `response_format` and pagination per the best-practices section. No write tools
   in V1. Same contract as Portal and the skill — three consumers, one bundle.

### Phase 3 — Web-crawler checklist (cheap, lower differentiation)

1. `public/robots.txt` — `User-agent` rules, `Sitemap:` line, `Content-Signal:
   ai-train=no, search=no, ai-input=yes`. Allow `/catalog/`, `/sources/`,
   `/guidance/`, `/llms.txt`, `/.well-known/`; disallow mutation/admin paths.
2. `/sitemap.xml` server route — canonical catalog/source/guidance URLs from the
   discovery responses; exclude mutation flows and the Ask chat.
3. Homepage `Link` headers (Nitro response middleware on `/`) advertising
   llms.txt, api-catalog, agent-skills, mcp, sitemap.
4. `/.well-known/oauth-protected-resource` — generic placeholder reflecting the
   Bearer-pipe model (ADR 0001). **Do not invent scopes**; list only real ones or
   omit scopes entirely.
5. *(optional)* Markdown negotiation + `/index.md` for catalog/source/guidance
   detail routes — only if page-scraping agents are a real path; secondary to API/MCP.

## Public-safe + safety rules (must hold)

- Fictional hosts and sample data only; no internal hostnames, tokens, schemas.
- `robots.txt` is **not** an access-control boundary — private workflows stay
  authenticated regardless.
- Never advertise an API, OAuth scope, MCP tool, or skill that does not exist.
- Reads before writes; any future mutation tool requires audit + human confirm.
- Markdown output must be clean content (no nav/cookie/footer), preserving
  headings, tables, code, and — per Atlas's evidence principle — citations.

## Open questions

- **Markdown source of truth:** render Markdown from the Context bundle on the fly,
  or maintain `.md` doc files alongside? Bundle-rendering keeps one source of truth
  and avoids drift; lean that way unless a curated narrative is needed.
- **Hosting for well-known/static:** `public/` static vs Nitro server route per
  artifact. Default: static for `robots.txt`, server routes for anything
  data-derived or digest-bearing.
- **MCP transport:** streamable-HTTP endpoint inside the Nitro server vs a separate
  process. Decide when Phase 3 starts.

## References

Internal:
- Full standards reference: `docs/archive/product/agent_readiness.md`
- Reverted agent-skills work + resume path: `docs/archive/handoffs/demo_skills_routes_handoff.md`
- Product framing: `PRODUCT.md`, `CONTEXT.md`, `docs/architecture/current_design.md`
- Auth model: `docs/adr/0001-identity-agnostic-bearer-pipe.md`
- The API contract to describe: `context-layer/src/contracts.ts`, `context-layer/src/api/*`

External (researched June 2026):
- Cloudflare Agent Readiness: https://blog.cloudflare.com/agent-readiness/
- Agent Skills Discovery RFC v0.2.0: https://github.com/cloudflare/agent-skills-discovery-rfc
- Anthropic — Writing tools for agents (MCP/tool design): https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic — Code execution with MCP (token efficiency): https://www.anthropic.com/engineering/code-execution-with-mcp
- Anthropic — Skill authoring best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Anthropic — Equipping agents with Agent Skills: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- llms.txt adoption reality (2026): https://aeoengine.ai/blog/llms-txt-zero-usage-ai-bots-ignore , https://presenc.ai/research/state-of-llms-txt-2026
- OpenAPI for AI agents: https://buildwithfern.com/post/prepare-apis-documentation-ai-agent-consumption
