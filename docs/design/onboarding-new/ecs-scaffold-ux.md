## 本轮原型：先确认结果，再按需看文件

默认预览面向 bootstrap 使用者，展示服务、环境、访问范围、目标仓库，以及基础设施和应用两个 PR 各自会创建什么。文件列表和生成内容收进可展开区域，不要求逐文件阅读。

配置优先使用 onboarding 已保存的应用与账号，以及前序任务记录的产出；可推导的命名标注为建议值，模板默认值标注来源。缺失项需要补充，不能把示例数据描述成 API 已查询结果。修改配置后重新生成预览。

当前实现入口为 ECS 的 Generate the service stack 任务，配置、预览、模拟 PR 结果共享现有内容卡片。模拟结果不写入真实 Artifacts；实际产出仍由对应任务记录。真实 API、仓库写入，以及完整独立运行入口属于后续接入。

# ECS scaffold: standalone and embedded journey

Status: UX proposal grounded in the existing Atlas prototype and official product documentation. The scaffold UI and real PR creation are not implemented by this document. The current ECS source remains a complete five-task journey; onboarding summary has been separated into its own final step.

## Product outcome

A developer can use the ECS journey by itself or start it from application onboarding. The journey reuses known context, asks for service-specific decisions, prepares reviewable repository changes, creates the corresponding pull requests, and keeps the deployment/verification handoff visible. Creating a PR is the primary milestone. It is not evidence that code has merged, infrastructure exists, or the service is healthy.

Keep one journey definition and one run identity. Embedded and standalone views are presentations of that same instance, not copies of its progress. Returning to onboarding must not restart the ECS work.

## Source observations

Backstage templates declare frontend form steps, backend execution steps, and saved output links separately. Its template editor can expose generated files and logs during dry runs. Dry-run support must be implemented by the action; it is not automatically a complete, end-user PR diff or a production Terraform plan. Atlas should borrow the explicit input/execution/output separation, and deliberately add a change-review experience. [Writing Templates](https://backstage.io/docs/features/software-templates/writing-templates/), [Dry Run Testing](https://backstage.io/docs/features/software-templates/dry-run-testing/).

The dedicated Backstage GitHub PR action accepts branch/draft/reviewer information and produces PR references. Do not conflate the repository publishing action with this PR-specific action. [GitHub PR action](https://backstage.io/api/next/functions/_backstage_plugin-scaffolder-backend-module-github.createPublishGithubPullRequestAction.html).

Port makes action run status, inputs, logs and resulting links accessible together, including re-running with the same inputs. Its scaffold example separates opening a PR from deployment after merge. This is a useful handoff model, not evidence that Port inherently presents a generated-file diff in its action form. [Action runs](https://docs.port.io/workflows/actions-and-automations/reflect-action-progress/), [Scaffold example](https://docs.port.io/guides/all/scaffold-a-new-service/).

Humanitec distinguishes a draft delta, reviewing changes, and deploying them. The transferable idea is to separate proposed changes from observed deployment state. Its GitOps workflow should not be presented as a ready-made ECS PR approval interface. [Deployments](https://developer.humanitec.com/platform-orchestrator/docs/platform-orchestrator/working-with/deployments/).

## Layout recommendation

Use the existing Atlas onboarding shell: compact top bar, one collapsible left TOC, centered content that follows the outer card width, bottom-right action, and an Artifacts entry below the top bar at the upper right. Keep Blueprint tokens and the local UIPros adaptations. Do not introduce another horizontal stepper, nested sheet wizard, large introduction card, or second sidebar.

### Embedded, recommended default

The parent TOC keeps earlier onboarding phases collapsed. The ECS section expands into its own steps, with a short title such as Launch ECS service. Summary & support is the final onboarding phase and uses the same accordion and task rows as the other phases. The main content uses the same task surface as the rest of onboarding. A compact context line identifies the service/account/environment; inherited values appear in a collapsed input-source section rather than another full form.

There is no required route transition. A contextual Open full journey link can switch to the standalone presentation when the user needs focus or wants a shareable URL. It opens the same run and current step. Returning to onboarding restores the same step, edits, artifact sheet state and scroll anchor where appropriate.

### Standalone

The same left TOC contains only the ECS steps. The first step asks for missing application/account/environment context; when the caller supplies it, show the resolved values and only request additional service decisions. Keep the same card geometry and controls. Standalone must work without completing application onboarding, provided the required inputs are supplied or selected from existing resources.

### Focused child view, alternative

If parent navigation makes the work feel crowded, entering ECS can replace the left TOC with the ECS-only TOC and show Back to onboarding in the breadcrumb. The content does not move, resize, or gain a new shell. This is preferable to putting the whole child journey inside a sheet. It is an alternative presentation of the same instance, not another flow to implement independently.

## Steps and current-source mapping

A dedicated review/PR step makes six proposed steps while retaining all five existing ECS responsibilities.

| Step | User decision and primary content | Existing source | Primary action / output |
| --- | --- | --- | --- |
| 1. Service & repositories | Service identity; create or reuse the distinct infrastructure and application repositories; target project; inherited app/account context | `service-repos` | Continue; resolved repository/project destinations |
| 2. Stack & environment | Environment, region, cluster/service/ECR identity, connector and task-definition path; existing values reused | `generate-stack` | Continue; stack inputs and intended resource relationships |
| 3. Infrastructure pipeline | IaC repository/workspace, relevant module inputs, pipeline definition and execution prerequisites | `infra-pipeline` | Continue; proposed infrastructure/pipeline changes |
| 4. Application delivery | Container image, ports/resources, role references, logging and delivery configuration | `app-deploy-pipeline` | Preview changes; proposed application/delivery changes |
| 5. Review & pull requests | Repository/branch scope, actual generated files, diff, PR metadata, unresolved placeholders and validation findings | New review boundary across steps 1–4 | Create pull request(s); real PR receipts |
| 6. Deploy & verify | Follow merge/check/run links; record or observe deployment outcome and service endpoint | `dev-deploy-success` | Record verification; endpoint and evidence |

These are product responsibilities, not necessarily one backend action each. If an existing source step truly needs an external prerequisite to execute before later steps can be prepared, represent that dependency and its outputs explicitly. Do not fake a single transaction across unrelated systems or rewrite every source procedure into a PR operation.

The top-level onboarding Summary & support is outside this journey. ECS step 6 can show its own result and next action, but it must not absorb the application-wide summary.

## The PR review surface

Start with a readable change summary, not raw code:

- Destination: target repositories, base branches, and proposed branches.
- Scope: what will be created or modified and which account/environment it targets.
- Changes: grouped by repository, with an actual changed-file list and a selected file diff.
- PR details: editable title and description, explicit draft/ready state, reviewers if supported.
- Unresolved items: precise fields/placeholders and a link back to their input source.

Use Summary and Files as two representations of the same proposed changes. They can be local tabs with the existing opacity transition; they are not journey steps. The file list stays inside the content card, so it does not become a second global TOC. A large topology diagram is optional detail, not the first thing the user must interpret.

The action should name the real operation: Create pull request or Create 2 pull requests. Two repositories cannot produce one cross-repository PR. New repository bootstrapping and reusable existing repositories need explicit destination handling; do not silently push generated application changes to a default branch just to make a PR possible.

Preview generation should not publish. Pin the preview to the input revision, template revision and base commit. If inputs or the base change, the UI says the preview needs refreshing before publishing the revised change. A preview is a generated-file diff; call it a Terraform plan only when an actual plan has run and its evidence is available.

Missing information should not prevent drafting. Use clearly labeled replacement fields, as in the intelligence templates. For code, propose an explicit Draft PR option for unresolved content. Repository destination and authenticated permission are still needed to create any real PR. Never silently convert an unfinished proposal into a ready-to-merge claim.

## After PR creation

Keep the content card; replace its review action area with a result showing each PR's repository, number/title, branch, and Open PR action. Artifacts receives the real PR reference immediately, even while the overall journey is waiting for review. A planned output is not an artifact; a returned PR receipt is.

Show what happens next in plain language: review/merge, pipeline run, deployment verification. PR status and checks are observed integration data or explicitly unknown. User-acknowledged checklist progress must remain distinguishable from observed execution status. Retain the current ability to browse tasks and keep dependency hints advisory.

A partially successful operation must show the successful PRs and the remaining failure. Retry only the failed operation with the same run identity and idempotency boundary. Do not discard created PRs or regenerate duplicates. Start again is a separate deliberate action.

If the user changes inputs after a PR exists, retain that PR and present Update existing PR versus create a new proposal where supported. Neither navigation nor a form edit should silently rewrite a submitted change.

## Inputs and outputs

| Contract | Contents |
| --- | --- |
| Reusable context inputs | Application code, AWS account ID, environment, region, Git organization, Harness organization/project, TFE project/workspace, connector references |
| ECS-specific inputs | Service identity, repository destinations, cluster, image/ECR identity, task-definition path, container and logging configuration |
| Incremental outputs | Repository/project references, PR references, pipeline/run references, recorded service endpoint and verification evidence |
| Run identity | Journey definition/version, run ID, current step, input revision, output references, parent binding when embedded |

Each fact retains its source and application/account/environment/service scope. Embedded mode binds parent outputs into named child inputs; standalone mode resolves the same inputs from a picker or user entry. Overrides should be visible and should not silently overwrite parent facts.

The parent receives child outputs by stable IDs. It can show meaningful created artifacts before the child finishes; completion remains a separate event. The current prototype's completed-task-derived artifact list will need this incremental-output contract when real scaffolding is implemented.

## State model for the design

Separate input preparation, generation, external review and deployment evidence. A useful progression is:

Draft inputs → Preview ready → Creating PRs → PRs created / awaiting review → Merge and execution → Verification.

Failure is attached to the affected operation, with preserved outputs, rather than a single destructive global reset. Unknown external state stays unknown. A successful generator run does not automatically complete verification.

For embedded navigation, the onboarding parent can show ECS in progress or waiting for review and let the user return later. Opening the standalone link resumes the same instance. The summary shows actual outputs plus unfinished or unverified work, rather than flattening every stage to green.

## Prototype acceptance scenarios

1. Start ECS independently with no onboarding instance; provide required context and reach a reviewable proposal.
2. Enter ECS from onboarding; inherited context is visible, missing fields are the only repeated input, and the parent summary is outside ECS.
3. Switch between embedded and standalone views without losing edits or starting another run.
4. Review changes across two repositories before creating two PRs; preview has no publishing side effect.
5. Change an input after preview and see the proposal invalidated; no stale PR is created.
6. One PR succeeds and another fails; the real output remains in Artifacts and retry does not duplicate it.
7. PR creation succeeds while merge/deployment remain pending; the UI never claims deployment success.
8. Return to onboarding and later resume the same run; outputs and source bindings remain intact.
9. Follow or record verification evidence, then reach the separate application summary.

Next design slice: the Review & pull requests screen and its PR-created state, shown once in embedded navigation and once standalone. This validates the central product decision before rebuilding every input screen.
