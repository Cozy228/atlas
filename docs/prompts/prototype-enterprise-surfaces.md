# Atlas Model-Namespace Prototype Exploration Prompt

Use this prompt to independently explore and implement one model's interpretation of the Atlas enterprise product experience.

## Model namespace

Set `MODEL_SLUG` to the lowercase, URL-safe name of the model receiving this prompt.

Examples:

- Codex uses `codex`.
- GLM uses `glm`.

All routes and model-specific implementation files must be isolated under that slug:

```text
/prototype/<model-slug>/...
```

Do not modify, reuse, redirect to, or visually normalize another model's prototype namespace. The purpose is to let different models produce genuinely independent design interpretations from the same product brief.

## Repository context

- Repository: Atlas.
- Work on the currently selected feature branch unless the user instructs otherwise.
- Package manager: `pnpm@11.18.0`.
- Portal stack: React, Vite, TanStack Router, Tailwind CSS v4, Base UI, shadcn/ui, and Tabler icons.
- Reply in Chinese.
- Write code, code comments, fixture content, and prototype interface copy in English.
- Do not commit, push, open a PR, or deploy unless separately requested.

Before making changes, read:

1. `AGENTS.md`
2. `Atlas.md`
3. `Atlas_Strategy.md`
4. `docs/agents/public-safety.md`
5. `docs/agents/change-discipline.md`
6. The current Portal route, shell, component, and styling conventions relevant to the implementation

## Product definition

Atlas is an application-centric, multi-cloud developer experience platform. It gives application teams a unified place to:

- Discover and understand platform capabilities.
- Understand application state and relevant context.
- Execute governed actions delegated to source systems.
- Complete stateful Golden Paths and onboarding journeys.
- Diagnose failures and identify safe recovery paths.

Atlas owns experience, guidance, normalized context, journey state, evidence, and diagnosis. Source systems continue to own domain truth, execution, authorization, and approval.

The first product proof point is:

> A developer with little cloud or infrastructure experience can take a fictional application from App Code to its first successful DEV deployment, understand blockers, and recover from a failed step with evidence.

The core product primitives are:

- `View`: task-relevant context.
- `Action`: a governed atomic operation.
- `Journey`: a stateful execution of a Golden Path.
- `Diagnosis`: an evidence-backed explanation and recovery path.

## Research requirement

Research relevant current public interfaces before designing.

Primary research areas:

- Port dashboards, entity/application pages, self-service actions, action runs, workflow runs, audit history, and diagnosis or incident experiences.
- shadcn/ui components and blocks that may help build the chosen direction.
- Other public enterprise developer portal or platform engineering interfaces when they provide useful contrast.

Backstage may be researched only for concepts such as reusable software templates, review before execution, observable task progress, and run history. Do not use Backstage screens, layouts, visual styling, navigation, or wizard structure as design targets.

Use only public-safe sources. Screenshots or reference images may be saved outside the repository. Do not add third-party screenshots to the public repository.

Summarize which research insights influenced the design, but do not copy a reference product.

## Design freedom

Develop an original interpretation of the Atlas product brief.

You decide:

- Information architecture.
- Navigation model.
- Page layout and content hierarchy.
- Visual language, typography, color, density, spacing, and motion.
- Interaction patterns and responsive behavior.
- Which shadcn components or blocks to use, adapt, or omit.
- Whether the prototype needs a dedicated shell.
- Whether additional supporting routes improve the product story.

You do not need to follow the current Atlas design tokens. Do not reskin existing non-prototype routes.

There is no prescribed layout, panel arrangement, card count, dashboard structure, onboarding stepper, diagnosis composition, scaffolder wizard, visual style, or required number of design variants. Make and explain your own product-design decisions.

## Required routes

Create these routes for the receiving model:

```text
/prototype/<model-slug>
/prototype/<model-slug>/dashboard
/prototype/<model-slug>/onboarding
/prototype/<model-slug>/scaffolder
/prototype/<model-slug>/diagnosis
```

The model namespace root may redirect to its dashboard or provide an index for that model's prototype.

Additional model-namespaced routes are allowed when they materially improve the exploration. Explain why each additional route is necessary. Do not create unnamespaced aliases such as `/prototype/dashboard`.

## Surface goals

These are product outcomes, not layout instructions.

### Dashboard

Help a developer understand the current state of their work and application context, including what needs attention and what useful action should happen next.

### Advanced onboarding

Represent onboarding as a stateful, potentially branching journey from application identification to first successful DEV deployment.

The experience should make prerequisites, progress, blockers, ownership, external waiting, decisions, completion evidence, exception paths, and the next useful action understandable.

### Scaffolder

Allow a developer to express an intent and trigger a governed platform action without needing to understand internal platform parameters.

The system should resolve as much as possible from application context, deterministic fixture relationships, policy, and platform defaults. This includes application, team, owner, repository, environment, cloud account or subscription, region, naming, permission context, and other derivable configuration.

Ask the user only for decisions that cannot be safely resolved. Do not turn missing system knowledge into blank fields for internal IDs or configuration values.

The experience must communicate:

- What Atlas resolved and from which source.
- What it recommends and why.
- What still requires a human decision and why it cannot be resolved.
- What is blocked by missing or ambiguous context.
- What will be sent to the source system.
- Which system performs the action.
- How progress, failure, outcome, and evidence can be observed.

Use fixtures only; do not implement a real execution backend.

### Diagnosis

Help a developer understand a failed onboarding or delivery step using application, environment, run, change, configuration, source, and evidence context.

The experience should distinguish likely causes, confidence, supporting or contradicting evidence, unknowns, ownership, and safe recovery options. It may prepare a draft action, ticket, or workflow input, but must not imply autonomous approval or production modification.

Do not expand this into a generic observability product or an unrestricted troubleshooting chatbot.

## Product behavior and boundaries

- Use deterministic, fictional fixtures.
- Keep selected application context coherent across model-namespaced routes.
- Clearly distinguish observed, derived, declared, Atlas-owned, and unknown state where relevant.
- Show source, external identifier, retrieval time, freshness, and data-quality uncertainty when evidence is presented.
- Atlas may prefill, recommend, validate, prepare, trigger an allowed fixture action, and observe its result.
- Atlas must not impersonate approvers, reproduce source-system approval logic, grant access, apply infrastructure, or perform autonomous production changes.
- Core navigation and meaningful controls must work; avoid a collection of unrelated static screenshots.
- Direct URLs and browser back/forward behavior must work.
- Preserve all existing non-prototype routes and behavior.

## Public-safety requirements

- Use fictional applications, people, teams, accounts, repositories, tickets, runs, and URLs.
- Do not add company names, private URLs, private APIs, credentials, internal screenshots, internal logs, private schemas, business rules, or remembered company behavior.
- Public vendor names may appear only as neutral source labels.
- Clearly label fixtures and simulated actions.
- Do not use nondeterministic fixture generation that makes verification unstable.

## Implementation constraints

- Use TanStack Router file-based routing.
- Do not manually edit `portal/src/routeTree.gen.ts`.
- Keep model-specific components and fixtures isolated from other model prototypes.
- Inspect the live `portal/components.json` before using shadcn.
- Prefer existing components and add only what the chosen design needs.
- Follow the repository's shadcn composition and accessibility rules.
- Avoid speculative abstractions or a generalized multi-model prototype framework.
- Make the smallest changes outside the model namespace required to make its routes work.

## Quality requirements

- The prototype must work at desktop, tablet, and mobile widths.
- It must have semantic structure, keyboard access, visible focus, accessible names, and non-color-only status communication.
- It must not introduce horizontal page overflow.
- Meaningful loading, empty, blocked, failure, and success states should exist where the product flow needs them.
- Visually inspect the result and fix obvious hierarchy, spacing, typography, contrast, clipping, and responsive issues.

## Verification

Run from the workspace root:

```bash
pnpm --filter @atlas/portal test
pnpm typecheck
pnpm --filter @atlas/portal lint
pnpm --filter @atlas/portal build
git diff --check
```

Verify every route in the receiving model's namespace through direct browser navigation and exercise its core interactions.

## Handoff

Report:

- The model slug and routes created.
- The design direction and major product decisions.
- Research sources and the insights actually used.
- Any additional routes and why they were added.
- Changed files.
- Verification results.
- Known limitations.
- Current Git status and whether anything was committed, pushed, or deployed.
