# Runtime object ingestion: how sources, guidance, and documents enter Atlas without a code deploy

Status: accepted
Date: 2026-06-14

## Context

Atlas's content — Sources, Topics, and now Guidance — started life as compile-time
TypeScript fixtures (`portal/src/lib/*`, `portal/src/fixtures/*`). MVP-design §2 already
calls for pilot truth to move off the seed into a **manifest control plane**
(`data/*.yaml` + a validate/import command). The open question this ADR settles is the
**seam**: when an owner — or an AI agent drafting from a process document — wants to add a
new object, *how does it enter the platform*, and how "runtime" is that?

Three forces pull on the answer:

- **Governed honesty** ([ADR-0006](./0006-governed-honesty-model.md)) — every claim is
  curated, owned, reviewable. Nothing should enter that hasn't passed validation and human
  review.
- **No background-worker fleet** (MVP-design §5) — ingestion must not require a resident
  daemon.
- **No CMS** (MVP-design §6 explicitly cuts CMS-style authoring) — the system of record is
  Git, not a live editing surface.

AI changes the authoring economics: an agent can now draft a valid manifest from an
external document in seconds (see [`guidance-authoring.md`](../product/guidance-authoring.md)).
That makes the *volume* of candidate objects go up, which makes the **validation + review
gate**, not the editor, the thing that matters.

## Decision

Objects enter through a **Git-managed manifest seam with a validation gate**, in one
uniform shape across object kinds. "Runtime add" means *no code change and no redeploy of
application logic* — not a live mutable store.

1. **Manifest is the unit of authorship.** Each object kind has a `data/<kind>/*.yaml`
   directory and a Zod schema in `@atlas/schema`:
   - `data/guidance/*.yaml` → `GuidanceSchema` (this ADR ships it).
   - `data/sources/*.yaml`, `data/topics/*.yaml` → `SourceSchema` / `TopicSchema` (the
     control-plane migration, MVP spine — *designed here, not yet built*).
   - **Documents are not stored in Atlas.** A "document" enters as a *Source* (a pointer:
     location + steward + authority + anchors), never as copied content — Atlas references
     systems of record, it is not one ([guidance_design](../product/guidance_design.md) §5.8).
2. **Validation gate, two tiers.** `validate*` checks every manifest against its schema
   plus cross-file invariants (duplicate ids, dangling source refs) and governance
   soft-checks. **Errors block; warnings surface for review** — mirrors the governed-
   honesty posture. Guidance ships this today (`pnpm validate:guidance`,
   `validateGuidanceManifest`); the same pattern generalises per kind.
3. **AI drafts, owner reviews, Git commits.** An agent emits `status: draft`; the gate
   runs in CI on the PR; an owner reviews and promotes to `published`. The PR *is* the
   review surface — no separate CMS. This is the "generated from source documents by AI,
   then reviewed by owners" loop from `guidance_design.md`, made concrete.
4. **Load is lazy, not daemonised.** The registry reads validated manifests at process
   start / first request (and the availability cache is already a lazy TTL, MVP-design §5).
   Adding a manifest + restart (or a deploy of *data*, not *code*) is the "runtime add" —
   no background worker, consistent with the execution model.

## Considered and rejected

- **Live runtime authoring API** (POST guidance/source to an endpoint, persist to
  DynamoDB, appears with no deploy). True real-time add, and feasible (the Feedback table
  already proves the pattern). Rejected for now: it reintroduces a CMS-shaped mutable
  control plane, splits the system of record between Git and a database, and expands the
  product surface beyond MVP. **Revisit post-MVP** if authoring latency becomes a real
  constraint — the schema + validator built here are exactly what such an endpoint would
  reuse, so this is a deferral, not a dead end.
- **Storing document content in Atlas** (so guidance is self-contained). Rejected: Atlas
  references systems of record; copying content breaks freshness/drift and the public-safe
  boundary.
- **Keeping TS fixtures** as the authoring format. Rejected: not language-neutral for AI
  output, couples content to a code deploy, and can't be validated independently of the
  app build.

## Consequences

- Guidance has a validated manifest format and a CI-enforced gate **today**; Source/Topic
  manifests follow the same seam as the MVP control-plane migration lands.
- The AI authoring path is unblocked: a documented few-shot guide + schema + validator
  means an agent can produce review-ready drafts that fail loudly when malformed.
- "Runtime add" is honestly scoped: add a manifest, pass the gate, ship data. No live
  editor, no daemon, no split source of record — Git stays the system of record.
- A future live-ingestion API is a clean extension (reuses the schema + validator), not a
  rewrite.
