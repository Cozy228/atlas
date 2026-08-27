# React Blueprint Hard Gate Specification & Engineering Rules

This document establishes the **authoritative, non-negotiable Hard Gate Rules** for all AI agents and engineers implementing the React/Vite/Tailwind version of the Atlas Blueprint Portal.

---

## 1. Master Grid Coordinate Axioms ($G = 32\text{px}$)

```
   ┌─────────────────── 32px (1G Master Grid Cell) ───────────────────┐
   │                                                                   │
   │  0px             8px             16px            24px        32px │
   │  ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌┤
   │  [Origin]      [0.25G Tick]   [0.5G Symmetry] [0.75G Control] [1.0G]
   │                                                                   │
   └───────────────────────────────────────────────────────────────────┘
```

### Non-Negotiable Coordinate Gates
1. **Global Zero Origin ($0, 0$)**: The coordinate grid originates at the top-left $(0, 0)$ of the document and spans continuously across the page.
2. **Outer Bounding Box Coincidence**:
   Every container, section, card, table, panel, header, and sidebar MUST satisfy:
   $$\text{Top} \pmod{32} = 0, \quad \text{Bottom} \pmod{32} = 0, \quad \text{Height} \pmod{32} = 0, \quad \text{Width} \pmod{32} = 0$$
   Outer borders must lie directly on physical $32\text{px}$ grid lines with zero phase shift.
3. **Canvas Snap ($35G = 1120\text{px}$)**:
   The main content canvas width is fixed at $1120\text{px}$ ($35 \times 32\text{px}$).
   - **4-Column Grid**: $4 \times 256\text{px} (8G) + 3 \times 32\text{px} (1G) = 1120\text{px}$ ($35G$)
   - **3-Column Grid**: $3 \times 352\text{px} (11G) + 2 \times 32\text{px} (1G) = 1120\text{px}$ ($35G$)
   - **2-Column Grid**: $2 \times 544\text{px} (17G) + 1 \times 32\text{px} (1G) = 1120\text{px}$ ($35G$)
   - **1-Column Grid**: $1 \times 1120\text{px}$ ($35G$)
   - **Column Gutters**: Exactly $32\text{px}$ ($1G$), split symmetrically ($16\text{px} + 16\text{px}$) across the vertical grid line.
4. **Sidebar Quantization ($7G = 224\text{px}$)**:
   - Width: $224\text{px}$ ($7G$).
   - Brand Header: $64\text{px}$ ($2G$).
   - Nav Items: $32\text{px}$ ($1G$).
   - Section Spacers: $32\text{px}$ ($1G$).
   - Sunk Footer: $64\text{px}$ ($2G$).
5. **Top Sticky Header**:
   - Height: $64\text{px}$ ($2G$, $Y \in [0, 64\text{px}]$).
   - Breadcrumb & Actions: Height $32\text{px}$ ($1G$), top margin $16\text{px}$, bottom margin $16\text{px}$.
   - Vertical Centerline: Strictly locked on Grid Line 1 ($Y = 32.0\text{px}$).
   - Placement: Full-width fluid with `padding: 0 32px; justify-content: space-between;`. Action tools stay on the **Top Right**.

---

## 2. Zero-Glyph-Slicing & Typographical Rhythm Gates

1. **Centerline Alignment**:
   Single-line labels, chips, action buttons, and card headers must have their geometric vertical centers placed on grid lines ($Y = 32, 64, 96, 128\dots$) or cell midpoints ($Y = 16, 48, 80, 112\dots$).
   **Rule:** A $32\text{px}$ grid line must NEVER slice through the baseline or body of text glyphs.
2. **Multi-line Body Rhythm**:
   Body text line-height is locked to $24\text{px}$ ($0.75G$).
   $$\text{4 lines of body text} = 4 \times 24\text{px} = 96\text{px} = 3G$$
   This guarantees that every 4 lines of copy re-synchronize 100% with the master grid.
3. **Font Family Disciplines**:
   - `Inter Variable`: Used for all UI copy, headers, labels, buttons, tables, and metric displays.
   - `IBM Plex Mono`: Strictly reserved for code blocks, inline snippets, UUIDs, and technical identifier tags. **Never use mono for full table columns or general prose.**
4. **Tabular Numerics**:
   All metrics, counters, currency, timestamps, and numeric table cells must apply `font-variant-numeric: tabular-nums; font-feature-settings: "tnum";`.

---

## 3. Contractual React Component Geometry Matrix

### A. Small Metric Card (`MetricCardSM`: $256\text{px} \times 96\text{px} = 8G \times 3G$)
```
Y = 0px   ┌───────────────────────────────────────────────────────────┐ [Top Border]
          │  CATALOG SERVICES                          [● GA v2.4]    │ 【Cell 1: 0~32px (1G), Height 32px】
Y = 32px  ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ [Grid Line 1]
          │  142                                                      │ 【Cell 2: 32~64px (1G), Height 32px, Font 32px tnum】
Y = 64px  ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ [Grid Line 2]
          │  ✓ 12 New deployed this week                              │ 【Cell 3: 64~96px (1G), Height 32px】
Y = 96px  └───────────────────────────────────────────────────────────┘ [Bottom Border]
```

### B. Large Metric Card (`MetricCardLG`: $352\text{px} \times 160\text{px} = 11G \times 5G$)
```
Y = 0px   ┌───────────────────────────────────────────────────────────┐ [Top Border (0G)]
          │  (22px Top Clearance)                                     │
Y = 32px  ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ [★ CATALOG SERVICES Centerline: Y=32px (1G)]
          │  CATALOG SERVICES                           [● GA v2.4]   │ (Top: 19px, Height: 24px)
          │  (12px Gap)                                               │
Y = 64px  ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ [Grid Line 2 (2G)]
          │  142                                                      │ (Top: 57px, Height: 44px, Font: 42px, Centerline: Y=80px)
Y = 96px  ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ [Grid Line 3 (3G)]
          │  (16px Gap)                                               │
Y = 128px ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ [★ ✓ 12 New Centerline: Y=128px (4G)]
          │  ✓ 12 New deployed this week                              │ (Top: 117px, Height: 20px)
          │  (22px Bottom Clearance)                                  │
Y = 160px └───────────────────────────────────────────────────────────┘ [Bottom Border (5G)]
```

### C. Color Swatch Card (`ColorSwatchCard`: $256\text{px} \times 128\text{px} = 8G \times 4G$)
```
Y = 0px   ┌───────────────────────────────────────────────────────────┐ [Top Border (0G)]
          │  COLOR PREVIEW PLATE (64px = 2G Solid Background)         │ 【Preview Plate: 0~64px (2G)】
Y = 64px  ├───────────────────────────────────────────────────────────┤ [64px Border Line (2G)]
          │  (10px Top Padding)                                       │
          │  --color-primary                                   Copy   │ 【Title: Height 18px, Font 12px 700】
Y = 96px  ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ [★ 96px Grid Line in 8px Typographical Gap]
          │  Role: Action                          var(--neutral-900) │ 【Metadata: Height 16px, Font 10.5px Mono】
          │  (12px Bottom Padding)                                    │
Y = 128px └───────────────────────────────────────────────────────────┘ [Bottom Border (4G)]
```

### D. Blueprint Data Table (`BlueprintTable`: Height Multiples of $32\text{px}$)
- Container CSS: `margin: -1px; width: calc(100% + 2px); border-collapse: collapse;`
- Header Row (`th`): Height $= 32\text{px}$ ($1G$), bottom line sits exactly on $Y \pmod{32} = 0$.
- Data Rows (`tr`): Height $= 64\text{px}$ ($2G$), row divider sits exactly on $Y \pmod{32} = 0$.

### E. Controls Suite
- **Buttons (`Button`)**:
  - `sm`: $24\text{px}$ ($0.75G$).
  - `md` (standard): $32\text{px}$ ($1.0G$).
  - `lg`: $48\text{px}$ ($1.5G$).
  - Border Radius: $3\text{px}$ (`--radius-md`).
- **Inputs (`Input`)**: Height $32\text{px}$ ($1G$), Radius $3\text{px}$.
- **Chips / Badges (`Chip`)**: Height $24\text{px}$ ($0.75G$), Radius $2\text{px}$ (`--radius-chip`).
- **Switches (`Switch`)**: Row Height $96\text{px}$ ($3G$).

---

## 4. 2-Tier Color Architecture ("better-colors") Contract

```
┌───────────────────────────────────────────────────────────────┐
│ TIER 1: PRIMITIVES (Hold-the-Hue Ramps: 50, 100, ..., 950)    │
│ [DO NOT USE IN COMPONENTS DIRECTLY]                           │
└───────────────────────────────┬───────────────────────────────┘
                                │ maps to
                                ▼
┌───────────────────────────────────────────────────────────────┐
│ TIER 2: SEMANTICS (Role Mappings)                             │
│ --color-bg, --color-surface, --color-ink, --color-brand, etc. │
│ [COMPONENTS ONLY EVER CONSUME TIER 2 SEMANTIC TOKENS]         │
└───────────────────────────────────────────────────────────────┘
```

1. **Hold the Hue**: All neutrals and brand tints share Hue $264.18^\circ$. Green $152^\circ$, Amber $75^\circ$, Red $25^\circ$, Sky $230^\circ$.
2. **One Color, One Meaning**:
   - Brand Blue (`#001AFF` / `264.18°`): Reserved strictly for interactive actions, focus rings, selected rows, and active nav.
   - Headers, metric numbers, and body text: Always neutral ink (`--color-ink`), never arbitrarily tinted blue.
   - Status indicators: Always paired with an icon or text label for accessibility.
3. **Contrast Minimums**:
   - Primary Text: $\ge 13.5:1$ (AAA), APCA Lc 98.
   - Text on Brand Button: $\ge 8.9:1$ (AAA), APCA Lc 88.
   - Brand Text on Light Surface: $\ge 7.2:1$ (AAA), APCA Lc 82.

---

## 5. Automated Verification Gates & CI Execution

Every AI agent implementing React code must execute and satisfy all 4 gates before ending a turn:

```bash
# 1. Typecheck: Zero TypeScript diagnostics
pnpm tsc

# 2. Lint: Zero Oxlint errors or warnings
pnpm lint

# 3. Grid & Geometry Audit: Multi-viewport Playwright suite (100% PASS required)
pnpm run audit:grid

# 4. Component Unit & Integration Tests
pnpm test
```
