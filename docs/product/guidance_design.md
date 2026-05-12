# Atlas Guidance Design Doc

## 1. Purpose

Atlas Guidance is a lightweight, Git-managed route guidance object for internal platform processes.

It helps users answer:

* What am I trying to achieve?
* Where am I now?
* What should I do next?
* What task must be completed at this step?
* Which source or tool should I open?
* When can I move to the next step?
* Who can help if I am blocked?

Guidance is not a workflow automation engine. It does not execute provisioning, submit approvals, run Terraform, trigger Harness, or modify source systems.

It provides structured process guidance, visual navigation, source evidence, tool entries, owner/support paths, and blocking-state clarity.

## 2. Product Definition

Atlas Guidance is a managed journey definition that turns platform processes into map-native, step-by-step guidance.

Guidance is a first-class browse object in Atlas. It has its own index route, such as `/guidance`, and does not appear in `/explore`. `/explore` remains the catalog and availability surface for capabilities, landing zones, guardrails, and tool entries.

Capability and Landing Zone detail pages should show related Guidance, not embed the full Guidance index. A related Guidance module can preview the route and link into the full Guidance workspace when the user needs the complete path.

Each Guidance has:

* scenario
* objective
* destination
* steps
* tasks
* transitions
* completion rules
* source references
* owner metadata
* status

It can be:

* authored as YAML or JSON
* stored and reviewed in Git
* validated by JSON Schema
* rendered by Atlas UI as a route-oriented guidance surface
* exposed through Context API for AI agents or other consumers
* generated as a draft from source documents by AI, then reviewed by owners

## 3. Design Principles

### 3.1 Guidance, not Workflow

Guidance tells users what to do and where to go. It does not perform actions on the user's behalf.

Allowed:

* open a tool link
* open an Atlas page
* open a source document
* show required tasks
* show support path
* show blocked or needs-support states
* expose structured context through API

Not allowed in V1:

* terraform apply
* create AWS resources
* submit approval automatically
* trigger Harness automatically
* mutate external systems
* act as a workflow engine

### 3.2 Step + Task Only

The core model should stay simple.

Guidance contains ordered steps. Each step contains tasks.

No separate milestone layer is needed.

### 3.3 Unified Data Model

Route, decision, and checklist guidance should all use the same schema in V1.

The `type` field changes rendering behavior, not storage structure.

Troubleshooting may reuse the same model later, but it should not drive the V1 renderer.

### 3.4 Map-native, not Map-first

The UI should be map-native, not a map-first canvas.

The route is part of the information architecture. It gives users direction, stability, and confidence about where they are in the process. It should not become a decorative animation layer or a diagramming canvas.

It should show:

* current location
* next step
* destination
* current step tasks
* blocked or support-needed states
* source evidence and tool entry points for the current step

The core UX principle is:

```text
Map as orientation and structure.
Workspace as action, evidence, and support.
```

### 3.5 Lightweight Renderer

Do not use React Flow, Mermaid, XState, or BPMN in V1.

Use a custom renderer based on:

* React
* SVG path layer
* positioned HTML step nodes
* CSS transitions or Motion / Framer Motion style animations

Animation is a supporting affordance, not the product value. V1 should prioritize deterministic guidance, clear evidence, and tool-entry confidence over motion choreography.

## 4. Non-Goals

Atlas Guidance V1 does not aim to support:

* BPMN modeling
* arbitrary DAG editing
* drag-and-drop workflow builder
* external system execution
* full workflow automation
* complex state machines
* parallel execution branches
* V1 user progress tracking or personalization
* React Flow canvas experience
* Mermaid-first diagram generation
* CMS-style document authoring

## 5. Core Concepts

## 5.1 Guidance

A Guidance is a complete route for a specific scenario.

In Atlas, Guidance is a first-class browse object. The `/guidance` index helps users find the right scenario route. Capability and Landing Zone detail pages show related Guidance when a route helps users continue from the current object.

Guidance should not be treated as a Source. It can reference sources and catalog objects, but it is not the system of record for platform documentation, capability truth, or operational execution.

Example:

* New Application Onboarding
* Landing Zone Selection
* Request Access
* Enable Approved AWS Service
* TFE Module Usage
* Harness Deployment Setup
* Production Readiness

## 5.2 Scenario

Scenario describes the situation in which the Guidance should be used.

Examples:

* onboarding
* access_request
* service_enablement
* deployment_setup
* production_readiness

Troubleshooting can be added after V1 as a later scenario family.

## 5.3 Objective

Objective describes what the Guidance helps the user achieve.

Example:

> Help an application team onboard a new workload to the standard cloud platform.

## 5.4 Destination

Destination is the end state of the journey.

Example:

> Application is ready for standard cloud deployment.

Destination is important because the UI should feel like moving toward a clear endpoint.

## 5.5 Step

A Step is a node on the map.

It represents where the user is in the journey.

Examples:

* Choose Landing Zone
* Request Access
* Open Terraform Enterprise
* Connect Harness Pipeline
* Complete Production Readiness

## 5.6 Task

A Task is an item inside a step.

It represents what the user should do at that step.

Examples:

* Open access request form
* Review landing zone options
* Confirm workload type
* Open TFE workspace
* Check required tags

## 5.7 Transition

Transition defines where the user goes after completing a step.

Most Guidance should use simple `next.default` transitions.

Decision steps may use conditional transitions.

## 5.8 Source

Source is a referenced system of record or supporting document.

Examples:

* Confluence page
* SharePoint page
* Terraform module README
* policy document
* architecture guide
* TFE workspace
* Harness pipeline
* request form

Guidance should reference sources but not replace them.

## 5.9 Action

An Action is the user-facing entry point attached to a task.

It answers:

> Where should the user go or what should the user open?

Examples:

* Open access request form
* Open TFE workspace
* Open Harness setup guide
* Open source evidence
* Copy request template
* Contact support channel

Action labels must not imply Atlas executed the work. Use `Open`, `View`, `Copy`, or `Contact`; do not use `Submit`, `Run`, `Apply`, or `Create` for external systems.

## 6. Guidance Types

Guidance types are renderer presets, not separate schemas.

All types use:

```text
Guidance -> steps -> tasks
```

V1 supports:

* route
* decision
* checklist

Troubleshooting is a later preset. It should not force the V1 renderer into a full diagnostic graph model.

## 6.1 route

Use for normal step-by-step journeys.

Examples:

* onboarding
* service enablement
* deployment setup

Renderer behavior:

* show a clear path from start to destination
* emphasize route orientation
* active step is centered or highlighted
* selected route is visually highlighted

## 6.2 decision

Use when the user must choose a path.

Examples:

* landing zone selection
* region selection
* private vs public API path

Renderer behavior:

* show branch options clearly
* decision step has option cards
* selected branch becomes the active route
* unselected branches remain visible but de-emphasized

## 6.3 checklist

Use when completion depends on a group of checks.

Examples:

* production readiness
* security review readiness
* deployment readiness

Renderer behavior:

* step card emphasizes checklist items
* readiness depends on all required tasks being understood or completed outside Atlas
* the route points users to the next step without recording personal completion

## 6.4 Future: troubleshooting

Use for diagnostic journeys.

Examples:

* Textract S3Object failure
* deployment pipeline failure
* access denied issue

Renderer behavior:

* similar to decision guidance
* emphasizes symptoms, checks, and escalation
* terminal nodes may be `resolved` or `escalate`

V1 should document this type as future-compatible only. Do not include troubleshooting in the initial UI scope.

## 7. Step Kinds

Step `kind` changes how an individual step is displayed.

Recommended V1 kinds:

```yaml
kind:
  - action
  - decision
  - checklist
  - support
  - destination
```

Optional later:

```yaml
kind:
  - info
  - wait
  - warning
```

## 8. Completion Rules

V1 should keep completion simple.

Completion rules describe what makes a step conceptually ready to move forward. They do not create user-specific progress tracking in V1.

Recommended completion modes:

```yaml
completion:
  - informational
  - all_required_tasks_understood
  - optional
```

Do not support external status sync in V1.

Do not persist user progress in V1. No Auth means Atlas should not pretend to know which user completed which task.

Later option:

```yaml
completion:
  - external_status
```

Only add this when Atlas intentionally integrates with TFE, Harness, ServiceNow, Jira, or similar systems for read-only status.

## 9. Authoring Model

Guidance should be authored in YAML and exposed as normalized JSON.

Recommended:

```text
Authoring model: YAML in Git
Validation model: JSON Schema
Runtime model: normalized JSON
Rendering model: map layout
```

Why YAML for authoring:

* easier for humans to write
* cleaner Git diffs
* easier PR review
* familiar to platform teams
* AI can generate it as draft

Why JSON for runtime:

* easier for API consumers
* easier schema validation
* easier frontend consumption

## 10. Option A vs Option B

## 10.1 Option A: Ordered Steps Model

Authoring shape:

```yaml
steps:
  - id: a
    next:
      default: b
  - id: b
    next:
      default: c
```

Pros:

* simple
* readable
* Git review friendly
* easy for AI to generate
* easy to validate
* enough for V1

Cons:

* less suitable for complex graphs
* not ideal for large multi-branch flows

## 10.2 Option B: Graph Model

Authoring shape:

```yaml
nodes:
  - id: a
  - id: b
edges:
  - from: a
    to: b
```

Pros:

* flexible
* graph-native
* better for complex flows

Cons:

* more abstract
* less readable for process owners
* easier to drift into workflow-engine design
* less friendly for lightweight Git authoring

## 10.3 Recommendation

Use Option A for authoring.

Compile it internally into a graph for rendering.

```text
YAML steps -> normalized guidance -> render graph -> map UI
```

This keeps human authoring simple while allowing the renderer to work with graph-like data internally.

## 11. Recommended YAML Schema

```yaml
id: new-app-onboarding
title: New App Onboarding
type: route
scenario: onboarding

objective: Help an application team onboard a new cloud workload.

destination:
  title: Application ready for standard cloud deployment
  description: The app has required access, deployment path, and readiness checks.

owner:
  team: Cloud Platform
  support: cloud-platform-support

status: published
version: 1.0.0

appliesTo:
  landingZones:
    - central-lz
  regions:
    - ap-southeast-1
  environments:
    - dev
    - test
    - prod

steps:
  - id: choose-landing-zone
    title: Choose landing zone
    kind: decision
    description: Select the right landing zone for this workload.
    tasks:
      - id: review-options
        title: Review landing zone options
        action:
          type: atlas_page
          target: /landing-zones
      - id: confirm-choice
        title: Confirm selected landing zone
    next:
      default: request-access

  - id: request-access
    title: Request access
    kind: action
    description: Open the approved access request path for the selected landing zone.
    tasks:
      - id: open-request-form
        title: Open access request form
        action:
          type: external_link
          ref: access-request-form
    completion: informational
    next:
      default: open-tfe

  - id: open-tfe
    title: Open Terraform Enterprise
    kind: action
    description: Use the approved TFE workspace or module.
    tasks:
      - id: open-tfe-workspace
        title: Open TFE workspace
        action:
          type: external_link
          ref: tfe-standard-workspace
    sources:
      - tfe-onboarding-guide
    completion: informational
    next:
      default: connect-harness

  - id: connect-harness
    title: Connect Harness pipeline
    kind: action
    description: Connect the standard deployment path.
    tasks:
      - id: open-harness
        title: Open Harness setup guide
        action:
          type: external_link
          ref: harness-standard-guide
    completion: informational
    next:
      default: production-readiness

  - id: production-readiness
    title: Production readiness
    kind: checklist
    description: Complete required checks before production use.
    tasks:
      - id: logging
        title: Logging enabled
      - id: tags
        title: Required tags applied
      - id: iam
        title: IAM role pattern reviewed
      - id: support-owner
        title: Support owner confirmed
    completion: all_required_tasks_understood
    next:
      default: done

  - id: done
    title: Onboarding complete
    kind: destination
    description: The application is ready for standard cloud deployment.

sources:
  - cloud-onboarding-guide
  - landing-zone-overview
  - tfe-onboarding-guide
  - harness-standard-guide
```

## 12. Action Types

Recommended V1 action types:

```yaml
action.type:
  - atlas_page
  - external_link
  - source_link
  - tool_link
  - support_link
  - copy_text
```

Do not include execution actions such as:

```yaml
terraform_apply
run_pipeline
submit_request
create_resource
```

Those would move Atlas into workflow automation.

## 13. Progress Model

V1 does not track user progress.

Atlas Guidance can show state from the Guidance definition itself, such as route type, step kind, required tasks, source health, and blocked or needs-support markers. It should not persist user-specific completion state in V1.

Reasons:

* V1 has no authentication.
* A local checkbox can create false confidence that Atlas knows operational work is complete.
* Guidance should point users to the right source and tool, not become a hidden workflow tracker.

Step presentation status can be computed from the Guidance definition and source health.

Recommended V1 presentation statuses:

```ts
type StepStatus =
  | "available"
  | "selected"
  | "blocked"
  | "needs_support"
  | "destination";
```

Post-V1 may add local or authenticated progress, but that should be treated as a separate product decision.

## 14. Guidance UI Surfaces

Guidance appears in three UI surfaces.

### 14.1 Guidance Index

The `/guidance` index is the primary browse surface for Guidance.

It should not be a generic card wall by default. The preferred direction is a scenario map: each major scenario appears as a point or route cluster on a stable map-like surface. Users should feel that they are choosing a route through the platform, not browsing another documentation directory.

Recommended index behavior:

* group Guidance by scenario family, such as Onboard, Decide, Enable, Validate
* represent each Guidance as a route preview or scenario point
* show objective, destination, owner, source health, last reviewed date, and step count
* expose warnings for stale, broken, blocked, or needs-support routes
* fall back to list or card grid when density, accessibility, or small viewport constraints make the map view less useful

Each index item represents one scenario. The card/list fallback should preserve the same route metadata instead of becoming a plain document card.

### 14.2 Related Guidance

Capability and Landing Zone detail pages show related Guidance.

Related Guidance should be lightweight:

* show a short route preview
* show why the route is relevant to the current capability or landing zone
* show owner/support and source health
* link to the full Guidance workspace

Do not embed the entire Guidance index into detail pages.

### 14.3 Guidance Workspace

The Guidance workspace is the expanded route surface for one Guidance.

It is not an execution page. It is a high-density guidance console that combines:

* route map
* selected step
* required tasks
* source evidence
* tool links
* owner/support path
* blocked or needs-support state

Recommended structure:

```text
Route orientation
  -> selected step
  -> current step workspace
  -> evidence and tool entries
```

The route map should remain visible while the user inspects steps. The workspace changes as the selected step changes.

## 15. Map Grammar

Guidance needs a consistent visual grammar so the map feels meaningful instead of decorative.

Recommended V1 grammar:

| Element | Meaning |
|---|---|
| Station | A step in the Guidance |
| Segment | The transition between steps |
| Destination | The intended end state |
| Branch | A decision option |
| Checkpoint | A checklist-heavy step |
| Support spur | A support or escalation path |
| Evidence marker | Authoritative or warning-bearing source evidence |
| Blocked marker | A known blocker, stale source, or needs-support state |

Map grammar should create direction and stability. It should not introduce game mechanics, achievement language, decorative motion, or arbitrary canvas interaction.

## 16. Rendering Strategy

## 16.1 Avoid Flowchart Look

The renderer should not look like a diagramming canvas.

Avoid:

* rectangular flowchart nodes
* visible ports and handles
* drag canvas interaction
* BPMN-like symbols
* dense node graphs
* complex arrows everywhere

Prefer:

* route map
* soft curved path
* station-like nodes
* active step card
* selected route highlight
* blocked and support-needed markers
* restrained state transitions

## 16.2 Renderer Architecture

```text
Guidance YAML
  -> parse
  -> validate
  -> normalize
  -> compute layout
  -> render SVG path
  -> render HTML step nodes
  -> animate state changes
```

## 16.3 Suggested Frontend Implementation

Use:

* React
* SVG path for route layer
* absolutely positioned HTML nodes for step nodes
* CSS transitions or Motion for animation
* optional Web Animations API for fine-grained imperative animations

Do not use:

* React Flow
* Mermaid as primary renderer
* BPMN renderer
* XState for V1 state management

## 16.4 DOM Structure

```html
<div class="guidance-map">
  <svg class="route-layer">
    <path class="route-base" />
    <path class="route-selected" />
    <path class="route-warning" />
  </svg>

  <button class="step-node selected"></button>
  <button class="step-node blocked"></button>
  <button class="step-node destination"></button>

  <section class="current-step-card"></section>
</div>
```

## 17. Layout Strategy

Do not require YAML authors to provide coordinates.

The renderer should compute layout.

Recommended V1 layouts:

```yaml
layout:
  - vertical_route
  - horizontal_route
  - curved_map
```

## 17.1 vertical_route

Best for longer enterprise processes.

Can still look modern by using:

* curved path
* alternating node positions
* sticky active card
* soft state transition

## 17.2 horizontal_route

Best for short flows embedded in capability pages.

Recommended for 3 to 5 steps.

## 17.3 curved_map

Best for a full Guidance workspace when the route shape benefits from map-like orientation.

Rules for V1:

* maximum 8 to 10 steps
* maximum 2 levels of branching
* no arbitrary graph editing
* no author-defined coordinates

## 18. Animation Design

Animation should create guidance and continuity, not entertainment.

Recommended effects:

* selected station state change
* route edge changes from muted to selected
* blocked marker appears without layout shift
* workspace panel changes without losing route orientation
* destination has a restrained end-state treatment

Avoid:

* scores
* badges
* rewards
* leaderboards
* sound effects
* exaggerated game language

## 19. SVG Path State

Use SVG paths to show route structure and state.

Recommended structure:

* base path: muted full route
* selected path: current route or branch
* warning path: blocked or needs-support segment

## 20. Motion Path Enhancement

CSS `offset-path` can be used later to move a marker along a route path.

Use this as enhancement, not the core dependency.

Core renderer should work without it.

## 21. Current Step Panel

The active step should have a clear task panel.

Suggested structure:

```text
Current step: Open Terraform Enterprise

Why this matters
- Use the approved infrastructure path.

Tasks
- Open TFE workspace
- Review required variables
- Confirm workspace owner

Actions
[Open TFE Workspace] [Open Source] [Contact Support]

Sources
- TFE onboarding guide
- Module README

Need help?
- Cloud Platform Support
```

## 22. Context API

Guidance should be consumable by AI agents and other systems through APIs.

Recommended APIs:

```text
GET /guidance
GET /guidance/{id}
GET /guidance?scenario=onboarding
GET /guidance?capability=aws-textract
POST /context/guidance
```

## 22.1 Guidance Context Response

```json
{
  "guidanceId": "new-app-onboarding",
  "title": "New App Onboarding",
  "type": "route",
  "scenario": "onboarding",
  "objective": "Help an application team onboard a new cloud workload.",
  "destination": {
    "title": "Application ready for standard cloud deployment"
  },
  "selectedStep": {
    "id": "open-tfe",
    "title": "Open Terraform Enterprise",
    "kind": "action",
    "tasks": [
      {
        "id": "open-tfe-workspace",
        "title": "Open TFE workspace",
        "action": {
          "type": "external_link",
          "ref": "tfe-standard-workspace"
        }
      }
    ],
    "sources": ["tfe-onboarding-guide"]
  },
  "nextStep": {
    "id": "connect-harness",
    "title": "Connect Harness pipeline"
  },
  "sources": [
    {
      "id": "tfe-onboarding-guide",
      "authorityLevel": "authoritative"
    }
  ]
}
```

## 23. Validation Rules

Guidance should be validated before publishing.

Required checks:

* id is unique
* title exists
* type is valid
* scenario exists
* objective exists
* destination exists
* owner exists
* status is valid
* every step has id and title
* step ids are unique
* every `next.default` points to a valid step
* every source reference exists in source registry
* no unreachable steps unless explicitly allowed
* no circular route unless explicitly allowed later
* published Guidance must have at least one source

## 24. Governance

Recommended statuses:

```yaml
status:
  - draft
  - published
  - needs_review
  - deprecated
```

Rules:

* AI-generated guidance starts as draft.
* Only owner-reviewed guidance can become published.
* Deprecated guidance remains searchable but clearly labeled.
* Guidance should have a review date or version.
* Source changes can mark related Guidance as needs_review in later phases.

## 25. AI-generated Draft Guidance

AI can generate Guidance draft from selected sources.

AI input:

* selected source document
* selected excerpt
* existing process checklist
* known issue page
* onboarding guide

AI output:

* draft YAML
* extracted steps
* extracted tasks
* detected decisions
* source references
* ambiguity warnings
* missing metadata warnings

Important rule:

> AI can generate draft Guidance, but it cannot directly publish authoritative Guidance.

## 26. MVP Scope

V1 should support:

* YAML authoring in Git
* JSON Schema validation
* route guidance
* simple decision step
* checklist step
* destination step
* current step panel
* source links
* support link
* `/guidance` index
* related Guidance modules on Capability and Landing Zone detail pages
* SVG map renderer
* restrained route state transitions
* Context API read endpoint

V1 should not support:

* drag-and-drop editor
* external status sync
* workflow execution
* arbitrary graph editing
* complex parallel branches
* BPMN import/export
* React Flow canvas
* Mermaid-first rendering
* AI auto-publish

## 27. Example V1 Guidance Candidates

Good first candidates:

1. New Application Onboarding
2. Landing Zone Selection
3. Access Request
4. Enable Approved AWS Service
5. TFE Module Usage
6. Harness Deployment Setup
7. Production Readiness Checklist

Troubleshooting examples should stay post-V1 until the route, decision, and checklist patterns are stable.

## 28. Recommended Implementation Plan

### Phase 0: Static Prototype

* Create 2 to 3 YAML Guidance examples.
* Validate with local JSON Schema.
* Render the `/guidance` index and static route workspaces.
* Implement active step panel.
* Implement related Guidance previews for one Capability or Landing Zone detail page.

### Phase 1: Registry-backed Guidance

* Store Guidance definitions in Git.
* Build API to serve normalized JSON.
* Add source registry resolution.
* Add Context API.

### Phase 2: AI Draft Generation

* Generate draft YAML from selected sources.
* Validate generated YAML.
* Show warnings.
* Require owner review before publishing.

### Phase 3: Health and Maintenance

* Detect broken source references.
* Detect stale Guidance.
* Mark Guidance as needs_review when linked sources change.
* Add owner review workflow.

## 29. Reference Links

### Journey and UX References

* Nielsen Norman Group: Journey Mapping 101
  [https://www.nngroup.com/articles/journey-mapping-101/](https://www.nngroup.com/articles/journey-mapping-101/)

* Nielsen Norman Group: Progressive Disclosure
  [https://www.nngroup.com/articles/progressive-disclosure/](https://www.nngroup.com/articles/progressive-disclosure/)

* MDN Web Docs: SVG
  [https://developer.mozilla.org/en-US/docs/Web/SVG](https://developer.mozilla.org/en-US/docs/Web/SVG)

* MDN Web Docs: offset-path
  [https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path](https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path)

* GitHub Docs: Workflow syntax for GitHub Actions
  [https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions)

* JSON Schema Docs
  [https://json-schema.org/docs](https://json-schema.org/docs)
