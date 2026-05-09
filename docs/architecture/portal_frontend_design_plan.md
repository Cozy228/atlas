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

Build Atlas Portal as a work-focused Cloud Platform DevEx Portal: a scoped catalog, guidance surface, and governed evidence experience for application teams.

Portal V1 should make these jobs obvious:

- Find an approved platform capability.
- Compare landing zones, guardrails, tools, and support paths.
- Browse a scoped cloud platform catalog without turning Atlas into a full CMDB.
- Understand ownership, readiness, health, and operational context for catalog objects.
- Locate authoritative sources, source owners, and source health signals.
- Ask a cited platform question grounded in catalog objects and registered evidence.
- Report missing, stale, broken, conflicting, or unclear guidance.

The Portal must feel like a real operating surface, not a marketing page, provisioning wizard, documentation clone, passive document index, or admin console.

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
- Use familiar product patterns: sidebar, top search, catalog filters, breadcrumbs, tabs, tables, relationship panels, badges, health summaries, action menus, and inline feedback.
- Reserve a stable brand area for the company logo, but keep the first viewport task-oriented.
- Use `#001aff` as a controlled accent for action and selection only. Do not let brand color overpower evidence scanning.
- Avoid a hero landing page. The first viewport should be the usable Portal.
- Avoid identical decorative card grids. Use lists, tables, comparison matrices, and detail panels where they fit the task better.
- Avoid nested cards. Use full-width sections, table rows, split panes, and inline panels instead.
- Treat motion as operational feedback only. Catalog row expansion, evidence reveal, and inline save states can move; decorative page choreography should not.

## Resolved Portal UX Direction

These decisions come from the Portal design brainstorm and should guide implementation before individual components are built.

| Area | Decision |
|---|---|
| Product direction | DevEx Portal with a scoped cloud platform catalog. The first impression should be clear, credible, and usable, while deeper screens retain evidence-first rigor. |
| Visual density | Guided Product by default. Catalog lists can be Calm Dense. Source, health, and evidence views can become Evidence Console when users expand details. |
| Home | Primary entries: Catalog, Capabilities, Landing Zones, Guardrails, Sources. Ask Atlas, feedback, health gaps, and tool links are supporting surfaces. |
| Navigation | Fixed left sidebar with a stable company logo slot. Top bar carries catalog search, environment, and lightweight health/status summary. |
| Search | Browse-first with catalog search. Later add command palette for fast lookup, owner lookup, evidence reveal, and navigation. Do not turn search into a general-purpose enterprise search engine. |
| Catalog | First-class work surface for scoped cloud platform objects. It should show type, owner, lifecycle, support, tool links, evidence coverage, and warning state. |
| Capability discovery | Catalog-filtered capability view. Entry previews may be product-like, but comparison surfaces should use dense rows, tables, grouped sections, and relationship panels. |
| Detail pages | Guided Catalog Detail plus expandable Split Evidence View. Main content explains the object and next actions; evidence rail supports verification. |
| Landing zones | Comparison matrix or dense comparison rows plus guided landing zone detail. No V1 decision flow or recommendation engine. |
| Guardrails | First-class browse and detail surface for policy areas when pilot data supports it. Guardrails are catalog objects backed by policy sources, not long-form copied policy pages. |
| Sources | First-level evidence and governance lookup surface, not an admin registry or passive docs library. |
| Health | V1 health means guidance and evidence health: authority coverage, stale sources, broken anchors, missing owner/support, and conflicts. It does not score all service reliability. |
| Ask Atlas | Catalog-aware, citation-bound assistant surface. It can be visible before full implementation, but it must not become the default way to use the Portal. |
| Evidence | Key authority, freshness, visibility, ownership, and warning badges are inline. Full sources, anchors, citations, and expansion paths live in an expandable rail or panel. |

## Information Architecture

### Product Object Model

Portal UI should expose user-facing catalog objects without leaking backend implementation names into primary navigation.

| User-facing object | Backend alignment | V1 role |
|---|---|---|
| Capability | `Topic` with `topic_type=capability` | Approved cloud platform capability such as S3, Textract, Lambda, EKS baseline, or Bedrock |
| Landing Zone | `Topic` with `topic_type=landing-zone` | Deployment environment option with guardrails, tools, support, and onboarding path |
| Guardrail Area | `Topic` with `topic_type=guardrail-area` | Policy or control area such as networking, IAM, data protection, logging, or approved AI usage |
| Tool Entry | `Topic.entry_tools` or related link metadata | Operational entry point such as TFE module, Harness pipeline, dashboard, request form, or runbook |
| Availability Map | Catalog projection over capability and region data | Secondary discovery surface for service or capability availability across regions, outposts, and landing zone levels |
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
| `/` | Portal home and task entry | Catalog summaries, guided journeys, health signals, warning summaries |
| `/catalog` | Cross-type cloud platform catalog explorer | Capabilities, landing zones, guardrails, tool entries, owner/support metadata, evidence coverage |
| `/catalog/$objectId` | Generic catalog object detail when the object type does not need a specialized route | Object metadata, relationships, actions, context bundle, sources, warnings |
| `/capabilities` | Capability discovery | `topic_type=capability` topics |
| `/capabilities/$topicId` | Capability detail | Topic metadata, context bundle, sources, expansion paths |
| `/landing-zones` | Landing zone navigator | `topic_type=landing-zone` topics |
| `/landing-zones/$topicId` | Landing zone detail | Environment matrix, guardrail excerpts, tool links |
| `/guardrails` | Guardrail area discovery | `topic_type=guardrail-area` topics, policy coverage, owner/support metadata |
| `/guardrails/$topicId` | Guardrail detail | Guardrail summary, related capabilities and landing zones, policy sources, warning state |
| `/availability` | Regional availability map | Service or capability availability by region, outpost, landing zone level, owner, source evidence, next-step links |
| `/sources` | Authoritative source lookup | Source discovery response |
| `/sources/$sourceId` | Source evidence detail | Source metadata, anchors, warnings, expansion paths |
| `/health` | Guidance health and coverage dashboard | Authority coverage, stale sources, broken anchors, conflicts, missing owner/support |
| `/ask` | Ask Atlas entry | Question composer, resolved catalog objects, context bundle, cited answer or deferred state |

Feedback should be inline on detail, source, and Ask surfaces. Do not create a V1 admin route.

### Global Shell

Use a stable product shell:

- Left navigation: logo slot, Home, Catalog, Capabilities, Landing Zones, Guardrails, Sources, Health, Ask Atlas. Availability can appear as a secondary nav item, quick link, or contextual entry from capability and landing zone detail pages.
- Top bar: global catalog query, environment indicator, lightweight health/status summary.
- Main content: route-specific work surface.
- Right evidence rail only when a page needs citations, warnings, or expansion paths.

The shell should not use decorative hero treatment. Atlas as the product name belongs in the shell and page title, not in oversized marketing copy.

Logo slot rules:

- Reserve a stable top-left logo area that supports icon-only and wordmark variants without changing sidebar width.
- Recommended desktop slot: 32px mark height or 160px by 32px wordmark area. Mobile can collapse to the icon mark.
- Do not stretch, recolor, crop, or place the logo over busy backgrounds.
- Do not repeat the logo as decoration in cards, empty states, or section headers.
- If the logo asset is unavailable during implementation, use a neutral reserved placeholder with the accessible label `Company logo`, then replace it when the asset is provided.

## Core Screens

### Home

Home should be a task dashboard, not a welcome page or documentation hero.

Required content:

- Primary entries: Catalog, Capabilities, Landing Zones, Guardrails, Sources.
- Guided journeys: onboard an application, choose a platform capability, check landing zone fit, verify guardrails, find owner/support.
- Secondary links: Availability, Ask Atlas, report stale guidance, common tool entry points.
- Supporting search for registered catalog objects, owners, and sources.
- Recently updated or commonly used catalog objects.
- Health summary for missing authority coverage, stale sources, broken anchors, restricted sources, unavailable sources, and conflicts.
- Owner/support callouts for pilot coverage.

Implementation notes:

- Use dense rows or compact task tiles, not large marketing cards.
- Do not create a static directory page. The first viewport should combine catalog entry, journey entry, and evidence health signals.
- Keep Ask Atlas visible as a secondary entry, but do not present it as the primary way to use Atlas.
- Keep text direct. Do not explain what a portal is.
- Show empty pilot states as actionable gaps, for example no registered authoritative source, not generic empty content.

### Catalog Explorer

Catalog Explorer is the default browse surface for cloud platform objects. It borrows the useful parts of Compass and Backstage catalogs, but remains scoped to Atlas V1.

Required behavior:

- Browse across capabilities, landing zones, guardrail areas, tool entries, sources, and owners.
- Filter by object type, category, lifecycle/status, owner team, support path, authority coverage, health warning, and related source class.
- Show object name, type, short description, owner, lifecycle/status, support path, primary tool links, evidence coverage, and warning count.
- Let users switch between all objects and type-specific views without losing filters.
- Allow favorites or recently used objects only if the data can be local UI state. Do not add backend personalization for V1.

Recommended layout:

- Use a dense table or list as the primary surface.
- Use compact object previews only for home and high-level orientation.
- Keep a side or top filter surface. Filters must not collapse into an opaque search-only experience.
- Use relationship chips for linked landing zones, guardrails, sources, and tools.
- A selected row can open an inline detail panel or navigate to a detail route. Do not use a modal as the first detail surface.

### Capability Discovery

This surface is a filtered catalog view for approved platform capabilities. It should help users compare capabilities quickly and decide where to go next.

Required behavior:

- Filter by category, status, authority coverage, owner team, related landing zone, related guardrail, entry tool, and warning state.
- Show capability name, one-line description, owner team, support path, authority coverage, latest review signal, entry tools, and related landing zones.
- Preserve topic status: active, deprecated, planned.
- Highlight missing authoritative source coverage as a visible risk.

Recommended layout:

- Card + list hybrid: compact entry cards for orientation, then dense list or table rows for comparison.
- Filter rail or compact toolbar above the comparison list.
- Group headings may organize categories, but do not create a decorative card grid.
- Rows should show badges and source coverage indicators.
- Optional grouped sections by category if the pilot data is easier to scan that way.

### Capability Detail

This page should answer what the capability is, when to use it, how to start, what it connects to, who owns it, and which evidence is authoritative.

Required sections:

- Detail header: capability name, status, owner team, support channel.
- Decision summary: what it is, when to use it, when not to use it.
- Getting started: entry tools from API data, such as TFE or Harness links.
- Relationships: supported landing zones, related guardrails, required tools, source evidence, and support paths.
- Health summary: authority coverage, stale evidence, broken anchors, restricted evidence, and conflicts.
- Inline evidence summary: authority level, freshness, visibility, and warning badges.
- Evidence panel: sources, authority level, authority scope, freshness, visibility, anchor status.
- Excerpts and expansion paths from the context bundle.
- Inline feedback for missing, stale, broken, or unclear guidance.

Do not duplicate long-form documentation. The page should route users to source-native evidence and cite exact excerpts.

Use the same Guided Detail plus expandable evidence pattern for landing zone details and source details. When a user expands evidence, the page can shift into a split view with the main content on the left and evidence rail on the right.

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
- Use compact summary rows when the matrix would be too dense on mobile.
- Keep operational links as entry points, not embedded workflow actions.
- Do not build a decision flow in V1. That would imply recommendation logic the Context Layer does not own.

### Guardrail Areas

Guardrails should be discoverable as catalog objects, not hidden inside source documents.

Required behavior:

- List guardrail areas by category, owner, related capabilities, related landing zones, authority coverage, policy source, and warning state.
- Show whether a guardrail has authoritative policy evidence or only reference guidance.
- Connect each guardrail to supported capabilities, affected landing zones, and relevant tool entries.
- Surface missing or stale guardrail evidence as a first-class risk.

Recommended layout:

- Use grouped rows by policy area or lifecycle stage.
- Use relationship panels on detail pages to show affected capabilities and landing zones.
- Keep policy excerpts in the evidence rail. Do not copy long-form policy content into the main page.

### Availability Map

Availability is a portal-native decision surface for capability and service availability. It should not render a raw source matrix as the default experience.

Required behavior:

- Let users search and filter by service or capability, region, outpost, landing zone level, domain, status, owner, and warning state.
- Show availability status with text-first labels such as available, interim, planned, and not planned.
- Show next-step routing for each meaningful state: catalog object link, user guide, onboarding path, fallback path, owner, or support route.
- Show source evidence and last-observed or last-reviewed signals so users can trust the availability data.
- Support deep links from capability detail, landing zone detail, and home quick links with a preselected service, region, or domain.

Recommended layout:

- Use a map-grid hybrid: search and filters at top, structured service or capability cards for browsing, and a focused detail panel for selected availability.
- Keep the dense matrix available only as a focused comparison or evidence expansion, not the default page.
- Group cards by domain when the result set is large.
- Allow lightweight comparison for two or three selected services only if the interaction remains bounded and does not become a spreadsheet replacement.
- Do not rely on color, symbols, or emoji alone for status meaning.

### Source Lookup

Source lookup is the evidence and governance surface. It is not the primary catalog browse surface.

Required behavior:

- List sources by title, source class, ownership mode, steward, authority level, authority scope, visibility, review freshness, and warning count.
- Let users filter by source class, ownership mode, authority level, visibility, steward, and warning state.
- Show anchors and expansion paths without making the Portal a source content mirror.
- Support internal Atlas-managed sources, external source-system sources, and hybrid sources in the same table.
- Restricted sources remain visible as restricted metadata. The Portal must not fetch around the Context API or hide the warning to make the page look clean.

Recommended layout:

- Use a table for source discovery.
- Use an evidence detail pane for selected source metadata, anchors, excerpts, and warnings.
- Tie each warning to source or anchor identity.

### Health and Scorecards

Health in V1 means guidance health and evidence readiness, not full service reliability.

Required behavior:

- Show authority coverage by catalog object type.
- Show stale sources, broken anchors, missing owner/support, restricted evidence, unavailable evidence, and authority conflicts.
- Show affected catalog objects for each health issue.
- Let users navigate from a health row to the affected catalog object or source.
- Provide inline feedback or report issue entry points for missing, stale, broken, and unclear guidance.

Recommended layout:

- Use compact summary bands plus dense issue tables.
- Avoid hero metrics. Health metrics are operational signals, not marketing proof.
- Use scorecard language carefully: `Guidance readiness` or `Evidence health` is safer than generic `Service health`.
- Do not introduce weighting, criteria builders, or scorecard configuration in V1.

### Ask Atlas

Ask Atlas is a catalog-aware, citation-bound AI consumer example, not the architecture.

V1 behavior:

- Keep Ask Atlas in the sidebar or secondary home links so the product narrative remains visible.
- Show a clear deferred state if the full cited-answer workflow is not implemented yet.
- Preserve the future boundary: Ask Atlas will resolve catalog objects, use context bundles, citations, warnings, and server-side LLM adapter logic.
- Do not make Ask Atlas the default home search behavior.

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
- Evidence rail with source cards, authority badges, excerpts, and expansion paths.
- Warning stack above the answer when the bundle includes stale, broken, conflict, restricted, unavailable, or missing-source signals.

## Component System

Use a small component vocabulary. Add components only when at least two screens need the pattern.

| Component | Purpose |
|---|---|
| `PortalShell` | Stable navigation, top query, and route content region |
| `CatalogSearch` | Shared query entry for catalog objects, owners, sources, and Ask intent |
| `CatalogObjectList` | Cross-type catalog rows with type, owner, lifecycle, tools, evidence coverage, and warning state |
| `CatalogObjectPreview` | Compact preview for home and journey entry points |
| `CatalogObjectDetailHeader` | Name, type, status, owner, support, lifecycle, and primary tool actions |
| `RelationshipPanel` | Related capabilities, landing zones, guardrails, sources, owners, and tool entries |
| `GuidanceHealthSummary` | Authority coverage, stale sources, broken anchors, missing owner/support, conflicts |
| `HealthIssueList` | Actionable health and evidence readiness rows |
| `AvailabilityExplorer` | Availability search, filters, service or capability cards, and selected detail panel |
| `AvailabilityStatusStrip` | Compact status labels for regions, outposts, and landing zone levels |
| `TopicList` | Type-specific capability, landing zone, and guardrail discovery rows |
| `TopicDetailHeader` | Implementation-facing detail header for API-backed topic routes |
| `AuthorityBadge` | `authoritative`, `reference`, `example`, `draft`, `deprecated` |
| `VisibilityBadge` | `internal` or `restricted` source visibility |
| `SourceOwnershipBadge` | Atlas-managed, external-owned, or hybrid source ownership mode |
| `FreshnessIndicator` | Review freshness, needs-review, stale |
| `WarningStack` | Stale, broken, conflict, restricted, unavailable, missing-source warnings |
| `EvidencePanel` | Sources, anchors, excerpts, citations, expansion paths |
| `ExpansionPathList` | Progressive disclosure actions |
| `FeedbackInlineForm` | Missing, stale, broken, unclear feedback |
| `ResolvedObjectStrip` | Ask Atlas related catalog objects before answer generation |
| `AskComposer` | Future Ask Atlas question input and submit state |
| `CitedAnswer` | Future claim list with citation mapping |
| `EmptyEvidenceState` | No registered source or no authoritative source |
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
| `PortalShell` | `sidebar`, `breadcrumb`, `separator` | Use the sidebar pattern as a starting point, but own logo slot, nav density, active state, and responsive behavior locally. |
| `GlobalSearch` | `input`, `button`, `popover` | Search registered catalog objects, owners, and sources only. Do not route general full-text search or Ask Atlas through this by default. |
| `CommandPalette` | `command` | Later enhancement for `Cmd+K` navigation, lookup, and evidence reveal. No workflow execution in V1. |
| `CatalogObjectList` | `table`, `badge`, `tabs`, `select`, `popover` | Use dense rows for cross-type catalog comparison. Cards are only for entry previews. |
| `RelationshipPanel` | `tabs`, `table`, `badge`, `collapsible` | Show connected capabilities, landing zones, guardrails, tools, owners, and sources without building a graph visualization in V1. |
| `GuidanceHealthSummary` | `table`, `badge`, `progress`, `tooltip` | Show evidence readiness and coverage. Do not implement configurable scorecard builders in V1. |
| `AvailabilityExplorer` | `input`, `select`, `table`, `badge`, `popover`, `collapsible` | Use a map-grid hybrid for availability discovery. Keep matrix comparison bounded and secondary. |
| `TopicList` | `table`, `badge`, `tabs`, `select` | Use dense rows for type-specific comparison. Cards are only for entry previews. |
| `CapabilityEntryPreview` | `card`, `badge`, `button` | Use compact cards sparingly on Home or section overview. Do not repeat identical icon cards across the app. |
| `LandingZoneMatrix` | `table`, `badge`, `tooltip` | Prefer matrix or dense comparison rows for environment and guardrail coverage. |
| `EvidenceRail` | `collapsible`, `scroll-area`, `separator`, `tooltip` | Expandable rail or panel with sources, anchors, citations, and expansion paths. |
| `WarningStack` | `alert`, `badge`, `collapsible` | Warnings must be inline and tied to source or anchor identity. No side-stripe alert styling. |
| `FeedbackInlineForm` | `field`, `textarea`, `button`, `select` | Inline form first. Do not default to a modal. |
| `AskDeferredEntry` | `empty`, `button`, `badge` | Visible deferred state with boundary copy. Do not imply a working AI answer flow before implementation exists. |
| `ResolvedObjectStrip` | `badge`, `button`, `separator` | Show the objects Ask Atlas resolved before answer generation or no-source handling. |

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
- Approximate OKLCH: `oklch(46.28% 0.3059 264.18)`.
- Treat this as the brand accent source, not a general background color.

Recommended roles:

| Role | Usage |
|---|---|
| Surface | App background and content surface, tinted neutral |
| Surface muted | Sidebar, toolbar, filter rows |
| Border | Section separation and table row boundaries |
| Text primary | Main labels and body text |
| Text secondary | Metadata, helper text, timestamps |
| Accent | Primary action, current nav item, selected filter |
| Success | Valid anchors and current sources |
| Warning | Stale, weak, restricted, or needs-review signals |
| Critical | Broken anchor, unavailable source, access-denied style states |
| Info | Reference or example evidence |

Rules:

- Do not use pure black or pure white.
- Keep accent usage under control. `#001aff` marks action and selection, not decoration.
- Use full-strength `#001aff` only for primary actions, active navigation, selected filters, focused controls, important links, and small selection indicators.
- Keep brand accent coverage below 10% of any normal viewport.
- For large fills, hover backgrounds, selected-row tints, and focus halos, use reduced-chroma brand tints derived from the same hue instead of full `#001aff`.
- Do not use `#001aff` for warning, success, critical, or restricted-source semantics. Those states need separate semantic tokens.
- Do not use `#001aff` as the sidebar background, page background, large panel fill, table header fill, or Ask Atlas answer background.
- Warnings should be legible and tied to evidence identity.
- Authority badges should be color plus label, never color alone.

### Typography

- Use a system UI or Inter-like sans font stack.
- Keep a tight product scale, with clear contrast between page title, section title, row title, metadata, and labels.
- Do not use display fonts for labels, buttons, tables, or badges.
- Keep prose blocks under 75ch.

### Layout

- Desktop: left nav plus main content, optional right evidence rail.
- Tablet: collapsible nav, evidence rail moves below primary content.
- Mobile: top nav drawer, stacked content, source tables become grouped rows.
- Use stable dimensions for badges, icon buttons, filters, and warning chips to prevent layout shift.

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
- Logo slot contract for desktop, tablet, and mobile shell states.
- Base UI plus shadcn local component strategy confirmed.
- Initial `components.json` plan for the `portal` package, with `base` selected as the base library.
- Tailwind CSS setup scoped to the `portal` package and wired to Atlas token variables.
- Tabler Icons configured as the Portal icon library.
- Design tokens for color, spacing, typography, radius, focus, and state.
- Brand token mapping for `#001aff`, including restrained accent usage and reduced-chroma tints.
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

### Phase P1: TanStack Start App Shell

Deliver:

- TanStack Start root route and document shell.
- Route tree for home, catalog, capabilities, landing zones, guardrails, availability, sources, health, and Ask.
- Portal shell with fixed left sidebar, logo slot, navigation, top query, content region, and optional evidence rail.
- shadcn/Base UI sidebar wrapper owned by Atlas, not a copied block left unmodified.

Verify:

- Typecheck passes.
- Root route includes required script hydration.
- Navigation routes render without hardcoded Context Layer internals.
- Sidebar works with full wordmark, icon-only, and missing-logo placeholder states.

### Phase P2: Context API Loader Boundary

Deliver:

- Schema-backed API client.
- Server-side data access boundary for Context API calls.
- Loader data shapes for catalog list, catalog detail, topic list, topic detail, availability, source list, source detail, health summary, and Ask context retrieval.

Verify:

- Tests prove Portal parses shared schema responses.
- Tests prove API error codes map to UI states.
- Browser bundle does not contain source-system or LLM credentials.

### Phase P3: Discovery Surfaces

Deliver:

- Home with primary entries for Catalog, Capabilities, Landing Zones, Guardrails, and Sources.
- Secondary home entries for Ask Atlas, feedback, health gaps, and common tool links.
- Catalog Explorer with cross-type filtering and dense rows.
- Capability discovery as a type-filtered catalog view.
- Landing zone navigator with comparison matrix or dense comparison rows.
- Guardrail area discovery with policy/evidence coverage.
- Availability map as a secondary discovery surface when pilot data includes regional or outpost availability.
- Source lookup table.

Verify:

- Pilot catalog, capability, landing zone, guardrail, availability, and source data render from API responses.
- Filter and empty states are covered by tests.
- Warning counts remain visible on list rows.
- Home does not become a static directory, docs hero, or Ask-first experience.

### Phase P4: Detail, Relationships, and Evidence Surfaces

Deliver:

- Catalog object detail pattern.
- Capability detail page.
- Landing zone detail page.
- Guardrail detail page.
- Source detail page.
- Relationship panels for related capabilities, landing zones, guardrails, sources, owners, and tool entries.
- Evidence panel, authority badges, warning stack, expansion paths, and inline feedback.

Verify:

- Tests cover authoritative, reference, draft, deprecated, stale, broken, restricted, unavailable, conflict, and no-registered-source states.
- Restricted and broken states are visible and tied to source or anchor identity.
- Detail pages do not duplicate long-form source content.
- Relationship panels do not imply recommendation logic or provisioning authority.

### Phase P5: Health and Scorecard Surfaces

Deliver:

- Guidance health dashboard.
- Authority coverage summary by catalog object type.
- Issue lists for stale sources, broken anchors, missing owner/support, restricted evidence, unavailable evidence, and authority conflicts.
- Navigation from health issue to affected catalog object or source.

Verify:

- Health does not present generic service reliability scores.
- Health issues remain tied to concrete catalog objects, sources, or anchors.
- No configurable scorecard builder is introduced in V1.

### Phase P6: Ask Atlas UI

Deliver:

- Deferred Ask Atlas entry surface.
- Boundary copy that explains Ask Atlas will answer from governed context when enabled.
- Disabled or unavailable state that does not imply a working AI answer flow.
- Future integration point for catalog-object resolution, context bundle retrieval, server-side LLM adapter, prompt construction, citation validation, and rate limits.

Verify:

- Ask Atlas appears as visible but deferred.
- UI does not route normal global search into Ask Atlas.
- Future Ask tests remain listed as post-core work: prompt content, citation validation, uncited claim handling, and rate limits.

### Phase P7: Browser Interaction and Accessibility Hardening

Deliver:

- Keyboard navigation for global search, filters, nav, and feedback.
- Focus-visible states for every interactive control.
- Responsive behavior for desktop, tablet, and mobile.
- Playwright coverage for critical user paths once routes are wired.

Verify:

- Playwright covers catalog exploration, capability discovery, landing zone navigation, guardrail discovery, availability filtering, source warning visibility, health issue navigation, feedback submission, and deferred Ask entry visibility.
- No text overlaps at mobile and desktop widths.
- Skeletons do not shift layout when data resolves.
- Logo slot and brand accent usage remain stable across desktop, tablet, and mobile screenshots.

## Testing Strategy

| Layer | Coverage |
|---|---|
| Unit | Data mappers, catalog object projections, warning classification, badge labels, feedback payloads |
| Component | Catalog rows, relationship panels, health summaries, evidence panels, warning stack, cited answer, empty states |
| Route | Loader success, structured error mapping, no-source states, health issue states |
| Interaction | Filters, keyboard focus, relationship expansion, expansion paths, feedback submission |
| End-to-end | Catalog exploration, capability discovery, landing zone navigation, guardrail discovery, availability filtering, source lookup, health navigation, deferred Ask entry |

Do not rely on snapshots alone. Assertions must check visible authority, warning, citation, and expansion behavior.

## Impeccable Anti-Pattern Checks

Every frontend implementation batch must explicitly check for these patterns before review:

| Anti-pattern | Atlas Portal rule |
|---|---|
| Side-stripe borders | Do not use thick `border-left` or `border-right` accents on cards, alerts, rows, or callouts. Use full borders, icons, background tints, or inline warning labels. |
| Gradient text | Do not use gradient text for Atlas, Ask Atlas, metrics, page titles, or source labels. Use solid text color and hierarchy. |
| Glassmorphism as default | Do not use blurred glass panels for the shell, evidence rail, Ask answers, or source cards. Portal is an evidence tool, not a decorative surface. |
| Hero-metric template | Do not build the home page around oversized metrics, supporting stat cards, or a brand-colored hero band. Home starts with user tasks and evidence signals. |
| Identical card grids | Do not make every capability, landing zone, guardrail, source, and tool an identical icon card. Use dense lists, tables, matrices, relationship panels, and detail panes when comparison matters. |
| Modal as first thought | Do not default to modals for feedback, citations, expansion paths, or warnings. Prefer inline forms, popovers tied to controls, or progressive disclosure panels. |
| Decorative motion | Do not add motion unless it communicates state, loading, reveal, or feedback. Keep transitions between 150ms and 250ms. |
| Heavy inactive brand color | Do not use full-strength `#001aff` on inactive nav items, empty states, large backgrounds, or disabled controls. |
| Inconsistent controls | Buttons, filters, tabs, tables, and forms must share the same shape, focus, hover, disabled, and loading vocabulary across routes. |
| Reinvented standard affordances | Do not invent custom scrollbars, unusual form controls, or non-standard navigation just for flavor. |

## Do and Don't

### Do

- Keep Portal information-centric.
- Make the scoped cloud platform catalog the main work surface.
- Distinguish catalog objects from source evidence.
- Show source authority, freshness, visibility, and warning state everywhere evidence is used.
- Show relationships among capabilities, landing zones, guardrails, tools, sources, and owners.
- Treat availability as a decision surface with next-step routing, not as a copied source table.
- Treat health as guidance readiness and evidence quality in V1.
- Treat Ask Atlas as one consumer surface.
- Keep UI labels direct and task-oriented.
- Reuse shared schema contracts.
- Keep components small and state-complete.
- Use Base UI primitives for accessible behavior and local Atlas wrappers for product styling.
- Use shadcn search, docs, and dry-run flows before adding components.
- Use Tabler Icons for navigation, status, feedback, and action icons.
- Use familiar controls for filters, tabs, tables, buttons, and forms.
- Leave stable space for the company logo.
- Use `#001aff` with restraint through approved brand tokens.
- Run the impeccable anti-pattern checks before requesting review.

### Don't

- Do not build a marketing landing page.
- Do not build provisioning workflows.
- Do not build a full company service catalog or CMDB.
- Do not turn availability into a spreadsheet-first matrix unless the user explicitly enters a bounded comparison flow.
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

## Definition of Done

Portal frontend work is ready for V1 pilot review when:

- Users can start from Home and reach catalog, capability, landing zone, guardrail, availability, source, health, and Ask surfaces.
- All primary pages consume schema-backed API data.
- Catalog objects show type, owner, lifecycle/status, support path, relationship signals, evidence coverage, and warning state.
- Availability surfaces show clear status labels, source evidence, and next-step paths for available, interim, planned, and not-planned states.
- Source authority, freshness, visibility, citations, warnings, and expansion paths are visible.
- Health surfaces show guidance readiness and evidence quality without becoming a generic service reliability scorecard.
- The company logo has a stable reserved shell slot across desktop and mobile.
- `#001aff` is used only as restrained brand accent or reduced-chroma tint.
- Base UI is the selected primitive layer, and shadcn-generated local wrappers follow Atlas tokens and component ownership rules.
- Feedback can be submitted from the surfaces where users discover gaps.
- Ask Atlas is visible as a deferred capability and does not misrepresent unimplemented AI behavior as live.
- Browser code contains no source-system credentials, LLM credentials, DynamoDB access, or Context Layer internals.
- Tests cover happy paths and degraded evidence states.
- Impeccable anti-pattern checks are part of the frontend review checklist.

## Commit Strategy

Keep frontend work in small Conventional Commit batches:

1. `docs:` Portal frontend design plan.
2. `feat:` TanStack Start shell and route tree.
3. `feat:` Base UI and shadcn local component foundation.
4. `feat:` schema-backed Portal API loaders.
5. `feat:` catalog and discovery surfaces.
6. `feat:` detail, relationship, and evidence surfaces.
7. `feat:` guidance health surfaces.
8. `feat:` deferred Ask Atlas entry.
9. `test:` browser interaction and accessibility coverage.

Do not combine visual system setup with Context Layer data-model changes unless the change is strictly contract integration.
