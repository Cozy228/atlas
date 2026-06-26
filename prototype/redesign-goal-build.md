# Goal — Stage 2 (Claude Code): build the redesign into `portal/`

> For **Claude Code**, run **after** Stage 1. Read [`redesign-brief.md`](./redesign-brief.md) first.
> Inputs: the **approved page designs exported from Claude Design** (Stage 1,
> [`redesign-goal-design.md`](./redesign-goal-design.md)) + `DESIGN.md` +
> `prototype/atlas-design-system.html` + `prototype/NOTES.md` (sources of truth).

## Two-stage workflow (where this fits)

1. **Stage 1 — Claude Design:** each Atlas screen is redesigned visually and approved (light + dark),
   then exported. → `redesign-goal-design.md`.
2. **Stage 2 — Claude Code (this doc):** implement those approved designs into the real `portal/`
   routes/components.

## Goal of this stage

Bring **every page of `portal/`** onto the Blueprint system (light + Ink dark) so it matches the
approved Stage-1 designs and `DESIGN.md`. Foundation (tokens + app shell) first, then each route.
**Wire to existing data/loaders/routing unchanged** — this is a visual/system implementation, not a
data or routing change. For each page, start from its approved Claude Design output and reconcile it
with `DESIGN.md` + the prototype; reuse existing components, keep diffs surgical.

## Phase 0 — Foundation (do before any page)

- [ ] **`portal/src/styles/globals.css`** — set `:root` to Blueprint **light** tokens and `.dark` to
      **Ink** tokens (DESIGN.md §2). Add `--grid`, radius scale (xs3/sm4/md6/lg10/pill), spacing
      (4px base). Confirm self-hosted Inter + IBM Plex Mono, `font-synthesis:none`,
      `font-optical-sizing:auto`, `tabular-nums` helper.
- [ ] **App shell** (`portal/src/components/portal-shell.tsx`, `routes/__root.tsx`):
  - Full-width **coordinate-grid canvas** behind content, starting below the bar; **plate** utility so
    grid never sits behind text; **no full-width section dividers**.
  - **Top nav (N1):** brand left · tabs centred (active = brand underline) · search + theme-toggle
    icons right. Opaque bar.
  - **Ask Atlas → FAB** (restyle `ask-atlas-fab.tsx` to the brand pill, bottom-right).
- [ ] **Shared UI** (`portal/src/components/ui/`): align `button`, `input`/`field`, `tabs`, `badge`
      (→ square hairline chip + status dot), `table` (Inter + tabular, no mono columns), `skeleton`,
      `tooltip/popover/dialog/sheet` to DESIGN.md §4. Verify light + dark before pages.

## Phase 1 — Pages (recommended order)

Each item: apply the system + reuse the named prototype pattern + verify light/dark/narrow.

1. [ ] **Catalog** — `routes/catalog.index.tsx`, `routes/catalog.$topicId.tsx`, `routes/catalog.tsx`
       (+ `catalog-search-field.tsx`, `components/explore/`). Flagship. Use the **§06 capability cards**
       (brand corner ticks, icon on brand-tint, mono slug, status chips, mono owner/channel footer,
       hover arrow nudge) in `repeat(auto-fit, minmax(230px,1fr))`; mono category labels as anchors;
       the **§08 dense table** for any list/table view. Topic detail uses `components/detail/`.
2. [ ] **Availability** — `routes/availability.index.tsx`, `routes/availability.tsx`. Use the **§09
       status-dot grid** + legend (GA / Planned / Not-available ring); Inter + tabular; no mono columns.
3. [ ] **Sources** — `routes/sources.index.tsx`, `routes/sources.$sourceId.tsx`, `routes/sources.tsx`
       (+ `components/evidence/`). List = the **§07 Document Sources** numbered-entry panel; detail uses
       the **evidence callout** (`[n]` + claim + cite link) and calm **alerts** for stale/broken anchors.
4. [ ] **Guidance** — `routes/guidance.index.tsx`, `routes/guidance.$guidanceId.tsx`,
       `routes/guidance.tsx` (+ `components/guidance/`). List of guidance entries (reuse the
       numbered-entry or card pattern as fits); detail = readable document layout on a solid panel,
       evidence/citation styling, authority chips.
5. [ ] **Overview** — `routes/overview.tsx`. Dashboard: compose cards + dense tables + status dots; keep
       brand rare; no "hero-metric" template. Skeletons for loading, teaching empty states.
6. [ ] **Home** — `routes/index.tsx` (+ `components/home/`). Entry surface: clear hero (display type),
       search/entry into the catalog, a few signposts. Restraint; brand only on the primary action.
7. [ ] **Ask** — `routes/ask.tsx` (+ `components/ask/`, `ask-atlas/`, `ai-elements/`). Conversational
       surface: answers as evidence (every claim → source via the evidence callout), skeleton while
       streaming, calm error/empty states. Align the FAB-opened panel to the system.
8. [ ] **Cross-cutting polish** — loading (skeletons), empty states (teach), error/degraded states
       (calm alerts), focus rings, reduced-motion, and a final light/dark + responsive pass.

## Pattern → page map (quick reference)

| Prototype pattern (in the HTML / DESIGN.md) | Primary use |
|---|---|
| §06 Capability card (corner ticks) | Catalog, Overview |
| §07 Document Sources (numbered panel) | Sources, Guidance lists |
| §08 Dense data table (Inter + tabular) | Catalog table, Availability, Overview |
| §09 Availability status-dot grid | Availability |
| Evidence callout `[n]` + cite | Sources, Guidance, Ask |
| Calm alerts (stale / broken anchor) | Sources, detail pages, Ask |
| Skeleton loading / teaching empty state | everywhere |
| Top nav N1 + Ask FAB | shell (all pages) |

## Acceptance criteria (whole portal)

- Every route above matches `DESIGN.md` and the prototype in **light and Ink dark**.
- Coordinate grid only in negative space (masked behind copy); no full-width section dividers.
- All data tables use Inter + tabular figures; **zero monospace table columns**; mono only inline / as tags.
- Brand `#001AFF` ≤10% per screen, action/selection only; `brand-ink` for brand-as-text.
- AA contrast throughout; Windows-parity type rules in place; UI text ≥11px / content ≥12px.
- Responsive: nav collapses on small screens, card grids reflow, tables scroll/collapse gracefully.
- `prefers-reduced-motion` honoured; transitions 150–250ms ease-out.
- Existing data, loaders, and routing unchanged; diffs surgical; existing components reused.
- **Public-safe:** fictional data only, no company specifics.

## Suggested commit slices

One commit per phase item (foundation; then per route group), so each is independently reviewable and
exportable as a `.diff` / `.patch`.
