# UIPros source adaptations

This prototype vendors local UIPros components, rather than importing the existing Atlas UI equivalents.

| Local module                               | UIPros source                                        |
| ------------------------------------------ | ---------------------------------------------------- |
| button, input, input-group, sheet, tooltip | reui-templates/atlas-admin/components/ui/            |
| accordion                                  | react-preview/src/uipros/shadcn/accordion.tsx        |
| resource-row                               | reui-blocks/blocks/form-8/components/api-key-row.tsx |

Adaptations: relative imports, Tabler icon equivalents, Atlas semantic overlay token, Blueprint geometry in the consuming stylesheet. ResourceRow retains the block's name/value grouping, read-only InputGroup, trailing copy action and tooltip; key rotation/revocation and secret-reveal behavior were removed because onboarding artifacts are references, not credentials. The input-group textarea dependency remains the existing Atlas primitive; this prototype does not render textareas.

UIPros components themselves use Base UI. The requested source distinction is preserved by these local copies and their source comments. No runtime filesystem imports or new dependencies were introduced.

Additional source components:
- `table.tsx`: `reui-templates/verve-crm/components/ui/table.tsx`.
- `alert.tsx`: `reui-templates/atlas-admin/components/reui/alert.tsx`.
- The phase TOC uses the vendored UIPros Accordion and Button. Prose, lists and inline links use semantic HTML matching the JSON block kinds. Tables use UIPros Table inside Accordion; source callouts use UIPros Alert with static note semantics.
- The original JSON image filename has no corresponding image asset in this repository. The renderer shows its caption with an unavailable state.
- `field.tsx`, `label.tsx`, and `separator.tsx`: `reui-templates/atlas-admin/components/ui/`. The application-code form uses Field, FieldLabel, Input and FieldError together.
- Input error feedback adapts the `[0, -x, x, -x, 0]` transform sequence from `motion-ui/motion-ui/multi-state-button/index.tsx` to the Web Animations API. It replays on invalid submission, cancels earlier feedback, and respects reduced motion; this is an adaptation, not an animation built into the source Input.

Motion integration (using the existing `motion/react` dependency):
- `motion-ui/motion-ui/copy-button/index.tsx`: keyed icon crossfade, press feedback, timed reset. Clipboard failures still report an error rather than showing success.
- `motion-ui/motion-ui/multi-state-button/index.tsx`: keyed completion label/icon feedback. A 220ms local confirmation precedes navigation; navigation/reset cancels a pending confirmation.
- `motion-ui/motion-ui/smooth-tabs/index.tsx`: shared-layout selection background and directional content transition, adapted to task navigation rather than tab semantics.
- `motion-ui/motion-ui/accordion/index.tsx`: height disclosure and rotating indicator, with the existing Base UI state/ARIA ownership and scoped CSS transitions.
- `motion-ui/motion-ui/arrow-link/index.tsx`: small arrow movement on hover and keyboard focus.
All motion is scoped to onboarding and honors reduced-motion preferences. Timing and color are adapted to Atlas; no theme provider or source demo shell is copied.

- `progress.tsx`: adapts `motion-ui/motion-ui/progress-bar/index.tsx` to completed-task counts and progressbar semantics.
- `resource-search.ts`: adapts the pure fuzzy matcher from `motion-ui/motion-ui/command-palette/index.tsx`; resource rows preserve their native link/button behavior for keyboard navigation.
- The source-declared ECS account field reveal adapts `motion-examples/react/clerk-conditional-field/index.tsx` to the existing UIPros Field composition. No Clerk logic or arbitrary input constraints are included.
- Resource details adapt the real-button, controlled open state and staged content reveal from `motion-ui/motion-ui/expand-card/index.tsx`. The expansion stays inline in the existing Sheet using UIPros Accordion; no second dialog or scrim is introduced. Displayed values, application, phase and source task come from current prototype state and the JSON task mapping.

- Completion Undo uses the Sonner action pattern from `reui-blocks/components/c-sonner/c-sonner-6.tsx`, through the existing app toast host. It reverses only the local completion marker and returns to its task; entered values remain. The latest completion notification replaces the previous one and is dismissed on demo reset/unmount.
- Resource search recovery adapts the action-bearing empty state from `reui-blocks/blocks/empty-state-2/components/empty-state.tsx`: Clear search restores the full list and keyboard focus without closing the Sheet.
- The next-unfinished shortcut reuses UIPros Button and derives its destination from actual completion state, including when browsing future tasks.

- `image-preview.tsx`: adapts `reui-templates/atlas-admin/components/ui/dialog.tsx` popup/portal/close composition and `motion-examples/react/carousel-lightbox/index.tsx` thumbnail-to-lightbox interaction. A single generated fictional image replaces the source image placeholder; no carousel dependency is needed. Base UI handles focus, Escape and modal semantics.
- Sidebar transitions adapt the coordinated width/layout-gap transitions from `reui-templates/atlas-admin/components/ui/sidebar.tsx`, retaining Atlas 224px/64px widths. Expanded content stays 224px wide while its container animates, avoiding text reflow.
- Button content uses the keyed text/icon crossfade from Motion UI `multi-state-button`, and only the arrow moves on hover as in `arrow-link`. Completion uses existing `--color-success` / `--color-success-foreground`, with 280ms color transitions and an 850ms confirmation interval. This supersedes the earlier 220ms timing.
- Task switching now follows Smooth Tabs' shared grid cell with `AnimatePresence mode="sync"` and directional variants: 420ms enter/height, 210ms exit, matching easing. Phase context lives inside the same keyed panel. A layout measurement precedes paint; ResizeObserver also tracks disclosures and images. This supersedes the earlier popLayout task transition.

Emil skill pass: see `docs/design/onboarding-new/motion-review.md` for the precise source revision, before/after review, accepted timing exceptions, and final read-only opportunity scan. UIPros components remain the structural source; motion curves and interruption behavior are adapted to the reviewed standards.

Current task-transition override: the vertical TOC is not a horizontal tab strip. The shared-grid sync crossfade remains, but task-panel transforms and direction state have been removed. Entry is 250ms opacity, exit 150ms; dynamic height retains its separate 420ms accommodation. This supersedes the earlier directional task descriptions.

## Current source-directed motion (2026-09-08)

These entries supersede the earlier motion descriptions above.

- Accordion choreography comes from `plus/dev/react-env/src/app/tests/[slug]/components/Accordion.tsx`: 300ms height, 200ms opacity, independent content blur. The user-approved blur is 2px; sidebar triggers retain chevrons and reference-table triggers use plus/minus. Base UI owns state/ARIA; panels remain mounted and closed contents are inert so reverse animation can finish.
- Task switching follows `motion-examples/react/base-tabs/index.tsx`: `AnimatePresence mode="wait"`, opacity and 5px blur, 150ms exit, no directional displacement. Measurement attaches to the incoming panel after mount, including subsequent disclosures.
- Copy icons follow `motion-examples/react/copy-button/index.tsx`: blur swap and spring-drawn check, following successful clipboard writes. Compact resource controls retain icon-only labels/tooltips.
- `arrow-nudge.tsx` adapts `motion-ui/motion-ui/arrow-link/index.tsx`: only the trailing arrow travels, with a spring return and reduced-motion fallback.
- `resource-arrival.tsx` adapts `motion-ui/motion-ui/add-to-basket/index.tsx`: measured curved flight, shrink into the target, recoil and ripple. A visible 32px resource marker flies during completion feedback, before task navigation; canceled navigation stops the flight.
- `confetti.tsx` adapts the precomputed transform/opacity particle tracks from `motion-ui/motion-ui/confetti/index.tsx`. Only a completion event that completes the whole journey fires a burst; initial load and revisiting the final task do not. Reduced motion suppresses it.
- `image-preview.tsx` adapts the shared-element continuity from `motion-examples/react/animate-view-app-store/index.tsx` using installed Motion layout IDs. Base UI retains dialog focus/close semantics, with deferred unmount for the return transition; no motion-plus package is added.
- Resource search remains an inline Sheet filter. The command-palette reference belongs to the global Cmd+K surface, not to this resource search.

Global Cmd+K now adapts `motion-ui/motion-ui/command-palette/index.tsx` in `portal/src/components/ask/ask-overlay.tsx`, `ask-overlay.css`, and `ask-atlas-search.tsx`. Base UI handles portal lifetime with CSS entry/exit transitions; Motion handles the shared selection background and surviving group positions. Existing global search data and destinations remain. `AskAtlasProvider` records the invoking element for focus restoration, and the onboarding route reuses this global host.

### Image continuity and completion follow-up

The App Store reference's continuous visual identity is implemented with one persistent portal image, measured thumbnail bounds and a spring transform (visualDuration 0.38, bounce 0.06). This replaces nested frame/image layout IDs to keep the returning image above the backdrop. Motion Plus is not imported.

Completion follows `motion-ui/motion-ui/multi-state-button/index.tsx`: opacity/blur crossfade, semantic color interpolation and fixed width (`widthMorph=false` equivalent). The approved arrow-only hover remains; no whole-button pop is added.

### Resource sheet timing

Reference: `motion-ui/motion-ui/sheet/index.tsx` and `motion-ui/ui-theme/index.ts`. The source uses `gentle` for large surfaces, default duration 0.5 seconds. Both right-sheet directions and workspace action layout now use 500ms; Base UI still owns presence, dismissal and focus. The resource trigger receives its own position projection because its right-aligned position changes when its parent width changes.

- `tabs.tsx`: `motion-examples/react/base-tabs/index.tsx`. Uses Base UI Root/List/Tab with a shared-layout underline and keyed opacity/blur panel transitions. Adds Base UI Panel semantics and preserves the exiting panel until AnimatePresence finishes; inactive panels remain inert. Blur is reduced to 2px for Atlas, and reduced-motion preferences are respected.
- Environment selections reuse the shared `layoutId` pill choreography from `motion-ui/motion-ui/segmented-toggle/index.tsx`. Each field has its own indicator identity; access cards use stationary opacity highlights and checks crossfade in a reserved slot, and keyboard activation retains motion unless the user requests reduced motion.

### ECS architecture and file preview

- `scaffold-preview.tsx` composes the existing UIPros Base Tabs, Accordion and Button adapters. Tab panels retain the same separate enter/exit timing and reduced-motion behavior.
- Architecture uses the project's existing AWS icon dependency and a scoped SVG topology. The file browser follows the selected design reference; its generated examples are public-safe prototype data, not a repository diff.

- Latest architecture layout references `/Users/ziyu/.agents/skills/archify/SKILL.md` and the user-selected conversation “React生成AWS架构图方案”: AWS icons, light group boundaries, primary traffic flow and collapsed supporting resources. The SVG is a local React composition, not an imported UIPros graph component. Environment/access selectors were removed in favor of fixed defaults; build methods retain the existing Accordion/Button adapters.

### Nested ECS journey

The child journey reuses the onboarding task-list selected-row projection, completion crossfade and collapsed rail. Review retains UIPros Base Tabs; setup details use the existing UIPros Accordion/Input/Button adapters. Stage transitions use restrained opacity/2px blur in Motion. Domain-specific PR outcomes and pipeline handoff panels are local composition, not imported UIPros blocks.

### ECS stack execution

The preview and execution graph share a Motion layout identity. The execution view keeps that graph mounted across simulated GitHub, Harness, TFE plan/apply and deployment checks. Existing onboarding disclosure, button and file-preview adapters remain in use. Phase state drives node availability and creation feedback; reduced motion removes spatial transitions and repeating effects. This is a local simulation, not a live integration.
