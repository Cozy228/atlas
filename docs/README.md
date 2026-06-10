# Atlas Documentation

This folder separates product narrative, architecture, review history, and raw notes so each document has a clear role.

## Product

- `product/product_proposal.md` - Mixed-audience proposal for Atlas as the internal cloud platform portal backed by Atlas Context Layer.
- `product/business_value.md` - Manager-facing business value case for Atlas in a fragmented multi-cloud knowledge environment.
- `product/guidance_design.md` - Current product design for Guidance as a first-class browse object and vertical-stepper workspace.
- `product/guideline.md` - Original DevEx direction and problem framing.

## Architecture

- `architecture/current_design.md` - Current system design for Atlas Portal and Atlas Context Layer.
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

1. `product/product_proposal.md`
2. `product/business_value.md`
3. `architecture/current_design.md`
4. `architecture/mvp_next_steps.md`
5. `product/guidance_design.md`
6. `architecture/catalog.md`
7. `architecture/dynamodb_feedback_table.md`
8. `architecture/constraints.md`
9. `product/guideline.md`
