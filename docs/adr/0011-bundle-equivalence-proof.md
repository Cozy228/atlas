# Bundle-equivalence proof: the Skill consumer drives the documented raw-HTTP contract

Status: accepted
Date: 2026-06-20

## Context

The headline public proof of Atlas's thesis — "one contract, many consumers"
([ADR-0002](./0002-atlas-is-a-portal-context-layer-is-its-core.md)) — is a test showing the
Portal and an external Skill obtain the **same governed bundle** from the same Context API,
**without a deployed endpoint** (the public-safe proof boundary,
[ADR-0004](./0004-public-safe-proof-boundary.md)). MVP-design §13 #1 flagged this contract
as undefined.

A test already exists (`portal/src/api/server/contextApiContract.test.ts`): it instantiates
two clients and asserts `portalBundle).toEqual(skillBundle)` plus schema validity and token
discipline. But **both clients are the same `createFetchContextApiClient` over the same
in-process router** — it proves the contract is deterministic and schema-stable, yet the
"two independent consumers" claim is effectively *asking the same code twice*. The Skill
side never exercises the **documented** call sequence from
`portal/public/.well-known/agent-skills/atlas-context-consumer/SKILL.md`.

## Decision

**The Skill side of the equivalence test drives the documented raw HTTP sequence — not the
Portal's client library — and the two bundles must match.**

1. **Portal side**: the existing `createFetchContextApiClient` path (the Portal's real
   consumption).
2. **Skill side**: literal, library-free calls exactly as SKILL.md publishes them —
   `GET /api/topics?query=…` to discover the topic id, then
   `GET /api/topics/{topic_id}/context` to fetch the bundle — the way an external agent
   following the published instructions would.
3. **Assertion**: both bundles validate against `ContextBundleResponseSchema` **and** are
   equivalent. Equivalence stays **byte-level** (`toEqual`) for MVP — the determinism bar —
   with the Bearer-token discipline checks retained (token forwarded when present, never
   leaked into browser-facing output).
4. **No deployed endpoint**: both sides bridge into the real `handleHttpRequest` router
   in-process, honoring the public-safe proof boundary.

## Considered and rejected

- **Declare the existing test sufficient**: cheapest, but the "many consumers" claim is
  unproven when both sides run the same client code. The proof must be independent to be
  credible.
- **Shape-equivalence** (same sources/anchors/warnings set, not byte-identical): more
  realistic if consumers project differently, but for MVP both consume the raw bundle, so
  byte-equality is the stronger, honest bar. Revisit if/when a consumer legitimately
  projects.

## Consequences

- ~30 lines added to the equivalence test: a documented-HTTP Skill path asserted equal to
  the Portal path. Closes MVP-design §13 #1.
- SKILL.md's documented endpoints become a **tested** contract, not just prose — drift in
  either breaks the test.
- The equivalence test is the public definition of MVP-done for "one contract, many
  consumers" ([ADR-0004](./0004-public-safe-proof-boundary.md)); company-side proof remains
  the live deployment against real sources.
