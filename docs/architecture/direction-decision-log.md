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

## Rulings of 2026-07-04 (multicloud + DORA calibration, owner-approved)

New inputs reviewed from first principles against the closed design: (a) the estate is
**multicloud** — the platform serves app teams across more than one cloud, one of which runs its
own doc pages, self-service portal, and RAG chatbot; (b) the DORA evidence base
(`docs/research/dora-developer-pain-2026/dora-developer-pain-analysis-2026.md`). Verdict: the
engine (P25), the data constitution (P14), the brief contract (P13/P15), and the B→Entra
sequencing all hold — they were derived from invariants that are cloud-count-independent. Four
calibrations follow.

**Audience (sharpened).** The user is the **app team on the company cloud platform, or the app
team migrating onto it** — not a "cross-cloud" role. Each team's experience is single-situated
(my app, my landing zones, now); the platform is multicloud because it serves teams on cloud A
and teams on cloud B, not because any one team compares clouds. This is the wedge P9/P12 named,
now stated in team terms.

- **P26 — The situation is multi-LZ: an APP maps to a *set* of landing zones.** "One APP → one
  LZ" was an accident of the single-cloud bootstrap, never an invariant: with two clouds, one
  APP legitimately holds deployments in several zones. `AppRecord.landingZoneId` becomes
  `landingZoneIds[]` (an LZ id already carries its cloud identity — no separate cloud
  dimension), `Brief.situation` carries the set, scope resolution yields "appId → LZ set", and
  brief traversal renders per-LZ; the repo-manifest spec (P21) declares the set. ADR-0015
  unchanged: scope still filters, never addresses. Ruled **now** because Step 3 is about to
  persist `AppRecord`s durably and publish the manifest spec into team repos — one field today,
  a migration and a spec recall later. The value to the team is not cloud comparison but "for
  **my** app, in **my** landing zones, now" holding true even when those zones span clouds.
- **P27 — Sibling portals and RAG chatbots are never sources; they are candidate consumers.**
  A chatbot's output is synthesized content: it has no stable provenance (violates P14) and it
  encodes judgment (violates P15) — it cannot be Evidence. The **doc pages underneath it** are
  the legitimate adapter targets. The chatbot itself sits on the other side of the product: a
  ready-made *consumer* of the agent face (agent×pull binding, P13) that can ground its answers
  in Atlas briefs/resource atoms. Competitive posture follows: Atlas does **not** compete with a
  cloud's own portal on single-cloud Q&A — its categorical win is the situated, cited,
  agent-consumable brief ("for my app, here, now"), the same on whichever cloud a team runs.
- **P28 — DORA calibration: token economy and verification cost are contract properties, not
  implementation details.** DORA ROI names "build the context layer" the first enterprise AI
  investment and machine-readable context the mechanism — external confirmation of P12/P20/P22;
  its pain evidence recalibrates three things. (1) **Token economy**: the agent face is the
  front door in a year of 2–3x AI budget overruns and multi-10k-token MCP schema overheads —
  the MCP tool inventory stays minimal (bootstrap + moment tools + atoms), M9's `?depth` tiers
  are an acceptance property of the brief contract, and **tokens-per-brief** joins the Step 6
  instruments. (2) **Information gain**: LLM-generated context files that merely duplicate what
  an agent can discover itself *reduce* task success (AGENTbench) — a brief block must deliver
  the join (situation × platform truth × live state), never re-serve repo-discoverable content;
  the P21 manifest stays identity-minimal. (3) **Verification tax**: the Portal-as-trust-surface
  (P20) is DORA's "make verification cheap, give trust an evidentiary basis" — **time-to-verify**
  (citation-follow to source) joins time-to-brief in Step 6. Track B carries the DORA citations
  into every fetch-access negotiation.
- **P29 — Multicloud is a cross-cutting design constraint on the foundation, interfaces, and
  contracts — never a roadmap phase.** (Owner, correcting the first draft of this ruling.) Every
  seam and data shape is **multi-cloud / multi-LZ native from the first line**: any cloud or
  landing zone plugs in **behind the adapter port with zero change to the foundation, interfaces,
  or contracts** — only its adapter/resolver is added, incrementally, whenever a real one needs
  connecting. A single-cloud / single-LZ assumption or a hardcoded singular is a **defect**, to
  be caught by type or test **at every step**, not deferred to a future migration. This repo is
  **public-safe** (ADR-0004): it ships only the generic seam + mocks; it does **not** own any
  real cloud's availability data, and **verifying a real cloud's landability is company-side
  work, not a gate in this plan**. Consequences that retract the first draft:
  - The **A3 "second-cloud landability" falsifier is withdrawn** — it described company-side data
    verification, not repo work (it survives only as a Track-B note: when a team wants a new
    cloud connected, its owning side confirms the source is parseable before the adapter is
    written).
  - The **R3 "multicloud landing" milestone is dissolved** — there is no such phase. What P26
    already did (set-shaped scope, adapter growth axis) *is* the multicloud work; new
    cloud/LZ adapters are incremental plug-ins behind the port, not a scheduled step.
  - **Entra app-scope enforcement is a movable feature, not a terminal phase** — it can be
    sequenced early (right after self-declared app-scope, Step 3), per
    `entra-app-scope-implementation-plan.md`; the "R4" ordering is dropped.
  - The build order (Steps 1–7) is unchanged. `implementation-plan.md` records the constraint as
    a **cross-cutting acceptance line across all steps** (§2/§7), not a phase; every goal prompt
    carries it as a Constraint and, where a contract touches cloud/LZ, a DoD item guarding
    against single-cloud assumptions.

- **P30 — Situation identity is resolved from a provenanced source; self-declared / manifest
  are provenance-less fallbacks, never the anchor or the truth.** (Owner, 2026-07-05, correcting
  the framing of P17/P21.) The problem Atlas must solve for a situated answer is *provenanced
  identity resolution* — "which APP are you," with an origin — **not storing scope**. (Owner
  correction to an earlier "it goes stale" argument: scope is **stable**, not drift-prone —
  "today AWS, next month Azure" barely happens — so the objection to a stored `AppRecord`/
  manifest is NOT staleness; it is that a **self-declared, stored** identity has **no
  provenance** and competes with the authoritative sources, violating P14.) Consequences:
  - **Identity source ladder.** *Provenanced (main path):* Entra claims (Portal login → which
    APP/team) and repo context (an agent infers the APP from its working directory — IaC/CI,
    not a hand-authored file). *Provenance-less (fallback only):* Portal self-declare and a
    manual LZ pick (session-only) — always labeled, never an anchor.
  - **Manifest demoted (amends P21).** `atlas.app.yaml` is NOT a mandated anchor a team must
    author and maintain. An agent should infer scope from the repo's existing signals first
    (P28 information-gain: never re-serve repo-discoverable content); the manifest is an
    **optional explicit override**, not the primary situation source. Atlas never reads it
    directly regardless — the agent passes the values by value.
  - **AppRecord demoted (amends P17).** `AppRecord` is NOT the situation's truth/foundation and
    nothing platform-side derives from it (consumer state is never Evidence — unchanged). Its
    `origin: self-declared → registry` remains the no-provenance → provenanced **upgrade seat**
    (P17 intact). Its **persistence is justified only by a durable consumer-state need —
    subscriptions/feedback (Step 2)** — and even then it holds an *identity association*, not a
    scope snapshot; scope follows from the provenanced identity.
  - **No teardown — a positioning change only.** Every Step-3 scaffold stays (it IS the
    foundation the provenanced upgrade builds on): `AppDirectoryPort` + adapters, `AppRecord`,
    the apps store/routes, the Portal selector, scoped availability. By-reference scope resolves
    only through a provenanced `AppDirectory` adapter; the default stays `nullAppDirectoryAdapter`
    until Entra's `registryAppsAdapter`. Self-declared serves as the honest, labeled fallback
    while Entra is not yet wired, and upgrades in place when it is. What changes is the **design
    positioning across the docs**, not the code.

- **P31 — The machine-derived change feed and the editorial What's New are two distinct
  surfaces; the differ never rewires What's New.** (Owner, 2026-07-05, correcting the Step 2
  framing.) Two independent change surfaces exist and must not be conflated:
  - **What's New = editorial newsletter.** A live projection of the federated-platform
    Confluence "What's New" page into releases + announcements (`resolveReleaseNotes` /
    `whatsNew.ts`) — **human-authored, curated announcement copy**. It stays exactly as built;
    Step 2 does not touch it.
  - **"My changes" = machine-derived feed.** The differ's `ChangeEvent[]` (Step 2), scoped by
    `ctx.scope`, cited and aging, surfaced on the **app-home / dashboard** side (the I6 "my
    change-feed slice") + a per-scope Atom feed + `GET /api/changes`. This is exactly M8's
    original wording ("in-portal *my changes* surface + per-scope Atom feed") — the conflation
    lived only in `implementation-plan.md`'s Step 2 prose, not in the mid-level design.
  - **Consequences (amends implementation-plan.md only).** §7 Step 2 "What's New consumes the
    feed" → the *my changes* surface consumes the feed, What's New stays editorial; §5
    acceptance line C "What's New fed by derivation, not editing" → the *my changes* surface is
    derivation-fed (What's New remains editorial by design, not a defect); §6 A2's "What's New
    fed by derivation" reads the same way, and A2 no longer gates a "What's New rewiring" (there
    is none) — it informs push/subscription posture only. No teardown; positioning only.
