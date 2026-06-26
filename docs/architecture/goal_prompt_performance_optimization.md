# Goal Prompt: Performance Audit for Low-Spec Windows / Slow-Network Clients

Run a **read-only performance audit** of the Atlas Portal, optimised for the
real target user: an **underpowered Windows corporate laptop on a slow,
proxied, possibly TLS-inspected corporate network**. Fan out parallel
subagents, confirm every finding against the code, write **each potential
optimisation item down** with evidence, then hand off the top items as
self-contained executor plans. Loop until the Definition of Done is green.

You are a **senior performance advisor, not an implementer**. Follow the
`improve` skill methodology (recon → parallel audit → vet → prioritise → write
handoff plans). Read these before starting:

- `/Users/ziyu/.claude/skills/improve/references/audit-playbook.md` — sections
  **"## 3. Performance"** and **"## Finding format"** (mandatory shape for every item).
- `/Users/ziyu/.claude/skills/improve/references/plan-template.md` — the handoff plan template.
- This file is the executable distillation of the audit's scope; the architecture
  map below is your recon baseline so subagents start grounded.

## Goal

Produce a **prioritised, evidence-backed list of every performance optimisation
opportunity** across four target axes — **page loading, tab switching, data
loading, and parsing/resolving** — plus a React-render pass driven by the
`vercel-react-best-practices` skill, all viewed through the **low-spec Windows /
slow-network lens**. Turn the highest-leverage items into executor plans under
`plans/`.

```text
target user:  weak Windows CPU  +  slow/throttled/proxied network  +  no public CDN
optimise for: bytes over the wire · main-thread time · number of external round-trips
the win:      every finding is judged by "does this help THAT machine on THAT network?"
```

## Locked decisions (do not re-litigate)

1. **Read-only.** Never modify source. The only files you create live under
   `plans/`. No installs, no commits, no formatters. Read-only analysis only
   (`pnpm typecheck`, `pnpm build` to inspect chunk output, `pnpm
   measure:availability-render`, Chrome DevTools throttling).
2. **The resolver and parser are mocks today** — `confluenceCloudContentProvider`,
   `terraformModuleContentProvider`, and the `availability` / `announcements` /
   `releaseNotes` server functions return hand-curated, public-safe data. **Do
   not micro-benchmark the mocks.** Every data-loading / parsing finding must be
   **architectural**, written under the assumption that **each real Confluence or
   Terraform fetch is a very expensive external round-trip** (network + auth +
   HTML/Markdown parse). The optimisation target is **minimising the count and
   cost of those external calls**, not the current in-memory stub latency.
3. **Target = low-spec Windows corporate machine on a slow network.** This is a
   lens applied to *every* finding, plus its own stream (F). A change that only
   helps a fast Mac on fibre is low priority; a change that cuts wire bytes,
   main-thread time, or external round-trips is high priority.
4. **Findings need evidence.** `file:line` + measured/estimated impact, or it is
   not a finding. Vet every subagent finding by opening the cited code yourself
   before it enters the list (subagents over-report). Record rejected items with
   one line of reasoning so they are not re-audited.
5. **React Compiler is already on** (`babel-plugin-react-compiler` in
   `portal/vite.config.ts`). Do **not** file findings for missing
   `useMemo`/`useCallback`/`memo()` — the compiler handles those. File only what
   the compiler cannot fix (effect thrash, large DOM / missing virtualisation,
   key churn, layout reflows, context fan-out, heavy synchronous work).

## Constraints (from repo CLAUDE.md)

- Public-safe only: fictional names, generic sample data. No real tokens, page
  ids, internal URLs, or company content in findings or plans.
- Surgical: every proposed change traces to a measured cost. No speculative
  abstractions, no "while we're here" refactors in the plans.
- Plans target the **weakest plausible executor**: fully self-contained, every
  step has a verification command and expected output.

## Architecture map (recon baseline — already gathered)

**Stack.** TanStack Start `1.168` (router `1.170`, `@tanstack/react-query` 5,
`@tanstack/react-router-ssr-query`) on **Vite 8 (Rolldown)** + **Nitro 3**.
React `19.2` with **React Compiler**. Tailwind 4. Lint/fmt via `oxlint`/`oxfmt`.

**Build** — `portal/vite.config.ts`:
- Manual Rolldown code-splitting groups: `react-dom`, `react`, `motion`,
  `tanstack`, `aws-icons`, `azure-icons`, `tabler-icons`.
- `chunkImportMap` is **deliberately disabled** (comment: breaks the Nitro
  re-bundle pass, `UNRESOLVED_IMPORT`). Quantify what this costs in cache
  granularity / round-trips before recommending re-enabling.
- Build: `node scripts/gen-agent-skills-index.mjs && vite build` → `.output/`.
  Serve: `node .output/server/index.mjs`.

**Router** — `portal/src/router.tsx`:
- `defaultPreload: "intent"`, `defaultPreloadStaleTime: 0`,
  `scrollRestoration: true`. QueryClient global `staleTime: 60_000`.

**Routes** — file-based in `portal/src/routes/`: `index`, `overview`,
`catalog`(`.index`/`.$topicId`), `availability`(`.index`),
`guidance`(`.index`/`.$guidanceId`), `sources`(`.index`/`.$sourceId`),
`skills.index`, `whatsnew`, `releases.$releaseId`, `guardrails.$guardrailId`,
`ask`. Layout routes render `<Outlet/>` only; data lives in `.index`. Data
pattern: `loader: ({ context }) => context.queryClient.ensureQueryData(opts)`
in the route + `useSuspenseQuery(opts)` in the component.

**Query layer** — `portal/src/api/queries.ts`:
- `releaseNotes` / `announcements` / `topics` / `sources`: `staleTime 60_000`.
- `guidance` / `availability`: `staleTime: Infinity`.
- `contextBundle`: **no `staleTime`** (refetches on every mount/navigation — and
  each is a context-layer call). Query keys embed the full request object
  (`["context-bundle", request]`, `["topics", request]`).

**Server boundary** — `portal/src/api/server/*` (`createServerFn` RPCs):
- `contextApi.ts` → `serverContextApiClient` switches between
  `httpContextApiClient` (HTTP, forwards caller Bearer) and `inProcessContextApi`
  (offline, in-process) by `ATLAS_CONTEXT_API_BASE_URL`.
- `availability.ts`, `announcements.ts`, `releaseNotes.ts`, `guidance.ts` return
  hand-curated mock projections today.

**Data layer (`context-layer/` — deployed as Lambda)**:
- `resolvers/`: `confluencePageResolver`, `terraformModuleResolver`,
  `availabilityMatrixResolver`, `policyDocumentResolver`, `resolveAnchor`,
  `resolverRegistry`.
- `sourceContent/`: `confluenceCloudContentProvider`,
  `terraformModuleContentProvider` (the **expensive external** providers;
  `pilotSourceContent` is the offline mock) and the cache layer —
  `sourceContentCache.ts` (`InMemoryContentCache`, TTL **300s**, max **500**
  entries, insertion-order eviction; `withCache` wraps a `FetchLike`, caches
  **only OK GET** responses, folds `Authorization` into the key digest) +
  `valkeyContentCache.ts` (shared ElastiCache adapter, active only when
  `ATLAS_CACHE_VALKEY_URL` is set). Doc: `docs/architecture/source-content-cache.md`.
- `services/contextBundleService.ts` assembles bundles by resolving anchors;
  `repositories/` are DynamoDB-backed.

**Heavy client deps** (slow-network suspects): `shiki`, `streamdown` (+
`@streamdown/mermaid`, `@streamdown/math`, `@streamdown/code`, `@streamdown/cjk`),
`motion`, `@tabler/icons-react`, `aws-react-icons`, `azure-react-icons`,
`fuse.js`, `cmdk`, `embla-carousel-react`, `@fontsource-variable/inter`. Known
importers include `components/home/welcome.tsx`, `components/ai-elements/*`,
`components/explore/matrix-view.tsx`.

**Known hotspot.** The availability matrix (regions × services grid + per-cell
icons). A benchmark already exists:
`scripts/measure-availability-render-cost.debug.test.tsx` via `pnpm
measure:availability-render`. Route `availability.index.tsx` eagerly imports
`MatrixView`, `RegionMap`, `RegionDetail`, `@tabler/icons-react`, and
`preloadAzureServiceIcons`.

**Verification commands** (repo root unless noted; run from `portal/` for portal
scripts): `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm
measure:availability-render`.

## How to run it (improve methodology)

### Phase 1 — Recon delta (light)

The map above is your recon. Spend at most a few reads confirming anything you
will key a subagent on (e.g. open `portal/vite.config.ts`, `router.tsx`,
`queries.ts`, `sourceContentCache.ts`). Record `git rev-parse --short HEAD` —
every plan stamps this.

### Phase 2 — Fan out (parallel, read-only)

Spawn the streams below as **concurrent read-only subagents** (Explore agents —
one message, multiple tool calls). Subagents **do not inherit this context**, so
each subagent prompt MUST include:

- the **absolute path** `/Users/ziyu/.claude/skills/improve/references/audit-playbook.md`
  and the instruction to read **"## 3. Performance"** and **"## Finding format"**
  (and confirm it could read the file);
- the relevant slice of the architecture map above (paste it — do not assume);
- the stream's scope, the candidate items to confirm/refute, and the target lens
  (low-spec Windows / slow network);
- "**Return findings only** — `file:line` evidence, impact, effort (S/M/L), risk,
  confidence, fix sketch. No fixes, no file dumps, no code edits."

The **candidate items** under each stream are *hypotheses, not findings*. The
subagent must confirm each against the code and return it with evidence, or
reject it with one line. They exist so nothing is missed — add any item the code
reveals.

#### Stream A — Page loading & initial payload
Scope: `portal/vite.config.ts`, route entry chunks, `src/routes/__root.tsx`,
`src/components/portal-shell.tsx`, font + CSS loading, the heavy-dep importers.
Confirm/refute:
- A1. Heavy deps (`shiki`, `streamdown`+`mermaid`+`math`, `motion`, `fuse.js`,
  `cmdk`, `embla`) landing in the entry/initial chunk instead of being
  route-split or `lazy()`-loaded. `mermaid` especially. Which routes pull each?
- A2. Icon packs (`aws-react-icons`, `azure-react-icons`, `@tabler/icons-react`)
  — do `lib/aws-icon-map.tsx` / `lib/azure-icon-map.tsx` / `service-icon.tsx`
  use static maps / barrel imports that defeat tree-shaking and pull whole packs?
- A3. Font `@fontsource-variable/inter` — how imported (all weights? subset?),
  `font-display`, preload, self-hosted (good — confirm nothing falls back to a
  public CDN).
- A4. `chunkImportMap` disabled — measured cost in cache granularity / extra
  round-trips on a cold cache over a slow link.
- A5. SSR: is TanStack Start **streaming** the HTML shell or buffering to first
  byte? Streaming helps slow links most.
- A6. Compression (brotli/gzip) and precompressed static assets from Nitro;
  long-lived `immutable` cache headers on hashed chunks. Note corporate proxies
  that strip encodings.
- A7. `globals.css` size / unused Tailwind utilities / render-blocking CSS.

#### Stream B — Tab switching & client navigation
Scope: `router.tsx`, route files, `portal-shell.tsx`, suspense boundaries.
Confirm/refute:
- B1. `defaultPreload: "intent"` + `defaultPreloadStaleTime: 0` on a slow link —
  does hover-preload fire redundant server-fn / external calls? Is query-cache
  dedup actually saving the refetch? Weigh `intent` vs viewport/delay on metered links.
- B2. Per-route component code-splitting: does switching to a *light* tab still
  download the *heavy* route's code (matrix, ask)? Are heavy routes split?
- B3. `PortalShell` / nav re-rendering or recomputing on every navigation.
- B4. Expensive components unmounting+remounting (and recomputing) on tab
  switch instead of preserving state.

#### Stream C — Data loading
Scope: `src/api/queries.ts`, route loaders, `src/api/server/*`, SSR
dehydration.
Confirm/refute:
- C1. `contextBundle` has **no `staleTime`** → refetch on every mount/navigation,
  each a (future-expensive) context-layer call. Right `staleTime`/`gcTime`?
- C2. SSR dehydration payload size — full query results serialised into the HTML
  (availability matrix, guidance list) inflate first-byte bytes on slow links.
  Quantify; can fields be trimmed/selected?
- C3. Request waterfalls — does a detail route fetch discovery *then* bundle
  sequentially when they could be parallel?
- C4. Client-side navigation triggers a network `createServerFn` round-trip;
  confirm the path and whether anything is fetched client-side that was already
  available at render time.
- C5. Query-key stability (`["...", request]` with an object) — does it cache-hit
  reliably or churn on new object identity?

#### Stream D — Parsing / resolving (expensive external — **highest leverage**)
Scope: `context-layer/src/sourceContent/*`, `context-layer/src/resolvers/*`,
`context-layer/src/services/contextBundleService.ts`. Treat every Confluence /
Terraform fetch as very expensive. Confirm/refute:
- D1. **No request coalescing / single-flight** — `sourceContentCache` dedupes by
  TTL but N concurrent misses for the same page = N external fetches (thundering
  herd). Add single-flight.
- D2. In-memory cache on **ephemeral, multi-instance Lambda** → cold instances
  always miss → the **Valkey shared cache must be the default in prod**, not
  opt-in via `ATLAS_CACHE_VALKEY_URL`. Confirm prod wiring.
- D3. **No stale-while-revalidate** — a miss blocks the response on a synchronous
  external fetch; SWR serves stale instantly + refreshes in background.
- D4. **No negative caching** — only OK GETs are cached, so repeated 404/403/timeout
  re-hit the external system. Cache negatives briefly.
- D5. **No batching** — `contextBundleService` resolves anchors one-by-one; a
  bundle with many anchors on one Confluence page = many fetches. Batch by page id
  (fetch the page once, resolve multiple anchors from it).
- D6. Parsing cost — full HTML/Markdown body parsed per request to extract one
  excerpt; cache the *parsed* structure, not just the raw response.
- D7. Payload shaping — ensure only excerpts (not whole pages) cross the wire to
  the browser; bundle response size on a slow link.
- D8. Cache warming / durable persistence for popular topics (vs ephemeral 300s).

#### Stream E — React render performance (use `vercel-react-best-practices`)
Load the skill first (repo convention): from repo root run
`npx @tanstack/intent@latest load vercel-react-best-practices` and follow the
returned `SKILL.md` (it is in `skills-lock.json`, source `vercel-labs/agent-skills`;
local cache under `portal/.agents/skills/`). Apply its checklist to the heaviest
components, **skipping anything React Compiler already handles** (see locked
decision 5). Scope + confirm/refute:
- E1. Availability matrix (`components/explore/matrix-view.tsx`, `availability.index.tsx`):
  large grid, per-cell icons — virtualisation? DOM node count? Use `pnpm
  measure:availability-render` as the baseline.
- E2. Ask chat (`components/ai-elements/*`, `streamdown`) — markdown re-parsed on
  every stream token → per-chunk re-render cost on a weak CPU.
- E3. `components/explore/region-map.tsx` — SVG projection recomputed per render?
- E4. `availability.index.tsx` uses `useReducer`/`useLayoutEffect`/`useRef` —
  layout reflow / measure thrash on weak CPUs.
- E5. Context fan-out (theme, ask-atlas, query provider) causing wide re-renders.

#### Stream F — Cross-cutting: low-spec Windows / slow corporate network
This stream both audits its own items **and** re-scores every other stream's
findings through the lens. Confirm/refute:
- F1. Main-thread CPU: `shiki` highlighting, `mermaid` rendering, markdown
  parsing all run on the main thread → jank on weak CPUs. Defer / lazy / offload.
- F2. Define the **measurement methodology**: Chrome DevTools **Slow 4G + CPU
  4–6× throttle**; capture TTFB, FCP, LCP, TBT, and route-transition time per
  tab. (Use Chrome MCP if available.)
- F3. Corporate proxy / TLS-inspection latency: prefer fewer, larger requests;
  HTTP/2 multiplexing; connection reuse.
- F4. No runtime dependency on any public CDN (Google Fonts, unpkg, mermaid CDN).
- F5. Memory footprint of large matrices + icon sets on low-RAM machines.
- F6. (Optional) service-worker / offline app-shell for repeat visits on flaky links.

### Phase 3 — Vet, write the list, prioritise

1. **Vet** every returned item: open the cited `file:line`, confirm it, drop
   duplicates and by-design behaviour.
2. **Write each potential optimisation item down** in one consolidated table in
   `plans/README.md` (append/reconcile — it already holds 001–005), using the
   improve **Finding format** fields, ordered by **leverage = impact ÷ effort,
   discounted by confidence/risk**, with a column **"slow-Windows weight"**
   (HIGH/MED/LOW: how much this helps the target machine). Record rejected
   hypotheses in the "considered and rejected" section.
3. Present the ranked table and ask which items to turn into plans (default: top
   3–5 by leverage + anything flagged HIGH slow-Windows weight). Surface
   dependency order (e.g. a measurement-baseline plan precedes risky render work).

### Phase 4 — Handoff plans

For each selected item, write `plans/NNN-<slug>.md` (continue numbering from
**006**; reconcile with the existing index, keep numbering monotonic) using
`plan-template.md`. Each plan: inlined context, exact files, current-state
excerpts **read by you** (never copied from a subagent), ordered steps each with
a verification command + expected output, in/out-of-scope lists, machine-checkable
done criteria, and STOP conditions. Stamp every plan with the recon SHA.

If no objective performance baseline exists, **plan 006 is "establish a
performance measurement baseline"** (bundle/chunk sizes from `pnpm build`,
`measure:availability-render`, throttled DevTools trace per route, a count of
external resolver calls per bundle request) — it precedes every render/data plan
so later work can prove its win.

## Definition of Done

- [ ] All six streams ran as read-only subagents; the final report names what was
      **not** audited.
- [ ] **Every optimisation item is written down** in `plans/README.md` in the
      Finding format, each with `file:line` evidence, quantified-or-estimated
      impact (wire bytes / request count / ms / DOM nodes), effort, risk,
      confidence, and a **slow-Windows weight**.
- [ ] Items are ranked by leverage; rejected hypotheses are recorded with a
      one-line reason (so nobody re-audits them).
- [ ] The `vercel-react-best-practices` skill was loaded and its checklist
      applied to streams E (cite which rules fired); no findings duplicate what
      React Compiler already handles.
- [ ] Data-loading / parsing findings are **architectural** (minimising external
      Confluence/Terraform round-trips), not micro-benchmarks of the mocks.
- [ ] The top 3–5 items (incl. any HIGH slow-Windows-weight item) are written as
      self-contained `plans/006+` handoff files, each with machine-checkable done
      criteria and verification commands; a measurement-baseline plan exists and
      is ordered first.
- [ ] No source files were modified; no secrets appear in any finding or plan.
</content>
</invoke>
