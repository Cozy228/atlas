# Atlas Design System — prototype notes

> **Status: CONCLUDED.** The design system is now settled and written up in the root
> [`DESIGN.md`](../DESIGN.md) — that is the source of truth. This `prototype/` folder is **kept, not
> deleted**: `atlas-design-system.html` is the living **reference implementation** (open it to see the
> system in motion; light = `#blueprint`, dark = `#blueprint-ink`).

## Final system (what was locked)

- **One direction: "Blueprint"** (engineering-drawing aesthetic) in **two schemes** — Blueprint
  (light, primary) + **Ink** (dark). Graphite and the deep-blue dark were dropped; the Index
  direction was dropped (its numbered-entry layout survives as the Document Sources component).
- **Brand `#001AFF`** for action/selection only (≤10%); OKLCH-native hue-264 neutral field.
- **Coordinate grid** in negative space only, masked behind copy by same-colour plates; no full-width
  section dividers.
- **Tables**: Inter + tabular figures, no mono columns (best practice). **Mono** = inline code &
  identifier tags only.
- **Top nav**: brand left · tabs centred (brand underline) · search + theme icons right; **Ask = FAB**.

## Page designs worth keeping (validated here, carry into the real portal)

These prototype sections are the patterns to reuse (all in `atlas-design-system.html`):
- **§06 Capability cards** — surface card + **brand corner ticks**, icon on brand-tint, mono slug,
  status chips, mono owner/channel footer, arrow nudge on hover. The catalog's primary unit.
- **§07 Document Sources** — **numbered reference entries in a solid panel** (tabular numeral, title,
  `type · id` tag, description, status chips, right-aligned owner · freshness · source link). Reuse
  as any "sources / documents" list; ties directly to the evidence/sources surface.
- **§08 Dense data** — Inter + `tabular-nums` table, drawing-grid hairlines, identifier by weight
  (not mono), dot+label status, brand-tint selected row.
- **§09 Regional availability** — **status-dot grid + legend** (GA / Planned / Not-available ring).
- Also worth keeping: the **evidence callout** (`[n]` + claim + cite link), **calm alerts**
  (stale / broken-anchor), **skeleton loading**, and the **teaching empty state** (§10).

## The question

"What should the Atlas design system look like?" — a fresh visual direction (ignore the
current implementation), anchored on the one hard requirement **brand `#001AFF`**, that fits
the product tonality, stays clean / not flashy / modern, and can grow. This stage's job is to
**lock a design system** before any detailed UI refinement.

## How to run

```bash
cd prototype
python3 -m http.server 8753
# open http://localhost:8753/atlas-design-system.html
```

Flip directions with the floating bottom bar, the `←` / `→` keys, or the URL hash
(`#blueprint`, `#console`, `#index`). Each direction is a *complete, committed* system:
tokens (color / type / space / radius / elevation) + a full component gallery with every state.
All data is fictional (public-safe).

---

## Design philosophy (synthesised from product tonality, not the old design)

**North star — Atlas is an instrument, not a destination.** An engineer arrives mid-task with
one question (which capability, which region, is this approved) and a deadline. The interface
answers fast and gets out of the way. It earns attention through information integrity, never
visual spectacle.

**Principles that drive every token and component:**

1. **Evidence before confidence.** Every authoritative claim shows its source. Citation /
   evidence styling is a first-class component, not an afterthought.
2. **Density is a feature.** Whitespace is for rhythm, not padding thin content. Clarity comes
   from structure (rules, alignment, type weight), not from reduction.
3. **One brand signal.** `#001AFF` means exactly one thing — *act here* or *this is selected* —
   and stays under ~10% of any screen. Its value is its rarity. Everything else is a tinted
   neutral field. Four fixed semantic hues (success / warning / critical / info) never fold
   into the brand.
4. **Calm under load.** Stale sources, broken anchors, missing data are *expected* states,
   communicated plainly — never with alarm styling that breaks flow.
5. **Platform vocabulary is sacred, and visibly machine-structured.** Slugs, types, authority
   levels, channels render in monospace so "this is a system value" is legible at a glance.
   Mono never carries running prose.
6. **Ship-state honesty.** No decorative "Live / Synced" signals; an indicator is wired to real
   data or it's absent.
7. **OKLCH-native, AA-floor.** All color in OKLCH; neutrals tinted toward the brand hue (264);
   body text ≥ 4.5:1, large text ≥ 3:1; respect `prefers-reduced-motion`.

---

## The three directions

All share: hue-264 tinted neutrals, `#001AFF` as the sole action/selection signal, four fixed
semantic hues, mono for platform vocabulary, flat-by-tonal-layering (shadow = transient state
only), 4px spacing base. They differ in **material and structure**, not just color.

| | **Blueprint** | **Console** | **Index** |
|---|---|---|---|
| Metaphor | engineering drawing / map | observability console | institutional documentation |
| Scheme | light, cool paper | dark, near-black | light, true-neutral |
| Display type | Inter | IBM Plex Mono | Spectral (serif) |
| **Capability layout** | **card grid** + corner ticks | **dense log rows** (region status dots) | **numbered reference entries** + rules |
| **Buttons** | crisp hairline (border → brand on hover) | keycap (inset edge), electric primary | link-led: secondary is an underlined link, not a box |
| **Inputs** | hairline, mono placeholder | command line `>` + ⌘K, mono | tall, rounded, roomy |
| **Chips** | square, hairline | dot + mono | pill, soft tint |
| **Table** | visible drawing grid (v+h rules) | all-mono dark, tight | quiet — horizontal rules only |
| Radius | 3-4px (instrument) | 4-6px | 6-10px |
| `#001AFF` role | drawing ink (links, primary, active, ticks) | electric selection signal that pops on black | citation / link blue + primary |
| Best for | the default catalog at speed | engineers who live in dark tools | reading & trusting long reference content |

Each direction now differs in **structure**, not just color — different capability layout, button
model, input metaphor, chip shape, and table treatment. (First pass shared component markup and
only reskinned it; that read as "three of the same".)

### Review round 1 (decisions so far)

- **Locked on Blueprint:** hero (eyebrow + display), the faint blue + coordinate-grid background,
  the per-section divider (index number + rule), color, typography. Confirmed comfortable.
- **Keep all three genuinely different** (user's call): differentiation now lives at the component
  level, not just color — see the table above.
- **Buttons** were rebuilt per direction (were "all bad" in pass 1).
- **Console dark** layering re-tuned (surfaces step more; brand only marks real signals).
- **Dense data** font-soup fixed: one size per table; mono only on the slug column.
- **Availability** switched from a text matrix to a status-dot grid + legend.

**Index** caveat to keep in mind: Spectral serif is headings-only (never labels / data / buttons)
and serif at small sizes is the weakest link in Windows rendering (see below).

### Review round 2

- **Blueprint locked further:** buttons (light) approved; inputs, chips, capability cards all good.
- **Font-consistency rule, finalised:** within any data region, the *only* mono is the identifier
  column (slug / capability name). Everything else — type, owner, status, and the chips themselves
  (`table .chip { font-family: inherit }`) — uses the interface font. Placeholders inherit the
  field's own font (killed a Blueprint-only mono-placeholder rule that made placeholder ≠ typed text
  ≠ disabled text). Availability sizes unified to 13px.
- **Console** reads as the weakest of the three; its log-row capability list is not as strong as
  Blueprint's cards. Open question: rework, shelve, or demote to Blueprint's dark mode.
- **Index keeper:** the numbered reference-entry capability layout is liked as a pattern — a good
  fit for a **Sources / Documents list** component, independent of which direction wins overall.

### Review round 3 — converged

- **Console demoted to Blueprint's dark mode** (user's call). It is no longer an independent
  direction: it now reuses Blueprint's entire structure (cards, corner ticks, hairline controls,
  drawing-grid tables, status dots, grid background) and only swaps in a dark palette. The log-row
  capability list, command-line search, and keycap buttons are gone.
- **The system is now:** **Blueprint** (light, primary) · **Blueprint · Dark** (same system,
  recoloured) · **Index** (editorial alternative + the Sources/Documents list pattern).
- Implementation note: structural rules are shared via `html[data-variant^="blueprint"]`; the two
  schemes differ only in their token block. One system, two schemes — nothing maintained twice.
- The earlier "Blueprint / Console / Index" comparison table above is superseded by this.

### Review round 4

- **Background grid → dot grid.** The square line-grid clashed with section divider hairlines
  (two near-parallel lines a few px apart). Switched to a faint coordinate **dot grid** (radial
  dots at 32px), which keeps the technical/graph feel but never collides with section rules.
- **Dense-table typography fixed per best practice (researched, not asserted).** Sources:
  [A List Apart](https://alistapart.com/article/web-typography-tables/),
  [Datawrapper](https://blog.datawrapper.de/fonts-for-data-visualization/),
  [FontAlternatives](https://fontalternatives.com/blog/best-fonts-dense-dashboards/). Rule:
  **monospace is only for code / commands / paths, not data-table columns.** Tables now use Inter
  throughout + `font-variant-numeric: tabular-nums`; the identifier column is emphasised by
  **weight**, not a font switch; headers are sans uppercase. Mono is reserved for inline code
  (e.g. `eu-west-1`) and identifier tags (card slugs).
- **Index direction dropped.** Its numbered reference-entry layout was promoted to a first-class
  **Document Sources** section inside Blueprint (does not replace Capabilities).
- **Dark mode: three candidate schemes** to choose from, all sharing Blueprint's structure —
  **Graphite** (neutral low-chroma), **Ink** (near-black, high contrast/OLED), **Blueprint**
  (deep-blue drafting paper, most thematic, more visible dot grid).
- **System is now:** Blueprint (light, primary) + one chosen dark scheme. Switcher carries the
  light scheme plus all three dark candidates for comparison.

### Review round 5

- **Dot grid rejected; square grid restored.** The dot grid was "absolutely not acceptable". Went
  back to the square grid the user liked originally. Resolved the original clash properly this time:
  a square grid and full-width horizontal section dividers are physically incompatible (any hairline
  lands a few px off a grid line → double line), so **the full-width section dividers were removed**
  (section/hero borders, block-head rule). The grid's own lines + numbered headings carry section
  rhythm. (If divider lines are wanted back, the only clean way is a margin/frame grid — flagged.)
- **Deep-blue dark dropped.** Down to two dark candidates: **Graphite** and **Ink** (undecided).
- **Top-nav active state fixed for dark.** It used `brand-tint`, which in dark sits ~3% lightness
  from the surfaces → the active pill was nearly invisible. Now `color-mix(brand 16%, transparent)`
  + brand-ink text — one rule, brand-driven, works in both schemes.
- **Open:** pick Graphite vs Ink.

### Review round 6

- **Grid restored** to the original value (`oklch(72% 0.04 264.18 / 0.08)`); the tuned value read "off".
- **Grid now starts from the nav, never truncated.** Moved the grid off `body` onto a `.canvas`
  wrapper that begins *below* the top bar, and made the top bar opaque. The grid begins cleanly at
  the nav's bottom edge instead of bleeding through a translucent bar as a half-cell.
- **Graphite grid made fainter** (alpha 0.05 → 0.03) so it's as unobtrusive as Ink. User leans Ink
  precisely because its grid is subtler; both are now subtle.
- **Top-nav active, dark, fixed again.** Now `color-mix(brand 20%, transparent)` pill + neutral
  `--ink` text (was light-blue `brand-ink`, which read muddy on dark).
- **Text blocks must sit on solid surfaces (no grid bleed).** Document Sources (07) is now a solid
  surface panel; the grid no longer shows through the copy and its row dividers are panel rows, not
  near-misses against the grid. Principle: the coordinate grid is ambient texture for negative space;
  any block with running text/data sits on a solid surface (cards & tables already did).
### Review round 7 — grid model settled

- **Decision: grid only in negative space.** The content column (`.page`) is now a solid sheet of
  `--bg`; the grid lives on the full-width `.canvas` behind it, so it shows **only in the side
  margins** and never behind any copy. (On narrow viewports the column fills the width and the grid
  recedes — acceptable; it's a wide-screen framing device.)
- **Section dividers restored.** Because content sits on a solid surface, the full-width section /
  hero / block-head rules no longer clash with the grid — so the "section divider" treatment the
  user liked early on is back, clash-free.
- Net: the grid is a drafting-sheet frame in the margins; the content is clean ruled paper. Verified
  light + Ink dark.
### Review round 9 — dark locked + top nav

- **Dark scheme locked: Ink** (near-black, high contrast). Graphite dropped. System = Blueprint
  light + Ink dark.
- **Top nav redesigned (option N1).** Presented four candidate bars in-page to compare; user picked
  N1: brand left · **tabs centered** (3-col grid `1fr auto 1fr`) · **search + theme icons far right**.
  Active tab = brand underline. **"Ask Atlas" moved out of the bar into a floating action button**
  (bottom-right). Top bar is opaque so the grid starts cleanly below it.

### Review round 8 — grid integration (final model)

- **"Grid only in the margins" was rejected** ("might as well not have it"). Correct model: the grid
  fills the whole content area and shows in *all* negative space; it's masked **only directly behind
  copy**, not behind the whole column.
- Implementation: removed the solid `.page` sheet. Grid is back on the full `.canvas`. Each text
  block (`hero h1/p`, `eyebrow`, `lede`, `subhead`, `block-head`, `cat-label`, `legend`) carries a
  **same-colour plate** (`background: var(--bg)`, hugging its text via `inline-flex`/`fit-content`)
  that masks the grid right behind the words; cards/tables/panels already do this. Grid shows in the
  gaps (paragraph right edge, between cards, between blocks).
  - Bug fixed mid-round: the heading/category/legend originals (`display:flex`, defined later in the
    sheet) overrode the plate rule and painted full-width bars (invisible in light, black bars in
    dark). Fixed by setting the plates on the original rules so they hug content.
- **Section dividers removed again** (full-width rules clash with a grid that's now behind content).
- **Top-nav active, take 3:** dropped the pill entirely. Now a **brand underline** (`inset 0 -2px 0`)
  + bold `--ink` text — clean and identical logic in light and dark, no muddy fill.

---

## Type rendering & Windows 11 parity

The biggest cross-platform risk is Windows falling back to **Segoe UI with synthesised bold
weights**, which makes the same screen look heavier / different on Windows than on macOS.
Decisions baked into all three directions:

- **Webfonts, not system fonts.** Inter / IBM Plex Mono / Spectral load as webfonts (in the
  real portal: self-host via `@fontsource-variable/*`). This removes the Segoe fallback.
- **`font-synthesis: none`** — forbids fake bold/italic; only real weights render.
- **`font-optical-sizing: auto`** — keeps Inter's optical sizing correct everywhere.
- **Weight floor 400 for body.** Windows rasterises via ClearType / DirectWrite with heavier
  stems; `-webkit-font-smoothing` is a macOS-only no-op, so we never lean on it and never use
  300-weight body text (it looks fine on mac, fragile on Windows).
- **Size floor ~11px, content ≥ 12px.** Sub-11px text smears under ClearType. The smallest
  decorative mono caption is 11px; functional body/labels stay ≥ 12px.
- **Serif caveat (Index only).** Spectral is restricted to headings ≥ ~22px, where Windows
  serif rendering holds up; it's never used at label/data sizes.

To eyeball Windows behaviour from macOS: disable font-smoothing in the browser, or check on an
actual Windows 11 box before locking — the webfont + `font-synthesis:none` combo should make the
two platforms match closely.

---

## Verdict / next step

- [ ] Pick the winning direction (default recommendation: **Blueprint + Console dark mode**).
- [ ] Once locked, write the full `DESIGN.md` (getdesign.md 9-section format) for that direction
      and, if desired, hand to a detailed UI refinement pass.
- [ ] Then delete this `prototype/` folder — the decision is the keepsake, not the code.

_Battle-tested in-browser across all three directions (light + dark). Bugs caught and fixed during
testing: (1) brand-as-text (`--brand-ink`) was near-white in the two light directions, making
links / active nav / "Selected" & "Approved" chips / card icons invisible; (2) the "not available"
status dot rendered as a tall dashed box — class collision between `dot empty` and the empty-state
`.empty` rule; renamed to `.na`._
