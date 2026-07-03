# Design Brief for Fable — Atlas as a Governed Multicloud PE-Context Product

> **What this is.** A handoff prompt for the **design step**, which comes *after* the analysis step. The
> flow is two documents: **(1) analyze** — `FABLE-DIRECTION-ANALYSIS-PROMPT.md` produces a *Direction
> Analysis* (candidate paths, tensions, open questions); the owner picks a direction. **(2) design — this
> document** — you take the chosen direction and produce a unified product-architecture proposal. You
> arrive here with a direction already selected; do not redo the option-space exploration. The
> archaeology is done — `PROJECT-CONTEXT-PACK.md` is your authoritative ground truth.

---

> **Status update (2026-07-03, final for this cycle).** Analysis AND design are DONE. Rulings
> **P7–P19** live in `docs/architecture/direction-decision-log.md` (newer-wins over §1 below and
> over pack §9; the pack stays a pre-analysis snapshot and is never updated with new decisions).
> Design outputs: `docs/architecture/unified-product-architecture.md` (high-level, **CLOSED**:
> context graph + moment briefs, one core × human|agent × pull|push bindings; P18 content-is-
> the-bar) and `docs/architecture/mid-level-design.md` (**M1–M10 settled**). Of §3 below:
> **O1 resolved** by P9 (*adopt a service in **my APP***, layered landing); **O2 resolved** by
> P7/P14 (snapshot legal; curation overlay = exception-only; constitution = "discover or fetch,
> never maintain"); **O3 remains live** and was generalized by P19: **sequencing is
> pain-point-driven; data-source coverage is the real foundation — no roadmap and no build until
> the owner's pain-point collection lands.**

## 0. Required reading (in order)

1. **`PROJECT-CONTEXT-PACK.md`** — the whole file. It is the factual state of the project (feat/0.2.0).
   **§9 (Positions Taken)** is the most recent and most binding; **§6** lists open questions + flagged
   conflicts (newer-doc-wins); **§7** covers discussed future directions.
2. **`docs/architecture/current-design-optimization-directions.md`** — the neutral catalog of current-design
   optimization directions (items A–J), your raw material for the "optimize existing" half. Records, not
   conclusions.
3. **North star + domain:** `docs/product/guideline.md`, `CONTEXT.md`, `docs/product/mvp-product-design.md`,
   ADRs 0002 / 0003 / 0006 / 0013 / 0015 / 0017.
4. **Do not re-run the archaeology.** Trust the pack. Only open source code when a *specific* load-bearing
   claim is in doubt — and if you do, cite `path:line`. The owner has previously caught over-claims made
   without verifying references; verify before you assert.

---

## 1. Owner positions — strong priors, mostly challengeable (from pack §9)

Treat **P1, P2, P3 as firm** (do not relitigate; design around them). Treat **P4, P5, P6 as strong priors
that evidence may overturn** — the companion analysis prompt invites challenging them; once the analysis +
owner settle a direction, they harden for this design step.

- **P1 — One product; invariant = governed context at point-of-action, 一体两面.** Human Portal + agent
  API/MCP off the SAME governed data. Design as ONE product, not two surfaces. [firm]
- **P2 — Hard boundary: never provision/deploy/trigger CICD.** Agents read status/logs/info to gather
  context before an action; Atlas never acts. [firm]
- **P3 — Phase-now wedge = Human-first portal** (top-down mandate + guideline); agent-first is the eventual
  other face, not first. [firm]
- **P4 — Status = reference + live-resolve, never ingest/mirror**; gradual; landability is the hard part;
  high maintenance debt. [challengeable on mechanism]
- **P5 — Moat = trust (provenance + freshness + governed honesty) + point-of-action, not breadth.** Build
  the portal ON the governed context API so the agent face is a byproduct. [challengeable]
- **P6 — Multicloud (>3 clouds) unified entry is the terminal frame**; cross-cloud landability gates it. [challengeable on sequencing]

## 2. Inherited constraints (revisit ONLY if the discussion explicitly reopens them)

- **Sources remain the system of record; Atlas never durably mirrors them** — discover + project + resolve
  live, cite always (README, ADR-0013). Perf cache is TTL-only, never a resilience fallback that serves
  stale content as fresh.
- **Evidence vs operational status split (ADR-0003):** Evidence flows through the consumer-neutral Context
  API with a Citation + freshness; operational status is Portal-native, uncited, a pointer to act elsewhere.
- **Resource model:** the schema core type is `Resource` addressed `{kind}/{slug}` (kinds
  `service / guardrail / landing-zone`); Topic/ContextBundle are retired (ADR-0015; pack §5). Landing Zone
  is the discovery root (ADR-0017), a code constant, never a YAML seed.
- **Governed-honesty mechanisms (ADR-0006):** fresh/version-drift, review-decay, authority-conflict
  (surface both, pick no side), honest dead-end + Feedback — no active re-validation.
- The **Terminology Law** (§5 below).

## 3. Open questions you are here to work — do NOT pre-answer these

- **The core question:** *Is there a better path, and how should the future look* for the unified
  governed multicloud PE-context product?
- **O1 — the hero point-of-action.** Which single moment anchors phase-1 human-first depth: *adopt a
  service in my landing zone* (discover → available here? → applicable guardrail/policy → cited IaC
  starter → owner/onboarding), *cited governance answer* (wayfinding), or *cross-cloud same-task
  comparison*? (Owner's current lean: service-adoption-in-my-LZ, with cited-governance-answer as its
  trust core — not settled.)
- **O2 — where durable curated/governance state lives.** ADR-0013/0015 "durably stores presentation
  metadata" vs plan-018 "nothing durable in code" — unresolved (optimization item B). review-decay/owner/
  authority fields need a home; the Git-manifest ingestion seam (ADR-0007) is the designed candidate.
- **O3 — multicloud data landability** — the gating constraint on any cross-cloud ambition (P6). Design
  around it; do not assume it away.

---

## 3A. Design & optimization directions already on the table (discussed — INPUTS, not conclusions)

Raw material, not a settled plan and not ranked. Records only; the owner decides which survive. Full
detail + citations in `docs/architecture/current-design-optimization-directions.md` (items A–J) and pack
§7. Summary:

**Optimize-existing (current-design items A–J):**
- **Governed-context seam under-used (A / F / J):** the in-process Portal read path bypasses the
  ElastiCache cache + Bearer pipe; only HTTP/agent paths thread them. 一体两面 wants ONE governed API both
  faces consume — else content/freshness diverge.
- **Durable curation store (B):** no durable home for curated/governance fields (O2).
- **Discovery cold-start (C):** `discoverAll` runs live per-boot over the full ~100-service spine; cold
  start = full crawl. Options: persist/warm snapshot, scheduled refresh, lazy per-resource.
- **Status reference-vs-ingest (D):** the P4 line, unimplemented for app/CICD/security-scan status.
- **Availability double-parse (E); feedback in-memory default (G); Ask scaffold-vs-feature (H); doc drift
  (I).**

**Discussed future directions (pack §7):**
- Source-lifecycle continuous reconciliation + deferred mutable control plane (post-MVP).
- Automated source governance / broad-scan discovery + auto-classification (ADR-0008, Phase 2).
- APP-scoped Entra identity (ADR-0012, scope seam currently filled by LZ not APP).
- Agent discovery & API redesign proposal (`docs/atlas-agent-discovery-and-api-redesign-proposal.md`).
- API-Gateway grounded-adoption hard gate (bespoke NL→IaC explicitly out of scope).
- Multi-LZ expansion beyond `awsf` (newsletter, per-LZ catalog variants, availability axis, Ask, `/estate`).
- Live LLM synthesis in Ask (adapter scaffold exists; feature not started, P-aligned as dormant).

## 4. Your job — the unified product architecture (design step)

You arrive with a direction chosen from the *Direction Analysis*. **Do not redo the option-space
exploration.** Converge the current Atlas into **one** coherent governed-context product architecture along
the chosen direction. Cover at minimum:

- **The single governed context API as the canonical backend** both faces consume (一体两面): how the human
  Portal and the agent API/MCP render/serve the same governed data, and how the current in-process vs HTTP
  split resolves (optimization items A/F/J).
- **The hero journey (O1) as a per-step context contract** — a table: each step → question answered →
  source `source_class` → resolver → citation shape → honest-empty behavior when data is missing.
- **Where curated/governance state lives (O2)** — resolve the durable-store question or state the decision
  and its consequence for review-decay/authority.
- **Status as reference + live-resolve (P4)** — how status enters as cited pointers without ingestion.
- **Phase-now (human-first mandapreview.htmlte) vs deferred** — what ships now to satisfy P3; what is explicitly later
  (agent-first depth, status aggregation, cross-cloud expansion), without slicing to hide debt (§5).
- **Non-goals as architectural constraints** — never provision/CICD (P2); never durably mirror sources;
  never serve stale-as-fresh; Evidence vs operational-status never blurred.

**How to work (this owner's preferences):**
- **One question per turn** when you need a decision; make each a sharp choice with concrete options, and
  leave room for a strong owner-authored alternative. Product/architecture altitude, never implementation
  detail (memory `atlas-grill-altitude-preference`).
- **Verify before asserting** any code/reuse/dependency claim. Cite the pack section or `path:line`.
- **Prefer cohesion over fragmentation** — a coherent product, not a bag of parts.
- Persist decisions as they're made (append to pack §9 or a decision log); don't let them evaporate.

**Output:** a reviewable design document (`docs/architecture/unified-product-architecture.md`). Cite the
pack sections you build on.

## 5. Terminology Law (mandatory in all output)

- **Do not slice the product by version/phase to hide architectural debt.** Banned vocabulary:
  `v1 / v2 / MVP / first release / later release / future phase / thin slice / 留槽 / 以后填 / roadmap
  phase`. Describe every capability with one **capability state**: *Required / Optional at runtime /
  On-demand / Profile-specific / Capability-bounded / Unsupported / Outside current product scope /
  Implementation dependency.* Governing line: **build the complete bounded product, not a sequence of
  incomplete releases.**
- **Platform vocabulary is sacred** (`CONTEXT.md`): service / landing zone / anchor / authority level /
  guardrail / availability / resource `{kind}/{slug}`. Do not genericize or invent parallel terms.
- **Keep intended vs interim honesty** and the **Evidence vs operational-status** line (ADR-0003) — never
  blur cited Evidence with uncited live status.

## 6. Working agreement / anti-goals

- **Reply to the owner in Chinese**; write all docs and code in English.
- **No fabrication.** Atlas never invents ungoverned content or an uncited claim; hold the same bar in
  design work — no invented numbers, no unverified reference presented as fact. Every provenance/freshness
  claim ties to a real source.
- **Don't reopen the §1 firm constraints (P1/P2/P3) or the §2 inherited constraints**, and don't redo the
  archaeology.
- When a claim about current state is load-bearing, verify it (pack section or `path:line`) before asserting.
