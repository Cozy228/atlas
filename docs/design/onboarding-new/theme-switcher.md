# Theme switcher

Sources:
- UIPros `reactbits-templates/saas/components/theme-toggle.tsx`: compact theme controls and explicit light/dark labels.
- https://magicui.design/docs/components/animated-theme-toggler and its registry source: synchronous theme commit inside View Transitions, measured circular clip origin, initial CSS clipping before ready, cleanup after completion.
- https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API

Implementation: 96 × 32 three-mode control, semantic Atlas colors, 500ms circular reveal from the selected button. The selected indicator has a unique view-transition name so it can move independently of the page snapshot. System mode and storage synchronization remain supported. Latest selection wins during overlapping requests. Reduced-motion and unsupported browsers switch without a snapshot animation. Snapshot CSS is scoped to theme transitions.

Runtime verification: 32 distinct circular clip frames; 24 distinct indicator positions; rapid dark/light/dark ends dark; preference survives reload; system mode responds to emulated OS changes; reduced motion and missing startViewTransition switch directly. Verified on the onboarding route in a separate browser session.

Checks: onboarding tests 19 passed, lint and workspace tsc pass. Explicit portal typecheck remains blocked by pre-existing missing workspace packages, including @atlas/schema; no theme or onboarding diagnostics. Static document grid audit remains 7883/8140.

## Source parity correction

The reveal now uses Magic UI's default 400ms `ease-in-out` timing and percentage clip coordinates. Pointer activation uses the actual click coordinates; keyboard activation uses the control center. This replaces the front-loaded easing and pixel coordinates. A 35-frame capture found 26 distinct clip states, with approximately 7%, 54%, and 115% radii at successive samples; the origin matched the dispatched pointer coordinates. The named selection indicator also uses 400ms ease-in-out.

The indicator is now included in the page snapshot rather than promoted to a separate snapshot layer: the separate layer obscured the sun/moon glyphs during the reveal. Its local slide remains for changes with the same resolved theme; visual theme changes reveal the complete selected control together with the page.
