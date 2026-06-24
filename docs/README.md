# Atlas Documentation

This folder separates product narrative, architecture, review history, and raw notes so each document has a clear role.

## Product

- `product/mvp-product-design.md` - **The authoritative MVP product + architecture design** (identity, the one job, moat & governed honesty, MVP bar, coverage/hero slice, real-data scope, surfaces, governance, contracts index, open questions, DoD). Start here.
- `product/guideline.md` - Original DevEx direction and problem framing — the immutable north star.
- `product/governance-design.md` - Source governance: the ingestion seam (MVP) and automation (Phase 2).
- `product/guidance_design.md` - Guidance object model (MVP ships the `route` type, one journey).
- `product/guidance-authoring.md` - Few-shot guide for authoring Guidance manifests from process documents.

## Architecture

- `architecture/current_design.md` - Current system design for Atlas Portal and Atlas Context Layer.
- `architecture/source-lifecycle-design.md` - **Post-MVP.** Minimal-toil source lifecycle as continuous reconciliation: observation/judgment plane split, layered fingerprints, three-dimension content-relative freshness, watch-container discovery, `removed`≠`deprecated` tombstoning, Phase+Conditions, native-ID identity. Adopts reconcile semantics on Git + scheduled workflow; the mutable control plane (B) is a designed-but-deferred destination. Refines ADR-0008 and MVP-design §13.
- `architecture/mvp_next_steps.md` - Near-term MVP closure sequence for manifest-driven registry, metadata fetchers, lifecycle, deployment, Skill, Skills Hub, Guidance, Catalog, and Portal UI/UX work.
- `architecture/catalog.md` - Current source projection for regional availability data used by the Portal availability surface.
- `architecture/dynamodb_feedback_table.md` - DynamoDB key design for V1 feedback persistence.
- `architecture/constraints.md` - Implementation constraints that must be checked before code changes.
- `architecture/agent_readiness.md` - Active plan for exposing Atlas to AI agents via discovery/content protocols (robots/sitemap/llms.txt/Markdown negotiation/OpenAPI/Agent Skills/MCP), scoped and phased against the Context API.
- `architecture/goal_prompt_agent_readiness.md` - Executable distillation of the agent-readiness plan: locked decisions, four independently-shippable batches (Skill Discovery, OpenAPI/api-catalog/llms.txt, read-only MCP, web-crawler baseline), and a two-layer Definition of Done.
- `architecture/agent_readiness_e2e_example.md` - Worked blind-agent E2E test example: discovery chain from `GET /` Link headers through digest-verified skill install, API consumption, and MCP calls, with per-surface verdicts and known friction.

## Archive

- `archive/README.md` - Historical documents, raw conversations, reverted handoffs, previews, and point-in-time reviews that are no longer current guidance.

## Recommended Reading Order

1. `product/mvp-product-design.md` (start here — the consolidated MVP design + contracts index)
2. `product/guideline.md` (the immutable north star)
3. `../CONTEXT.md` (domain glossary) and `adr/` (decisions, 0001–0011)
4. `architecture/current_design.md` (thesis & data model — background)
5. `architecture/mvp_next_steps.md` (build sequence — background)
6. `product/governance-design.md`, `product/guidance_design.md`, `product/guidance-authoring.md`
7. `architecture/constraints.md`, `architecture/catalog.md`, `architecture/dynamodb_feedback_table.md`
