# Atlas Portal Frontend Design Implementation Plan

This document defines the frontend design implementation plan for Atlas Portal. It is scoped to the human-facing Portal experience and must stay aligned with the Atlas Context Layer boundary.

## Truth Sources

Follow these documents in order:

1. `docs/product/product_proposal.md`
2. `docs/architecture/current_design.md`
3. `docs/architecture/constraints.md`
4. `docs/architecture/implementation_plan.md`
5. `docs/product/guideline.md`

Impeccable context note: this repository does not currently have `PRODUCT.md` or `DESIGN.md`. For this plan, `docs/product/product_proposal.md` is the product context, and `docs/architecture/current_design.md` is the design context.

## Goal

Build Atlas Portal as a work-focused Cloud Platform DevEx Portal: a wayfinding system that helps application engineers quickly locate the right platform capability, landing zone, guardrail, owner, support path, and tool entry without reading scattered documentation or asking the platform team to route them manually.

Portal V1 should make these jobs obvious:

- Find an approved platform capability.
- Check availability across regions and outposts.
- Compare landing zones, guardrails, tools, and support paths.
- Understand ownership, readiness, health, and operational context for catalog objects.
- Follow a guided journey from intent to entry tool.
- Ask a cited platform question grounded in catalog objects and registered evidence.
- Report missing, stale, broken, conflicting, or unclear guidance.

The Portal must feel like a real operating surface, not a marketing page, provisioning wizard, documentation clone, passive document index, or admin console.

## Design Philosophy

Atlas is a **wayfinding system**. Users arrive with a destination in mind: a capability, a landing zone, a tool link, an owner, a policy answer. Every design decision optimizes for **shortening the distance from "I have a question" to "I found the answer"**.

Design principles in priority order:

1. **Intent-first, not taxonomy-first.** Start from user tasks, not object type menus.
2. **Progressive revelation.** Simple entry → click to expand → full detail on demand.
3. **Evidence is verification, not discovery.** Source info is inline expandable, not a persistent panel.
4. **Adaptive density.** Compact grouped cards for small catalogs, dense table mode when data grows.
5. **Operational, not decorative.** Zero motion choreography; only loading, expand, and state feedback animate.

Reference models:

- [Claude API Docs](https://platform.claude.com/docs/en/home): intent entry, developer journey lifecycle, progressive detail.
- [Stripe Docs](https://docs.stripe.com/): use-case entry, product-organized browse, quick actions.
- [Atlassian Compass](https://www.atlassian.com/software/compass): developer portal, component catalog, scorecards.
- [Port](https://www.getport.io/): blueprint-based catalog, relations, configurable discovery.

## Working Assumptions

- Atlas Portal is the first consumer of the Atlas Context API.
- Portal uses TanStack Start, TanStack Router, React, Vite, TypeScript, and `pnpm`.
- Portal uses Tailwind CSS as the utility styling engine, backed by Atlas-owned CSS variables and OKLCH design tokens.
- Portal browser code never calls DynamoDB, source systems, or an LLM provider directly.
- Portal server-side code may call the Atlas Context API and a Portal-owned LLM adapter.
- V1 has no authentication, registration, SSO, or identity-based application access.
- Pilot data comes from registry/API responses or explicit seed data, not hardcoded UI truth.
- Portal presentation centers on catalog objects. In the current backend model, these objects are represented by `Topic` records and related `Source` evidence, but UI copy should use user-facing terms such as capability, landing zone, guardrail, tool, owner, and source.
- Source evidence can be internal Atlas-managed guidance, external source-system content, or mixed ownership content. The UI must show source ownership and authority instead of assuming all sources are Confluence-like documents.
- A catalog object is not the same thing as a source. Catalog objects are what users browse and act on. Sources are the evidence that makes catalog objects trustworthy.
- Current `portal/src/views` helpers prove rendering behavior, but they are not a complete TanStack Start route implementation.
- The company already has a logo. Portal implementation must reserve a stable logo slot instead of inventing a new mark.
- The company brand color is `#001aff`. It is highly saturated and must be used as a restrained accent, not as a dominant surface color.

## Non-Goals

- No provisioning forms.
- No landing zone creation workflow.
- No full service catalog for all applications, microservices, repositories, or runtime assets.
- No generic internal developer platform workflow engine.
- No scorecard engine beyond V1 guidance health, authority coverage, and evidence quality signals.
- No admin UI for source registration.
- No source content editor.
- No general-purpose enterprise search.
- No AI answer without citations.
- No full Ask Atlas implementation in the first Portal UI slice. Ask Atlas remains visible as a deferred capability until the evidence surfaces are solid.
- No browser-side LLM provider calls.
- No direct import from Context Layer internals.

## Product UI Register

Atlas Portal is a product UI. Design should serve repeated work, scanning, comparison, catalog exploration, guided action, and evidence review.

Scene sentence: an application engineer opens Atlas during a normal workday on a laptop or external monitor, trying to identify the correct cloud capability, landing zone, guardrail, owner, support path, source evidence, and next tool without reading scattered documentation or asking the platform team to route them manually.

Design implications:

- Prefer a quiet, light, high-density interface.
- Use restrained color with one accent for primary action, current selection, and important state.
- Make warnings visible without making the whole interface feel broken.
- Use familiar product patterns: top navigation bar, global search, catalog filters, breadcrumbs, tabs, tables, relationship panels, badges, health summaries, action menus, and inline feedback.
- Reserve a stable brand area for the company logo, but keep the first viewport task-oriented.
- Use `#001aff` as a controlled accent for action and selection only. Do not let brand color overpower evidence scanning.
- The first viewport should be intent-driven: search and guided journeys, not a feature directory.
- Avoid identical decorative card grids. Use domain-grouped cards with inline status, tables, comparison matrices, and detail panels where they fit the task better.
- Avoid nested cards. Use full-width sections, table rows, split panes, and inline panels instead.
- Treat motion as operational feedback only. Catalog row expansion, evidence reveal, and inline save states can move; decorative page choreography should not.

## Resolved Portal UX Direction

These decisions come from the Portal design brainstorm and should guide implementation before individual components are built.

| Area | Decision |
|---|---|
| Product direction | DevEx Portal as wayfinding system. The first impression should be intent-driven and guided, while deeper screens retain evidence-first rigor. |
| Visual density | Adaptive: compact grouped cards by default, dense table mode on demand or when data exceeds 15 items per group. |
| Home | Intent-first entry: hero with search, platform entry cards (Evaluate / Decide / Onboard) as clickable cards with inline expand panels, developer journey grid (Get started → Build → Validate → Operate), catalog highlights, recent activity, health band, and resource links. |
| Navigation | Top navigation bar with brand mark, inline nav links, health indicator, and sync status. No sidebar. Global search with ⌘K in the hero area. |
| Search | Catalog-aware intent resolution (not AI chat). Supports synonyms, routes to catalog objects, owners, and guided journeys. |
| Explore | Unified catalog and availability surface. Browse all object types with availability context inline, following the domain-grouped card + inline expand + matrix toggle pattern. |
| Guided journeys | Integrated into Home as platform entry cards. Clicking a card expands an inline panel with phase-specific content. Not a separate wizard or overlay. A second layer, the developer journey grid, provides lifecycle-stage navigation with direct links. |
| Capability detail | Answer-first layout: what it is, when to use, get started tools, availability, guardrails, then evidence expandable inline. |
| Landing zones | Comparison matrix or dense comparison rows plus guided landing zone detail. |
| Evidence | Inline expandable sections on detail pages. No persistent right rail. Evidence expands on demand to show sources, authority, freshness, anchors, and warnings. |
| Health | Ambient compact band on home; dedicated page uses progress indicators and actionable issue list. |
| Ask Atlas | Catalog-aware, citation-bound assistant surface. Visible as deferred capability until implementation is ready. |

### Pilot slice adjustments

These sequence the **first Portal UI slice** against the full IA above. They do not remove long-term routes or patterns; they steer what ships before later phases.

| Topic | Pilot decision |
|---|---|
| Primary surfaces | **Home** and the **catalog / regional availability** surface (see `catalog_design.md` and explore previews). Capability discovery, landing-zone comparison, and unified browse—with filters, domain grouping, and matrix-style density—should be reachable from **those two pillars** unless a standalone route is needed for stable deep links. |
| `/explore` naming | `/explore` and a catalog-only route name are **one logical surface** for planning: pick the canonical path in implementation and keep preselect filters in the URL contract. |
| `/health` | **Deferred** in the pilot slice. Prefer **ambient** guidance signals on Home (counts, summaries) **without** a dedicated dashboard or top-nav destination until Phase P6 is active. |
| Ask Atlas entry | Primary entry is a **floating action button (FAB)** that opens a **modal** with deferred boundary copy. Keep optional `/ask` for bookmarks and future full-page parity. Ask is **not** a primary **top-navigation** item in the pilot shell. |

## Information Architecture

### Product Object Model

Portal UI should expose user-facing catalog objects without leaking backend implementation names into primary navigation.

| User-facing object | Backend alignment | V1 role |
|---|---|---|
| Capability | `Topic` with `topic_type=capability` | Approved cloud platform capability such as S3, Textract, Lambda, EKS baseline, or Bedrock |
| Landing Zone | `Topic` with `topic_type=landing-zone` | Deployment environment option with guardrails, tools, support, and onboarding path |
| Guardrail Area | `Topic` with `topic_type=guardrail-area` | Policy or control area such as networking, IAM, data protection, logging, or approved AI usage |
| Tool Entry | `Topic.entry_tools` or related link metadata | Operational entry point such as TFE module, Harness pipeline, dashboard, request form, or runbook |
| Availability Record | Catalog projection over capability and region data | Availability status per capability, region, and outpost |
| Source | `Source` plus `Anchor` | Governed evidence location with authority, ownership, visibility, freshness, and addressability |
| Owner or Team | Topic owner team and source steward metadata | Human routing path for support, content stewardship, and escalation |

Frontend naming rules:

- Use `catalog object` when describing cross-type UI patterns.
- Use concrete object names in user-facing copy: capability, landing zone, guardrail, tool, source, owner.
- Use `Topic` only in implementation-facing notes and API mapping text.
- Do not describe Atlas as a service catalog unless the sentence explicitly limits scope to cloud platform catalog objects.
- Do not make Source the primary browse unit for user tasks. Source is the evidence layer behind catalog objects.

### Route Map

| Route | Purpose | Primary data |
|---|---|---|
| `/` | Portal home: intent entry, guided journeys, ambient health | Catalog summaries, journey paths, health signals |
| `/explore` | Unified catalog and availability explorer | All catalog objects, availability status, domain grouping, region strip, card and matrix views |
| `/explore/$objectId` | Catalog object detail with inline evidence | Object metadata, relationships, actions, context bundle, sources, warnings |
| `/capabilities` | Capability discovery (type-filtered explore view) | `topic_type=capability` topics |
| `/capabilities/$topicId` | Capability detail | Topic metadata, availability, guardrails, context bundle, sources, expansion paths |
| `/landing-zones` | Landing zone navigator | `topic_type=landing-zone` topics |
| `/landing-zones/$topicId` | Landing zone detail | Environment matrix, guardrail excerpts, tool links |
| `/health` | Guidance health and coverage dashboard | Authority coverage, stale sources, broken anchors, conflicts, missing owner/support |
| `/ask` | Ask Atlas bookmark / future full-page entry (optional in pilot) | Same as deferred modal; reserved for parity when composer ships |

Pilot routing note:

- Prefer catalog **filters and deep-links** (e.g. type, domain, region query params) instead of multiplying top-level browse routes where Home + catalog already cover the job.
- **`/health` is optional** until the pilot explicitly schedules Phase P6. Home may still summarize stale or missing-owner counts without linking to a dashboard.
- **Ask Atlas** primary UX in pilot: **FAB → modal**. The `/ask` row remains for deep links and later full implementation.

Notes on routing:

- Guardrails are accessed through capability detail, landing zone detail, and the Explore filter. They share a detail route: `/explore/$objectId` when `topic_type=guardrail-area`.
- Sources are accessed through evidence expansion on detail pages, health issues, and the Explore filter. They share a detail route: `/explore/$objectId` when viewing a source.
- Guided journeys are inline expandable sections on Home, not separate routes or modal overlays.

### Global Shell

Use a stable product shell:

- Top navigation bar: brand mark + name, inline nav links (Home, Capabilities, Landing Zones, Availability). **Pilot:** omit dedicated **Health** and **Ask** links; surface guidance signals on Home if needed, and Ask via **FAB + modal** (see pilot slice adjustments).
- Global catalog search with ⌘K shortcut placed in the Home hero area. Deeper pages may surface a compact search in the top bar.
- Main content: centered route-specific work surface.
- Evidence sections expand inline within the page, not as a persistent side panel.

The shell should not use decorative hero treatment. Atlas as the product name belongs in the top bar and page title, not in oversized marketing copy.

Top bar behavior:

- Desktop: brand mark, inline nav links, spacer, ambient sync/status **and pilot-appropriate readiness hints** (e.g. stale source count when data exists) in a single 52px sticky bar with backdrop blur. Omit a dedicated `/health` link until Phase P6.
- Tablet and narrow desktop: nav links may collapse into a menu affordance.
- Mobile: nav links collapse; bottom navigation bar with 4-5 key destinations as an alternative.

Logo slot rules:

- Reserve a stable left position in the top bar for the brand mark (24px icon) and brand name.
- Do not stretch, recolor, crop, or place the logo over busy backgrounds.
- Do not repeat the logo as decoration in cards, empty states, or section headers.
- If the logo asset is unavailable during implementation, use a neutral reserved placeholder with the accessible label `Company logo`, then replace it when the asset is provided.

## Core Screens

### Home

Home is an intent-resolution surface, not a feature directory or welcome page. Its design learns from Claude API Docs: search is intent, decision paths are visible below, and the page lifecycle guides users from question to answer.

Layout priority (top to bottom):

1. **Hero: framing statement and intent search** — a bold left-aligned heading ("Find the right platform path"), a one-line description, and a catalog-aware search input with ⌘K. The search routes to catalog objects, owners, and journey steps on input. Max-width constrained to ~520px to avoid stretching.
2. **Platform entry cards** — the core interaction. Three clickable cards (Evaluate and Decide side by side, Onboard full-width below) that expand inline panels when clicked. Each card is framed as the user's question, not Atlas's feature name. Only one card can be expanded at a time. Clicking the active card collapses its panel. Each card has a section-eyebrow label ("Platform"), section title, and description above the grid.
3. **Developer journey grid** — a 2×2 grid of lifecycle steps (Get started → Build → Validate → Operate), each with a step number, title, description, and action links. This follows the Claude docs "From idea to production" pattern and provides a second orientation layer.
4. **Catalog highlights** — an asymmetric 2fr/1fr grid showing key catalog stats (service count, region count) with large monospace numbers. Provides ambient catalog awareness.
5. **Recent activity** — compact inline chips for recently viewed catalog objects (local storage, no backend personalization).
6. **Health band** — one-line ambient summary: "2 stale sources · 1 missing owner · 0 broken anchors". **Pilot:** display only; **no link** to `/health` until the health dashboard ships.
7. **Resource links** — a 2×2 grid of resource link cards (e.g. All capabilities, Landing zones, Availability map, and a fourth surface such as sources or documentation). **Pilot:** replace "Health dashboard" with another destination until `/health` exists.

Platform entry cards detail:

| Card | User question | Expand panel content |
|---|---|---|
| **Evaluate** (half-width) | "Which capability should I use?" | Searchable capability list with inline availability chips and domain grouping. Selecting a capability routes to its detail page. |
| **Decide** (half-width) | "Which landing zone fits my workload?" | Landing zone comparison cards with guardrail summary, tags, and support paths. Selecting a landing zone routes to its detail page. |
| **Onboard** (full-width) | "How do I start?" | 2×2 tool card grid (TFE module, Harness pipeline, onboarding form, guardrail checker), plus owner contact row with team name and Slack channel. |

Visual structure:

```
Find the right platform path
Search across capabilities, landing zones, tools, and owners.

┌────────────────────────────────────────────┐
│ 🔍  What are you looking for?         ⌘K  │
└────────────────────────────────────────────┘

PLATFORM
Choose your starting point

┌─────────────────────┐  ┌─────────────────────┐
│ [icon] Evaluate     │  │ [icon] Decide       │
│ Which capability?   │  │ Which landing zone? │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────────────────────────────┐
│ [icon] Onboard                              │
│ How do I start?                             │
└─────────────────────────────────────────────┘

┌─ Inline expand panel (active card) ──────────┐
│ Phase-specific content with close button      │
└───────────────────────────────────────────────┘

DEVELOPER JOURNEY
From idea to production

┌──────────────────┬──────────────────┐
│ 01 Get started   │ 02 Build         │
│ Understand the   │ Provision and    │
│ catalog          │ configure        │
│ → links          │ → links          │
├──────────────────┼──────────────────┤
│ 03 Validate      │ 04 Operate       │
│ Check guardrails │ Monitor & evolve │
│ → links          │ → links          │
└──────────────────┴──────────────────┘

CATALOG
Capability highlights
┌───── 27 ─────────┬──── 5 ────────┐
│ Services         │ Regions       │
└──────────────────┴───────────────┘

RECENTLY VIEWED
[S3 capability] [EKS capability] [L3 Production landing zone] ...

HEALTH  2 stale sources · 1 missing owner · 0 broken anchors  →

RESOURCES — Keep exploring
┌─────────────────┬──────────────────┐
│ All capabilities│ Landing zones    │
│ Availability map│ (pilot: not health) │
└─────────────────┴──────────────────┘
```

Implementation notes:

- Entry cards are not a progress wizard. Users can click any card at any time. Cards do not need to be activated in order.
- Each card expands an inline panel below the card grid. Only one panel is expanded at a time. A close button dismisses the panel.
- The expanded panel is a lightweight inline section, not a modal or overlay. Users stay on the home page.
- The transition between "search" and "entry cards" is fluid: searching within an expanded panel filters its content. Searching at the hero level routes globally.
- Entry card labels use the user's question framing ("Which capability should I use?"), not Atlas's feature name ("Capability discovery").
- Section-eyebrow labels (e.g., "Platform", "Developer journey", "Catalog", "Resources") use IBM Plex Mono uppercase for visual separation.
- The developer journey grid provides lifecycle orientation and direct links, complementing the interactive entry cards.
- Catalog highlights use large monospace stat numbers as ambient signals, not hero metrics.
- Do not create a static directory page with nav links.
- Do not explain what a portal is.
- Show empty pilot states as actionable gaps.
- Keep Ask Atlas discoverable via **FAB + modal** in the pilot (and optional `/ask`), but not as the home search behavior and not as a primary top-nav item until the full composer ships.

### Guided Journey Behavior

The platform entry cards on Home are the primary V1 interaction pattern. They integrate lifecycle visibility with inline guided content, following the principle from Claude docs: "Follow the lifecycle or jump to what you need."

Design rules:

- Journeys do not create resources. They resolve information.
- Each expanded phase shows only what the user needs to decide at that phase.
- The final resolution provides concrete next actions: tool links, owner contacts, policy references, and detail page routing.
- Journeys can be exited at any point. Users can also bypass them entirely via direct catalog search or nav.
- Inline expansion, not full-page wizard or modal overlay. The home page remains the context.
- V1 journeys are structured navigation. Post-V1, Ask Atlas can auto-resolve journey steps using LLM context.

Journey resolution paths:

| Phase | User selects | Resolves to |
|---|---|---|
| Evaluate | A capability from the list | Capability detail page with availability, guardrails, and tools |
| Decide | A landing zone from comparison | Landing zone detail page with environment, guardrails, and onboarding |
| Onboard | An entry tool or support path | External tool (TFE, Harness) or owner/support contact |

Advanced interaction (post-V1):

- The search input at the top can understand intent and auto-activate the relevant phase: typing "EKS availability" expands Evaluate with EKS pre-filtered.
- Ask Atlas can be offered as a secondary path within any phase: "Can't find what you need? Ask Atlas →".

### Explore

Explore is the unified catalog and availability surface. It merges what traditional portals split into "catalog" and "availability map" into a single browseable, filterable, domain-grouped surface.

Design pattern: follows `catalog_availability_preview_v2.html` — domain-grouped cards with inline availability chips, region strip orientation, inline expand panel for detail, and matrix toggle for dense comparison.

Required behavior:

- Browse all catalog objects: capabilities, landing zones, guardrail areas, and tool entries.
- Region strip at top: clickable region/outpost cells showing availability counts, acting as a location filter.
- Filter by object type, domain, status (available/planned/interim/not planned), owner team, and warning state.
- Show each object as a compact card with: icon, name, domain label, and inline availability status chips.
- Click a card to open an inline expand panel (within the grid, full-width) showing: full location breakdown, ETA, guidance notes, next-step actions, and evidence freshness.
- Provide a view toggle: Cards (default) and Matrix (dense table with service rows and region columns).
- Domain-based grouping with sticky section headers for browse orientation.
- Results count and active filter display.

Recommended layout:

- Region strip: horizontal grid of clickable location cells, each showing name, subtitle, and availability counts.
- Controls: status filter, domain filter, result count, view toggle.
- Card grid: `auto-fill, minmax(280px, 1fr)` responsive grid, grouped by domain with sticky domain headers.
- Expand panel: appears inline after selected card (grid-column: 1 / -1), split into location detail (left) and next-step actions (right).
- Matrix view: compact table with service column and one column per location, status chips inline.

State coverage:

- Default: all objects visible, no region filter active.
- Region filtered: region cell selected, grid shows only objects with availability in that region.
- Type filtered: objects narrowed to capabilities, landing zones, or guardrails.
- Expanded: one card selected, expand panel visible with full detail.
- Empty: clear messaging with reset action.
- Loading: skeleton cards matching grid layout.

### Capability Detail

This page should answer what the capability is, when to use it, how to start, what it connects to, who owns it, and which evidence is authoritative.

Layout priority (top to bottom):

1. **Header**: capability name, status badge, owner team, support channel.
2. **Decision summary**: when to use, when NOT to use (concise, not long-form docs).
3. **Get started**: entry tool cards (TFE module, Harness pipeline) with direct links.
4. **Availability**: compact region status (inline chips or mini-grid), link to full explore view.
5. **Landing zones**: which landing zones support this capability, with level indicators.
6. **Guardrails**: applicable guardrail areas with links to policy evidence.
7. **Sources and evidence** (expandable): authority badges, freshness, inline expand to show anchors, excerpts, and expansion paths.

Do not duplicate long-form documentation. The page should route users to source-native evidence and cite exact excerpts.

Evidence expansion behavior:

- Default state: collapsed source list showing title, authority badge, and freshness indicator.
- Expanded state: full evidence panel showing anchors, excerpts, warnings, and expansion paths.
- Evidence is inline (below main content), not a persistent side rail.
- Model: Wikipedia reference markers [1][2] → expand to see source detail.

### Landing Zone Navigator

This surface should support comparison first, then detail.

Required behavior:

- Show landing zones with supported environments, guardrail summary, provisioning tool, deployment tool, owner, support path, and onboarding path.
- Show related capabilities and platform tools when the data is available.
- Surface source warnings next to the affected landing zone.
- Provide a detail route when a landing zone needs expanded guardrail evidence.

Recommended layout:

- Use a comparison matrix or dense comparison rows for environment and guardrail coverage.
- Use guided detail pages for individual landing zones.
- Keep operational links as entry points, not embedded workflow actions.
- Do not build a decision flow in V1. That would imply recommendation logic the Context Layer does not own.

### Health and Scorecards

Health in V1 means guidance health and evidence readiness, not full service reliability.

Layout priority:

1. **Coverage indicators**: compact progress bars showing authority coverage by object type.
2. **Issue list**: actionable rows — each row shows the affected object, issue type, and age.
3. **Navigation**: each issue links to the affected catalog object or source.

Required behavior:

- Show authority coverage by catalog object type.
- Show stale sources, broken anchors, missing owner/support, restricted evidence, unavailable evidence, and authority conflicts.
- Show affected catalog objects for each health issue.
- Provide inline feedback or report issue entry points.

Design rules:

- Do not use hero metrics. Health metrics are operational signals, not marketing proof.
- Progress bars use compact inline display (not large radial charts).
- Numbers in IBM Plex Mono for alignment.
- Use scorecard language carefully: `Guidance readiness` or `Evidence health`, not generic `Service health`.
- Do not introduce weighting, criteria builders, or scorecard configuration in V1.

### Ask Atlas

Ask Atlas is a catalog-aware, citation-bound AI consumer example, not the architecture.

Pilot / V1 deferred entry:

- Provide a persistent **FAB** that opens a **modal** containing deferred-boundary copy (`AskAtlasFab` pattern). Closing returns to the prior surface without navigation.
- Optional **`/ask` route** carries the same content for bookmarks and parity with future full-page layout.
- Do **not** place Ask Atlas in the **primary top navigation** in the pilot shell.
- Do not make Ask Atlas the default **home hero** search behavior.
- Preserve the future boundary: Ask Atlas will resolve catalog objects, use context bundles, citations, warnings, and server-side LLM adapter logic.

Long-term navigation (post-pilot):

- When the composer and cited-answer flow are real, reconsider a top-nav or secondary nav entry alongside FAB if research supports it.

Later required behavior:

- Accept a user question.
- Resolve likely catalog objects, owners, sources, or guardrail areas before asking the model to answer.
- Retrieve a context bundle through the Portal server-side boundary.
- Build prompts only from the context bundle plus the question.
- Display only cited factual claims.
- Show rejected or unverified claims as unavailable, stripped, or blocked according to the existing AI consumer contract.
- Display citations, authority badges, freshness, conflicts, restricted-source warnings, and expansion links.
- Return a clear no-registered-source state when no evidence exists.
- Enforce Portal-owned rate limits if Portal hosts model invocation.

Recommended layout:

- Question composer at top.
- Resolved object strip below the composer, such as related capability, landing zone, guardrail, source, or owner.
- Answer body with claim-level citations.
- Inline evidence expansion for cited sources.
- Warning stack above the answer when the bundle includes stale, broken, conflict, restricted, unavailable, or missing-source signals.

## Component System

Use a small component vocabulary. Add components only when at least two screens need the pattern.

| Component | Purpose |
|---|---|
| `PortalShell` | Top navigation bar with brand, nav links, health indicator where applicable, route region, pilot **FAB** slot for Ask |
| `TopNav` | Horizontal nav links in the top bar with active state |
| `IntentSearch` | Catalog-aware search input with synonym support and ⌘K shortcut |
| `EntryCardGrid` | Clickable platform entry cards (Evaluate / Decide / Onboard) with active state |
| `EntryCardPanel` | Expandable inline content panel for each entry card phase |
| `DeveloperJourneyGrid` | 2×2 lifecycle step grid (Get started → Build → Validate → Operate) with links |
| `CatalogHighlights` | Asymmetric stat blocks showing catalog service and region counts |
| `ResourceLinkGrid` | 2×2 grid of resource link cards with icons and descriptions |
| `ExploreGrid` | Domain-grouped card grid with region strip and filters |
| `RegionStrip` | Clickable location cells with availability counts |
| `ServiceCard` | Compact card with icon, name, domain, and status chips |
| `ExpandPanel` | Inline full-width detail panel after selected card |
| `MatrixView` | Dense table view with service rows and location columns |
| `CatalogObjectDetailHeader` | Name, type, status, owner, support, and primary tool actions |
| `DecisionSummary` | When to use / when not to use compact section |
| `EntryToolCard` | Compact tool link card (TFE, Harness, etc.) |
| `RelationshipPanel` | Related capabilities, landing zones, guardrails, and tool entries |
| `GuidanceHealthBand` | Compact one-line health summary for home |
| `GuidanceHealthDashboard` | Full health page with coverage bars and issue list |
| `HealthIssueList` | Actionable health and evidence readiness rows |
| `AuthorityBadge` | `authoritative`, `reference`, `example`, `draft`, `deprecated` |
| `FreshnessIndicator` | Review freshness, needs-review, stale |
| `StatusChip` | Availability status: available, interim, planned, not planned |
| `WarningStack` | Stale, broken, conflict, restricted, unavailable, missing-source warnings |
| `EvidenceSection` | Expandable inline evidence: sources, anchors, excerpts, citations |
| `ExpansionPathList` | Progressive disclosure actions |
| `FeedbackInlineForm` | Missing, stale, broken, unclear feedback |
| `AskAtlasFab` | Floating button + modal wrapper for deferred Ask entry (pilot) |
| `AskDeferredEntry` | Deferred boundary copy used inside modal and optional `/ask` page |
| `ResolvedObjectStrip` | Ask Atlas related catalog objects before answer generation |
| `AskComposer` | Future Ask Atlas question input and submit state |
| `CitedAnswer` | Future claim list with citation mapping |
| `EmptyState` | Contextual empty state with actionable guidance |
| `SkeletonBlock` | Route and panel loading states |

State coverage per interactive component:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Error
- Empty

## Component Library Strategy

Use Base UI as the primitive layer and a shadcn-style local component layer for Atlas-owned wrappers.

### Styling Stack

Use Tailwind CSS as the utility styling engine for Portal UI implementation.

Tailwind is the implementation layer for spacing, layout, interaction states, and token-backed utility classes. It is not the product design system by itself. Atlas-owned CSS variables and OKLCH design tokens define the visual language, and Tailwind utilities consume those tokens.

Rules:

- Configure Tailwind inside the `portal` package when shadcn is initialized.
- Keep `components.json` pointed at the Portal global CSS entry and Atlas aliases.
- Use CSS variables for color, radius, focus, surface, border, text, semantic state, and sidebar tokens.
- Do not hardcode brand color, semantic colors, spacing one-offs, or radius values in component markup when a token exists.
- Do not use arbitrary Tailwind values to bypass the Atlas token system.
- Keep Base UI as the accessible primitive layer. Tailwind styles the local Atlas wrappers, not Base UI internals directly.
- Treat shadcn-generated Tailwind classes as starting points. Adapt them to Atlas density, evidence-surface rules, token names, focus states, and anti-pattern checks before shipping.
- Expected utility dependencies include `clsx`, `class-variance-authority`, `tailwind-merge`, `@tabler/icons-react`, and `tw-animate-css` when required by generated or local components.
- Use Tabler Icons as the Portal icon library. Do not use `lucide-react` unless this design plan is updated.
- Add Tailwind-related and UI utility dependencies only as needed by the current implementation batch. Do not install broad UI dependency sets preemptively.

External reference checks:

- Base UI is an unstyled React component library for accessible interfaces. It does not bundle CSS or prescribe a styling engine, which keeps Atlas in control of its product tokens and brand usage.
- Tailwind CSS is the selected styling engine for shadcn-generated local wrappers and Atlas utility classes.
- shadcn CLI supports `--base base`, and the `docs` command can fetch component documentation for the Base UI variant.
- shadcn's component catalog includes the primitives Atlas will need, including `Sidebar`, `Command`, `Table`, `Field`, `Button`, `Badge`, `Breadcrumb`, `Collapsible`, `Dialog`, `Input`, `Popover`, `Select`, `Skeleton`, `Tabs`, `Tooltip`, and `Typography`.
- Tabler Icons is the selected icon package for Portal navigation, status indicators, empty states, and action affordances.
- shadcn skills are intended to give AI assistants project-aware context about components, registry usage, installed base library, aliases, theming, and component APIs.

Reference links:

- [Base UI About](https://base-ui.com/react/overview/about)
- [shadcn CLI](https://ui.shadcn.com/docs/cli)
- [shadcn Components](https://ui.shadcn.com/docs/components)
- [shadcn Skills](https://ui.shadcn.com/docs/skills)

### Component Ownership

Atlas should not import a full visual system blindly. Treat shadcn as a component distribution and reference workflow, and keep final Atlas components owned locally.

| Atlas component | Base UI or shadcn reference | Implementation rule |
|---|---|---|
| `PortalShell` | `breadcrumb`, `separator` | Top bar with brand, nav links, and content region. Own active state, responsive collapse, and mobile menu locally. |
| `IntentSearch` | `input`, `command`, `popover` | Catalog-aware search with synonym support. Not a general enterprise search. |
| `EntryCardGrid` + `EntryCardPanel` | `card`, `collapsible`, `button`, `separator` | Clickable entry cards with inline expandable panels on home. Not a modal or wizard. |
| `ExploreGrid` | `table`, `badge`, `tabs`, `select`, `popover` | Unified catalog + availability. Domain-grouped cards with matrix toggle. |
| `RegionStrip` | custom | Clickable location cells. No shadcn equivalent. |
| `ServiceCard` | `card`, `badge` | Compact card with status chips. Not decorative. |
| `ExpandPanel` | `collapsible`, `badge`, `button`, `separator` | Inline full-width detail. Not a modal. |
| `RelationshipPanel` | `tabs`, `table`, `badge`, `collapsible` | Show connected objects without graph visualization. |
| `GuidanceHealthDashboard` | `table`, `badge`, `progress`, `tooltip` | Evidence readiness and coverage. Not a scorecard builder. |
| `EvidenceSection` | `collapsible`, `scroll-area`, `separator`, `tooltip` | Inline expandable evidence. Not a persistent rail. |
| `WarningStack` | `alert`, `badge`, `collapsible` | Inline, tied to source or anchor identity. No side-stripe styling. |
| `FeedbackInlineForm` | `field`, `textarea`, `button`, `select` | Inline form first. Not a modal. |
| `AskAtlasFab` | `button`, `dialog` (when adopted) | FAB + modal for deferred Ask entry in pilot; `/ask` shares content. |
| `AskDeferredEntry` | `empty`, `button`, `badge` | Deferred boundary copy inside modal and optional page. |

### shadcn CLI and Skill Usage

Use these commands as a discovery and implementation workflow:

| Step | Command |
|---|---|
| Initialize shadcn for the Portal package when implementation starts | `pnpm dlx shadcn@latest init --template start --base base --cwd portal` |
| Inspect project config after setup | `pnpm dlx shadcn@latest info --cwd portal --json` |
| Search available registry items before choosing components | `pnpm dlx shadcn@latest search @shadcn -q "sidebar"` |
| Read Base UI variant docs before generating code | `pnpm dlx shadcn@latest docs sidebar --base base` |
| Preview component install changes before writing | `pnpm dlx shadcn@latest add sidebar --cwd portal --dry-run` |
| Add only the component needed for the current batch | `pnpm dlx shadcn@latest add sidebar --cwd portal` |
| Install shadcn skill support if this repository adopts skills for UI work | `pnpm dlx skills add shadcn/ui` |

Rules:

- Run `search` or `docs` before adding a component.
- Use `--base base` for docs and initialization.
- Use `--cwd portal` so generated files land under the Portal package.
- Ensure generated Tailwind utilities resolve through Portal global CSS and Atlas token variables.
- Configure the shadcn icon library as Tabler Icons when initializing or editing `components.json`.
- Replace any generated icon imports that point to a different icon library with `@tabler/icons-react` equivalents before shipping.
- Add components one small batch at a time. Do not run `add --all`.
- Use `--dry-run` before any component install in a dirty worktree.
- Treat shadcn blocks as references, not production-ready Atlas screens.
- If the shadcn skill is installed later, confirm it reads `components.json` and project config before relying on AI-generated component code.
- Keep Base UI primitives headless and accessible; Atlas CSS tokens define the actual visual language.

## Visual System

### Theme

Use a light, restrained product theme. This better fits daytime internal engineering work and evidence scanning.

Avoid category reflexes: do not make Atlas a dark blue cloud console clone, a purple AI tool, or a glossy SaaS landing page.

### Color

Use OKLCH tokens when implementing CSS.

Brand source color:

- Source value: `#001aff`.
- CSS variable: `--brand: #001aff`.
- All accent tokens derive from `--brand` using `color-mix()` for maintainability.
- Treat this as the brand accent source, not a general background color.

Neutral hue direction:

- Neutral surfaces, borders, text, and shadows use hue `267` with very low chroma (0.003–0.015). This keeps neutrals slightly cool-tinted toward the brand blue without washing the canvas.

Color tokens:

| Token | Value | Usage |
|---|---|---|
| `--bg` | `oklch(97.5% 0.004 267)` | Page background |
| `--surface` | `oklch(99.5% 0.003 267)` | Card and panel backgrounds |
| `--surface-elevated` | `oklch(99.8% 0.002 267)` | Search bar, elevated controls |
| `--border` | `oklch(90.5% 0.01 267)` | Section separation and table rows |
| `--border-strong` | `oklch(82% 0.012 267)` | Hover state borders |
| `--text` | `oklch(15% 0.014 267)` | Main labels and body text |
| `--text-secondary` | `oklch(42% 0.014 267)` | Metadata, helper text, timestamps |
| `--text-soft` | `oklch(56% 0.012 267)` | Placeholder text, disabled labels |
| `--brand` | `#001aff` | Brand source color (not used directly on surfaces) |
| `--accent` | `var(--brand)` | Primary action, active nav marker, selected filter |
| `--accent-soft` | `oklch(96.2% 0.026 267)` | Active nav background, selected row tint |
| `--accent-hover` | `color-mix(in srgb, var(--brand) 78%, #0a0a12)` | Hover state for accent elements |
| `--accent-text` | `oklch(99% 0.01 267)` | Text on accent-colored backgrounds |
| `--accent-focus` | `color-mix(in srgb, var(--brand) 12%, transparent)` | Focus ring fill |
| `--accent-glow` | `color-mix(in srgb, var(--brand) 8%, transparent)` | Outer glow on focused inputs |
| `--accent-sheen` | `color-mix(in srgb, var(--brand) 4%, transparent)` | Subtle gradient overlay on active cards |
| `--available` | `oklch(52% 0.14 155)` | Available status |
| `--available-bg` | `oklch(95.5% 0.035 155)` | Available chip background |
| `--planned` | `oklch(50% 0.12 280)` | Planned status |
| `--planned-bg` | `oklch(95.5% 0.025 280)` | Planned chip background |
| `--interim` | `oklch(58% 0.15 70)` | Interim status |
| `--interim-bg` | `oklch(96% 0.04 70)` | Interim chip background |
| `--warning` | `oklch(60% 0.14 55)` | Stale, needs-review signals |
| `--critical` | `oklch(55% 0.2 25)` | Broken, unavailable, access-denied |
| `--success` | `oklch(65% 0.15 155)` | Valid anchors, fresh sources |

Rules:

- Do not use pure black or pure white.
- Keep accent usage under control. `#001aff` marks action and selection, not decoration.
- Use full-strength accent only for primary actions, active navigation, selected filters, focused controls, and small selection indicators.
- Keep brand accent coverage below 10% of any normal viewport.
- For large fills, hover backgrounds, selected-row tints, and focus halos, use `--accent-soft`.
- Do not use accent for warning, success, critical, or status semantics. Those states have dedicated tokens.
- Do not use accent as the top bar background, page background, panel fill, table header fill, or Ask Atlas answer background.
- Availability status colors (available, planned, interim, not-planned) are independent from semantic warning/success/critical colors.
- Authority badges use color plus label, never color alone.

### Typography

Use IBM Plex Sans as the primary UI font. Use IBM Plex Mono for data values, code references, region names, and status labels.

Type scale (compact product scale):

| Role | Size | Weight | Tracking | Font |
|---|---|---|---|---|
| Page title | 22-24px | 700 | -0.03em | Plex Sans |
| Section title | 18px | 600 | -0.01em | Plex Sans |
| Card title / Row title | 13-14px | 600 | -0.01em | Plex Sans |
| Body text | 14px | 400 | normal | Plex Sans |
| Metadata / Label | 12px | 500 | normal | Plex Sans |
| Data value / Status | 11-12px | 600 | 0.04em uppercase | Plex Mono |
| Code reference | 13px | 400 | normal | Plex Mono |

Rules:

- Do not use display fonts for labels, buttons, tables, or badges.
- Keep prose blocks under 75ch.
- Use Plex Mono for all numeric values in health, availability, and evidence contexts.
- Section labels and domain headers use 10-11px uppercase with letter-spacing for visual separation.
- Do not mix font families within a single label or badge.

### Layout

- Desktop: top navigation bar (52px sticky) plus centered main content (max-width 860px for focused pages like Home, max-width 1200px for browse pages like Explore), evidence expands inline.
- Tablet and narrow desktop: top bar nav links may collapse to a menu; evidence moves below primary content.
- Mobile: top bar collapses to brand + menu; stacked content; source tables become grouped rows. Bottom navigation bar with 4-5 key destinations as an alternative.
- Use stable dimensions for badges, icon buttons, filters, and warning chips to prevent layout shift.
- Main content area uses `max-width: 1200px` with auto margins.
- Card grids use `auto-fill, minmax(280px, 1fr)` for responsive behavior.

### Spacing and Radius

- Content padding: 24px desktop, 16px mobile.
- Card padding: 12-14px.
- Card gap: 8px.
- Section gap: 24px.
- Border radius: 8px cards, 12px panels, 6px inputs and buttons, 999px pills and chips.
- Transition timing: 0.16s cubic-bezier(0.22, 1, 0.36, 1).

## Data and Runtime Boundaries

### TanStack Start Boundary

TanStack Start code is isomorphic by default. Portal implementation must make environment boundaries explicit.

Rules:

- Route loaders can orchestrate page data, but server-only work must be isolated behind server functions or backend-only modules.
- Context API calls that require internal network or credentials happen server-side.
- LLM invocation happens only through a Portal server-side adapter.
- Browser components receive parsed response data and presentation state.
- Do not copy Next.js, Remix, or app-router patterns into the Portal.
- Ensure the Start root route renders the document shell, `HeadContent`, route outlet, and scripts.

### Context API Client

The Portal client must depend on shared schema types.

Required methods:

- Discover catalog objects with filters across type, owner, lifecycle/status, warning state, and evidence coverage.
- Discover topics with filters for capability, landing zone, and guardrail views.
- Discover availability records by service or capability, region, outpost, landing zone level, domain, status, and owner.
- Discover sources with filters.
- Fetch context bundle by topic, source, anchor, question, keyword, and disclosure level.
- Expand source or anchor content.
- Fetch guidance health summaries and affected object lists.
- Submit feedback.

Implementation constraints:

- Parse all API responses through shared schemas.
- Preserve structured error codes for UI branching.
- Never expose raw exceptions as user-visible text.
- Do not let UI components construct source truth from hardcoded pilot objects.
- Keep catalog object view models as projection data from schema-backed API responses. UI view models may rename fields for presentation, but must not invent authority, owner, or source-health facts.

## Frontend Implementation Phases

### Phase P0: Portal Design Foundation

Deliver:

- Route map and component ownership confirmed.
- Catalog object presentation model confirmed, including relationship to backend `Topic`, `Source`, and `Anchor` records.
- Logo slot contract for top bar desktop, tablet, and mobile states.
- Base UI plus shadcn local component strategy confirmed.
- Initial `components.json` plan for the `portal` package, with `base` selected as the base library.
- Tailwind CSS setup scoped to the `portal` package and wired to Atlas token variables.
- Tabler Icons configured as the Portal icon library.
- IBM Plex Sans and IBM Plex Mono font loading configured.
- Design tokens for color, spacing, typography, radius, focus, and state.
- Brand token mapping for `#001aff`, including restrained accent usage and reduced-chroma tints.
- Availability status token set: available, planned, interim, not-planned.
- Shared UI state vocabulary for loading, empty, warning, error, and restricted evidence.
- Impeccable anti-pattern checklist added to the implementation review template.

Verify:

- `git diff --check`
- Manual review against `docs/architecture/constraints.md`
- shadcn `search` or `docs` output is checked before choosing each component.
- No component is added without a dry-run in a dirty worktree.
- Brand color appears only through approved accent or tint tokens.
- Logo slot remains stable with icon-only, wordmark, and placeholder variants.
- Product copy says catalog object, capability, landing zone, guardrail, source, or owner. It does not expose `Topic` as a primary user-facing term.
- IBM Plex fonts load correctly and fallback to system sans-serif and monospace.

### Phase P1: TanStack Start App Shell

Deliver:

- TanStack Start root route and document shell.
- Route tree for home, pilot catalog/unified browse (see `/explore` or canonical catalog path), capability and landing-zone detail routes as needed for deep linking, optional `/ask`; **defer `/health`** until Phase P6 unless already implemented.
- Portal shell with top navigation bar (brand, nav links, health indicator), and content region.
- Top bar responsive collapse behavior for tablet and mobile.
- shadcn/Base UI primitives owned by Atlas, adapted for top bar pattern.

Verify:

- Typecheck passes.
- Root route includes required script hydration.
- Navigation routes render without hardcoded Context Layer internals.
- Top bar renders brand mark, nav links, health indicator, and sync status correctly.
- Brand mark works with icon + wordmark (desktop) and icon-only (mobile) states, including missing-logo placeholder.
- Home hero search input renders with ⌘K indicator.

### Phase P2: Context API Loader Boundary

Deliver:

- Schema-backed API client.
- Server-side data access boundary for Context API calls.
- Loader data shapes for explore list, catalog detail, topic list, topic detail, availability, source detail, health summary, and Ask context retrieval.

Verify:

- Tests prove Portal parses shared schema responses.
- Tests prove API error codes map to UI states.
- Browser bundle does not contain source-system or LLM credentials.

### Phase P3: Home and Decision Journey

Deliver:

- Home with hero (framing statement + intent search), platform entry cards, developer journey grid, catalog highlights, recent activity, health band, and resource links.
- IntentSearch with catalog-aware routing and synonym support.
- EntryCardGrid with Evaluate / Decide / Onboard cards, clickable with active state and inline expand panels.
- EntryCardPanel for each phase: inline expandable content with search, filtered lists, and resolution paths.
- Evaluate panel: searchable capability list with inline availability.
- Decide panel: landing zone comparison with guardrails and tools.
- Onboard panel: entry tool card grid and owner/support contacts.
- DeveloperJourneyGrid with 4 lifecycle steps and action links.
- CatalogHighlights with service count and region count stats.
- ResourceLinkGrid with icon cards for key surfaces.

Verify:

- Home first viewport shows hero search and entry cards, not a static directory.
- Clicking an entry card expands its panel inline.
- Only one panel expanded at a time.
- Panel content resolves to catalog object detail pages on selection.
- Search routes to correct catalog objects on keyword and synonym input.
- Health band reflects real API-derived **counts** where available; dashboard link omitted in pilot unless `/health` is live.
- Empty states guide users toward available content.
- No modal, overlay, or wizard behavior.
- Developer journey grid and catalog highlights render with correct data.
- Resource link grid navigates to correct routes.

### Phase P4: Explore Surface

Deliver:

- Unified explore page with region strip, domain-grouped card grid, and matrix toggle.
- Service cards with inline availability status chips.
- Inline expand panel with location detail, guidance notes, and next-step actions.
- Matrix view with service rows and region columns.
- Type filter to narrow to capabilities, landing zones, or guardrails.
- Domain filter, status filter, and search within explore.
- Sticky domain section headers.

Verify:

- Pilot data renders from API responses in both card and matrix views.
- Region strip filters card grid correctly.
- Expand panel shows correct availability per location with ETA for planned states.
- Matrix view shows status chips per cell.
- Filter and empty states are covered by tests.
- View toggle preserves filter state.

### Phase P5: Detail and Evidence Surfaces

Deliver:

- Capability detail page with answer-first layout.
- Landing zone detail page with comparison focus.
- Guardrail detail page (accessed via `/explore/$objectId`).
- Source detail view (accessed via evidence expansion or `/explore/$objectId`).
- Inline evidence sections with expandable source detail.
- Relationship panels for connected objects.
- Authority badges, freshness indicators, warning stack.
- Inline feedback form.

Verify:

- Tests cover authoritative, reference, draft, deprecated, stale, broken, restricted, unavailable, conflict, and no-registered-source states.
- Restricted and broken states are visible and tied to source or anchor identity.
- Detail pages do not duplicate long-form source content.
- Evidence sections expand and collapse correctly.
- Relationship panels do not imply recommendation logic or provisioning authority.

### Phase P6: Health Surface (deferred past the pilot slice unless explicitly scheduled)

Deliver when this phase is in scope:

- Guidance health dashboard with coverage progress bars and issue list.
- Authority coverage summary by catalog object type.
- Issue lists for stale sources, broken anchors, missing owner/support, restricted evidence, unavailable evidence, and authority conflicts.
- Navigation from health issue to affected catalog object or source.

Verify:

- Health does not present generic service reliability scores.
- Health issues remain tied to concrete catalog objects, sources, or anchors.
- No configurable scorecard builder is introduced in V1.
- Numbers render in Plex Mono.

### Phase P7: Ask Atlas UI

Deliver:

- Deferred Ask Atlas entry via **FAB + modal** (`AskAtlasFab`); optional **`/ask`** page for deep links and parity.
- Boundary copy that explains Ask Atlas will answer from governed context when enabled.
- Disabled or unavailable state that does not imply a working AI answer flow.
- Future integration point for catalog-object resolution, context bundle retrieval, server-side LLM adapter, prompt construction, citation validation, and rate limits.

Verify:

- Ask Atlas appears as visible but deferred from FAB (and optional `/ask`).
- Modal traps focus, supports Escape to close, and returns to the underlying page without implying a live answer flow.
- UI does not route normal global search into Ask Atlas.
- Future Ask tests remain listed as post-core work: prompt content, citation validation, uncited claim handling, and rate limits.

### Phase P8: Browser Interaction and Accessibility Hardening

Deliver:

- Keyboard navigation for global search, top navigation, filters, expand panels, and feedback.
- Focus-visible states for every interactive control.
- Responsive behavior for desktop, tablet, and mobile.
- Playwright coverage for critical user paths once routes are wired.

Verify:

- Playwright covers: home intent search, entry card expansion and resolution, developer journey link navigation, explore card selection and expand, matrix view toggle, capability detail, landing zone navigation, feedback submission, **deferred Ask entry (FAB/modal)**, and — when **`/health` ships** — health issue navigation.
- No text overlaps at mobile and desktop widths.
- Skeletons do not shift layout when data resolves.
- Logo and brand accent usage remain stable across desktop, tablet, and mobile screenshots.
- Top navigation responsive collapse is keyboard accessible.

## Testing Strategy

| Layer | Coverage |
|---|---|
| Unit | Data mappers, catalog object projections, warning classification, badge labels, feedback payloads, synonym matching |
| Component | Service cards, expand panel, region strip, health dashboard, evidence sections, warning stack, entry cards, entry card panels, developer journey grid |
| Route | Loader success, structured error mapping, no-source states, health issue states |
| Interaction | Filters, keyboard focus, expand/collapse, view toggle, entry card navigation, feedback submission |
| End-to-end | Home intent search, entry card expand and resolve, developer journey links, explore card and matrix views, capability detail, landing zone comparison, deferred Ask FAB/modal, health navigation **when Phase P6 is active** |

Do not rely on snapshots alone. Assertions must check visible authority, warning, citation, and expansion behavior.

## Impeccable Anti-Pattern Checks

Every frontend implementation batch must explicitly check for these patterns before review:

| Anti-pattern | Atlas Portal rule |
|---|---|
| Side-stripe borders | Do not use thick `border-left` or `border-right` accents on cards, alerts, rows, or callouts. Use full borders, icons, background tints, or inline warning labels. |
| Gradient text | Do not use gradient text for Atlas, Ask Atlas, metrics, page titles, or source labels. Use solid text color and hierarchy. |
| Glassmorphism as default | Do not use blurred glass panels for the shell, evidence sections, Ask answers, or service cards. Portal is an evidence tool, not a decorative surface. |
| Hero-metric template | Do not build the home page around oversized metrics, supporting stat cards, or a brand-colored hero band. Home starts with intent entry. |
| Identical card grids | Do not make every capability, landing zone, and guardrail an identical icon card. Use domain-grouped cards with status context, dense lists, matrices, and detail panels. |
| Modal as first thought | Do not default to modals for feedback, citations, expansion paths, or warnings. Prefer inline forms, popovers tied to controls, or progressive disclosure panels. **Exception:** deferred **Ask Atlas** entry may use a **FAB-triggered modal** as an explicit carve-out until the composer ships. |
| Decorative motion | Do not add motion unless it communicates state, loading, reveal, or feedback. Keep transitions under 200ms with ease-out curves. |
| Heavy inactive brand color | Do not use full-strength `#001aff` on inactive nav items, empty states, large backgrounds, or disabled controls. |
| Inconsistent controls | Buttons, filters, tabs, tables, and forms must share the same shape, focus, hover, disabled, and loading vocabulary across routes. |
| Reinvented standard affordances | Do not invent custom scrollbars, unusual form controls, or non-standard navigation just for flavor. |
| Feature directory home | Do not make the home page a list of nav links or object-type entries. Start from user intent. |
| Persistent empty rail | Do not show a persistent right evidence rail when evidence is sparse. Use inline expandable sections. |

## Do and Don't

### Do

- Keep Portal information-centric.
- Start from user intent on the home page.
- Use the platform entry cards (clickable cards + inline expand panels) as the primary V1 interaction pattern on Home.
- Use the unified Explore surface for catalog browse and availability.
- Distinguish catalog objects from source evidence.
- Show source authority, freshness, visibility, and warning state everywhere evidence is used.
- Show relationships among capabilities, landing zones, guardrails, tools, sources, and owners.
- Treat availability as a first-class status dimension on catalog objects, not a separate disconnected surface.
- Treat health as guidance readiness and evidence quality in V1.
- Treat Ask Atlas as one consumer surface.
- Keep UI labels direct and task-oriented.
- Reuse shared schema contracts.
- Keep components small and state-complete.
- Use Base UI primitives for accessible behavior and local Atlas wrappers for product styling.
- Use shadcn search, docs, and dry-run flows before adding components.
- Use Tabler Icons for navigation, status, feedback, and action icons.
- Use IBM Plex Sans and IBM Plex Mono as the type system.
- Use familiar controls for filters, tabs, tables, buttons, and forms.
- Leave stable space for the company logo in the top bar.
- Use `#001aff` with restraint through approved brand tokens.
- Run the impeccable anti-pattern checks before requesting review.

### Don't

- Do not build a marketing landing page.
- Do not build a feature directory as the home page.
- Do not build provisioning workflows.
- Do not build a full company service catalog or CMDB.
- Do not split catalog browse and availability into separate disconnected surfaces.
- Do not imply service reliability scoring when the data only supports guidance health.
- Do not hide restricted, stale, broken, or conflicting evidence.
- Do not place Context Layer logic in Portal components.
- Do not create a second source-of-truth content layer in the UI.
- Do not invent decorative components where standard product controls work better.
- Do not use modals as the first answer for feedback, expansion, or citations.
- Do not copy shadcn blocks as final Atlas screens without adapting density, brand tokens, data boundaries, and accessibility states.
- Do not run `shadcn add --all`.
- Do not use Radix-based shadcn components after choosing Base UI unless the design plan is updated.
- Do not introduce `lucide-react` or mix icon libraries without updating this plan.
- Do not use the logo as repeated decoration.
- Do not use `#001aff` as a large-area background or semantic warning color.
- Do not ship side-stripe accents, gradient text, default glass panels, hero metrics, or identical decorative card grids.
- Do not show a persistent right evidence rail.
- Do not use Inter, system UI, or generic sans-serif as the primary font.

## Definition of Done

Portal frontend work is ready for V1 pilot review when:

- Users can start from Home intent entry and reach the **catalog / explore** surface, capability routes, landing zone routes, and **Ask Atlas (FAB/modal)**. **`/health` is optional** until Phase P6 is in scope for the pilot.
- Platform entry cards (Evaluate, Decide, Onboard) expand inline panels on Home and resolve users to catalog object detail with entry tools. Developer journey grid provides lifecycle orientation with direct links.
- Explore surface shows domain-grouped cards with inline availability, region strip filtering, expand panels, and matrix toggle.
- All primary pages consume schema-backed API data.
- Catalog objects show type, owner, lifecycle/status, support path, relationship signals, evidence coverage, and warning state.
- Availability status is visible inline on service cards with available, planned, interim, and not-planned states.
- Source authority, freshness, visibility, citations, warnings, and expansion paths are visible through inline evidence sections.
- When `/health` is in scope: health surface shows guidance readiness and evidence quality without becoming a generic service reliability scorecard. **Pilot without `/health`:** ambient signals only.
- The company logo has a stable reserved top bar slot across desktop and mobile.
- `#001aff` is used only as restrained brand accent or reduced-chroma tint.
- IBM Plex Sans and IBM Plex Mono are loaded and applied correctly.
- Base UI is the selected primitive layer, and shadcn-generated local wrappers follow Atlas tokens and component ownership rules.
- Feedback can be submitted from the surfaces where users discover gaps.
- Ask Atlas is visible as a deferred capability (**FAB/modal**, optional `/ask`) and does not misrepresent unimplemented AI behavior as live.
- Browser code contains no source-system credentials, LLM credentials, DynamoDB access, or Context Layer internals.
- Tests cover happy paths and degraded evidence states.
- Impeccable anti-pattern checks are part of the frontend review checklist.

## Commit Strategy

Keep frontend work in small Conventional Commit batches:

1. `docs:` Portal frontend design plan.
2. `feat:` TanStack Start shell, top navigation bar, and route tree.
3. `feat:` Base UI and shadcn local component foundation with IBM Plex fonts.
4. `feat:` schema-backed Portal API loaders.
5. `feat:` home intent entry and decision journey.
6. `feat:` unified explore surface with availability.
7. `feat:` detail and evidence surfaces.
8. `feat:` guidance health surface.
9. `feat:` deferred Ask Atlas entry.
10. `test:` browser interaction and accessibility coverage.

Do not combine visual system setup with Context Layer data-model changes unless the change is strictly contract integration.
