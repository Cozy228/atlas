# Goal — Stage 1 (Claude Design): redesign every Atlas page

> For **Claude Design** (claude.ai). Read [`redesign-brief.md`](./redesign-brief.md) first (system +
> how to load). This stage produces **page designs**, not portal code. Implementation into `portal/`
> is Stage 2 — see [`redesign-goal-build.md`](./redesign-goal-build.md).

## Two-stage workflow (where this fits)

1. **Stage 1 — Claude Design (this doc):** redesign each Atlas screen visually in the Blueprint
   system → review (light + dark) → export the bundle to Claude Code.
2. **Stage 2 — Claude Code (`redesign-goal-build.md`):** implement the approved designs into the real
   `portal/` routes/components, wired to existing data.

## Goal of this stage

Produce an approved **visual design for every user-facing Atlas screen** in the Blueprint system
(light + **Ink** dark). Output = live, clickable designs in Claude Design — **not** edits to `portal/`.
Don't worry about file structure, routing, data wiring, or component APIs here; that's Stage 2.

**Design fresh — stay open.** Do **not** look at or reproduce the current `portal/` page layouts; they
are being replaced. Invent the composition for each screen from **product tonality + the Blueprint
system** (its tokens and components are your vocabulary, not a fixed template). Ground every screen in
the **real (fictional, public-safe) data and on-screen content** the page presents — entities,
statuses, copy — so it reads like the actual product. The validated prototype patterns below are
*available where they fit*, not mandatory layouts.

## Screens to design

Design the **shell** once, then each screen. Each item names the screen's **purpose + content + the
system patterns that fit** — treat the patterns as a vocabulary to compose with, **not a layout to
copy** (and never copy the current portal page). For every screen: work in the system, show **light +
Ink dark**, keep brand ≤10%, lead with evidence, and indicate the responsive intent (what collapses on
a narrow width).

- [ ] **App shell / frame** — top nav (brand left · tabs centred, active = brand underline · search +
      theme icons right), the coordinate grid in negative space, and the **Ask Atlas FAB**
      (bottom-right). Everything below sits in this frame.
- [ ] **Home** — entry surface: a clear display-type hero, a primary path into the catalog (search),
      a few signposts. Restraint; brand only on the primary action.
- [ ] **Overview** — a calm dashboard composed of capability cards + a dense table + status dots. No
      "hero-metric" template. Skeletons for loading, teaching empty states.
- [ ] **Catalog — list** — the flagship. **Capability cards** (brand corner ticks, icon on brand-tint,
      mono slug, status chips, mono owner/channel footer, hover arrow) in a reflowing grid; mono
      category labels as section anchors; offer a **dense-table** alternate view.
- [ ] **Catalog — topic detail** — a single capability: title + slug, description, **regional
      availability (status-dot grid)**, owner/support, and **evidence/sources** for its claims.
- [ ] **Availability** — the **status-dot grid** + legend (GA / Planned / Not-available ring); dense,
      tabular, scannable across many capabilities × regions.
- [ ] **Sources — list** — the **Document Sources** numbered-entry panel (numeral, title, `type · id`
      tag, description, status chips, owner · freshness · source link).
- [ ] **Sources — detail** — a single source: the **evidence callout** style, the document's metadata,
      and **calm alerts** for stale / broken-anchor states.
- [ ] **Guidance — list & detail** — list of guidance entries (numbered-entry or card, as fits);
      detail = a readable document on a solid panel with citation styling and authority chips.
- [ ] **Ask** — the conversational surface: answers presented as **evidence** (every claim → a source
      via the evidence callout), skeleton while streaming, calm error/empty states.

## Method

- Anchor on `DESIGN.md` + the reference prototype (`prototype/atlas-design-system.html`). When unsure,
  match the prototype.
- Design screen-by-screen; iterate with inline comments / adjustment knobs. Show **both schemes**.
- Use **fictional data only** (public-safe): e.g. capabilities like `object-storage`,
  `managed-postgres`, `edge-cache`; regions `us-east` / `eu-west` / `ap-south`; teams like
  "Platform Core"; channels like `#platform-help`. No company specifics.

## Definition of done (this stage)

For every screen: an approved design that matches `DESIGN.md` and the prototype, in **light + Ink
dark**, with brand kept rare, evidence-first content, the right reused pattern, and a clear responsive
intent. Reviewed and approved in Claude Design, then **exported to Claude Code** to begin Stage 2.

> Hard constraints still apply (from the brief): OKLCH only; AA contrast; mono only inline / as tags
> (never table columns); grid only in negative space; Windows-parity type; `prefers-reduced-motion`.
