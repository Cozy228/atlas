# Goal (build) — Port the prototype Home **hero + content width** into the portal

> **Stage:** Claude Code (implementation). Read [`redesign-brief.md`](./redesign-brief.md) for the
> shared Blueprint context first, then this goal. This supersedes the "Home" section of any earlier
> handoff — Home is otherwise **concluded**.

## Context
The Home redesign exploration is over. The throwaway prototype
[`home-redesign.html`](./home-redesign.html) tried full layouts (round 1 A/B/C, round 2 T1–T4) — **all
of those layouts are rejected.** The user's verdict: keep the **existing** portal Home structure and
sections as they are; the **only** thing worth taking from the prototype is its **hero treatment** and
its **content width**. This goal applies exactly that, surgically.

## Scope — do ONLY this
1. Restyle the Home **hero** (`portal/src/routes/index.tsx`, the `Hero()` component, currently lines
   ~71–86) to match the prototype's hero.
2. Narrow the Home **content width** to ~1040px (the prototype's `.wrap`).

**Do NOT**:
- Do not adopt any T1–T4 / A–C layout (catalog-by-domain, directory, lifecycle ribbon, task cards,
  region cards, dashboard rail). They were rejected.
- Do not touch the other Home sections — `EntryCards`, `JourneyGrid`, `RecentlyViewed`,
  `PlatformUpdates`, `ResourceLinkGrid` stay exactly as they are.
- Do not change the loader's data contract beyond the one optional addition in step 3 below.

## The prototype hero (target to match)
See the `HERO` template string in `home-redesign.html` (`<script>` block). Structure, top→bottom:
1. **Eyebrow** — mono, 11px, uppercase, `letter-spacing ~0.12em`, muted. Text: `Platform catalog`.
2. **H1** — large display, `clamp(34px, 5.4vw, 54px)`, line-height ~1.03, `letter-spacing -0.035em`,
   weight 700, `max-width ~16ch`, `text-wrap: balance`. Text unchanged: **"Find the right platform path"**.
3. **Sub `p`** — ~18px, `line-height 1.55`, `color: muted-foreground`, `max-width ~60ch`. Reuse the
   prototype copy: *"One place to find approved capabilities, see where they're available, and follow
   the path from idea to production."* (or keep the current copy — confirm with user; current copy is
   fine too).
4. **Search** — keep the existing `<IntentSearch />` component (it opens the ⌘K dialog). Optionally bump
   its height to ~48–50px to match the prototype (`h-12`); keep `max-w` ~560–600px. Do not replace it
   with a raw `<input>`.
5. **Meta chips** — a wrapped row of small chips showing live counts. Use the existing `Badge` component
   (`@/components/ui/badge`): first chip `variant="brand"`, the rest `variant="outline"`. Mirror the
   prototype: `{N} capabilities` · `{N} domains` · `{N} regions & outposts` · `L3–L5 landing zones`.

## How to map onto the codebase (reuse, don't invent)
- **Hero file:** `portal/src/routes/index.tsx` → `Hero()`.
- **Eyebrow:** the project already has the eyebrow styling in
  `portal/src/components/section-eyebrow.tsx` (`<SectionEyebrow eyebrow=… />` renders
  `font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground`). Either reuse
  `SectionEyebrow` (eyebrow-only) or inline an equivalent `<span>`; widen tracking toward `0.12em` for
  the hero.
- **Display type:** existing utilities in `portal/src/styles/globals.css` —
  `type-display` = 40px/44, `type-display-lg` = 48px/52. The current hero already uses
  `type-display sm:type-display-lg`. To hit the prototype's slightly larger top end, keep that pair and
  tighten tracking to `-0.035em`; only add a new ~54px utility if the user wants the exact max.
- **Search:** `@/components/intent-search` (`IntentSearch`). It's a `<button>` (h-11, max-w-[600px]) —
  keep it; pass `className` to adjust height if matching 48–50px.
- **Chips:** `@/components/ui/badge` (`brand` = `bg-brand-tint text-primary`; `outline` = bordered).
- **Content width:** `portal/src/components/page-section.tsx` → `PageBody`. Current Home uses
  `width="comfortable"` (= `max-w-[1200px]`). Widths available: `narrow` 960 / `comfortable` 1200 /
  `wide` 1360 — none is 1040. Two clean options (pick one, prefer A):
  - **A.** Add a `~1040px` option to `PAGE_WIDTHS` (e.g. a new key, or change Home's via a `className`
    override `max-w-[1040px]` on `<PageBody>`).
  - **B.** Use `width="narrow"` (960) if the user is OK a touch tighter.
  Recommend overriding Home only (`<PageBody width="comfortable" className="max-w-[1040px]">`) so other
  pages are untouched.

## Meta-chip counts — data
The Home loader currently loads only `topicDiscoveryQueryOptions` (→ `capabilities`, `landingZones`).
Derive counts:
- **capabilities** = `capabilities.length`.
- **domains** = unique `topic.category` over capabilities (`new Set(...).size`).
- **landing zones** = `landingZones.length` → render as the static `L3–L5 landing zones` chip (or count).
- **regions & outposts** = NOT in the current Home loader. To show it accurately, add
  `availabilityQueryOptions` to the loader exactly like `overview.tsx` already does
  (`context.queryClient.ensureQueryData(availabilityQueryOptions)`), then count
  `availability.zones[].locations`. If the user prefers zero loader change, **drop the regions chip**
  rather than hardcode a number (ship-state honesty — no fake indicators).

## Constraints (from DESIGN.md / repo rules)
- Blueprint only: OKLCH tokens, brand ≤10% (here: brandmark, one brand chip, search focus ring — that's
  enough). No `#000`/`#fff`, AA contrast, Windows-11 font parity already handled by the token layer.
- Public-safe, fictional data only. Reply to user in Chinese; code & comments in English. PNPM.
- Keep the diff surgical: every changed line traces to the hero or the width. No drive-by refactors of
  the untouched sections.

## Definition of done
- Home hero shows: eyebrow → large balanced display → sub → IntentSearch → meta chips, on a ~1040px
  column; the rest of Home unchanged.
- Light **and** Ink dark both correct; narrow viewport reflows (chips wrap, display clamps).
- Counts are real (or the regions chip is omitted, not faked). `pnpm` typecheck/lint clean.

## Verify
- `cd portal && pnpm dev`, open `/`. Compare against `home-redesign.html` hero (any type, e.g.
  `http://localhost:8753/home-redesign.html#t2`) for the hero block only.
- Toggle dark mode; shrink to a phone width; confirm the hero matches and the existing sections below
  are visually unchanged.
- Optional: screenshot via the Chrome MCP tools and diff against the prototype hero.

## Cleanup
Once merged, `home-redesign.html` has served its purpose (its only keeper — the hero — is now in the
app). Leave it until the Catalog prototype reuses its switcher/data block, then delete with the other
throwaways.
