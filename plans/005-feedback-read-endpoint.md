# Plan 005: Close the feedback loop — add `GET /feedback` by target

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a8fc6b4..HEAD -- context-layer/src/api/ context-layer/src/repositories/ packages/atlas-schema/src/ portal/src/api/server/openapiDocument.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (nice-to-have: Plan 001's CI gate first)
- **Category**: direction
- **Planned at**: commit `a8fc6b4`, 2026-06-12
- **Issue**: https://github.com/Cozy228/atlas/issues/7

## Why this matters

Feedback is currently write-only: the Context API accepts `POST /feedback`
(wired end-to-end — UI form, route, in-memory and DynamoDB repositories with
query-by-target support), but nothing can read it back. Stewards have no way
to see which Sources are reported stale or broken without querying the
database by hand. Both repository implementations ALREADY expose
`findByTarget(targetType, targetId)` — the read endpoint is one thin route
away. This plan adds `GET /feedback?target_type=...&target_id=...` and
documents it in the OpenAPI surface.

## Current state

- `context-layer/src/api/feedbackRoute.ts` — exports only
  `handleFeedbackRequest(input: unknown)` (the POST handler). It uses this
  pattern (match it for the new handler):

```ts
const parsed = FeedbackSubmissionSchema.safeParse(input);
if (!parsed.success) {
  return errorResponse(400, "invalid_request", "Feedback request is invalid.");
}
const service = createDefaultContextBundleService();
// ... validateFeedbackTarget(service, parsed.data) returns 404/422 errorResponse for unknown targets
const feedback = await service.registry.feedback.put(toFeedback(parsed.data));
return { status: 201, body: { feedback } };
```

- `context-layer/src/api/httpRoute.ts:89` — dispatch:
  `if (method === "POST" && path === "/feedback") { ... }`. GET dispatches for
  other routes sit above it; query params arrive as
  `request.query` (`Record<string, string | undefined>`, see
  `compactQuery` at `httpRoute.ts:142`).
- `context-layer/src/repositories/feedbackRepository.ts:10-11` — interface:

```ts
list(): Feedback[] | Promise<Feedback[]>;
findByTarget(targetType: FeedbackTargetType, targetId: string): Feedback[] | Promise<Feedback[]>;
```

  In-memory implementation at lines 36–43; DynamoDB implementation at
  `context-layer/src/repositories/dynamoFeedbackRepository.ts:55` (`list`) and
  `:68` (`findByTarget`). Both work today — do not modify them.
- `packages/atlas-schema/src/index.ts:146` — `FeedbackResponseSchema`
  (single-item response for POST). Target types are `"topic" | "source" | "anchor"`
  (see `validateFeedbackTarget` in `feedbackRoute.ts`).
- `portal/src/api/server/openapiDocument.ts:320` — the `"/feedback"` path
  object currently documents only `post`. Line ~167 says "Every route is
  read-only except `POST /feedback`" — that sentence stays true (GET is
  read-only) and must NOT be reworded.
- Error helper: `errorResponse(status, code, message)` from
  `context-layer/src/api/routeTypes.ts`.
- Existing tests to model after: `context-layer/src/api/feedbackRoute.test.ts`
  and `context-layer/src/api/httpRoute.test.ts` (vitest).

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Install   | `pnpm install`                                       | exit 0              |
| Lint all  | `pnpm -r lint`                                       | exit 0              |
| CL tests  | `pnpm --filter @atlas/context-layer test`            | exit 0              |
| Schema    | `pnpm --filter @atlas/schema test`                   | exit 0              |
| Portal    | `pnpm --filter @atlas/portal test`                   | exit 0 (OpenAPI validator test lives here) |

## Scope

**In scope** (the only files you should modify):
- `packages/atlas-schema/src/index.ts` (add `FeedbackListResponseSchema` + type export)
- `context-layer/src/api/feedbackRoute.ts` (add `handleFeedbackListRequest`)
- `context-layer/src/api/httpRoute.ts` (add the GET dispatch)
- `context-layer/src/api/feedbackRoute.test.ts`, `context-layer/src/api/httpRoute.test.ts` (tests)
- `portal/src/api/server/openapiDocument.ts` (document `get` under `"/feedback"`)

**Out of scope** (do NOT touch):
- Both feedback repositories — `findByTarget` already exists and is tested.
- Portal UI — no feedback-insights view in this plan (deliberately deferred).
- The MCP facade (`portal/src/api/server/mcp/`) — exposing feedback to agents
  is a separate product decision.
- Aggregation/counting — return the raw list; consumers aggregate.

## Git workflow

- Branch: `advisor/005-feedback-read-endpoint`
- Commit style: conventional commits (e.g. `feat(context-layer): add GET /feedback by target`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the list-response schema

In `packages/atlas-schema/src/index.ts`, next to `FeedbackResponseSchema`
(line ~146), add a `FeedbackListResponseSchema` =
`z.object({ feedback: z.array(FeedbackSchema) })` (reuse however the existing
single-item schema references the feedback entity — read the surrounding lines
and mirror them), plus the inferred type export next to `FeedbackResponse`
(line ~304).

**Verify**: `pnpm --filter @atlas/schema lint && pnpm --filter @atlas/schema test` → exit 0.

### Step 2: Add `handleFeedbackListRequest`

In `context-layer/src/api/feedbackRoute.ts`, add and export:

```ts
export async function handleFeedbackListRequest(query: {
  target_type?: string;
  target_id?: string;
}): Promise<ApiResponse<ApiErrorResponse | FeedbackListResponse>> {
  // 1. zod-parse { target_type, target_id }: target_type must be one of
  //    "topic" | "source" | "anchor", target_id non-empty — else
  //    errorResponse(400, "invalid_request", "Feedback query is invalid.").
  // 2. const service = createDefaultContextBundleService();
  // 3. const feedback = await service.registry.feedback.findByTarget(targetType, targetId);
  // 4. return { status: 200, body: { feedback } };
}
```

Both query params are REQUIRED (no unfiltered dump of all feedback). Match the
existing handler's style: safeParse, early `errorResponse` returns.

**Verify**: `pnpm --filter @atlas/context-layer lint` → exit 0.

### Step 3: Dispatch GET /feedback in httpRoute

In `context-layer/src/api/httpRoute.ts`, alongside the POST dispatch (line ~89),
add:

```ts
if (method === "GET" && path === "/feedback") {
  return jsonResponse(await handleFeedbackListRequest(compactQuery(request.query)));
}
```

Place it ABOVE or BELOW the POST branch (order between them doesn't matter;
both guard on method). Reuse `compactQuery` like the other GET routes do.

**Verify**: `pnpm --filter @atlas/context-layer lint` → exit 0.

### Step 4: Tests

- In `feedbackRoute.test.ts`: (1) submitting feedback then listing by the same
  target returns it; (2) listing with a missing/invalid `target_type` returns
  status 400 with code `invalid_request`; (3) listing a valid-shape target with
  no feedback returns `{ feedback: [] }` with status 200.
- In `httpRoute.test.ts`: one dispatch test — `GET /feedback` with query
  params routes to the new handler (model after the existing GET dispatch
  tests in that file).

**Verify**: `pnpm --filter @atlas/context-layer test` → exit 0, new tests pass.

### Step 5: Document in OpenAPI

In `portal/src/api/server/openapiDocument.ts`, add a `get` operation to the
existing `"/feedback"` path object (line ~320): summary
"List feedback for a topic, Source, or Anchor", required query params
`target_type` (enum: topic/source/anchor) and `target_id` (string), 200
response referencing the list shape, 400 `invalid_request` error. Mirror the
structure of an existing GET operation in the same file (e.g. the
`/sources` or `/topics` entries) — including how `errorResponse(...)` doc
helper is used.

**Verify**: `pnpm --filter @atlas/portal test` → exit 0 (the portal test suite
validates the OpenAPI document with `@seriousme/openapi-schema-validator`; a
malformed entry fails here).

### Step 6: Full workspace check

**Verify**: `pnpm -r lint && pnpm -r test` → exit 0.

## Test plan

See Step 4. Pattern sources: existing cases in
`context-layer/src/api/feedbackRoute.test.ts` (target validation, 201 flow)
and `context-layer/src/api/httpRoute.test.ts` (method+path dispatch).
4 new tests minimum.

## Done criteria

- [ ] `pnpm -r lint` exits 0
- [ ] `pnpm -r test` exits 0; ≥4 new tests pass
- [ ] `command grep -n 'handleFeedbackListRequest' context-layer/src/api/httpRoute.ts` → 1 dispatch match
- [ ] `command grep -n '"get"\|get:' portal/src/api/server/openapiDocument.ts` shows a get operation under `/feedback`
- [ ] No files outside the in-scope list are modified (`git status --short`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `feedbackRoute.ts` / `httpRoute.ts` no longer match the excerpts (drift).
- `findByTarget` is missing from either repository implementation.
- The OpenAPI document's `/feedback` entry is structured differently than
  "path object with a `post` key" — report the actual shape.
- Adding the schema export breaks consumers (`pnpm -r lint` failures outside
  the in-scope files) — that means the schema package's export pattern differs
  from the assumption; report it.

## Maintenance notes

- This endpoint is unauthenticated, like every other Context API route today.
  Feedback bodies are free-text from submitters; when real (non-pilot) data
  arrives, revisit whether `GET /feedback` needs an auth gate BEFORE exposing
  the deployment publicly.
- Deferred follow-ups (separate decisions, not started here): a steward-facing
  feedback view in the portal; exposing feedback reads through the MCP facade;
  aggregation endpoints (counts by code/target).
- If pagination is ever needed (DynamoDB `findByTarget` result growth), add a
  `limit`/`cursor` pair to this route rather than changing the repository
  interface ad hoc.
