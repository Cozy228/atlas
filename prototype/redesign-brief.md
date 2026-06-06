# Brief for Claude Design — Atlas Portal "Blueprint" redesign

> Paste this as the **shared context / system brief** for both stages. The work runs in two stages:
> **Stage 1 — Claude Design** designs each page → [`redesign-goal-design.md`](./redesign-goal-design.md);
> **Stage 2 — Claude Code** builds it into `portal/` → [`redesign-goal-build.md`](./redesign-goal-build.md).
> Read the brief + the goal for whichever stage you're in.

You are redesigning the **Atlas Portal** front-end to a finished design system called **"Blueprint."**
The system is already decided and documented — your job is to apply it faithfully to every page, not
to reinvent it.

## How to load this into Claude Design (read first)

Claude Design runs inside **claude.ai** (palette icon in the left sidebar, or `claude.ai/design`). It
**cannot read local file paths** — feed it the design system one of these ways:

- **Connect the codebase (recommended).** Point Claude Design at this **GitHub repo**; it natively
  reads a codebase (and Figma) to extract a design system, so it will pick up `DESIGN.md`, the
  `portal/` code, and open `prototype/atlas-design-system.html` directly. Push the repo (at minimum
  `DESIGN.md` + `prototype/`) to GitHub first. *This is the best fit and the reason file-path
  references below work.*
- **Paste + capture (if not connecting a repo).** Paste this brief, the relevant stage goal
  (`redesign-goal-design.md` for Claude Design), and the full text of `DESIGN.md` into the prompt. For the reference UI, either **host**
  `prototype/atlas-design-system.html` and use Claude Design's **web-capture**, or open it and attach
  **screenshots** of both schemes (light `#blueprint`, dark `#blueprint-ink`). (Document upload
  officially supports DOCX/PPTX/XLSX + images; for Markdown/HTML, paste the text.)
- When the design is ready, **export to Claude Code** to apply the changes back into `portal/`.

> Note: wherever this brief or the goal says "read `DESIGN.md` / the prototype," that assumes the repo
> is connected. If you're pasting instead, include those contents in the conversation.

### What to reference — and what to ignore

- **Use as the design language:** `DESIGN.md` + `prototype/atlas-design-system.html` (the Blueprint
  system, tokens, and components). This is the only visual reference.
- **Use for grounding:** the portal's **data, domain, and on-screen content** — capability names,
  regions, owners, statuses, copy, and *what information each screen presents*. Pull this (fictional,
  public-safe) content so designs feel like the real product.
- **Do NOT use as a visual reference:** the **current `portal/` page designs / layouts**. They are
  being replaced. Don't mimic their composition. **Design fresh and stay open** — grounded in product
  tonality and the Blueprint system, not in how the pages look today.

## Read these first (sources of truth, in order)

1. **`DESIGN.md`** (repo root) — the design system spec: tokens (color/type/space/radius), the 9
   sections (theme, color, typography, components, layout, elevation, do/don't, responsive, agent
   guide). **This governs every decision.**
2. **`prototype/atlas-design-system.html`** — the **living reference implementation**. Open it (light
   = `#blueprint`, dark = `#blueprint-ink`) to see every token and component in motion. When DESIGN.md
   and your instinct disagree, match the prototype.
3. **`prototype/NOTES.md`** — the decision trail and the list of page patterns to reuse. Read the
   "Page designs worth keeping" section; those are validated.

## The system in one screen

- **Aesthetic:** "engineering drawing." Calm, exact, dense, evidence-first. The tool disappears into
  the task.
- **Brand `#001AFF`** (`oklch(46.28% 0.3059 264.18)`) = action & selection **only**, ≤10% of any
  screen. `brand-ink` (`oklch(45% 0.29 264.18)`) is brand-as-text (links, active nav).
- **Two schemes, one structure:** Blueprint (light, primary) and **Ink** (dark). Same components,
  recoloured.
- **Coordinate grid:** a faint 32px square grid lives in the **negative space only** — masked behind
  copy by same-colour plates; it begins below the opaque top bar; it never runs behind running text;
  **no full-width section divider lines** (they clash with the grid).
- **Typography:** Inter everywhere; **IBM Plex Mono only for inline code & identifier tags** (e.g.
  `eu-west-1`, a card slug) — **never as data-table columns**. Tables = Inter + `tabular-nums`, the
  identifier column emphasised by **weight**, headers sans/uppercase/tracked.
- **Elevation:** flat by tonal layering; shadow appears **only** on hover of interactive cards and on
  overlays/FAB.
- **Top nav:** 56px sticky, opaque, 3-col grid `1fr auto 1fr` — brand left · tabs centred (active =
  brand underline) · search + theme-toggle icons right. **"Ask Atlas" is a brand FAB** (bottom-right),
  not in the bar.

## How this maps onto the codebase

Stack: **TanStack Start/Router + React + Tailwind v4 (CSS-first `@theme` in `portal/src/styles/globals.css`) + Base UI** components in `portal/src/components/ui/`.

- **Tokens → `portal/src/styles/globals.css`.** Update `:root` to the Blueprint **light** tokens and
  `.dark` to the **Ink** tokens from DESIGN.md §2 (bg, surface, surface-2, ink/-2/-3, line/-2, brand
  + brand-hover/-tint/-ink/on-brand, the four semantics with -tint/-ink, `--grid`). Keep the existing
  Tailwind token aliases (`--color-*`) wired to these CSS vars. Add `--grid`, the radius scale (xs
  3 / sm 4 / md 6 / lg 10 / pill), and confirm fonts (self-hosted Inter via `@fontsource-variable/inter`
  + IBM Plex Mono; `font-synthesis: none`, `font-optical-sizing: auto`).
- **Grid + plates → app shell.** Put the 32px square grid on a full-width canvas layer that begins
  below the sticky bar (see DESIGN.md §5). Provide a "plate" treatment (same-colour background hugging
  text) so the grid never sits behind copy. The current shell is
  `portal/src/components/portal-shell.tsx` — rebuild its top bar to the N1 layout and move Ask to a FAB
  (`ask-atlas-fab.tsx` already exists — restyle it to the brand pill).
- **Components → `portal/src/components/ui/`.** Align the existing Base UI wrappers to DESIGN.md §4:
  `button.tsx` (solid primary / hairline secondary / ghost / danger + all states), `input.tsx` /
  `field.tsx`, `tabs.tsx` (brand underline), `badge.tsx` (→ square hairline chip + status-dot variant),
  `table.tsx` (Inter + tabular-nums, no mono columns, identifier by weight), `skeleton.tsx`,
  `tooltip.tsx`/`popover.tsx`/`dialog.tsx`/`sheet.tsx`. Reuse, don't fork.
- **Signature patterns** (from the prototype, see NOTES "Page designs worth keeping"): capability card
  with **brand corner ticks**, **Document Sources** numbered-entry panel, **dense data** table,
  **availability status-dot grid**, **evidence callout**, calm **alerts**, **empty states** that teach.

## Working method

1. **Foundation first:** update `globals.css` tokens + add the grid/plate layer + restyle the shell
   (`portal-shell.tsx`, nav, FAB, theme toggle). Verify light **and** dark before touching pages.
2. **Then pages,** one at a time (order in `redesign-goal.md`). For each: apply the system, reuse the
   matching prototype pattern, wire to the page's existing data (don't change data/loaders), check
   light + dark + a narrow viewport.
3. **Verify in the running app** (`pnpm` dev) and against the prototype, not just in code.
4. Keep diffs surgical and reuse existing components; match the codebase's conventions.

## Hard constraints (non-negotiable)

- **Public-safe:** fake/fictional data only; no company names, internal URLs, APIs, schemas, or
  business rules. (This repo may be imported into a company-isolated environment.)
- **OKLCH only**; no `#000`/`#fff`; no pure greys (tint neutrals toward hue 264).
- **AA contrast:** body ≥4.5:1, large ≥3:1, placeholders ≥4.5:1.
- **Windows 11 parity:** webfonts, `font-synthesis: none`, body weight ≥400, UI text ≥11px / content ≥12px.
- **No monospace data-table columns.** Mono = inline code & identifier tags only.
- **Grid only in negative space**, masked behind text; no full-width section dividers.
- **Brand ≤10%**, action/selection only.
- Respect `prefers-reduced-motion`; transitions 150–250ms, ease-out, no bounce.

## Definition of done (per page)

Matches DESIGN.md and the prototype; correct in light + Ink dark; responsive (incl. nav collapse and
table reflow); AA-clean; no mono table columns; grid behaves (negative space only); brand stays rare;
existing data/behaviour untouched; reduced-motion handled.
