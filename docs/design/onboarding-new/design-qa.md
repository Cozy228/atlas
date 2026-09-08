# Onboarding prototype QA

final result: passed

Scope: the new onboarding prototype's primary desktop interaction and visual review. This is not a full Blueprint compliance certificate or a production integration test.

## Accepted design

The selected first-entry and TOC concepts were refined by the user during implementation: restore the Blueprint grid and frame; use actual UIPros source; put resources in the content area's upper-right corner; tighten resource rows; cap the task frame at 896px and forms at 640px; center the frame in the available workspace and reserve space for the resource sheet.

The source concept and implementation were viewed together for comparison. Typography, spacing, semantic colors, visible copy and controls were checked. No raster assets are used in the application. Differences from the original concept are intentional user-directed changes, including the coordinate grid, frame corners, compact resources and relocated trigger.

## Evidence

- `workspace.png`: 1440 × 1024, expanded TOC, owner task, resources closed. Final task frame x=384, y=256, width=896, height=480. Its boundaries coincide with the 32px lattice.
- `rail.png`: six-phase collapsed navigation and centered owner task.
- `resources.png`: resource sheet open; the task frame shifts left. Measured task right=928 and sheet left=960 at 1440px, leaving 32px between them.
- Narrow widths 320, 375, 414 and 768 were checked for horizontal overflow. Desktop widths 1280, 1440, 1599 and 1601 were also checked. The task frame had quantized dimensions, with no horizontal document overflow. These targeted measurements do not cover every possible task and expanded-state combination.

## Interaction verification

Passed through the real browser UI:

- Blank first-step submission shows a field error.
- First successful task reveals the progress sidebar.
- Sidebar collapses to six phase marks; selecting a mark opens its phase without changing the current task.
- One phase expands at a time. Future tasks cannot be executed before prerequisites.
- Inputs and sidebar preference survive reload and task navigation.
- All 30 sample tasks were completed through visible controls.
- Completed tasks remain available for review.
- Owner help expands and collapses.
- Resource records appear after the corresponding task is completed.
- Resource search returns matching rows and a useful empty result.
- Copying the application record produced APP-4821 in the browser clipboard.
- Sheet close restores focus to its trigger.

Read-only review identified and fixed skip-link focus, heading focus visibility, invalid select association and stale copied-state reset.

## Automated checks

- Portal typecheck: passed.
- Workspace lint: passed.
- Workspace tests: passed before the final local test addition. Final Portal tests: 51 files, 255 tests passed, including 7 new progress-storage checks.
- Client build: passed.
- `git diff --check`: passed.
- Repository `pnpm run audit:grid`: **failed, 7883/8140**. That script targets the existing `docs/design/atlas-design-system-enriched.html`, not this React route. The existing HTML was already modified before this task and was not changed here. Its failure remains unresolved; the repository-wide gate must not be reported green.

## Prototype limits

All requests, deployments, accounts and links are fictional. No remote operations are submitted. Progress is stored only on this browser/device. Sample links point to example.com. Request approval polling and real infrastructure provisioning are outside this prototype.

## Source-data and placement revision

- Task content now maps all 19 actionable steps in the root `onboarding.json`, including its referenced ECS journey, into six phases with five tasks each. The source file is imported directly for detailed instructions and reference links; concise task labels split compound source steps.
- Progress uses a new storage key so earlier sample fields cannot be interpreted as application codes or request numbers.
- The first field is the approved application code. Resources contain the entered values and source links; completion records user confirmation, not externally verified provisioning or deployment.
- Setup resources is positioned at the workspace top right, 16px below the 64px topbar. The task frame remains horizontally centered and moves up by 64px relative to the previous centering formula, with a 96px minimum workspace offset.
- Opening resources in a window below 1200px temporarily collapses the progress sidebar. Closing restores the previous expanded state.
- Portal typecheck, workspace lint, 256 Portal tests, client build and diff whitespace checks pass. The existing static HTML grid audit remains 7883/8140; it is not a route-specific pass.
- The earlier screenshots and geometry file document the prior layout revision. Current browser verification confirmed the source-based first task, sidebar transition, entered request artifact and resource panel.

## Structured JSON rendering and navigation revision

This revision supersedes the prior 30-task adaptation: six phases contain the 19 actionable source steps plus the declared application-code input. Source titles and blocks are rendered directly, including ordered/unordered lists, inline external/email links, UIPros callouts and UIPros tables inside Accordion. Invented request-number fields have been removed. The source image has no supplied asset, so its caption is shown with an unavailable state.

Phase headers now use UIPros Accordion and task links use UIPros Button. All phases and tasks can be viewed without completing preceding tasks. Completion is stored as a set of task indices; a jump and subsequent completion cannot mark intervening tasks done. Regression tests cover future-task restore and independent completion.

Runtime checks confirmed phase/task navigation with the completion count unchanged, source table headers and three rows, and the opening animation. Sidebar task lines use 20px line height, 4px gaps, and first-line-aligned status marks. The collapsed rail has transparent button backgrounds and the same computed Atlas background as the page. Typecheck, lint, 256 Portal tests and client build pass; the existing static HTML grid audit remains 7883/8140.

### Useful recovery actions — 2026-09-08

- Added UIPros Sonner action adaptation: completing a new task offers Undo for 8 seconds. Undo removes only that task's local completion marker, preserves field drafts, and returns to the task. Demo reset/unmount dismisses the notification.
- Added next-unfinished navigation when browsing any other task, including future phases. Destination is derived from the completion set.
- Added Clear search to the resource no-results state; it restores all resources and focuses the search input.
- Runtime at 1280 × 720: completion count 3 → 4 → Undo → 3; source heading restored. Searching an unmatched query showed the recovery button; clearing returned 3 resources and searchbox focus. Browsing Terraform and returning to the next unfinished task preserved count 3. Browser error log empty.
- Portal typecheck, workspace lint, and 259 Portal tests pass. Grid audit remains 7883/8140 FAIL against the pre-existing static design document, not this React route. Character counting was intentionally not added.

### Content, state and motion refinement — 2026-09-08

- Kept the outer card at 896px maximum and removed the inner form's separate 640px cap. At 1280px, runtime measured card 896px and inner form 832px (32px padding per side).
- Task body height is measured and animated without scaling text; card top stays at a stable 96px workspace offset. Sidebar width and main margins now transition together; sidebar text retains a fixed layout width.
- Resource details indent 16px from the parent resource; details divider and source action share that inset.
- Generated a fictional application-code illustration, stored under `portal/public/prototype/onboarding/`; verified natural width 1536, successful lightbox opening, and Escape close.
- Required-input indicators derive from JSON journey inputs plus local field/completion state. They remain advisory and do not certify external approvals or block completion. Unit coverage checks rollback and nonblocking completion.
- App-code placeholders are rendered from the saved value; escaped quote artifacts are cleaned. Runtime TFE table showed `SSO_TFE_PROD_APP1_PRJ_VIEWER`; prose displayed ordinary quotes. Unrelated placeholders remain intact. Normal persistence copy removed.
- Generic action labels use source task titles; duplicate capability links already present in source content are omitted from the footer.
- JSON now ends with a summary/support step, rendered as the last task. It shows actual setup-task completion and resource counts plus example support/docs links.
- Completion feedback uses only arrow movement on hover, existing success/background foreground tokens, keyed content crossfade, and an 850ms confirmation interval before navigation.

### Unified task transition

- Phase context, heading and body now switch together in one keyed grid panel, adapting UIPros Smooth Tabs' sync-mode directional crossfade.
- Entry and height share 420ms timing; exit uses 210ms. Completion's 850ms confirmation remains separate and precedes this transition.
- Runtime: switching group mapping to Harness settled from 932px to 676px, with exactly one task body and matching 676px animated viewport. No intermediate unmount-to-empty phase is used.

### Emil skill pass

The latest motion contract and final opportunity scan are in `motion-review.md`. This supersedes the width/margin sidebar transition and accordion keyframe descriptions above. Runtime resource Sheet measured card right 768px and Sheet left 800px. A task body measured 796px inside its 800px target viewport, preserving final 32px grid rounding without per-frame stepping. Keyboard navigation set the Sheet to zero-duration transitions.

### Non-directional task changes

Removed horizontal task travel and unused direction state. Sidebar task selection and Continue now use the same opacity-only panel swap (250ms entry / 150ms exit). Runtime AWS request → connector panel reported `transform: none`. Completion feedback and continuous height accommodation remain.

### Completion feedback and disclosure height coordination

The final completion icon/label now enters with 200ms opacity + scale .97 to 1, using existing success-ink. Reduced motion keeps opacity only; keyboard is immediate. This implements the final opportunity scan's single retained suggestion.

Task navigation retains 420ms height accommodation, but same-task disclosure ResizeObserver updates follow the disclosure's own geometry directly, then gently round the final target after it settles. Timers/observer are cleaned up when switching tasks. Runtime TFE table expansion: body 788px, viewport 800px, card 864px; closed: body 568px, viewport 576px. Task panel transform remained none and only one panel remained after settling. Runtime error log empty.

## Artifacts and recorded outputs

- `onboarding.json` defines output artifacts per source task. Task capability links remain instructions and are no longer treated as created outputs.
- Completed tasks collect application/account values, SailPoint group bundles, requests/tickets, system onboarding records, repositories, pipelines and deployment details.
- Group templates resolve using the entered application code. Missing request IDs, statuses, system identifiers and URLs are editable, persisted with progress and remain blank until recorded.
- AWS account artifact edits share the existing account input state. Request URLs point to recorded request details, never automatically to request-creation forms. Non-HTTP URLs are not rendered as links.
- Expanded details are inset 16px. Field copy actions use their own value and feedback key. Link labels and anchors have the same 24px height/top.
- Runtime: recorded a fictional request ID, URL and status, reloaded, and verified restored values and the exact href. Tests cover JSON outputs, groups, missing request values, URL validation and shared account state (22 onboarding tests).
