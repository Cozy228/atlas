# Goal Prompt: Agent Readiness — describe, publish, and serve Atlas to AI agents

Make Atlas usable by AI agents through machine-readable discovery and content
protocols backed by the **existing** Context API — not by scraping the React UI.
Loop until the Definition of Done is green.

Read `docs/architecture/agent_readiness.md` (the plan), `CONTEXT.md` (vocabulary),
`docs/archive/handoffs/demo_skills_routes_handoff.md` (the reverted skill work and
its resume constraints), and `context-layer/src/contracts.ts` + `context-layer/src/api/httpRoute.ts`
(the contract to describe) before starting. This prompt is the executable
distillation of the plan.

## Goal

Expose the Context Layer's already-real, already-tested HTTP contract to agents
through four surfaces — a published **Agent Skill**, a machine-readable **API
description**, a read-only **MCP facade**, and the baseline **web-crawler
metadata** — all served from the Portal origin, all reusing one bundle contract.

```text
human            → Portal React UI
AI agent         → /.well-known/agent-skills + /openapi.json + /mcp  ─┐
crawler          → /robots.txt + /sitemap.xml + Link headers          ├─ same Context API
all three are just consumers of one governed, citation-backed bundle ─┘
```

## Locked decisions (do not re-litigate)

1. **Serving layer = the Portal origin (TanStack Start / Nitro).** Static
   artifacts live in `portal/public/`; data-derived artifacts (`/openapi.json`,
   `/sitemap.xml`, `/llms.txt`, `/.well-known/api-catalog`, `/mcp`) are Nitro server
   routes that call the existing Context API client. Agents hit the Portal host.
2. **Single publication source of truth = `portal/public/.well-known/...`.** Do
   **not** also ship a root `.well-known`; the handoff's digest-drift failure came
   from two copies. One tree, generated at build.
3. **OpenAPI is derived from `@atlas/schema` (zod 4), not hand-maintained.** Use
   `z.toJSONSchema()` for component schemas; enumerate paths from the routes
   `httpRoute.ts` actually dispatches. A test asserts parity (every dispatched
   route has a path; every warning code is documented). One contract, two
   renderings.
4. **MCP is read-only, namespaced, curated.** A small tool set —
   `atlas_search_capability`, `atlas_get_source`, `atlas_get_availability`,
   `atlas_get_context_bundle` — over the same Context API client. No write tools.
   Streamable-HTTP at `/mcp`. Tools mirror reads, not one-per-endpoint.
5. **Skill Discovery follows Cloudflare RFC v0.2.0 exactly**, and the SKILL.md is
   authored per Anthropic best practices. `index.json` + every `digest` are
   generated from file bytes at build time, never by hand.
6. **Never advertise what does not exist.** No invented OAuth scopes, MCP tools, or
   APIs. `oauth-protected-resource` is a generic placeholder reflecting the Bearer
   pipe (ADR-0001) with no fabricated scopes.

## Constraints (from repo CLAUDE.md + agent_readiness.md)

- **Public-safe:** fictional hosts (`portal.example.com`), generic sample data; no
  internal hostnames, tokens, schemas, or business rules in any committed artifact.
- **Surgical, no route churn.** This is additive. Do **not** reshape existing
  `/catalog`, `/sources`, `/guidance`, `/skills` routes, and do **not** hand-edit
  `portal/src/routeTree.gen.ts` (let TanStack regenerate).
- Keep the three "skill" concepts distinct: `skills-lock.json` (dev skills, do not
  touch), `/skills` route + `lib/skills.ts` (product UI, do not touch),
  `.well-known/agent-skills` (this work).
- `robots.txt` is not an access boundary — private workflows stay authenticated.
- Reuse `CONTEXT.md` vocabulary verbatim (Source, Anchor, Excerpt, Citation,
  `restricted_source`, `stale_source`). Every Excerpt carries its Citation.

## Implementation batches

The four batches are independently shippable; ordered low-risk → higher. Each is
green on its own before the next.

### Batch 1 — Skill Discovery (resume the reverted `atlas-context-consumer`)

The most self-contained surface, and previously built then reverted — restore it
**decoupled** from any route change.

- `portal/public/.well-known/agent-skills/atlas-context-consumer/SKILL.md` —
  YAML frontmatter (`name` ≤64 lowercase-hyphen, no "claude"/"anthropic";
  `description` ≤1024, third person, what + when), body < 500 lines, progressive
  disclosure (references one level deep). Content per the example in
  `agent_readiness.md` (Excerpt+Citation always paired; honor `restricted_source` /
  `stale_source` verbatim; forward the caller bearer unchanged).
- `portal/public/.well-known/agent-skills/index.json` — RFC v0.2.0 shape:
  `$schema = https://schemas.agentskills.io/discovery/0.2.0/schema.json`, one
  `skills[]` entry (`name`, `type: "skill-md"`, `description`, `url`,
  `digest: sha256:<hex>`).
- **Build step** that computes each `digest` from the SKILL.md raw bytes and writes
  `index.json` — restore/adapt `agentSkillsDigest.ts` / `loadAgentSkillsRegistry.ts`
  from the reverted work rather than reinventing.
- Pick **one** demo scenario and keep it consistent (the handoff warns against
  Textract-vs-S3 drift).

**Verify (committed):**
- A test recomputes the digest from the file bytes and asserts it equals
  `index.json` (catches the drift gotcha).
- A test validates the index against RFC v0.2.0 (required fields, `name` charset,
  `type` enum, `digest` format).
- A **bundle-parity test**: the behavior the skill instructs (resolve a topic →
  consume the bundle) hits the same Context API contract the Portal uses — a route
  existing is not proof.

**Verify (manual smoke, not committed):**
`npx skills add https://portal.example.com --skill atlas-context-consumer -y`
resolves and validates the digest.

### Batch 2 — Describe the API (OpenAPI + api-catalog + llms.txt)

- `/openapi.json` server route — derived from `@atlas/schema` per locked decision 3.
  Cover topic/source discovery, the context bundle, and feedback. Inline the
  `CONTEXT.md` term definitions in `description`s; document **all** error/warning
  responses (`restricted_source`, `stale_source`, auth failures) with schemas; mark
  the Bearer-pipe auth and the one mutation endpoint (feedback). Include examples.
- `/.well-known/api-catalog` (`application/linkset+json`) — `service-desc` → OpenAPI,
  `service-doc` → API docs, `status` → health endpoint.
- `/llms.txt` server route — short; leads agents to the **API** (OpenAPI, api-catalog)
  and core docs. Frame honestly as DevEx for our engineer users, not SEO.

**Verify (committed):** parity test (every `httpRoute.ts` route ↔ an OpenAPI path;
every warning code documented); `openapi.json` parses and is a valid 3.x document;
`api-catalog` is valid linkset JSON pointing at real routes only.

### Batch 3 — MCP read-only facade

- `/mcp` Nitro server route (streamable-HTTP) exposing the four `atlas_*` read tools
  over the existing Context API client. Responses carry semantic ids + Citation;
  support a `response_format` (`CONCISE` | `DETAILED`) and pagination/truncation
  (default well under ~25K tokens); concise tool descriptions; actionable errors.
- `portal/public/.well-known/mcp/server-card.json` describing transport + the tools.

**Verify (committed):** each tool returns the expected bundle shape against fixtures;
no write tool exists; the server card lists exactly the implemented tools (no
phantom tools).

### Batch 4 — Web-crawler baseline

- `portal/public/robots.txt` — `User-agent` rules, `Sitemap:` line,
  `Content-Signal: ai-train=no, search=no, ai-input=yes`; allow `/catalog/`,
  `/sources/`, `/guidance/`, `/llms.txt`, `/.well-known/`; disallow mutation/admin.
- `/sitemap.xml` server route — canonical catalog/source/guidance URLs from the
  discovery responses; exclude mutation flows and the Ask chat.
- Homepage `Link` headers (Nitro response middleware on `/`) advertising llms.txt,
  api-catalog, agent-skills, mcp, sitemap.
- `portal/public/.well-known/oauth-protected-resource` — generic, no fabricated
  scopes (ADR-0001).

**Verify (committed):** `robots.txt` contains the sitemap + content-signal lines;
`sitemap.xml` is valid `<urlset>` and excludes mutation routes; a test asserts the
homepage response carries the `Link` header set.

## Definition of Done

**Committed (automated, fictional data, `pnpm test` + `pnpm lint` green):**
- Skill: digest-parity test, RFC-v0.2.0 validation test, bundle-parity test.
- API: route↔OpenAPI parity test, valid OpenAPI 3.x, valid api-catalog linkset.
- MCP: read-only tool tests; server-card lists only implemented tools.
- Crawler: robots/sitemap/Link header tests.
- No new fabricated metadata anywhere; one publication tree; no route churn;
  `routeTree.gen.ts` only changed by generation.

**Manual local smoke (one-time, NOT committed):**
- `npx skills add https://portal.example.com --skill atlas-context-consumer -y` ✓
- `curl -s localhost:3000/openapi.json | jq .openapi`, `curl -sI localhost:3000/ | grep -i ^link`,
  `curl -s localhost:3000/.well-known/agent-skills/index.json` all return as specified.
- An agentReadiness scan (isitagentready.com / Cloudflare scanner) shows the new
  Discoverability / Content / Protocol-Discovery items passing.

## Explicitly out of scope (do not build)

WebMCP (`navigator.modelContext`), A2A Agent Card, Web Bot Auth, Commerce
(x402/MPP/UCP/ACP), any mutation-capable MCP tool, and Markdown content negotiation
(`Accept: text/markdown` / `/index.md`) — the latter only if a real page-scraping
agent path appears; it is secondary to the API/MCP path.
