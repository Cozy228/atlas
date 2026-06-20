---
name: Atlas Portal
description: Authoritative self-service catalog for the company's cloud platform.
# Design system: "Blueprint" — an engineering-drawing aesthetic. Light is primary; "Ink" is the
# dark scheme (same structure, recoloured). OKLCH-native; all neutrals tinted toward hue 264 (brand),
# chroma reduced near the lightness extremes per OKLCH perceptual rules. No #000 / #fff anywhere.
# The single hard brand requirement is #001AFF. Reference implementation: prototype/atlas-design-system.html
colors:
  # --- Brand (the one action & selection colour; ≤10% of any screen) ---
  brand:        "oklch(46.28% 0.3059 264.18)"   # #001AFF — fills (primary buttons, brand mark)
  brand-hover:  "oklch(40% 0.28 264.18)"
  brand-tint:   "oklch(95% 0.045 264.18)"        # selected row / focus halo / brand surfaces
  brand-ink:    "oklch(45% 0.29 264.18)"         # brand-AS-TEXT on light surfaces (links, active) ~7:1
  on-brand:     "oklch(99.6% 0.0015 264.18)"     # text/icon ON a solid brand fill

  # --- Neutral field (light / Blueprint canonical) ---
  bg:           "oklch(98.2% 0.004 264.18)"      # page canvas
  grid:         "oklch(72% 0.04 264.18 / 0.08)"  # coordinate grid lines (negative space only)
  surface:      "oklch(99.6% 0.0015 264.18)"     # cards, panels, popovers
  surface-2:    "oklch(97% 0.006 264.18)"        # hover / table header / inset
  ink:          "oklch(23% 0.03 264.18)"         # primary text
  ink-2:        "oklch(46% 0.03 264.18)"         # secondary text / labels  (AA on bg)
  ink-3:        "oklch(58% 0.025 264.18)"        # tertiary / metadata / placeholder
  line:         "oklch(90% 0.012 264.18)"        # hairline borders / dividers
  line-2:       "oklch(80% 0.016 264.18)"        # emphasised border (hover, secondary button)

  # --- Semantic states (four fixed distinct hues; never folded into brand) ---
  success:  "oklch(56% 0.13 152)"   # GA / active / deployed
  warning:  "oklch(70% 0.15 75)"    # planned / stale
  critical: "oklch(55% 0.2 25)"     # broken anchor / unavailable / denied
  info:     "oklch(60% 0.12 230)"   # notice (distinct from brand hue)
  # each semantic also has -tint (chip background) and -ink (chip text); see §2.

typography:
  display:
    fontFamily: "Inter (self-hosted variable)"
    fontSize: "clamp(2rem, 5vw, 3.25rem)"   # 32 → 52px; once per route (hero)
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  heading:
    fontFamily: "Inter"
    fontSize: "1.375rem"                     # 22px section title
    fontWeight: 700
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter"
    fontSize: "0.9375rem"                    # 15px card / capability name
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter"
    fontSize: "0.9375rem"                    # 15px
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter"
    fontSize: "0.8125rem"                    # 13px supporting text
  detail:
    fontFamily: "Inter"
    fontSize: "0.75rem"                      # 12px metadata / help (floor for content)
  mono:
    fontFamily: "IBM Plex Mono"
    fontSize: "0.75rem"                      # 12px — INLINE CODE & identifier tags ONLY (never tables)
    fontWeight: 600
    letterSpacing: "0.05em"

rounded:
  xs: "3px"        # controls (buttons, inputs)
  sm: "4px"        # cards / panels (--card-r)
  md: "6px"
  lg: "10px"
  pill: "999px"    # tags, FAB, count badges

spacing:           # 4px base
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
  "3xl": "64px"

components:
  button-primary:   { backgroundColor: "{colors.brand}", textColor: "{colors.on-brand}", rounded: "{rounded.xs}", padding: "7px 14px", fontSize: "13px", fontWeight: 600 }
  button-secondary: { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", border: "1px solid {colors.line-2}", rounded: "{rounded.xs}", hover: "border-color {colors.brand}; color {colors.brand-ink}" }
  button-ghost:     { backgroundColor: "transparent", textColor: "{colors.ink-2}", hover: "background {colors.surface-2}; color {colors.ink}" }
  input:            { height: "40px", backgroundColor: "{colors.surface}", border: "1px solid {colors.line}", rounded: "{rounded.xs}", focus: "border {colors.brand}; ring 3px {colors.brand}/16%" }
  chip:             { fontFamily: "Inter", fontSize: "11.5px", fontWeight: 600, rounded: "2px", border: "1px solid {colors.line-2}", backgroundColor: "transparent" }
  capability-card:  { backgroundColor: "{colors.surface}", border: "1px solid {colors.line}", rounded: "{rounded.sm}", padding: "16px", accent: "brand corner ticks (7px, opacity .5)" }
  table:            { fontSize: "13px", numerics: "tabular-nums", header: "Inter uppercase 11px tracked", identifier: "weight 600 (no monospace)" }
  top-nav:          { height: "56px", layout: "grid 1fr auto 1fr — brand left · tabs centred · search+theme icons right", active: "brand underline", sticky: true, opaque: true }
  fab:              { content: "Ask Atlas", position: "fixed bottom-right", backgroundColor: "{colors.brand}", textColor: "{colors.on-brand}", rounded: "{rounded.pill}" }
---

# Design System: Atlas Portal — "Blueprint"

## 1. Visual Theme & Atmosphere

**Creative North Star: "The Engineering Drawing."**

Atlas is an instrument, not a destination. An engineer arrives mid-task with one question — which
capability to adopt, whether a service is available in a region, whether a choice is policy-approved
— and a deadline. The interface answers fast and gets out of the way. It earns attention through
information integrity, never spectacle.

The surface reads like a precise engineering drawing: a faint square coordinate grid in the
negative space, hairline rules, corner ticks on key panels, and a single ink-blue that carries all
action and selection. Content sits on clean "paper" (solid surfaces) laid over the grid; the grid
breathes in the margins and gaps but never runs behind running text. The result is calm authority —
technical, exact, never cold, never decorative.

This system ships in two schemes from one structure:
- **Blueprint** (light, primary) — cool near-white paper, faint blue grid.
- **Ink** (dark) — near-black, high-contrast (OLED-friendly); same components recoloured, brand
  lifted to punch against the black.

**Register & re-skin** (see [ADR-0005](docs/adr/0005-blueprint-design-identity-and-reskin-seam.md)).
"Instrument, not spectacle" still admits a *restrained welcoming entry* (the Home "Welcome
desk") and an *editorial change surface* (What's New) — these are sanctioned, provided they
earn attention through information integrity, not decoration. Blueprint is this repo's design
identity; it is **not** assumed to survive import into a company environment unchanged. The
system is fully token-driven, so a re-skin (e.g. to a "Geist"-style direction) is a **token
swap, not a rewrite** — the token layer is the re-skin seam.

**Principles (these drive every token and component):**
1. **Evidence before confidence.** Every authoritative claim surfaces its source; citation/evidence
   is a first-class component.
2. **Density is a feature.** Whitespace is for rhythm, not for padding thin content. Clarity comes
   from structure (alignment, weight, rules), not reduction.
3. **One brand signal.** `#001AFF` means exactly one thing — *act here* or *this is selected* — and
   stays ≤10% of any screen. Its value is its rarity.
4. **Calm under load.** Stale sources, broken anchors, missing data are expected states, shown
   plainly, never with alarm styling.
5. **Platform vocabulary is machine-structured but quiet.** Slugs, codes, channels render in mono
   *inline* and as identifier tags — never as whole table columns.
6. **Ship-state honesty.** No decorative "Live/Synced"; an indicator is wired to real data or absent.
7. **OKLCH-native, AA floor.** All colour in OKLCH; body text ≥4.5:1, large ≥3:1; respect
   `prefers-reduced-motion`.

## 2. Color Palette & Roles

A restrained single-accent palette. Every neutral is tinted toward hue 264 at minimal chroma — the
tint is imperceptible at a glance but unifies the field, from which brand emerges as the one signal.

### Brand
- **Brand `#001AFF`** (`oklch(46.28% 0.3059 264.18)`) — fills only: primary buttons, brand mark.
  Dark scheme: `oklch(62% 0.26 264.18)` (lifted for legibility on black).
- **Brand / ink** (`oklch(45% 0.29 264.18)`) — brand *as text* on light surfaces (links, active nav,
  citation links, `[n]` markers), ~7:1. Dark: `oklch(80% 0.15 264.18)`.
- **Brand / tint** (`oklch(95% 0.045 264.18)`) — selected table row, focus halo. Dark: `oklch(25% 0.06 264.18)`.
- **On-brand** (`oklch(99.6% 0.0015 264.18)`) — text/icon on a solid brand fill.

### Neutral field — light (Blueprint) → dark (Ink)
| role | light | dark (Ink) |
|---|---|---|
| bg (canvas) | `oklch(98.2% 0.004 264.18)` | `oklch(12% 0.008 264.18)` |
| grid line | `oklch(72% 0.04 264.18 / 0.08)` | `oklch(82% 0.03 264.18 / 0.045)` |
| surface | `oklch(99.6% 0.0015 264.18)` | `oklch(16% 0.009 264.18)` |
| surface-2 | `oklch(97% 0.006 264.18)` | `oklch(20% 0.011 264.18)` |
| ink | `oklch(23% 0.03 264.18)` | `oklch(96% 0.005 264.18)` |
| ink-2 | `oklch(46% 0.03 264.18)` | `oklch(68% 0.012 264.18)` |
| ink-3 | `oklch(58% 0.025 264.18)` | `oklch(52% 0.012 264.18)` |
| line | `oklch(90% 0.012 264.18)` | `oklch(24% 0.01 264.18)` |
| line-2 | `oklch(80% 0.016 264.18)` | `oklch(34% 0.012 264.18)` |

### Semantic (fixed distinct hues; each has a -tint background and -ink text)
| state | base (light) | tint (light) | ink (light) |
|---|---|---|---|
| success / GA | `oklch(56% 0.13 152)` | `oklch(95% 0.05 152)` | `oklch(38% 0.11 152)` |
| warning / planned | `oklch(70% 0.15 75)` | `oklch(95% 0.07 85)` | `oklch(45% 0.12 60)` |
| critical / broken | `oklch(55% 0.2 25)` | `oklch(95% 0.05 25)` | `oklch(45% 0.18 25)` |
| info / notice | `oklch(60% 0.12 230)` | `oklch(95% 0.04 230)` | `oklch(42% 0.11 230)` |

Dark semantics brighten (base ~+12% L) with darker tints (~26% L) and light ink (~82% L). See the
reference implementation for exact dark values.

**Rules.** Brand ≤10% of any screen. Neutrals always tinted toward hue 264 (chroma ≥0.004; pure
greys prohibited). No `#000`/`#fff`. Semantic hues never fold into brand.

## 3. Typography Rules

**Interface font:** Inter, self-hosted as a variable font (`@fontsource-variable/inter`).
**Code/identifier font:** IBM Plex Mono — **inline code and identifier tags only** (e.g. `eu-west-1`,
a card's `object-storage` slug). **Never** for data-table columns.

### Scale (fixed rem, not fluid — except the hero)
- **Display** — `clamp(2rem, 5vw, 3.25rem)` / 1.04 / −0.03em / 700. Hero only, once per route.
- **Heading** — 22–24px / −0.02em / 700. Section titles.
- **Title** — 15px / 700 / −0.01em. Card & capability names.
- **Body** — 15px / 1.55. Prose; cap line length ~65ch.
- **Label** — 13px. Supporting text, form labels.
- **Detail / help** — 12px. Metadata, timestamps (content floor).
- **Mono (code)** — 12px / 600 / 0.05em, sometimes UPPERCASE. Inline system values & tags only.
- **Eyebrow** — 11px mono / 0.12em / UPPERCASE. Section kicker.

**Data tables follow data-table best practice:** Inter throughout + `font-variant-numeric:
tabular-nums`; the identifier column is emphasised by **weight (600)**, not a font switch; headers
are sans, uppercase, tracked. (Monospace is for code, not tabular data — mixing mono columns into a
table reads as noise.)

### Platform parity (Windows 11)
The biggest cross-platform risk is Windows falling back to Segoe UI with *synthesised* bold weights.
Mitigations, baked in:
- **Webfonts** (self-hosted Inter / IBM Plex Mono) — removes the Segoe fallback.
- `font-synthesis: none` — only real weights render.
- `font-optical-sizing: auto` — correct optical sizing everywhere.
- **Body weight floor 400** — ClearType/DirectWrite render heavier and `-webkit-font-smoothing` is a
  macOS-only no-op, so never rely on it and never use 300 for body.
- **Size floor ~11px for UI, ≥12px for content** — below that ClearType smears.

## 4. Component Stylings

Every interactive component ships: **default, hover, focus, active, disabled, loading.**

- **Buttons.** Radius 3px, ~32px tall (7px/14px pad, 13px/600). *Primary* = solid brand + on-brand
  text → `brand-hover` on hover. *Secondary* = surface + 1px `line-2`, border lifts to brand + text
  to `brand-ink` on hover (no fill). *Ghost* = transparent → `surface-2` on hover. *Danger* =
  transparent + critical-tinted border → `critical-tint` on hover. Focus = 2px brand ring, 2px
  offset. Loading = inline spinner. `btn-sm` for compact rows.
- **Inputs / search.** 40–44px, surface, 1px `line`, radius 3px; focus = brand border + `0 0 0 3px`
  brand/16% halo; error = critical border; disabled = `surface-2`. Placeholder inherits the field's
  font (no mono/sans mismatch).
- **Tabs.** Underline indicator: active = `inset 0 -2px 0 brand` + `ink` text + 600.
- **Chips.** Square (2px radius), 1px hairline, transparent fill, Inter 11.5px/600. Semantic variants
  colour the border + text (`*-ink`); a leading status dot is optional. Inside tables, chips inherit
  the cell font.
- **Status dots.** 8px. success / warning / critical / neutral (`ink-3`) / **na** (transparent with a
  1.5px inset ring). The primary availability signal.
- **Capability card.** Surface, 1px `line`, radius 4px, 16px pad, **brand corner ticks** (top-left /
  bottom-right, 7px, opacity .5). Icon 36px on `brand-tint`; title 15/700; `slug` mono 11px; 2-line
  desc (`ink-2`, 13px); status chips; mono footer (owner · channel) above a hairline; arrow nudges
  right + turns brand on hover. Hover: border → `line-2` + `shadow-pop`. No nested anchors.
- **Data table.** See §3. Vertical + horizontal hairlines (the "drawing grid"); header on
  `surface-2`; rows on surface, hover `surface-2`; selected row `brand-tint`; status = dot + label.
- **Availability matrix.** A **status-dot grid** with a legend (GA / Planned / Not available). Dots
  carry colour; short codes (GA, Q3) sit beside them, all Inter + tabular.
- **Document Sources.** Numbered reference entries inside a solid surface panel: big tabular numeral,
  title, `type · id` mono tag, description, status chips, and a right-aligned meta column (owner ·
  freshness · source link). Reusable as any "sources / documents" list.
- **Evidence callout.** `[n]` brand marker + claim + a mono cite line with a brand-ink source link.
- **Alerts.** Warning / critical: semantic tint background + matching border + `*-ink` text. Calm,
  never loud. Icon + bold lead + sentence.
- **Loading = skeleton**, never a centred spinner in content. **Empty state** teaches the interface
  (what to try) with a quiet action, not "nothing here".
- **Top nav.** 56px, sticky, **opaque** (so the grid starts cleanly below it), 3-column grid
  `1fr auto 1fr`: brand mark + wordmark left · **tabs centred** (active = brand underline) · **search
  + theme-toggle icon buttons** right.
- **Ask Atlas = FAB.** A brand pill fixed bottom-right (chat icon + label), not in the bar.

## 5. Layout Principles

- **The coordinate grid.** A 32px square grid lives on a full-width canvas *behind* the content and
  begins below the opaque top bar. It shows **only in negative space** (page margins, gaps between
  blocks, the empty side of a paragraph). Each text block carries a **same-colour plate**
  (`background: bg`, hugging its text) that masks the grid directly behind copy; cards / tables /
  panels are already solid. The grid is texture for breathing room, never a backdrop for reading.
- **No full-width section divider lines.** A square grid and full-width horizontal rules are
  physically incompatible (a hairline lands a few px off a grid line → a "double line"). Separate
  sections with spacing + the numbered heading instead.
- **Spacing.** 4px base. Section padding ~52px. Vary rhythm; don't pad uniformly.
- **Grids.** Flexbox for 1D, CSS grid for 2D. Card grids: `repeat(auto-fit, minmax(230px, 1fr))`.
- **Line length.** Prose ≤65ch; dense tables may run wide.

## 6. Depth & Elevation

**Flat by tonal layering.** Depth is expressed through OKLCH lightness steps (canvas → surface →
surface-2), not ambient shadow. There are **no box-shadows at rest.** A `shadow-pop`
(`0 1px 2px …, 0 6px 16px …`, deeper in dark) appears **only** on hover of an interactive card or on
transient overlays (FAB, popovers). If the instinct is "add a shadow to this static element," reroute
it to a lightness step.

Stacking order (semantic z-scale): content → sticky top bar (30) → FAB (90) → modal/overlay → toast
→ tooltip. Never arbitrary `9999`.

## 7. Do's and Don'ts

**Do**
- Use brand only for action & selection; keep it ≤10% of any screen; use `brand-ink` for brand-as-text.
- Keep the coordinate grid in negative space; mask it behind copy with same-colour plates.
- Use Inter + `tabular-nums` in data tables; reserve mono for inline code & identifier tags.
- Express depth with lightness steps; reserve shadow for hover/overlays.
- Communicate stale / broken / missing states calmly, each with its own semantic dot/chip.
- Self-host Inter; set `font-synthesis: none`; keep body ≥400 weight and UI text ≥11px (Windows).

**Don't**
- ✗ Monospace data-table columns (use Inter + tabular figures; weight the identifier instead).
- ✗ Full-width horizontal divider lines over the grid (they clash; use spacing + numbered headings).
- ✗ Let the grid bleed behind running text, or hide it entirely in the margins ("might as well not
  have it"). It belongs in the negative space *within* the content area.
- ✗ Cream/sand canvases, purple gradients, glassmorphism, gradient text, or hero-metric templates.
- ✗ Side-stripe borders (`border-left >1px` accents); `1px border + ≥16px soft shadow` ghost cards;
  card radius ≥24px; decorative section eyebrows on every block.
- ✗ `#000`/`#fff`, pure greys, or any non-OKLCH colour.
- ✗ Decorative "Live/Synced" copy not wired to data. ✗ Nested `<a>` inside an interactive card.
- ✗ Decorative motion that doesn't convey state.

## 8. Responsive Behavior

- **Structural, not fluid type** (except the hero display clamp). Users view at consistent DPI.
- **Top bar:** on small screens, collapse the centred tabs into a menu (sheet/drawer); keep brand +
  search + theme. The FAB stays.
- **Card grids:** `repeat(auto-fit, minmax(230px, 1fr))` — reflow without breakpoints.
- **Tables:** allow horizontal scroll or collapse low-priority columns; keep identifier + status.
- **The grid recedes** on narrow viewports (content fills the column); it's a wide-screen framing
  device, not load-bearing.
- Touch targets ≥40px. Respect `prefers-reduced-motion` (crossfade/instant fallback).

## 9. Agent Prompt Guide

**Brand:** `#001AFF` (`oklch(46.28% 0.3059 264.18)`). Reference build:
`prototype/atlas-design-system.html` (light = `#blueprint`, dark = `#blueprint-ink`).

Ready-to-use prompts:
- "Build a capability catalog page in the Atlas **Blueprint** system: faint 32px coordinate grid in
  the negative space (masked behind text by same-colour plates), `#001AFF` for action/selection only,
  Inter throughout, IBM Plex Mono for inline codes only. Cards have brand corner ticks; tables use
  Inter + tabular figures (no mono columns); availability uses status dots."
- "Add a dark mode (**Ink**): same structure, near-black surfaces, brand lifted to
  `oklch(62% 0.26 264.18)`; grid alpha ~0.045."
- "Top bar: 56px sticky opaque, brand left, tabs centred (active = brand underline), search + theme
  icons right; 'Ask' is a brand FAB bottom-right."

**Motion:** 150–250ms on colour/border transitions; ease-out; no bounce. Always provide a
`prefers-reduced-motion` alternative.
