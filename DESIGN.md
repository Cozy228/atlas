---
name: Atlas Portal
description: Authoritative self-service catalog for the company's cloud platform.
colors:
  # OKLCH-native project. Stitch linter will warn on non-hex values; that is expected.
  # All neutrals are tinted toward hue 264 (brand). Chroma is reduced near lightness
  # extremes to avoid garish values per OKLCH perceptual rules.

  # Primary
  platform-blue: "oklch(46.28% 0.3059 264.18)"

  # Neutral surfaces (light mode canonical; dark equivalents live in CSS custom properties)
  canvas: "oklch(98.6% 0.005 264.18)"
  surface: "oklch(99.5% 0.003 264.18)"
  ink: "oklch(20% 0.02 264.18)"
  ink-secondary: "oklch(48% 0.025 264.18)"
  muted: "oklch(96% 0.008 264.18)"
  border: "oklch(91% 0.01 264.18)"
  border-strong: "oklch(82% 0.012 264.18)"
  brand-tint: "oklch(94% 0.05 264.18)"

  # Semantic states (fixed distinct hues — never folded into the brand color)
  success: "oklch(58% 0.13 152)"
  warning: "oklch(72% 0.16 75)"
  critical: "oklch(56% 0.18 25)"
  info: "oklch(62% 0.12 230)"

typography:
  display:
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui'
    fontSize: "2.25rem / 2.5rem (mobile / sm+)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui'
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui'
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui'
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui'
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  mono-label:
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.05em"

rounded:
  sm: "4px"
  md: "6px"
  default: "8px"
  xl: "10px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"

components:
  button-primary:
    backgroundColor: "{colors.platform-blue}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.default}"
    padding: "6px 16px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "oklch(54% 0.28 264.18)"
    textColor: "{colors.canvas}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.default}"
    padding: "6px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.ink}"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.default}"
    padding: "6px 12px"
  nav-link-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.platform-blue}"
  capability-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.default}"
    padding: "16px"
  capability-card-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  search-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.default}"
    height: "44px"
---

# Design System: Atlas Portal

## 1. Overview

**Creative North Star: "The Control Room"**

Atlas Portal is a briefing interface, not a discovery experience. Like a well-designed control
room, it communicates state at a glance through structural discipline rather than spectacle:
the right information, at the right density, with nothing in the way. Engineers arrive
mid-task with a specific question — which capability to adopt, whether a service is available
in their region, whether a design choice is policy-approved — and the interface answers without
ceremony. Every screen earns attention through information integrity, not animation.

The visual system makes one strong commitment: Platform Blue carries the full weight of action
and selection. All other surfaces are tinted near-neutrals that recede and let structured data
speak. Depth is expressed through lightness steps alone; shadows appear only as state signals.
IBM Plex Mono marks machine-structured vocabulary (category slugs, topic types, authority
levels, channel names) so that structural metadata is always visually distinct from human
prose. The result is a palette of calm authority — never cold, never playful.

This system explicitly rejects: cream-and-purple SaaS gradient aesthetics and glowing card
effects; legacy enterprise blue-grey palettes with heavy sidebars and accordion-nested tables;
and DevRel marketing pages where large hero sections and flashy scroll effects compensate for
thin content. If a design choice would feel at home on a product landing page, it does not
belong in Atlas. The interface earns trust through evidence, structure, and honesty — not
through decoration.

**Key Characteristics:**
- All neutrals tinted toward hue 264 (brand), never pure white or black
- IBM Plex Sans for clarity; IBM Plex Mono exclusively for structured platform vocabulary
- Flat-by-tonal-layering: depth through OKLCH lightness steps, not box-shadows
- Platform Blue on ≤10% of any surface — reserved for action and selection
- Monospace uppercase labels serve as structural section anchors, not decoration
- Freshness signals are wired to real data or absent entirely

## 2. Colors: The Hue-264 System

A restrained single-accent palette. Every surface in the system — from near-white canvas to
near-black dark background — is tinted toward hue 264 at minimal chroma. The tint is
imperceptible at a glance but creates deep visual coherence: the entire UI reads as a unified
field from which Platform Blue emerges as the singular signal.

### Primary

- **Platform Blue** (`oklch(46.28% 0.3059 264.18)`): The one action and selection color.
  Used for interactive elements (primary buttons, links, active nav states, focus rings,
  selected rows). Never used for large surface fills. In dark mode: `oklch(58% 0.26 264.18)`.

### Neutral

- **Blueprint Canvas** (`oklch(98.6% 0.005 264.18)`): Page background. Near-white with a
  barely perceptible blue tint. Never pure white. Dark: `oklch(14% 0.008 264.18)`.
- **Surface White** (`oklch(99.5% 0.003 264.18)`): Card and popover backgrounds. Slightly
  lighter than canvas to create separation without shadow. Dark: `oklch(18% 0.01 264.18)`.
- **Ink** (`oklch(20% 0.02 264.18)`): Primary text. Dense but tinted. Dark: `oklch(93% 0.006 264.18)`.
- **Secondary Ink** (`oklch(48% 0.025 264.18)`): Supporting text, labels, metadata, muted
  icons. Midpoint neutral. Dark: `oklch(62% 0.012 264.18)`.
- **Muted Surface** (`oklch(96% 0.008 264.18)`): Hover and selection backgrounds. Dark: `oklch(20% 0.01 264.18)`.
- **Hairline Border** (`oklch(91% 0.01 264.18)`): Default card borders and dividers. Dark: `oklch(26% 0.01 264.18)`.
- **Structural Border** (`oklch(82% 0.012 264.18)`): Emphasized borders on hover states. Dark: `oklch(36% 0.012 264.18)`.
- **Brand Tint** (`oklch(94% 0.05 264.18)`): Active nav background, selected row fills. The
  only surface-level presence of the brand hue. Dark: `oklch(24% 0.035 264.18)`.

### Semantic (fixed distinct hues, never folded into the brand color)

- **Healthy Green** (`oklch(58% 0.13 152)`): Active, deployed, and success states.
- **Amber Alert** (`oklch(72% 0.16 75)`): Warnings, stale sources, planned states.
- **Critical Red** (`oklch(56% 0.18 25)`): Errors, broken anchors, access denied.
- **Informational Sky** (`oklch(62% 0.12 230)`): Informational notices. Distinct from brand hue.

**The One Voice Rule.** Platform Blue is the singular action signal. Its signal value depends
entirely on rarity — ≤10% of any screen. Brand Tint is its echo on surfaces; it never carries
Platform Blue's interactive meaning. When Platform Blue appears, it means: act here, or this
is selected. Nowhere else.

**The OKLCH-Only Rule.** All color values are OKLCH. Chroma is always reduced as lightness
approaches 0 or 100. Dark surfaces use the same hue as their light equivalents, with chroma
reduced to avoid garish extremes at low lightness. No `#000` or `#fff` anywhere.

**The Tint Discipline Rule.** Every neutral in the system is tinted toward hue 264. A chroma
of 0.005 is imperceptible but load-bearing: it anchors the neutral to the brand system. Pure
greys are prohibited.

## 3. Typography

**Body Font:** IBM Plex Sans (latin-400, 500, 600, 700)
**Label/Mono Font:** IBM Plex Mono (latin-400, 600)

**Character:** IBM Plex Sans is technical without coldness — the font of a precise instrument
with human calibration. Its companion Mono brings immediate structural legibility to platform
vocabulary: category slugs, topic types, authority levels, channel names. The pairing makes
the distinction between machine-structured data and human-readable prose visible at a glance.
OpenType features `kern`, `liga`, `calt`, `ss03` are enabled for optimal rendering.

### Hierarchy

- **Display** (IBM Plex Sans, 700, 36px mobile / 40px sm+, 1.1 line-height,
  −0.03em tracking): Page-level hero headings. Used once per route view. Never on cards or
  repeated in lists.
- **Headline** (700, 22px, 1.2 line-height, −0.02em tracking): Section titles within a page,
  used alongside SectionEyebrow.
- **Title** (700, 14px, 1.4 line-height, −0.01em tracking): Card headings and capability
  names. High information density; the weight contrast against body text creates scan paths.
- **Body** (400, 15px, 1.6 line-height): Narrative and descriptive text. Max line length
  52–56ch (scanned from existing page copy).
- **Label** (400, 13px, 1.5 line-height): Supporting text, card descriptions, secondary copy.
- **Detail** (400, 12px): Fine-grain metadata, timestamps, owner team references.
- **Mono Label** (IBM Plex Mono, 600, 11px, 1.4 line-height, 0.05em tracking, UPPERCASE):
  Category section anchors, section eyebrows, badge text, topic type codes, API codes.

**The Mono Structural Rule.** IBM Plex Mono at 11px/uppercase/semibold is reserved for
structured platform vocabulary: topic types, categories, authority levels, API codes, channel
names. It signals "this is a system value." Never use Mono for conversational, decorative,
or running prose. If Mono text could appear in a sentence, it is the wrong style.

## 4. Elevation

Atlas is flat by tonal layering. Depth is expressed through OKLCH lightness steps alone;
there are no box-shadows at rest. The layering stack (light mode, ascending):

1. **Canvas** (`oklch(98.6% 0.005 264.18)`): Page background — the floor.
2. **Surface / Card** (`oklch(99.5% 0.003 264.18)`): Cards and popovers — marginally lighter,
   readable as floating without any shadow.
3. **TopBar** (Canvas at 85% opacity + `backdrop-blur-sm`): Navigation layer — separated
   from content via stacking context and a blur, not a shadow.

On hover, interactive cards acquire `box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)` — this is a
state signal, not ambient depth. Its appearance means: this element is interactive and
currently elevated by the user's cursor.

**The Flat-By-Default Rule.** A surface without a shadow is a surface at rest. Shadows appear
only in response to interactive state (hover on navigable cards). If a design instinct says
"add a shadow here on a static element," that instinct should be rerouted to a lightness step.
The impulse toward shadow on static elements is the wrong answer.

## 5. Components

Precise and restrained. Components are minimal-footprint instruments. Their borders, radii,
and type sizes are calibrated for density, not breathing room.

### Buttons

- **Shape:** Gently curved (8px radius / `rounded-default`)
- **Primary:** Platform Blue background, canvas-white text, 6px vertical / 16px horizontal
  padding, 13px label weight (400). The background is the full-saturated brand signal.
- **Hover:** Lightness steps up to `oklch(54% 0.28 264.18)` — slightly lighter, same saturation.
  `transition-colors` at 150ms ease-out.
- **Focus:** 2px ring at Platform Blue, 2px offset from the element edge.
- **Ghost / Icon buttons:** Transparent background, secondary ink text, same radius. Hover
  switches to Muted Surface background with Ink text. Used for secondary actions and toolbar
  icons.

### Navigation (TopBar)

- **Container:** 56px tall, sticky, `border-b` Hairline Border, Canvas at 85% opacity with
  `backdrop-blur-sm`. The blur provides elevation without a shadow.
- **Brand mark:** 24×24px `rounded-[7px]` Platform Blue block with mono "A" in canvas-white.
  A structural signal, not a logotype.
- **Nav links:** 14px/medium, transparent background, secondary ink. Hover → Muted Surface
  background + Ink text. Active → Brand Tint background + Platform Blue text + semibold.
  Active state communicates current location without extra indicators.
- **Mobile:** Sheet drawer from the left, identical link styles, triggered by hamburger icon.

### Capability Cards

- **Container:** `rounded-default` (8px), Hairline Border, Surface White background, 16px padding.
- **Hover:** Border shifts to Structural Border + shadow-sm. The state change is immediate;
  hover communicates navigability.
- **Structure (top to bottom):** Service icon + Title (700/14px) + 2-line truncated description
  (Secondary Ink, 12px) + status chips row + owner / support channel footer (mono detail).
- **Arrow icon:** Secondary Ink at rest; translates 2px right and shifts to Ink on hover.
  The micro-movement confirms the entire card is interactive.
- **Constraint:** No nested interactive ancestors. Cards that contain inline links must use
  a non-interactive container (`<article>` or `<div>`) with standalone CTAs — not an outer
  `<a>` wrapping inner `<a>` elements.

### Inputs / Search Fields

- **Container:** 44px height, `rounded-default` (8px), Hairline Border, Surface White background,
  left-aligned search icon at 16px.
- **Focus:** Border shifts to Platform Blue + `box-shadow: 0 0 0 3px color-mix(in srgb, Platform Blue 8%, transparent)`.
  The 8% ring is a subtle glow, not a thick outline.
- **Text:** 14px/400, Ink color. Placeholder in Secondary Ink.
- **Max-width:** 600px. Search fields do not stretch full-width at large viewport sizes.

### Chips (Status / Availability)

- **Style:** Small rounded containers (4px radius), semantic color pairs (background tint +
  darker foreground), `IBM Plex Mono 10px/600`.
- **Available:** Healthy Green tint background, darker green text.
- **Planned:** Amber Alert tint background, darker amber text.
- **Not available / no data:** Hairline Border background, Secondary Ink text.
- **Purpose:** Regional availability indicators — density is intentional. Three chips per card
  is the target; overflow is rendered as `+N` in mono.

### Mono Category Label (Signature Component)

Atlas's primary navigational anchor in catalog views. IBM Plex Mono, 11px, 600, uppercase,
0.05em tracking, Secondary Ink color. Followed by a count badge (rounded-full, Border
background) and a full-width horizontal rule (Hairline Border). This pattern communicates
section boundaries in dense grid views without adding visual hierarchy competition.

## 6. Do's and Don'ts

### Do:

- **Do** use Platform Blue only for interactive and selected states. Keep its coverage to
  ≤10% of any screen. Its signal value depends on rarity.
- **Do** use IBM Plex Mono uppercase (11px, 600, 0.05em tracking) for platform vocabulary:
  topic types, authority levels, category slugs, API codes, support channel names.
- **Do** express depth through OKLCH lightness steps. Cards appear elevated because they
  are lighter than the canvas surface, not because they cast a shadow.
- **Do** wire freshness indicators ("Live", "Synced") to real data before showing them.
  Remove or neutralize decorative freshness copy until the data is available.
- **Do** keep body line length under 56ch for descriptive prose. The value is in the data,
  not in paragraph length.
- **Do** tint every neutral toward hue 264. A chroma of 0.005 is enough to anchor the system.
- **Do** use `prefers-reduced-motion` to disable or minimize animations for users who have
  enabled that OS preference. The theme-reveal and any `animate-ping` indicators must respect it.
- **Do** expose broken anchors, stale sources, and unavailable services with their own semantic
  chip / indicator — calmly, without alarm styling.

### Don't:

- **Don't** use cream backgrounds, purple gradients, glowing card effects, or AI-generated
  SaaS aesthetics. Atlas is a tool, not a product landing page.
- **Don't** reproduce legacy enterprise patterns: heavy blue-grey palettes, accordion-nested
  tables, sidebar navigation buried three levels deep.
- **Don't** use large hero sections, flashy scroll effects, or animation that compensates for
  thin content. Visual spectacle is the anti-pattern.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on
  cards, list items, or callouts. Rewrite with background tints, full borders, or nothing.
- **Don't** use gradient text (`background-clip: text` with a gradient). Use a single solid
  color; emphasis via weight or size.
- **Don't** show "Live", "Synced just now", or any freshness indicator as decorative copy.
  Remove it entirely until it is wired to a real data source. A false confidence signal corrodes
  trust faster than silence.
- **Don't** use `#000` or `#fff` anywhere. Every surface, text, and border is a tinted OKLCH value.
- **Don't** add box-shadows to static surfaces. `shadow-sm` is a hover state, not ambient depth.
- **Don't** use IBM Plex Mono for conversational, decorative, or non-structured text. Mono
  means "system value." If it would read naturally in a sentence, it is the wrong style.
- **Don't** wrap interactive cards in an outer `<a>` tag that contains other `<a>` elements.
  Nested anchor elements are invalid HTML and break screen readers.
