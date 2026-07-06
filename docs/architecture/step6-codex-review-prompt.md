---
status: active
review_after: 2026-07-27
---

# Codex Review Prompt — Step 6 Honesty Instruments

> Heterogeneous adversarial second opinion, deferred for now (owner: "no codex review
> at the moment; leave the prompt in a file"). Run this when a Codex pass is scheduled.
> Death condition: absorb the surviving verdicts into the decision log / OPEN.md, then
> archive this file.

## How to run

Point Codex at the worktree `feat/step6-instruments` (or the merged commit, if already
landed). Review the **whole Step 6 diff** against `feat/step7-status-board` as base:

```
git -C <repo> diff feat/step7-status-board...feat/step6-instruments
```

Ground truth documents (read first; on conflict they win over the code):
- `docs/architecture/goal_prompt_step6_instruments.md` — the ratified work order (Locked
  decisions 1–10, Definition of Done D1–D8, Constraints, Deferred list).
- `docs/architecture/step6-instruments-implementation-notes.md` — the builder's own
  deviation log. **Verify every claim in it against the diff; do not trust it.**
- `docs/architecture/mid-level-design.md` (§7 Observability, §10 M9),
  `docs/architecture/direction-decision-log.md` (P16, P20, P22, P23, P28).

## Your job: try to REFUTE, not to praise

For each finding, give: file:line, the concrete failure scenario (inputs/state → wrong
output), and a severity. Default to "this is fine" only after you have actively tried to
break it. Report nothing you cannot tie to a real failure or a stated requirement.

### Adversarial checklist (Step-6-specific)

1. **Honesty rule — observation must never alter behavior (Locked decision 10).** Prove or
   refute: can any metrics-registry op, beacon handler, or est-tokens computation throw in
   a way that fails or changes a brief? Find the one call-site where the `safe()` guard is
   missing or the observer runs *before* the value is returned to the caller.
2. **Exception-safety of the registry (D1).** A throwing label function, a NaN observation,
   a histogram bucket overflow, an unbounded label cardinality (e.g. `subjectKind` or
   `moment` taking an unexpected value) — does any of these corrupt the snapshot or leak
   memory across the process lifetime? Is the since-boot window actually monotonic?
3. **Channel attribution correctness (D2).** Trace all three faces (mcp / http / portal).
   Is the default really `"http"`? Can a portal in-process call be mislabeled as `http`, or
   an MCP call fall through to the http default? Does the `assembleBrief` log line carry
   BOTH `channel` and `depth` on every path — including the change-moment path that the
   notes say bypasses `assembleBrief`?
4. **est-tokens double-count / under-count (D3, Locked decision 5).** The notes admit the
   `.md` face records both a JSON-canonical and a markdown value. Confirm the aggregation
   in the dashboard does not double-count a single request, and that `chars/4` is applied
   to the actually-serialized bytes (not a pre-serialization object).
5. **Event-volume-at-read (D4, Locked decision 7).** `listSince` full walk grouped by
   `class`: what window does it use? Does it silently cap/paginate (a silent truncation =
   a dishonest count)? All 7 enum classes present with 0 when absent?
6. **Beacon shape validation (D5).** Feed it: missing fields, wrong types, negative
   `msSinceRender`, huge numbers, extra fields, non-JSON body, a `sourceId` with PII-shaped
   content. Valid ⇒ 204 + counter + histogram + log + NO durable write; invalid ⇒ 400.
   Confirm no identity/cookie is read and nothing is persisted.
7. **Depth acceptance property (D7, Locked decision 9).** Is the test asserting a *genuine*
   strict subset (citations ⊂ excerpts, zero excerpt bodies at citations, strictly-smaller
   est-tokens) — or a tautology that would pass even if the tiers were identical? Do both
   HTTP and in-process faces really agree per tier, or is one face stubbed?
8. **`/instruments` exposure (open-q 3).** Unauthenticated-but-unlisted: confirm it leaks
   no identity, no bearer, no source content beyond aggregate counts; not in the sitemap.
9. **Surgical / additive (Constraints).** No new workspace package, no new runtime
   dependency, no tokenizer/prom-client/OTel. What's New / Ask-LLM / Entra / subscriptions
   / Step 7 status board untouched. With the dashboard unvisited and no beacon fired,
   runtime behavior is unchanged except the added log fields — verify by inspection.
10. **Tests-not-gutted.** Diff the test count and assert nothing was skipped, deleted, or
    weakened relative to base. Are the new tests real assertions or green-by-construction?

### Review-standard rubric (house style)

Terminology/boundaries, API-map coherence, dead code, seed-coupling, honest-gap labeling
(the UI must SAY "estimated" and SAY "since boot"), type-safety (no `any` widening on the
new label maps), barrel/`index.ts` export hygiene.

## Output

A ranked findings list (most severe first), each CONFIRMED (you reproduced/traced it) or
PLAUSIBLE (argued but not run). If clean, say so and name what you actively tried to break.
