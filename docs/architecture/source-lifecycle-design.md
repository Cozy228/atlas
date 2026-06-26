# Minimal-toil source lifecycle

> Model the whole Source lifecycle as **continuous reconciliation**: Git holds desired state and human judgments, the machine owns observation. Adopt reconcile *semantics* now; defer reconcile *infrastructure* until measured triggers. Discover by watched container, make freshness content-relative, tombstone instead of hard-delete. Refines [ADR-0008](../adr/0008-automated-source-governance.md) and MVP-design §13 #6/#8.

Status: proposed — **post-MVP** (beyond the MVP bar)
Date: 2026-06-24

## Scope

This entire design is **post-MVP**. The MVP ships the manual, Git-managed ingestion seam ([ADR-0007](../adr/0007-runtime-object-ingestion-seam.md)): a human hand-writes `data/*.yaml`, CI validates, deploy publishes. This document is the *automation* that comes after — it removes the human toil that the manual seam leaves at registration and at the stale/drift/deprecate/delete loop. Nothing here is required to hit the MVP bar; it is the next destination once the MVP is in users' hands.

## Context

Atlas is a portal over a consumer-neutral context layer ([ADR-0002](../adr/0002-atlas-is-a-portal-context-layer-is-its-core.md)).
Its moat is **broad, fresh, governed** coverage of external knowledge/config Sources —
Confluence runbooks, GitHub-Enterprise / Terraform-module READMEs, the Terraform-Enterprise
registry, policy docs. The stated thesis is **low human involvement**: central
hand-curation does not scale ([ADR-0008](../adr/0008-automated-source-governance.md)).

A full pass over the Source lifecycle shows the human effort is **not** spread evenly — the
middle is already cheap, the two ends leak:

| Stage | MVP (manual seam) | Human cost |
|---|---|---|
| discover | hand-write `data/sources.yaml` | **high**, doesn't scale |
| ingest / parse | live Confluence/GitHub adapters fetch + anchor-extract | ~zero |
| store | Git is the record; excerpts per-request, Valkey-cached | low |
| display | portal `/sources` renders from the registry | ~zero |
| **stale** | `review_frequency` + `last_reviewed_at`, **calendar**-based, dates hand-filled | **high**, rots by default |
| **out-of-sync** | only Confluence has `observed_version` drift, baseline hand-filled; GitHub/TFE have none | **high** |
| deprecated | human sets `authority_level: deprecated` | medium |
| delete | human deletes the YAML entry | medium |

So the cost concentrates at **registration** and at the **stale / drift / deprecate / delete**
governance loop. Everything between ingest and display is already low-touch.

We are not starting from zero. The skeleton is already contracted:

- [ADR-0007](../adr/0007-runtime-object-ingestion-seam.md): Git-managed manifest seam + validation
  gate; **no mutable store, no CMS, no worker fleet**; "runtime add" = manifest + data deploy.
- [ADR-0008](../adr/0008-automated-source-governance.md): broad-scan discovery (reverses "no
  crawler") + confidence-gated classification → draft-manifest PRs; scheduled re-scan proposes
  manifest updates; **verifiable deltas auto-merge, judgment deltas need review** (Phase 2).
- [ADR-0006](../adr/0006-governed-honesty-model.md): governed honesty; review-decay ages what no
  scan can verify.
- MVP-design §13 #6 (review-decay: two-stage aging>80% / overdue>100%, per-object
  `review_frequency`) and #8 (lifecycle states: **auto@resolve** = stale/restricted/broken/decay;
  **manual** = deprecated/unverified/draft/changed_detected).
- The schema even pre-seeds the seam this design completes: Source carries `last_observed_at`
  (machine) **distinct from** `last_reviewed_at` (human), plus optional `observed_version`;
  Anchor carries optional `content_fingerprint`. What is missing is **who writes those fields
  and on what cadence** — and the *semantics* of freshness.

This design settles those, optimising the whole lifecycle for one constraint: **minimum human
effort**.

## Decision

**Separate facts the machine can verify from judgments only a human can make; model the
lifecycle as continuous reconciliation; automate the facts completely and route only the
judgments to people.** Git stays the single record of *desired state and decisions*.

The architecture choice (A) is: **adopt the reconcile model in logic, keep the cheap execution
substrate (Git + scheduled workflow)**. A long-running control plane with a mutable store
(B) is a named, designed destination — see *Considered and rejected* — adopted only on measured
triggers, never speculatively.

> Autonomy is judged by **whether the normal path needs a human**, not by whether a daemon,
> queue, and DB are running. A scheduled scan that deterministically computes a delta, validates
> it, and auto-merges it **is** a closed reconcile loop — just a low-frequency, Git-backed one.

1. **Two planes, one record.**
   - *Judgment plane* (Git, `data/*.yaml`, human-reviewed, rarely changes): `authority_scope`,
     `authority_level`, `steward`, `visibility`, deprecation, conflict rulings, and the
     `data/watch.yaml` watch-list.
   - *Observation plane* (machine-measured **facts, not claims**): existence, native version,
     fingerprints, anchor validity, access, upstream provenance. Written by the scanner via
     auto-merged, CI-validated **delta** PRs.
   - *Rationale.* Governed honesty ([ADR-0006](../adr/0006-governed-honesty-model.md)) requires
     *claims* to be reviewed; an observation is not a claim — it is a regenerable measurement.
     Keeping observation out of human hands removes the toil without weakening honesty. **In A
     the observation plane still lives in Git** (so [ADR-0007](../adr/0007-runtime-object-ingestion-seam.md)
     holds) — but it is written **per delta, not per scan** (see #5, the churn bound).

2. **Each scan is one reconcile pass** (logic adopted, infra deferred). A scanner execution:
   `read desired state (Git) → enumerate watched containers → observe external Sources →
   diff desired/observed → run deterministic transforms → auto-merge verifiable deltas →
   open a PR for the unverifiable judgments`. The pass must be **idempotent** (re-running
   re-derives the same delta) and **resumable** (a failed pass leaves no partial commit; the
   next cron run reconciles from a clean HEAD). This is a Kubernetes-style controller loop with
   Git as the state store and cron as the scheduler — not a runtime control plane.

3. **Fingerprints are layered, not a single hash** (refines §13 #6). Three levels, cheapest gate
   first:

   | Level | Purpose |
   |---|---|
   | `native_version` | does the external system *report* a change? (ETag / commit SHA / page version) |
   | `source_fingerprint` | did the whole normalized content actually change? |
   | `anchor_fingerprint[]` | which specific section / claim / rule changed? |

   Scan logic: `native_version` unchanged → **don't fetch**. Changed but `source_fingerprint`
   equal → metadata-only change. `source_fingerprint` changed → diff `anchor_fingerprint[]` and
   **invalidate governance only for the affected anchors**. This keeps the fast no-op gate while
   scoping review to the anchor that actually moved.

4. **Freshness is content-relative, and splits into three independent dimensions** (refines
   §13 #6). A single `stale` flag is dishonest — these mean different things:

   - **Observation freshness** — did Atlas recently *succeed* in observing the Source? (Even if
     content is unchanged, an un-scanned-for-6-months Source is not "fresh".)
   - **Synchronization freshness** — is the version Atlas resolved the external current version?
     *Under live-fetch this is near-degenerate* (resolve fetches live each request), so it ships
     **thin** — a named dimension that fills in only once Atlas holds a published artifact/index
     that can lag (a B-stage concern).
   - **Governance validity** — does the human's last review still apply to the current content?
     `current_anchor_fingerprint == reviewed_anchor_fingerprint`. When unavailable (ACL'd Source
     the scanner can't read) → fall back to calendar decay as the only signal.

   *Rationale.* Calendar decay nags reviewers about documents nobody touched — the single largest
   toil source. Content-relative validity nags only when content actually moved.

5. **Observation writes are delta-bounded — this is what keeps A alive.** Writing
   `last_observed_at` per Source per scan would produce O(N) timestamp PRs every scan — *exactly*
   the churn that triggers B. Instead:
   - The **watch container** carries `last_successful_full_scan_at` + `scan_generation` +
     `scan_status` (one record per container, written once per scan).
   - A healthy Source **inherits** observation freshness from its container; no per-Source write.
   - A per-Source delta is written **only** on: new discovery, version change, restricted,
     missing, restored, classification change, or anchor change.

   This collapses Git churn from O(N sources) to O(changed sources) per scan, which is why the
   observation plane can stay in Git at MVP-adjacent scale without self-triggering B.

6. **`removed` ≠ `deprecated`.** `missing`/`removed` is a **machine observation** (N consecutive
   404s); `deprecated` is a **human judgment** (this Source, even if it still exists, should no
   longer be treated as authoritative). They are independent:

   | External situation | `removed` | `deprecated` |
   |---|---:|---:|
   | page deleted by mistake | true | false |
   | old standard still online but superseded | false | true |
   | superseded then deleted | true | true |
   | temporary access failure | unknown | false |

   Tombstoning is driven by `removed`, never by faking a `deprecated` judgment. After N 404s the
   scanner sets `removed` + `removed_at` (auto); old citations read "removed on <date>" instead
   of dangling. A human PR sets `deprecated` when that's the actual call.

7. **State = Phase + Conditions, not a mega-enum.** Avoid a single state machine with dozens of
   values (broken/stale/restricted/changed_detected/removed…) — it combinatorially explodes.
   - **Phase** (few, lifecycle position): `discovered` (machine-found, not yet governed) →
     `managed` (under Atlas lifecycle) → `retired` (human decision to exit).
   - **Conditions** (independent dimensions): `reachable`, `observed`, `synchronized`, `parsed`,
     `validated`, `governance_valid`, `restricted`, `missing`, `conflict_free` — each
     `{status: true|false|unknown, reason, observed_at, message}`.

   A new revision that fails to parse is `Phase: managed`, `parsed: false`, `published: true`
   (last-known-good) — the Source is **not** globally "broken". `deprecated` is a judgment field
   (`authority_level: deprecated`), not a Phase.

8. **Identity is the native immutable ID, not the URL.** `source_uid = connector_instance_id +
   native_object_id` (GitHub repo node id, Confluence content id, TFE module id). URL, name,
   path, title are **locations**, not identity:
   ```yaml
   identity: { connector: ghe-production, native_id: repo-node-12345 }
   locations: { canonical_url: ..., previous_urls: [ ... ] }
   ```
   This auto-resolves repo rename/transfer, Confluence page move, URL-structure changes, TFE
   module rename. If a system has no immutable ID → fall back to a stable composite key with
   **lowered identity confidence**.

9. **Discover by watched container, classify deterministically, badge honestly.** A human
   registers a *container* once in `data/watch.yaml` (a Confluence space key, a GHE `org` +
   topic filter, a TFE org). The scanner enumerates members, diffs against registered Sources by
   `native_id`, and for *new* members auto-classifies the obvious cases with **deterministic**
   signals (repo contains `*.tf` → `terraform-module`; Confluence page labelled `runbook` →
   `confluence-page`) at `phase: discovered`, `authority_level: reference`, `verification:
   unverified`; ambiguous ones go to a review queue. Humans only **promote** authority, never
   correct a machine guess (`effective_classification = human_override ?? machine_classification`,
   so the machine may later revise its own guess without touching human-authored data).
   - *Rationale.* One registration covers N members forever. Deterministic beats LLM
     classification here: no hallucination, no model dependency, and a wrong draft costs one
     "reject", never a lie to consumers (it stays `unverified` until promoted). Refines
     [ADR-0008](../adr/0008-automated-source-governance.md)'s confidence-gated *LLM*
     classification toward deterministic rules.

10. **Consume upstream provenance, but never equate provenance with truth.** A README merged via
    a protected-branch PR has already passed *some* governance — Atlas should not impose a second
    human review on that ordinary content update. But upstream approval proves *process*, not
    *correctness or Atlas authority*. So provenance auto-exempts **re-review of ordinary content
    updates** only; it does **not** auto-promote authority, change visibility, resolve conflicts
    with other authoritative Sources, or vouch for factual content. Captured as:
    ```yaml
    upstream_governance: { mechanism: protected_branch_pr, repository: ..., commit: ..., pull_request: ..., approvals: 2, policy_satisfied: true }
    ```
    Policy then decides: `standard` + upstream-policy-satisfied → auto-accept the content update;
    `authoritative` + authority-scope-unchanged + no-conflict → keep authority automatically;
    any authority/visibility/conflict change → still a human judgment.

11. **The reconcile planner is a pure function and is the public core.**
    `evaluate(SourceSpec, prevObservation, currentObservation) → Action[]` (actions like
    `UpdateObservation`, `CreateDraftSource`, `MarkMissing`, `RestoreSource`, `InvalidateAnchors`,
    `CreateDecisionPR`, `NoOp`). It is deterministic, IO-free, and carries no company auth or
    runtime infra — so it lives in this repo as the testable heart of the lifecycle. Adapters
    (live IO) and the git-patch generator orbit it. This is the seam that survives a later move
    to B unchanged.

12. **Execution substrate climbs the lazy ladder: scheduled GitHub Actions, no new AWS service.**
    For A the scanner is "read external metadata → edit YAML → open/auto-merge a PR" — exactly
    what a scheduled CI job does best. EventBridge → Lambda → DynamoDB is adopted **only** on a
    trigger in "Considered and rejected → B".
    - *Rationale.* The lifecycle plane is explicitly allowed scheduled jobs while the runtime
      plane stays worker-free ([ADR-0008](../adr/0008-automated-source-governance.md)); a cron
      workflow is the lowest rung that holds.

## The lifecycle under A

Each cron run is one reconcile pass:

1. **Watch** — human registers a container once (`kind: Watch`, connector + scope +
   `policy_profile`).
2. **Discover** — enumerate members, diff by `native_id`: new id → `discovered` Source; known id
   + changed URL → update `location` (no new Source); known id missing → `missing` condition.
3. **Classify** — deterministic rules set low-risk defaults (`phase: discovered`,
   `authority_level: reference`, `verification: unverified`); never auto-creates authority.
4. **Observe** — existence, native version, location, access, modification metadata, upstream
   provenance. No version change → this Source's pass ends here (no fetch, no write).
5. **Resolve & fingerprint** — on change: live fetch → normalize → compute source + anchor
   fingerprints → diff against reviewed fingerprints. **No revision store needed under A.**
6. **Evaluate** — the pure planner computes `Action[]` from spec + prev + current.
7. **Apply** — verifiable deltas auto-merge (version, fingerprints, location, missing/restored,
   access, provenance, deterministic classification); judgment deltas open a normal PR with an
   evidence bundle (changed anchor, before/after, provenance, affected claims/consumers,
   recommended decision, auto-generated config patch). The controller does **not** wait for the
   human.
8. **Serve** — runtime is unchanged and independent: read Git registry → live fetch → anchor
   extract → Valkey cache → Context API / Portal. A dead scanner means freshness ages honestly
   via fallback; serving never depends on the scanner being up.
9. **Recover** — self-healing needs **no** queue/lease/DB under A:

   | Failure | Recovery under A |
   |---|---|
   | single scan fails | next cron retries |
   | webhook lost | periodic full scan compensates |
   | PR creation fails | next scan recomputes the same delta |
   | git merge conflict | scanner regenerates against new HEAD |
   | Source temporarily 404 | threshold + grace period |
   | Source restored | later scan clears `missing` |
   | adapter transient failure | keep prior observation, mark `watch scan failed` |
   | scanner interrupted | no partial commit in Git; next run reconciles from scratch |

   As long as the planner is idempotent, A already has enough self-healing for its scale.

## Considered and rejected

- **B — Autonomous Source Control Plane (the designed destination, not built now).** A
  long-running `atlas-source-controller` + mutable State DB (SourceStatus: retry/backoff/lease,
  current vs last-known-good revision) + work queue + **immutable Revision Store** (every content
  snapshot, for last-known-good serving, parser reprocessing, index rebuild) + append-only event
  log + runtime projection/index. This is a true runtime control plane. It **contradicts
  [ADR-0007](../adr/0007-runtime-object-ingestion-seam.md)'s "no mutable store"** and is
  company-side running infrastructure that cannot live in this public repo. Its gain is lower
  *machine* churn and sub-cron freshness — it does **not** reduce human effort beyond A, because
  A's verifiable deltas already auto-merge with zero human touch. B is a clean extension: the
  pure planner (#11) is unchanged; observation/revision become regenerable projections carrying
  no authority (drop them → a re-scan rebuilds them); authority always stays in Git. **Adopt B
  only when**, and gated on a new ADR superseding the relevant 0007 clause:
  1. Git PR/CI/deploy churn becomes a *measured* problem at scale;
  2. a GHA runner cannot reach the internal systems (scan must run in-VPC);
  3. the scan cadence demonstrably cannot meet a freshness SLO;
  4. corpus size / change rate makes full reconciliation cost unacceptable;
  5. Atlas grows a published artifact/index that needs last-known-good + rebuild.

  Triggers 1–2 are the original [ADR-0008](../adr/0008-automated-source-governance.md) conditions;
  3–5 are additions. None is an MVP precondition.
- **Pure LLM classification at discovery.** Violates the deterministic-core principle and risks
  polluting the manifest with hallucinated authority. Rejected in favour of deterministic rules
  + `unverified` badging.
- **Calendar-only review-decay** (the status quo, §13 #6). Manufactures pure toil on unchanged
  documents. Kept only as the fallback for un-fingerprintable sources.
- **Per-Source hand-registration** (the MVP discover stage). It *is* the largest human sink;
  replaced by watch-containers.
- **Opt-in tagging as the *only* discovery path** (already rejected in
  [ADR-0008](../adr/0008-automated-source-governance.md)): still requires owner action. We keep
  broad-scan as the default and treat an owner-added topic/label/`atlas.yaml` as an *optional*
  fast path, not a requirement.

## Consequences

- **Human effort collapses to two irreducible actions:** (1) register a container once;
  (2) adjudicate a *material change to a high-authority Source* (or resolve a genuine conflict),
  scoped to the affected **anchor/claim**, not the whole document. Everything else — existence,
  version, fingerprint, anchor validity, calendar bookkeeping, tombstoning, drafting newly-found
  Sources — is automatic.
- **Refinements to contracted decisions (explicit, not silent):**
  - §13 #6: calendar decay → **content-relative**, split into observation/synchronization/governance
    freshness (calendar demoted to fallback); fingerprints layered native→source→anchor.
  - §13 #8: `changed_detected` moves from *manual* to **machine-detected + human-adjudicated**;
    state model becomes **Phase + Conditions**; `removed` (auto, observation) and `deprecated`
    (human, judgment) are separated; tombstone is driven by `removed`.
  - [ADR-0008](../adr/0008-automated-source-governance.md): classification is **deterministic**,
    not LLM-confidence-gated.
- **Schema deltas** (`@atlas/schema`): Source gains `identity`/`locations`, `reviewed_fingerprint`
  (per-anchor), `removed`/`removed_at`, Phase + Conditions; Anchor's `content_fingerprint` is
  reused as `anchor_fingerprint`. New `WatchSchema` (with `last_successful_full_scan_at`,
  `scan_generation`, `scan_status`) + `validateWatchManifest` mirroring `registryManifest.ts`.
- **Public-safe split:**
  - *This repo (public):* SourceSpec/Watch/Observation schemas, Phase + Conditions, adapter
    interfaces + capability model, fingerprint contracts, the pure reconcile planner (#11),
    fixture adapters + fixture scanner, git-patch generator, validation rules, policy evaluation.
  - *Company-side:* Confluence/GHE/TFE live adapters, authentication, network config, the
    scheduled workflow, GitHub App/token, company-specific classification rules, notification
    routing.
  - *B-stage (documented, not implemented here):* long-running controller, mutable observation
    DB, work queue, immutable revision store, event log, runtime projection/index.
- **Policy by scope inheritance, not per-Source config.** Four default profiles —
  `reference` (auto-found material: auto-publish, badge `unverified`), `standard` (auto-publish
  after validation), `authoritative` (require provenance; protect last-known-good on conflict),
  `ephemeral` (auto TTL + retirement) — inherited `Connector → Scope → Source override`. Normal
  case: humans configure only Connector and Scope.
- **Most fragile assumptions, with their guards:** (a) content-relative validity only helps for
  Sources the scanner's identity can *read* — un-readable ACL'd Sources fall back to calendar
  decay; (b) deterministic auto-drafts pay off only if a bad draft is cheaper to reject than to
  author — guarded by default-low-authority + promote-only + `unverified` badging; (c) the
  delta-bounded write model (#5) is the load-bearing assumption that keeps the observation plane
  in Git — if real churn exceeds O(changed sources) per scan, that is precisely trigger #1 for B.
- **Phased, each phase independently mergeable and individually valuable** (all post-MVP):
  1. **Content-relative freshness** — `reviewed_fingerprint` (per-anchor) + the three freshness
     dimensions + layered fingerprints; smallest change, no new infra.
  2. **Scheduled scanner (GHA)** — observe/sync/drift/missing/restored as one idempotent reconcile
     pass; delta-bounded writes; 404×N → `removed` tombstone PR. Ships the scan **seam + fixture
     scanner** here; live adapters company-side.
  3. **Discovery (watch-containers)** — `data/watch.yaml` + schema + validator; enumerate →
     deterministic classify → draft PR / review queue; native-ID identity.
  4. **(Optional, only on a B trigger)** the mutable observation control plane (= B).
- **One-line convergence:** *Atlas manages all Sources by continuous reconciliation; it carries
  the loop on Git + a scheduled workflow, writing observation per delta rather than per scan, and
  migrates to a mutable control plane (B) only when Git-backed execution hits a measurable
  bottleneck.*
