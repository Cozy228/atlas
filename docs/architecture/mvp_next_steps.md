# Atlas MVP Next Steps

> **Status:** Build-sequence detail. The *settled* MVP bar and Demo→MVP boundary now live in
> [`../product/mvp-product-design.md`](../product/mvp-product-design.md) (full spine; public-safe proof
> boundary). Read that first; this doc is the step-level reference beneath it.

This document defines the next implementation sequence for turning the current Atlas prototype into a minimum operational product loop.

It is not a future roadmap. It focuses on making the existing Atlas system complete enough to run end to end:

```text
source document -> metadata/lifecycle -> registry -> Context API -> Portal + Skill -> cited answer
```

## Goal

Atlas MVP should prove that governed source context can be registered, validated, deployed, discovered, and consumed by both the Portal and an external Skill through the same Context API contract.

The work should improve completeness of the existing system, not expand Atlas into a larger product surface.

## Working Assumptions

- Atlas remains a governed context layer, not a document mirror or general search engine.
- Source systems remain the system of record.
- MVP uses a manifest-driven control plane before adding broader automation.
- Atlas may fetch source metadata and lifecycle signals, but it should not durably ingest full source content.
- Runtime source excerpts are resolved through the Context API.
- Portal, Skills, and other consumers must use the same Context API contract.
- Claude may be used to critique and explore Portal UI/UX directions, but Claude is not a required runtime dependency for the Context Layer.

## Non-Goals

- No crawler or general-purpose search pipeline.
- No vector retrieval, Knowledge Bases, OpenSearch, or Kendra.
- No Portal admin UI for source registration.
- No workflow execution from Guidance.
- No user progress tracking in Guidance V1.
- No direct Skill access to Confluence, GitHub, policy documents, or Portal fixtures.
- No UI redesign that changes the Context Layer boundary.

## Recommended Sequence

### 1. Convert Static Data Into Registry Manifests

Current state: `context-layer/src/seeds/pilotRegistry.ts` contains the pilot registry as hand-written seed data.

Next step: promote static data into a manifest-driven registry input.

Expected manifest files:

```text
data/
  sources.yaml
  topics.yaml
  anchors.yaml
  source-topic-mappings.yaml
  guidance.yaml
```

The exact file format can be YAML or JSON, but the data must validate against the shared Atlas schema before it is loaded by the Context Layer.

Expected outputs:

- Manifest files for pilot Sources, Topics, Anchors, Source-Topic mappings, and minimal Guidance references.
- A validation/import command that parses the manifests and produces the same registry shape currently loaded from `pilotRegistry.ts`.
- Duplicate ID checks.
- Cross-reference checks for source IDs, topic IDs, anchor IDs, and guidance references.
- Schema checks using `@atlas/schema`.

Acceptance criteria:

- Invalid manifests fail fast with actionable errors.
- `pilotRegistry.ts` is no longer the long-term source of truth for pilot data.
- Context Layer tests prove that manifest-loaded registry data can build a Context API response.

### 2. Add Minimal Source Metadata Fetchers

MVP should fetch metadata, not full source content. The fetchers produce candidate source profiles and lifecycle signals, not final answers.

Source classes:

| Source class | Metadata to fetch |
|---|---|
| Confluence | Page ID, title, version, updated_at, author, labels, restrictions, headings |
| GitHub / Terraform | Repository, file path, commit SHA, README headings, last modified time, content fingerprint |
| Policy document | Path or URL, version or fingerprint, section IDs, last modified time |

Expected outputs:

- One metadata fetcher per source class.
- A candidate profile output that can be compared with the manifest registry.
- Source credential loading from approved server-side environment, Secrets Manager, or Parameter Store.
- Tests for success, unavailable source, malformed location, and restricted source behavior.

Acceptance criteria:

- Fetchers do not store durable source content.
- Metadata can detect changed, stale, broken, and restricted sources.
- Candidate profiles can be reviewed by the Platform Team before manifest updates.

### 3. Add Minimal Lifecycle States

MVP needs lifecycle states, but not a workflow engine.

Internal lifecycle states:

- `active`
- `changed_detected`
- `stale`
- `broken`
- `deprecated`
- `retired`

Portal display states:

- `active`
- `warning`
- `deprecated`

Mapping:

| Internal state | Portal display |
|---|---|
| `active` | `active` |
| `changed_detected` | `warning` |
| `stale` | `warning` |
| `broken` | `warning` |
| `deprecated` | `deprecated` |
| `retired` | hidden from normal browse |

Expected outputs:

- Lifecycle state fields in the registry or derived source health output.
- Warning generation in Context API responses.
- Portal display mapping for source cards, detail pages, Catalog, and Guidance evidence panels.

Acceptance criteria:

- Changed, stale, broken, deprecated, and retired states are visible through API behavior.
- Portal does not expose internal workflow noise to users.
- Context bundles include warnings for affected sources and anchors.

### 4. Deploy The Minimal AWS Chain

Deploy the Context API first. Do not start with a full production platform.

Expected outputs:

- API Gateway + Lambda for the Atlas Context Layer.
- DynamoDB for feedback and optionally registry storage.
- Bundled/static manifest registry as an acceptable first deployment step if registry DynamoDB is deferred.
- Secrets Manager or Parameter Store for Confluence and GitHub credentials.
- Portal hosting path.
- CI/CD command that deploys the same tested build.

Acceptance criteria:

- Deployed Context API can return a pilot context bundle.
- Portal can call the configured Context API.
- Skill can call the configured Context API.
- Local and deployed API behavior share the same schema contract tests.

### 5. Publish The Minimal Skill

The first Skill should be narrow. Its job is to prove that an external agent can consume the Atlas Context API.

Expected behavior:

- Input: user question or topic ID.
- Action: call deployed Atlas Context API.
- Output: context bundle summary plus citations.
- Rule: do not answer from model knowledge when the returned bundle lacks evidence.

Expected outputs:

- `atlas-context-consumer` Skill.
- Public discovery under `portal/public/.well-known/agent-skills/`.
- Discovery v0.2 index using `type: "skill-md"`.
- Install command based on the Portal base URL.

Acceptance criteria:

- `npx skills add <portal-base-url> --skill atlas-context-consumer -y` works.
- The Skill consumes the same Context API contract as Portal.
- Tests prove Portal and Skill consume equivalent bundle shapes.

### 6. Add The Skills Hub Page

The Skills Hub should explain and expose governed Context API consumers. It should not become a generic marketplace.

Expected outputs:

- `/skills` route.
- Skill list with name, purpose, owner, version, digest, supported source classes, and Context API endpoint.
- SKILL.md preview.
- Install command copy surface.
- Discovery URL visibility.

Acceptance criteria:

- Skills Hub reads from the published skill registry.
- Digest and discovery metadata are validated.
- The page makes it clear that Skills are Context API consumers.

### 7. Build The Actual Guidance Page

Guidance is a first-class browse object with its own route. It should become usable, not remain a placeholder.

Expected outputs:

- `/guidance` index.
- Guidance detail or workspace route.
- Vertical stepper layout.
- Step tasks, source evidence, tool entries, owner, and support path.
- Related Guidance previews on Catalog detail pages.

Acceptance criteria:

- At least one MVP Guidance exists as manifest data.
- Guidance uses source evidence from the registry or Context API.
- Guidance does not execute workflow actions or track user progress in V1.

### 8. Complete The Unified Catalog

`/catalog` should be the canonical browse surface for services, landing zones, guardrail areas, related sources, and related guidance.

Expected outputs:

- Unified Catalog index.
- Shared detail shell for service, landing zone, and guardrail topics.
- Related sources, related guidance, warnings, owner, support channel, and entry tools.
- `/sources` and `/guidance` should connect into Catalog without creating competing browse systems.

Acceptance criteria:

- Catalog truth comes from registry/API data.
- Source and Guidance routes do not duplicate Catalog as separate browse taxonomies.
- Catalog detail pages help users continue into Context API evidence, Guidance, or tool entries.

### 9. Redesign Portal UI/UX With Claude Assistance

Portal redesign should improve clarity, density, and demo readiness after the data and contract loop is stable.

Claude can be used for:

- UI critique.
- Layout alternatives.
- Interaction copy review.
- Visual consistency review.
- Design candidate comparison.

Claude should not be used to:

- Redefine the Context Layer boundary.
- Invent unsupported product claims.
- Replace registry/API-driven truth with static UI copy.

Expected outputs:

- Claude-assisted critique prompt.
- Two or three UI direction candidates.
- Selected Portal design direction.
- Focused implementation plan for UI updates.

Acceptance criteria:

- Portal feels like a dense internal workbench, not a marketing site.
- Evidence, authority, freshness, and warnings are visible without overwhelming the page.
- Home, Catalog, Availability, Guidance, Skills, and Ask Atlas remain coherent as one product.

## Implementation Batches

Batch 1: Registry control plane

- Manifest files.
- Validation/import command.
- Registry loading tests.

Batch 2: Source metadata and lifecycle

- Metadata fetchers.
- Candidate profiles.
- Lifecycle states.
- Context API warnings.

Batch 3: Deployed Context API

- Minimal AWS deployment.
- Runtime config.
- Contract verification against deployed API.

Batch 4: Skill and Skills Hub

- Published Skill.
- Discovery index.
- `/skills` page.
- CLI verification.

Batch 5: Guidance and Catalog closure

- Actual Guidance data and workspace.
- Unified Catalog detail surfaces.
- Related sources and related guidance.

Batch 6: Portal UI/UX redesign

- Claude-assisted critique.
- Design direction selection.
- Focused UI implementation.

## Definition Of Done

MVP is complete when:

- Pilot source data is manifest-driven and validated.
- Metadata fetchers can detect source lifecycle signals.
- Context API can return citation-ready bundles with warnings.
- Portal consumes the configured Context API.
- The Skill consumes the same Context API.
- `/skills`, `/guidance`, and `/catalog` are real product surfaces, not placeholders.
- Portal UI clearly presents governed context, authority, lifecycle warnings, and cited answers.
- The API Gateway adoption journey passes end-to-end as a hard gate: discover -> fit ->
  cited Terraform starter -> governed adoption route, all grounded (acceptance scenario).
