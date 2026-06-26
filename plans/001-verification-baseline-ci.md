# Plan 001: Add a one-command verification gate and GitHub Actions CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a8fc6b4..HEAD -- package.json .github/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `a8fc6b4`, 2026-06-12
- **Issue**: https://github.com/Cozy228/atlas/issues/3

## Why this matters

The repo has no CI at all (no `.github/` directory exists) and no single
command that answers "does the codebase work?". Contributors must remember to
run three separate recursive scripts. Because Atlas is a context layer that
agents and automations will consume, a silent regression in the resolve
pipeline or the schema package would propagate to every consumer. As of
2026-06-12 the full suite passes quickly (`pnpm -r test`: 49 test files, ~5s
total; `pnpm -r lint` also passes), so adding a gate is cheap and exposes no
pre-existing failures.

## Current state

- `package.json` (repo root) — workspace scripts:

```json
"scripts": {
  "lint": "pnpm -r lint",
  "typecheck": "pnpm -r typecheck",
  "test": "pnpm -r test"
},
```

- Root `packageManager` field is `"pnpm@11.5.0"`.
- Every workspace package's `lint` script already runs `tsc --noEmit --pretty false`
  (portal additionally runs `oxlint` first: `"lint": "oxlint && tsc --noEmit --pretty false"`).
  Therefore `pnpm -r lint` is a superset of `pnpm -r typecheck` — the verify
  script below intentionally runs only `lint` + `test`.
- `.github/` does not exist anywhere in the repo.
- The portal `build` script runs a generator first
  (`node scripts/gen-agent-skills-index.mjs && vite build`) — building is NOT
  part of this plan's CI job; keep CI to lint + test.
- Node version: no `engines` field exists. Use Node 22 in CI (Vite 8 requires
  Node ≥ 20.19; `@types/node` is v25 but that does not constrain the runtime).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Lint+type | `pnpm -r lint`           | exit 0              |
| Tests     | `pnpm -r test`           | exit 0, all pass    |
| New gate  | `pnpm verify`            | exit 0 (after Step 1) |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (repo root — add one script line only)
- `.github/workflows/ci.yml` (create)

**Out of scope** (do NOT touch):
- Any workspace package's `package.json` — their scripts already work.
- Pre-commit hooks / husky — explicitly deferred; not part of this plan.
- Build/deploy steps in CI — the portal build invokes a generator and is a
  separate concern; CI here is lint + test only.

## Git workflow

- Branch: `advisor/001-verification-baseline-ci`
- Commit style: conventional commits, matching the repo's history
  (e.g. `chore: add verify script and GitHub Actions CI` — compare
  `chore(portal): regenerate route tree + update prototype notes` in `git log`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a root `verify` script

In the root `package.json`, add to `scripts`:

```json
"verify": "pnpm -r lint && pnpm -r test"
```

Keep the existing `lint`/`typecheck`/`test` entries unchanged.

**Verify**: `pnpm verify` → exit 0; output shows lint then test runs for
`portal`, `context-layer`, `packages/atlas-schema`, `packages/atlas-acceptance`,
`packages/azure-react-icons`, `infra`.

### Step 2: Create the CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify
```

Notes: `pnpm/action-setup@v4` reads the pnpm version from the root
`packageManager` field — do not hardcode a version.

**Verify**: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/ci.yml','utf8');if(!/pnpm verify/.test(s))process.exit(1)"` → exit 0.

### Step 3: Confirm the working tree contains only in-scope changes

**Verify**: `git status --short` → only `package.json` modified and
`.github/workflows/ci.yml` added (plus the `plans/README.md` status update).

## Test plan

No new tests — this plan adds the gate that runs the existing 49 test files.
Verification IS the test: `pnpm verify` must exit 0 locally.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm verify` exits 0
- [ ] `.github/workflows/ci.yml` exists and contains `pnpm verify`
- [ ] Root `package.json` diff adds exactly one script line
- [ ] No files outside the in-scope list are modified (`git status --short`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm -r lint` or `pnpm -r test` fails BEFORE you make any change — the
  baseline has regressed since 2026-06-12 and fixing it is not in scope.
- The root `package.json` scripts block no longer matches the excerpt above.
- You find an existing CI config anywhere (`.github/`, `.gitlab-ci.yml`,
  `vercel.json` with checks) — reconcile instead of duplicating.

## Maintenance notes

- When the portal build is added to CI later, remember it needs
  `node scripts/gen-agent-skills-index.mjs` (already chained inside
  `pnpm --filter @atlas/portal build`).
- The `verify` script deliberately skips `pnpm -r typecheck` because every
  package's `lint` already includes `tsc --noEmit`. If a package ever changes
  its `lint` script to drop tsc, add `pnpm -r typecheck` back into `verify`.
- Follow-up explicitly deferred: pre-commit hooks (husky/lint-staged), CI
  build job, branch protection rules (repo-settings change, not code).
