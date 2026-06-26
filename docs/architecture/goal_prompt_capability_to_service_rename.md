# Goal Prompt: Rename `capability` → `service`

Purge the word **capability** from live code, schema, data, and docs, replacing it
with **service**. This is a precise, footgun-laden rename, not a blind find-replace.
Loop until the Definition of Done is green.

> **Note (2026-06-20):** the manifest-control-plane leg already shipped, so the
> `data/{sources,topics,anchors,source-topic-mappings}.yaml` manifests **now exist**
> and carry `topic_type: capability` — they are in scope for this rename (see Scope).
> The byte-equivalence oracle test (`loadRegistryFromManifests` deep-equals
> `pilotRegistrySeed`) means the seed and the manifests must be renamed **together**
> in the same pass, or that test breaks.

Read `CONTEXT.md` (the **Service** term) and `docs/product/mvp-product-design.md`
§7/§13 first. This prompt is the executable form of that vocabulary decision.

## Goal

In the schema, `topicTypes` carries the value `"service"` (was `"capability"`); the
guidance `applies_to.services` field (was `capabilities`); and no live surface — UI,
API, tests, live docs — uses the word "capability" for the AWS-service topic type.
Behavior is otherwise unchanged.

## Locked decisions (do not re-litigate)

1. **Only the `capability` value/word changes. `Topic` stays.** The schema core type
   name `Topic` / `topic_id` / `topic_type` is **untouched**. Only the *enum value*
   `"capability"` inside `topicTypes` becomes `"service"`, and the
   `applies_to.capabilities` field becomes `services`.
2. **Landing Zone and Guardrail are NOT renamed.** They are the sibling
   `topic_type` values `"landing-zone"` / `"guardrail-area"` and stay exactly as
   they are. They are never relabeled "service".
3. **Do not touch unrelated `service`.** The word already exists in unrelated senses
   and must be left alone: the `context-layer/src/services/` directory,
   `contextBundleService`, `service-token` / service-token fallback, AWS "service"
   used generically, `@atlas/*` package names. Rename only where the current token
   means **the capability topic type**.
4. **Exclude historical trees.** Do **not** edit `docs/archive/**` or `prototype/**`
   — they are frozen history/throwaway. (They hold the bulk of the raw `capability`
   hits; ignoring them is intentional.)
5. **Not a sed.** Target the enum value, the field, `topic_type: "capability"`
   strings, capability-named files, and capability UI labels by hand/review. A blind
   global replace would corrupt the unrelated `service` tokens in (3).

## Scope — rename these (live tree only)

- **Schema** (`packages/atlas-schema/src/`): `topicTypes` value `capability`→`service`;
  `applies_to.capabilities`→`services` (index.ts); update `schema.test.ts`.
- **Seed** (`context-layer/src/seeds/pilotRegistry.ts`): `topic_type: "capability"`→
  `"service"` and prose ("…capability…"→"…service…") in descriptions; its test.
- **Data** (`data/`): `data/topics.yaml` `topic_type: capability`→`service`;
  `data/guidance/*.yaml` `capabilities:`→`services:`.
- **context-layer** (`src/`): any branch/label keying on the `"capability"` topic
  type (e.g. routes, bundle service, mcp tooling references).
- **Portal** (`portal/src/`): routes, components, lib, views, api/server (incl.
  `mcp/tools.ts`, `openapiDocument.ts`), and tests that use the capability topic
  type or label. Rename capability-named **files** too —
  `routes/proto.capability.tsx`→`proto.service.tsx`,
  `lib/capability-route-icons.*`→`service-route-icons.*` — and **regenerate
  `routeTree.gen.ts`** (do not hand-edit it).
- **Live docs**: `DESIGN.md`, `docs/architecture/current_design.md`,
  `docs/architecture/agent_readiness.md`, `docs/product/guidance_design.md`, and any
  residual "capability" in `CONTEXT.md` / `mvp-product-design.md` that means the
  topic type (the **Service** term already exists — make the body consistent).

## Out of scope

- `docs/archive/**`, `prototype/**` (frozen).
- The `Topic` type name and `topic_id`/`topic_type` field names.
- Unrelated `service` tokens (services dir, contextBundleService, service-token, AWS
  service generic).
- Any FED-LZ dataset reshape (that is a separate goal); this rename is value/word
  only, no id or content changes beyond `capability`→`service`.

## Execution coordination (concurrent agents)

Two other agents are editing the workstream (notably `portal/src`) at the same time.
This rename is **atomic** — the schema enum value `capability`→`service` and every
consumer must change in one commit, or the build breaks mid-flight — so it **cannot**
be safely interleaved with their live edits.

- **Develop in an isolated git worktree** off the latest integration commit
  (`git worktree add`, or run the executing agent with `isolation: "worktree"`). Do
  the full rename and take `pnpm -r test` to green **there**, so no half-renamed or
  broken state ever appears in the other agents' checkouts.
- **A worktree isolates development, not integration.** Because this rename and the
  concurrent `portal/src` edits touch the same files and symbols, merging still
  collides, and any new code the other agents wrote against `"capability"` will fail
  to compile once the renamed enum lands. Isolation buys a clean, verified commit —
  not a conflict-free merge.
- **Land it as a serialization point.** When the other workstreams reach a checkpoint,
  rebase the rename onto their landed work (or have them rebase onto it), then everyone
  continues on the renamed enum. Keep it **one mechanical commit** so that rebase is
  trivial.
- **Broadcast the vocabulary first.** Tell the other agents to write `service` /
  `services` (never `capability`) in any new code from now on, to shrink the conflict
  surface before this lands.

### Conflict resolution rule (the executor owns it)

When this rename integrates, **the executing agent resolves every merge/rebase
conflict itself** — never hand back a conflicted tree, and never defer the conflict
to the other agents.

**The concurrent workstream's content always wins; this rename only re-applies the
`capability`→`service` token transform on top of their resolved lines.** Concretely:

- **Rebase the rename ONTO the latest workstream commit**, so their work is the base
  and the rename replays last (their content is structurally preferred).
- On any conflict, **take the other agents' version of the hunk**, then re-run the
  mechanical `capability`→`service` substitution on it. Do **not** keep the rename's
  pre-rebase copy of their lines (that would revert their edits).
- **Never** resolve with `-X ours`, `checkout --ours`, "accept current/incoming whole
  file", or any blanket strategy that can drop their hunks. Resolve hunk by hunk.
- **Proof of non-overwrite:** after resolving, run
  `git diff <their-landing-commit>..HEAD -- <conflicted files>` and confirm the only
  deltas are `capability`→`service` token changes — **no line of their work removed or
  reverted**. If anything of theirs is missing, the resolution is wrong; redo it.
- Then take `pnpm -r test` to green before the merge is final.

## Implementation batches

### Batch 1 — Schema + seed + data (the source of truth)

Rename in `@atlas/schema`, `pilotRegistry.ts`, and `data/*.yaml`; update their unit
tests. **Verify:** `pnpm --filter @atlas/schema test` and `pnpm validate:guidance`
green; `pnpm --filter @atlas/context-layer test` green.

### Batch 2 — Portal (code, files, route tree)

Rename usages, rename the capability-named files, regenerate the route tree.
**Verify:** `pnpm --filter @atlas/portal test` green; route tree regenerated, not
hand-edited.

### Batch 3 — Live docs + consistency sweep

Sweep live docs; sharpen the CONTEXT **Service** term / §13 to state the
`topic_type` value is `service`. **Verify:** `rg -i 'capabilit'` over the live tree
(excluding `docs/archive` and `prototype`) returns **zero** hits.

## Definition of Done (loop until all green)

- [ ] `topicTypes` = `["service", "landing-zone", "guardrail-area"]`; field is
      `applies_to.services`. `Topic`/`topic_type` names unchanged.
- [ ] `landing-zone` / `guardrail-area` values untouched; nothing new labeled
      "service" except the former capability topics.
- [ ] No unrelated `service` token (services dir, contextBundleService, service-token)
      was altered.
- [ ] Capability-named files renamed; `routeTree.gen.ts` regenerated.
- [ ] `rg -i 'capabilit'` over the live tree (excl. `docs/archive`, `prototype`) = 0.
- [ ] **No concurrent workstream change reverted:** at integration,
      `git diff <their-landing-commit>..HEAD -- <conflicted files>` shows only
      `capability`→`service` token deltas — nothing of the other agents' work removed.
- [ ] `pnpm -r test` + `pnpm validate:guidance` green.
