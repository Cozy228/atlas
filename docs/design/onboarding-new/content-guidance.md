# Task content guidance

Scope: the 21 visible tasks derived from `onboarding.json` (including application code and summary). `launch-ecs` is a journey handoff with no actionable content; it is not another task. Source instructions are prototype fixtures, not verified integrations or live operational policy.

## Interaction contract

Keep the task instructions and its recorded outputs in place. Offer a collapsed, specifically named action after the output fields: Prepare group-mapping email, Prepare access request, or Prepare workspace request. Opening it shows only additional context fields, missing-source links, a generated preview, and Copy draft / Open email draft. Draft context is not an artifact. Summary is the final onboarding phase, using the same accordion, task row and progress treatment as the other phases. It remains outside the embedded ECS journey. Opening or copying a draft does not submit a request, send mail, mark completion, or prove approval.

Application name is a distinct fact from application code. An approval reference is supplied by the user; the prototype does not verify or declare that an approval was granted. Ticket numbers come from the relevant recorded request. Current-task drafts can feed a preview before completion; upstream artifact bindings require a completed source task. Missing fields render as `[REPLACE: Field label]`. Copy and email handoff remain available, with a visible reminder to replace placeholders before sending; missing draft inputs do not add dependency gates to task completion. Existing own-output requirements remain unchanged.

The preview remains derived from current values. A changed ticket/code or undone upstream task invalidates the previous draft immediately. Existing user-entered draft context survives refresh. Email clients differ in supported mailto lengths; Copy draft remains the fallback. No email connector is called.

## Task-by-task opportunities

Status: **Available** means implemented in the current prototype. **Proposed** means an opportunity, not shipped behavior. **Source gap** means the source cannot support trustworthy generated instructions yet.

| # | Source task | Useful action | Inputs already present | Missing facts / boundary | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | `application-code` | Establish shared application context; reuse it in later actions | Application code | Actual application name and owner are separate; do not infer them from the code | Proposed; application name is collected lazily by the email action |
| 2 | `sailpoint-groups` | Copy group list for the manual bulk-request fallback | Application code and group templates | The source links to an external spreadsheet but does not provide its column schema; no fabricated spreadsheet import | Proposed |
| 3 | `group-mapping` | Prepare one IDAM email with sections for Harness, AWS, and TFE | Three current request IDs; completed upstream group sets | Application name; owner-approval reference | **Available** |
| 4 | `harness-onboarding` | Prepare SCIM follow-up; show existing org/project/repository before requesting new ones | Harness request, groups, recorded org/project/repository | Whether the self-service automation already handled SCIM; no verified live lookup | Proposed; manual path only |
| 5 | `git-onboarding` | Copy group/request details for manual repo creation; reuse an existing repo | App code; source group conventions; Harness project | Desired repo identity, actual existing repo, request owner; no existence inference from a URL string | Proposed |
| 6 | `tfe-access` | Prepare the exact short description and group list for the access request | App code; completed TFE viewer/operator groups; source assignment instruction | Live access status remains unverified; signing back in is still a manual verification step | **Available** |
| 7 | `tfe-project` | Prepare a project request summary | App code and application context | Source provides no catalog field schema; copy only known facts, not a supposedly complete form | Proposed |
| 8 | `tfe-workspace` | Prepare workspace request with project and Git repository | Completed TFE project; recorded Git infrastructure repository; app code | A recorded repository identity is not proof of current remote existence. The source does not define the full request form | **Available**, explicitly a summary |
| 9 | `aws-email-dl` | Suggest a DL name; prepare forwarding instructions to the authorized approver | App code; source naming convention; entered DL | Environment and actual authorized approver; do not impersonate the approver or claim forwarding happened | Proposed |
| 10 | `aws-group-mapping` | Prepare manual AWS SCIM email | Current SCIM ticket; completed AWS groups; shared application context | Approval reference; whether an earlier automated mapping already covers this account/environment | **Available**, labeled manual |
| 11 | `aws-account` | Prepare an account-request packet with DL, groups, and SCIM ticket | Recorded DL and mapping results; app context | Environment and catalog-specific required fields. Ticket completion does not establish successful provisioning | Proposed |
| 12 | `aws-connector` | Prepare connector inputs and flag test/deploy region mismatch | Account ID; Harness organization; entered connector region/delegate | Target environment, actual existing connector and connection result. Region/delegate rules must be explicit source metadata | Proposed |
| 13 | `vault-unix` | Identify whether this task applies; link to a real procedure when supplied | Application context | Source explicitly has no procedure. Do not generate commands or invent the Unix/ESF creation flow | **Source gap** |
| 14 | `cyberark-groups` | Copy requested entitlement/group names, including approvers | App code; source FC Connect/Approvers naming | Approver members and entitlement choices; existing artifact metadata currently records only the Connect group | Proposed |
| 15 | `cyberark-role` | Prepare operations request with account ID and role references | AWS account ID; source role labels; entered role/safe | Actual privileged-role ARNs, request ID and receipt. Do not invent partition/path/ARN from a display name | Proposed |
| 16 | `service-repos` | Prepare a paired repo/project naming plan and compare naming consistency | Git org; service repo/project outputs; app code | Service identifier and actual repository type. Two distinct repositories must not be collapsed into one | Proposed |
| 17 | `generate-stack` | Prepare the pipeline parameter packet | Project, account, connector, environment and repository artifacts | Cluster, region, service, ECR identity and file path. Source contains conventions and case sensitivity; represent these as explicit rules | Proposed |
| 18 | `infra-pipeline` | Prepare the run inputs and a verification checklist with log links | Infra repository, workspace and pipeline URL | Module/provider version, target environment, actual Plan/Apply evidence. Execution status is unknown without evidence | Proposed |
| 19 | `app-deploy-pipeline` | Prepare deployment inputs and validate a supplied container definition | App repo, image, pipeline, service/environment records | Ports, CPU/memory, role ARNs, log group and configuration. Do not generate a deployable YAML by inventing infrastructure identifiers | Proposed |
| 20 | `dev-deploy-success` | Prepare deployment verification and handoff summary | Service, version, environment and recorded URL | Actual run result, DNS endpoint and reachability evidence. A user completion click is not observed deployment success | Proposed |
| 21 | `setup-summary` | Prepare a support packet scoped to the selected problem/task | App code, task name, meaningful artifacts and entered request URLs | Issue description, expected/observed result and recipient/channel; avoid dumping unrelated artifacts into the message | Proposed |

Priority after the first four actions: support packet, group-list copy, account request packet, then pipeline inputs. These remove repetitive typing without requiring a live integration. Generated configuration and automatic verification require more structured inputs and evidence.

## What is implemented

- `onboarding.json`: four explicit `guidance` action definitions with template text and input references.
- `guidance.ts`: schema parsing, source binding, missing-value resolution, preview generation and encoded email links.
- `task-guidance.tsx`: a shared UIPros Accordion/Input/Button composition for both email and copy actions.
- Bindings support a named journey input, a field (or all fields) of a recorded artifact, and user-supplied contextual data. They do not key behavior off English task titles.
- Templates are resolved in one pass, so user-entered text containing braces or URL punctuation cannot become another template reference or email header.
- Tests cover missing context, uncompleted upstream data, undo, value changes, email encoding, invalid template references, and reuse by an unrelated training journey.

The current prototype has one stored journey context; action metadata is reusable, but this is not yet a production multi-instance journey engine. It also has no semantic extraction service, live system checks, automatic email sending, or request submission.

## Applying guidance automatically to other journeys

### 1. Normalize source content at import time

Parse the source into stable journey/task IDs, typed inputs, declared outputs, instruction blocks and source locations. Preserve the original text/link reference and revision for every extracted action. Extract candidate intents such as contact, request, configure, validate and hand off. An LLM can propose candidates where the prose is irregular; deterministic patterns can identify mail addresses and existing structured fields.

Extraction is a publishing-time operation, not a hidden runtime decision. Run a schema check and show the proposed action to the journey author. Ambiguous recipient, missing output identity or absent approval requirements should produce a review item rather than a guessed value. Once approved, persist the action definition with the journey revision.

### 2. Match a small recipe library

Start with recipes for email draft, request summary, named-value list and support packet. Later add parameter forms and evidence checklists. A recipe specifies required semantic slots and expected effects. It does not contain company-specific system behavior.

For example, the email sentence in `group-mapping` yields slots for recipient, ticket IDs, application name, security groups and owner-approval reference. The compiler maps those slots to known input/output definitions and marks unmapped slots as contextual questions. A different HR or training journey uses the same recipe with different slots and recipient; it should not need a React component change.

### 3. Bind to facts with scope and provenance

Production facts need stable semantic names and instance scope: journey instance, application, account/environment and service. Each value should retain source task/artifact, source revision, entered/derived/observed provenance, and freshness or verification state. Never select the first available account or ticket from another environment.

Suggested precedence is an explicit user-selected fact, then an exact scoped artifact binding, then an approved deterministic derivation. Missing or conflicting values remain unresolved. Approval evidence is its own fact; task completion is not an approval flag. Changing an application/account/environment must invalidate dependent derived facts and drafts rather than silently relabeling old confirmed outputs.

### 4. Resolve and render deterministically at runtime

Build the action from its persisted definition and current scoped facts. Surface a concise missing-field list, with direct navigation to the producing task when available. The user only supplies facts that cannot be reused. Recompute previews when inputs change; do not persist a stale ready-to-send string as the source of truth.

Only show actions that fit the selected path. For example, manual SCIM help belongs to the manual fallback when automation has already been used successfully. Path selection and observed results must be explicit state, not inferred from prose or from a checked task.

### 5. Add execution adapters separately

Draft generation is local preparation. A mailto link opens the user's mail client; it is not a send operation. A real mail/ticket adapter should receive the reviewed payload and an explicit submission action, return a real receipt, and write that receipt as an artifact. Retries need an idempotency key. Unknown remote results remain unknown; never create a fictional request ID or mark deployment success.

Actual system adapters belong outside this public prototype. The public package should expose generic preparation/receipt contracts and fictional fixtures.

## Acceptance criteria for a reusable compiler

1. Every reference resolves to a declared input/output or a visible contextual question; no hard-coded task-title matching.
2. Every derived action links back to its source instruction and version, with a reviewable diff when the source changes.
3. The same recipe runs against at least two structurally different journeys.
4. App/account/environment changes cannot reuse facts from a different scope.
5. Missing, stale, conflicting, or unverified evidence cannot be silently rendered as confirmed.
6. Copy/open-preview actions cannot change task completion or artifact counts.
7. External submission requires the reviewed payload; only a real returned receipt becomes a request artifact.
