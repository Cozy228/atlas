# Authoring Atlas Guidance from a process document

> **Who this is for.** An AI agent (or a human steward) turning an existing process
> document — a runbook, onboarding wiki page, "how to request X" note — into a
> platform-creatable Atlas Guidance manifest. The output is a `data/guidance/*.yaml`
> file that validates against `@atlas/schema` `GuidanceSchema` and passes
> `pnpm validate:guidance`.
>
> This file **is the few-shot example.** Read the worked transform in §4, then follow
> the same shape. The two committed samples
> ([`new-app-onboarding.yaml`](../../data/guidance/new-app-onboarding.yaml),
> [`landing-zone-selection.yaml`](../../data/guidance/landing-zone-selection.yaml))
> are your reference outputs.

## 1 · What Guidance is — and is not

Guidance is **wayfinding**, not workflow. It tells a user *what to do, where to go, and
when they're done*. It never executes work. See
[`guidance_design.md`](./guidance_design.md) for the full model and
[ADR-0003](../adr/0003-evidence-vs-live-status-split.md) for the evidence-vs-execution
split.

Shape: `Guidance → steps → tasks`, rendered as a vertical stepper.

- **Guidance** — one route for one scenario, ending at a destination.
- **Step** — a stop in the stepper (`kind: action | decision | checklist | support | destination`).
- **Task** — a thing the user does at a step, optionally with one **action** (a link/copy).

The last step **must** be `kind: destination` (the schema enforces it).

## 2 · The transform, in five moves

When you read a process document, extract:

1. **Objective + destination.** What is the reader trying to achieve, and what is the
   end state? → `objective`, `destination`.
2. **Ordered steps.** Headings / numbered sections usually map 1:1 to steps. Pick a
   `kind` per step (most are `action`; a "choose between" section is `decision`; a
   "before you go live" section is `checklist`).
3. **Tasks under each step.** Bullet actions become tasks. Mark hard requirements
   `required: true`.
4. **Actions.** Every link, form, console, or copyable snippet becomes a task `action`.
   Choose the `type` (see §3) and a **wayfinding label** (see §3.1).
5. **Sources + owner.** Which registered Source backs this step (`sources:` = source
   registry ids)? Who owns the route (`owner.team`, `owner.support`)?

Leave unknowns out rather than inventing them. A field you cannot ground in the document
or the registry should be omitted (most are optional) — do **not** fabricate URLs, team
names, or source ids.

## 3 · Action types

| `type`          | Use for                                   | Field carrying the target |
| --------------- | ----------------------------------------- | ------------------------- |
| `atlas_page`    | An Atlas route (e.g. `/catalog`)          | `target` (path)           |
| `external_link` | A form, wiki page, or external app        | `target` (url)            |
| `tool_link`     | A platform tool (TFE, Harness, …)         | `target` (url)            |
| `source_link`   | A registered Source's evidence            | `ref` (source id)         |
| `support_link`  | A support channel                         | `target` (url)            |
| `copy_text`     | A snippet the user pastes                 | `text` (payload)          |

### 3.1 · Action-label governance

Labels must not imply Atlas did the work. Use **Open / View / Copy / Contact**. Avoid
**Submit / Run / Apply / Provision / Deploy** for external systems — the validator emits
a **warning** (not a hard failure) when a label starts with or contains an execution
verb, so a reviewer can confirm the wording. Example: write *"Open request form"*, not
*"Submit access request"* — Atlas opens the form; the user submits it.

## 4 · Worked example (the few-shot)

### 4.1 · Input — a process document (fictional, public-safe)

```text
# Onboarding a new application to the standard cloud platform

Goal: get a new workload ready for standard cloud deployment.

1. Choose a landing zone.
   Review the available landing zones and pick the one that matches your data
   classification and compliance needs. The landing zone you pick sets the
   guardrails, networking, and IAM boundary your app inherits. (See the Central
   Landing Zone page.) You must confirm your choice before continuing.

2. Request access.
   Open the access request form for your landing zone and submit it. Access is
   granted through the approved request flow — it is not automatic.

3. Provision infrastructure with Terraform Enterprise.
   Open the standard TFE workspace and use the approved module. (Module ref:
   app.terraform.io/example/standard/aws.) Provisioning goes through IaC, not the
   console. See the Lambda module README.

4. Connect a deployment pipeline.
   Open the Harness setup guide and connect the standard deployment path.

5. Production readiness.
   Before going live, confirm: logging and monitoring enabled; required resource
   tags applied; IAM role pattern reviewed; support owner confirmed. These are
   verified outside the portal.
```

### 4.2 · Output — the guidance manifest

The five numbered sections become five `action`/`decision`/`checklist` steps plus a
terminal `destination`. See the full result in
[`new-app-onboarding.yaml`](../../data/guidance/new-app-onboarding.yaml). Note the
transform decisions:

- Section 1 ("pick the one that matches…") → `kind: decision`-flavoured first step; the
  document's *"you must confirm"* → a `required: true` task.
- *"Open the access request form **and submit it**"* → action label **"Open request
  form"** (not "Submit"), because Atlas opens, the user submits — see §3.1.
- The module ref snippet → a `copy_text` action.
- *"See the Central Landing Zone page" / "Lambda module README"* → `sources:` entries
  (`central-lz-confluence`, `lambda-module-readme`) — these must be **existing source
  registry ids**, not new ones.
- Section 5's four "confirm:" bullets → a `checklist` step with four `required` tasks.

## 5 · Public-safe & grounding rules

This repository is public (see `CLAUDE.md`). When authoring:

- **Fictional data only** — fictional team names, `example.internal` URLs, generic
  sample snippets. Never paste real internal URLs, page ids, channel names, or policy
  text from a source document.
- **Ground source ids in the registry** — `sources:` and `source_link.ref` must point at
  ids that already exist; if the backing source isn't registered yet, omit the reference
  and file a `Feedback(missing)` instead of inventing one.
- **Draft, then review** — AI output enters as `status: draft`; an owner reviews and
  promotes to `published`. See
  [ADR-0007](../adr/0007-runtime-object-ingestion-seam.md) for the ingestion seam.

## 6 · Validate before you commit

```bash
pnpm validate:guidance        # schema + governance checks over data/guidance/*.yaml
```

Errors (schema violations, duplicate ids, missing destination) block import. Warnings
(execution-verb labels) are surfaced for review, not fatal.
