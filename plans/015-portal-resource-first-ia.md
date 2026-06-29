# 015 — Portal Resource-first IA migration (ADR-0015 execution)

> **Status (2026-06-29): CLOSED — core DONE, remainder deferred-optional.** The
> user-facing objective (resource-first service IA) shipped: **15a** (records +
> metadata migration) and **15d** (catalog re-key → canonical `/service/{provider}/{id}`)
> landed in [`plans/020`](020-service-resource-convergence.md); **15b** (agent
> `{kind}/{slug}` addressing) and **15f** (retire old surfaces) were already done
> (15f via 019 + 020, clean removal, no 301). The three remaining steps are
> **not opened as a follow-up plan** — each is premature or empty today:
> - **15c (APP-scope seam)** — ADR-0015 ships this *independently* of the ADR-0012
>   APP migration; building the no-op seam now is premature. Folds into ADR-0012
>   when that is scheduled.
> - **15e (facet pages + bounded-concurrency aggregator)** — `private-networking` /
>   `logging-monitoring` already resolve via `/policies/$policyId` (019), and no
>   resource carries those facet tags yet, so a facet aggregate would be an empty
>   shell. Revisit only if product wants theme-aggregate pages *and* the data exists.
> - **15g (terminal blind-loop)** — the agent surface (15b) was unchanged by 020,
>   so discovery behaviour did not change; a fresh blind-loop is routine verification,
>   not a gate on new capability.
>
> Original execution plan (historical) follows.

> Handoff from `plans/013` "Converged c-2 target model". A 2026-06-27 grilling pass revised that
> shape and **accepted** [ADR-0015](../docs/adr/0015-portal-resource-first-ia.md); the MVP done-bar
> was reached the same day, clearing the only gate. This plan is the authoritative execution plan;
> it supersedes 013's c-2 section.
>
> This is the **first** deliberate change to the Portal context-API calls and the external read
> addressing since the **011 §26 freeze** — it therefore unfreezes those surfaces in a controlled
> order and **re-runs the blind-agent loop** (011 §D, five consecutive passes).

## What this executes (ADR-0015, six locked decisions)

1. **Resource = primary content object**, addressed `{kind}/{slug}`, section-grouped via
   `getResourceContext`; the record owns identity/presentation metadata **and** Section→Source
   bindings.
2. **Promotion rule (three-way):** each Topic → exactly one of **Resource** / **Facet** /
   **Decompose** by the structural test (stable `{kind}/{slug}` identity · independent lifecycle ·
   one object per Section · an authoritative Source for the object itself).
3. **Topic demotes to a Facet/attribute:** `resources.yaml` gains `topics: [...]`; a Facet page is
   a filtered Resource list **plus** an optional **server-side bounded-concurrency** aggregate of
   members' Sections (per-Resource boundary + Citations, an ADR-0014 §2 view — re-resolves
   nothing). No Facet content endpoint; no second content model.
4. **Addresses unify on `{kind}/{slug}`** for Portal and Agent alike (revises ADR-0013's
   `{provider}/{resource}`).
5. **Ships independently** of the ADR-0012 APP migration, but **architecturally reserves** the APP
   seam (an optional, default-no-op scope filter on the Registry/Explore read; `{kind}/{slug}`
   excludes `app_id`).

## Invariants to preserve (do NOT regress) — ADR-0013/0014

- **α live projection:** request-time resolution through the shared resolver registry; no stored
  excerpts, no precompute; `resolvedAt`, never `generatedAt`.
- **One atomic resolution result, many deterministic assemblers.** Every new view
  (resource page, facet aggregate) consumes resolver output **verbatim** — no re-resolution, no
  status reinterpretation, no fact re-ordering.
- **Consistency tests compare atomic facts** (`sourceId` / `anchorId` / fragment hash / citations /
  warning codes / status), never whole-response shape.

## Migration order — contract-neutral first, breaking last

Land 15a/15c in any order (both reversible, neither breaks a published contract). Do the
freeze-touching, blind-loop-gated steps (15b, 15d–15g) strictly in sequence.

| Step | Scope | Breaking? | Verify | STOP / gate |
| --- | --- | --- | --- | --- |
| **15a** | **Disposition authoring (data).** Apply the three-way rule to all 12 Topics → an authoritative disposition table. For each **Resource**: create/complete its `resources.yaml` record (`kind`/`slug`/`provider?`) and migrate identity metadata (owner, support_channel, status, category, version, entry_tools) onto it. **Decompose:** split `serverless-compute` → `service/aws/lambda`; `s3-guardrails` → the concrete guardrail Resource(s). Add `topics: [...]` to every record. `iam-boundary`: Resource iff one concretely-governed guardrail, else Facet. | No — additive; old `/catalog/$topicId` stays. | `data/*.yaml` count-oracle + equivalence-oracle green; new **disposition completeness** test (every Topic has exactly one disposition; every Resource carries identity metadata + ≥1 Section). | Pure data + reversible. Can land alone with Portal still topic-centric. |
| **15c** | **Reserve the APP scope seam.** Add an optional `visibility/scope` argument to the Registry/Explore read path, defaulting to a global-visible **no-op**. `{kind}/{slug}` carries no `app_id`. | No — default behaviour unchanged. | Golden: default output byte-identical to today. Seam unit test: passing a narrowing scope filters the listing. | Architectural reservation only; no UI. |
| **15b** | **Unify addressing on `{kind}/{slug}`.** Agent surface `/api/resources/{kind}/{slug}` + `/resources/{kind}/{slug}.md` (was `{provider}/{resource}`); `provider` folds into the `service` slug; provider-less kinds (`guardrail/...`) now addressable. Keep old paths as 301/alias during transition. | **Yes** — changes published 011 agent URLs → **unfreeze §26 (agent side)**. | `openapiDocument.test.ts`; **pre-flight hard gate** — `GET /api/resources/service/aws/textract?sections=network,availability` returns both Sections `available` + citation; then **blind-loop ×5**. | Pre-flight must pass before blind loop (else it is a wiring bug, not a discovery bug). |
| **15d** | **Resource content page.** New Portal route `/{kind}/{slug}`: `catalog/$topicId` migrated — re-keyed, re-grouped Source→Section, re-pathed `buildContextBundle` → `getResourceContext`; page composes record-metadata + resolved content. Add route in parallel; leave `catalog/$topicId` live for now. | **Yes** — changes Portal context-API call → **unfreeze §26 (Portal side)**. | New page is information-lossless vs old datasheet (specs / entry_tools / availability strip / related guidance / related-in-domain all present); deferred-loading + skeletons do **not** regress to blocking loaders. | Gate on 15a (data) + 15b (addressing). |
| **15e** | **Facet pages + bounded-concurrency aggregator.** Filtered Resource listing (`?topic=`) + opt-in aggregate view; a **server/internal assembler** fans out `getResourceContext` with **bounded** concurrency, each block keeping Resource boundary + Citations. No browser N+1; no Facet content endpoint. | No new contract (composes existing reads). | Aggregate golden = an ADR-0014 §2 view (no re-resolution; per-Resource citations intact); concurrency cap enforced; aggregate is deferred/opt-in (does not slow the listing). | Gate on 15a + 15d. |
| **15f** | **Retire old surfaces + 301.** Retire `/topics/{id}/context`; 301 `catalog/$topicId` by disposition (Resource→its address; Facet→its listing; Decompose→Facet page listing split-out Resources); Portal migrates off `/topics`; `source-topic-mappings.yaml` content role collapses into `resources.yaml`. | **Yes** — removes routes. | 301 matrix test (every old Topic URL lands correctly by disposition); no dangling refs; full `pnpm -w typecheck` + `vitest` + `build` green. | Gate on 15d + 15e (new surfaces must be live first). |
| **15g** | **Finalize freeze + terminal verify.** Formally lift §26 for the migrated surfaces; **blind-loop ×5** end-to-end on the unified surface; if ADR-0012 is accepted by now, amend its §5. | — | Blind-agent five consecutive passes (011 §D 3-criteria judging); typecheck/test/build green. | Terminal gate. |

## Out of scope (decoupled, do NOT fold in)

- **`portal/src/api/server/availability.ts` retirement** — a Registry/Explore-read swap to the
  governed `availability-matrix` Source, gated on that Source's **data coverage**, not on this
  migration (see `plans/013`, 011 §3).
- **ADR-0012 APP migration** — the APP entry/route wrapper and real `app_id` filtering. This plan
  only *reserves* the seam (15c); layering APP later inserts into it (no IA rewrite).

## Notes

- **Blind-loop discipline (011 §D):** run the blind agent outside the repo,
  `--no-custom-instructions`, locked to the one root URL; on any failure **fix the surface, not the
  prompt**, and reset the consecutive count. Touched twice here (15b agent addressing, 15g terminal).
- **`searchResources` stays a Discovery read** — name → canonical `{kind}/{slug}`, no content
  resolution. The `{provider}` → `{kind}` change (15b) must keep it identity-only.
