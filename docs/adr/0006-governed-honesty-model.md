# Governed honesty: how Atlas keeps the "never lies" promise on curated claims

Status: accepted
Date: 2026-06-13

## Context

Atlas's moat is governed **authority + ownership + locator + freshness** — and *never
lying* about them. Freshness/drift is automatic (live source version vs recorded
`observed_version`, at resolve time). But `authority_level`, `owner`, and source↔topic
mappings are **human-curated** and go stale (an owner leaves, a source stops being
authoritative, a new authoritative source is unregistered). Under tiered coverage (a deep
hero slice + a shallow registry of everything else; see `../product/mvp-product-design.md`), users
also frequently hit topics that are **not registered at all**.

## Decision

Atlas keeps the promise through four mechanisms — **not** active re-validation:

1. **Fresh-drift** — freshness/staleness derived at resolve time from the live source
   version vs recorded `observed_version` (`stale_source`).
2. **Review-decay** — every curated claim carries `last_reviewed_at` + `review_frequency`;
   when overdue, the UI **visibly ages** the claim ("ownership unverified for N months")
   rather than asserting it confidently. A natural extension of the existing "Needs
   Review" governance rule.
3. **Authority conflict** — two Sources claiming authority for the same scope → surface
   both with a conflict warning and **pick no side**. One real conflict is **seeded in the
   hero slice** to prove the behavior end to end.
4. **Honest dead-end + feedback** — for unregistered topics, say "beyond registered
   knowledge scope" and offer an action that files a `Feedback(missing)` to stewards. Gaps
   become governance signals that self-heal; **Feedback is a first-class citizen**.

## Considered and rejected

- **Active re-validation** of owner/authority against an ownership system: strongest, but
  needs another integration, a real ownership system of record, and a background job
  (violates the no-background-worker execution model). Deferred to post-MVP.
- **Ungoverned fallback** (general search / best-guess when nothing is registered): fills
  gaps but reintroduces uncited content and breaks "answer only from registered
  authoritative sources." Anti-thesis; rejected.

## Consequences

- No background workers required (see `mvp-product-design.md` §5).
- Feedback gets a read path (`GET /feedback`, plan 005) and a steward-facing surface.
- The product is **visibly** honest about the limits of its curation — that visibility is
  the trust mechanism, not a weakness.
