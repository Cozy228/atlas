# 026 — E2E browser testing (Playwright · zero browser download · Windows-friendly)

> Executable handoff. A fresh agent/subagent executes each Work Unit cold, in order.
> **Public-safe, fake-data-only** (all fixtures/examples are fictional — see `context-layer/src/devMocks`).
> **Builds on the dev-runtime MSW seam** committed by `b59c235` ("boot MSW in the portal dev
> runtime", plan 018 P1): `portal/server/devMocks/start.ts` + the conditional registration at
> `portal/vite.config.ts`. That commit wired the seam as **always-mock-in-dev**. This plan (a)
> **EVOLVES** the seam into a creds-aware three-state contract + a UI mode badge, and (b) stands up
> the E2E suite on top. Number 026 chosen because 022–025 are reserved by plan 021.

## Goal

Stand up a **complete E2E browser test suite** for the `portal` app that:

- runs with **zero browser download** on every dev machine and in CI — Playwright drives an
  **already-installed** system browser via the `channel` option (`msedge` on Windows/Linux,
  `chrome` on macOS). **Two** download paths are suppressed: run-time (`channel`) **and** the npm
  **install-time** postinstall (`@playwright/test` downloads Chromium on install unless
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` is set — WU1);
- **runs on Windows** (proven by a `windows-latest` CI matrix leg), not just macOS/Linux;
- gets **deterministic data** from the server-side MSW seam — the browser never mocks the network;
  the dev app process itself returns fixture data;
- covers the app **comprehensively** — delivered as a **walking skeleton first** (Phase 1), then
  breadth (Phase 2).

**Done-bar (whole plan):**

- New workspace package `packages/atlas-e2e` (`@atlas/e2e`) with `@playwright/test`,
  `playwright.config.ts`, and specs. **No Chromium download** at install or run time.
- A real **browser doctor** (`pnpm e2e:doctor`) that *launches and closes* the channel browser, run
  as the first CI step so runner-image drift fails fast and legibly.
- **Primary layer** (`pnpm e2e`): comprehensive deterministic specs against the **mock-forced dev
  server** (`DEV_MOCKS=1`), stable on rerun, on **ubuntu + windows**.
- **Smoke layer** (`pnpm e2e:smoke`): a small set against the **real production build** (mock-free)
  asserting route-200 + SSR render + **mode badge ABSENT** + no JS error — **no** deterministic-data
  assertions.
- `pnpm -r typecheck && pnpm -r lint && pnpm -r test && pnpm --filter @atlas/portal build &&
  pnpm --filter @atlas/context-layer build:lambda` stay green, and **`pnpm -r test` does NOT spawn a
  browser** (E2E is its own command).

## The seam contract (LOCKED — WU-A evolves `start.ts` to this)

Three-state activation, so a developer can run dev against **real** source systems while E2E and
zero-config onboarding still get deterministic mock:

```ts
// portal/server/devMocks/start.ts
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

// Explicit override wins; otherwise auto-detect by presence of real creds.
const explicit = process.env.DEV_MOCKS;          // '1' = force mock, '0' = force real
const hasRealCreds =
  !!process.env.CONFLUENCE_TOKEN && !!process.env.CONFLUENCE_BASE_URL;
const shouldMock = explicit != null ? explicit !== "0" : !hasRealCreds;

if (shouldMock) {
  setDevDiscoveryEnv();                                 // point the discovery channels at fixtures
  server.listen({ onUnhandledRequest: "bypass" });     // intercept globalThis.fetch
}
// else: do NOTHING → real creds survive, fetch goes to real Confluence/Terraform.
export default () => {};
```

- **`pnpm dev`, no creds** → mock (identical to today's always-mock — onboarding preserved). The
  contract is a **strict superset** of always-mock.
- **`pnpm dev` + real creds in `.env.local`** → `start.ts` no-ops → live discovery hits real systems.
- **`DEV_MOCKS=1`** → force mock (E2E primary — hermetic vs any local `.env.local`).
  **`DEV_MOCKS=0`** → force real (debug the real path without full creds).
- **Prod build** (`command === 'build'`) → plugin not registered → `msw` never in the bundle.

## The decisions (settled — do NOT re-litigate)

1. **Tool = Playwright** (`@playwright/test`). First-class TS, built-in `webServer` orchestration,
   arbitrary-viewport control, and the `channel` option to drive a system browser without download.
2. **Zero browser download — BOTH paths.** (a) **Install-time:** `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
   so `pnpm install`/`add` never runs the Chromium postinstall (root `.npmrc`
   `playwright_skip_browser_download=1` + CI install-step `env`, belt & suspenders). (b) **Run-time:**
   `use.channel = process.env.PW_CHANNEL ?? (process.platform === 'darwin' ? 'chrome' : 'msedge')`.
   We **never** run `npx playwright install chromium`. Runner images drift, so "Edge is
   pre-installed" is verified each run by the doctor (decision 8), not assumed.
3. **Two-layer run model:**
   - **Primary = mock-forced dev server** (`pnpm --filter @atlas/portal dev`, `DEV_MOCKS=1`,
     port 3000). All comprehensive/deterministic specs live here.
   - **Smoke = real prod build** (`build` then `start`, no mock). Validates boot + SSR/hydration/
     routing + no JS error — **without** asserting specific data (accepts honest-empty without creds).
4. **Data determinism comes from the server-side MSW seam, not the browser.** E2E does **no**
   `page.route()` network mocking.
5. **Scope = comprehensive, sequenced as a vertical slice first.** Phase 1 proves the whole harness
   end-to-end on both OSes with the minimum (env+seam+badge, smoke + one journey + one mobile
   assertion); Phase 2 adds degraded states, a11y, the full route matrix, and the prod smoke layer.
6. **Location = `packages/atlas-e2e`** (`@atlas/e2e`, `private`). Scripts `e2e` / `e2e:smoke` /
   `e2e:doctor` — **never `test`** — so `pnpm -r test` (vitest) never spawns a browser.
7. **Windows-first hygiene:** env via Playwright's `webServer.env` object (**never** a `VAR=value cmd`
   shell prefix); all paths via `node:path`; `webServer.command` uses only pnpm (no Unix shell).
8. **A real preflight doctor, not `--list`.** `e2e:doctor` = a tiny script that
   `chromium.launch({ channel })` then `close()`. `--list` only enumerates tests; the doctor proves
   the system browser actually launches.
9. **026 OWNS the seam evolution.** Supersedes the old "018 owns it, don't touch": 018 P1
   (`b59c235`) delivered the always-mock seam; this plan evolves it (WU-A) to the three-state
   contract above and adds the mode badge (WU-B). Do **not** alter the context-layer fixtures/
   handlers (`context-layer/src/devMocks/{fixtures,handlers,server,setup,testEnv}.ts`) — only the
   portal-side activation (`start.ts`) + the badge.
10. **E2E discovers dynamic slugs black-box from the UI** — `atlas-e2e` has **no** dependency on
    `@atlas/context-layer`. Navigable slugs come from the rendered UI (`/catalog` → first service
    link, `/availability` → first cell, each index → first row). Documented stable ids (e.g. policy
    `300001`/`300002`) only where a spec must assert specific fixture content.

## Current state (verified 2026-06-30 — re-verify before editing)

- **The dev-runtime MSW seam EXISTS and renders fixtures** (commit `b59c235`, "plan 018 P1"):
  - `portal/server/devMocks/start.ts` — imports `{ server, setDevDiscoveryEnv }` from
    `@atlas/context-layer/devMocks`; at **import top** calls `setDevDiscoveryEnv()` +
    `server.listen({ onUnhandledRequest: 'bypass' })`; default export = no-op Nitro plugin.
  - `portal/vite.config.ts` — `defineConfig(({ command }) => …)` with
    `nitro({ serverDir: 'server', plugins: command === 'serve' ? ['./server/devMocks/start'] : [] })`.
    Prod build never lists it → `msw` stays out of the bundle.
  - **Proven**: `pnpm --filter @atlas/portal dev` then `curl /catalog` → SSR contains fixture tokens
    ("Textract", "Kubernetes"). `/api/resources` + `/api/resources/{kind}/{slug}` are live endpoints.
  - **⚠️ Currently always-mock**: `start.ts` boots MSW **unconditionally** in `serve` — no creds
    guard, no `DEV_MOCKS`, **no badge**. WU-A evolves this.
- **Dev port is `3000`** (NOT 5173 — Vite/Nitro dev serves on 3000 here). Prod `pnpm start`
  (`node .output/server/index.mjs`, Nitro) also defaults to 3000. Pin/verify at execution.
- **`.gitignore` already covers env files**: `.env` + `.env.*` ignored, `!.env.example` /
  `!.env.*.example` un-ignored. `.env.local` is already safe to create; only `.env.example` is
  committed.
- **Runtime env inventory** (audited; the WU-ENV `.env.example` source — re-audit incl. bracket/
  destructured reads at execution): source systems `CONFLUENCE_BASE_URL` (17 reads),
  `CONFLUENCE_TOKEN`, `CONFLUENCE_EMAIL`, `CONFLUENCE_AVAILABILITY_PAGE_AWSF`,
  `CONFLUENCE_RELEASE_NOTES_PAGE_ID`, `TERRAFORM_BASE_URL`, `TERRAFORM_TOKEN`; routing/API
  `CONTEXT_API_BASE_URL`, `PORTAL_ORIGIN`, `PORT`/`NITRO_PORT`/`NITRO_HOST`/`HOST`; cache
  `CACHE_VALKEY_URL`/`CACHE_VALKEY_CLIENT`; LLM `LLM_PROVIDER` (`simulated`),
  `BEDROCK_MODEL_ID`, `BEDROCK_REGION` (in `claimsLlmShared.ts`/`askAtlas.ts`); dev-mock
  `DEV_MOCKS` (new, WU-A), `DEV_MOCK_LATENCY_MS`. (`AWS_*` are SDK/infra-internal — not
  app config; exclude from `.env.example`.)
- **No browser tooling exists.** No Playwright/Cypress/Puppeteer; no `playwright.config.*`; all tests
  are Node `vitest`.
- **CI** (`.github/workflows/ci.yml`, `ubuntu-latest`, Node 22, pnpm 11.8.0, `--frozen-lockfile`):
  `pnpm -r typecheck` → `lint` → `test` → `pnpm --filter @atlas/portal build` → `pnpm --filter
  @atlas/context-layer build:lambda`. **No root `build`/`pnpm -r build`.** No browsers. E2E job is new.
- **Degraded-state components** (real files): `portal/src/components/deferred-region.tsx`,
  `portal/src/components/route-error.tsx`. Ask: `portal/src/components/ask/{ask-atlas-search,
  ask-atlas-chat,ask-overlay}.tsx`.
- **Routes** (`portal/src/routes/`, verify against generated `routeTree.gen.ts` at execution — IA
  reshaped by 019/020/021): static `/`, `/overview`, `/availability`, `/catalog`, `/guidance`,
  `/sources`, `/skills`, `/whatsnew`, `/support`; dynamic `/service/$provider/$id`,
  `/policies/$policyId`, `/guidance/$guidanceId`, `/sources/$sourceId`, `/releases/$releaseId`
  (slugs **black-box-discovered**, decision 10).

---

## Phase 1 — Walking skeleton (env + seam first; then ubuntu + windows green end-to-end)

### WU-ENV — Extract runtime config into env + author `.env.example` (START HERE)
- **Re-audit** every runtime `process.env.*` read (incl. bracket-notation `process.env["X"]` and
  destructured `const { X } = process.env`) across `portal/`, `context-layer/`, `infra/` — the
  Current-state inventory is the seed, not the final list.
- Create `portal/.env.example` (committed, **fictional placeholders only** — no real hosts/tokens),
  grouped + commented: **source systems** (`CONFLUENCE_*`, `TERRAFORM_*`, page ids),
  **routing/API/ports** (`CONTEXT_API_BASE_URL`, `PORTAL_ORIGIN`, `PORT`), **cache**
  (`CACHE_VALKEY_*`), **LLM** (`LLM_PROVIDER=simulated` default + Bedrock vars),
  **dev-mock** (`DEV_MOCKS`, `DEV_MOCK_LATENCY_MS`). Document the three-state
  `DEV_MOCKS` semantics inline.
- Surgical only: do **not** convert hardcoded values that aren't deployment-varying; only document/
  extract genuinely env-worthy config. Leave existing `process.env` reads as-is (this WU adds the
  template, not new indirection) unless a clearly-config value is hardcoded — then flag it.
- **Verify:** `.env.example` covers every runtime-read var; `.gitignore` keeps `.env.local` out;
  copying `.env.example`→`.env.local` and filling real Confluence creds makes `pnpm dev` hit real
  systems (pairs with WU-A).

### WU-A — Evolve the dev-runtime seam to the three-state contract
- Rewrite `portal/server/devMocks/start.ts` to the **seam contract** above (gate
  `setDevDiscoveryEnv()` + `server.listen()` behind `shouldMock`).
- **⚠️ Verify the env-loading chain** (the one real risk): `.env.local`'s `CONFLUENCE_*` must reach the
  **Nitro dev runtime** `process.env` before `start.ts` evaluates. TanStack Start/Nitro loads `.env`
  by default; **`.env.local` auto-load is NOT confirmed** — if it doesn't land, add an explicit
  `dotenv` load at the top of `start.ts` (or `vite.config.ts`).
- **Verify:** `DEV_MOCKS=1 pnpm dev` → `/catalog` renders fixtures; real-ish `CONFLUENCE_*`
  in `.env.local` (even a 404 host) → seam no-ops, surfaces degrade to honest-empty (bypass proven).

### WU-B — Data-mode badge (top nav)
- A server fn returns `dataMode: 'mock' | 'live'` from the **same `shouldMock` predicate** (one
  source of truth). Root layout renders a small top-nav badge (e.g. "Mock data") only when
  `dataMode === 'mock'`. Public-safe, generic copy.
- **Verify:** badge visible under `DEV_MOCKS=1 pnpm dev`; absent when real creds bypass MSW.
  (E2E asserts presence in primary, absence in smoke — the deterministic mode hook.)

### WU0 — Acceptance of the rendered seam (not a blocker)
- `DEV_MOCKS=1 pnpm --filter @atlas/portal dev`; open `/catalog` + one `/service/$provider/$id`
  → confirm **fixture** content + badge present. If it *doesn't* render mock, that's a WU-A
  regression to fix — do **not** add browser-side mocking (violates decision 4).

### WU1 — Scaffold `packages/atlas-e2e`
- `package.json` (`"name": "@atlas/e2e"`, `"private": true`), scripts `"e2e": "playwright test"`,
  `"e2e:doctor": "node scripts/doctor.mjs"`,
  `"e2e:smoke": "playwright test --config=playwright.smoke.config.ts"`,
  `"e2e:report": "playwright show-report"`. **No `test` script.**
- **Suppress the postinstall download:** root `.npmrc` `playwright_skip_browser_download=1`, then
  `pnpm --filter @atlas/e2e add -D @playwright/test`. (`@axe-core/playwright` added in WU10.)
- `tsconfig.json` consistent with the repo so `pnpm -r typecheck` stays green. Optional root
  convenience scripts.
- **Verify:** `pnpm install` clean **and downloads no browser** (watch for "Downloading Chromium" —
  must be absent); `pnpm -r test` runs only vitest; `pnpm -r typecheck` green.

### WU2 — Browser doctor + zero-download channel
- `scripts/doctor.mjs`: `import { chromium } from '@playwright/test'`; resolve
  `channel = process.env.PW_CHANNEL ?? (process.platform === 'darwin' ? 'chrome' : 'msedge')`;
  `const b = await chromium.launch({ channel }); await b.close();` → log `OK: launched <channel>`;
  non-zero exit on throw.
- `playwright.config.ts`: same channel resolution in `use.channel`; `use: { baseURL,
  trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'retain-on-failure' }`.
- **Verify:** `pnpm e2e:doctor` exits 0 and actually opens/closes the browser; an empty
  `ms-playwright` cache does **not** break it.

### WU3 — Primary `webServer` (mock-forced dev server, Windows-safe, LLM simulated)
```ts
webServer: {
  command: 'pnpm --filter @atlas/portal dev',     // pnpm only; verify --port flag if pinning
  env: { DEV_MOCKS: '1', LLM_PROVIDER: 'simulated' },  // force mock + deterministic Ask
  url: 'http://127.0.0.1:3000',                   // dev port 3000 (verified); set PORT if needed
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
}
```
- `use.baseURL = 'http://127.0.0.1:3000'`. If pinning a port, verify the dev server honors `--port`
  (it naturally serves 3000); otherwise set `PORT`/`NITRO_PORT` via `env` (Windows-safe).
- **Verify:** `pnpm e2e` boots cross-platform (the `env` object — not a shell prefix — sets the
  flags) and `await page.goto('/')` passes against fixtures.

### WU4 — Full-route smoke baseline (deterministic)
- One spec iterating every navigable route (Current-state list; **black-box-discovered** dynamic
  slugs). Per route assert: HTTP 200 (no 4xx/5xx), a known landmark visible, **no console error / no
  `pageerror`** (attach listeners; fail on error). **Also assert the mock badge is present** (WU-B).
- **Verify:** all routes green; rerun stable.

### WU5 — One core journey
- The spine: **home → `/catalog` search (type a fixture term, see filtered results) →
  `/service/$provider/$id` → `/availability` (matrix renders, a cell present) → `/policies/$policyId`
  → Ask (submit in `ask-atlas-search`, assert a response region appears — deterministic via
  `LLM_PROVIDER=simulated`)**. `getByRole`/`getByLabel`, not brittle CSS.
- **Verify:** journey passes deterministically.

### WU6 — One mobile assertion
- A `projects` entry (or per-test `viewport`) at ~375–390px; re-run the spine (or a layout-sensitive
  subset incl. `/availability`). Assert no horizontal overflow + mobile nav works. (Playwright sets
  arbitrary viewports natively — no resize workaround.)
- **Verify:** mobile project green at 375px.

### WU7 — CI Phase-1 (zero download, Windows leg, doctor first)
- New `e2e` job in `.github/workflows/ci.yml`, `needs:` the existing build/test job:
  - Matrix `os: [ubuntu-latest, windows-latest]`, Node 22, pnpm 11.8.0, install-step env
    `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, `pnpm install --frozen-lockfile`.
  - **First step `pnpm e2e:doctor`** (fail fast on image drift), then `pnpm e2e`, both with
    `PW_CHANNEL=msedge` (pre-installed on both — **no `playwright install`**).
  - Upload `playwright-report/` + traces `if: failure()`.
- **Verify (Phase-1 exit gate):** both OS legs green; **CI logs show no browser download at install
  OR run** (grep for "Downloading"/chromium install — must be absent).

> **Phase 1 exit:** env extracted, seam evolved + badged, ubuntu + windows both green end-to-end,
> zero-download proven. Only then start Phase 2.

---

## Phase 2 — Comprehensive (after Phase 1 is stable)

### WU8 — Error / degraded states
- **Deferred loading:** assert the `deferred-region.tsx` skeleton appears then resolves; widen the
  window with `DEV_MOCK_LATENCY_MS` via `webServer.env`.
- **Honest-empty / source-unavailable:** target a fixture where MSW returns 401/403/404 or
  truncated/`incomplete` and assert the honest "data not available" UI (ADR-0006) — never fabricated
  content or a crash.
- **Route error boundary:** force a not-found dynamic slug → assert `route-error.tsx` renders, not a
  white screen.

### WU9 — Full narrow-viewport pass
- Extend WU6's mobile project across the remaining key pages (catalog, service detail, sources,
  guidance). Assert content reachable + no overflow at 375px.

### WU10 — Baseline accessibility
- `pnpm --filter @atlas/e2e add -D @axe-core/playwright` (npm only, no browser). Scan home, catalog,
  a service detail, availability, a policy, ask.
- **Fork (default: baseline-snapshot).** The UI was not built a11y-first; a hard zero-`serious`/
  `critical` gate day 1 risks fix-all-or-suppress-all. **Default:** record current violations as an
  accepted baseline, gate only on **new** ones; ticket the baseline, don't silently suppress.

### WU11 — Production-build smoke layer (build separated from webServer)
- `"e2e:smoke": "pnpm --filter @atlas/portal build && playwright test --config=playwright.smoke.config.ts"`.
- `playwright.smoke.config.ts` `webServer`:
  ```ts
  { command: 'pnpm --filter @atlas/portal start',
    env: { PORT: '3000' },               // pin the Nitro prod port (verify default)
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI, timeout: 120_000 }
  ```
  **No** `DEV_MOCKS` (prod is mock-free).
- Small spec set: each top route 200, SSR HTML contains the expected shell/nav, **mode badge
  ABSENT**, no `pageerror`. **No deterministic-data assertions.**
- **Verify:** `pnpm e2e:smoke` builds, boots prod, passes route-200/SSR/badge-absent/no-error.

### WU12 — CI Phase-2
- Add an `e2e:smoke` job (ubuntu) on the built prod server. Fold WU8–WU10 into the primary matrix.
- **Fork (default: Windows subset).** Once the suite is large, run the smoke+journey subset on
  `windows-latest` (responsive/a11y are cross-platform-isomorphic), full suite on `ubuntu-latest` —
  saving ~half the Windows minutes. Revisit if a Windows-specific rendering bug appears.
- **Verify:** smoke job green; full primary matrix green.

### WU13 — Documentation
- `packages/atlas-e2e/README.md`: local run (`pnpm e2e`, `pnpm e2e:doctor`, `pnpm e2e:report`), the
  `PW_CHANNEL` knob + OS defaults, the zero-download rationale (both paths), the two-layer model, the
  three-state `DEV_MOCKS` seam contract + how to run dev against real creds (`.env.local`).
- One-line pointer from root `README.md`.
- **Verify:** a Windows teammate follows the README to a green `pnpm e2e:doctor && pnpm e2e` with no
  extra browser install.

## Verification gates (global — all must hold to call 026 done)

- **G-zero-download:** no `playwright install chromium` anywhere; `pnpm install` downloads no
  browser; `pnpm e2e:doctor` passes with an empty `ms-playwright` cache; CI logs contain no download.
- **G-seam-contract:** `start.ts` honors the three-state predicate (`=1`→mock, real creds→live,
  none→mock); prod build registers no plugin (no `msw` in bundle).
- **G-windows:** the `windows-latest` primary leg is green.
- **G-deterministic:** primary-layer specs pass on rerun with no flake (E2E forces mock, so a local
  `.env.local` cannot poison it).
- **G-no-regress:** `pnpm -r typecheck && pnpm -r lint && pnpm -r test && pnpm --filter @atlas/portal
  build && pnpm --filter @atlas/context-layer build:lambda` green (the CI's actual shape — no
  `pnpm -r build`), and `pnpm -r test` spawns **no** browser.
- **G-smoke:** `pnpm e2e:smoke` passes route-200 + SSR + badge-absent + no-JS-error against prod.
- **G-comprehensive:** journeys (WU5), degraded (WU8), narrow-viewport (WU9), a11y (WU10) present
  and green.

## Risks & notes

- **Env-loading chain (WU-A's one real risk):** `.env.local` `CONFLUENCE_*` must reach the Nitro dev
  runtime `process.env` before `start.ts` evaluates. Verify; add explicit `dotenv` if not auto-loaded.
- **`.npmrc` skip passthrough uncertainty:** unclear whether pnpm exports the `.npmrc`
  `playwright_skip_browser_download` to the postinstall — mitigate with the CI install-step `env` too,
  and assert "no download" in G-zero-download.
- **channel-on-CI:** GitHub `ubuntu-latest`/`windows-latest` images ship Chrome+Edge with host deps
  present; the doctor confirms it each run.
- **macOS has no pre-installed Edge** — handled by the OS-defaulted channel (`chrome` on darwin).
- **Dev port = 3000** (verified), not 5173; prod Nitro also defaults 3000. Pin via `env` if a clash
  arises.
- **Dynamic-route slugs are black-box-discovered** (decision 10), keeping `atlas-e2e` decoupled from
  context-layer internals and resilient to fixture changes.
- **Ask must run simulated** in the primary layer (`LLM_PROVIDER=simulated`) so WU5 is
  deterministic and never bills/relies on a real model.
- **Do not let E2E creep into `pnpm -r test`** — `@atlas/e2e` intentionally has no `test` script.
