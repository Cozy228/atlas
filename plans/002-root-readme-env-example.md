# Plan 002: Write a root README and document every environment variable

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a8fc6b4..HEAD -- README.md portal/.env.example portal/src/api/server/llmProvider.ts portal/src/api/server/httpContextApiClient.ts context-layer/src/resolvers/confluencePageResolver.ts context-layer/src/services/contextBundleService.ts`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" facts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `a8fc6b4`, 2026-06-12
- **Issue**: https://github.com/Cozy228/atlas/issues/4

## Why this matters

There is no `README.md` at the repo root (only `AGENTS.md`, `CONTEXT.md`,
`DESIGN.md`, `PRODUCT.md`, which are agent/domain/product docs, not setup
guides) and no `.env.example` anywhere. The environment variables that switch
major behaviors (live Confluence resolution vs offline pilot data, Bedrock vs
OpenAI-compatible LLM provider, DynamoDB vs in-memory feedback) are discoverable
only by reading source. A new contributor — or a CI/deploy environment — cannot
be configured without spelunking.

## Current state

The complete env-var inventory, verified by grep at commit `a8fc6b4`
(these are ALL the `env.*` reads in runtime code — do not invent others):

| Variable | Read at | Effect |
|---|---|---|
| `ATLAS_CONTEXT_API_BASE_URL` | `portal/src/api/server/httpContextApiClient.ts:30` | Optional. When set, the Portal calls a remote Context API over HTTP; when unset, requests are served by the in-process bridge (`portal/src/api/server/contextApiBridge.ts`). |
| `ATLAS_LLM_PROVIDER` | `portal/src/api/server/llmProvider.ts:17` | Optional selector: `"bedrock"` or `"rai"`. When unset, provider is inferred from which model-id var is present. |
| `ATLAS_BEDROCK_MODEL_ID` | `llmProvider.ts:20` | Required when provider is bedrock. |
| `ATLAS_BEDROCK_REGION` / `AWS_REGION` | `llmProvider.ts:23` | Bedrock region (falls back to `AWS_REGION`; AWS SDK default credential chain applies). |
| `RAI_BASE_URL`, `RAI_TOKEN_URL`, `RAI_CLIENT_ID`, `RAI_CLIENT_SECRET`, `RAI_MODEL_ID` | `llmProvider.ts:30-34` | All required when provider is `rai` (OpenAI-compatible gateway). |
| `ATLAS_CONFLUENCE_TOKEN` | `context-layer/src/resolvers/confluencePageResolver.ts:11` | Optional service-token fallback for the Bearer pipe (see `CONTEXT.md` "Service-token fallback"). |
| `ATLAS_CONFLUENCE_BASE_URL` | `confluencePageResolver.ts:12` | Required (together with a token) to enable LIVE Confluence resolution; when either is missing, resolution falls back to the offline pilot map. |
| `ATLAS_FEEDBACK_TABLE` | `context-layer/src/services/contextBundleService.ts:63` | Optional. When set, feedback persists to that DynamoDB table; when unset, an in-memory repository is used. |

Other facts:

- Monorepo layout: `portal/` (TanStack Start UI + Nitro server routes that also
  serve the Context API, `/mcp`, `/openapi.json`, `llms.txt`),
  `context-layer/` (Context API core, Lambda build via tsdown),
  `packages/atlas-schema` (zod contracts), `packages/atlas-acceptance`,
  `packages/azure-react-icons`, `infra/`.
- Entry point for development: `pnpm --filter @atlas/portal dev` (vite dev).
- Repo rule (from `CLAUDE.md`): everything must be public-safe — the
  `.env.example` must contain ONLY placeholder values like
  `your-token-here` / `https://example.atlassian.net`, never real hosts or
  credentials.
- Vite loads `.env` files from the package directory, so the example file
  lives at `portal/.env.example` (the Context API runs in-process inside the
  portal dev server, so context-layer vars belong in the same file).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Lint+type | `pnpm -r lint`           | exit 0              |
| Tests     | `pnpm -r test`           | exit 0, all pass    |

## Scope

**In scope** (the only files you should create/modify):
- `README.md` (repo root — create)
- `portal/.env.example` (create)

**Out of scope** (do NOT touch):
- `AGENTS.md`, `CONTEXT.md`, `DESIGN.md`, `PRODUCT.md` — different registers,
  owned by the maintainer.
- Any source code. This plan is documentation only.
- `.gitignore` — verify `.env` is already ignored before assuming; if `.env`
  is NOT ignored, note it in your report instead of editing.

## Git workflow

- Branch: `advisor/002-root-readme-env-example`
- Commit style: conventional commits (e.g. `docs: add root README and portal .env.example`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `portal/.env.example`

One entry per variable from the table above, grouped with comments:
`# Context API`, `# Ask Atlas LLM provider (pick one)`, `# Confluence live resolution`,
`# Feedback persistence`. Every value a placeholder. State in a header comment
that all vars are optional for local dev (the app falls back to in-process
bridge + offline pilot data + in-memory feedback; Ask Atlas requires one LLM
provider to be configured).

**Verify**: `command grep -c 'ATLAS_' portal/.env.example` → ≥ 6.

### Step 2: Create root `README.md`

Sections, in order:
1. **What is Atlas** — 2 short paragraphs; source them from `PRODUCT.md`
   ("Product Purpose") and `CONTEXT.md` (first paragraph). Do not restate the
   whole glossary; link to `CONTEXT.md`.
2. **Repository layout** — the monorepo table from "Current state" above.
3. **Quick start** — `pnpm install`, then `pnpm --filter @atlas/portal dev`;
   note Node ≥ 22 and pnpm 11 (`packageManager` field).
4. **Verification** — `pnpm verify` if Plan 001 has landed (check
   `package.json` for the script); otherwise `pnpm -r lint && pnpm -r test`.
5. **Environment variables** — copy the table from "Current state", and point
   to `portal/.env.example`.
6. **Further reading** — link `CONTEXT.md`, `PRODUCT.md`, `DESIGN.md`,
   `docs/adr/`.

**Verify**: `command grep -c 'ATLAS_CONFLUENCE_BASE_URL' README.md` → ≥ 1.

### Step 3: Confirm nothing else changed

**Verify**: `git status --short` → only `README.md` and `portal/.env.example`
added (plus the `plans/README.md` status update).

## Test plan

Documentation-only; no new tests. Run `pnpm -r lint` once to prove no source
file was touched accidentally → exit 0.

## Done criteria

- [ ] `README.md` exists at repo root with the 6 sections above
- [ ] `portal/.env.example` exists, placeholders only, covers all 8+ variables
- [ ] `command grep -rn 'atlassian.net' README.md portal/.env.example` returns only
      `example.atlassian.net` style placeholders (public-safe check)
- [ ] `pnpm -r lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status --short`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A root `README.md` already exists (someone wrote one since this plan).
- You find env-var reads in runtime code beyond the table above (the inventory
  has drifted) — report the new vars rather than guessing their semantics.
- Any value you are about to write looks like a real hostname, company name,
  or credential rather than a placeholder.

## Maintenance notes

- The env table must be updated whenever a new `env.*` read lands; reviewers
  should grep `process.env\.|env\.ATLAS_|env\.RAI_` on PRs touching
  `portal/src/api/server/` or `context-layer/src/`.
- Deferred: a `docs/`-level deployment guide (Lambda + portal hosting) — out
  of scope until the deployment story stabilizes.
