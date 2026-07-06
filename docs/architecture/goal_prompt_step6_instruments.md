---
status: active
review_after: 2026-07-27
---

# Goal Prompt: Step 6 — Honesty Instruments (P16/P20/P22/P28, mid-level §7)

> **Status: ratified (owner, 2026-07-06 — "三个问题按你的推荐来").** Execution
> arrangement: single-build (Opus) + Fable/Codex adversarial review, same as Step 5 —
> the surface is instrumentation call-sites + one internal read surface, not a new
> engine. The three open questions below are RESOLVED per the reviewer's
> recommendations; see the answers inline at the end.

Implement implementation-plan.md **Step 6**: the six honesty metrics — **time-to-brief**,
**time-to-verify** (P28 verification tax), **per-block unresolved rate grouped by missing
source** (the negotiation queue, P16/P22), **tokens-per-brief by depth tier** (P28 token
economy), **change-feed event volume by class**, **agent call share** (P20) — surfaced on
an internal dashboard read over the existing pino/observability arc. Loop until the
Definition of Done is green.

Read `docs/architecture/implementation-plan.md` (§7 Step 6, §5 row F),
`docs/architecture/mid-level-design.md` (§7 Observability, §10 M9),
`docs/architecture/direction-decision-log.md` (P16, P20, P22, P23, P28) before starting.
This prompt is the executable distillation; on conflict those documents win.

> Layout ruling (inherited from Steps 1–5): everything lands in `context-layer`,
> `@atlas/schema`, and existing portal files, plainly named — no new workspace package, no
> design-doc layer names in code. The product word for this surface is **instruments**.

## Goal

After this step, **the product measures its own honesty and the measurements drive
supply**: the dashboard answers "which source do we negotiate next" from data (P16/P22),
Track B consumes it directly, and the two P20/P28 cost metrics (agent call share,
tokens-per-brief) exist from the first agent adoption rather than being retrofitted.

## Current-tree facts (verified at `c79018f`, 2026-07-06 — re-verify at HEAD)

- **The per-brief pino signal already exists and is the anchor**:
  `context-layer/src/briefs/assembleBrief.ts:73-86` logs `{ moment, landingZoneIds,
  appId?, blocks[{id,status,landingZoneId?}], durationMs }` on `logger("briefs")`, with a
  comment naming Step 6 as its reader. **No depth field, no payload-size field, no
  per-block warning codes in the log** (codes exist on the block objects; only status is
  logged).
- **Per-block unresolved data is fully representable today**: `resolveBlock`
  (assembleBrief.ts:97-211) yields `status: unresolved|partial|available` +
  `ResourceWarning[]` codes; `missingSections[].code` originates in
  `resources/resourceContextService.ts:246-251`. Closed `warningCodes` vocabulary at
  `packages/atlas-schema/src/index.ts:24-47` (12 codes incl. `no_registered_source`,
  `source_unavailable`). "Grouped by missing source" = group by (warning code × subject
  source), all data in hand at the assembly call-site.
- **Depth tiers**: `briefDepths = ["citations","excerpts"]`
  (packages/atlas-schema/src/index.ts:1123). Defaults differ by face on purpose (M9): API
  `citations` (briefsRoute.ts:64), portal loader `excerpts`
  (portal/src/api/server/contextApi.ts:149), MCP states `citations`
  (mcp/tools.ts:240-244). **No acceptance test asserts the tiers** — grep "depth" in
  `packages/atlas-acceptance/src/` = 0 (P28 says it IS an acceptance property).
- **No token/size observation exists anywhere** in the brief path; there is **no LLM call**
  in brief assembly (Ask-LLM is a dormant scaffold). "Tokens-per-brief" therefore means
  the **serialized response payload cost to the calling agent**, not model usage.
- **No call-channel attribution exists**: MCP (`portal/server/routes/mcp.ts` →
  mcp/handler.ts), HTTP API (`portal/server/routes/api/[...].ts` → contextApiBridge), and
  portal in-process loaders (`inProcessContextApi.ts:134-145`) are distinguishable only by
  entry file; `ctx` carries no channel field and no log field says who called (collector
  verified). P20's "agent call share" has nothing to aggregate on today.
- **Change-feed class counts are derivable at read**: `ChangeEvent.class` (7-value closed
  enum, schema :1011-1019) sits in the events store; `handleChangesRequest`
  (changesRoute.ts:76-96) reads it but logs nothing; `refreshGraphSnapshots.ts:101-104`
  logs only a total event count. No aggregation-by-class exists.
- **Logging arc**: `logger(channel)` memoized pino children
  (observability/logging.ts:66-69); 9 channels in use (`discovery, graph, cache, resolve,
  confluence, apps, ask, briefs, fetch`); `withResolverLogging`/`withFetchLogging` wrap
  timing. LOG_LEVEL leveled, prod=info.
- **No internal dashboard precedent**: no admin/internal UI route exists; the only
  `internal/` path is `portal/server/routes/api/internal/openapi.json.ts` (a JSON doc
  endpoint) — that is the precedent for an internal read endpoint. Portal routes are
  TanStack flat files under `portal/src/routes/`.

## Locked decisions (proposed — ratify or amend)

1. **One write point per signal: the metrics registry is fed at the SAME call-sites that
   log.** A small in-process registry (plain code in
   `context-layer/src/observability/metrics.ts`: named counters with label dimensions +
   duration histograms with fixed buckets; no Prometheus/OTel dependency, pino stays the
   stream of record). Per-task, since-boot; the registry exposes `snapshot()` returning
   `{ sinceIso, counters, histograms }`. **No durable metric store** — the dashboard is a
   read of process state + the events table; revert stays pure read-side. A restart resets
   the window and the dashboard SAYS so (honest `since` label). Longer windows are an
   ops-side concern (CloudWatch over pino), out of repo.
2. **Channel attribution is a ctx-level fact.** `createResolutionContext` gains an
   optional `channel: "mcp" | "http" | "portal"` input (default `"http"`), threaded by the
   three entry points; it lands as a label on brief metrics and as a field on the existing
   assembleBrief log line. This is attribution of OUR OWN faces, not caller identity —
   bearer stays opaque (ADR-0001 untouched).
3. **time-to-brief** = the existing `durationMs`, now also observed into a histogram
   labeled `{moment, depth, channel}`. The log line gains `depth`.
4. **Per-block unresolved rate** = counters at the assembly call-site:
   `brief_blocks{status}` and `brief_block_warnings{code, subjectKind}` plus
   `missingSections` codes — enough to render the negotiation queue grouped by warning
   code and subject. No new block fields; the data already exists in memory.
5. **tokens-per-brief** = **estimated tokens of the serialized response** (chars/4,
   documented as an estimate and labeled `estimated` in the UI), observed per
   `{moment, depth, channel}` at the response-serialization point of each face (JSON body
   and rendered markdown). The metric name says what it is: `brief_payload_est_tokens`.
   No tokenizer dependency.
6. **time-to-verify** = a citation-follow beacon. Portal citation links fire
   `POST /api/internal/instruments/verify` with `{ moment, sourceId, msSinceRender }`
   (client-computed, no user identity, no cookie); the route validates shape, increments
   `citation_follow{moment}` + observes the duration histogram, logs on
   `logger("instruments")`, stores NOTHING durable, returns 204. This is the honest v1 of
   P28's citation-follow metric; cross-session analytics is explicitly out.
7. **Change-feed volume by class** = derived at dashboard read from the events store
   (`listSince` full walk → group by `class`), NOT counters — the store is already the
   durable truth (append-only), aggregation-at-read matches the house rule (P24 spirit).
8. **The dashboard**: internal JSON read `GET /api/internal/instruments` (mirrors the
   openapi.json.ts precedent; returns the registry snapshot + event-class counts +
   negotiation queue) and a minimal portal route `/instruments` rendering: the negotiation
   queue (unresolved/warning counts grouped by code×subject, sorted desc — the "which
   source next" answer), time-to-brief and est-tokens summaries by depth×channel, call
   share by channel, event volume by class, citation-follow stats. Plain read-only page,
   since-boot banner, no nav promotion beyond a support-page link. Not listed in public
   sitemap.
9. **Depth acceptance property (P28/M9)**: `packages/atlas-acceptance` gains the property
   test — same brief at `citations` vs `excerpts`: citations tier carries **zero excerpt
   bodies**, is a **strict subset** in evidence content, and its `brief_payload_est_tokens`
   is **strictly smaller**; both HTTP and in-process faces agree per tier (transport
   guard extension).
10. **Honesty rules**: metrics never alter behavior (observation only — a metrics failure
    must never fail a brief; registry ops are exception-safe); no PII/identity in any
    label; public-safe fixtures.

## Constraints

- Tests-not-gutted; frozen-suite discipline as Steps 1–5. English code/comments; `pnpm`
  only; implementers leave the tree uncommitted.
- **No new workspace package, no new infra, no new runtime dependency** (registry is
  hand-rolled; no prom-client/OTel/tokenizer).
- Surgical: What's New (P31), Ask-LLM, Entra, subscriptions/push, status board (Step 7)
  untouched. The beacon route is the ONLY new write-shaped endpoint and it writes only to
  the process registry + logs.
- Additive: with the dashboard route unvisited and no beacon fired, runtime behavior is
  unchanged except the added log fields.

## Definition of Done (each maps to a named test)

| # | Criterion | Proof |
|---|---|---|
| D1 | Metrics registry: counters/histograms with labels, since-boot snapshot, exception-safe (a throwing observer never propagates) | `metrics.test.ts` |
| D2 | Channel attribution: mcp/http/portal each land their label through ctx; brief log line carries `channel` + `depth` | per-face route tests + assembleBrief test |
| D3 | Brief instruments: time-to-brief histogram, block status + warning-code counters, `brief_payload_est_tokens` per {moment,depth,channel} on both JSON and markdown faces | `briefInstruments.test.ts` |
| D4 | Event volume by class derived at read from the events store; agrees with seeded events | dashboard route test |
| D5 | Verify beacon: valid POST ⇒ 204 + counter + histogram + log, no durable write; invalid ⇒ 400; portal citation links fire it | `verifyBeacon.test.ts` + component test |
| D6 | `GET /api/internal/instruments` returns the full snapshot; `/instruments` renders negotiation queue sorted desc + since-boot banner | route test + e2e (DEV_MOCKS) |
| D7 | Depth acceptance property: citations ⊂ excerpts, zero excerpt bodies at citations, strictly smaller est-tokens, faces agree | `packages/atlas-acceptance` new test |
| D8 | Whole repo green: `pnpm -r typecheck`, `pnpm -r test`, e2e primary; no skipped/deleted tests vs baseline | CI-equivalent local run |

## Batches

- **Batch 0 (frozen):** schema/type stubs (registry interfaces, instruments response
  shape, beacon request schema) + D1–D7 suite red-for-behavior; review-frozen.
- **Batch 1:** registry + channel threading + brief instruments → D1, D2, D3.
- **Batch 2:** beacon + dashboard JSON + portal `/instruments` + event-class read → D4,
  D5, D6.
- **Batch 3:** depth acceptance property + e2e + full sweep → D7, D8.

## Deferred with rationale (do not build now)

- **Durable/historical metrics & cross-restart windows** — ops-side (CloudWatch over
  pino); the in-repo dashboard is the since-boot honest view. Revisit only if Track B
  needs longer windows than deploy cadence provides.
- **Alerting / thresholds** — P24: never.
- **Real tokenizer counts** — estimate suffices for tier comparison; a tokenizer dep is
  not worth it until a real consumer disputes the estimate.
- **Per-user / per-team analytics** — identity stays out of labels (privacy + ADR-0001).
- **`explain_error` instrumentation** — arrives with Step 7's location floor.

## Open questions — RESOLVED at ratification (owner, 2026-07-06, per reviewer recommendation)

1. **Since-boot window: ACCEPTED for v1.** The negotiation queue does not need to
   survive deploys yet; locked-decision 1 stands as written (no durable aggregate;
   dashboard labels its `since`). Revisit only if Track B's cadence outlives deploy
   cadence in practice.
2. **Beacon ships now.** Time-to-verify per locked-decision 6 (client-computed ms, no
   identity, log+counter only) is in scope for this step, not deferred.
3. **`/instruments` unauthenticated-but-unlisted.** Aggregate counts only, no identity,
   not in the sitemap; Entra gates it later when the membership gate lands.
