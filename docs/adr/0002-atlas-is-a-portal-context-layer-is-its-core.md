# Atlas is an information-centric DevEx Portal; the Context Layer is its core engine, not a separate product

Status: accepted
Date: 2026-06-13

## Context

Two foundational docs disagreed on what Atlas *is*. `docs/architecture/current_design.md`
frames Atlas as a governed Context Layer that merely "powers" a portal; `PRODUCT.md`
frames it as "Atlas Portal — the authoritative self-service catalog." Six months of
building went portal-first (11 surfaces, lavish UI) while the governed-context spine
stayed thin. The only fixed reference is `docs/product/guideline.md`: an *information-centric*
(not provisioning-centric) DevEx portal, a "Platform as a Product" UX layer that
consolidates fragmented documentation and adds AI-based discovery.

## Decision

The **product is the information-centric DevEx Portal**. The **Context Layer is the
product's core engine** (governed source registry + authority mapping + locator/anchor
resolution + context-bundle assembly) — it is *part of* the product, not a separately
shipped product and not "the architecture above the portal." The **Portal is one
consumer** of the Context Layer — not the first, not privileged — though it is the
primary surface we polish.

`guideline.md` is the single **immutable north star**. Everything else —
`current_design.md`, `mvp_next_steps.md`, and `DESIGN.md` —
is re-thinkable beneath it.

## Consequences

- `docs/product/mvp-product-design.md` becomes the single source for product identity.
- `PRODUCT.md` is reconciled (it no longer claims the Portal *is* the product).
- "Consumer-neutral" stays a real architectural property (proven by equivalence tests,
  see [ADR-0004](./0004-public-safe-proof-boundary.md)), but the Portal is the de-facto
  primary consumer; agents/MCP are designed-for, not the MVP's center of gravity.
- The product's center of gravity is **wayfinding** now, evolving to **cited answers**
  later — see `mvp-product-design.md`.
