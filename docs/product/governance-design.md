# Atlas — Source Governance Design

> How sources are discovered, added, kept fresh, and retired with minimal human
> involvement. Settled 2026-06-14. MVP scope is lean (§6); the automation here is
> **Phase 2**. Decisions: [ADR-0006](../adr/0006-governed-honesty-model.md) (honesty),
> [ADR-0007](../adr/0007-runtime-object-ingestion-seam.md) (the ingestion seam — how
> objects enter), [ADR-0008](../adr/0008-automated-source-governance.md) (discovery +
> classification).

## 1 · The model in one line

Governance metadata is sourced from the source systems themselves; a lifecycle-plane
**broad scan** discovers and **auto-classifies** candidates by confidence, emitting
`status: draft` manifests into the **Git ingestion seam**
([ADR-0007](../adr/0007-runtime-object-ingestion-seam.md)); humans review the draft PRs and
promote. Git is the single source of record — **no mutable store**. The runtime resolution
plane stays deterministic and worker-free throughout.

## 2 · Discovery (broad scan)

A scheduled job in the **lifecycle plane** broadly scans source systems (Confluence
spaces, Terraform Enterprise orgs, repos), pulling **metadata only** (never durably
storing content — source-native). It does **not** wait for owners to tag sources. This
**reverses** the `mvp_next_steps` "no crawler" non-goal (see ADR-0008); the trade was
accepted to minimize owner involvement.

## 3 · Classification (confidence gate)

Each discovered candidate gets a **proposed** `authority_scope`/`authority_level` plus a
**confidence**. This is latent (judgment) work — so it lives **only in the governance
plane and produces proposals**, never authoritative runtime output.

- **High confidence** → emits a `status: draft` manifest (a PR) through the ingestion seam.
- **Low confidence / conflicts with existing / high-authority claim** → a **human review
  queue**.

Humans touch only the hard cases; judgment stays with humans.

## 4 · How objects enter (the seam) & "runtime add"

Per [ADR-0007](../adr/0007-runtime-object-ingestion-seam.md), every object — Source, Topic,
Guidance — enters through **one Git-managed manifest seam with a validation gate**:

- **Git is the single source of record.** Each kind has `data/<kind>/*.yaml` + a Zod schema
  in `@atlas/schema`; manifests validate before load (`pnpm validate:*`).
- **"Runtime add" = no code change / no redeploy of application logic** — add a validated
  manifest and load it. It is **not** a live mutable store.
- **Candidates are `status: draft` manifests** (from AI authoring or Phase-2 discovery);
  the **PR is the review surface** (no CMS). **Promotion = a human merges** the reviewed
  draft to `published`.
- A live runtime-authoring API / mutable candidate DB was **considered and deferred
  post-MVP** (ADR-0007) — it would split the source of record. The schema + validators
  built here are exactly what it would reuse, so it stays a clean extension, not a rewrite.

## 5 · Maintenance (low-human revalidation)

A scheduled lifecycle re-scan compares live metadata to the recorded state and **proposes
manifest updates as PRs**, asymmetrically:

- **Verifiable deltas** (version bump, freshness recompute, anchor-still-valid,
  broken-anchor detection, source moved/removed) → may **auto-merge via CI**.
- **Judgment deltas** (`authority`/`scope` change, deprecation, a new conflict, ownership
  change) → **human review** required.
- **Review-decay** ages curated fields no scan can verify
  ([ADR-0006](../adr/0006-governed-honesty-model.md)).

Mapped to the existing lifecycle states (`changed_detected`/`stale`/`broken` auto;
`deprecated`/authority human).

## 6 · MVP vs Phase 2

- **MVP (lean):** the Git ingestion seam (ADR-0007) + manifest control plane + on-demand
  CLI metadata fetchers + review-decay. **No** crawler, classifier, or scheduled jobs.
  (Guidance already ships this seam: `data/guidance/*.yaml`, `GuidanceSchema`,
  `pnpm validate:guidance`.)
- **MVP carries the seams** so Phase 2 is additive: the `status: draft`/`unverified` state
  and the lifecycle states exist in the schema from MVP.
- **Phase 2:** turn on broad-scan discovery, confidence-gated classification, and scheduled
  revalidation — each feeding draft PRs through the same seam.

## 7 · Plane boundary

The **lifecycle plane** may run scheduled jobs (discovery, revalidation). The **runtime
resolution plane** is request-time and **never** runs background workers (see `CONTEXT.md`,
"Two credential planes"). Caching there stays a lazy TTL optimization.
