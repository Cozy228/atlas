# Plan 004: Convert Confluence network failures into `source_unavailable` warnings

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a8fc6b4..HEAD -- context-layer/src/sourceContent/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (with a security side benefit)
- **Planned at**: commit `a8fc6b4`, 2026-06-12
- **Issue**: https://github.com/Cozy228/atlas/issues/6

## Why this matters

Atlas's resolution design degrades gracefully by contract: every failure mode
is supposed to surface as a typed warning (`restricted_source`,
`source_unavailable`, `broken_anchor`) with an otherwise-valid response. The
live Confluence path honors this for HTTP status codes (401/403/404/!ok are all
handled) but NOT for transport-level failures: if `fetch` rejects (DNS failure,
timeout, connection reset) or `response.json()` throws (truncated/malformed
body), the exception propagates uncaught through the entire chain —
`confluencePageResolver` → `contextRoute` → `httpRoute` → the portal's
`contextApiBridge` — none of which has a try-catch (verified at commit
`a8fc6b4`). The consumer gets an unstructured 500 instead of the designed
warning, and the raw error risks reaching logs/clients with request context
attached. A transient Confluence blip should never 500 the Context API.

## Current state

- `context-layer/src/sourceContent/confluenceCloudContentProvider.ts:43-96` —
  the live resolution function (abridged; status codes already handled):

```ts
export async function resolveConfluencePageLive(
  request: ConfluenceLiveRequest,
  config: ConfluenceLiveConfig,
): Promise<ResolveResult> {
  const anchor = selectAnchor(request.anchors, request.anchorId);
  const locator = anchor ? selectorLocator(anchor) : undefined;

  if (!anchor || !locator || !isValidLocator(locator)) {
    return brokenAnchor(/* ... */);
  }

  const pageId = request.source.location;
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`;

  const response = await request.ctx.fetch(url, {        // ← can reject; uncaught
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    return warningResult({ code: "restricted_source", /* ... */ });
  }
  if (response.status === 404) {
    return warningResult({ code: "source_unavailable", /* ... */ });
  }
  if (!response.ok) {
    return warningResult({ code: "source_unavailable", /* ... */ });
  }

  const page = (await response.json()) as ConfluencePageResponse;  // ← can throw; uncaught
  const html = page.body?.storage?.value ?? "";
  // ...
}
```

- The file already has the helpers `warningResult(...)` and
  `brokenAnchor(...)` — reuse them; match the existing early-return style.
- Caller: `context-layer/src/resolvers/confluencePageResolver.ts:14-16` calls
  `resolveConfluencePageLive(request, { token, baseUrl })` with no try-catch
  (by design — the provider must not throw).
- Existing warning messages in this file are short, generic, declarative
  sentences, e.g. `"Confluence page was not found at request time."` Match
  that voice. Never include `error.message`, the URL, or any header content in
  a warning message.
- Tests: `context-layer/src/sourceContent/confluenceCloudContentProvider.test.ts`
  already builds fake fetches via a local `jsonFetch(body, status)` helper that
  returns `{ ok, status, async json() {...} }` and records the Authorization
  header per call. Model new tests on it.
- Test runner: vitest. `ResolveResult` shape: `{ excerpts: [...], warnings: [...] }`.

## Commands you will need

| Purpose   | Command                                                        | Expected on success |
|-----------|----------------------------------------------------------------|---------------------|
| Install   | `pnpm install`                                                 | exit 0              |
| Lint+type | `pnpm --filter @atlas/context-layer lint`                      | exit 0              |
| This test | `pnpm --filter @atlas/context-layer exec vitest run src/sourceContent/confluenceCloudContentProvider.test.ts` | all pass |
| All tests | `pnpm --filter @atlas/context-layer test`                      | exit 0 (19+ files)  |

## Scope

**In scope** (the only files you should modify):
- `context-layer/src/sourceContent/confluenceCloudContentProvider.ts`
- `context-layer/src/sourceContent/confluenceCloudContentProvider.test.ts`

**Out of scope** (do NOT touch, even though they look related):
- `context-layer/src/resolvers/confluencePageResolver.ts` — token/baseUrl
  selection logic is correct; no change needed.
- `context-layer/src/api/*` — do NOT add a blanket try-catch at the route
  layer; the design intent is typed warnings at the provider, not generic 500
  shielding above it.
- `packages/atlas-schema` — no new warning code; `source_unavailable` already
  covers "could not be resolved at request time".
- Zod-validating the full Confluence response shape — the existing optional
  chaining (`page.body?.storage?.value ?? ""`) already tolerates missing
  fields; adding a schema is deliberately deferred (see Maintenance notes).

## Git workflow

- Branch: `advisor/004-confluence-live-error-path`
- Commit style: conventional commits (e.g. `fix(context-layer): degrade Confluence transport failures to source_unavailable`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Catch transport failures around the fetch

In `resolveConfluencePageLive`, wrap ONLY the `request.ctx.fetch(...)` call:

```ts
let response: /* same type as today — infer from FetchLike return */;
try {
  response = await request.ctx.fetch(url, { /* unchanged */ });
} catch {
  return warningResult({
    code: "source_unavailable",
    message: "Confluence could not be reached at request time.",
    source_id: request.source.id,
    anchor_id: anchor.id,
  });
}
```

Do not bind or log the caught error — the message stays generic by design
(tokens/URLs must never leak into warnings).

**Verify**: `pnpm --filter @atlas/context-layer lint` → exit 0.

### Step 2: Catch body-parse failures around `response.json()`

Wrap the `await response.json()` call the same way:

```ts
let page: ConfluencePageResponse;
try {
  page = (await response.json()) as ConfluencePageResponse;
} catch {
  return warningResult({
    code: "source_unavailable",
    message: "Confluence returned an unreadable response.",
    source_id: request.source.id,
    anchor_id: anchor.id,
  });
}
```

**Verify**: `pnpm --filter @atlas/context-layer lint` → exit 0.

### Step 3: Add the two failure-mode tests

In `confluenceCloudContentProvider.test.ts`, add:

1. **fetch rejects** — a `FetchLike` that does
   `vi.fn(async () => { throw new Error("network down"); })`; expect
   `excerpts` empty and a single warning with
   `code: "source_unavailable"` and message
   `"Confluence could not be reached at request time."`.
2. **json() throws** — reuse the `jsonFetch` helper pattern but with
   `async json() { throw new Error("bad json"); }` and status 200; expect
   `code: "source_unavailable"` and message
   `"Confluence returned an unreadable response."`.

Both tests must also assert the result has NO `excerpts` and does NOT throw.

**Verify**: `pnpm --filter @atlas/context-layer exec vitest run src/sourceContent/confluenceCloudContentProvider.test.ts`
→ all pass, including 2 new tests.

### Step 4: Full context-layer suite

**Verify**: `pnpm --filter @atlas/context-layer test` → exit 0, all files pass.

## Test plan

- 2 new tests as in Step 3 (transport rejection; unreadable body), in
  `context-layer/src/sourceContent/confluenceCloudContentProvider.test.ts`,
  modeled on the existing `jsonFetch` helper and existing
  restricted/unavailable test cases in that file.
- All pre-existing tests in the file must pass unmodified.

## Done criteria

- [ ] `pnpm --filter @atlas/context-layer lint` exits 0
- [ ] `pnpm --filter @atlas/context-layer test` exits 0; 2 new tests pass
- [ ] `command grep -n 'try {' context-layer/src/sourceContent/confluenceCloudContentProvider.ts`
      shows exactly 2 try blocks (fetch + json)
- [ ] `command grep -n 'error\.' context-layer/src/sourceContent/confluenceCloudContentProvider.ts`
      returns no matches (no error details leak into warnings)
- [ ] No files outside the in-scope list are modified (`git status --short`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The function no longer matches the "Current state" excerpt (drift).
- The `warningResult` / `brokenAnchor` helpers don't exist or have a different
  signature than the existing call sites imply.
- Any existing test in the file fails BEFORE your change.
- Fixing this seems to require touching `resolverTypes.ts` (the `FetchLike`
  type) — it shouldn't; report instead.

## Maintenance notes

- Deferred on purpose: zod-validating `ConfluencePageResponse`. The optional
  chaining handles missing fields; a schema adds value only if Confluence API
  v2 drift becomes a real problem. Revisit if `extractSectionText` ever gains
  failure modes beyond "section not found".
- If a retry/backoff layer is ever added to `ctx.fetch`, these catches stay
  correct — they only see the final failure.
- Reviewer should scrutinize: warning messages must remain generic (no
  interpolated error text), and the 401/403 → `restricted_source` branch must
  remain ABOVE the new catch logic untouched.
