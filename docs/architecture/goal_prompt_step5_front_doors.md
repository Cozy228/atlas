# Goal Prompt: Step 5 — The Two Front Doors (I6, M9/M11, P13/P20/P28/P31)

> **Status: ratified (owner, 2026-07-05).** Execution arrangement: single-build +
> adversarial review (owner's call — the surface is mostly thin wrappers + IA work).

Implement implementation-plan.md **Step 5**: moment-first front doors on BOTH faces of the
one governed data plane. Agent: the **three-call flow** — `bootstrap` (who am I, what
tools exist) → **moment tools** wrapping the Step-4 brief handlers → the existing resource
atoms beneath. Human: the Portal home becomes the **APP home** — situation card, my
change-feed slice, the moment entries — and the catalog demotes to a tool page. Loop until
the Definition of Done is green.

Read `docs/architecture/implementation-plan.md` (§4 I6, §7 Step 5, §5 acceptance A/D/E,
§6 A1), `docs/architecture/mid-level-design.md` (§3 "MCP moment tools", §10 M9/M11),
`docs/architecture/direction-decision-log.md` (P13, P20, P28, P31), the Step-4 brief
surface (`handleBriefRequest` + `BriefRequestOptions`, `@atlas/schema` `Brief`), and the
existing MCP facade (`portal/src/api/server/mcp/{handler,tools}.ts`) before starting. This
prompt is the executable distillation; on conflict those documents win.

> **Gate note:** Step 5 requires falsifier **A1** (corp-laptop agent reaches `/mcp`) —
> owner declared A1 TRUE on 2026-07-05; no posture gate remains.

> **Layout ruling (inherited from Steps 1–4):** everything lands in the existing MCP
> module, `context-layer`, and existing portal files, plainly named — no new workspace
> package, no design-doc layer names in code. Mirror the `tools.ts` / brief-route /
> changes-route precedents everywhere one exists.

## Goal

After this step, **both doors open on "for my app, in my landing zones, now"**:

- **Agent face (P20):** `bootstrap` answers "who am I here and what can I ask" — it
  echoes the resolved situation (scope by value from tool args, or by reference via
  `appId`, M11 — including the `scope_drift` conflict warning), lists the moment tools +
  resource atoms, and states the depth contract (M9). The moment tools are **thin
  wrappers over the Step-4 brief handlers — the same code path (P13), never a second
  assembly**: `check_adoption(service, app|zones)` → adopt brief ·
  `get_my_context(app|zones)` → build brief · `whats_changed(app|zones, since?)` → change
  brief. `explain_error` arrives with Step 7's operational floor — it is NOT in this step;
  `bootstrap` honestly lists it as not-yet-available.
- **Moment tools default `depth=citations`** (M9/P28): structure + citations, no excerpt
  bodies; the agent follows citations down to the existing 4 resource atoms for bodies.
  The tool result is the SAME serialized `Brief` value every other face consumes (I3) —
  face equivalence extends to MCP.
- **Human face (I6):** the Portal home (`/`) becomes the **APP home**: the situation card
  (the existing APP/LZ selector state), a **my change-feed slice** (embedding the Step-2
  `/changes` surface's scoped feed — the slice Step 2 anticipated), and moment entries
  linking `/briefs/adopt`, `/briefs/build`, `/briefs/change` (+ debug marked
  not-yet-available). The catalog demotes to a tool page reachable from nav — the
  catalog-first home is gone (I6's rejected alternative), but the route itself is kept
  (revert is route-level).
- **What's New stays untouched (P31)** — the home's change-feed slice is the derived feed,
  never the editorial newsletter.

## Current-tree facts (verify at HEAD before starting)

- **The brief handlers are live (Step 4).** `handleBriefRequest(moment, ctx, options)` +
  `renderBriefMarkdown` + `BriefRequestOptions {service?, since?, depth?}` exported from
  the context-layer barrel; `GET /api/briefs/{moment}` + `/briefs/{moment}.md` on the
  governed router; `deriveRequestGraph` pins the graph per request (I1). Moment tools
  wrap `handleBriefRequest` — never re-assemble.
- **The MCP facade exists.** `portal/server/routes/mcp.ts` →
  `portal/src/api/server/mcp/handler.ts` (server name `atlas`) + `tools.ts` with 4
  read-only atoms: `atlas_search_service`, `atlas_get_source`, `atlas_get_availability`,
  `atlas_get_resource_context`; `mcp.test.ts` colocated. Step-1 governance threads the
  caller Bearer into a governed ctx — reuse that seam, never a bare context (I2).
- **Scope enters per M11.** `createResolutionContext({identity, scope})` accepts by-value
  (`landingZones[]`, `appId` lookup-only) or by-reference; `scope_drift` warning exists.
  Tool args must map onto `ScopeInput` — no new scope vocabulary.
- **The Portal home is catalog-first today** (`portal/src/routes/index.tsx`); the APP/LZ
  selector + `useSituation` live in `portal/src/components/landing-zone/`; the scoped
  change feed renders at `/changes` (Step 2) and brief pages at `/briefs/{moment}`
  (Step 4). The home IA change is a recomposition of these existing pieces.
- **The change feed may be empty in live mode** until the Step-2 lifecycle-trigger tail
  lands (flagged in `refreshGraphSnapshots.ts`); dev mock mode has a deterministic feed.
  The home slice must render honest-empty, never fabricate.

## Locked decisions (do not re-litigate)

1. **Moment tools are thin wrappers (P13/I3).** Each tool builds the governed ctx (Bearer +
   scope from args), calls `handleBriefRequest`, and returns the serialized `Brief` —
   no re-assembly, no tool-side filtering, no second depth vocabulary. A tool error is the
   handler's honest error, passed through.
2. **Tool names follow the `atlas_*` convention:** `atlas_bootstrap`,
   `atlas_check_adoption`, `atlas_get_my_context`, `atlas_whats_changed`. The existing 4
   atoms keep their names (agents may have them memorized).
3. **`bootstrap` is identity/scope discovery + tool inventory (I6).** Input: optional
   by-value scope (`landingZones[]`, `services[]`) and/or `appId`. Output: the resolved
   situation (LZ set, origin, any `scope_drift`/`scope_unresolved` warnings), the tool
   inventory grouped moment-tools-then-atoms, and the depth contract statement. No
   registration, no writes (M11: by-value never writes).
4. **Moment tools default `depth=citations`; `depth` is an explicit arg** (M9/P28).
   `excerpts` is available but never the default on the agent face.
5. **`explain_error` is Step 7.** `bootstrap` lists it as not-yet-available; no stub tool
   that fabricates. (Mirror the Step-4 `debug` honest-empty precedent.)
6. **APP home composition (I6):** situation card + change-feed slice + moment entries.
   The slice reuses the Step-2 scoped feed machinery (`changesQueryOptionsFor` /
   `/changes` components) — no second feed path (P31 guard extends: no differ import in
   the What's New path, unchanged). Catalog demotes to nav; `/catalog` route kept.
7. **Face equivalence extends to MCP (acceptance A).** The transport guard grows one leg:
   for a sampled scope, the Brief from the moment tool ≡ the Brief from
   `GET /api/briefs/{moment}` ≡ the in-process loader value.
8. **Agent cold-start is the acceptance drill (acceptance D):** manifest-shaped scope →
   `atlas_bootstrap` → one moment tool → follow one citation to a resource atom — zero
   human priming, zero registration. Encoded as a test against the MCP handler (real
   HTTP-shaped requests, mock sources).
9. **Multicloud native (P26/P29); public-safe fictional data everywhere.** Scope args are
   plural (`landingZones[]`); a hardcoded singular zone is a DoD-caught defect.

## Constraints

- Tests-not-gutted; frozen-suite discipline identical to Steps 1–4. English code/comments;
  implementers leave the tree uncommitted; reviewer commits. `pnpm` only; Vitest
  colocated; Playwright only for the home/e2e specs.
- Reuse the governance gate, brief handlers, changes machinery; **no second assembly, no
  new infra, no new scope vocabulary**.
- Out of scope: `explain_error` + operational floor (Step 7), honesty instruments
  (Step 6), subscriptions/push, Entra, What's New (P31).

## Definition of Done (each maps to a named test)

| # | Criterion | Proof |
|---|---|---|
| D1 | `atlas_bootstrap`: resolved situation (LZ set, origin, warnings incl. scope_drift), tool inventory, depth contract; by-value never writes | `mcp.bootstrap.test.ts` |
| D2 | 3 moment tools return the SAME Brief value as `/api/briefs/{moment}` for the same scope (thin-wrapper proof) | extended transport guard / `mcp.moments.test.ts` |
| D3 | Moment tools default `depth=citations` (no excerpt bodies); `depth:"excerpts"` arg returns bodies | `mcp.moments.test.ts` |
| D4 | `whats_changed` threads `since=` and returns the scoped feed's events via the change brief | `mcp.moments.test.ts` |
| D5 | `explain_error` absent as a tool; bootstrap lists it not-yet-available; no fabrication | `mcp.bootstrap.test.ts` |
| D6 | Agent cold-start drill: scope → bootstrap → moment tool → citation → resource atom, no priming | `mcp.coldstart.test.ts` |
| D7 | APP home: situation card + scoped change-feed slice + moment entries; honest-empty feed states | `packages/atlas-e2e/tests/app-home.spec.ts` (DEV_MOCKS=1) |
| D8 | Catalog demoted: home is not catalog-first; `/catalog` still routable from nav | `app-home.spec.ts` + existing catalog spec stays green |
| D9 | What's New untouched: P31 guards stay green; home slice imports the changes machinery, not releaseNotes | existing p31Guard tests + a home-side guard |
| D10 | Whole repo green: `pnpm -r typecheck`, `pnpm -r test`, e2e primary; no skipped/deleted tests vs baseline | CI-equivalent local run |

## Batches

- **Batch 0 (test author, frozen once):** MCP tool signatures registered but throwing
  `unimplemented`; full D1–D9 suite red for behavioral reasons; the D7/D8 Playwright spec
  authored but excluded from the red loop.
- **Batch 1:** the 3 moment tools (thin wrappers) → D2, D3, D4 green.
- **Batch 2:** `atlas_bootstrap` → D1, D5 green.
- **Batch 3:** cold-start drill green → D6.
- **Batch 4:** APP home + catalog demotion + home guards → D7, D8, D9, D10 green.

## Execution arrangement (owner-ratified 2026-07-05)

Single-build + adversarial review (the Step-3 precedent): Batch 0 built once and
review-frozen; Batches 1–4 one careful Opus pass against the frozen suite in the main
tree; Fable reviews adversarially per `atlas-review-standard` (suite = oracle, review
hunts what the suite can't see), fixes applied by an Opus subagent, reviewer commits.

## Deferred with rationale (do not build now)

- **`explain_error` + operational-location floor** — Step 7 (M7); bootstrap lists it
  honestly.
- **Honesty instruments (time-to-brief, tokens-per-brief, …)** — Step 6; the Step-4 pino
  per-brief signals already flow.
- **Subscriptions / push delivery** — deferred at Step 2; the pull feed + Atom serve M8.
- **Catalog page redesign** — demotion only; the tool page's own polish is not this step.
