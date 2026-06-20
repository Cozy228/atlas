# Atlas — Implementation Constraints

Rules that AI must follow when implementing the Atlas design. Check every code change against these constraints before committing.

## Module Boundary

1. The codebase has two top-level modules: `context-layer` (Atlas core) and `portal` (frontend consumer). They live in separate directories with separate dependency manifests. Portal depends on context-layer's API contract, never on its internal modules.

2. `context-layer` must not import from `portal`. `portal` must not import from `context-layer` internals — only through the API client.

3. All LLM-related code implemented in this repository (prompt construction, model invocation, response parsing) lives in the consumer layer, with Portal-specific LLM code in `portal`, never in `context-layer`. If you find yourself adding an LLM dependency to `context-layer`, stop — the boundary is wrong.

4. Consumer-specific rendering, formatting, or presentation logic belongs in `portal`. If a function only makes sense for one consumer, it does not belong in `context-layer`.

## API Contract

5. `context-layer` exposes a single API surface. Every function (source registry, topic registry, context delivery) is accessed through this API. No direct DynamoDB access from `portal`.

6. API request and response types must be defined in a shared schema package (e.g., OpenAPI spec or shared TypeScript types). Both `context-layer` and `portal` reference this schema. Do not duplicate type definitions.

7. Every API endpoint must return structured error responses with error codes, not raw exceptions. Consumers must be able to programmatically distinguish between "source not found," "anchor broken," "source unavailable," and "source restricted."

8. Context bundle responses must always include: `sources` (with authority metadata), `anchors` or `anchor_references`, `warnings` (stale, broken, conflict signals), and `expansion_paths`. Never return a context bundle without these fields, even if they are empty arrays.

## Data Model

9. Governance metadata (authority_level, authority_scope, steward, last_reviewed_at, review_frequency) lives on Source entities only. Never duplicate governance fields onto Topic entities or Source-Topic mapping records.

10. Source and Topic are linked through an explicit mapping table/collection, not through embedded arrays. A Source document must not contain a list of topic IDs, and a Topic document must not contain a list of source IDs. The mapping is its own entity. Anchor records are linked to Source by `source_id`, not embedded as long-form source content.

11. Every Source record must have: `id`, `source_class`, `location`, `steward`, `authority_level`, `authority_scope`. These fields are non-nullable. Do not create a Source without all of them.

12. Every Topic record must have: `id`, `name`, `topic_type`, `status`, `owner_team`. These fields are non-nullable.

13. `authority_level` is an enum with exactly these values: `authoritative`, `reference`, `example`, `draft`, `deprecated`. Do not add new levels without updating this constraint.

14. `topic_type` is an enum with exactly these values: `service`, `landing-zone`, `guardrail-area`. Do not add new types without updating this constraint.

15. `source_class` is an enum with exactly these values in V1: `terraform-module`, `confluence-page`, `policy-document`. Adding a new source class requires a corresponding anchor strategy implementation. Do not add a source class enum value without implementing its anchor resolver.

## Source Access

16. Source content is fetched at request time, not durably mirrored. Atlas may run manifest validation, metadata fetch, lifecycle checks, and source health automation that store source metadata, anchor selectors, validation status, lifecycle state, and optional fingerprints. Do not build a pipeline that stores full source content as a durable Atlas copy. If you need caching, use a TTL-based cache that is explicitly disposable — the system must function without it.

17. Each source class has its own fetcher and anchor resolver module. Fetchers and anchor resolvers are registered by source class, not hardcoded in a switch statement. Adding a new source class means adding a new fetcher or explicitly reusing an existing fetcher, adding a new resolver module, and registering them.

18. When a source system is unreachable at request time, the context bundle must still be returned with available sources. Mark unreachable sources with a `source_unavailable` warning. Never fail an entire request because one source is down.

## File and Code Structure

19. Every file must be under 500 lines. If a file exceeds this, split it by responsibility. A "utils" file that grows past 500 lines means the responsibilities are not well-separated.

20. One anchor resolver per file. One API route handler per file. One data access module per entity type. Do not combine unrelated concerns in a single file.

21. No barrel files that re-export everything (`index.ts` with 50 re-exports). Index files may re-export public API surface only, with explicit named exports.

## Testing

22. Every anchor resolver must have tests that cover: successful resolution, broken anchor, source unavailable, and malformed anchor input. Do not merge an anchor resolver without these four cases.

23. API endpoint tests must verify both the success path and the error response structure. Every error code defined in constraint 7 must have a corresponding test.

24. Do not mock the data model layer in API tests. Use an in-memory or local DynamoDB instance. Mocking the database hides schema mismatches.

## AI Consumer Layer

25. Any AI consumer prompt sent to an LLM must include only content from the Atlas context bundle plus the user's request. Do not inject additional knowledge, system prompts with domain facts, or hardcoded platform guidance. If it is not in the context bundle, the AI does not know it.

26. Every factual claim in the AI response must map to a citation from the context bundle. The consumer must validate this before displaying an answer or taking an action. If the AI produces a claim without a citation, strip it or flag it as unverified.

27. The LLM integration must be behind an interface/adapter. Consumer code calls the adapter, not the LLM SDK directly. Swapping the model (Bedrock Claude → Bedrock Nova → external API) must require changing only the adapter implementation.

28. If Portal provides hosted AI invocation, AI rate limits (per-user, per-day) must be enforced at the Portal backend layer, not delegated to the LLM provider's rate limiting. Local agent consumers may own their own invocation policy.

## Technology

29. Portal frontend: TanStack Start + Vite. Do not introduce additional frontend frameworks (no Next.js, no Remix, no Astro). V1 may use a static or SPA-mode build for delivery if the Context API remains the data boundary.

30. Context Layer: AWS Lambda + API Gateway + DynamoDB. Do not introduce additional Context Layer services (no SQS, no Step Functions, no OpenSearch) in V1 without updating this constraint. Portal hosting can use the approved V1 hosting path as long as it is defined as infrastructure as code.

31. Infrastructure is defined as code. No manually provisioned production resources. If you cannot express it in Terraform or CDK, it does not go to production.

32. Dependencies must be pinned to exact versions in lock files. Do not use floating version ranges in production dependency manifests.

## Implementation Stack

33. V1 application code uses TypeScript for `portal`, `context-layer`, and shared schema packages. Do not implement the V1 backend in Python, Go, Java, or another runtime without updating `docs/architecture/current_design.md` and this constraint file first.

34. Use `pnpm` as the only JavaScript package manager. Commit `pnpm-lock.yaml`. Do not commit `package-lock.json`, `npm-shrinkwrap.json`, or `yarn.lock`.

35. Use pnpm workspaces for multi-package local development. Keep `portal`, `context-layer`, and shared schema packages as separate workspace packages with explicit dependencies.

36. Define API contracts schema-first before implementing route handlers or Portal clients. The Portal API client must depend on the shared contract; do not copy response types into Portal code.

37. Portal server-side code may call the Atlas Context API and the LLM adapter. Portal browser code must not call the LLM provider directly. Local AI agents or CLI consumers call the Atlas Context API as external consumers, not through Context Layer internals.

38. LLM credentials and source-system credentials must never enter the browser bundle, seed data, fixtures, or committed files. Load them only from approved deployment environment, Secrets Manager, or Parameter Store.

39. DynamoDB access belongs only in `context-layer` data-access modules. Portal code must not query DynamoDB directly.

40. Route handlers must not contain raw DynamoDB query logic. A route handler calls a focused service or repository module and returns API responses.

41. Use Vitest for TypeScript unit and API tests unless this constraint is updated. Use Playwright for Portal end-to-end or interaction tests when browser behavior matters.

42. Do not rely on snapshot tests alone for context bundles, citations, visibility signals, warnings, or AI answer validation. These behaviors require explicit assertions.

43. Portal UI must not hardcode pilot source truth. Service, landing zone, source badge, authority, freshness, and warning data must come from registry/API data or explicit seed data.

44. Bedrock or another approved model provider may be used for model invocation, but V1 must not use Bedrock Knowledge Bases, Kendra, OpenSearch, or another managed retrieval layer that bypasses Atlas Context Layer source selection and locator resolution.

## Naming and Convention

45. All code, comments, commit messages, variable names, and API field names must be in English.

46. API field names use `snake_case`. TypeScript code uses `camelCase` for variables and functions, `PascalCase` for types and classes. Do not mix conventions.

47. Git commits follow Conventional Commits. Every commit must have a type prefix (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).

## What Not to Build

48. Do not build a general-purpose search engine. Source selection in V1 uses registry lookups and authority mapping, not full-text search or vector similarity.

49. Do not build a durable content ingestion pipeline, crawler, or source-content mirror. Manifest-driven registry validation, metadata fetchers, lifecycle checks, and health automation are allowed when they store only metadata, selectors, fingerprints, lifecycle state, and warnings.

50. Do not build user authentication, registration, SSO, or identity-based application access for V1. V1 is designed for a trusted internal operating environment. Source-system and model credentials still remain server-side and must not be exposed to browser code or committed files.

51. Do not build an admin UI for source registration in V1. Source and topic registration is done via API calls or seed scripts. The admin UI is a post-V1 concern.

52. Do not add fields to the data model that are not defined in `docs/architecture/current_design.md`. If a new field is needed, update the design document first, then implement.
