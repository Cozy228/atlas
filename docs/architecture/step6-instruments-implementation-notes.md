---
status: active
review_after: 2026-07-27
---

# Step 6 — Honesty Instruments · implementation notes (deviation log)

First-class deliverable: the reviewer reads this before the diff. Every place I
departed from the goal prompt's locked decisions, every stale current-tree fact,
every DoD row I could not fully close, and residual risk.

## Baseline (re-verified at worktree HEAD `a154440c`)

- `pnpm -r typecheck` → exit 0 (all packages Done).
- `pnpm -r test` → exit 0. context-layer 339 passed / 2 skipped; portal 160 passed;
  atlas-acceptance 7 passed; azure-react-icons 1 passed. No pre-existing RED in the
  unit suites. (OPEN.md notes a pre-existing e2e RED — a11y policy-detail + a
  core-journey click on a Step-5-removed catalog tab; that is the e2e surface, not
  the unit suites.)

## Current-tree facts — re-verification result

All anchors in the goal prompt's "Current-tree facts" verified TRUE at HEAD with
these line shifts / clarifications:

- `assembleBrief.ts:73-86` log line confirmed (moment, landingZoneIds, appId?,
  blocks[{id,status,landingZoneId?}], durationMs) — no depth/channel/size. TRUE.
- MCP moment briefs do NOT flow through `inProcessContextApi.getBrief`; `tools.ts`
  `briefFromArgs` builds the ctx DIRECTLY via `createResolutionContext` and calls
  `handleBriefRequest`. The goal prompt's "MCP … → mcp/handler.ts" is right that the
  handler is the entry, but channel threading for MCP briefs lands at `tools.ts`, not
  the handler. (Clarification, not a contradiction.)
- The `change` moment is assembled by `briefsRoute.assembleChangeBrief`, which does
  NOT call `assembleBrief` and currently emits NO pino brief log line. So the
  "existing per-brief pino signal" only covers adopt/build. (See Decisions §time-to-brief.)

## Decisions (choices the goal prompt left open)

- **Channel default & threading.** `ResolutionChannel = "mcp" | "http" | "portal"`,
  default `"http"`, added to `GovernedResolutionContext`. Threaded at: HTTP router
  (`httpRoute.resolutionContextFromRequest` → `"http"`), portal in-process client
  (`createInProcessContextApiClient` default `"portal"`), MCP moment/bootstrap tools
  (`tools.ts` → `"mcp"`) and the MCP client fallback (`createServerContextApiClient`
  passes channel through). The public `.md` alias route (`briefs/[moment].md.ts`) and
  the resource `.md`/resources routes keep the `"http"` default — they are public HTTP
  faces. Background jobs (refreshGraphSnapshots) keep the default; they assemble no
  briefs so their channel never reaches a brief metric.
- **time-to-brief for `change`.** Locked decision 3 ties the histogram to "the existing
  durationMs" (the assembleBrief log). Since `change` has no assembleBrief pass, I
  measure its own wall-time inside `assembleChangeBrief` and record it with the same
  helper. I did NOT add a new pino line to the change path (surgical); it gets metrics
  only. adopt/build keep the existing log line, now carrying `depth` + `channel`.
- **est-tokens site.** `brief_payload_est_tokens{moment,depth,channel,face}`. Per locked
  decision 5, EXACTLY ONE observation is recorded per request, at the response-serialization
  point of the face actually served — never a face the request does not emit:
  - HTTP `.md` alias → `face:"markdown"` only (rendered markdown), in `httpRoute.ts` under
    the `wantsMarkdown` branch; the JSON path in the same handler records `face:"json"`.
  - The portal markdown route (`briefs/[moment].md.ts`) → `face:"markdown"`.
  - `handleBriefRequest` no longer records payload itself — it is the shared assembly
    chokepoint, but the serialized cost belongs to each face's own serialization point, so
    the recording moved out to the faces. This closes the earlier double-count (a `.md`
    request previously recorded both a json and a markdown observation).
  The portal in-process path records NO payload observation: it hands a Brief object to
  the React page and never serializes a wire payload, so an est-tokens count there would be
  a face it does not serve. The D7 acceptance property computes est-tokens over the two
  tiers directly (it does not depend on a recorded metric), and the `face:"json"` samples
  on the live dashboard come from the JSON API face.
- **Negotiation queue** is derived at dashboard read from the `brief_block_warnings`
  counters, sorted desc by count, and returned as a distinct `negotiationQueue` field
  (locked decision 8) so the portal renders it directly.
- **Event volume by class** is GLOBAL (unscoped) — the durable events store is the truth
  (locked decision 7); read via `sharedEventsRepository(env).listSince()` and grouped by
  class. All 7 `eventClasses` are returned (count 0 when absent) for a stable shape.
- **Beacon "component test".** The portal vitest env is `node` (no jsdom/RTL — house
  style renders to static markup). A DOM click cannot be dispatched. So D5's client
  proof is a `verifyBeacon.test.ts` in portal that drives the exact fire helper the
  citation-link onClick calls (injected fetch, asserts POST + url + body shape + that it
  swallows a rejected fetch). The real click is exercised by e2e. The citation-link
  beacon is wired ONLY on the brief page (where `moment` is known); non-brief citations
  (service pages) have no moment and do not fire (out of scope).
- **Histogram shape.** Prometheus-style cumulative buckets; the overflow bucket is
  labelled `"+Inf"` (a string) because `Infinity` does not survive `JSON.stringify`.
  Duration buckets in ms; token buckets by est-token count.

## Deviations (departures from the plan)

- None material beyond the Decisions above. No new workspace package, no new runtime
  dependency, registry hand-rolled, pino remains the stream of record.

## Adjacent-found (untouched)

- Pre-existing e2e RED (OPEN.md): a11y policy-detail + core-journey click on the
  Step-5-removed "Security policies" catalog tab. Not touched (out of scope).
- Two pre-existing oxlint warnings in `assembleBrief.ts` +
  `confluenceOnboardingProvider.ts` (OPEN.md, Step-4 vintage). Not touched.

## Open questions

- None blocking. The three ratification open-questions are RESOLVED per the goal prompt.

## DoD closure

| # | Status | Proof |
|---|--------|-------|
| D1 | PASS | `context-layer/src/observability/metrics.test.ts` — counters/histograms with labels, cumulative buckets + `+Inf`, since-boot `since`, and "a throwing observer never propagates" (hostile Proxy). |
| D2 | PASS | `context-layer/src/api/briefInstruments.test.ts` (channel lands on metrics for mcp; assembleBrief log line carries `channel` + `depth`) + the per-face threading (http/portal/mcp). |
| D3 | PASS | `briefInstruments.test.ts` — time-to-brief histogram, block status + `brief_block_warnings{code,subjectKind}`, `brief_payload_est_tokens` on json + markdown faces. |
| D4 | PASS | `context-layer/src/api/instrumentsRoute.test.ts` — event volume by class derived at read, agrees with seeded events. |
| D5 | PASS | `context-layer/src/api/verifyBeacon.test.ts` (valid⇒204+counter+histogram+log, no durable write; invalid⇒400) + `portal/src/lib/verifyBeacon.test.ts` (client fires POST, never throws). |
| D6 | PASS (unit) / e2e see transcript | `instrumentsRoute.test.ts` (full snapshot + negotiation queue sorted desc) + `packages/atlas-e2e/tests/instruments.spec.ts` (page + since-boot banner). |
| D7 | PASS | `packages/atlas-acceptance/src/depthProperty.test.ts` — citations ⊂ excerpts, zero excerpt bodies at citations, strictly smaller est-tokens, both faces agree per tier. |
| D8 | PASS | `pnpm -r typecheck` = 0, `pnpm -r test` = 0; no skipped/deleted tests vs baseline (all additive). See the self-verification transcript in the final report. |

Baseline vs now (all additive, nothing gutted): context-layer 339→355 pass (2 skip unchanged),
portal 160→163, acceptance 7→10, schema 64 unchanged.
