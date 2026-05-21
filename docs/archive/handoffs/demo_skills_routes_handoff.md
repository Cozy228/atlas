# Atlas Handoff: Demo, Skills, and Route Work Before Revert

This handoff captures the implementation direction that existed before the demo / skills / route cleanup. Some referenced files no longer exist in the current working tree because that implementation was reverted. Treat this as continuation context, not as current source truth.

## Scope Before Revert

The reverted work was trying to connect three related surfaces:

- A demo Context API consumer path that could request and consume an Atlas context bundle.
- A Skills Hub / Agent Skills publishing surface under `.well-known/agent-skills`.
- Portal route reshaping so catalog, guidance, sources, and skills could be browsed from more unified discovery surfaces.

The main product idea was that Atlas should not only be a Portal UI. The same governed context bundle should be consumable by Portal, local AI agents, skills, CLI tools, and future automation.

## Context Layer Direction

The implementation had added or changed context-layer pieces around:

- `context-layer/src/consumer/contextApiConsumer.ts`
- `context-layer/src/consumer/contextApiConsumer.test.ts`
- `context-layer/src/index.ts`
- `context-layer/src/seeds/pilotRegistry.ts`
- `context-layer/src/sourceContent/pilotSourceContent.ts`
- `context-layer/src/services/contextBundleService.ts`

The demo data had drifted toward an S3-oriented scenario:

- `aws-s3`
- S3 Terraform module source content
- S3 capability Confluence content
- private access bucket anchors
- related mappings from S3 sources to the S3 topic

If this line is resumed, first decide whether the demo prompt is still the original Textract / Central Landing Zone scenario or the later S3 variant. Do not let the scenario drift silently.

## Skills Hub Direction

The implementation had added an Agent Skills publishing path:

- `.well-known/agent-skills/atlas-context-consumer/SKILL.md`
- `portal/public/.well-known/agent-skills/index.json`
- `portal/public/.well-known/agent-skills/atlas-context-consumer/SKILL.md`
- `portal/src/api/server/agentSkills.ts`
- `portal/src/api/server/agentSkillsDigest.ts`
- `portal/src/api/server/loadAgentSkillsRegistry.ts`
- `portal/src/lib/agent-skills.ts`
- `portal/src/lib/skill-install.ts`
- related tests for registry loading, discovery index shape, digest validation, and install command text

The validated CLI direction from earlier work was:

```text
npx skills add https://portal.example.com --skill atlas-context-consumer -y
```

The registry should use discovery v0.2 shape with `type: "skill-md"`. Avoid treating a standalone `index.json` URL as the install target.

## Portal Route Direction

The reverted Portal work had changed route and navigation behavior around:

- `/skills`
- `/guidance/$guidanceId`
- `/guidance/$topicId`
- `/catalog/$topicId`
- `/sources`
- generated `portal/src/routeTree.gen.ts`

The work also introduced or modified components for:

- Skills Hub install dialogs and skill markdown display
- Context bundle inspection
- Discovery registry views for capabilities, landing zones, guardrails, and sources
- Related guidance lists
- Guidance stepper previews

The route reshaping seemed to be moving toward a unified catalog/discovery model, where catalog detail pages could represent capabilities, landing zones, and guardrail areas, while source list browsing redirected into catalog filters.

If this resumes, do not hand-edit `portal/src/routeTree.gen.ts`; let TanStack Router generation update it from route files.

## Product Ideas To Preserve

- Atlas Guidance should likely be a vertical-stepper workspace rather than a decorative map canvas.
- Guidance should remain evidence-backed and non-executing in V1.
- Skills and local AI agents are valid consumers of the Context API, not a Portal-only feature.
- A skills registry can demonstrate consumer-neutral Atlas context delivery, but it needs strict parity with the same Context API bundle used by Portal.
- The demo must prove bundle consumption, not hardcode final answers in Portal or skill code.

## Risks If Resumed

- Scenario drift: the work previously mixed Textract / Central Landing Zone intent with an S3 demo variant.
- Route churn: moving guidance, sources, catalog, and skills at the same time creates a large blast radius.
- Registry drift: root `.well-known` and `portal/public/.well-known` can diverge; pick one publication truth source.
- UI proof vs contract proof: a route existing in Portal is not enough. Tests should show Portal and skill code consume the same context bundle contract.

## Suggested Skills

- `router-core`: before touching TanStack Router route files or generated route tree behavior.
- `verification-before-completion`: before claiming the restored implementation works.
- `receiving-code-review`: if resuming from review feedback about Skills Hub or Context API parity.
- `brainstorming`: if the next step is to re-scope the product/demo story rather than restore code.

## Recommended Resume Path

1. Pick one demo scenario: Textract / Central Landing Zone or S3 private access.
2. Define the Context API bundle contract and parity test first.
3. Restore only the backend/registry path needed for that scenario.
4. Add the smallest Portal surface needed to inspect or install the skill.
5. Regenerate routes and run focused tests before expanding navigation.
