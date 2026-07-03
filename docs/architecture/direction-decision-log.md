# Direction Decision Log

> **Purpose.** The owner's rulings made during and after the Direction Analysis
> (`FABLE-DIRECTION-ANALYSIS-PROMPT.md`) and the design step (`FABLE-DESIGN-BRIEF.md`).
> Numbering continues `PROJECT-CONTEXT-PACK.md` §9 (P1–P6, the pre-analysis priors); entries here
> are **newer** and win on conflict (newer-wins rule). The pack itself stays a snapshot of the
> pre-analysis state and is not updated with these.
> Design realization: `docs/architecture/unified-product-architecture.md`.

## Rulings of 2026-07-02 (direction analysis + design step)

- **P7 — Persistence boundary reframed.** "Never mirror durably" is narrowed to its original
  intent: **source content is never durably stored + stale is never served as fresh.** Both a
  cross-boot **discovery snapshot** (real `resolvedAt`, drift recomputed on every read) and a
  **Git curation overlay** (ADR-0007 seam) are legal *projection metadata* under ADR-0013 §2.
  plan-018's anti-seed rule was about repo seeds masquerading as truth, not runtime persistence.
- **P8 — Next-arc organizing principle: Estate Model as the center, curation at minimal dose,
  seam closure unconditional.** The near-term moat narrative rides on the governed estate
  structure (LZ × service × availability × modules × policies, discovery-derived, cited) —
  structurally unavailable to a wiki/knowledge center. *(P8's estate model is generalized by P13;
  its "minimal dose" curation phrasing is superseded by P14.)*
- **P9 — Hero scope anchor: APP, not LZ, as the user-facing unit — layered landing.** The
  engineer's real context is *"adopt a service in **my APP**"*; the LZ is derived from the APP
  (re-seats ADR-0012's entry shape). Product language + journey anchor on APP; resolution scope
  stays LZ under an app→LZ mapping; entry degrades to manual APP pick until identity/Entra is
  wired. `ResolutionContext.scope.appId` moves from reserved to intended fill. Gating fact: does
  a discoverable company-side APP→LZ source of record exist? If not, the mapping lives in the
  curation-overlay exception (P14), never a hand-maintained shadow registry.
- **P10 — Seam closure mode: in-process call + the same governed `ResolutionContext`.** The
  Portal's in-process client constructs the identical context the HTTP path builds (Bearer +
  shared Valkey cache + scope) and calls handlers directly; face equivalence is enforced by CI
  contract tests (ADR-0011 spirit). `CONTEXT_API_BASE_URL` stays as the deployment-split option.
  Always-loopback-HTTP rejected (cost without governance gain).
- **P11 — Status enters as a thin index (pointers only).** Atlas holds per-resource/per-APP
  records of *where status lives* (`{system, kind, url}`), discovery-derived where landable;
  status **values** are live-resolved on demand, never stored/aggregated/historized; ADR-0003
  unchanged. *(Generalized by P13 into the operational-location index.)*

## Rulings of 2026-07-03 (unified model)

- **P12 — Product definition sharpened: Atlas externalizes the developer's in-head context
  merge.** Daily platform work = hunting docs/links/statuses and merging them mentally into a
  context; Atlas **proactively performs that merge** — contexts + knowledge + status into
  situated context — and leaves **judgment to the developer and their AI agent**. The dev loop
  has four context moments: **onboard/adopt · build · debug · change**. The win over any
  wiki/knowledge-center is categorical, not incremental: a wiki answers "what did the org write
  about X"; Atlas answers "what does X mean **for me, here, now**".
- **P13 — One core, four bindings.** The product is ONE assembly engine: **context graph**
  (substrate: APP/service/LZ/guardrail/module/source + operational locations, all edges
  discovered) + **moment briefs** (contract: per-moment assembly templates, face-neutral). Every
  surface is a binding on (consumer: human|agent) × (trigger: pull|push): Portal page, MCP moment
  tools, push briefs, change feed. 一体两面 = the two consumer rows (both built, not sequenced);
  "主动" = the push column. Briefs are pure views over resource reads (ADR-0014 §2) — they own no
  content and are never separately editable. P9's adopt journey = one of four moment templates;
  P11's status index generalizes to the **operational-location index**.
- **P14 — Data constitution: discover or fetch, never maintain.** Every node/edge must answer
  "where were you discovered from" — the graph itself is Evidence (cited, aging, drift-checked).
  Curated fields derive as provenance wherever a source can yield them (page owner, module
  publisher); the Git overlay demotes from "minimal dose" (P8) to **exception-only fallback** for
  fields with no derivable source. Review-decay's applicable surface trends to zero by design.
- **P15 — Assembly invariant: structure may encode the question; content never encodes the
  answer.** Briefs may be decision-shaped (options × constraints × evidence, discovered from
  platform structure), with deterministic ordering (authority, freshness) — but no recommendation,
  ever. Debug-moment honesty: Atlas answers "what the platform knows about this error class +
  where everything lives", never promises root cause.
- **P16 — Discovery SPOF endgame: multi-root degradation now, convention→contract structurally.**
  Discovery roots (availability page, TFE registry, Confluence listings, APP registry) are
  independent; one root failing ages ONE subgraph (honestly-aged per P7: last good parse + loud
  staleness banner, real `resolvedAt`), the rest stay live. Parse-contract tests against real
  page fixtures alarm in CI, not silently in prod. Structural fix: flip scraping conventions into
  a **published context contract** that source systems commit to and validate on their side.
- **P17 — Consumer state is the third data class; the APP entry bootstraps self-declared.**
  (Closes the high-level design.) P14's constitution governs **platform context**; data a consumer
  writes about themselves — Feedback, **self-declared APPs** (name + LZ + services-in-use, always
  labeled `self-declared`, never presented as discovered), **subscriptions** — is **consumer
  state**: durable, legitimately owned by Atlas, never Evidence. A registry-backed APP record
  upgrades a self-declared one in place (provenance in, label out); P9's gating fact (company APP
  registry) demotes from blocker to upgrade path. With P17, the high-level design (APP as scope
  entity, first-class graph edges, the `/api/briefs/{moment}` endpoint family, the change-feed
  event model with per-root diff chains, subscriptions) is **CLOSED** into
  `unified-product-architecture.md`; mid-level design proceeds in `mid-level-design.md`.
- **P18 — Context means content; pointers are the honest floor, not the product bar.** (Owner:
  "a platform that only provides links is still just a map; to provide context you must have the
  content.") "Have" splits into **storage** (forbidden, P7/P14) and **access** (the product):
  the "fetch" in *discover-or-fetch* IS the content path. The bar for every moment brief is
  **assembled content** — platform knowledge as cited Evidence excerpts; operational values
  (status, log excerpts) live-fetched, displayed read-only, uncited, visually separated
  (ADR-0003 unchanged). Pointer-only blocks are the labeled degraded state wherever fetch access
  is not yet landable — never the target. Consequently: the Negotiate track's aim is **fetch
  access** per source (not link inventories), and the debug moment's target capability includes
  fetched values, with the location index as its floor.
- **P19 — Sequencing is pain-point-driven; data-source coverage is the platform's real
  foundation. Roadmap deferred; build paused.** Three roadmap drafts were rejected and deleted:
  they sequenced the *engine*, but a context platform = **source coverage × engine**, and today
  only ~2.5 sources are landed (the `awsf` availability page, the TFE registry, the
  security-Confluence policy references). The owner collects **real pain points first**; they
  determine which moments/sources matter and thereby which fetch-access negotiations to run —
  the roadmap grows out of that data instead of being authored. Pain-point record format (each
  entry): ① the engineer's literal words · ② which moment it belongs to (or none — which
  falsifies the four-moment hypothesis) · ③ which source system would answer it · ④ whether
  fetch access to that source exists today. The design record (P1–P18, high-level CLOSED,
  mid-level M1–M10) stands as settled and **source-agnostic**; it is revisited only when build
  starts or pain-point data contradicts an assumption.

## Rulings of 2026-07-03 (post-design ratifications, owner-approved)

- **P20 — Agent is the front door; the Portal is the trust surface.** Both faces stay Required
  (P13 unchanged). What changes is the success metric: agent call share + time-to-brief, not
  portal page views. The Portal's irreplaceable value is verification — citations, estate
  browsing, subscriptions, feedback. P3's mandate governs what ships (the Portal ships
  complete); this ruling governs what is measured and optimized.
- **P21 — Situation anchors in the repo; portal self-declare is the fallback.** A minimal repo
  manifest (APP name + landing zone + services-in-use) becomes a consumer-state source — P17
  extended, not reversed: same `self-declared` labeling, same in-place registry upgrade. Agents
  bootstrap from the working directory; PR review is the maintenance surface. Portal
  self-declare remains for non-repo situations.
- **P22 — The context contract is the terminal supply shape; scraping adapters are labeled
  shims.** Contract v0 is authored now and carried into every fetch-access negotiation
  (the Negotiate track aims for "expose per contract", not just "grant read"). Every scraping
  adapter carries an explicit retirement condition: its source's contract landing.
- **P23 — P19's "build paused" narrows to "engine expansion paused".** The instrument-grade
  subset resumes build: seam closure (P10), per-root snapshot + parse contracts (P7/P16),
  change feed, APP declaration (P17/P21), unresolved-rate dashboard. All source-agnostic, and
  themselves the pain-point collection instruments — behavioral data over anecdotes. What stays
  paused: anything requiring a new source (debug value resolution, a second landing zone,
  per-LZ content variants). Twin track: build the instruments; collect pain points and
  negotiate fetch access with contract v0 in hand.
- **P24 — Status board = aggregation-at-read; self-service registration is its supply side.**
  "Aggregation" splits: **at-read** (a scoped board that live-fetches current operational
  values on open — displayed read-only, uncited, visually separated, never stored) is in
  scope and is P18 applied to the operational column; **at-rest** (stored values, history,
  alerting) stays Outside current product scope — ADR-0003 unchanged, owner-reconfirmed.
  Teams self-register their operational locations (`{system, kind, url, fetch mode}`) through
  a self-service surface; the records are consumer state (labeled, discovery-upgradeable,
  never Evidence), so coverage scales with team self-onboarding, not with Atlas's negotiation
  throughput — P22 in product form.
- **P25 — Implementation architecture ratified: derived from the product, not from the
  current tree.** A five-layer engine — adapters / graph / governance gate / assembly /
  representation — with exactly two growth interfaces (the adapter contract downward, the
  brief contract upward). Implementation decisions **I1–I6** and mid-level **M11–M12**
  owner-approved 2026-07-03. Realization proceeds as a **new spine + Tier-B port** of the
  proven parsing/resolution code (the 0.2.0-crosswalk precedent), not incremental patching
  of the current shape. Recorded in `implementation-plan.md` (architecture, decisions,
  build order, keep/rebuild crosswalk) and `mid-level-design.md` §10 (M11–M12).
