# Agent Readiness — blind-agent E2E test example

A worked example of validating the four agent-readiness surfaces (skill
discovery, OpenAPI, MCP, crawler baseline) the way they will actually be
consumed: by an agent that knows **nothing** about Atlas and must discover
everything from the wire. First run: 2026-06-10, against the production build,
driven by a subagent (Claude Sonnet) with no repo knowledge. All 13 checks
passed.

This complements — does not replace — the committed unit tests
(`portal/src/api/server/{agentSkills,openapiDocument,agentDiscovery,crawlerBaseline}.test.ts`,
`portal/src/api/server/mcp/mcp.test.ts`). Those prove each artifact is
internally correct; this proves the artifacts **chain together** for a blind,
spec-compliant consumer. A route existing is not proof — an agent finding and
using it is.

## Setup

```bash
cd portal
pnpm build                                   # regenerates agent-skills index digests
PORT=3201 node .output/server/index.mjs &    # production server, not vite dev
curl -s http://localhost:3201/health         # {"status":"ok"}
```

## The test protocol

Give the agent (a human tester works too) exactly two facts and nothing else:

1. There is a web service at `http://localhost:3201`.
2. The user's question: *"Can AWS Textract run in a private subnet, and which
   regions is Textract available in?"*

Rules of the game:

- **No path may be guessed from memory.** Every URL called (beyond the
  standard convention entry points: `GET /` response headers, `/robots.txt`,
  `/llms.txt`, `/sitemap.xml`, `/.well-known/` registered names) must have
  been discovered in a response actually received.
- Published artifacts use the canonical fictional host
  (`https://portal.example.com`, per the repo's public-safe rule); the agent
  must substitute the origin with the local one and note that it did.
- Skill installation must go through the real CLI
  (`npx -y skills add ... --skill ... -y`), with the digest verified from
  bytes (`shasum -a 256`) against `index.json` **before** trusting the
  artifact.
- The final answer may use only data obtained from the discovered API, must
  cite Citations, and must relay every `warnings[]` entry verbatim — exactly
  what the skill instructs.

## Discovery chain (as actually walked)

```text
GET / (response headers)
└─ Link: header → 6 advertised surfaces
   ├─ /llms.txt                              rel="llms-txt"
   │   └─ confirms OpenAPI + api-catalog + /mcp + agent-skills + pages
   ├─ /robots.txt                            (blind convention)
   │   └─ Allow /catalog/ /sources/ /guidance/; Disallow /ask /api/;
   │      Content-Signal; Sitemap line
   ├─ /sitemap.xml                           rel="sitemap"
   │   └─ enumerates /catalog/aws-textract and friends
   ├─ /.well-known/api-catalog               rel="api-catalog"
   │   └─ linkset → /openapi.json (service-desc), /llms.txt, /health
   ├─ /.well-known/agent-skills/index.json   rel="agent-skills"
   │   └─ skill "atlas-context-consumer" + sha256 digest
   │       ├─ download SKILL.md, recompute sha256 → digest match
   │       └─ npx -y skills add http://localhost:3201 \
   │            --skill atlas-context-consumer -y      → installed
   │           └─ follow SKILL.md steps:
   │              GET /api/topics?query=textract       → "aws-textract"
   │              GET /api/topics/aws-textract/context → bundle
   ├─ /openapi.json                          rel="service-desc"
   │   └─ full contract: paths, Bearer pipe, warning glossary
   └─ /mcp                                   rel="mcp-server"
       ├─ initialize → serverInfo "atlas"
       ├─ tools/list → 4 atlas_* read tools with inputSchemas
       └─ tools/call atlas_get_availability
            {"zone":"aws","service_query":"textract"}  → regions
```

## Checks and observed results

| # | Surface | Check | Result |
|---|---------|-------|--------|
| 1 | Crawler | `GET /` carries the Link header set (6 rels) | PASS |
| 2 | Crawler | robots.txt has Sitemap + Content-Signal + Allow/Disallow | PASS |
| 3 | Crawler | sitemap.xml is a urlset enumerating canonical pages | PASS |
| 4 | Discovery | llms.txt leads to the API surfaces | PASS |
| 5 | Discovery | api-catalog linkset points at real routes | PASS |
| 6 | Skill | index.json is RFC v0.2.0 shaped | PASS |
| 7 | Skill | digest recomputed from raw bytes matches index.json | PASS (`sha256:e3ee0762…`) |
| 8 | Skill | `npx skills add` resolves, validates, installs | PASS |
| 9 | API | OpenAPI 3.1 parses; documents the bundle endpoint used | PASS |
| 10 | API | skill-instructed flow returns the bundle, Excerpts paired with Citations | PASS |
| 11 | MCP | initialize + tools/list expose exactly 4 read-only atlas_* tools | PASS |
| 12 | MCP | tools/call returns structured availability with semantic ids | PASS |
| 13 | Conduct | warnings (`stale_source`, `source_unavailable`, `broken_anchor`) relayed verbatim in the final answer | PASS |

The agent's final answer cited *"Private subnet usage"*
(`github.com/acme/terraform-aws-textract#private-subnet-usage`) for the
private-subnet claim, reported Textract available in `us-east-1` and
`ca-central-1` from `atlas_get_availability`, and relayed all three pilot-data
warnings unchanged — the exact behavior the skill teaches.

## Known friction (expected; re-evaluate before production)

- **Fictional host in published URLs.** Every absolute URL says
  `https://portal.example.com` (public-safe rule), so a local consumer must
  substitute the origin. A real deployment must inject the real origin at
  deploy time; the committed tests pin the fictional one on purpose.
- **robots.txt `Disallow: /api/` vs llms.txt inviting API calls.** Intentional:
  robots governs crawlers, not API clients (robots is not an access boundary),
  and llms.txt resolves the ambiguity — but a strict crawler-first agent will
  pause here.
- **MCP version negotiation.** The server answers `initialize` with its own
  `protocolVersion` (`2025-06-18`) instead of echoing a supported client
  version. Stateless single-POST JSON-RPC (no session) is a spec-allowed
  variant; the version echo is the one item a strict client could reject.
- **Pilot data scope.** Only two regions and some intentionally degraded
  sources (`stale_source` / `source_unavailable` / `broken_anchor`) — that is
  seed-data scope, and surfacing it verbatim is the desired behavior, not a
  defect.

## Variant: no-skill run (OpenAPI + MCP only)

Same setup and question, but the agent is forbidden from touching
`/.well-known/agent-skills/` — proving the skill is a teaching convenience,
not a dependency. First run: 2026-06-10, all checks passed. The agent learned
every behavioral rule from the OpenAPI document alone and quoted where:

- Citation pairing: `ContextBundleResponse.description` ("Every Excerpt
  carries its Citation — never present one without the other") plus the
  `Excerpt` schema's `required: ["text", "citation"]`.
- Warning semantics: the `restricted_source` / `stale_source` glossary in
  `info.description`.
- Verbatim relay: the bundle endpoint's 200 description ("Relay every
  `warnings[]` entry verbatim").
- Auth model: the Bearer-pipe paragraph (ADR 0001) in `info.description`.
- Call order: the `/topics` description ("Start here…").

The regions half of the question was answered over MCP after confirming the
server card's tool list matches `tools/list` exactly. Verdict from the agent:
the no-skill path is fully self-sufficient for correctness; the skill adds
workflow guidance and conduct shortcuts, not required knowledge. This is the
"one contract, two renderings" property working as intended — spec
descriptions must keep carrying the conduct rules, since spec-only consumers
exist.

## Re-running

Any capable agent CLI can replay this: paste the protocol section as the
prompt, point it at the local port, and require the discovery-chain log in the
report. Tear down with `pkill -f ".output/server/index.mjs"` and remove the
scratch install dir.
