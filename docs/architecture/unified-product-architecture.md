# Unified Product Architecture — Atlas, the Developer Context Plane

> **Status:** accepted design, evolved 2026-07-03 (supersedes the 2026-07-02 estate-model draft of
> this same file; the estate model survives as the platform-side half of the context graph).
> Amended 2026-07-04 per **P26–P29** (multicloud + DORA calibration: §7 capability rows, §9
> landability items; schema consequence in `mid-level-design.md` §1, roadmap in
> `implementation-plan.md` §7).
> **Ground truth:** `PROJECT-CONTEXT-PACK.md` (pack — the pre-analysis snapshot, not updated).
> Binding positions: pack §9 **P1–P6** (priors) + `direction-decision-log.md` **P7–P16**
> (the direction-analysis and design rulings this document realizes).
>
> **High-level design: CLOSED** (owner, 2026-07-03; decision log P17). Mid-level design lives in
> the companion `mid-level-design.md` (schemas, persistence map, API surface, execution model,
> migration order).
>
> Vocabulary: every capability carries one **capability state** — *Required / Optional at runtime /
> On-demand / Profile-specific / Capability-bounded / Unsupported / Outside current product scope /
> Implementation dependency* — never a release phase. Platform vocabulary follows `CONTEXT.md`.
> New domain terms introduced here (**moment**, **brief**, **operational location**, **context
> adapter**) are to be added to `CONTEXT.md`; they are defined in §2–§3 below.

---

## 1. Product statement (P12)

A developer's daily platform work is hunting docs, links, and statuses across systems and merging
them **in their head** into a working context. **Atlas externalizes that merge**: it proactively
assembles contexts + knowledge + status into *situated* context, and leaves judgment to the
developer and their AI agent (P1: 一体两面, same governed data for both).

The dev loop has four **moments** where platform context is needed:

| Moment | The developer's question |
|---|---|
| **onboard / adopt** | I'm starting something — what's the process, what can I use, what are the rules? |
| **build** | I'm building — how do I configure this, what does policy allow? |
| **debug** | It's broken — where are the logs, what does this error mean, who do I ask? |
| **change** | What moved since I last looked — will it break me? |

**Why this wins categorically** (the answer to "a knowledge center is too weak"): every one of those
answers is a **join** of three things no single system holds — *my situation* (APP, LZ, services in
use), *the platform's truth* (discovered), and *the live state* (fetched). A wiki has only the
middle one, as unstructured prose, and knows neither who you are nor what is live. A wiki answers
"what did the org write about X"; Atlas answers "**what does X mean for me, here, now**" — a
different question *shape*, not a better execution of the same one. Governed honesty (ADR-0006)
stays as plumbing — the reason every assembled line dares to carry a citation — not as the pitch.

Hard boundaries unchanged: Atlas never provisions/deploys/triggers CICD (P2 — restated positively:
Atlas is *the context call before every action*, human or agent); source content never lands
durably and stale is never served as fresh (P7); Evidence vs operational status never blurs
(ADR-0003).

## 2. The one core (P13)

The product is **one assembly engine** with two parts. Everything else is a binding of it (§4).

### 2.1 Substrate — the context graph

- **Nodes:** APP, service, landing zone, guardrail, module, Source, and **operational locations**
  (where a thing's logs / pipelines / dashboards / runbooks / workspaces live).
- **Edges:** discovered relations only — APP→LZ, APP→services, service→modules (1:N,
  `TERRAFORM_MODULE_MAP`), service→policy references, service→availability, service→operational
  locations, resource→owner-provenance.
- **The graph is itself Evidence** (P14): every node/edge answers "where was I discovered from",
  carries the `resolvedAt` of the parse that produced it and cites its Source; freshness/drift is
  recomputed on every read, never cached (ADR-0013 §6 two-clocks, applied to structure).
- The `{kind}/{slug}` Resource model (ADR-0015) is unchanged: graph nodes that are Resources keep
  their one canonical address; scope (LZ, APP) filters, never addresses; **operational locations
  are pointer records, not Resources** — they are the graph's ADR-0003-compliant seat for
  operational status (generalizing P11's status index).

### 2.2 Contract — the moment brief

A **brief** is the assembled deliverable for one moment in one scope: a graph traversal from the
situation's entry node, plus live-resolved Evidence excerpts on the traversed nodes, plus
operational-location pointers, every line carrying provenance and age. Properties:

- **Face-neutral.** A Portal page and an MCP tool response are two renders of the same brief; a
  push notification is the same brief triggered by a diff. One contract, N renders.
- **A pure view.** Briefs compose existing resource reads (ADR-0014 §2 deterministic view, bounded
  concurrency, re-resolves nothing). A brief owns no content and is never separately editable —
  this is what keeps it from becoming a second content model.
- **Decision-shaped but judgment-free (P15).** A brief's *structure* may encode the question
  (options × applicable guardrails × evidence × freshness — structure that is itself discovered
  from the platform); its *content* never encodes an answer. Ordering is deterministic (authority,
  freshness). No recommendation, ever (mvp §4's line, kept).
- **Honest-empty per line.** Every slot inherits the resolution vocabulary: `no_registered_source`
  dead-end + Feedback, `availability_unavailable`, `source_unavailable`, unverified-owner — a
  missing slot is absence of data, never a negative fact (ADR-0013 §4).

### 2.3 The third data class — consumer state (P17)

"Discover or fetch, never maintain" (P14) governs **platform context**. A third class exists that
Atlas legitimately owns: **consumer state** — data a consumer writes about themselves: Feedback
(existing), **self-declared APPs** (name, landing zone, services-in-use; always labeled
`self-declared`, never presented as discovered), and **subscriptions**. Consumer state is durable
(DynamoDB), is never Evidence, and **upgrades in place** when a discoverable source lands (a
registry-backed APP record replaces a self-declared one, gaining provenance and losing the label).
This unblocks the APP entry from company-registry landability: P9's gating fact becomes an upgrade
path, not a gate.

## 3. The four moment templates

Four templates over one graph — the whole human/agent surface area collapses to these.

### 3.1 adopt (worked template — the per-step contract)

Scope entry: my APP (P9: APP is the product anchor; `scope.appId → landingZoneId` resolves
underneath; manual APP pick until Entra identity — Implementation dependency).

| # | Step | Question | Source (`source_class`) | Mechanism | Citation shape | Honest-empty |
|---|------|----------|------------------------|-----------|----------------|--------------|
| 1 | Establish scope | Which APP → which LZ? | APP registry if landable, else overlay exception (P14) | scope resolution | mapping provenance + age | unknown APP → beyond registered scope + `Feedback(missing)` |
| 2 | Find the service | Does X exist here, is it governed? | `availability-matrix` (LZ spine) | graph/catalog read (snapshot-backed) | availability page + parse `resolvedAt` | `no_registered_source` dead-end |
| 3 | Availability | Available in **my** LZ? | `availability-matrix` | `availabilityMatrixResolver` via the single shared parse | `availability-cell` grain mirrors query (ADR-0009) | `availability_unavailable`; never another LZ's data |
| 4 | Applicable policy | Which guardrails apply? | `confluence-page` (security instance) / `policy-document` | policy resolvers | policy anchor + authority | unresolved ≠ "no policies apply" |
| 5 | Implementation | Which modules, how used? | `terraform-module` (1:N) | `terraformModuleResolver` | `module-field` / `markdown-heading` per module | `source_unavailable` per module |
| 6 | Ownership & onboarding | Who owns, how to onboard? | provenance-derived owner (P14) + onboarding `confluence-page` | derivation + onboarding provider | owner provenance + age; guidance page citation | owner **unverified**, never blank-asserted |
| 7 | Act elsewhere | Where do I do it, what state is it in? | **operational location (not Evidence)** | pointer from the graph; value live-resolved On-demand, never stored | uncited by design (ADR-0003), visually separated | "no location registered" + Feedback |

### 3.2 build

Same graph, entered from a service the APP already uses: configuration guidance, policy
constraints, module README prose. No new mechanics — a narrower adopt traversal.
**Capability state: Required** (falls out of 3.1's machinery).

### 3.3 debug

Entered from the APP on an error. **Content is the bar; locations are the floor** (P18): ~80% of
the in-head merge in a debug moment is "where is everything", and the location index answers that
immediately — but the target capability assembles the content itself (cited troubleshooting
excerpts + live-fetched operational values, uncited and separated), upgrading each pointer block
in place as fetch access to its system lands. The template answers:
where this APP's logs/pipelines/dashboards live (operational-location index), which platform
components sit in the path (graph edges), what the platform knows about this error class (cited
runbook/doc excerpts), who owns what (provenance). Atlas **never promises root cause** — the honest
boundary is "what the platform knows + where everything lives".
**Capability state:** location index **Required**; error-class excerpts and live values
**Capability-bounded** by source landability (log/CI adapters — see §5).

### 3.4 change

Diff of consecutive discovery snapshots (P7), filtered to a scope: new/removed services,
availability flips, module version changes, policy reference changes, owner-provenance changes.
Zero curation, fully derived — **the cheapest moment to make real, and the reason a developer
returns**. What's New evolves from an editorial artifact to a diff-derived feed (editorial notes
may annotate, no longer the sole source).
**Capability state: Required** (snapshot diffing is pure derivation over P7's store).

## 4. The binding matrix

One engine, bound across (consumer × trigger). These are **bindings, not features**:

| | **pull** (asked now) | **push** (diff-triggered) |
|---|---|---|
| **human** | Portal pages (brief renders) | subscribed change briefs / newsletter |
| **agent** | MCP moment tools | change feed for agents |

- **MCP moment tools** (agent×pull): `get_my_context(app)` · `check_adoption(service, app)` ·
  `explain_error(app, error)` · `whats_changed(app, since)` — the four templates, tool-shaped.
  The existing 4 read-only resource tools remain the atom layer beneath them.
  **Capability state: Required** (一体两面 is both rows, by P13 — not sequenced).
- **Push** (P13's "主动" second half): subscriptions are **scope-bound** (only my APP's slice) and
  **event-class-bounded** (availability flip, policy change, module version, owner change — closed
  list). Push content is read-only context + action pointers; P2 intact.
  **Capability state:** human push **Optional at runtime**; agent push feed **On-demand**.
- Portal surfaces (catalog, datasheet, availability grid, `/estate` overview) are all pull-side
  human renders of graph slices — no surface owns data.

## 5. Supply side — context adapters and the SPOF answer (P14/P16)

**Adapter contract** (the only growth axis): `discover(root) → nodes+edges` (into the graph;
snapshot-able, diff-able) and `resolve(node) → excerpt|status` (live, cited). Confluence and TFE
are the two existing adapters; every future source (logging platform, CI, APP registry) enters
through this shape or not at all.

**Expansion is ordered by moment gaps, not by system:** change needs nothing new (Required now);
adopt/build are covered by the two existing adapters; debug is the valuable-and-expensive one —
its location index ships from existing graph edges, its value-resolution waits on log/CI adapter
landability (**Capability-bounded**; verify landability before building — pack §6 discipline).

**Anti-SPOF (P16):**
1. **Multi-root, per-subgraph degradation:** availability page, TFE registry, Confluence listings,
   APP registry are independent roots. One root failing ages one subgraph — served from the last
   good parse with a loud staleness banner and its real `resolvedAt` (honestly-aged, P7) — the
   rest stay live. The product's failure mode moves from "one page reformat blanks the site" to
   "one subgraph visibly ages".
2. **Parse-contract tests:** real page snapshots as fixtures; a format drift alarms in CI, never
   silently in prod.
3. **Convention → contract (the structural fix):** publish the context contract that source
   pages/systems commit to (machine-readable structure, validated by the owning team's side);
   Atlas consumes an agreed interface instead of guessing formats. Organizationally correct:
   platform teams own their context quality; Atlas is a consumer, not a janitor.
   **Capability state: Implementation dependency** (an organizational interface, negotiated per
   source).

## 6. Ratified mechanics (P7–P11, unchanged, re-seated)

- **Seam closure (P10):** the Portal's in-process client builds the same governed
  `ResolutionContext` (Bearer + shared Valkey cache + scope) the HTTP path builds; CI contract
  tests enforce face equivalence (ADR-0011 spirit). `CONTEXT_API_BASE_URL` stays the deployment
  split. **Required.**
- **Snapshot (P7):** discovery output persists across boots (Valkey, env-hash keyed, per-parse
  `resolvedAt`, drift recomputed per read); stale-while-revalidate refresh; scheduled refresh on
  the lifecycle plane **Optional at runtime**. Also the substrate for §3.4 diffs and §5's
  honestly-aged degradation. **Required.**
- **Availability single parse:** `AvailabilityProvider` owns one fetch+parse per LZ; the resolver
  consumes it, keeping ADR-0009 citation grain. **Required.**
- **Feedback:** durable in production (fail-fast on unset `FEEDBACK_TABLE`); in-memory is
  **Profile-specific** (dev/test). Anonymous identity is stated honestly until Entra.
- **Curation overlay (P14 supersedes P8's "minimal dose"):** **exception-only fallback** for
  fields with no derivable source (candidate: app→LZ mapping if no APP registry lands). Owner and
  similar fields derive as provenance from sources wherever possible.
- **Ask / LLM synthesis:** the grounded-synthesis path (citation-enforced via the existing
  `validateCitations`, refuse-on-ungrounded) is consistent with P15 and mvp §4's "consumer LLM
  synthesizing a cited answer is allowed"; activation requires an explicit gate. **Capability
  state: On-demand behind a gate; currently dormant scaffold** (pack §6).

## 7. Capability-state summary

| Capability | State |
|---|---|
| Context graph substrate (nodes/edges discovered; graph-as-Evidence clocks) | Required |
| Moment briefs as pure views (no owned content) | Required |
| adopt / build templates | Required |
| change template (snapshot diff feed) | Required |
| debug template — operational-location index | Required |
| debug template — error-class excerpts, live values | Capability-bounded (log/CI adapter landability) |
| Governed seam closure + face-equivalence CI tests (P10) | Required |
| Discovery snapshot, honestly-aged degradation, parse-contract tests | Required |
| MCP moment tools (agent×pull) | Required |
| Human push (scope-bound subscribed change briefs) | Optional at runtime |
| Agent push feed | On-demand |
| `/estate` overview render | Optional at runtime |
| APP entry via self-declared APP + selector (consumer state, P17) | Required |
| Entra/OAuth → automatic "my APPs" | Implementation dependency (currently Unsupported) |
| Registry-backed APP records (in-place upgrade of self-declared) | Implementation dependency |
| Curation overlay beyond exception fallback | Unsupported by design (P14) |
| Grounded Ask synthesis (citation-enforced) | On-demand behind an explicit gate |
| Status/log value aggregation, history, alerting | Outside current product scope (ADR-0003) |
| Additional landing zones beyond `awsf` | Capability-bounded (data landability, O3; landability verification scheduled as falsifier A3 → roadmap R3, P29) |
| Cross-cloud (>3) unified entry | Outside current product scope (terminal frame, P6; the two-cloud estate is *inside* the frame — P26) |
| Sibling portals / RAG chatbots as sources | Unsupported by design (P27 — no provenance, encodes judgment; their doc surfaces are the adapter targets; the chatbot is a candidate *consumer* of the agent face) |
| Provisioning / CICD triggering | Unsupported permanently (P2) |

## 8. Consequences for the current codebase (dependency order)

1. Seam closure (P10): shared `cachedResolutionContext` factory + equivalence tests
   (`inProcessContextApi.ts`, `httpRoute.ts` factored).
2. Snapshot store (P7): `composition.ts` discovery memo → Valkey-persisted, `resolvedAt`-stamped;
   reuse `withCache` semantics.
3. Availability single parse (item E): resolver consumes `AvailabilityProvider`.
4. Graph edges formalized: today's discovery output already contains most edges implicitly
   (module map, policy references, availability spine); make the edge set explicit in the derive
   step + schema, each edge carrying its provenance.
5. Operational-location index: derive from existing edges (TFE org/workspace from module map);
   pointer records in schema, ADR-0003 shape.
6. change feed: snapshot diff derivation + scope filter; What's New consumes it.
7. Moment brief assembler: one server-side bounded-concurrency composer (ADR-0014 §2) + four
   templates; Portal pages and MCP moment tools both call it.
8. APP scope (P9): `scope.appId` activation, app-resolution port (registry adapter or overlay
   exception), APP selector subsuming the LZ selector.
9. Feedback fail-fast; doc-drift reconciliation pass (pack §6 stale set).

## 9. Open items

- **Landability facts to verify**: an APP registry (now an *upgrade path* for self-declared APPs
  per P17, no longer gating the APP entry); log/CI sources for debug values (these DO gate the
  debug moment's value resolution); the second cloud's doc surfaces / availability equivalent
  (now formalized as falsifier A3, `implementation-plan.md` §6, P29).
- **CONTEXT.md additions:** moment, brief, operational location, context adapter (definitions in
  §2–§3); mark "wayfinding" as subsumed by the situated-merge framing (P12) rather than retired.
- **Push event-class list** is closed by design; extending it is a product decision, not a config.
- **Convention→contract**: negotiate the first contract with the availability page's owning team —
  the highest-value, highest-fragility root.
