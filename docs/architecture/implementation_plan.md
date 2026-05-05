# Atlas V1 Implementation Plan

This document translates `docs/architecture/current_design.md` and `docs/architecture/constraints.md` into an implementation plan.

It intentionally contains no source code. The plan defines subgoals, sequencing, constraints, verification gates, and do/don't rules for implementation work.

## Goal

Build Atlas V1 as a narrow but complete product loop:

1. Register governed cloud knowledge sources.
2. Map sources to user-facing topics.
3. Resolve source-native anchors at request time.
4. Return citation-ready context bundles.
5. Present capability, landing zone, authoritative source, and Ask Atlas experiences through Atlas Portal.

V1 is successful when the system proves the full chain:

Source Registry -> Authority Mapping -> Locator Resolution -> Context Bundle API -> Portal Presentation -> Ask Atlas cited answer.

## Truth Sources

Implementation must follow these documents in this order:

1. `docs/architecture/current_design.md`
2. `docs/architecture/constraints.md`
3. `docs/product/product_proposal.md`
4. `docs/product/guideline.md`

If a conflict appears, stop and update the design or constraint document before implementing code.

## Working Assumptions

- The repository starts from a documentation-first state; V1 implementation will create the application workspace.
- V1 application code uses TypeScript.
- The workspace uses `pnpm`.
- Atlas has two app modules: `context-layer` and `portal`.
- Shared API schema can live in a shared workspace package, but it must not become a third application module.
- Pilot data is seed-driven in V1; there is no admin UI for source or topic management.
- Source retrieval happens at request time.
- The Portal may use an LLM provider through an adapter, but the Context Layer never invokes an LLM.

## Non-Goals

- No provisioning workflows.
- No landing zone creation or management.
- No full CMDB or service catalog.
- No source content migration.
- No general-purpose search engine.
- No vector retrieval, OpenSearch, Kendra, or Bedrock Knowledge Bases.
- No background sync, ingest, queue, or crawler pipeline.
- No AI-generated write-back to source systems.
- No admin UI for registry management in V1.
- No username/password authentication flow.

## Target Module Shape

The implementation should keep these ownership boundaries clear.

| Area | Responsibility |
|---|---|
| Root workspace | Workspace scripts, package manager configuration, shared tooling only |
| `packages/atlas-schema` | Shared API contracts, request/response schemas, enums, and contract tests |
| `context-layer` | Atlas Context API, source registry, topic registry, source-topic mapping, authority routing, locator resolution, context bundle assembly |
| `portal` | Atlas Portal UI, Portal server routes, Context API client, Ask Atlas LLM adapter, citation validation, user-facing rendering |
| `infra` | Infrastructure as code for API Gateway, Lambda, DynamoDB, secrets, IAM, and deployment wiring |
| `docs` | Architecture, product, implementation, and operational documentation |

Do not let Portal import Context Layer internals. Do not let Context Layer import Portal code. Both sides should depend on the shared schema contract.

## Implementation Phases

### Phase 0: Workspace Foundation

**Subgoal:** Create the minimal TypeScript workspace needed to support separate Context Layer, Portal, and shared schema work.

**Expected outputs:**

- Root `pnpm` workspace configuration.
- Separate dependency manifests for `context-layer` and `portal`.
- Shared schema package for contract-first development.
- Minimal test runner setup for TypeScript packages.
- Baseline lint/typecheck/test commands.

**Constraints:**

- Use `pnpm` only.
- Commit the lockfile.
- Pin production dependencies through the lockfile.
- Keep package boundaries explicit.
- Do not introduce frontend or backend frameworks outside the design constraints.

**Do:**

- Start with the smallest workspace that can run typecheck and tests.
- Keep root scripts as orchestration only.
- Make package dependency direction visible.

**Don't:**

- Do not create a monolithic app package.
- Do not use npm, Yarn, or mixed lockfiles.
- Do not add speculative tooling before a package needs it.
- Do not create a shared utilities package just in case.

**Verification gate:**

- Workspace install succeeds.
- Typecheck and test commands can run from the root.
- Package dependency graph does not violate module boundaries.

### Phase 1: Schema-First API Contract

**Subgoal:** Define the shared contract before implementing handlers or Portal clients.

**Expected outputs:**

- Source, Topic, SourceTopicMapping, anchor, warning, expansion path, and context bundle schemas.
- Request and response schemas for source discovery, topic discovery, context retrieval, and expansion.
- Structured error model with stable error codes.
- Contract tests that validate required fields and enum boundaries.

**Constraints:**

- API field names use `snake_case`.
- TypeScript code uses `camelCase` and `PascalCase`.
- Context bundle responses always include `sources`, `warnings`, and `expansion_paths`.
- Governance fields live on Source only.
- Source and Topic are joined through an explicit mapping entity.
- Do not add fields that are not in `current_design.md` unless the design is updated first.

**Do:**

- Treat the shared schema as the contract between Portal and Context Layer.
- Make enum values match the constraint document exactly.
- Make errors machine-readable.
- Keep schema names aligned with design language.

**Don't:**

- Do not copy API types separately into Portal.
- Do not duplicate governance fields onto Topic or mapping records.
- Do not create consumer-specific contract variants.
- Do not implement route handlers before the contract exists.

**Verification gate:**

- Schema tests cover required fields, enum values, and context bundle invariants.
- Portal and Context Layer can both consume the same schema package.

### Phase 2: Context Layer Data Model and Repositories

**Subgoal:** Implement registry storage boundaries for Source, Topic, and SourceTopicMapping.

**Expected outputs:**

- Repository modules for Source, Topic, and SourceTopicMapping.
- DynamoDB table design or local equivalent aligned to V1 access patterns.
- Seed path for 10-15 pilot topics and their governed sources.
- Tests using in-memory or local DynamoDB behavior rather than mocked data-model code.

**Constraints:**

- DynamoDB access belongs only in Context Layer data-access modules.
- One data access module per entity type.
- Route handlers must not contain raw DynamoDB logic.
- Required Source and Topic fields are non-nullable.
- Mapping is explicit and not embedded into Source or Topic records.

**Do:**

- Design storage around the V1 access paths: topic lookup, source lookup, mapping lookup, and authority-based source selection.
- Keep seed data close to Context Layer ownership.
- Include stale, deprecated, restricted, and broken-anchor pilot examples.

**Don't:**

- Do not model Atlas as a CMDB.
- Do not embed topic IDs in Source records or source IDs in Topic records.
- Do not let Portal read DynamoDB directly.
- Do not create an admin UI as a shortcut for seed management.

**Verification gate:**

- Repository tests prove Source, Topic, and Mapping records can be created and queried independently.
- Required field validation catches malformed seed records.
- Pilot data can support all three V1 scenarios.

### Phase 3: Anchor Resolver Framework

**Subgoal:** Resolve source-native anchors for the three V1 source classes.

**Expected outputs:**

- Resolver registry keyed by `source_class`.
- One resolver per V1 source class:
  - `terraform-module`
  - `confluence-page`
  - `policy-document`
- Anchor validation behavior for registration or seed validation.
- Resolution behavior for exact excerpt retrieval and fallback to source-level context.

**Constraints:**

- One anchor resolver per file.
- Anchor resolvers are registered by source class, not hardcoded in route handlers.
- Each resolver test covers successful resolution, broken anchor, source unavailable, and malformed anchor input.
- A new source class requires a corresponding resolver before it can be added.

**Do:**

- Keep resolver behavior deterministic.
- Return warnings instead of hiding weak or broken anchors.
- Preserve source-native identity and citation data.
- Treat unavailable sources as partial failures.

**Don't:**

- Do not build a crawler.
- Do not pre-ingest source content into Atlas.
- Do not fail an entire context request because one source is unavailable.
- Do not use semantic matching as a substitute for anchor resolution in V1.

**Verification gate:**

- Resolver tests cover all required success and failure cases.
- Broken and unavailable sources produce structured warnings.
- Context bundle assembly can continue with remaining available sources.

### Phase 4: Context Bundle Service and API

**Subgoal:** Build the deterministic Context Layer API that returns governed context bundles.

**Expected outputs:**

- Discovery path for topic, keyword, or question input.
- Expansion path for known source or anchor input.
- Authority-based source selection.
- Context bundle assembly with citations, warnings, and expansion paths.
- Structured API error responses.
- API tests for success paths and error structure.

**Constraints:**

- Context Layer selects, resolves, filters, and packages evidence.
- Context Layer does not interpret evidence or recommend actions.
- Context Layer does not call an LLM.
- Context bundles must carry authority, provenance, freshness, access, conflict, and broken-anchor signals.
- Every defined error code needs a corresponding test.

**Do:**

- Keep the first context response small and precise.
- Support progressive disclosure levels.
- Surface authority conflicts instead of picking a winner.
- Return partial bundles when some sources fail.

**Don't:**

- Do not add advice-generation logic to Context Layer.
- Do not hardcode Portal-specific formatting.
- Do not create direct DynamoDB shortcuts for consumers.
- Do not hide stale or conflicting evidence to make the response look cleaner.

**Verification gate:**

- API tests cover source not found, anchor broken, source unavailable, and access denied.
- Context bundle tests assert citations, warnings, and expansion paths explicitly.
- API responses remain schema-compatible with the shared contract.

### Phase 5: Portal Core Experience

**Subgoal:** Build the human-facing Atlas Portal as the first consumer of the Context Layer.

**Expected outputs:**

- Portal home organized around user intent.
- Capability discovery list and detail page.
- Landing zone navigator.
- Authoritative source lookup surfaces.
- Feedback path for missing, stale, broken, or unclear guidance.
- Context API client that depends on the shared schema.

**Constraints:**

- Use TanStack Start + Vite.
- Portal consumes Context Layer through the API contract.
- Portal UI must not hardcode pilot source truth outside explicit seed data or API responses.
- Consumer-specific rendering belongs in Portal, not Context Layer.

**Do:**

- Show owner, support path, tool entry points, authority badges, freshness, and warnings from registry/API data.
- Keep Portal information-centric, not provisioning-centric.
- Make source links and expansion paths visible.
- Design pages around user jobs, not internal storage tables.

**Don't:**

- Do not build provisioning forms.
- Do not create landing zone management workflows.
- Do not bypass the Context API to read registry data.
- Do not duplicate long-form documentation inside Portal pages.

**Verification gate:**

- Portal pages render pilot capability, landing zone, and source data from API responses.
- UI tests or interaction tests cover the primary V1 navigation paths.
- Portal handles stale, broken, conflict, and access warning states visibly.

### Phase 6: Ask Atlas Consumer Layer

**Subgoal:** Add AI-assisted discovery in Portal without moving reasoning into Atlas Context Layer.

**Expected outputs:**

- Portal-side LLM adapter interface.
- Prompt assembly that uses only the context bundle and user question.
- Citation validation before displaying answers.
- Answer UI with citations, authority badges, freshness signals, warnings, and expansion links.
- Rate limit and cost-control behavior at the Portal backend layer.

**Constraints:**

- All LLM code lives in Portal.
- Prompt content must come only from the Atlas context bundle plus the user question.
- Every factual claim must map to a citation from the context bundle.
- Uncited claims must be stripped or flagged before display.
- Browser code must not call the LLM provider directly.
- Credentials must never enter browser bundles, seed data, fixtures, or committed files.

**Do:**

- Treat Ask Atlas as a consumer of governed evidence.
- Make no-source, stale-source, conflict, and access-denied states explicit.
- Keep the model provider swappable through the adapter.
- Enforce Portal-owned rate limits.

**Don't:**

- Do not let the LLM become the authority.
- Do not inject hardcoded platform facts into prompts.
- Do not generate production-ready Terraform and present it as approved.
- Do not bypass policy, approval, or support processes.

**Verification gate:**

- Tests prove prompts are built only from context bundle content.
- Tests prove uncited claims are rejected, stripped, or flagged.
- Ask Atlas returns a clear no-registered-source response when the Context Layer has no evidence.

### Phase 7: Infrastructure and Deployment Path

**Subgoal:** Define deployable infrastructure without changing Atlas's V1 architecture.

**Expected outputs:**

- Infrastructure as code for DynamoDB, Lambda, API Gateway, secrets, IAM, and required Portal hosting.
- Environment configuration model for local, test, and production-like deployment.
- Secret loading paths for source-system and LLM credentials.
- CloudWatch logging and core metrics.

**Constraints:**

- Infrastructure is defined as code.
- Do not add SQS, Step Functions, OpenSearch, Kendra, Bedrock Knowledge Bases, or other managed retrieval layers in V1.
- Source-system and LLM credentials stay out of committed files.
- Caching, if needed, must be TTL-based and disposable.

**Do:**

- Keep infrastructure aligned with request-time execution.
- Make local development possible without production credentials.
- Log enough to diagnose source selection, anchor resolution, warnings, and API errors.

**Don't:**

- Do not manually provision production resources.
- Do not add services because they might be useful later.
- Do not make cache correctness a requirement for the system to function.

**Verification gate:**

- Infrastructure plan can be generated from code.
- Local and test environments can run without committed secrets.
- Observability captures the V1 success and failure signals.

### Phase 8: V1 Acceptance and Pilot Readiness

**Subgoal:** Prove the product loop with pilot data and documented acceptance criteria.

**Expected outputs:**

- 10-15 pilot topics across capability, landing-zone, and guardrail-area examples.
- Registered authoritative, reference, draft, deprecated, stale, restricted, and broken-anchor source examples.
- End-to-end tests for the three V1 scenarios.
- Manual pilot checklist for product review.
- Known limitations and post-V1 backlog.

**Constraints:**

- V1 coverage is pilot scope, not full platform coverage.
- Tests must assert behavior, not snapshots alone.
- Remaining gaps must be documented honestly.

**Do:**

- Verify the whole chain from seed data to Portal display.
- Validate warnings and failure modes, not only happy paths.
- Keep post-V1 ideas out of V1 implementation unless the design is updated.

**Don't:**

- Do not claim Atlas is a full platform catalog.
- Do not claim Ask Atlas is authoritative without citations.
- Do not hide missing coverage behind generic AI answers.
- Do not expand source classes or topic types without updating design and constraints first.

**Verification gate:**

- Capability Discovery, Landing Zone Navigation, and Ask Atlas all work against pilot data.
- Context bundle quality metrics are observable.
- Portal experience metrics can be reviewed during pilot.
- Known limitations are captured before broader rollout.

## Cross-Cutting Do and Don't

### Do

- Preserve the Context Layer as the deterministic core.
- Keep Portal as a consumer, not the architecture owner.
- Implement contract-first.
- Use request-time source retrieval.
- Surface stale, broken, conflicting, restricted, and missing evidence.
- Keep data model fields aligned with the design.
- Make tests explicit for context bundles, citations, warnings, access filtering, and AI answer validation.
- Prefer the smallest implementation that proves the V1 loop.

### Don't

- Do not implement speculative product scope.
- Do not introduce background ingestion.
- Do not build a search platform.
- Do not add managed retrieval services.
- Do not let LLM logic enter Context Layer.
- Do not let Portal bypass the Context API.
- Do not duplicate governance metadata outside Source.
- Do not add source classes, topic types, or authority levels without updating the design and constraints.

## Commit and Review Strategy

Use small, logically isolated commits:

1. Workspace foundation.
2. Shared schema contract.
3. Context Layer repositories and seed path.
4. Anchor resolver framework.
5. Context Bundle API.
6. Portal core surfaces.
7. Ask Atlas consumer layer.
8. Infrastructure and pilot acceptance.

Each commit should include tests or verification appropriate to its scope. Do not combine Portal UI work with Context Layer data-model changes unless the commit is strictly contract-integration work.

## Stop Conditions

Stop implementation and update the design first if any of these occur:

- A new Source field is needed.
- A new Topic field or topic type is needed.
- A new Source class is needed.
- A new authority level is needed.
- The Portal needs data that is not available through the Context API.
- The Context Layer needs to interpret or recommend rather than select and package evidence.
- Request-time source retrieval cannot meet V1 needs without a new architectural component.
- Ask Atlas needs domain facts outside the returned context bundle.

## Final V1 Definition of Done

Atlas V1 is done when:

- The Context Layer can register and retrieve governed Sources, Topics, and SourceTopicMappings.
- Anchor resolvers work for all three V1 source classes.
- Context bundles always include sources, warnings, and expansion paths.
- Portal surfaces pilot capability and landing zone experiences from API data.
- Ask Atlas answers only from context bundles and displays citations.
- Stale, broken, restricted, conflicting, and missing-source cases are visible to users.
- All V1 constraints remain true.
- Pilot acceptance is documented with known limitations.
