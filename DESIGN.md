---
name: Atlas Portal
description: Authoritative self-service catalog for the company's cloud platform.
# Design system: "Blueprint" — an engineering-drawing aesthetic. Light is primary; "Ink" is the
# dark scheme (same structure, recoloured). OKLCH-native; all neutrals tinted toward hue 264 (brand),
# chroma reduced near the lightness extremes per OKLCH perceptual rules. No #000 / #fff anywhere.
# Color system strictly follows better-colors (by Jakub Krehel): 2-Tier Architecture (Primitives + Semantics),
# Hold-the-Hue (constant hue across ramps), mid-ramp chroma peaks, and APCA / WCAG verified contrast.
# The single hard brand requirement is #001AFF. Reference implementation: portal/src + globals.css.
colors:
  # --- Tier 1: Primitives (OKLCH Native Ramps) ---
  primitives:
    neutral:
      50:  "oklch(98.2% 0.004 264.18)"   # Canvas paper
      100: "oklch(97.0% 0.006 264.18)"   # Inset / table head / hover
      200: "oklch(93.5% 0.008 264.18)"   # Subtle border
      300: "oklch(89.0% 0.012 264.18)"   # Hairline line / dividers
      400: "oklch(79.0% 0.016 264.18)"   # Emphasized border
      500: "oklch(65.0% 0.022 264.18)"   # Mid grey
      600: "oklch(56.0% 0.026 264.18)"   # Muted text / metadata (ink-3)
      700: "oklch(44.0% 0.030 264.18)"   # Secondary text / labels (ink-2)
      800: "oklch(32.0% 0.032 264.18)"   # Dark slate
      900: "oklch(21.5% 0.030 264.18)"   # Primary text (ink) — AAA (13.5:1 / Lc 98)
      950: "oklch(14.0% 0.015 264.18)"   # Dark canvas (OLED Ink)
      white: "oklch(99.6% 0.0015 264.18)" # Clean card surface plate
    brand:
      50:  "oklch(96.0% 0.035 264.18)"   # Selected row / focus background
      100: "oklch(92.0% 0.065 264.18)"   # Focus ring halo
      200: "oklch(84.0% 0.120 264.18)"   # Soft accent
      300: "oklch(72.0% 0.200 264.18)"   # Lifted brand (Dark mode solid action)
      400: "oklch(58.0% 0.270 264.18)"   # Vibrant brand
      500: "oklch(46.28% 0.3059 264.18)" # Master #001AFF Primary Action Solid
      600: "oklch(40.0% 0.280 264.18)"   # Hover primary
      700: "oklch(34.0% 0.240 264.18)"   # Deep brand
      800: "oklch(27.0% 0.180 264.18)"   # Dark brand
      900: "oklch(20.0% 0.120 264.18)"   # Ink brand
    semantics:
      green:  { 50: "oklch(96% 0.04 152)", 200: "oklch(88% 0.08 152)", 500: "oklch(56% 0.13 152)", 700: "oklch(38% 0.11 152)" }
      amber:  { 50: "oklch(96% 0.05 75)",  200: "oklch(88% 0.10 75)",  500: "oklch(70% 0.15 75)",  700: "oklch(45% 0.12 60)" }
      red:    { 50: "oklch(96% 0.045 25)", 200: "oklch(88% 0.10 25)",  500: "oklch(55% 0.20 25)",  700: "oklch(45% 0.18 25)" }
      sky:    { 50: "oklch(96% 0.035 230)",200: "oklch(88% 0.07 230)", 500: "oklch(60% 0.12 230)", 700: "oklch(42% 0.11 230)" }

  # --- Tier 2: Semantics (Role Mappings) ---
  brand:        "var(--brand-500)"         # Primary Action Fill
  brand-hover:  "var(--brand-600)"         # Hover Primary Fill
  brand-tint:   "var(--brand-50)"          # Selected row / Focus Halo
  brand-ink:    "var(--brand-500)"         # Brand-as-text on light surface (~7.2:1 AAA)
  on-brand:     "var(--white-pure)"        # Text ON solid brand fill (8.9:1 AAA / Lc 88)

  bg:           "var(--neutral-50)"        # Page Canvas Base
  grid:         "oklch(72% 0.04 264.18 / 0.14)" # 32px Continuous Coordinate Grid
  surface:      "var(--white-pure)"        # Card Plates / Popovers
  surface-2:    "var(--neutral-100)"       # Table Header / Inset / Hover
  ink:          "var(--neutral-900)"       # Primary Text (13.5:1 / Lc 98)
  ink-2:        "var(--neutral-700)"       # Secondary Text / Labels (5.6:1 / Lc 78)
  ink-3:        "var(--neutral-600)"       # Muted / Metadata (3.6:1 / Lc 61)
  line:         "var(--neutral-300)"       # 1px Hairline Dividers
  line-2:       "var(--neutral-400)"       # Control Borders

  success:      "var(--green-500)"         # GA / Deployed
  warning:      "var(--amber-500)"         # Planned / Stale
  critical:     "var(--red-500)"           # Broken / Unavailable
  info:         "var(--sky-500)"           # System Notice

grid_geometry:
  master_unit: "32px"                      # 1.00G Master Cell
  symmetry_axis: "16px"                    # 0.50G Symmetry Axis
  corner_tick: "8px"                       # 0.25G Corner Mark
  hairline_offset: "4px"                   # 0.125G Minor Offset
  sidebar_width: "224px"                   # 7G (7 * 32px)
  canvas_width: "1120px"                   # 35G (35 * 32px, 100% Border Coincidence)
  header_height: "64px"                    # 2G (2 * 32px)

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
    fontSize: "0.9375rem"                    # 15px card / service name
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter"
    fontSize: "0.9375rem"                    # 15px
    fontWeight: 400
    lineHeight: 1.55                         # 24px line height (0.75G) -> 4 lines = 3G (96px)
  label:
    fontFamily: "Inter"
    fontSize: "0.8125rem"                    # 13px supporting text
  detail:
    fontFamily: "Inter"
    fontSize: "0.75rem"                      # 12px metadata / help (floor for content)
  mono:
    fontFamily: "IBM Plex Mono"
    fontSize: "0.75rem"                      # 12px — INLINE CODE & identifier tags ONLY
    fontWeight: 600
    letterSpacing: "0.05em"

rounded:
  xs: "3px"        # controls (buttons, inputs)
  sm: "4px"        # cards / panels (--card-r)
  md: "6px"
  lg: "10px"
  chip: "2px"      # chips / badges

components:
  button-primary:   { backgroundColor: "var(--color-brand)", textColor: "var(--color-on-brand)", rounded: "3px", height: "32px", fontSize: "13px", fontWeight: 600 }
  button-secondary: { backgroundColor: "var(--color-surface)", textColor: "var(--color-ink)", border: "1px solid var(--color-line-2)", rounded: "3px", height: "32px" }
  button-ghost:     { backgroundColor: "transparent", textColor: "var(--color-ink-2)", rounded: "3px", height: "32px" }
  input:            { height: "32px", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-line)", rounded: "3px", focus: "border var(--color-brand); ring 3px var(--color-brand-tint)" }
  chip:             { fontFamily: "Inter", fontSize: "11px", fontWeight: 600, rounded: "2px", border: "1px solid var(--color-line-2)", backgroundColor: "transparent", height: "24px" }
  service-card:     { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-line)", rounded: "4px", padding: "16px", accent: "brand corner ticks (8px)" }
  table:            { fontSize: "13px", numerics: "tabular-nums", header: "Inter uppercase 11px tracked (height 32px)", row: "height 48px" }
  sidebar:          { width: "224px (7G)", header: "64px (2G)", item: "32px (1G)", spacer: "32px (1G)", footer: "64px (2G)" }
---

# Design System: Atlas Portal — "Blueprint" & "better-colors"

## 1. Visual Theme & Atmosphere

**Creative North Star: "The Engineering Drawing."**

Atlas is an instrument, not a destination. An engineer arrives mid-task with one question — which service to adopt, whether a service is available in a region, whether a choice is policy-approved — and a deadline. The interface answers fast and gets out of the way. It earns attention through information integrity, never spectacle.

### Mathematical Geometry Axioms ($G = 32\text{px}$)
1. **Global Continuous 32px Grid**: The coordinate grid originates at $(0, 0)$ and continues uninterrupted across the entire page. All cards, tables, headers, and panels have outer borders strictly coincident ($X \pmod{32} = 0, Y \pmod{32} = 0$) with grid lines.
2. **Sidebar Quantization ($7G = 224\text{px}$)**: All sidebar rows, headers, items, and spacers are strictly quantized into $32\text{px}$ ($1G$) and $64\text{px}$ ($2G$) cells.
3. **Canvas Snap ($35G = 1120\text{px}$)**: Canvas width is fixed to $1120\text{px}$. 4-column rows ($4 \times 256\text{px} + 3 \times 32\text{px} = 1120\text{px}$) and 3-column rows ($3 \times 352\text{px} + 2 \times 32\text{px} = 1120\text{px}$) snap 100% to outer grid boundaries.
4. **Zero-Slicing Vertical Text Rhythm**: Text row centers align with $32\text{px}$ grid centers ($Y_{\text{mid}} = 16\text{px}, 48\text{px}, 80\text{px}, \dots$), ensuring no horizontal grid line slices through text glyphs.

---

## 2. Color System: better-colors Architecture

Based on Jakub Krehel's **better-colors** principles, the color system is structured into two strict tiers:

### Tier 1: Primitives (The Value Tier)
- **Hold the Hue**: Hue remains constant end-to-end across each ramp ($264.18^\circ$ for Brand & Neutral, $152^\circ$ for Green, $75^\circ$ for Amber, $25^\circ$ for Red, $230^\circ$ for Sky).
- **Chroma Bell-Curve**: Chroma peaks in the middle ($0.3059$ at Brand 500) and tapers to near-zero at extremes ($<0.005$ at Neutral 50 and 950).
- **Denser Light Stepping**: Step spacing is finer at the light end ($50 \to 200$) to provide distinct surface layering without color distortion.
- **Rule**: Primitives describe what a color *is* and are **never** applied directly in UI components.

### Tier 2: Semantics (The Role Tier)
Semantic tokens name a job and point to a primitive. UI components only ever reference semantic tokens:
- **Surfaces**: `--color-bg` (canvas), `--color-surface` (card plate), `--color-surface-2` (table header/hover).
- **Text**: `--color-ink` (primary text), `--color-ink-2` (secondary text), `--color-ink-3` (muted text), `--color-on-brand` (text on solid brand).
- **Borders**: `--color-line` (hairline separator), `--color-line-2` (control border).
- **Accent**: `--color-brand` (primary solid action), `--color-brand-hover` (action hover), `--color-brand-tint` (selected row/halo), `--color-brand-ink` (brand text).
- **Status**: `--color-{success|warning|critical|info}`.

### Contrast Verification Matrix
- **Primary Text on Surface**: WCAG **13.5:1 (AAA)** · APCA **Lc 98** (Target: Lc 90+).
- **Secondary Text on Surface**: WCAG **5.6:1 (AA)** · APCA **Lc 78** (Target: Lc 75+).
- **Muted Text on Surface**: WCAG **3.6:1 (AA UI)** · APCA **Lc 61** (Target: Lc 60+).
- **Text on Brand Button**: WCAG **8.9:1 (AAA)** · APCA **Lc 88** (Target: Lc 75+).
- **Brand as Text on Surface**: WCAG **7.2:1 (AAA)** · APCA **Lc 82**.

---

## 3. One Color, One Meaning

1. **Brand Hue (`#001AFF` / `264.18°`)**: Strictly reserved for interactive actions, focus rings, selected table rows, and active navigation.
2. **Headings and Metrics**: Render in high-contrast neutral ink (`--color-ink`), never tinted arbitrarily with brand color.
3. **Status Indicators**: Always pair color with an icon, tag, or label for accessibility.
4. **Action Emphasis**: Exactly one solid primary action button per view; secondary and ghost buttons remain neutral.

---

## 4. Typography Rules

- **Sans-serif Font**: Inter (Self-hosted variable font).
- **Mono Font**: IBM Plex Mono — strictly for inline codes and identifier slugs (never for full table columns).
- **Scale**:
  - Hero Display: `32px` / line-height `48px` ($1.5G$).
  - Section Heading: `22px` / line-height `32px` ($1.0G$).
  - Card Title: `15px` / line-height `24px` ($0.75G$).
  - Body Text: `15px` / line-height `24px` ($0.75G$) — 4 lines $= 96\text{px} = 3G$.
  - Inline Code / Slug: `12px` / line-height `16px` ($0.5G$).

---

## 5. Contractual Component Geometry & Hard Gates

Every React component built for Atlas must strictly implement these exact bounding box coordinates, internal padding rules, and centerline locks:

### A. Small Metric Card (`MetricCardSM`: $256\text{px} \times 96\text{px} = 8G \times 3G$)
- **Row 1 ($0\sim32\text{px}$, 1G)**: Top Header (Label + Status Chip), height $32\text{px}$.
- **Row 2 ($32\sim64\text{px}$, 1G)**: Metric Big Number (`142`), height $32\text{px}$, font $32\text{px}$ `tnum`.
- **Row 3 ($64\sim96\text{px}$, 1G)**: Subtext (`✓ 12 New`), height $32\text{px}$.

### B. Large Metric Card (`MetricCardLG`: $352\text{px} \times 160\text{px} = 11G \times 5G$)
- **Top Row**: `top: 19px; height: 24px;` $\to$ Centerline $Y = 32\text{px}$ (Grid Line 1).
- **Metric Big Number (`142`)**: `top: 57px; height: 44px; font-size: 42px; line-height: 44px;` $\to$ Centerline $Y = 80\text{px}$ (Midpoint between Grid Line 2 [64px] and Grid Line 3 [96px]).
- **Bottom Row**: `top: 117px; height: 20px;` $\to$ Centerline $Y = 128\text{px}$ (Grid Line 4).
- **Clearances**: Top margin 22px, gap 1 12px, gap 2 16px, bottom margin 22px ($22+24+12+44+16+20+22 = 160\text{px}$).

### C. Color Swatch Card (`ColorSwatchCard`: $256\text{px} \times 128\text{px} = 8G \times 4G$)
- **Preview Plate**: $0\sim64\text{px}$ ($2G$).
- **Details Plate**: $64\sim128\text{px}$ ($2G$, total height 64px, `padding: 10px 16px 12px 16px; display: flex; flex-direction: column; justify-content: space-between;`).
- **Title Row**: `height: 18px; line-height: 18px; font-size: 12px; font-weight: 700;`.
- **Grid Line 3 ($Y = 96\text{px}$)**: Sits in the 8px negative space between Title and Metadata (4px clearance above, 4px clearance below).
- **Metadata Row**: `height: 16px; line-height: 16px; font-size: 10.5px; font-family: var(--font-mono);`.

### D. Blueprint Data Table (`BlueprintTable`: Height Multiples of $32\text{px}$)
- **Container CSS**: `margin: -1px; width: calc(100% + 2px); border-collapse: collapse;`
- **Header Row (`th`)**: Height $= 32\text{px}$ ($1G$), bottom line sits exactly on $Y \pmod{32} = 0$.
- **Data Rows (`tr`)**: Height $= 64\text{px}$ ($2G$), row dividers sit exactly on $Y \pmod{32} = 0$.

### E. Controls Suite (`Button`, `Input`, `Chip`, `Switch`)
- **Buttons**: `sm` $24\text{px}$ ($0.75G$), `md` (standard) $32\text{px}$ ($1.0G$), `lg` $48\text{px}$ ($1.5G$). Radius: $3\text{px}$ (`--radius-md`).
- **Inputs**: Height $32\text{px}$ ($1G$), Radius $3\text{px}$.
- **Chips / Badges**: Height $24\text{px}$ ($0.75G$), Radius $2\text{px}$ (`--radius-chip`).
- **Switches**: Row Height $96\text{px}$ ($3G$).

---

## 6. React Implementation Rules & Verification Hard Gates

1. **Strict 2-Tier Token Architecture**: Components only consume semantic tokens (`--color-bg`, `--color-surface`, `--color-ink`, `--color-brand`, etc.). Never apply Tier 1 raw primitives in components.
2. **Tabular Numerics**: All numeric values must have `font-variant-numeric: tabular-nums; font-feature-settings: "tnum";`.
3. **Automated Verification Loop**:
   - `pnpm tsc` (0 type errors)
   - `pnpm lint` (0 lint warnings/errors)
   - `pnpm run audit:grid` (100% Playwright grid score across all 4 viewports)
   - `pnpm test` (All unit & integration tests pass)
4. Reference full architectural specification in [`docs/architecture/react_blueprint_hard_gates.md`](docs/architecture/react_blueprint_hard_gates.md).
