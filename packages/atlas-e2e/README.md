# @atlas/e2e

End-to-end browser tests for the `@atlas/portal` app, driven by Playwright. Two
design rules shape everything here:

1. **Zero browser download** — we never download Chromium. Specs drive an
   **already-installed system browser** via Playwright's `channel` option.
2. **Determinism comes from the server, not the browser** — the suite does no
   `page.route()` network mocking. Deterministic data comes from the portal's
   server-side MSW seam (`DEV_MOCKS=1`); the browser just drives the real app.

## Commands

| Command | What it does |
|---|---|
| `pnpm --filter @atlas/e2e e2e` | **Primary** suite against the mock-forced dev server (`DEV_MOCKS=1`). Comprehensive + deterministic. |
| `pnpm --filter @atlas/e2e e2e:smoke` | **Smoke** layer: builds the portal, boots the **real prod server** (mock-free), asserts boot + SSR + no mode badge. |
| `pnpm --filter @atlas/e2e e2e:doctor` | Launches and closes the channel browser. Run it **first** — it fails fast + legibly if the system browser is missing. |
| `pnpm --filter @atlas/e2e e2e:report` | Opens the last HTML report. |

There is **no `test` script** on purpose, so `pnpm -r test` (vitest) never spawns
a browser. E2E is always its own command.

## The system-browser channel (zero download)

Playwright drives a browser that is **already on the machine**, selected by
`use.channel`:

- **macOS** → `chrome` (Edge is not pre-installed there)
- **Windows / Linux** (incl. CI) → `msedge` (ships on the GitHub runner images)
- Override with `PW_CHANNEL`, e.g. `PW_CHANNEL=chrome pnpm --filter @atlas/e2e e2e`.

We **never** run `npx playwright install`. The download is suppressed on **both**
paths:

- **Install-time:** root `.npmrc` `playwright_skip_browser_download=1` + CI
  install-step `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` + `playwright` is not listed
  in `pnpm-workspace.yaml` `allowBuilds` (so its postinstall stays blocked).
- **Run-time:** `use.channel` points at the system browser, never a bundled one.

If `pnpm e2e:doctor` fails, install Google Chrome (macOS) / Microsoft Edge
(Windows/Linux), or set `PW_CHANNEL` to a browser you have. No Playwright browser
install is ever needed.

## Two-layer run model

- **Primary (`e2e`)** — `pnpm --filter @atlas/portal dev` with `DEV_MOCKS=1` and
  `LLM_PROVIDER=simulated`. All comprehensive/deterministic specs live in `tests/`:
  full-route smoke, the core journey, mobile (375px), degraded states, and a
  baseline-accessibility gate.
- **Smoke (`e2e:smoke`)** — the production build (`pnpm --filter @atlas/portal
  build` then `pnpm start`), **mock-free**. Specs in `smoke/` assert each top
  route returns 200, the SSR shell renders, the **mode badge is ABSENT**, and no
  JS error fires. **No** data assertions — honest-empty without creds is fine.

## The three-state dev seam (`DEV_MOCKS`)

The portal's dev runtime decides mock-vs-real with one predicate
(`portal/server/devMocks/shouldMock.ts`):

| Situation | Result |
|---|---|
| `pnpm dev`, **no** Confluence creds | **mock** — MSW fixtures (zero-config onboarding) |
| `pnpm dev` + real creds in `.env.local` | **live** — hits the real source systems |
| `DEV_MOCKS=1` | **force mock** — hermetic, ignores any local `.env.local` (the primary E2E layer uses this) |
| `DEV_MOCKS=0` | **force real** — debug the live path without full creds |
| **prod build** | the MSW plugin is never registered → always **live**, mode badge absent |

When mock is active, the top nav shows a **"Mock data"** badge — the deterministic
signal the primary suite asserts (and the smoke layer asserts is absent in prod).

### Running dev against real source systems

```bash
cp portal/.env.example portal/.env.local   # .env.local is gitignored
# fill in CONFLUENCE_BASE_URL + CONFLUENCE_TOKEN (and others as needed)
pnpm --filter @atlas/portal dev             # no DEV_MOCKS → live discovery
```

## Dynamic-route slugs are black-box-discovered

Specs never import `@atlas/context-layer`. Navigable slugs come from the rendered
UI (catalog → first service link; the "Security policies" tab → first policy;
a guidance detail → its source refs), so the suite stays decoupled from fixture
internals.

## CI

Two jobs run after the `verify` job (see `.github/workflows/ci.yml`):

- **`e2e`** — the primary suite on `ubuntu-latest` **and** `windows-latest`,
  doctor first, `PW_CHANNEL=msedge`, zero download.
- **`e2e-smoke`** — the prod-build smoke layer on `ubuntu-latest`.
