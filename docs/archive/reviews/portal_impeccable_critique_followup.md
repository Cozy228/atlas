# Portal UI: Critique Follow-Up (Round 2)

**Source:** `/impeccable critique` + extended manual review, `portal/src`.  
**Baseline viewport:** Full HD 1920×1080 logical px, pointer + keyboard.  
**Narrow-desktop:** Tiling WM, IDE side-by-side — secondary stress target (not handset-first).  
**Audience lock-in:** Internal developers. Dense platform wording is intentional; do not soften.

---

## What closed in Round 1

| Item | File(s) | Status |
|------|---------|--------|
| Scrim tokens: `bg-black` → `bg-overlay/10` | `dialog.tsx`, `sheet.tsx` | ✅ Done |
| NavMenu: mobile Sheet drawer, keyboard-safe | `portal-shell.tsx` | ✅ Done |
| `--overlay` OKLCH token in design system | `globals.css` | ✅ Done |

One false-positive remains in `globals.css` line 86 — the comment text `"rather than raw bg-black"` triggers the impeccable detector. It is **not** a bug; the comment explicitly documents the do-not pattern. No action needed.

---

## Round 2 open issues

### P1 — Bugs. Ship-blocking.

#### P1-A: Nested `<a>` inside outer `Link` → hydration mismatch

**File:** `portal/src/routes/landing-zones.index.tsx`, `ZoneCard` function.

The entire card is wrapped in a TanStack `<Link>` (renders `<a>`). Inside it, each entry tool renders its own `<a href target="_blank">`. This is invalid HTML (`<a>` inside `<a>`), produces a React hydration error in dev, and breaks accessibility — screen readers get confused, click events fire on both ancestors.

Current workaround (`event.stopPropagation()`) does not fix the HTML structure.

**Fix direction:**
- Remove the outer `Link` wrapping the full card.
- Make the zone name a standalone `<Link>` (or add an explicit "View details" CTA).
- Keep entry tool `<a>` links as-is — they are already independent inline links.
- The card container becomes a `<div>` or `<article>` with hover styles only; no interactive ancestor.

---

#### P1-B: Ask Atlas mutation failure has no in-conversation recovery

**File:** `portal/src/components/ask/ask-atlas-chat.tsx`, `send()` function.

When `mutateAsync` rejects, `onError` shows a sonner toast. The `.catch(() => {})` in `send()` suppresses the unhandled rejection — but the conversation shows only the user bubble with no response and no indication of failure. The shimmer disappears and the chat appears to have "swallowed" the request.

Additionally: when the context bundle has no authoritative sources (`authoritativeSources.length === 0`), the server returns `answer: ""` with a warning. The `NoAnswerNotice` component correctly handles this — but if `topicId` is wrong or missing, the same early-return fires silently from a user perspective.

**Fix direction:**
- In the `.catch()` block in `send()`, push an assistant error message into `messages` with `warnings: ["request-failed"]` so `NoAnswerNotice` renders in the conversation thread instead of only a toast.
- Toast can remain as a secondary signal, but the chat thread must never leave a user message unanswered with no visible state.

---

### P2 — UX debt. Fix before broader rollout.

#### P2-A: Live + Synced status signals are hardcoded

**File:** `portal/src/components/portal-shell.tsx`, `HealthIndicator` and `SyncPill`.

`HealthIndicator` shows an animated `animate-ping` dot with "Live" copy. `SyncPill` shows "Synced just now". Both are static strings — no data binding, no API health check, no timestamp.

Atlas's core value proposition is **authority-aware, freshness-visible** platform context. The `HealthBand` on the home page does this correctly (real counts from the loader). The TopBar chips contradict it.

**Fix direction:**
- Wire `HealthIndicator` to an actual context API `/health` endpoint. While loading: neutral dot, no animation, no text. On `ok`: "Live" with pulse. On `degraded`/`error`: solid amber/red dot, static label, no animation.
- Replace `SyncPill` with a real last-synced timestamp from the loader, or remove it entirely until the data is available. Do not show "Synced just now" as decorative copy.
- Remove `animate-ping` unconditionally until the signal is real. A false confidence indicator is worse than no indicator.

---

#### P2-B: EntryCards default-open breaks progressive disclosure

**File:** `portal/src/components/home/entry-cards.tsx`, line 23.

`useState<Phase | null>("evaluate")` defaults the Evaluate panel open on first render. The home page hero area already has a search bar, description, and three phase cards. With Evaluate open by default, the first viewport also shows a full searchable capability list — before the user has expressed any intent.

The interface is making a choice the user hasn't made.

**Fix direction:**
- Default to `null` (all panels closed).
- If a recommended starting point is desired, show it as a lightweight inline hint ("Not sure where to start? Try Evaluate →") rather than auto-opening the panel.

---

#### P2-C: FAB overlaps content on narrow widths

**File:** `portal/src/components/ask-atlas-fab.tsx`, line 53.

`fixed bottom-6 right-6` positions the FAB over interactive content on narrow viewports (390 px handsets, 768–900 px tiled desktop). It lands directly over the close button of the EntryCard panel and the bottom edge of the Onboard tool grid.

Internal tooling is not handset-first, but narrow-desktop tiling is common for developers.

**Fix direction:**
- On `md:` and below, hide the fixed FAB; instead, expose an inline "Ask Atlas" button in the TopBar right slot (next to ThemeToggle) or as a persistent row at the bottom of the page body.
- On `lg:` and above, keep the FAB but push it to `bottom-8 right-8` so it does not overlap the EntryCard panel close button.
- Alternatively: use `pointer-events-none` on the FAB when the EntryCard panel is open, and shift it up (`bottom-[calc(panel-height+1.5rem)]`) — but this requires measuring panel height, which is fragile.

---

#### P2-D: "AI tool shell" aesthetic tells on the portal

Three specific patterns read as generic AI tooling:

1. **`IconSparkles` FAB** (`ask-atlas-fab.tsx` line 59): The sparkles icon is the universal signal for "AI feature," shared by Notion, GitHub Copilot, Vercel, Linear, and every SaaS product from 2023–2025. It carries no Atlas-specific meaning.

2. **Centered Ask hero** (`ask.tsx` line 28–39): `items-center text-center` full-page centering with a large "What can Atlas help you find?" headline is the Perplexity / ChatGPT / Gemini template. An internal platform portal should look like a tool, not a consumer AI product.

3. **Homogeneous suggestion buttons** (`ask-atlas-chat.tsx` lines 231–241): The four `EmptyGreeting` suggestion cards are identical `rounded-lg border` rectangles with no visual differentiation. They scan as a repeated pattern, not a curated starting point.

**Fix direction:**
1. Replace `IconSparkles` with a tool-neutral icon (e.g., `IconMessageCircle`, `IconSearch`, or the Atlas "A" monogram). The FAB should signal "ask a question," not "magic AI."
2. Rewrite the `/ask` hero to left-aligned, consistent with the rest of the portal. Use the same `PageBody` + `SectionEyebrow` pattern. Remove `text-center` and `items-center`.
3. Differentiate suggestion buttons by phase/category. Show the `category` label as a `font-mono text-[10px]` eyebrow above each prompt, or group them under a single row with inline category chips. Break the identical-rectangle pattern.

---

#### P2-E: Eyebrow typography has two incompatible standards

**File:** `portal/src/components/page-section.tsx` (PageHeader) vs. `section-eyebrow.tsx`, `detail-shell.tsx`.

`PageHeader` eyebrow: `text-xs font-medium uppercase tracking-[0.14em]` — sans-serif, wider tracking, lighter weight.

All other eyebrows (SectionEyebrow, DetailHeader, DetailSection): `font-mono text-[11px] font-semibold uppercase tracking-[0.05em]` — monospace, tighter tracking, heavier weight.

These appear together on list pages (e.g., `capabilities.tsx`) and the contrast is visible.

**Fix direction:** Align `PageHeader` to the mono variant. Replace the eyebrow span in `PageHeader` with `font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground`. Consider extracting a shared `EyebrowLabel` component to prevent drift.

---

#### P2-F: ResourceLinkGrid titles and descriptions repeat primary navigation

**File:** `portal/src/components/home/resource-link-grid.tsx`, `RESOURCES` array.

Keep the section — a "Keep exploring" grid at page bottom is legitimate wayfinding. The problem is content: every entry duplicates a top-nav label with a generic single-line description. "All capabilities / Full service catalog by domain" adds nothing the nav item "Capabilities" doesn't already say.

**Fix direction:** Rewrite each entry to surface a specific, actionable next step that earns the scroll:

| Slot | New title | New description | Link |
|------|-----------|-----------------|------|
| 1 | "Browse by domain" | "Filter capabilities by compute, storage, database, AI, or integration." | `/capabilities` |
| 2 | "Compare environments" | "Match your workload's requirements to the right landing zone." | `/landing-zones` |
| 3 | "Check regional coverage" | "See which services are available in US-East-1, GDC, DC16, and more." | `/explore` |
| 4 | "Review authoritative sources" | "Inspect authority level, review freshness, and broken-anchor status." | `/sources` |

The distinction is specificity: each description answers "what will I find when I click" rather than restating the section label.

---

#### P2-G: Remove CatalogHighlights from the home page

**File:** `portal/src/routes/index.tsx`, `CatalogHighlights` section; `portal/src/components/home/catalog-highlights.tsx`.

Two stat blocks: "X services in the catalog" and "Y regions and outposts." The numbers are real, but they are informational dead ends — clicking does nothing, and the hover affordance (`hover:border-border-strong hover:shadow-sm`) falsely implies interactivity. More importantly, these metrics answer a question no one on the home page is actually asking. A developer looking for the right capability does not need to know "there are 14 services" before deciding to look at them.

**Fix direction:** Remove the entire `CatalogHighlights` section from `index.tsx`. The underlying data (service count, region list) is more useful inline on the Capabilities list page header or as contextual signals on the Evaluate panel.

---

#### P2-H: Remove HealthBand from the home page

**File:** `portal/src/routes/index.tsx`, `HealthBand` section; `portal/src/components/home/health-band.tsx`.

The HealthBand shows counts for stale sources, restricted sources, and broken anchors. These are operational signals — valuable for someone actively managing the platform registry, but invisible to the majority of home page visitors who are trying to find a capability or landing zone.

Worse, the band is passive: it surfaces a problem ("3 stale sources") with no link to act on it. A developer who is not a platform owner cannot do anything with this information from the home page.

**Fix direction:** Remove the `HealthBand` section from the home page. Surface the same signals on the Sources list page and individual source detail pages, where a viewer can take action. If a health summary is needed for platform operators, it belongs in a dedicated health or admin surface, not inline between "Recently viewed" and "Keep exploring."

---

#### P2-I: EntryCards jargon cluster

**File:** `portal/src/components/home/entry-cards.tsx`.

Three specific copy and readability problems in the phase cards and panels:

**1. "Workload" in the Decide card description** (line 46): "Which landing zone fits my workload?" uses "workload" as if it is universally understood. It is platform jargon — many developers refer to their thing as an "application", "service", or "project." A new joiner will not know whether their API service counts as a "workload" without looking it up.

**Fix:** "Which landing zone fits my application?" or "Which environment should my service run in?" are equivalent and jargon-free.

**2. "entry tools" label in DecidePanel** (line 329): `zone.entry_tools.length` renders as "3 entry tools" with no tooltip, no inline gloss, and no visible example. "Entry tool" is defined nowhere in the visible UI. A developer seeing this for the first time has no idea whether an entry tool is a CLI, a web console, a ticket form, or something else.

**Fix:** Replace the bare count with a short descriptor: "3 provisioning tools" or "3 links" if the meaning cannot be made precise in this context. Alternatively, list tool labels inline (which is already done in ZoneCard on the index page) rather than showing only the count.

**3. 10px mono disclaimer in OnboardPanel** (line ~419): The note "Tools are registered per landing zone. Owners shown reflect the first registered zone." renders in `font-mono text-[10px] text-muted-foreground`. This is the smallest text in the entire portal. The disclaimer is genuinely useful context — it explains why the owner shown may not be the canonical owner for all zones — but at 10px in a muted mono style it is invisible in practice.

**Fix:** Raise to `text-[11px]` or `text-[12px]` and use a non-mono weight. If the content is truly secondary, render it as a standard prose note (`text-[12px] text-muted-foreground leading-5`), not a monospace fine-print line.

---

#### P2-J: Replace text monograms with real AWS service icons

**Files affected:**
- `portal/src/components/home/entry-cards.tsx` — EvaluatePanel (`topic.name.slice(0, 3)`)
- `portal/src/components/explore/service-card.tsx` — ServiceCard (`service.iconKey` renders as text)
- `portal/src/api/server/availability.ts` — `iconKey` field currently holds abbreviation strings

##### Library recommendation: `aws-react-icons@3.3.0`

**Why this library:**
- Built from official AWS Architecture Icons (updated 01/30/2026); platform engineers recognize them instantly
- React 19 compatible (devDeps confirm `@types/react 19.2.14`, `react 19.2.4`)
- Zero runtime dependencies; individual imports are tree-shaken to only bundled icons
- MIT license; 2.0 MB unpacked but ~1–2 KB per icon after tree-shaking
- Naming convention: `ArchitectureService` + PascalCase SVG filename (e.g. `ArchitectureServiceAmazonEC2`)
- Only `size` prop (number or string, default 24)

**Color behavior:** These SVGs use hardcoded AWS brand colors (orange for compute, blue for storage, etc.) — not OKLCH tokens. They do not respond to dark mode. **Accept this as a feature**: AWS color coding is domain knowledge that platform engineers carry; the icons read as category signals, not just labels. Render at a consistent size (20–24 px) inside the existing `bg-background border border-border` container to keep visual containment.

##### Install

```bash
pnpm add aws-react-icons --filter portal
```

##### Complete service → icon mapping for `availability.ts`

Create `portal/src/lib/aws-icon-map.tsx`. All 27 services in the current data have a confirmed icon except two edge cases noted below.

| Service ID | React component name | Coverage |
|------------|----------------------|----------|
| `s3` | `ArchitectureServiceAmazonSimpleStorageService` | ✅ |
| `efs` | `ArchitectureServiceAmazonEFS` | ✅ |
| `ebs` | `ArchitectureServiceAmazonElasticBlockStore` | ✅ |
| `backup` | `ArchitectureServiceAWSBackup` | ✅ |
| `ec2` | `ArchitectureServiceAmazonEC2` | ✅ |
| `lambda` | `ArchitectureServiceAWSLambda` | ✅ |
| `ecs-fargate` | `ArchitectureServiceAmazonECSAnywhere` | ⚠️ closest match; no bare `AmazonECS` in this set |
| `ecr` | `ArchitectureServiceAmazonElasticContainerRegistry` | ✅ |
| `eks` | `ArchitectureServiceAmazonEKSAnywhere` | ⚠️ closest match; no bare `AmazonEKS` in this set |
| `ecs-ec2` | `ArchitectureServiceAmazonEC2` | ⚠️ reuses EC2 icon; differentiate via label |
| `aurora` | `ArchitectureServiceAmazonAurora` | ✅ |
| `elasticache` | `ArchitectureServiceAmazonElastiCache` | ✅ |
| `kinesis` | `ArchitectureServiceAmazonKinesis` | ✅ |
| `glue` | `ArchitectureServiceAWSGlue` | ✅ |
| `athena` | `ArchitectureServiceAmazonAthena` | ✅ |
| `sqs` | `ArchitectureServiceAmazonSimpleQueueService` | ✅ |
| `sns` | `ArchitectureServiceAmazonSimpleNotificationService` | ✅ |
| `eventbridge` | `ArchitectureServiceAmazonEventBridge` | ✅ |
| `airflow` | `ArchitectureServiceAmazonManagedWorkflowsforApacheAirflow` | ✅ |
| `step-functions` | `ArchitectureServiceAWSStepFunctions` | ✅ |
| `transfer` | `ArchitectureServiceAWSTransferFamily` | ✅ |
| `dms` | `ArchitectureServiceAWSDatabaseMigrationService` | ✅ |
| `bedrock` | `ArchitectureServiceAmazonBedrock` | ✅ |
| `agentcore` | `ArchitectureServiceAmazonBedrockAgentCore` | ✅ |
| `textract` | `ArchitectureServiceAmazonTextract` | ✅ |
| `elb` | `ArchitectureServiceElasticLoadBalancing` | ✅ |
| `landing-zones` | — | ❌ No AWS icon; use single initial "L" fallback |

##### EvaluatePanel (Topic-based, Context API data)

The `Topic` type from the Context API has no icon field. Two options:

- **Option A (preferred):** Add an optional `aws_icon_slug` string field to the `Topic` schema. Populate it for capabilities that map to known AWS services (e.g. `"AmazonEC2"` for the EC2 capability). The icon map in `aws-icon-map.tsx` resolves it to a component.
- **Option B (acceptable for this sprint):** Replace `topic.name.slice(0, 3)` with `topic.name.charAt(0).toUpperCase()` rendered at `text-[14px] font-bold`. One character is legible and consistent; three-character truncation with variable word breaks is not.

Do not leave the current `slice(0, 3)` behavior in production regardless of which option is chosen.

---

### P3 — Polish. Fix in the final pass.

#### P3-A: No `prefers-reduced-motion` guards

Three animations lack motion-reduction handling:

- `animate-ping` on `HealthIndicator` (`portal-shell.tsx`)
- `[animation:slideIn_220ms]` on `EntryCard` panel (`entry-cards.tsx` line 157)
- `circle-reveal` view-transition in `theme.tsx`

**Fix:** Add `motion-reduce:animate-none` or `motion-reduce:transition-none` to animated elements. Check the view-transition wrapper in `theme.tsx` for a `matchMedia('(prefers-reduced-motion: reduce)')` guard.

---

#### P3-B: HealthBand uses color as the only differentiator

**File:** `portal/src/components/home/health-band.tsx`.

OK / warn / critical state is conveyed only through text color (`text-success`, `text-warning-foreground`, `text-critical`). Users with red-green or blue-yellow color deficiency cannot distinguish states.

**Fix:** Add a small icon per state (e.g., `IconCheck size-3` for ok, `IconAlertTriangle size-3` for warn, `IconX size-3` for critical) alongside the count, so state is communicated by shape and position as well as color.

---

#### P3-C: RecentlyViewed empty state uses 11px mono text

**File:** `portal/src/components/home/recently-viewed.tsx`, line 97.

"Open a capability or landing zone to populate this list." renders in `font-mono text-[11px]`. This is below minimum comfortable reading size, especially on high-DPI displays. Instructional copy should be at least `text-[13px]`.

---

## Master command sequence

Suggested execution order. Phase 1 is bug-only and blocking; phases 2–5 can overlap once P1 is clear.

| Phase | Command | Focus |
|-------|---------|-------|
| 1 | `impeccable audit` | P1-A nested `<a>` hydration bug; P1-B Ask silent-failure bug |
| 2 | `impeccable distill` | Remove `CatalogHighlights` and `HealthBand` sections from home; default `EntryCards` to closed; de-center `/ask` hero |
| 3 | `impeccable clarify` | P2-A Live / Sync demotion or wiring; P2-I jargon ("workload", "entry tools", 10px disclaimer); P2-E eyebrow standard |
| 4 | `impeccable harden` | P2-J monogram fallback; P2-J EvaluatePanel empty state copy |
| 5 | `impeccable adapt` | P2-C FAB narrow-width strategy |
| 6 | `impeccable bolder` | P2-D AI shell: FAB icon replacement, suggestion card differentiation; P2-F ResourceLinkGrid copy rewrite |
| 7 | `impeccable polish` | P3 pass: reduced-motion guards, HealthBand state icons, RecentlyViewed copy size |
| 8 | `impeccable critique` | Re-score; verify detector exits 0 |

---

## Verification checklist

- [ ] `landing-zones.index.tsx`: No `<a>` inside `<a>`. React hydration error gone in dev console.
- [ ] Ask Atlas: Every submitted question produces a visible in-conversation response — answer, `NoAnswerNotice`, or error bubble. No silent hangs.
- [ ] TopBar: `animate-ping` removed or gated on real health data. "Synced just now" replaced with real timestamp or removed.
- [ ] Home page sections removed: `CatalogHighlights` and `HealthBand` are no longer rendered in `index.tsx`.
- [ ] Home page `EntryCards`: Default state is `null` (all panels collapsed on first render).
- [ ] Home page `ResourceLinkGrid`: Each card has a specific, non-nav-duplicate description (see P2-F table).
- [ ] `/ask` hero: Left-aligned layout. `items-center` and `text-center` removed from `Hero()`.
- [ ] EntryCards copy: "workload" → "application/service". "entry tools" count → labeled descriptor. OnboardPanel disclaimer ≥ `text-[12px]`.
- [ ] EvaluatePanel monogram: No `slice(0, 3)` with trailing spaces. Single char, icon slug, or no avatar.
- [ ] FAB: Does not overlap `EntryCard` panel close button at 768–900 px widths.
- [ ] Eyebrow labels: Consistent `font-mono text-[11px] font-semibold` in `PageHeader`, `SectionEyebrow`, `DetailHeader`, `DetailSection`.
- [ ] All animated elements respect `prefers-reduced-motion: reduce`.
- [ ] `npx impeccable --json portal/src` exits **0**.
- [ ] Smoke at 1920×1080 and one narrow-desktop width: keyboard-only, dark/light/system, modal + sheet stack.
