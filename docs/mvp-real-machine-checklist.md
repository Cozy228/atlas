# MVP Real-Machine & Demo Checklist

Status as of 2026-06-24. This is the single place to track what is still **fixture
/ offline**, what needs to be **connected to a real backend** for the MVP, the
**agent/API layer**, and the **demo walkthrough + copy-paste commands** to verify
each surface.

Atlas serves **two audiences over one contract**:

```
human    → Portal React UI
AI agent → /.well-known/agent-skills + /openapi.json + /mcp   ┐
crawler  → /robots.txt + /sitemap.xml + Link headers          ├─ one governed, citation-backed Context API bundle
all three are just consumers of the same bundle               ┘
```

The platform runs **offline by default**: every live integration is gated behind
an environment variable. With no env set, all surfaces render from public-safe,
fictional fixtures. Setting the env vars flips the matching surface to live with
**no code change**.

---

## 1. Live-connection checklist (env-gated integrations)

Set these where the Context Layer runs (portal server / Lambda). All are optional;
each unlocks one surface.

| Integration | Env vars | Unlocks | Adapter |
|---|---|---|---|
| Confluence Cloud | `ATLAS_CONFLUENCE_BASE_URL`, `ATLAS_CONFLUENCE_TOKEN`, `ATLAS_CONFLUENCE_EMAIL` (email ⇒ Basic auth for a personal API token; else Bearer) | Live excerpts for `confluence-page` **and** `policy-document` sources | `context-layer/src/sourceContent/confluenceCloudContentProvider.ts` |
| Terraform / GitHub README | `ATLAS_TERRAFORM_TOKEN` (+ `ATLAS_TERRAFORM_BASE_URL`, default `api.github.com`) | Live excerpts for `terraform-module` sources | `context-layer/src/sourceContent/terraformModuleContentProvider.ts` |
| Release notes (live) | `ATLAS_RELEASE_NOTES_PAGE_ID` (+ the Confluence vars above) | `/whatsnew` releases fetched from the live Confluence page | `context-layer/src/releaseNotes/resolveReleaseNotes.ts` |
| Feedback store | `ATLAS_FEEDBACK_TABLE` (DynamoDB) | Persisted feedback (else in-memory) | `context-layer/src/services/contextBundleService.ts` |
| LLM (Ask Atlas) | `ATLAS_BEDROCK_MODEL_ID` (Bedrock) / RAI vars | Real grounded answers (else a simulated adapter echoes the first authoritative excerpt) | `portal/src/api/server/llmProvider.ts` |
| Content cache | `ATLAS_CACHE_VALKEY_URL` (optional) | Shared Valkey/Redis cache (else in-memory, 300s TTL) | `context-layer/src/sourceContent/sourceContentCache.ts` |
| **Registry data dir** | `ATLAS_DATA_DIR` (optional override) | Points the loader at a data dir outside the tree (mounted volume). **Not required** — the loader self-locates `data/` (see §7). | `context-layer/src/dataDir.ts` |

### Data conventions required for live resolution

The fixture registry (`data/*.yaml`) uses placeholder locations. For a source to
resolve **live**, its registry entry must follow these conventions:

- [ ] **Confluence source** — `location` = the Confluence **page id**; each anchor's
  `selector.locator` = the heading **slug** on that page.
- [ ] **Terraform source** — `location` = the GitHub repo (`github.com/owner/repo`);
  each anchor's `selector.locator` = `#heading-slug`.
- [ ] **Policy source** — ⚠️ currently modeled as S3 markdown (`location: s3://…`)
  with `clause-*` anchors (deliberate offline test fixtures, incl. one `broken`
  and one `restricted`). The resolver now has the Confluence live seam, but to
  serve policies live their sources must be repointed to a Confluence page id +
  heading-slug anchors. Until then policy stays offline even with Confluence env set.
- [ ] After repointing, confirm `observed_version` / fingerprint drift warnings
  behave (a stale fixture vs. a live newer version).

### Per-channel verification steps

- [ ] **Confluence**: open a `confluence-page` source detail (`/sources/$id`) → the
  "Key sections" should show the live section text + a working "open source" link
  back to the page anchor. Restricted pages return metadata only.
- [ ] **Terraform**: open a `terraform-module` source → README sections resolve.
- [ ] **Release notes**: with `ATLAS_RELEASE_NOTES_PAGE_ID` set, `/whatsnew`
  "Platform releases" reflects the live page (same shape as the YAML fixture).
- [ ] **ACL**: repeat a Confluence fetch as two different identities (Bearer tokens)
  → cache must not leak one identity's excerpt to another (key includes auth digest).
- [ ] **LLM**: Ask Atlas returns a grounded answer citing real excerpts, not the
  simulated echo.

---

## 2. Fixture inventory (what is still not real)

Legend — **Live path?**: ✅ flips live via env · ⚠️ partial / needs data repoint ·
❌ no live path (pure fixture, by design for MVP).

> Public-safe note: the fictional org `acme` has been **de-branded to `example`**
> across data, code, tests, and docs (`github.com/example/…`, `app.terraform.io/example/…`).

### Content & registry
- [ ] **Registry** `data/{sources,anchors,topics,source-topic-mappings}.yaml` — fictional
  sample seed. ❌ (the registry *is* the source of truth; entries are just fictional).
  Validated by `pnpm validate:registry`.
- [ ] **Offline excerpts** `context-layer/src/sourceContent/pilotSourceContent.ts` —
  canned excerpt text per source class, served when no live env. ✅ (Confluence/Terraform
  replace it) / ⚠️ (policy, availability-matrix have no live provider yet).
- [ ] **Availability matrix** — parametric resolver over governed markdown; no external
  fetch. ⚠️ (data is fixture; resolver is real).

### Newsletter (single source: `data/newsletter.yaml`)
The newsletter holds two entry kinds from **one file**:
- [ ] **Releases** (`releases:`) — ✅ live via `resolveReleaseNotes` (Confluence page id).
  Auto-wired in `portal/src/api/server/releaseNotes.ts`: with the Confluence env +
  `ATLAS_RELEASE_NOTES_PAGE_ID` set it serves the live page; otherwise it falls back
  to the YAML fixture. No code change to flip.
- [ ] **Announcements** (`announcements:`) — ❌ no live path yet; offline YAML only.
  Rendered as the `/whatsnew` broadsheet and the Home "What's new" ticker. **You will
  fill / curate these.**

### Guidance (single source: `data/guidance/*.yaml`)
- [ ] **Guidance flows** — codegen'd from YAML into `portal/src/lib/guidance.data.ts`
  (`pnpm gen:guidance`, runs in `build`). ❌ no live guidance backend.
  Validated by `pnpm validate:guidance`. **Never hand-edit `guidance.data.ts`** — it is
  generated; edit the YAML and regenerate.

### Home (`/`)
- [ ] **Intents** (`INTENTS`) / **Popular** (`POPULAR`) — fictional, intentional copy. ❌
- [ ] **Recently viewed** — ✅ **real**: this browser's click history (`localStorage`).
- [ ] **What's new ticker** — sourced from the newsletter announcements.
- [ ] **Stats** (services / domains / regions) — ✅ **real**, from the availability projection.
- [ ] **Lifecycle / JourneyGrid** — static nav scaffolding. ❌ (intentional).

### Source detail (`/sources/$id`)
- [ ] **Key sections** — ✅ **real**: live-resolved excerpts from the context bundle.

### Operations dashboard (`/overview`)
- [ ] `lib/ops.ts` — ❌ entirely demo, **labeled** with a "demo snapshot" badge + frozen
  timestamp. Out of MVP scope.

### Ask Atlas
- [ ] **Answers** — ✅ live via Bedrock/RAI; offline = simulated echo adapter. The MVP
  router itself does **not** synthesize (no `ATLAS_ASK_LLM` references in the Ask UI).
- [ ] **Contact channels** (`/ask`) — ❌ fictional, derived from the owning team name.

---

## 3. The agent / API layer (machine consumers)

Backed by the **existing** Context API — not by scraping the React UI. All surfaces
exist and are **proven usable by a blind agent** (§5). Discovery starts at the
homepage `Link` header / `llms.txt`; those are signposts — the capability lives in
what they point to.

### Surfaces

| Surface | Path | What it is |
|---|---|---|
| Crawler entry | `GET /` `Link` header | advertises the 6 surfaces below (rel= values) |
| llms.txt | `/llms.txt` | DevEx signpost → OpenAPI, api-catalog, MCP, agent-skills, pages |
| API catalog | `/.well-known/api-catalog` | RFC 9264 linkset → OpenAPI (service-desc), llms.txt, health |
| OpenAPI 3.1 | `/openapi.json` | full contract; derived from `@atlas/schema`; inlines vocabulary + warning glossary + Bearer pipe |
| MCP | `POST /mcp` | stateless JSON-RPC; 4 read-only tools; server card at `/.well-known/mcp/server-card.json` |
| Agent skills | `/.well-known/agent-skills/index.json` + `…/atlas-context-consumer/SKILL.md` | RFC v0.2.0; SHA-256 digest verified from bytes |
| Sitemap / robots | `/sitemap.xml`, `/robots.txt` | canonical pages; `robots` disallows `/api` (crawler boundary, not an access boundary) |

### Capabilities the agent layer enables

| Capability | Enabled by | Why it matters |
|---|---|---|
| Discover with zero prior knowledge | `Link` header → llms.txt / api-catalog / sitemap | the agent learns everything from the wire; no UI scraping |
| Self-installing skill | agent-skills index + `npx skills add` | SHA-256 digest recomputed from bytes and **verified before trust** |
| Structured, token-bounded reads | MCP 4 tools, CONCISE/DETAILED + pagination | semantic ids not UUIDs; read-only; <25K tokens |
| **Governed honesty propagates to the agent** | every Excerpt carries a Citation; `warnings[]` relayed verbatim | the agent **cannot lie** — cited, freshness-stamped excerpts; no synthesis ⇒ no hallucination |
| One contract, many consumers | Portal and Skill consume the same bundle (ADR-0011) | reskin / new consumer ⇒ no contract change |
| OpenAPI self-sufficient | spec `description`s carry the conduct rules | the skill is convenience, not a dependency |

**Honest boundary:** no bespoke Terraform generation (returns a cited module + starter;
behind `ATLAS_ASK_LLM`, not MVP); no write MCP tools; no auth (identity-agnostic Bearer
pipe, Confluence's ACL governs visibility).

---

## 4. Demo commands (copy-paste)

### Start the server
```bash
# Production build (the deployable path; regenerates agent-skills digests).
cd portal && pnpm build
# Self-locating data dir — no env, no symlink needed locally (see §7).
PORT=3201 node .output/server/index.mjs &
curl -s localhost:3201/health                       # {"status":"ok"}
# Offline-by-default; add the §1 env vars to flip a surface live.
```
(Or, for iteration: `pnpm --filter @atlas/portal dev` → http://localhost:3000.)

### Human-layer / Context API (grounded, cited)
```bash
# discover a service
curl -s "localhost:3201/api/topics?query=textract" | jq '.topics[].id'
# the context bundle — cited excerpts + warnings[] (governed honesty)
curl -s "localhost:3201/api/topics/aws-textract/context?disclosure_level=2" \
  | jq '{excerpts:[.sources[].excerpts[]|{text:.text[0:60],cite:.citation.location}], warnings}'
```
Expected: a cited Terraform starter (with `private_subnet_ids`), the
`#private-subnet-usage` excerpt, and `warnings[]` = `stale_source` + `source_unavailable`.

### Agent-layer discovery (walk it yourself)
```bash
# 1. the blind entry point — 6 advertised surfaces
curl -sI localhost:3201/ | grep -i '^link'
# 2. the signpost
curl -s localhost:3201/llms.txt
# 3. the linkset
curl -s localhost:3201/.well-known/api-catalog | jq .
# 4. the skill + digest, then VERIFY the digest from bytes
curl -s localhost:3201/.well-known/agent-skills/index.json | jq '.skills[]|{name,digest}'
curl -s localhost:3201/.well-known/agent-skills/atlas-context-consumer/SKILL.md | shasum -a 256
#   → must equal sha256:9bfeca68085cffbdbcf5042d81842fe597fd615e913dee486a603907fc665b1e
# 5. the machine contract
curl -s localhost:3201/openapi.json | jq '{openapi, paths:(.paths|keys)}'
# 6. MCP — list the 4 read tools, then call one
curl -s -X POST localhost:3201/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[].name'
curl -s -X POST localhost:3201/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"atlas_get_availability","arguments":{"zone":"aws","service_query":"textract"}}}' \
  | jq '.result.structuredContent.services'
#   → Amazon Textract: us-east-1 available, ca-central-1 available
```

### Blind-agent replay (the climax)
Give any capable agent CLI exactly two facts — the origin + a question
(`"Can AWS Textract run in a private subnet, and which regions is it available in?"`) —
and forbid local-file access and path-guessing. Require the discovery-chain log in the
report. See §5 for a captured run. Tear down: `pkill -f ".output/server/index.mjs"`.

---

## 5. Blind-agent E2E (verification)

Reproduced 2026-06-24 with a deliberately low-capability model (claude-haiku) — *if a
weak model can self-navigate, the discoverability is in the protocol, not the model.*
Given only the origin + the question, it walked the whole chain and produced a cited
answer.

```
GET /  (Link header → 6 surfaces; published host portal.example.com → substituted localhost)
 ├─ /llms.txt                  → API "start here" + skill + pages
 ├─ /.well-known/api-catalog   → /openapi.json (service-desc), /health
 ├─ /.well-known/agent-skills/index.json → skill + sha256 digest
 │    └─ GET SKILL.md → shasum -a 256 → 9bfeca68… == advertised digest  ✓ MATCH
 │         → learned workflow: /api/topics?query= → /api/topics/{id}/context ; MCP tools
 ├─ /openapi.json              → REST contract + /mcp
 └─ POST /mcp initialize → tools/list → 4 read tools incl. atlas_get_availability
   --- applying the discovered workflow ---
 GET /api/topics?query=textract                        → topic "aws-textract"
 GET /api/topics/aws-textract/context?disclosure_level=2 → cited excerpts + warnings[]
 POST /mcp tools/call atlas_get_availability {zone:aws,service_query:textract} → regions
```

**Final answer it produced** — private subnet: **Yes**, cited
`example/terraform-aws-textract#private-subnet-usage` + the Terraform starter
(`endpoint_type="interface"`, `private_subnet_ids`); regions: **us-east-1**,
**ca-central-1** (both available); and it relayed `stale_source` +
`source_unavailable` **verbatim**, adding nothing from its own AWS knowledge.

**What it proves:** discoverability + governed-honesty conduct are carried by the
protocol and the contract, not by model intelligence.

---

## 6. MVP demo walkthrough (functional)

Run offline (fixtures) unless a step calls for live env.

### Home `/`
- [ ] Stats show real counts from availability.
- [ ] "Recently viewed" is **empty on first load**; after opening a service/source it
  appears with real chips.
- [ ] "What's new" ticker scrolls the newsletter announcements; clicking lands on `/whatsnew`.

### Catalog `/catalog` → `/catalog/$topicId`
- [ ] Topic detail "References" lists registered sources with **real excerpts** (multiple
  per source at `disclosure_level: 2`), selection rationale, authority + freshness badges.
- [ ] A topic with no registered source shows the "claims unverifiable" empty state.
- [ ] **The moat:** the seeded Textract private-subnet authority conflict surfaces **both**
  sources, picks no side; a `stale_source` badge ages a curated claim honestly.

### Sources `/sources` → `/sources/$id`
- [ ] "Key sections" shows real resolved excerpts + "open source" links (offline = pilot
  fixtures; live = Confluence/Terraform).
- [ ] Restricted source shows metadata-only notice; no excerpt leakage.
- [ ] Freshness badge reflects review window; stale source warns.

### Guidance `/guidance` → `/guidance/$id`
- [ ] Index lists the real flows (no proto extras).
- [ ] Detail renders the stepper; each step's evidence rows show source title + badges
  on a plain background (no card), linking to the source detail.

### What's New `/whatsnew` and `/releases/$id`
- [ ] Broadsheet renders announcements (lead / secondary / today / earlier briefs + rail
  tally) — all from the newsletter announcements.
- [ ] "Platform releases" section lists releases grouped by month from the same file.
- [ ] Release brief title is a **date** (e.g. "11 Jun 2026"), not a CHG ticket.

### Ask Atlas
- [ ] Offline: returns a grounded simulated answer citing a real excerpt (no synthesis).
- [ ] Live (Bedrock/RAI): returns a real answer; every claim links to its source.

### Agent layer
- [ ] The §4 discovery curls all return as specified; the skill digest verifies.
- [ ] The blind-agent replay (§5) completes end-to-end and relays warnings verbatim.

---

## 7. Production-build notes & the data-dir fix

Demo via `vite dev` "just works". The deployable path (`pnpm build && node .output/…`)
had **two real defects, now fixed** — both surfaced by the blind-agent run:

- **Stale `.output` schema drift.** A pre-built `.output` carries an older
  `@atlas/schema` that rejects current manifests (`availability-matrix` source_class,
  `availability-cell` / `module-field` anchors). **Always `pnpm build` before serving;
  never demo off a checked-in `.output`.**
- **Data-dir resolution didn't survive bundling.** `DATA_DIR` was a fixed
  `join(here,"..","..","..","data")` — correct in source, but the bundled server in
  `portal/.output/server/_chunks/` walked to a non-existent `portal/data`, and the build
  did not copy `data/`. **Fixed** in `context-layer/src/dataDir.ts` (`resolveDataDir`):
  `ATLAS_DATA_DIR` override → **self-locate** by climbing to the first ancestor holding
  `data/sources.yaml` → relative default. Now `pnpm dev`, `node .output/server/index.mjs`,
  and Docker all resolve data with **no env and no symlink**. The Dockerfile additionally
  `COPY`s `data/` beside the bundle and sets `ATLAS_DATA_DIR=/var/task/data` (override to
  a mounted volume to change data without a rebuild — ADR-0007).

### Pre-flight (run before any production-server demo)
```bash
pnpm -r typecheck && pnpm -r test          # green (note: the S3/Textract hard gate may be WIP)
pnpm validate:registry && pnpm validate:guidance
echo "$ATLAS_ASK_LLM"                        # empty ⇒ Ask does not synthesize
cd portal && pnpm build                      # MANDATORY — fresh bundle
PORT=3201 node .output/server/index.mjs &    # self-locating data; no env/symlink
curl -s localhost:3201/health                # {"status":"ok"}
# then run the §4 curls and the §5 blind-agent replay
```

---

## 8. Known presentation gaps (carry-over from the conformance review)

- **Demo-data honesty.** Availability maintenance windows and Ask contact channels are
  fictional but render **as if real** (their code comments say "fictional", the UI shows
  no badge). `DESIGN.md #6` wants ship-state honesty. Add a shared `demo/seed` chip (reuse
  the `/overview` badge) or avoid these surfaces in a grounded demo. ✅ `/overview` and
  `/skills` already badge / don't fabricate.
- **Surfaces ahead of the spine.** The UI is more complete than the proven grounded slice
  (`mvp §6`: "looks finished and is unproven"). Demo the hero spine (Catalog → Sources →
  Availability → Guidance for API Gateway / S3 / Textract); badge or avoid deferred
  surfaces (`/overview`, `/skills`).
- **`acme` de-branding — ✅ done** (now `example`).

---

## Cross-cutting checks
- [ ] `pnpm -r lint` and `pnpm -r test` pass (S3/Textract hard gate may be in progress).
- [ ] `pnpm validate:registry` and `pnpm validate:guidance` pass.
- [ ] `pnpm --filter @atlas/portal build` succeeds (runs `gen:guidance` + `gen:agent-skills`).
- [ ] With live env set, at least one Confluence and one Terraform source resolve end-to-end.
- [ ] The §4 agent-layer curls return as specified; skill digest verifies.
</content>
