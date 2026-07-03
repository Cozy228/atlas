# Implementation Plan — Building the Developer Context Plane

> **Status:** accepted (owner, 2026-07-03; implementation architecture **I1–I6 + M11–M12
> ratified** the same day, recorded as P25). The third document of the design trilogy:
> `unified-product-architecture.md` (high-level, CLOSED per P17) defines *what the product
> is*; `mid-level-design.md` (M1–M12) pins *its shapes*; this document defines *how the
> product becomes real* — the implementation architecture derived from the product, the
> decisions taken with their rejected alternatives, the build order, the acceptance bar,
> the falsification experiments, and the parallel supply-side track.
>
> **Method (owner instruction, 2026-07-03):** the implementation is derived from the
> product's invariants, **not** from the current tree. The walk to it is a **new spine +
> Tier-B port** of proven code — the same move this repo made once before
> (`0.2.0-port-crosswalk.md`) — not incremental patching. §8 records honestly which
> current modules already sit at the optimum (ported as-is) and which do not (rebuilt).
>
> **Authority chain:** pack §9 P1–P6 → `direction-decision-log.md` P7–P25 (newest wins) →
> mid-level M1–M12. Scope discipline per P23: engine expansion stays paused; everything
> below runs on the already-landed sources and gates on no new source.
>
> Vocabulary: capability states per the terminology law. Steps form a **dependency order,
> not release slices**; every step is independently shippable and independently revertible.
> Platform vocabulary per `CONTEXT.md`.

---

## 1. What this realization delivers

The product statement (P12) made operational: **Atlas externalizes the developer's in-head
context merge.** When this plan is live, the three-way join the product is built on —
*my situation* × *the platform's truth* × *the live state* — exists as running code:

- **My situation** enters by value (a repo manifest carried inline) or by reference (a
  registered APP record) — M11 — and scopes every answer.
- **The platform's truth** is a versioned context graph derived purely from per-root
  snapshots, every node and edge cited and aging (P14, P7/P16), assembled into moment
  briefs that every surface consumes identically — by construction (I3).
- **The live state** appears as operational values fetched at read time through
  per-system adapters (M12) — displayed, never stored (P18/P24).

Two consumption postures, per P20: **the agent is the front door; the Portal is the trust
surface.** Success is measured on agent call share and time-to-brief, not page views.

## 2. Derivation rules — what the product forces on the implementation

Every mechanism below exists because an invariant forces it; a mechanism that cannot name
its forcing invariant does not belong in the system.

| Product invariant | Forced mechanism |
|---|---|
| The graph is itself Evidence (P14) | Graph = a **pure derivation** of the per-root snapshots, carrying a version hash; every request pins one graph version at entry — no torn reads across roots mid-transition |
| The two faces can never drift (P13/P20) | Equivalence **by construction, not by test**: all surfaces consume the same serialized Brief/Resource value; CI tests guard only transport wiring |
| No ungoverned read may exist (P10) | **Type-level prohibition**: every handler signature requires a `ResolutionContext`; one factory in the whole system can construct it; a "default context" is not a concept |
| The growth axis is the adapter (P22) | Adapter = a closed contract + a **conformance kit**; landing a new source is a checklist, not a design event |
| Status values never land durably (P24) | `fetchValue`'s return type connects to no persistence port; `evidence[]` vs `pointers[]` is a type separation |
| Honest-empty per line (ADR-0013 §4) | Assembly splits **plan/execute**: templates produce "what to ask", the executor produces "what was answered" — an empty slot is a testable first-class result |
| Scope filters, never addresses (ADR-0015) | Scope (by value or by reference, M11) enters only the context, never the `{kind}/{slug}` address |
| Judgment belongs to the consumer (P15) | Ordering fields are authority and freshness only; **no score/recommendation field exists in the schema** — there is nowhere to put one |

## 3. The engine — five layers, two growth interfaces

```
L4 Representation   Portal pages · /api JSON · /briefs/{moment}.md · MCP tools · Atom
                    └─ all consume the same serialized Brief / Resource value (I3)
L3 Assembly         moment templates (pure fn: graph + scope → assembly plan)
                    → executor (bounded concurrency → Brief)                    (I4)
L2 Governance gate  the single ResolutionContext factory: identity · scope
                    (by value | by reference, M11) · request cache · credential plane (I2)
L1 Graph            per-root snapshots (K=2, CAS transition, M10/M2)
                    → deriveGraph (pure fn) → versioned graph                   (I1)
                    └─ differ (pure fn: two parses → ChangeEvent[]) → events (M1/M6)
L0 Adapters         one per system: discover / resolve / fetchValue
                    + authMode (caller-bearer | service-token | none, M12)
                    + URL allowlist · conformance kit (I5)
──────────────────────────────────────────────────────────────────────────────
Side stores         consumer state (apps / subscriptions / feedback, DynamoDB)
                    events (DynamoDB, append-only)
                    — the only durable product data; source content and status
                      values never land in any store (P7/P24)
```

The system has exactly **two growth interfaces**: downward, the adapter contract (new
sources); upward, the brief contract (new surfaces). The three middle layers are closed
deep modules — the structural guarantee that one owner + agents can maintain the plane.

## 4. Implementation decisions (I1–I6, owner-approved 2026-07-03)

- **I1 — Graph-first: resources are projections of the graph.** Discovery's sole product
  is snapshots → graph; a resource read is "graph node + resolve". *Rejected:* resource
  records first, edges as by-products — the change feed, brief traversal, and estate views
  all read edges; the edges are the substrate.
- **I2 — The ungoverned read is unrepresentable.** The "default context" concept is
  deleted, not patched: every handler requires a `ResolutionContext` and only the L2
  factory constructs one. *Rejected:* patching the current in-process client — a patch
  keeps the footgun, merely unloaded.
- **I3 — Equivalence by construction.** All L4 renders consume one serialized Brief value,
  so face drift is structurally inexpressible. *Rejected:* equivalence by CI test alone —
  tests catch drift after it exists; construction makes it unwritable. (The CI test
  survives, demoted to transport-wiring guard.)
- **I4 — Plan/execute split in assembly.** Templates are pure functions (graph + scope →
  the list of blocks to ask); only the executor touches I/O. Template honesty (M5
  relevance contracts, honest-empty) becomes table-driven tests with no network mocks.
  *Rejected:* templates that traverse-and-fetch interleaved — untestable honesty,
  uncontrolled fan-out.
- **I5 — Adapter conformance kit.** One reusable test rig: real-page fixtures,
  format-drift alarms, missing-credential degradation, honest-empty assertions. A new
  adapter's definition of done = passing the kit. *Rejected:* bespoke per-adapter tests —
  the growth axis must be checklist-driven, not design-event-driven.
- **I6 — Front doors organized by moment, not by catalog.** The Portal home becomes the
  **APP home**: situation card + my change-feed slice + the four moment entries; the
  catalog demotes to a tool page. The agent face gets a three-call flow: `bootstrap` (who
  am I, what tools exist) → moment tool → follow citations down to resource atoms.
  *Rejected:* the catalog-first IA — it answers "what does the platform have", not "what
  does this mean for me, here, now".

M11 (scope by value/reference + `scope_drift`) and M12 (adapter auth modes + allowlist +
never-store-secrets) are constituents of L2 and L0 respectively — see
`mid-level-design.md` §10.

## 5. Product acceptance — the bar for calling this realization live

| # | Outcome | Made true by | Measured as |
|---|---------|--------------|-------------|
| A | 一体两面 is structural: the faces cannot drift | L4 (I3) + L2 (I2) | one Brief value consumed by all renders; transport-wiring CI green |
| B | The product survives its sources: instant cold start, one root failing ages one subgraph visibly | L1 snapshots + parse contracts | cold-start serve latency; per-root staleness age visible in UI and logs |
| C | The platform knows what changed and can prove it | L1 differ + events | events flowing with damping; What's New fed by derivation, not editing |
| D | Every answer is *for me, here, now* | L2 scope (M11) + consumer state | scoped brief e2e from a repo manifest through MCP, zero registration required |
| E | The in-head merge is externalized | L3 + L4 | time-to-brief live; adopt/build/change briefs on all surfaces |
| F | Honesty is measured and drives supply | instruments | per-block unresolved rate by missing source = the negotiation queue |
| G | Debug floor + status board exist without violating ADR-0003 | locations + at-read board (M12) | live values rendered via adapter authMode; zero status values in any durable store |

## 6. Falsification experiments — run early, cheap, with decision consequences

- **A1 — Agent reachability.** *Assumption:* an engineer's coding agent can reach and
  authenticate against `/mcp` from a real corporate dev environment. *Experiment:* one
  real corp laptop, Claude Code (or equivalent) with a Bearer, end-to-end against `/mcp`.
  *Consequence if false:* the agent front door (P20) stalls; stop before Step 5's MCP
  investment and re-plan the agent face with the owner; the Portal remains the
  fully-functional fallback face. **Run during Step 1 — it needs nothing built.**
- **A2 — Change cadence.** *Assumption:* the landed sources change often enough that the
  change feed is a return-visit reason, not dead air. *Experiment:* count would-be events
  from the availability page's Confluence version history and TFE module version history
  over the trailing 90 days; record the number in §12. *Consequence if near-zero:* the
  feed demotes from "return reason" to "instrument data" (it still ships — Step 6 needs
  it); push/subscription investment waits until cadence exists. **Run before Step 2's
  What's New rewiring.**
- **A3 — Second-cloud source landability (P29).** *Assumption:* the second cloud's
  documentation surfaces (doc pages, self-service portal data) are structured enough to
  parse, and fetch access is attainable. *Experiment:* inventory its availability
  equivalent, doc-page format, and API/auth reality; run one throwaway parse against a
  real page snapshot (conformance-kit style, I5). *Consequence if false:* R3 stays behind
  P23's pause (its exit condition unmet); Track B keeps contract v0 (P22) on the table
  with that cloud's owning team — the negotiation continues, the build does not start.
  **Gates R3 only; runnable any time, cheapest once Step 2's adapter seams exist.**
  Note the P27 boundary: the cloud's RAG chatbot is never a source; only the doc surfaces
  beneath it are landability candidates.

The remaining falsifier — the four-moment taxonomy — stays where P19 put it: field ② of
every pain-point record (Track B), continuously.

## 7. The walk — build order along the new spine

Adapters port into the spine throughout (Tier-B style); each ported adapter's acceptance
is passing the conformance kit (I5). Every step ships independently and reverts
independently.

### Step 1 — L2: the governance gate (I2 + M11)

- **Intent.** The single `ResolutionContext` factory lands; the default-context concept is
  deleted; every entry — Portal loader, HTTP route, MCP, `.md` — constructs through the
  gate. Scope arrives by value (inline manifest declaration, never writes) or by reference
  (`appId`), with the `scope_drift` warning on disagreement.
- **Verify.** Type-level: no handler is callable without a context (compile-time, not
  convention). Transport-wiring CI guard across the entries. Cache + Bearer observable on
  the previously ungoverned path.
- **Revert.** The factory is the new sole path; revert restores the current split without
  data loss.

### Step 2 — L1: the graph layer

- **Intent.** Per-root snapshots (Valkey `discovery:<envHash>:<rootId>`, real
  `resolvedAt`, K=2 retention M2, CAS transition M10, stale-while-revalidate) →
  `deriveGraph` as a pure function producing a **versioned graph** pinned per request
  (I1) → the differ (pure: two parses → `ChangeEvent[]`, closed `EventClass`, stability
  damping M6) → DynamoDB `events` (append-only, content-hash idempotent, M1), derived
  inline at snapshot transition — no free-running worker. What's New consumes the feed;
  per-scope Atom feed + `GET /api/changes` (M8). Per-root parse-contract fixtures fail CI
  on format drift (P16). A failed root serves its last good parse, honestly aged, banner
  loud; other roots stay live.
- **Verify.** Cold start serves from snapshot, no crawl. Dev drill: kill one root → one
  subgraph ages. Differ golden tests; degradation-gap pair → zero events + one aging
  note; single-parse flap emits nothing. Drift/freshness recomputed per read — the
  snapshot never becomes a second clock (ADR-0013 §6). **A2 runs before the What's New
  rewiring.**
- **Revert.** Snapshots are derivation cache (loss ⇒ re-discover); feed consumers fall
  back to editorial What's New; `events` is append-only and keeps history for re-enable.

### Step 3 — Consumer state + situation entry (P17/P21, M3, M11)

- **Intent.** `AppRecord` in DynamoDB `apps` (fail-fast in production), explicit
  registration only (`POST /api/apps`, portal), the APP selector subsuming the LZ
  selector; the repo manifest spec published (file name, fields, validation; the id
  written back on registration). `serviceSlugs` validate against discovered records;
  dangling declarations warn, never silently drop. **Scope shape per P26:** an APP
  declares a *set* of landing zones (`landingZoneIds[]`, manifest included); scope
  resolution yields the set — ruled before this step ships because the record is durable
  and the manifest spec, once in team repos, is unrecallable.
- **Verify.** E2E: agent reads manifest → by-value scoped answer with zero registration;
  registration → by-reference flow → subscriptions attach. `self-declared` labeling
  unconditional; mutations logged.
- **Revert.** Consumer state is additive; disabling the selector restores LZ-only scoping.

### Step 4 — L3 + L4: assembly and representation

- **Intent.** The externalized merge. The assembler with plan/execute split (I4):
  templates as code for adopt / build / change (closed set, no DSL), M5 relevance
  contracts, no brief-level cache (M4), bounded-concurrency executor (ADR-0014 §2)
  threading Step 1's context. The representation layer (I3): **one serialized Brief
  value** rendered as `GET /api/briefs/{moment}`, `/briefs/{moment}.md`, Portal page
  props, and later Atom items. `?depth=citations|excerpts` per M9 — an **acceptance
  property, not an option** (P28 token economy: the agent face must be consumable at
  citation depth without paying excerpt cost). Per-zone blocks render for the situation's
  LZ set (P26). Template discipline per P28: a block must deliver the join — never
  re-serve content the agent can discover itself from its repo or the source directly.
- **Verify.** Template honesty tests (table-driven, no network): missing data ⇒
  `unresolved` + the correct warning code, never an absent block; failed fetch ⇒
  `partial` + warning, never silent truncation. Transport-wiring guard extends to briefs.
- **Revert.** Briefs are pure views; removing them leaves every resource surface intact.

### Step 5 — The two front doors (I6; requires A1 passed)

- **Intent.** Human: the Portal home becomes the **APP home** — situation card, my
  change-feed slice, four moment entries; catalog demotes to a tool page. Agent: the
  three-call flow — `bootstrap` tool (identity/scope discovery + tool inventory) → moment
  tools `check_adoption` / `get_my_context` / `whats_changed` (`explain_error` arrives
  with Step 7's floor) → resource atoms beneath (the existing 4 read-only tools).
- **Verify.** Face equivalence on briefs across loader / `/api/briefs` / MCP (transport
  guard); agent cold-start e2e: manifest → bootstrap → moment tool → citation follow,
  no human priming.
- **Revert.** IA change is route-level; the catalog-first home is restorable.

### Step 6 — Honesty instruments

- **Intent.** **time-to-brief** (the merge time the product collapses), **time-to-verify**
  (citation-follow to source — the verification-tax metric, P28), **per-block
  unresolved rate grouped by missing source** (= the negotiation queue, P16/P22
  prioritization by data), **tokens-per-brief** by depth tier (the agent-face cost
  metric, P28), change-feed event volume by class, agent call share (P20's
  metric). Internal dashboard surface over existing pino streams.
- **Verify.** The dashboard answers "which source next"; Track B consumes it directly.
- **Revert.** Pure read-side.

### Step 7 — Status board + self-service registration (P24, M12)

- **Intent.** Three ADR-0003-shaped pieces: the **location index** ("where this APP's
  things live", from graph edges; the debug brief's floor and `explain_error`'s first
  version, M7); the **status board** — aggregation-at-read: live-fetch current values
  behind the scope's registered locations through adapter `authMode`, displayed
  read-only, uncited, visually separated; **never stored, no history, no alerting**;
  **self-service registration** — teams register locations (`{system, kind, url}`);
  records are consumer state; a system without a value-capable adapter renders as a
  labeled pointer until access lands. The first `service-token` adapter (TFE class) walks
  the M12 model end-to-end. SSRF closed by construction: values fetch only through
  adapter allowlisted bases, never the registered URL.
- **Verify.** Live values render for registered locations; fetch failure degrades to a
  labeled pointer; registration round-trip e2e; explicit assertion that no status value
  reaches any durable store; no secret field exists in the registration schema.
- **Revert.** Registrations are consumer state (kept); the board is a pure read-time
  render.

### Roadmap view — R0–R4 (P29, 2026-07-04)

The steps above are a dependency order; this is the same order read as delivery phases,
with the multicloud supply line and the ecosystem line attached. Gates are named, not
dated.

| Phase | Delivers | Steps | Gate |
|---|---|---|---|
| **R0 — app-scope** | governed gate + self-declared APP scope (multi-LZ shape per P26), manifest spec, APP selector | 1, 3 | **A1 runs now** (needs nothing built); A2 before R1 |
| **R1 — the merge live** | graph, change feed, briefs — the DORA Pain-#2 core made real | 2, 4 | Step 1 done; A2 sets What's New posture |
| **R2 — two front doors + instruments** | APP home, MCP three-call flow, honesty dashboard (time-to-brief, time-to-verify, tokens-per-brief, unresolved-rate queue) | 5, 6 | A1 passed |
| **R3 — multicloud landing** | second cloud's doc surfaces as adapters through the I5 kit; new LZ roots in config; adopt brief gains the cross-cloud decision shape (structure encodes the question, never the answer — P15) | I5 exercise | **A3 passed**; Step 2 landed. Negotiation starts parallel to R1/R2 |
| **R4 — enforcement + ecosystem** | Entra slice per `entra-app-scope-implementation-plan.md` (BFF → L2 factory input → fail-closed gate → `visibility:app` ingestion → MCP OAuth); the sibling cloud's RAG chatbot onboarded as a *consumer* of the agent face (P27); push bindings if A2 shows cadence | 7 + Entra WS1–6 | Valkey infra (WS6) first; WS3's no-DCR precondition folded into A1 |
| **Track B — supply** | pain points, contract v0, fetch-access negotiations — now a two-cloud owner queue, prioritized by the Step-6 unresolved-rate data, argued with the DORA citations (P28) | ongoing | — |

## 8. Keep/rebuild crosswalk — where the current tree stands vs the optimum

Honest accounting (the Tier-B port list). **Keep — already at the optimum, ported as-is
into the spine:** the schema warning vocabulary and two-axis status model; `withCache`
(single-flight + negative cache + SWR + auth-digest keys — exactly what L0/L1 need); the
parsing logic inside the providers (availability page, TFE, Confluence — the
hardest-earned code); the landing-zone constant root; the MSW dev seam and three-state
`DEV_MOCKS`; pino observability; the honest-degradation resolution semantics.

**Rebuild — not at the optimum:** `composition.ts`'s env-hash in-memory memo → L1
snapshot + graph derivation; the in-process client's default ungoverned context → I2
type-level deletion; the resource-first derive → I1 graph-first; the (nonexistent)
assembly/representation layers → L3/L4 new; the catalog-first Portal IA → I6 APP home.

## 9. Track B — the supply side (parallel, non-code)

- **Pain-point collection** per P19's four-field format; field ② keeps falsifying the
  four-moment taxonomy; Step 2/6 instruments add behavioral evidence.
- **Context contract v0** (P22): the one-page machine-readable spec a source system
  exposes and self-validates; every scraping adapter is a labeled shim whose retirement
  condition is its source's contract landing.
- **First negotiation:** the availability page's owning team — highest-value, most
  fragile root (P16); the ask is "expose per contract" and the target is **fetch access**
  (content, P18), not link inventories.

## 10. Risks, degradation modes, STOP conditions

- **A1 fails** → stop before Step 5's MCP investment; re-plan the agent front door (§6).
- **A2 near-zero** → feed demotes to instrument-only; no push/subscription investment
  until cadence exists (§6).
- **Any drift toward status at-rest** (stored values, history, alerting) → out of scope
  by P24; stop and surface.
- **A new source dependency inside any step** → that part pauses per P23; the step ships
  without it (honest-empty, labeled).
- **Parse-contract fixture churn** → expected degradation, not an emergency: subgraphs
  age honestly (Step 2); the churn rate itself becomes Track B negotiation evidence.
- **Self-declared data quality** (M3 accepted): blast radius is a mislabeled convenience
  record, never Evidence; mutations logged; Entra arrives as an adapter, not a redesign.
- **Registration abuse (M12 surface)**: the registration schema carries no secret and no
  fetchable URL authority; worst case is a wrong pointer, never a wrong Evidence line and
  never a server-side request to an attacker-chosen host.

## 11. Explicitly outside this realization

Unchanged capability states from `unified-product-architecture.md` §7: debug **value**
resolution beyond adapter-capable systems (Capability-bounded on fetch-access
landability); a second landing zone and per-LZ content variants (Capability-bounded,
O3 — now with a scheduled exit: A3 gates R3, P29); grounded Ask synthesis (On-demand
behind its explicit gate, currently dormant);
status aggregation-at-rest / history / alerting (Outside current product scope, P24);
provisioning / CICD triggering (Unsupported permanently, P2).

## 12. Execution ledger

| Step | Title | Depends on | Status |
|------|-------|------------|--------|
| 1 | L2 governance gate (I2 + M11) | — | TODO |
| A1 | Falsification: agent reachability of `/mcp` | — | TODO (run during Step 1) |
| 2 | L1 graph layer (snapshots · deriveGraph · differ · events · feed) | 1 | TODO |
| A2 | Falsification: 90-day change cadence of landed sources | — | TODO (run before Step 2's What's New rewiring) |
| A3 | Falsification: second-cloud source landability (P29) | — | TODO (gates R3 only) |
| 3 | Consumer state + situation entry (manifest, M11, multi-LZ per P26) | 1 | TODO |
| 4 | L3+L4 assembly + representation (I3/I4) | 1, 2, 3 | TODO |
| 5 | Front doors: APP home + MCP three-call flow (I6) | 4, A1 | TODO |
| 6 | Honesty instruments | 2, 4 | TODO |
| 7 | Status board + self-service registration (P24, M12) | 2, 3 | TODO |
| I5 | Adapter conformance kit + Tier-B ports | alongside 2→7 | TODO |
| B | Track B: pain points · contract v0 · first negotiation | — | ONGOING |

## 13. Doc/vocabulary consequences

Ride along with the steps (no separate pass): `CONTEXT.md` gains the mid-level §9 terms
as their steps land; ADR-0013 gets the brief-endpoints amendment pointer at Step 4; the
pack §6 stale-doc set reconciles opportunistically.
