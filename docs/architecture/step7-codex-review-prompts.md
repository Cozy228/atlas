---
status: active
review_after: 2026-07-27
---

# Step 7 — deferred Codex review prompts

Execution-arrangement change (owner instruction, 2026-07-07): the goal prompt's
dual-track build (Opus + Codex building independently) is replaced by
**single-track Opus build + Fable review**, with **Codex as a deferred heterogeneous
reviewer**. This file holds the ready-to-run prompts for that review pass. Run each
prompt with `codex exec` (gpt-5.5, medium) from the repo root at the commit noted,
or all at once with the combined prompt at the end. Absorb verdicts into
`implementation-notes-step7.md`, then archive this file (/gc).

Reference commits (fill in as batches land):

| Batch | Scope | Commit |
|---|---|---|
| 0 | frozen D1–D11 suite + stubs | `8a62f176` |
| 1 | registration store + routes + infra (D1/D3/D11) | `0b880bfe` |
| 2 | location index (D2) | `df30ebc4` |
| 3 | authMode + SSRF composition + TFE adapter (D4/D5) | `aba2bd00` |
| 4 | status board aggregation-at-read (D6/D7) | `4e356d73` |
| 5 | debug floor + /api/status + portal UI (D8/D9/D10/D12) | `be57915c` |

## Shared preamble (prepend to every prompt below)

> You are a heterogeneous second-opinion reviewer for Atlas Step 7 (status board +
> self-service registration). Authority order: `docs/architecture/goal_prompt_step7_status_board.md`
> (locked decisions + DoD) > `docs/architecture/implementation-plan.md` §7 >
> `docs/architecture/mid-level-design.md` M12/M7/M3 > ADR-0003. Read
> `docs/architecture/implementation-notes-step7.md` for the builder's own deviation
> log — verify its claims, don't trust them. Review the diff of the commit(s) named
> below. Report findings as: severity (blocker/major/minor), file:line, what breaks,
> concrete failure scenario. Do NOT fix anything. Chinese prose, English code refs.
> Hard lines you must actively try to break:
> 1. ADR-0003: a fetched value is uncited operational status — never in `evidence[]`,
>    never persisted, visually separated. Hunt for any path where a value reaches a
>    durable store or a citation rides a value.
> 2. M12/SSRF: value fetches compose ONLY the adapter's allowlisted base; the
>    registered `url` must never become a fetch target. Try to construct a
>    registration that steers a request.
> 3. No secret anywhere: registration schema strict, no token field, no credential
>    persisted, no secret in logs.
> 4. Frozen-suite integrity: no test edited/weakened/skipped vs `8a62f176`
>    (`git diff 8a62f176 -- '**/*.test.ts' '**/*.spec.ts'` must be empty or
>    justified in the notes).

## Batch 0 review (suite quality)

> Review commit `8a62f176` (the frozen Batch-0 suite). Question the SUITE, not an
> implementation: (a) which locked decision or DoD row has NO test teeth (a builder
> could satisfy the letter of the tests while violating the decision)? (b) are the
> SSRF assertions in `adapter.authMode.test.ts` sufficient — what bypass would they
> miss (path traversal in the derived path, base with trailing slash tricks,
> protocol-relative)? (c) does `statusBoard.noStore.test.ts` actually prove
> "no value reaches any store" — what write path is NOT spied (Valkey snapshot
> store, events, pino transport, Dynamo direct client)? (d) is the D1 test's
> `safeParse.success` style strong enough to pin `.strict()`?

## Batch 1 review (registration store + routes + infra)

> Review the Batch-1 commit (see table). Focus: (a) the locations repository trio
> vs the apps precedent — key schema (`pk=LOC#<id>`, `gsi1pk=APP#<appId>`), prod
> fail-fast, factory parity; any drift from `appsRepository`'s contract semantics?
> (b) route governance: owning APP from `ctx.scope.appId` only — can a body or query
> smuggle a different appId? Is the token-in-body 400 produced by the schema
> (`.strict()`) or by hand-rolled filtering (the rejected shape)? (c) mutation
> logging: pino on every write, no secret/URL-credential in the log line?
> (d) infra: Dynamo table + IAM `/index/*` + `LOCATIONS_TABLE` env — least-privilege
> parity with the apps table, table doc accurate? (e) zod schemas: all six real,
> `.strict()`, value-side has NO citation field by construction?

## Batch 2 review (location index)

> Review the Batch-2 commit. Focus: (a) `deriveLocationIndex` reads the graph through
> the ONE snapshot path (`serveRootSnapshots`/`deriveRequestGraph`) — any second
> parse/discovery path introduced? (b) provenance: graph-derived pointers carry real
> `discoveredFrom` provenance, registered ones are `"registration"` — can the two be
> confused? (c) scoping: does the index leak another APP's registrations into scope?

## Batch 3 review (authMode + SSRF + TFE adapter)

> Review the Batch-3 commit. This is the security-critical batch — attack it:
> (a) `composeValueUrl`: can ANY location field (id, kind, url, system) steer the
> composed URL off the allowlisted base (`..`, `//`, `@`, absolute URL in id,
> URL-encoding)? (b) does anything anywhere fetch `location.url`? (c) TFE adapter:
> is `TFE_STATUS_TOKEN` read at fetch time from env only, never persisted/logged/
> echoed in errors? Missing token ⇒ labeled pointer (not a throw)? (d) `caller-bearer`
> plumbing: is `ctx.token` threaded only to caller-bearer adapters and never logged?
> (e) closed set: can a new authMode value slip in without a type error?

## Batch 4 review (status board aggregation-at-read)

> Review the Batch-4 commit. Focus: (a) P24: any durable store touched during board
> assembly (including caches — is a value memoized anywhere beyond the request)?
> (b) degradation honesty: fetch failure/timeouts ⇒ labeled pointer with a closed-set
> reason, never a stale/fabricated value; is there a retry/cache that could serve a
> stale value as live? (c) concurrency: per-location fetch isolation (one adapter
> failure doesn't poison the board)? (d) the `LocationStatusEntry` invariants:
> value xor reason, `fetchedAt` null iff pointer?

## Batch 5 review (debug floor + /api/status + portal UI)

> Review the Batch-5 commit(s). Focus: (a) M7/P18: the debug brief = cited Evidence
> + location floor; is `explain_error` a THIN wrap over the same assembly (no second
> path)? No server-side free-text error interpretation (P12/P15)? (b) `/api/status`
> governance: required ctx, scope filtering, caller-bearer token threading; in-process
> ≡ HTTP faces? (c) portal: uncited values visually separated from Evidence (a
> distinct register, not a caption — ADR-0003); degraded states are the PRIMARY
> designed states; DeferredRegion + skeletons (no blocking loader); a11y — zero new
> serious/critical axe violations, ≥4.5:1 contrast light AND dark? (d) e2e spec
> `status-board.spec.ts` satisfied without test edits?

## Combined final prompt (run once at step close if per-batch runs didn't happen)

> Review the full Step 7 range `8a62f176..<step-7-final>` against the four hard
> lines in the preamble plus every per-batch focus above. Prioritize: SSRF
> composition, value-persistence leaks, secret handling, frozen-suite integrity,
> in-process ≡ HTTP parity, ADR-0003 visual separation. Deliver a ranked findings
> list; empty sections are fine — do not manufacture findings.
