# Atlas — Demo Readiness Review & Blind-Agent Discovery Trace

> Date: 2026-06-24 · Branch: `codex/MVP-source-loop`
> Scope: (1) strict conformance review of the current presentation against the
> project's own guidelines; (2) MVP definition; (3) the two-layer architecture
> (human Portal + agent/API) and what the agent layer enables; (4) a demo script;
> (5) a **real, reproduced** blind-agent discovery trace + the production-build
> defect it surfaced.

---

## 0 · TL;DR

- **The presentation runs ahead of the proof.** `mvp-product-design.md §6` says it
  plainly: *"The product looks finished and is unproven."* Design / voice / domain
  vocabulary conformance is high; the agent layer is the strongest-conforming part
  and is **demonstrably real** (a blind *haiku* model self-navigated the whole thing
  from one URL). The real gaps are (a) **demo-data honesty on a few surfaces**,
  (b) **surfaces built ahead of the grounded spine**, (c) a **public-safe `acme`
  debt**, and (d) a **production-build defect** that blocks the `.output` server
  path until fixed.
- **Demo in two acts:** human wayfinding through one hero service → the *same*
  question answered by a blind agent over the API. Lead with governed honesty
  (citations + verbatim warnings); that is the moat.

---

## 1 · Strict review — does the presentation conform to the guidelines?

Guidelines in force: `DESIGN.md` (Blueprint/Ink), `PRODUCT.md` (voice + anti-refs),
`docs/product/guideline.md` (north star), `docs/product/mvp-product-design.md`
(wayfinding + governed honesty), `CONTEXT.md` (ubiquitous language), ADR-0005/0006.

### 1.1 Conformance table

| Guideline (source) | Verdict | Evidence / issue |
|---|---|---|
| Information-centric, not provisioning (`guideline.md`) | ✅ | Read-only; points to TFE/Harness, never executes; action labels Open/View/Copy not Submit/Apply |
| Wayfinding is the center of gravity (mvp §2) | ✅ | Home→Catalog→Source→Availability answers what/who/where/how-fresh |
| Governed-honesty four mechanisms (ADR-0006) | ✅ mechanisms, ⚠️ see 1.2#1 | citation / freshness / authority-conflict / dead-end all present in components and **verified live in the bundle** |
| Blueprint/Ink design system (`DESIGN.md`) | ✅ | single brand `#001AFF`, Inter + tabular-nums, 32px negative-space grid, no shadow at rest, `reducedMotion="user"` |
| Voice authoritative/precise/calm; anti-DevRel-marketing (`PRODUCT.md`) | ✅ | Home hero is the ADR-0005-sanctioned "welcoming" register; stats are **real loader data**, not vanity metrics; motion restrained |
| `capability` purged → `service` (§13) | ✅ done | **0** occurrences in live `src` (verified) |
| Public-safe de-branding (§13 / CLAUDE.md rule 1) | ❌ **not done** | `acme` still in 13+ files: `data/topics.yaml`, `data/sources.yaml`, `pilotRegistry.ts`, `openapiDocument.ts`, guidance, fixtures… |
| Ship-state honesty: no decorative state unless wired to real data (`DESIGN.md` #6) | ⚠️ **partial** | see 1.2#1 |
| MVP makes the spine real **without expanding the surface** (§6) | ⚠️ **tension** | see 1.2#2 |
| Agent readiness (4 surfaces) | ✅ **strongest** | blind-agent E2E walks the full chain; reuses `CONTEXT.md` vocabulary verbatim; never advertises non-existent surfaces |

### 1.2 The three gaps that matter (ordered by demo risk)

**① Demo data is honest in code, not on screen — highest risk.**
`region-detail.tsx:238` comments *"Deterministic, fictional region profile"*;
`ask.tsx:12` comments *"fictional, public-safe mock"*. The code is honest, but the
UI renders `maintenance.window` and contact channels **as if real**, with no on-screen
"demo seed" badge. This collides with `DESIGN.md #6`. Contrast: `/overview` *does*
carry a demo badge and `/skills` does **not** invent install counts — so the standard
is yours, it's just not applied to Availability / Ask.
→ Fix: one shared `seed/demo` chip (reuse the overview badge) on every fixture-derived
surface, or don't click into them during a demo.

**② Surfaces are ahead of the spine — this decides how to demo safely.**
11 routes exist (incl. Overview / Skills / Releases), but §9 marks Overview/Skills
*Secondary/deferred* and Ask *no-LLM-synthesis*. Risk: clicking into an un-grounded
surface mid-demo breaks the "never lies" promise. This is **demo discipline**, not a
bug. → Fix: demo the proven spine only (Act 1 below); badge or avoid the rest.

**③ `acme` public-safe debt.** 13+ files still carry `acme` (including the
outward-facing `openapiDocument.ts` and pilot data). §13 lists it "to be de-branded."
→ Fix: one-shot rename to a neutral fictional org (`example`/`globex`) + a CI guard
(§13 #17 is already an open item).

> ✅ Cleared by inspection: Ask components contain **0** `llm/synthes/ATLAS_ASK_LLM`
> references — Ask is genuinely a ranked-citation router (conforms). `capability` is
> fully purged. Neither is a concern.

---

## 2 · How to define the MVP

**One line:** *MVP = make the spine real, do not add surfaces.* The product already
looks done; the only job is that every claim provably comes from a registered, cited,
freshness-stamped Source on the hero slice.

### Done-bar (`mvp-product-design.md §14`, tightened)

```
MVP-done ⟺ all of:
1. pilot data manifest-driven + validated (pilotRegistry.ts no longer the truth source)
2. Confluence excerpts + Availability matrix resolve from real pages, with citation + freshness/drift warnings
3. terraform-module is a citable Source (module-field metadata + markdown-heading README)
4. Portal and an external Skill pass the bundle-equivalence suite (ADR-0011) — public proof of "one contract, many consumers"
5. one hero route live + registry-backed; one authority conflict surfaced (Textract private-subnet)
6. ★HARD GATE: API GW / S3 / Textract — a consuming agent completes
   discover → read fit → cited terraform-module starter → open governed route,
   entirely from registered cited Sources, zero synthesis
   (packages/atlas-acceptance / v1Acceptance.test.ts is the guard)
7. pnpm lint / typecheck / test clean
```

### Two-layer Definition of Done (directly answers "one layer human, one layer agent")

| Layer | MVP-done criterion |
|---|---|
| **Human (Portal)** | the three hero datasheets render a cited terraform starter + a User-guide link + a linked adoption route; conflict / stale visible |
| **Agent / API** | a blind agent, from the wire alone, walks discover → skill → API → MCP and produces a cited answer that relays warnings verbatim (proven below) |

**Explicitly OUT of the MVP:** cloud deploy (public repo doesn't deploy); bespoke
Terraform generation (behind `ATLAS_ASK_LLM`, deferred); Phase-2 broad-scan /
classifier; the source-lifecycle reconciler (`source-lifecycle-design.md` is
self-labeled **post-MVP**); write-capable MCP tools; auth/identity.

> ⚠️ Confirm before claiming done: `mvp-handoff.md` still lists the
> **bundle-equivalence suite** as *remaining*. Verify it and `v1Acceptance.test.ts`
> are green — trust the tests, not the docs.

---

## 3 · The two layers & what the agent layer enables

The project draws this itself (`goal_prompt_agent_readiness.md`):

```
human    → Portal React UI
AI agent → /.well-known/agent-skills + /openapi.json + /mcp   ┐
crawler  → /robots.txt + /sitemap.xml + Link headers          ├─ one governed, citation-backed Context API bundle
all three are just consumers of the same bundle               ┘
```

Yes — discovery starts at `llms.txt` (and the rest of the well-known set). But
`llms.txt` is only the **signpost**; the capability lives in what it points to. All of
it exists and is **proven usable by a blind low-IQ model** (§5).

### Capabilities the agent layer enables (each tied to a real surface)

| Capability | Enabled by | Why it's differentiated |
|---|---|---|
| **Discover with zero prior knowledge** | `GET /` `Link` header → `llms.txt` / `api-catalog` (RFC 9264) / `sitemap` / `robots` | the agent knows nothing; it learns everything from the wire — no UI scraping |
| **Self-installing skill** | `.well-known/agent-skills/index.json` + `SKILL.md`, `npx skills add` | SHA-256 digest recomputed from bytes and **verified before trust** |
| **Structured, token-bounded consumption** | `/mcp` 4 read tools (`atlas_search_service` / `get_source` / `get_availability` / `get_context_bundle`), CONCISE/DETAILED + pagination | semantic ids not UUIDs; <25K tokens; read-only (`readOnlyHint`), no write tools |
| **Governed honesty propagates to the agent** | every Excerpt carries a Citation; `warnings[]` must be relayed verbatim | **the agent cannot lie** — it gets cited, freshness-stamped excerpts; no synthesis ⇒ no hallucination |
| **One contract, many consumers** | Portal and Skill consume the same Context API; bundles byte-equivalent (ADR-0011) | reskin / new consumer ⇒ no contract change; `openapi.json` is the single source of truth |
| **OpenAPI is self-sufficient (skill optional)** | the no-skill E2E variant learns citation pairing, warning semantics, Bearer pipe, call order from the OpenAPI `description`s alone | the skill is convenience, not a dependency |

### Honest boundary (state it before you're asked)
- ❌ No bespoke Terraform generation — returns a cited module + starter; the consumer
  agent fills module inputs (behind `ATLAS_ASK_LLM`, not MVP).
- ❌ No write MCP tools. ❌ No auth — the Bearer pipe is identity-agnostic; Confluence's
  own ACL governs visibility.
- ⚠️ Known frictions (`agent_readiness_e2e_example.md`): published URLs use the fictional
  host `portal.example.com` (substitute origin); `robots Disallow /api` vs `llms.txt`
  inviting API calls (intentional — robots isn't an access boundary); MCP answers
  `initialize` with its own protocol version instead of echoing the client's.

---

## 4 · How to demo

**Principle:** lead with the moat (governed honesty), then show the two-layer
symmetry. Drive the whole demo with one question:

> *"Can AWS Textract run in a private subnet, and which regions is it available in?"*
> (chosen because it triggers both the seeded **authority conflict** —
> module README ⟷ Confluence runbook — and an **availability** query.)

### Act 1 — Human layer (Portal, ~4 min)
1. Home, search "textract" → datasheet `/catalog/aws-textract`.
2. Point out the wayfinding facts: what / who owns / where authoritative / how fresh.
3. Scroll to the **cited Terraform starter** (from the `terraform-module` Source,
   `#terraform-starter`) + the **User guide** link + the **adoption route** link.
4. **Show the moat** — the seeded **authority conflict**: two Sources, Atlas surfaces
   **both and picks no side**; then point at a `stale_source` / `restricted_source`
   badge. This 30 seconds is the most valuable in the demo — it's the difference from
   Backstage / Glean / a wiki.
5. `/availability` → Textract's regions (real parsed data).

### Act 2 — Agent layer (blind agent, ~4 min) — the climax
Replay the protocol in §5: give the agent only the origin + the question; it discovers,
installs the digest-verified skill, calls the API + MCP, and answers with citations,
relaying warnings verbatim.

**Close:** same question, same governed truth — the human got a datasheet, the agent
got a cited bundle. *One contract, two renderings. Atlas makes the agent unable to lie.*

### Talking points & landmines
| Do | Don't |
|---|---|
| Lead with the conflict + stale badge (the moat) | ❌ click into `/overview` (fictional ops), maintenance windows, or Ask synthesis |
| Stress: both layers, one bundle behind them | ❌ demo any un-grounded surface without a demo badge |
| State the honest boundary (no bespoke TF gen) | ❌ claim "it writes the Terraform for you" |
| Run the blind agent live; don't screenshot | ❌ trust "tests are green" — pre-flight for real |

### Pre-flight (run the night before)
```bash
pnpm lint && pnpm typecheck && pnpm test       # incl. v1Acceptance.test.ts hard gate
echo "$ATLAS_ASK_LLM"                           # must be empty (Ask must not synthesize)
cd portal && pnpm build                         # MANDATORY — do not serve a stale .output (see §6)
ln -sfn ../data portal/data                     # prod server reads data at portal/data (see §6)
PORT=3201 node .output/server/index.mjs &
curl -s localhost:3201/health                   # {"status":"ok"}
# then replay the blind-agent run in §5 and keep the discovery-chain log
```

---

## 5 · Blind-agent discovery trace (haiku, 2026-06-24, reproduced)

**Setup.** Production build on `http://localhost:3201`. A subagent was given **exactly
two facts** — the origin URL and the question — and forbidden from reading any local
file or guessing any path from memory (only standard web conventions allowed as entry
points). Model: **claude-haiku-4-5** (deliberately a low-capability model — *if a weak
model can self-navigate, the discoverability is in the protocol, not the model*).

**Result: it walked the entire chain and produced a correct, cited answer.**

### Discovery chain (as actually walked)
```
GET /  (Link header → 6 surfaces; published host portal.example.com → substituted localhost:3201)
 ├─ /llms.txt                              rel="llms-txt"     → "API start here" + skill + pages
 ├─ /.well-known/api-catalog               rel="api-catalog"  → /api anchor, /health
 ├─ /.well-known/agent-skills/index.json   rel="agent-skills" → skill atlas-context-consumer + sha256 digest
 │    └─ GET SKILL.md → shasum -a 256 → 9bfeca68… == advertised digest  ✓ MATCH
 │         → learned workflow: /api/topics?query= → /api/topics/{id}/context ; MCP alternatives
 ├─ /openapi.json                          rel="service-desc" → REST contract + /mcp
 └─ POST /mcp  initialize → tools/list     rel="mcp-server"   → 4 read tools incl. atlas_get_availability
   --- then, applying the discovered workflow ---
 GET /api/topics?query=textract                        → topic id "aws-textract"
 GET /api/topics/aws-textract/context?disclosure_level=2 → cited excerpts + warnings[]
 POST /mcp tools/call atlas_get_availability {zone:aws,service_query:textract} → regions
```

### The agent's final answer (verbatim substance)
- **Private subnet? Yes** — cited `textract-module-readme#private-subnet-usage`
  ("Use the Textract module with private endpoint configuration for private subnet
  workloads.") + the Terraform starter (`endpoint_type = "interface"`,
  `private_subnet_ids = var.private_subnet_ids`, `#terraform-starter`) + module
  version `1.4.0` (`#version`).
- **Regions** — from `atlas_get_availability`: **us-east-1** (available),
  **ca-central-1** (available); exactly those two, nothing invented.
- **Warnings relayed verbatim** — `stale_source` ("Source is past its review
  frequency.", `platform-reference-guide`) and `source_unavailable` ("Source content
  is unavailable at request time.", `platform-reference-guide#pilot-limitations`).

**What it proves:** discoverability + governed-honesty conduct are carried by the
**protocol and the contract**, not by model intelligence. A weak model, knowing only a
URL, installed a digest-verified skill and produced a fully cited, warning-relaying
answer with no synthesis.

---

## 6 · Defect surfaced by the run — the `.output` server path is broken until fixed

The blind run failed at the *resolution* step (discovery was already complete),
exposing **two real issues** in the production-build serving path. Dev (`vite dev`)
does **not** hit either — only the deployable `pnpm build && node .output/...` path does,
which is exactly the path you'd ship.

**Issue A — stale `.output` schema drift.** Once data was reachable, the bundled
`@atlas/schema` (pre-ADR-0009/0010) **rejected the current committed manifests**:
```
Invalid registry manifest in .../portal/data:
- sources.yaml:availability-matrix:source_class        ← ADR-0009 (new source_class)
- anchors.yaml:availability-*:anchor_strategy          ← availability-cell parametric anchor
- anchors.yaml:textract-module-version:anchor_strategy ← ADR-0010 module-field
```
Root cause: a stale checked-in/old `.output`. **Fix: always `pnpm build` before serving;
never demo off a pre-built `.output`.** Consider gitignoring `.output`.

**Issue B — `DATA_DIR` source-relative path doesn't survive bundling.**
`context-layer/src/seeds/loadRegistryFromManifests.ts:25`:
```js
export const DATA_DIR = join(here, "..", "..", "..", "data");
```
In source/dev this resolves to repo-root `data/` (✓). Bundled into
`portal/.output/server/_chunks/`, the same 3-level walk lands at **`portal/data/`** (✗),
and the build does **not** copy `data/` into the output — so the production server
404s on its own manifests. **Fix options:** (a) make it env-configurable
(`ATLAS_DATA_DIR`) with a sane default; (b) copy `data/` into the build output / Docker
image at `portal/data`; (c) local stopgap used for this trace: `ln -sfn ../data portal/data`.

Net: **demo via `vite dev` works today; demo via the production build needs both fixes.**
Add them to the pre-flight (§4) or the demo will fail on first query.

### Operator notes (this session)
- A `portal/data → ../data` symlink was created as the local stopgap and left in place;
  remove it (`rm portal/data`) or replace it with a real build-time copy / env var.
- The portal server is left running in the background on `:3201`
  (`pkill -f ".output/server/index.mjs"` to stop).
</content>
</invoke>
