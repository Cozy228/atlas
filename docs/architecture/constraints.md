# Atlas — Implementation Constraints

Rules that AI must follow when implementing the Atlas design. Check every code change against these constraints before committing.

## Module Boundary

1. The codebase has two top-level modules: `context-layer` (Atlas core) and `portal` (frontend consumer). They live in separate directories with separate dependency manifests. Portal depends on context-layer's API contract, never on its internal modules.

2. `context-layer` must not import from `portal`. `portal` must not import from `context-layer` internals — only through the API client.

3. All LLM-related code (prompt construction, model invocation, response parsing) lives in `portal`, never in `context-layer`. If you find yourself adding an LLM dependency to `context-layer`, stop — the boundary is wrong.

4. Consumer-specific rendering, formatting, or presentation logic belongs in `portal`. If a function only makes sense for one consumer, it does not belong in `context-layer`.

## API Contract

5. `context-layer` exposes a single API surface. Every capability (source registry, topic registry, context delivery) is accessed through this API. No direct DynamoDB access from `portal`.

6. API request and response types must be defined in a shared schema package (e.g., OpenAPI spec or shared TypeScript types). Both `context-layer` and `portal` reference this schema. Do not duplicate type definitions.

7. Every API endpoint must return structured error responses with error codes, not raw exceptions. Consumers must be able to programmatically distinguish between "source not found," "anchor broken," "source unavailable," and "access denied."

8. Context bundle responses must always include: `sources` (with authority metadata), `warnings` (stale, broken, conflict signals), and `expansion_paths`. Never return a context bundle without these three fields, even if they are empty arrays.

## Data Model

9. Governance metadata (authority_level, authority_scope, steward, last_reviewed_at, review_frequency) lives on Source entities only. Never duplicate governance fields onto Topic entities or Source-Topic mapping records.

10. Source and Topic are linked through an explicit mapping table/collection, not through embedded arrays. A Source document must not contain a list of topic IDs, and a Topic document must not contain a list of source IDs. The mapping is its own entity.

11. Every Source record must have: `id`, `source_class`, `location`, `steward`, `authority_level`, `authority_scope`. These fields are non-nullable. Do not create a Source without all of them.

12. Every Topic record must have: `id`, `name`, `topic_type`, `status`, `owner_team`. These fields are non-nullable.

13. `authority_level` is an enum with exactly these values: `authoritative`, `reference`, `example`, `draft`, `deprecated`. Do not add new levels without updating this constraint.

14. `topic_type` is an enum with exactly these values: `capability`, `landing-zone`, `guardrail-area`. Do not add new types without updating this constraint.

15. `source_class` is an enum with exactly these values in V1: `terraform-module`, `confluence-page`, `policy-document`. Adding a new source class requires a corresponding anchor strategy implementation. Do not add a source class enum value without implementing its anchor resolver.

## Source Access

16. Source content is fetched at request time, not pre-ingested. Do not build background jobs, queues, or pipelines that pull and store source content. If you need caching, use a TTL-based cache that is explicitly disposable — the system must function without it.

17. Each source class has its own anchor resolver module. Anchor resolvers are registered by source class, not hardcoded in a switch statement. Adding a new source class means adding a new resolver module and registering it.

18. When a source system is unreachable at request time, the context bundle must still be returned with available sources. Mark unreachable sources with a `source_unavailable` warning. Never fail an entire request because one source is down.

## File and Code Structure

19. Every file must be under 500 lines. If a file exceeds this, split it by responsibility. A "utils" file that grows past 500 lines means the responsibilities are not well-separated.

20. One anchor resolver per file. One API route handler per file. One data access module per entity type. Do not combine unrelated concerns in a single file.

21. No barrel files that re-export everything (`index.ts` with 50 re-exports). Index files may re-export public API surface only, with explicit named exports.

## Testing

22. Every anchor resolver must have tests that cover: successful resolution, broken anchor, source unavailable, and malformed anchor input. Do not merge an anchor resolver without these four cases.

23. API endpoint tests must verify both the success path and the error response structure. Every error code defined in constraint 7 must have a corresponding test.

24. Do not mock the data model layer in API tests. Use an in-memory or local DynamoDB instance. Mocking the database hides schema mismatches.

## AI Consumer Layer (Portal Side)

25. The prompt sent to the LLM must include only content from the Atlas context bundle. Do not inject additional knowledge, system prompts with domain facts, or hardcoded platform guidance. If it is not in the context bundle, the AI does not know it.

26. Every factual claim in the AI response must map to a citation from the context bundle. The Portal must validate this before displaying. If the AI produces a claim without a citation, strip it or flag it as unverified.

27. The LLM integration must be behind an interface/adapter. The rest of Portal code calls the adapter, not the LLM SDK directly. Swapping the model (Bedrock Claude → Bedrock Nova → external API) must require changing only the adapter implementation.

28. AI rate limits (per-user, per-day) must be enforced at the Portal backend layer, not delegated to the LLM provider's rate limiting. Portal must own its own cost controls.

## Technology

29. Portal frontend: TanStack Start + Vite. Do not introduce additional frontend frameworks (no Next.js, no Remix, no Astro).

30. Context Layer: AWS Lambda + API Gateway + DynamoDB. Do not introduce additional AWS services (no SQS, no Step Functions, no OpenSearch) in V1 without updating this constraint.

31. Infrastructure is defined as code. No manually provisioned production resources. If you cannot express it in Terraform or CDK, it does not go to production.

32. Dependencies must be pinned to exact versions in lock files. Do not use floating version ranges in production dependency manifests.

## Naming and Convention

33. All code, comments, commit messages, variable names, and API field names must be in English.

34. API field names use `snake_case`. TypeScript code uses `camelCase` for variables and functions, `PascalCase` for types and classes. Do not mix conventions.

35. Git commits follow Conventional Commits. Every commit must have a type prefix (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).

## What Not to Build

36. Do not build a general-purpose search engine. Source selection in V1 uses registry lookups and authority mapping, not full-text search or vector similarity.

37. Do not build a background sync/ingest pipeline. V1 is request-time only.

38. Do not build user authentication/registration for the Portal. V1 uses organizational SSO or IAM-based access. Do not implement username/password flows.

39. Do not build an admin UI for source registration in V1. Source and topic registration is done via API calls or seed scripts. The admin UI is a post-V1 concern.

40. Do not add fields to the data model that are not defined in `docs/architecture/current_design.md`. If a new field is needed, update the design document first, then implement.
