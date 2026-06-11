# Goal (design + build) — `/proto/*` suite, round 2 redesign

> **Stage:** design + implementation in one pass per surface. Read root [`DESIGN.md`](../DESIGN.md)
> (the Blueprint system — source of truth) and the "In-app page prototypes" section of
> [`NOTES.md`](./NOTES.md) first. The proto routes are **production candidates, not throwaways** —
> they will replace their mainline routes. Build at production standard; header comments say
> `PROTOTYPE (production candidate)`.

## Why round 2

Round 1 shipped one direction per surface. Review left these *leanings* (context, not law):

| Surface | Round-1 review leaning |
|---|---|
| `/proto/home` | Hero + "From idea to production" liked; the other sections felt samey |
| Overview | Revamp into a new proto page — an application/operations view (CI/CD, app health) |
| `/proto/catalog` | Drafting-room direction dropped; the mainline `/catalog` design was liked |
| `/proto/guidance` + detail | Redesign both (index and the step detail page) |
| `/proto/skills` | Redesign, open-minded — research first, not bound by the current direction |
| `/proto/capability`, `/proto/sources`, `/proto/ask`, `/regions` | Out of scope — do not touch |

## Ground rules — read this before the briefs

**There are exactly two hard constraints. Everything else is open.**

1. **The Blueprint design system** (root `DESIGN.md`) — tokens, type rules, component rules,
   principles. This is the only design law.
2. **Stay in the `/proto/*` namespace.** Every new or changed surface lives under proto routes.
   Never modify, replace, or redirect a mainline route (`/`, `/catalog`, `/guidance`,
   `/overview`, `/skills`, …). Reusing mainline components read-only is fine; editing them is not.

Within those two: **any data (mock or real, any shape), any content, any format, any layout, any
page structure — no limit.** The per-page briefs below state intent and review leanings; they are
starting points, not fences. That explicitly includes the previously "protected" pieces: the Home
hero, the "From idea to production" lifecycle, and the catalog-follows-mainline idea may **all**
be changed or discarded if a variant has a stronger answer. If a brief below conflicts with a
better idea, the better idea wins — implement it as one of the variants and let the user judge.

## The one design directive that overrides taste

**Comply with the system; differ in structure.** Every page must use Blueprint tokens, type scale,
and component rules — and every page must have its **own structural signature**. The failure mode
to avoid: five pages that are all "a header, then N `rounded-xl border bg-card` tile grids". The
suite already has distinct registers worth matching in spirit: capability = component datasheet,
sources = registry ledger. Each redesigned surface needs an
equally specific register of its own, and **sections within a page must vary their layout
primitive** (board rows vs. spec tables vs. ribbons vs. rails vs. tiles), not repeat one card
pattern five times.

## Process (per redesigned surface)

1. **Load the design skills first.** Before any design work, invoke the available frontend design
   skills — at minimum `frontend-design` and `impeccable`; also lean on related ones where they
   fit (`design-taste-frontend`, `redesign-existing-projects`, `high-end-visual-design`). Follow
   their guidance throughout design *and* implementation, not just at the sketch stage.
2. **Research** — look outside the repo for the best-in-class pattern for that surface's job
   (references suggested per page below; add your own). This matters most for Skills and Overview,
   which are explicitly open briefs.
3. **Brainstorm ≥3 genuinely different directions**, then **implement ALL of them** — the user
   will only choose after seeing real implementations. Do **not** pre-filter, do not pick a
   winner, do not implement one direction "properly" and the rest as sketches: every direction
   ships at the same production-candidate quality.
4. **Routes are free.** Invent whatever route structure presents the variants best — sibling
   routes per variant (e.g. `/proto/skills-a` / `/proto/skills-b`), a `?variant=` search param, an
   in-page switcher, anything. Just make every variant reachable by URL, list all variant URLs in
   `prototype/NOTES.md` (one line of direction-summary each), and keep the rest of the suite's
   links pointing at a sensible default until the user picks.
5. **Verify** every variant (checklist below) — not just the one you secretly prefer.

## Per-page briefs

### 1 · `/proto/home` (`portal/src/routes/proto.home.tsx`) — redesign

**Review leaning (not a fence):** the current `Hero` (eyebrow · welcome · IntentSearch · popular
chips · stats) and `Lifecycle` ("From idea to production" / `JourneyGrid`) were liked — they are
a strong baseline, and at least one variant should preserve their spirit. But they are **not
protected**: a variant with a stronger opening or a better lifecycle story may replace them.

**The clear problem to solve:** `JumpBackIn`, `BrowseByIntent`, `CatalogByDomain`, `Announcements`
currently read as four variations of the same pill/tile pattern. Rethink what each is *for*:
- *Jump back in* — is a pill strip the right shape for resume-where-you-were?
- *Browse by intent* — five parallel doors; currently indistinguishable tiles.
- *Service catalog doorway* — an index into `/proto/catalog` shelves, not a second catalog.
- *Announcements* — currently three equal cards; consider recency/type hierarchy, or merging into
  a quieter "what changed" register. Its "View all" should target the new `/proto/overview`.

Section order, section list, and data sources are all free — drop, merge, or invent sections.

### 2 · `/proto/overview` (NEW — `portal/src/routes/proto.overview.tsx`) — full revamp

Replaces the concept of mainline `/overview` (currently a catalog/evidence ledger:
`portal/src/routes/overview.tsx`). The new page answers a different question: **"how are the
applications on this platform doing right now?"** — an operations snapshot, not a catalog summary.

Candidate content (mock data, pick what serves the page — it does not have to be complete):
- **CI/CD** — recent pipeline runs / deployments (service, env, status, duration, commit-ish ref).
- **Application health** — per-service health: uptime, error rate, latency, or a simple
  healthy/degraded/down state with semantic dots.
- **Incidents / alerts** — open + recently resolved, calm styling per "calm under load".
- **Environment / release state** — what version runs where (dev → staging → prod promotion).
- Platform announcements can fold in here (Home's Announcements links to it).

Rules specific to this page:
- **All data may be mock.** Put fixtures in a small module (e.g. `portal/src/lib/ops.ts`),
  fictional and public-safe (fake service names, no real company anything).
- **Ship-state honesty still applies**: the page must visibly self-describe as a demo snapshot
  (mainline overview's `demo snapshot` badge is the precedent) — no implied "Live" wiring.
- Semantic colours do the status work (success/warning/critical/info dots & chips); brand stays
  ≤10% — a wall of status colour is still a Blueprint page, not a Christmas tree.
- References worth studying: Vercel deployments list, GitHub Actions runs, Grafana/Datadog
  service overviews, Backstage service health tabs, Linear's status patterns.

### 3 · `/proto/catalog` (`proto.catalog.tsx`) — redesign

The round-1 "drafting-room parts catalog" direction is dropped. **Review leaning:** the mainline
`/catalog` design (`portal/src/routes/catalog.tsx` + `catalog.index.tsx`) was liked — make one
variant that adopts it (reuse its components read-only rather than re-implementing). Beyond that
the brief is open like the others: further variants may depart from the mainline design entirely.

Keep the proto suite coherent whatever the shape: links into `/proto/catalog` from other proto
pages must still land somewhere sensible (Home's catalog doorway currently targets `#domain-…`
shelf anchors — retarget or rethink as needed), and catalog entries should link on to the proto
capability detail where one exists.

### 4 · `/proto/guidance` + guidance detail — redesign both

**Index** (`proto.guidance.tsx`): current direction is the "departures board" (family legend +
one board row per route). It's the baseline to beat — keep what works (scannable at dozens of
entries, destination-led), but the brief is open: the board register is *not* protected.

**Detail** (new): the proto board currently links to mainline `/guidance/$guidanceId` (a
stepper-workspace: left step rail + one step panel + localStorage progress via
`useGuidanceProgress`). Build a redesigned detail inside the proto suite:
- Route: free choice (see Process #4); one workable option is `proto.guidance_.$guidanceId.tsx`
  (trailing underscore avoids nesting under the index route) → `/proto/guidance/$guidanceId`.
  Whatever the shape, retarget the index rows to the proto detail.
- Real data: `getGuidance` / fixtures in `portal/src/lib/guidance.ts`, sources via
  `sourceDiscoveryQueryOptions`. Keep progress tracking (it's the page's job), but the layout,
  step navigation model, and evidence presentation are all open to rethink.
- The index and detail must read as one family (the journey/destination vocabulary carries over).

### 5 · `/proto/skills` (`proto.skills.tsx`) — open-minded redesign

Current direction is the "package index" (npm-style ledger rows + copy-install buttons). The user
explicitly wants this brief **un-anchored from the current design** — research first:
- What is a *skills registry for platform automations* actually like to browse? Study: VS Code
  extension marketplace, Raycast store, npm/crates.io, Homebrew formulae pages, GitHub
  Marketplace actions, agent-skill registries.
- Open questions the redesign may answer differently: do skills deserve detail views (readme,
  changelog, what-it-does preview)? categories/tags as navigation? popularity/freshness signals?
  is install-command-copy still the primary action, and is a row still the right unit?
- Data: `portal/src/lib/skills.ts` (`SKILLS`, `skillInstallCommand`, `skillListCommand`); extend
  the fixture shape if the chosen direction needs more fields (keep it fictional/public-safe).

## Shared constraints (apply to every touched page)

- **Blueprint compliance** (root `DESIGN.md` §1–§8): OKLCH tokens only, no `#000`/`#fff`, brand
  ≤10% per screen (`brand-ink` for brand-as-text), Inter + `tabular-nums` in tables (no mono
  columns), mono for inline identifiers only, status dots for availability/health, depth by
  lightness steps (shadow only on hover/overlays), grid stays in negative space (`bg-background`
  plates behind floating text), no full-width divider rules, calm semantic states.
- **Data is free.** Use the real loaders (availability, topics, sources, guidance fixtures) or
  invent mock fixtures of any shape — whichever serves the design. The only data rule comes from
  the design system itself (ship-state honesty): a number or indicator either reflects the data
  actually backing it, or the page self-describes as a demo snapshot — never decorative
  "Live/Synced".
- **Public-safe, fictional names only** (repo rule #1/#4). Code & comments in English; reply to
  the user in Chinese. PNPM only.
- **Production-candidate quality**: TanStack Router file routes with loaders, reusable pieces,
  accessible focus states, `pnpm lint` + `pnpm typecheck` clean.
- **Proto namespace only** (ground rule #2): capability/sources/ask/regions proto pages
  untouched; mainline routes never edited or replaced — reusing their components read-only is
  fine.

## Definition of done

- `/proto/home` redesigned with all variants implemented and reachable; any displayed numbers
  honest per the data rule.
- `/proto/overview` exists in all its variants, each reading as an application-operations
  snapshot (CI/CD + health at minimum), self-describing as a demo snapshot, all fixtures
  fictional.
- `/proto/catalog` redesigned (including one mainline-design variant via reused components);
  proto-suite links into and out of it still work.
- `/proto/guidance` index redesigned and a proto guidance detail exists (all variants); the index
  links to the proto detail; progress tracking still works.
- `/proto/skills` redesigned along researched directions — **every** brainstormed direction
  implemented; none filtered out before user review.
- All variant URLs + one-line direction summaries recorded in `prototype/NOTES.md` ("In-app page
  prototypes" section). No verdicts written — the pick is the user's.
- Every page **and every variant** verified in-browser in both Blueprint light and Ink dark, plus
  a narrow-viewport pass (devtools, ≤500px). `pnpm lint` / `pnpm typecheck` clean.

## Verify

`cd portal && pnpm dev`, walk the flow: `/proto/home` → intent/section links → `/proto/catalog`
→ `/proto/guidance` → a guidance detail → `/proto/skills` → `/proto/overview`, then visit every
variant URL listed in `NOTES.md`. Toggle the theme on each page; check the coordinate grid never
bleeds behind running text; count the brand-coloured elements per screen (≤10% rule); confirm no
link in the proto suite dead-ends into a mainline page that has a proto replacement.
