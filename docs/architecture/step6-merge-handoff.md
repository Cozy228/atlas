---
status: active
review_after: 2026-07-21
---

# Step 6 → feat/1.0.0 merge handoff

> **Death condition:** delete this file once Step 6 (and Step 7) are merged into
> `feat/1.0.0` and the merge is pushed. Its verdict is the merge itself.

## State at handoff (2026-07-07)

- **Step 6** is complete + reviewed + committed on `feat/step6-instruments @ 8e2b62ab`
  (branched from `feat/step7-status-board` base `a154440c`). Tree clean; D8 green
  (typecheck, `pnpm -r test`: context-layer 357/2skip, portal 165, acceptance 10, schema
  64, infra 6; instruments e2e 2/2). NOT pushed, NOT merged — parked by owner decision.
- **Step 7** is still being implemented on `feat/step7-status-board` (HEAD advanced to
  `6a0ad84e`: Batch 0 frozen suite + Batch 1 location-registration store/routes/infra +
  Batch 2 location-index-from-graph-edges). Owner: "还在实现,等它全部落地".
- **Merge target: `feat/1.0.0`.** Both Step 6 and Step 7 merge into 1.0.0 once Step 7
  fully lands. Do NOT merge Step 6 early.

## Merge order (recommended)

1. Wait for Step 7 to fully land (all batches) on `feat/step7-status-board`.
2. Merge `feat/step7-status-board` → `feat/1.0.0` first (it is the longer-lived active
   line; base `a154440c` is already on it as one docs commit).
3. Merge `feat/step6-instruments` → `feat/1.0.0` second, resolving the conflicts below.
4. Re-run full D8 on the integrated `feat/1.0.0`, then push (合并即 push).

## Predicted conflict hotspots (Step 6 ∩ Step 7 both touch these)

Step 6 and Step 7 branched from the same base and both add surface, so expect:

- **`portal/src/routeTree.gen.ts`** — near-certain conflict (generated file; both add a
  route: Step 6 `/instruments`, Step 7 status-board/registration routes). **Resolution:
  do not hand-merge — regenerate.** Take either side, then run the TanStack route
  generation (portal dev/build regenerates it) and commit the regenerated file.
- **`packages/atlas-schema/src/index.ts`** — both append types (Step 6: instruments
  response, beacon request, metric-sample shapes; Step 7: location/registration schema).
  Append-only conflict; keep both blocks.
- **`context-layer/src/index.ts`** (barrel) — both add exports (Step 6:
  `instrumentsMetrics` curated surface; Step 7: location/registration exports). Keep both.
- **`context-layer/src/api/httpRoute.ts`** — both add route branches (Step 6: `/briefs/*`
  est-tokens recording + instruments read; Step 7: status/registration endpoints). Keep
  both branch blocks; watch import ordering.
- **`context-layer/src/resolvers/createResolutionContext.ts` / `resolverTypes.ts`** —
  Step 6 added the `channel` field; Step 7 may touch the same factory for
  registration/consumer-state. Reconcile the ctx shape carefully (this is also the seat
  the future Entra slice threads identity into — keep it clean).
- **`portal/src/routes/support.tsx`** — Step 6 added the `/instruments` link; low risk
  unless Step 7 also edited support.

## After merge

- Re-verify the Entra goal prompt's current-tree anchors against the integrated HEAD
  (`goal_prompt_entra_app_scope.md` §"Grounding caveat").
- Sweep OPEN.md; delete this handoff and the Step 6 codex-review prompt once its Codex
  pass is run or explicitly dropped.
