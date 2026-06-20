# Blueprint stays the design identity (showcase-inflected, token-driven for re-skin), not realigned to the company's Geist

Status: accepted
Date: 2026-06-13

## Context

`docs/baseline-replication-gap.md` chose to keep the Inter/"Blueprint" system rather than
adopt the company's "Precision Instrument / Geist" direction. Meanwhile the built portal
keeps a welcoming "Welcome desk" Home and an editorial "What's New" broadsheet — a
*showcase-inflected* register that reads as a divergence from the austere
"instrument, never spectacle" north star. [ADR-0004](./0004-public-safe-proof-boundary.md)
imports the product into a company environment that uses Geist.

## Decision

1. **Keep Blueprint** as the public-tree design identity; do not realign to Geist here.
2. **Sanction the showcase-inflected register**: a restrained welcoming Home entry and an
   editorial What's New change-surface are legitimate expressions of "Platform as a
   Product" — *provided* they still earn attention through information integrity, not
   spectacle. `DESIGN.md`'s north star is updated to say this honestly.
3. **Keep the system fully token-driven** (OKLCH tokens). A company re-skin (e.g. to
   Geist) on import is a **token swap, not a rewrite** — the token layer is the re-skin
   seam.

## Consequences

- `DESIGN.md` no longer reads as "no hero / density only"; it acknowledges the welcoming
  entry + editorial surface as sanctioned, restrained registers.
- Blueprint is **not** assumed to survive company import unchanged; the re-skin is
  expected and is contained to tokens.
- Resolves the instrument-vs-showcase and Blueprint-vs-company-direction design tensions.
