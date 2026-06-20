# Plan 003: Make the Ask Atlas "daily" rate limiter actually reset daily

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a8fc6b4..HEAD -- portal/src/ask/askAtlas.ts portal/src/ask/askAtlas.test.ts portal/src/api/server/ask.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (run after Plan 001 so CI guards the change, but not required)
- **Category**: bug
- **Planned at**: commit `a8fc6b4`, 2026-06-12
- **Issue**: https://github.com/Cozy228/atlas/issues/5

## Why this matters

`createDailyRateLimiter` never resets its counters: once a key reaches the
limit it is blocked for the lifetime of the server process, not for a day.
Compounding it, the Ask endpoint passes the hardcoded key `"anonymous"` for
every caller, so ALL users share one bucket. Net effect: after 100 Ask Atlas
questions total (across everyone), the feature is permanently bricked until the
server restarts. This plan fixes the missing daily reset. (Per-caller identity
is intentionally NOT in scope — there is no auth in the portal yet; see
Maintenance notes.)

## Current state

- `portal/src/ask/askAtlas.ts:113-125` — the limiter:

```ts
export function createDailyRateLimiter(maxRequests: number): RateLimiter {
  const counts = new Map<string, number>();

  return {
    consume(userId: string): void {
      const count = counts.get(userId) ?? 0;
      if (count >= maxRequests) {
        throw new Error("Ask Atlas daily limit exceeded.");
      }
      counts.set(userId, count + 1);
    },
  };
}
```

- `portal/src/api/server/ask.ts:32` — a single module-level instance:
  `const rateLimiter = createDailyRateLimiter(100);`
- `portal/src/api/server/ask.ts:45` — `userId: "anonymous"` hardcoded.
- `portal/src/api/server/ask.ts:83-88` — the limit error is caught by exact
  message match: `error.message === "Ask Atlas daily limit exceeded."` and
  converted to `warnings: ["rate-limit-exceeded"]`. DO NOT change the error
  message string.
- `consume` is called at `portal/src/ask/askAtlas.ts:98`
  (`input.rateLimiter.consume(input.userId);`) — synchronously, so there is no
  concurrency race to fix (Node single thread, no await between check and set).
- Existing tests: `portal/src/ask/askAtlas.test.ts` — see
  `it("enforces Portal-owned daily rate limits", ...)` (~line 133), which
  creates `createDailyRateLimiter(1)` and expects the second call to reject.
  Tests use vitest (`describe/it/expect/vi`).

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Install   | `pnpm install`                                       | exit 0              |
| Lint+type | `pnpm --filter @atlas/portal lint`                   | exit 0              |
| This test | `pnpm --filter @atlas/portal exec vitest run src/ask/askAtlas.test.ts` | all pass |
| All tests | `pnpm --filter @atlas/portal test`                   | exit 0, all pass    |

## Scope

**In scope** (the only files you should modify):
- `portal/src/ask/askAtlas.ts` (the `createDailyRateLimiter` function only)
- `portal/src/ask/askAtlas.test.ts` (add reset-behavior tests)

**Out of scope** (do NOT touch, even though they look related):
- `portal/src/api/server/ask.ts` — the hardcoded `"anonymous"` userId stays;
  deriving real caller identity needs an auth decision the maintainer hasn't
  made. Changing the public error-handling contract there is also off-limits.
- The `RateLimiter` interface shape consumed by `askAtlas` — `consume(userId)`
  throwing on limit is the contract; keep it.

## Git workflow

- Branch: `advisor/003-rate-limiter-daily-reset`
- Commit style: conventional commits (e.g. `fix(portal): reset Ask Atlas rate limiter daily`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the daily reset

Rewrite `createDailyRateLimiter` in `portal/src/ask/askAtlas.ts` to bucket by
UTC day and clear counters when the day changes. Target shape:

```ts
const DAY_MS = 86_400_000;

export function createDailyRateLimiter(maxRequests: number): RateLimiter {
  const counts = new Map<string, number>();
  let currentDay = Math.floor(Date.now() / DAY_MS);

  return {
    consume(userId: string): void {
      const day = Math.floor(Date.now() / DAY_MS);
      if (day !== currentDay) {
        currentDay = day;
        counts.clear();
      }
      const count = counts.get(userId) ?? 0;
      if (count >= maxRequests) {
        throw new Error("Ask Atlas daily limit exceeded.");
      }
      counts.set(userId, count + 1);
    },
  };
}
```

Keep the exported name, signature, and the exact error message unchanged.
Note `counts.clear()` on day rollover also bounds memory — no separate pruning
needed.

**Verify**: `pnpm --filter @atlas/portal lint` → exit 0.

### Step 2: Add tests for the reset behavior

In `portal/src/ask/askAtlas.test.ts`, next to the existing rate-limit test,
add a test using vitest fake timers:

- `vi.useFakeTimers()` + `vi.setSystemTime(...)`; create
  `createDailyRateLimiter(1)`; consume once (ok), second consume throws;
  advance time by 24h+ (`vi.setSystemTime(start + 86_400_000 + 1)` or
  `vi.advanceTimersByTime`); consume succeeds again.
- A second case: two different userIds each get their own count within the
  same day (consume("a") at limit does not block consume("b")).
- Restore real timers in `afterEach` or at test end (`vi.useRealTimers()`).

Model the test structure after the existing
`it("enforces Portal-owned daily rate limits", ...)` block.

**Verify**: `pnpm --filter @atlas/portal exec vitest run src/ask/askAtlas.test.ts`
→ all pass, including 2 new tests.

### Step 3: Full portal suite

**Verify**: `pnpm --filter @atlas/portal test` → exit 0, all pass.

## Test plan

- New tests in `portal/src/ask/askAtlas.test.ts`:
  1. limit resets after the UTC day rolls over (fake timers),
  2. independent counters per userId within a day.
- Existing rate-limit test must keep passing unmodified.
- Verification: `pnpm --filter @atlas/portal test` → exit 0.

## Done criteria

- [ ] `pnpm --filter @atlas/portal lint` exits 0
- [ ] `pnpm --filter @atlas/portal test` exits 0; the 2 new tests exist and pass
- [ ] The string `"Ask Atlas daily limit exceeded."` still appears exactly once
      in `portal/src/ask/askAtlas.ts` and is still matched in
      `portal/src/api/server/ask.ts` (unchanged file)
- [ ] No files outside the in-scope list are modified (`git status --short`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `createDailyRateLimiter` no longer matches the excerpt above (drift).
- The existing rate-limit test fails BEFORE your change.
- You find yourself wanting to modify `portal/src/api/server/ask.ts` — that
  means the approach drifted out of scope.

## Maintenance notes

- Deliberately deferred: per-caller identity. All callers still share the
  `"anonymous"` bucket, so the global daily quota (100) remains a shared pool.
  When portal auth lands (see `CONTEXT.md` "Caller identity"), pass a real
  user key at `portal/src/api/server/ask.ts:45` — the limiter then needs no
  further change.
- This limiter is per-process memory. If the portal ever runs multi-instance,
  limits apply per instance; a shared store would be needed for a true global
  quota. Not worth building now.
