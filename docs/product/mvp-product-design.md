# Atlas — MVP Product Design

> **The single, authoritative MVP design.** Consolidates the product design and the
> architecture/MVP design settled through 2026-06-14. Each decision references its
> **contract** (an ADR, a schema, a validator, or a code seam) rather than re-deriving it.
> The one immutable north star is [`guideline.md`](./guideline.md); where this doc and the
> older [`current_design.md`](../architecture/current_design.md) /
> [`mvp_next_steps.md`](../architecture/mvp_next_steps.md) disagree, **this wins**.
>
> Supersedes and absorbs the former `product-design.md` and `mvp-design.md` (now removed — consolidated here).
> Deep-dives live in their own docs (governance, guidance, design system) — linked inline.

---

## 1 · Product identity  · contract: [ADR-0002](../adr/0002-atlas-is-a-portal-context-layer-is-its-core.md)

Atlas is an **information-centric Cloud Platform DevEx Portal** — a "Platform as a Product"
UX layer that consolidates fragmented platform documentation and adds AI-assisted
discovery (`guideline.md`).

- The **Context Layer is the product's core engine** (governed registry + authority +
  locator/anchor resolution + context-bundle assembly), not a separate product.
- The **Portal is one consumer** of that engine — the primary surface, not a privileged
  one. The same contract serves agents/MCP.

## 2 · Users & the one job

**Users:** every engineer at the company (platform, backend, full-stack) plus technical
PMs/EMs. **Defining context:** they open Atlas *mid-task, in flow, with a specific question
and a deadline.**

**The one job — MVP center of gravity is *wayfinding*:** tell the user, fast and
authoritatively, **what exists, who owns it, where the authoritative source is, and how
fresh it is.** Browsing and asking both serve that orientation. The center **evolves to
*cited answers*** later (synthesized, source-cited); in the MVP, Ask is secondary.

## 3 · The moat & governed honesty  · contract: [ADR-0006](../adr/0006-governed-honesty-model.md)

The moat is governed **authority + ownership + locator + freshness — and never lying about
them.** Differentiator vs wiki/Backstage/Glean: *governed citation* ("backed by *this*
registered authoritative source, at *this* section, with *this* freshness and authority").

"Never lies" is kept by four mechanisms (no active re-validation needed):

| Mechanism | What it does |
|---|---|
| **Fresh-drift** | Staleness derived at resolve time from live source version vs recorded `observed_version` (`stale_source`). |
| **Review-decay** | Curated claims (`owner`, `authority_level`, mappings) past `review_frequency`/`last_reviewed_at` *visibly age* instead of asserting confidently. |
| **Authority conflict** | Two sources claiming the same scope → surface both, pick no side. One real conflict is **seeded in the hero slice** to prove it. |
| **Beyond scope** | Unregistered topics get an honest dead-end + a "request registration" action filing `Feedback(missing)` to stewards. Feedback is first-class. |

## 4 · What Atlas refuses to become

- **General-purpose search** (routes by authority, not keyword).
- **Shadow content store / doc mirror / CMS / system of record** (sources stay the SoR).
- **A recommender** — *Atlas* packages governed context deterministically; judgment is the
  consumer's (a consumer LLM synthesizing a cited answer is allowed).
- **An identity / access-control system** — identity-agnostic Bearer pipe, no V1 auth
  ([ADR-0001](../adr/0001-identity-agnostic-bearer-pipe.md)).
- **A provisioning / workflow executor** — read-only status, points to TFE/Harness, never
  executes ([ADR-0003](../adr/0003-evidence-vs-live-status-split.md)).
- **A monitoring / metrics / incident platform** — the Dashboard is a read-only **status
  pointer** only (no history/trends/alerting).

## 5 · Architecture & boundaries

**Evidence vs live-status split**  · contract: [ADR-0003](../adr/0003-evidence-vs-live-status-split.md)
- **Evidence** — anything derived from a citable Source (Confluence excerpts, Terraform
  module docs, the parsed Availability matrix) → flows through the **consumer-neutral
  Context API** and **always carries a Citation**.
- **Operational status** — live TFE run/workspace state → **Portal-native**, never in the
  Context API, never presented as Evidence.

**Deterministic core / latent consumer.** Atlas selects/resolves/packages deterministically;
interpretation, advice, follow-ups are the consumer's. (Latent classification is allowed in
the *governance* plane as human-reviewed proposals — see §10 — not in the runtime path.)

**Execution model.** Request-time resolution. The availability cache is a **lazy TTL**
optimization; the **runtime resolution plane never runs background workers.** The
**lifecycle plane** *may* run scheduled jobs (Phase-2 governance). Two credential planes
(health/lifecycle vs runtime resolution) never mix (`CONTEXT.md`).

**Resolution identity**  · contract: [ADR-0001](../adr/0001-identity-agnostic-bearer-pipe.md) — an
identity-agnostic Bearer pipe; caller token if supplied, else a narrow service-token
fallback; Confluence's own ACL governs visibility.

## 6 · The MVP bar (full spine) & boundaries  · contract: [ADR-0004](../adr/0004-public-safe-proof-boundary.md)

The product looks finished and is **unproven**; the MVP makes the spine real **without
expanding the surface**. MVP-done requires **all**:

1. **Manifest control plane** — pilot truth off `pilotRegistry.ts` seed into validated
   `data/*.yaml` (Source/Topic/Anchor/mapping), via the ingestion seam (§10). Guidance
   already ships this.
2. **Real-data resolution** (§8).
3. **Deployable Context API** — generic infra (`infra/`, lambda handler), deployable;
   deployed for real **company-side**, not in this public repo.
4. **Proven contract** — tests prove the Portal and an external Skill consume **equivalent
   bundle shapes** (the public proof of "one contract, many consumers"; needs no live
   endpoint).

**Public-safe proof boundary:** *public MVP-done* = green tests + deployable infra +
equivalence proven by tests; *company-side MVP-proven* = deployed against real sources.
Adapters stay generic + env-configured; no company specifics committed.

## 7 · Coverage strategy & the hero slice

**Tiered coverage:** one **deep hero slice** fully governed + a **shallow registry** of
everything else (owner/location/authority, labeled "not yet deeply governed"). Breadth to
be useful, one slice deep enough to be a credible proof; the depth label keeps it honest.

**Hero slice = the Federated Landing Zone + three deep Services** — the **Federated Landing
Zone** deep-governs **S3 / API Gateway / Textract** end to end (exercises landing-zone
navigation, the Service datasheet, Sources, Availability matrix, Guardrails, and the
onboarding Guidance); Regulated/Sandbox LZ stay shallow (labeled "not yet deeply governed",
and Regulated keeps the restricted/stale test fixtures). **One real authority conflict is
seeded here** — Textract private-subnet config, module README ⟷ Confluence runbook
([ADR-0010](../adr/0010-module-and-confluence-source-division.md)) — to prove the
surface-both behavior. ("Service" = the catalog's AWS-service entry; the schema type stays
`Topic` — CONTEXT.)

## 8 · Real-data scope

| Source | MVP state & path |
|---|---|
| **Confluence** | Real adapter exists (`confluenceCloudContentProvider`, env-configured). MVP registers real pilot pages/anchors and proves end-to-end excerpt resolution. → Context API (Evidence + Citation). |
| **Availability** | Parse a governed Confluence page into the region×Service matrix; lazy-TTL cache; `availability-cell` parametric anchor, response precision mirrors query precision; honest dead-end on parse failure. Replaces the portal fixture projection. → Context API (Evidence + Citation). *(Contracted: [ADR-0009](../adr/0009-availability-matrix-resolver.md).)* |
| **Terraform Enterprise** | `terraform-module` Source reads registry metadata (`module-field` anchor) **and** README prose (`markdown-heading`); Confluence is a separate platform-runbook Source. → Context API (Evidence + Citation). Read-only run/workspace **status** (Dashboard, Portal-native, uncited) **deferred** (§9). Never executes provisioning ([ADR-0003](../adr/0003-evidence-vs-live-status-split.md)). *(Contracted: [ADR-0010](../adr/0010-module-and-confluence-source-division.md).)* |

## 9 · Surfaces  · design system: [ADR-0005](../adr/0005-blueprint-design-identity-and-reskin-seam.md) + [`DESIGN.md`](../../DESIGN.md)

The `/proto/*` designs are the production direction: **proto replaces mainline**. Design
register is **showcase-inflected instrument** (welcoming Home + editorial What's New are
sanctioned); Blueprint stays the identity, **token-driven so company re-skin is a token
swap**.

| Surface | MVP role |
|---|---|
| Home | Core — welcoming directed entry (kept as-is) |
| Catalog + Service detail | Core — what exists / who owns / where authoritative |
| Sources | Core — registry ledger: locator + authority + freshness |
| Availability | Core — region×service, governed (Regions merges in) |
| Guardrails | Core — authority + severity |
| Guidance | Core — `route` type, **one** journey (§11) |
| What's New | Core — editorial change surface |
| Ask Atlas | Secondary — **wayfinding router in MVP** (ranked sources + citations, **no LLM synthesis**; built LLM path dormant behind a flag) |
| Skills Hub | Secondary |
| Overview / Dashboard | Secondary, deferred — read-only TFE status pointer (Portal-native) |

## 10 · Governance  · contracts: [ADR-0007](../adr/0007-runtime-object-ingestion-seam.md) (seam) · [ADR-0008](../adr/0008-automated-source-governance.md) (Phase 2) · deep-dive: [`governance-design.md`](./governance-design.md)

**How objects enter (the seam):** one **Git-managed manifest seam with a validation gate**.
Git is the single source of record; "runtime add" = a validated manifest loads without a
code redeploy — **not a live mutable store**. AI/discovery emit `status: draft` manifests;
the **PR is the review surface**; **promotion = a human merge**.

**MVP governance is lean:** the seam + manifest + on-demand CLI metadata fetchers +
review-decay. It carries the **schema seams** (`status: draft`/`unverified`, lifecycle
states) so Phase 2 is additive.

**Phase 2 (post-spine):** lifecycle-plane **broad-scan discovery** + **confidence-gated
auto-classification** (high → draft PR; low/conflict/high-authority → human queue) +
scheduled re-scan (auto-merge verifiable deltas, flag judgment deltas). Reverses the
"no crawler" non-goal. Classification is latent work in the governance plane only.

## 11 · Guidance  · contracts: [`guidance_design.md`](./guidance_design.md) + [`guidance-authoring.md`](./guidance-authoring.md) + `@atlas/schema` `GuidanceSchema`

Guidance is **wayfinding, not workflow** — `Guidance → steps → tasks`, vertical stepper,
never executes work. **MVP ships two journeys** (decided 2026-06-20): `new-app-onboarding`
(`route`) and `landing-zone-selection` (`decision`), both loaded + validated through the
ingestion seam. The `decision` *rendering* is owned by the UI workstream; the data/contract
side simply loads + validates both. `checklist` stays schema-modeled forward-compat (not
built); `destination` is the **required terminal step kind** (not cut). Authoring is
AI-draft-then-owner-review; validate with `pnpm validate:guidance`.

## 12 · Contracts index ("引用契约")

| Concern | Contract / source of truth |
|---|---|
| Product identity | [ADR-0002](../adr/0002-atlas-is-a-portal-context-layer-is-its-core.md) |
| Resolution identity (Bearer pipe) | [ADR-0001](../adr/0001-identity-agnostic-bearer-pipe.md) + `CONTEXT.md` |
| Evidence vs live-status boundary | [ADR-0003](../adr/0003-evidence-vs-live-status-split.md) |
| Public-safe proof boundary | [ADR-0004](../adr/0004-public-safe-proof-boundary.md) |
| Design identity / re-skin | [ADR-0005](../adr/0005-blueprint-design-identity-and-reskin-seam.md) + [`DESIGN.md`](../../DESIGN.md) |
| Governed honesty | [ADR-0006](../adr/0006-governed-honesty-model.md) |
| Object ingestion seam | [ADR-0007](../adr/0007-runtime-object-ingestion-seam.md) |
| Automated governance (Phase 2) | [ADR-0008](../adr/0008-automated-source-governance.md) + [`governance-design.md`](./governance-design.md) |
| Availability resolver / anchor | [ADR-0009](../adr/0009-availability-matrix-resolver.md) |
| Module vs Confluence sources / conflict | [ADR-0010](../adr/0010-module-and-confluence-source-division.md) |
| Bundle-equivalence proof | [ADR-0011](../adr/0011-bundle-equivalence-proof.md) |
| Domain glossary | [`CONTEXT.md`](../../CONTEXT.md) |
| Schemas | `@atlas/schema` (`SourceSchema`, `TopicSchema`, `AnchorSchema`, `GuidanceSchema`) |
| Guidance authoring | [`guidance_design.md`](./guidance_design.md) + [`guidance-authoring.md`](./guidance-authoring.md) |
| Validators | `pnpm validate:guidance` (`validateGuidanceManifest`); future `validate:sources/topics` |
| Context delivery code | `context-layer/` (`contextBundleService`, `discoveryRoutes`, `contextRoute`, `resolvers/`, `confluenceCloudContentProvider`, `lambda/handler.ts`) |
| Thesis / build sequence (background) | [`current_design.md`](../architecture/current_design.md) · [`mvp_next_steps.md`](../architecture/mvp_next_steps.md) |

## 13 · Open implementation questions

**Contracted 2026-06-20** (grilling session — these were the critical-path blockers; all now
have a contract and are ready to build):

1. **Bundle-equivalence test** → [ADR-0011](../adr/0011-bundle-equivalence-proof.md). The
   Skill side drives SKILL.md's documented raw-HTTP sequence (not the Portal client lib);
   both bundles asserted byte-equal + schema-valid, in-process, no deployed endpoint.
2. **Availability parser/anchor** → [ADR-0009](../adr/0009-availability-matrix-resolver.md).
   One parse → structured matrix (lazy-TTL, perf only); new `availability-cell` parametric
   anchor; **response precision mirrors query precision** (cell/row/col); honest dead-end on
   parse failure (never stale cache).
3. **TFE module-docs Source** → [ADR-0010](../adr/0010-module-and-confluence-source-division.md).
   `terraform-module` reads **both** registry metadata (new `module-field` anchor) **and**
   README prose (`markdown-heading`); Confluence is a separate platform-runbook Source. TFE
   **status (Dashboard) stays deferred** (§9).
4. **Ask-router** — reuses the existing topic/source search ranking
   (`/api/topics?query=` + `/api/sources?query=`); output = ranked topics/sources +
   citations, **no LLM synthesis**; the built LLM stack stays behind `ATLAS_ASK_LLM`
   (default off). Single ranking source of truth.
5. **Hero-slice dataset** — **Federated Landing Zone** deep-governs **S3 / API Gateway /
   Textract**; Regulated/Sandbox LZ shallow (labeled); seeded conflict = Textract
   private-subnet (module README ⟷ Confluence runbook), see
   [ADR-0010](../adr/0010-module-and-confluence-source-division.md). Journeys: **both**
   `new-app-onboarding` (route) and `landing-zone-selection` (decision) load + validate
   (decision *rendering* is the UI workstream's call).
6. **Review-decay** — per-object `review_frequency` vs `last_reviewed_at`, **two stages**
   (aging >80%, overdue >100%), curated fields only (owner/`authority_level`/mappings),
   derived at resolve; distinct from `stale_source` (CONTEXT).
8. **MVP lifecycle** — auto@resolve: `stale_source`/`restricted_source`/`broken_anchor`/
   review-decay; manual in manifest until Phase-2 scanner: deprecated·retired/`unverified`·
   `draft`/`changed_detected` (CONTEXT).
11. **What's New** — authored `data/whats-new.yaml` with a forward-compat seam
    (`change_kind` + optional `source_ref`) so Phase-2 lifecycle deltas append later.
12. **Guardrails** — projected from a single policy-document Source; **severity is an
    attribute on the source↔topic mapping**; single-truth, stale-only, never conflict; no
    dedicated manifest ([ADR-0010](../adr/0010-module-and-confluence-source-division.md), CONTEXT).
13. **Home** — grid **derived from the registry** (Services/LZs/journeys) + a small curated
    `data/home-featured.yaml` (hero + featured journey).
14. **Skills Hub** — reuses the existing `/.well-known/agent-skills/index.json` as the single
    consumer registry; maintained alongside each `SKILL.md`.

Also contracted this session (cross-cutting vocabulary): **Service** = catalog AWS-service
entry, a facet of `Topic`; Landing Zone/Guardrail/Availability are their own surfaces
(CONTEXT). The word **`capability` is purged from live code/schema/UI** — the `topic_type`
value is `service` (was `capability`), `Topic` the type stays; goal
`goal_prompt_capability_to_service_rename.md`. **Public-safe naming** = neutral, de-branded
(Global Cloud Regions / Federated Landing Zone / primary·dr·future-dr); existing `acme`
references to be de-branded too.

**Still open:**
7. Beyond-scope `Feedback(missing)` modeling — `target_id` for a non-existent topic; where
   the action lives; steward surface (MVP or Phase 2).
9. "Deployable" acceptance in a non-deploying public repo — *default* (not yet ADR'd): infra
   synth/plan tests + handler unit tests. Confirm when the deploy chain is built.
10. **Sequencing:** which proto variant is the canonical wiring target per surface — open
    (handled in parallel; project memory `proto-variant-decisions`). Freeze before wiring.

**Cross-cutting (not addressed in the design):**
15. **Measurement / observability** — the success metrics (selection precision, anchor
    resolution rate, citation completeness, time-to-find) have no instrumentation plan.
16. **Latency / performance budget** — request-time live Confluence resolution + bundle
    assembly has no target/SLA; the headline demo could feel slow.
17. **Public-safe enforcement** — no CI guard against committing company specifics (today
    policy-only).
18. **Steward role & MVP surfaces** — review queue, feedback triage, promotion all assume
    stewards; the role + its MVP surface are unscoped.

**Spine implementation / validation:**
19. **Source/Topic/Anchor manifest validators** (`validate:sources/topics`) — designed, not
    built (Guidance has its validator).
20. **ADRs 0002–0006 vs shipped code** — not yet cross-checked (only governance/guidance
    audited; the earlier ADR-0007 number collision shows hidden conflicts are possible).

**Agent-readiness consumer protocol (Phase 3 — adjacent to blocker #1):** how an agent/Skill
*actually* consumes the bundle (the other half of "one contract, many consumers"); §13 #1 only
covers the test-time equivalence criterion, not the live consumption protocol. Open
(`docs/architecture/agent_readiness.md` §Open questions):
21. **Markdown source of truth** — render Markdown from the Context bundle on the fly vs
    maintain `.md` files alongside (lean bundle-render to avoid drift).
22. **well-known / static hosting** — `public/` static vs Nitro server route per artifact
    (default: static for `robots.txt`, server routes for data-derived/digest-bearing).
23. **MCP transport** — streamable-HTTP endpoint inside the Nitro server vs a separate
    process (decide when Phase 3 starts).

## 14 · Definition of Done

- Pilot data manifest-driven and validated; `pilotRegistry.ts` no longer the source of truth.
- Confluence excerpts and the availability matrix resolve from real pages with citations and
  freshness/drift warnings.
- TFE module docs resolve as a citable Source; TFE status read-only in the Dashboard,
  honestly labeled if fixture.
- Context API deployable; Portal and Skill pass the bundle-equivalence suite.
- One hero journey (`route`) live and registry-backed; one authority conflict surfaced.
- `pnpm lint` / `typecheck` / `test` clean.

## 15 · See also

[`governance-design.md`](./governance-design.md) · [`guidance_design.md`](./guidance_design.md) ·
[`guidance-authoring.md`](./guidance-authoring.md) · [`../../DESIGN.md`](../../DESIGN.md) ·
[`../../CONTEXT.md`](../../CONTEXT.md) · [`../adr/`](../adr/).
