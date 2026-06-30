# Atlas

Atlas is a **governed context layer** for a cloud platform: it registers, validates, and
serves authoritative source excerpts **with citations**. The source systems (Confluence
spaces, Terraform module registries, policy documents) remain the system of record — Atlas
discovers and projects from them at request time and **never mirrors them durably**. The
portal is the self-service catalog application teams open mid-task to find which service to
adopt, whether it is available in their landing zone, and what governance applies.

This repo is a **pnpm workspace** (monorepo). The portal is a TanStack Start + React 19 app
(Vite 8 / Nitro); the context layer is framework-agnostic domain logic consumed through the
Portal server-side Context API boundary.

## Repository layout

| Path | Package | What it is |
|---|---|---|
| `portal/` | `@atlas/portal` | The web app — SSR portal UI (TanStack Start/Router, React 19, Vite 8 + Nitro, Tailwind v4). Dev server on **:3000**. |
| `context-layer/` | `@atlas/context-layer` | Governed context domain: source discovery + live resolution + projections; consumed by server-side Context API routes. Dev/integration source-system mocks live in `src/devMocks/` (MSW, Node mode). |
| `packages/atlas-schema/` | `@atlas/schema` | Shared schema + types across portal and context layer. |
| `packages/atlas-e2e/` | `@atlas/e2e` | End-to-end browser tests (Playwright, zero browser download). See [`packages/atlas-e2e/README.md`](packages/atlas-e2e/README.md). |
| `packages/atlas-acceptance/` | `@atlas/acceptance` | Acceptance / black-box agent-discovery checks. |
| `packages/azure-react-icons/` | `azure-react-icons` | Generated Azure service-icon React components. |
| `infra/` | `@atlas/infra` | Deployment / infrastructure config. |
| `plans/`, `docs/` | — | Implementation plans and architecture/product notes. |

## Getting started

Prerequisites: **Node 22** and **pnpm** (pinned via `packageManager`; `corepack enable` will
provision it).

```bash
pnpm install                      # install the whole workspace (frozen in CI)
pnpm --filter @atlas/portal dev   # run the portal at http://localhost:3000
```

### Dev data: mock vs live

The portal dev runtime serves either deterministic **MSW fixtures** or **live** source
systems, decided once at boot (`portal/server/devMocks/shouldMock.ts`):

- **No Confluence creds set → auto-mock** (zero-config onboarding). A **“Mock data”** badge
  shows in the top nav.
- **Real Confluence creds in `.env.local` → live** discovery against the real systems.
- `DEV_MOCKS=1` forces mock (hermetic; the E2E suite uses this); `DEV_MOCKS=0` forces live.

Copy the template and fill values only when you want live: `cp portal/.env.example
portal/.env.local`. The template ships commented-out, so a fresh copy stays in mock mode.

## Common tasks

Run from the repo root (each fans out across the workspace):

```bash
pnpm typecheck     # pnpm -r typecheck
pnpm lint          # pnpm -r lint
pnpm test          # pnpm -r test  (unit tests, Vitest; no browser)
```

Portal-specific:

```bash
pnpm --filter @atlas/portal build   # gen agent-skills index, then vite production build
pnpm --filter @atlas/portal start   # run the built prod server (.output)
```

## Testing

- **Unit / integration** — Vitest, per package (`pnpm -r test`). Context-layer tests drive
  the source systems through in-process MSW fixtures.
- **End-to-end (browser)** — `@atlas/e2e`, Playwright against an **already-installed system
  browser** (Chrome on macOS, Edge on CI) — it never downloads Chromium. Full guide:
  [`packages/atlas-e2e/README.md`](packages/atlas-e2e/README.md).

  ```bash
  pnpm --filter @atlas/e2e e2e:doctor   # prove the system browser launches (run this first)
  pnpm --filter @atlas/e2e e2e          # primary layer: mock-forced dev server
  pnpm --filter @atlas/e2e e2e:smoke    # build the portal, then smoke the prod server
  ```

CI (`.github/workflows/ci.yml`): a `verify` job (typecheck + lint + test + builds), then an
`e2e` matrix (ubuntu + windows) and an ubuntu `e2e-smoke` prod-build job.

## Documentation

- [`AGENTS.md`](AGENTS.md) — working agreement for humans and AI agents (skill loading +
  engineering guidelines). Equivalent content in [`CLAUDE.md`](CLAUDE.md).
- [`CONTEXT.md`](CONTEXT.md) — domain language and the context-layer model (start here for
  terminology).
- [`PRODUCT.md`](PRODUCT.md) — product intent and users.
- [`DESIGN.md`](DESIGN.md) — the “Blueprint” design system (tokens, layout rules).
- [`plans/`](plans/) — implementation plans; [`docs/`](docs/) — architecture notes.

> Everything in this repository is meant to be public-safe: generic platform logic, UI
> prototypes, mocks, and interfaces only — no company-specific code, credentials, or data.
