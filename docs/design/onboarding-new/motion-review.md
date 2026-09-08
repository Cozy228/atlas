# Onboarding motion review

Scope: `/prototype/onboarding-new` and its local UIPros adaptations. Source: [Emil Kowalski skills](https://github.com/emilkowalski/skills/tree/d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7/skills). Applied `improve-animations`, `animate`, `review-animations`, then `find-animation-opportunities`. No global skill installation or unrelated route changes.

## Implemented review

| Before | After | Why |
| --- | --- | --- |
| Card height rounded every animation frame | Measured target rounds once to 32px; interpolation remains continuous | Prevents visible 32px height stepping while retaining settled Blueprint geometry |
| Sidebar width/margins transition every frame | Fixed-width sidebar content with clip-path; Motion position projection moves the content | Reduces repeated text layout and allows reversals |
| Accordion open/close keyframes, including ease-in close | Base UI measured-height and opacity transitions, 200ms `cubic-bezier(0.23,1,0.32,1)` | Reversals resume from the current height |
| Resources reveal with two nested motions | Accordion owns the disclosure | Avoids layered vertical movement |
| Motion x/y/scale shorthands; large copy-icon shrink | Full transform strings; copy starts at scale .95 | Limits main-thread animation work and avoids overemphasized feedback |
| Sheet short offset, inconsistent timing | Same-edge entry/exit; drawer curve `cubic-bezier(0.32,.72,0,1)`, 350ms enter / 250ms exit | Keeps the surface's spatial relationship legible |
| Tooltip keyframes | Trigger-origin transform/opacity transitions, 150ms, instant neighbor opening | More stable frequent hover behavior |
| Keyboard navigation shares pointer animation | Local keyboard motion preference propagated to page and portals | Focus/navigation do not wait for spatial movement |
| Both crossfading task panels remain interactive | Outgoing panel becomes inert and aria-hidden via presence state | Prevents stale controls being activated |

Task changes use a 250ms opacity entry and 150ms exit, with no directional travel. The 420ms height accommodation and 850ms completion feedback remain to support the onboarding reading flow. Main-button body remains stationary; only its arrow responds to pointer hover. Success colors remain Atlas `success` / `success-foreground`. Dynamic task height is retained as a deliberate content-disclosure exception; it is measured once per resize rather than recomputed from a rounded live frame.

## Final opportunity scan (read-only)

| # | Location | Today | Purpose | Frequency | Suggested motion |
| --- | --- | --- | --- | --- | --- |
| 1 | `page.tsx`, final `finished` branch | Final checklist-complete state uses the ordinary task surface | State indication | Once per setup | Fade the completion icon/label from opacity 0 and scale .97 to 1, 200ms `cubic-bezier(.23,1,.32,1)`; reduced motion uses opacity only, keyboard is instant. Keep metrics/support text stationary. |

Rejected candidates:
- Resource search results: every keystroke updates the list; stagger/reordering would slow scanning and keyboard use.
- Body paragraphs, tables and identifiers: people read and copy this content; decorative motion hinders the task.
- Additional button movement: conflicts with the explicit request that only the arrow move.
- Repeated sidebar item stagger: navigation is frequent; the existing surface transition already explains the change.

Verdict: existing motion is sufficient for navigation and resource inspection. The highest-value remaining opportunity is a restrained, one-time final completion cue. The one-time completion cue was implemented after the user asked to continue animation work. The independent review found no additional high-confidence opportunities in the resource/overlay components.

## Verification

Runtime checked task switching without directional transforms, settled body/viewport fit, sidebars, source table disclosure, resource details, Sheet avoiding the task card, and keyboard mode disabling portal transitions. Typecheck, lint, 264 tests, and client build pass. The existing static design-document grid audit remains 7883/8140 FAIL; it does not audit this React route.

Independent review corrections: Sheet backdrop shares keyboard instant state, cursor movement inside editable fields does not change global input modality, and accordion icons honor reduced motion. Natural-height disclosure remains the documented layout-animation exception.

### Additional state feedback — 2026-09-08

- The first completed task reveals the progress sidebar with a 250 ms opacity / 16 px entrance, coordinated with the existing content position transition. Resumed sessions do not replay this entrance.
- A newly completed resource-producing task briefly replaces the resource trigger folder with a check for 1.6 seconds. The icon crossfades in a fixed 16 px slot and uses the semantic success ink token. Repeated completion does not replay it; Undo clears it.
- Sidebar completion markers crossfade between the check and pending dot in a fixed slot, including Undo within the visible phase. Changing phases still follows the existing accordion lifecycle.
- Reduced motion removes displacement and scale; keyboard navigation uses instant feedback. Narrow desktop resource buttons hide only the label, preserving the feedback icon.
- Runtime checks: a fresh localhost session begins without a sidebar; completing the application code reveals it and advances to task 2. The existing 127.0.0.1 session completed a Terraform task and successfully undid it. Fresh-session browser error log was empty.
- Validation: workspace typecheck and lint passed; diff whitespace check passed. The existing static design-document grid audit remains 7883/8140 and does not target this React route.

### Source-directed choreography and runtime checks

The user selected the Plus test Accordion source for both expansion and collapse, with 2px blur and separate 300ms height / 200ms opacity. The always-mounted panel exposes `inert` and `aria-hidden` while closing. Runtime captured a nonzero closing height before the final zero state.

Task switching now uses Base Tabs' sequential exit/entry (`mode="wait"`) with opacity and blur; it no longer crossfades two readable panels. Incoming-panel measurement waits for actual mount. A full isolated 21-task journey completed without runtime errors.

The image preview's shared frame/image IDs were checked in both directions: an intermediate closing image rectangle was captured, then the dialog unmounted and focus returned to the thumbnail. A real copy operation returned the copied status. Resource flight was captured midair as a visible 32px marker while the old task still displayed "Marked complete"; navigation follows the landing. Resource search was confirmed to filter in place with exactly one Sheet dialog.

The final completion event produced 30 confetti particles in the isolated session. A subsequent page revisit showed zero particles. The existing user session's temporary completion was undone after resource-flight verification.

Global Cmd+K scope correction: the source command-palette choreography is applied to `ask/ask-overlay.tsx` and `ask/ask-atlas-search.tsx`, preserving the existing catalog/source queries, Fuse matching, route destinations and AI bridge. The overlay has a single entrance and shorter exit; grouped results share a moving selection background. Keyboard order follows rendered group order, active rows scroll into view, and focus returns to the invoking element. The focused onboarding route mounts the same global host without adding portal chrome. Runtime checks covered S3 search and Enter navigation to `/service/aws/s3`, Cmd+K from onboarding, and Escape returning to the resource Sheet's search input.

Final opportunity scan (read-only): no additional motion proposed. Search-result counts, no-match recovery, source prose and inline identifiers remain static; animating them would hinder repeated search or reading. The explicitly requested completion celebration and resource flight already cover the rare milestones. No additional list stagger or button-body movement was introduced.

## Follow-up: scroll continuity and task actions

- Task card starts at document Y=96, 64px above its previous position.
- View all tasks opens the existing left navigation; selecting tasks keeps that navigation mounted. Resources remain a right sheet.
- Short task forms stretch within the card; all task actions align to the lower right, including long tasks.
- Layout projection responds only to sidebar/resource layout changes, not disclosure height updates. Browser scroll anchoring is disabled while this route is mounted. A 60-frame capture of the expanded Harness table collapsing at the page bottom showed monotonically decreasing scroll offsets, with no reverse jump.
- Image expansion follows the UIPros App Store continuity principle using one portal image and a measured thumbnail transform. The image remains above the backdrop throughout return, then restores the thumbnail. A 65-frame return capture found zero missing-image frames. Base UI owns dismissal, focus and modality.
- Completion uses UIPros multi-state-button opacity/blur crossfade in a fixed grid slot, semantic success color interpolation and a drawn check. No button translation or label slide.
- Verification: onboarding tests 16/16 and lint pass. Workspace `pnpm tsc` passes; explicit portal typecheck, full test suite and client build are blocked by unresolved pre-existing workspace packages including `@atlas/schema`. Static document grid audit remains failed (7883/8140); it does not measure this route.

## Follow-up: unified navigation and resource sheet

- Card top is now Y=128: a 32px upward adjustment from the original Y=160.
- Navigation is persisted as one `hidden | expanded | collapsed` state in progress. View all tasks reveals it; task selection, completion and returning to task zero retain it. Reset alone restores hidden. Legacy saved `collapsed` values migrate without losing task progress.
- UIPros `motion-ui/motion-ui/sheet/index.tsx` uses the shared `gentle` transition; its default theme duration is 0.5 seconds. This right sheet uses 500ms for both directions, with the existing drawer curve. Workspace actions and content layout use the same duration and curve.
- Browser verification: view all → reload → select another task → return to first → reload retains expanded navigation. Collapse → reload retains the compact rail. Card top measured 128px. Resource button traversed 33 distinct horizontal positions in both opening and closing captures, and the sheet remained mounted through its exit.
