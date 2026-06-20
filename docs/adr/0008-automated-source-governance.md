# Automated source governance: broad-scan discovery + confidence-gated classification feeding the ingestion seam (reverses "no crawler"); Phase 2

Status: accepted
Date: 2026-06-14

## Context

The moat needs broad, fresh, governed coverage; central hand-curation does not scale and is
not "low human involvement." [ADR-0007](./0007-runtime-object-ingestion-seam.md) already
settles *how objects enter* (a Git manifest seam + validation gate; no mutable store). This
ADR adds *how candidate sources are discovered and classified* with minimal human
involvement, and how they feed that seam. `mvp_next_steps` listed "no crawler" as a
non-goal.

## Decision (Phase 2, after the spine is proven)

- **Broad-scan discovery** in the lifecycle plane scans source systems, metadata only (no
  durable content). **This reverses the "no crawler" non-goal.**
- **Confidence-gated auto-classification**: each candidate gets a *proposed*
  `authority_scope`/`authority_level` + confidence. Latent work, confined to the governance
  plane as *proposals* — the runtime path stays deterministic.
  - **High confidence** → emits a `status: draft` manifest (a PR) through the
    [ADR-0007](./0007-runtime-object-ingestion-seam.md) ingestion seam.
  - **Low confidence / conflict / high-authority** → human review queue.
- **No mutable store.** Per ADR-0007, Git is the single source of record; discovery
  produces *draft manifests*, never writes a live candidate DB. **Promotion = a human
  merges** the reviewed draft.
- **Maintenance**: a scheduled re-scan proposes manifest updates as PRs — verifiable deltas
  (version bump, freshness, broken-anchor, moved/removed) may auto-merge via CI; judgment
  deltas (authority/scope, deprecation, new conflict, ownership) require human review.
  Review-decay ([ADR-0006](./0006-governed-honesty-model.md)) ages what no scan can verify.

MVP stays lean (the seam + manifest + on-demand CLI + review-decay) but carries the schema
seams (`status: draft`/`unverified`, lifecycle states) so Phase 2 is additive.

## Considered and rejected

- **Opt-in tagging only** (discover a source only if its owner tags it): on-thesis and
  cheap, but still requires owner action; broad-scan + classify minimizes owner
  involvement, the stated goal.
- **Fully automatic authority** (classifier sets authority with no human): violates the
  deterministic-core principle and risks polluting the manifest ("never lies").
- **A runtime-mutable candidate store (DynamoDB)**: rejected for the same reasons as
  ADR-0007 — it splits the source of record and is CMS-shaped; deferred post-MVP. Discovery
  feeds the Git seam instead.

## Consequences

- Latent (possibly LLM-assisted) classification is allowed **in the governance plane** as
  human-reviewable draft PRs — the runtime path stays deterministic.
- The lifecycle plane runs scheduled jobs; the runtime plane remains worker-free.
- Auto-discovered sources are honestly badged `unverified`/`draft` until merged —
  consistent with the governed-honesty model.
