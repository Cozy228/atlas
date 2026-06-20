# The public repo proves the spine by tests + deployable generic infra; live deployment against real sources is company-side

Status: accepted
Date: 2026-06-13

## Context

The MVP bar is the **full spine**: a manifest-driven registry control plane, a deployed
Context API, and proof that the Portal and an external Skill consume equivalent context
bundles. The repo's standing rule is **public-safe / fake-data-only / no company-specific
adapters**. These collide on the word "deployed": a public-safe repo cannot host a live
deployment wired to real company Confluence / Terraform Enterprise.

## Decision

- **In this public repo:** ship generic, **deployable-but-undeployed** infra
  (`infra/`, `context-layer/.../lambda/handler.ts`), a **public-safe pilot manifest**
  (fictional 10–15 topics), and the **full contract test suite**. Prove
  "one contract, many consumers" **by equivalence tests** — that the Portal and the Skill
  consume equivalent bundle shapes — which require **no live company endpoint**.
- **Company-side, on import:** the actual live deployment against real Confluence / TFE
  happens privately. Adapters stay generic and env-configured (the existing Confluence
  provider pattern: `ATLAS_CONFLUENCE_BASE_URL` / token, nothing company-specific
  committed).

**Public MVP-done** = green tests + deployable infra + contract equivalence proven by
tests. **Company-side MVP-proven** = deployed against real sources.

## Consequences

- The public repo deliberately **never shows a running deployed endpoint against real
  data** — accepted. The headline claim is carried by tests, not a live demo URL.
- Any surface not wired to a real source in the public tree (e.g. TFE status fixtures)
  **must be honestly labeled** as demo data (ship-state honesty).
- Reverses the implication in `mvp_next_steps.md` step 4 that "deployed" means a public
  running stack; here "deployable + test-proven" is the public bar.
