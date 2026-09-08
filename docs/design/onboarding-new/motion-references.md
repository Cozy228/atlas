# Onboarding motion references

## Implemented

The local UIPros Motion UI implementations below supplied the interaction patterns. The onboarding adapters use Atlas geometry and semantic colors, the existing Motion dependency, and reduced-motion preferences.

| UIPros source under `/Users/ziyu/UIPros/motion-ui/motion-ui/` | Onboarding behavior |
| --- | --- |
| `copy-button/index.tsx` | Icon confirmation, press feedback, 1600ms reset; clipboard failure stays an error |
| `multi-state-button/index.tsx` | Completion label and check, then navigation after 220ms; task navigation cancels pending completion |
| `smooth-tabs/index.tsx` | Shared selection marker and short directional content crossfade |
| `accordion/index.tsx` | Height transition and rotating disclosure indicator, retaining Base UI semantics |
| `arrow-link/index.tsx` | Small arrow movement on hover and keyboard focus |

Runtime verification covered completion feedback, exactly one next-task transition, unchanged completion count on navigation, one settled content panel, source-table expansion, resource-panel clearance and copy confirmation. Typecheck, lint, 256 Portal tests and build pass. The existing static design HTML audit remains 7883/8140 and does not certify this route.

## Follow-up candidates

1. **Real completion progress.** `/Users/ziyu/UIPros/motion-ui/motion-ui/progress-bar/index.tsx`: value-driven fill with progressbar semantics. Map only to actual completed tasks; no simulated loading. Can complement the six phase marks without adding another large progress element.
2. **Resource-search feedback.** `/Users/ziyu/UIPros/motion-ui/motion-ui/command-palette/index.tsx`: grouped matches, live result counts, keyboard navigation and shared active-row marker. Adopt the local list behavior inside the existing sheet, avoiding a second global command shortcut.
3. **Conditional fields.** `/Users/ziyu/UIPros/motion-examples/react/clerk-conditional-field/index.tsx`: measured-height reveal and restrained entry motion. Use when the input schema gains conditional fields; do not invent fields for the current JSON.
4. **Mobile resources sheet.** `/Users/ziyu/UIPros/motion-ui/motion-ui/sheet/index.tsx`: drag-to-dismiss bottom sheet with synchronized scrim. A mobile-specific option; its vertical gesture behavior is unsuitable for direct reuse in the current desktop side sheet.


## Desktop follow-up implementation

Implemented progress-bar, resource keyboard search and conditional-field patterns. Progress reflects only stored completion indices. Resource search supports fuzzy names/values/groups, result announcements, ArrowUp/ArrowDown, Home/End within results, and native Enter activation. Account-only resources use Copy as their primary action; linked resources use Open. A shared highlight follows keyboard focus.

The ECS journey declares `aws_account_id` in addition to `app_code`; its first source step now reveals that field. The original app code is retained, and completed field values enter the resource sheet. No mobile changes are part of this follow-up.

Runtime checks: changing phases retained progress 2/20; completing ECS setup changed it to 3/20; searching AWSID returned one account; ArrowDown focused Copy AWS account ID; Enter confirmed copying. New search tests cover abbreviation, case, identifiers, groups, empty query and no matches.

## Further desktop candidates, not implemented

- `/Users/ziyu/UIPros/motion-ui/motion-ui/expand-card/index.tsx`: resource-to-detail transition. Adapt expansion inside the existing sheet instead of stacking another modal. Only expose actual resource metadata.
- `/Users/ziyu/UIPros/reui-blocks/components/c-input/c-input-21.tsx`: per-rule inline validation. Suitable when the source schema declares validation rules; do not infer new field restrictions solely from a demo.
- `/Users/ziyu/UIPros/motion-examples/react/characters-remaining/index.tsx`: length feedback. Wait for explicit field-length constraints; adapt labels and reduced-motion behavior rather than copying the demo styling.

## Resource details implementation

Resource names now toggle inline details in the existing sheet. Only one resource expands at a time. Details display the full value, application code, phase and source task, with a link back to that task. Copy and external-link actions remain siblings of the disclosure control. Keyboard result navigation targets the details trigger; Tab reaches the other actions. Search resets the expansion. Source-task navigation closes the sheet and returns focus to the task heading. No length counters or additional validation rules were added because the JSON declares no such constraints.
