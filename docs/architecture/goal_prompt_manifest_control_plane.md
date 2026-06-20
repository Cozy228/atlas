# Goal Prompt: Manifest Control Plane

Promote the pilot registry off the hand-written `pilotRegistry.ts` seed into a
validated, Git-managed `data/*.yaml` manifest control plane loaded by the Context
Layer. Loop until the Definition of Done is green.

Read `docs/architecture/mvp_next_steps.md` §1, `docs/product/mvp-product-design.md`
§6/§14, `docs/adr/0007-runtime-object-ingestion-seam.md`, and `CONTEXT.md` before
starting. This prompt is the executable distillation of those. The guidance
manifest seam (`data/guidance/*.yaml` + `validateGuidanceManifest`) already exists
and is the **pattern to mirror** for Sources / Topics / Anchors / mappings.

## Goal

The Context Layer builds a context bundle from registry data **loaded and validated
from `data/*.yaml`**, not from `pilotRegistry.ts`. An invalid manifest fails fast
with an actionable error. Portal and Skill behavior is **byte-identical** to today,
because the manifests reproduce the current `pilotRegistrySeed` exactly.

```text
data/*.yaml  ──parse+validate──▶  registry seed  ──loadPilotRegistry──▶  repositories
   (authored)     (@atlas/schema, fs-free)        (context-layer loader)     (unchanged)
                                                          │
                                              contextBundleService (unchanged downstream)
```

## Locked decisions (do not re-litigate)

1. **1:1 port, not a reshape.** The manifests reproduce the existing
   `pilotRegistrySeed` **verbatim** — same ids, same fields, same content. The
   FED-LZ hero-slice reshape (rename to Federated Landing Zone, de-brand, swap to
   S3 / API Gateway / Textract, relocate the conflict to Textract module⟷Confluence)
   is a **separate goal** through this now-validated seam. **Out of scope here.**
2. **No schema changes for new contracts.** `availability-cell` / `module-field`
   anchor kinds, `severity` on the source↔topic mapping, and `review_frequency`
   belong to the Availability / TFE / Guardrails legs (ADR-0009/0010). Do **not**
   add them here. Only model what `pilotRegistrySeed` already uses.
3. **Validators are pure and fs-free** (mirror `guidanceManifest.ts`): `@atlas/schema`
   exposes `validate*Document(raw, file)` + a cross-file `validate*Manifest(docs)`;
   the **CLI/test reads fs + parses YAML**, the schema package never touches fs.
4. **One loader, in `context-layer`.** A new `loadRegistryFromManifests(dir)` reads
   `data/*.yaml`, validates, and returns a value **shape-compatible with
   `PilotRegistrySeed`**, fed straight into the existing `loadPilotRegistry`. The
   repositories and `contextBundleService` downstream are untouched.
5. **`pilotRegistry.ts` stays as a test fixture** until the loader tests are green,
   then `contextBundleService` switches to the manifest loader as its default
   source. Do not delete the seed in this goal (it is the equivalence oracle).
6. **YAML format** (sibling to `data/guidance/*.yaml`). One directory per object
   kind.

## Constraints (from repo CLAUDE.md + mvp_next_steps.md)

- Public-safe: fictional names, generic sample data; nothing company-specific.
  (The existing seed is already public-safe — porting it preserves that.)
- No durable ingest of source content. Manifests carry **pointers + curated
  metadata** (location, steward, authority, anchors), never copied excerpts.
- Surgical: every changed line traces to this goal. Do not "improve" adjacent
  resolver / bundle code.
- Invalid manifest → **fail fast** with file + id + reason. Errors block; warnings
  surface (governed-honesty posture, ADR-0007).

## Expected manifest files

```text
data/
  sources.yaml                 # SourceSchema[]
  topics.yaml                  # TopicSchema[]
  anchors.yaml                 # AnchorSchema[]
  source-topic-mappings.yaml   # mapping[]
  guidance/*.yaml              # already exists — leave as-is
```

(Single-file-per-kind or a directory per kind is fine; match whatever keeps the
loader simplest. Guidance already lives under `data/guidance/`.)

## Implementation batches

### Batch 1 — Manifest schemas + pure validators (`@atlas/schema`)

- Confirm `SourceSchema` / `TopicSchema` / `AnchorSchema` and the mapping shape
  cover every field `pilotRegistrySeed` uses (they should already — the seed is
  typed against them). Add nothing new.
- Add `sourceManifest.ts` / `topicManifest.ts` (or one `registryManifest.ts`)
  mirroring `guidanceManifest.ts`: `validateSourceDocument(raw, file)` + a
  cross-file `validateRegistryManifest({sources, topics, anchors, mappings})` that
  checks: **duplicate ids** (per kind), **dangling refs** (mapping → source/topic
  ids; anchor → source id; guidance source refs), and schema errors. Pure, fs-free.
- Unit-test the validators: a clean set passes; a duplicate id, a dangling
  source-topic mapping, and a schema violation each fail with an actionable message.

**Verify:** `pnpm --filter @atlas/schema test` green.

### Batch 2 — Author `data/*.yaml` from the seed

- Serialize `pilotRegistrySeed` into `data/sources.yaml` / `topics.yaml` /
  `anchors.yaml` / `source-topic-mappings.yaml`, **id-for-id, field-for-field**.
- Run the Batch-1 validators over them (via the Batch-4 CLI) — must pass.

**Verify:** validators green over the authored files.

### Batch 3 — Loader + wire `contextBundleService`

- `context-layer/src/seeds/loadRegistryFromManifests.ts`: read the `data/*.yaml`
  (fs + YAML parse), run `validateRegistryManifest`, throw on error with file+id+
  reason, and return a `PilotRegistrySeed`-shaped object.
- `contextBundleService.ts`: default its registry source to
  `loadPilotRegistry(loadRegistryFromManifests(DATA_DIR))` instead of
  `pilotRegistrySeed`. Keep an injection seam so tests can still pass an explicit
  seed (don't hardcode fs in the hot path — load once at module init / first use).
- Keep `pilotRegistry.ts` exported for tests.

**Verify:** the existing context-layer + `atlas-acceptance` suites pass
**unchanged** — proving the manifest-loaded registry is byte-equivalent to the
seed. Add one test asserting `loadRegistryFromManifests(DATA_DIR)` deep-equals
`pilotRegistrySeed`.

### Batch 4 — `validate:sources` / `validate:topics` scripts + CI

- Add a `validate:sources` (and/or `validate:registry`) script mirroring
  `validate:guidance`: a vitest entry that reads `data/*.yaml`, parses, runs
  `validateRegistryManifest`, and fails the run on any error.
- Wire it into the root `package.json` alongside `validate:guidance`.

**Verify:** `pnpm validate:guidance && pnpm validate:registry` both green; `pnpm -r test` green.

## Definition of Done (loop until all green)

- [ ] `data/{sources,topics,anchors,source-topic-mappings}.yaml` exist and validate.
- [ ] Invalid manifests fail fast with file + id + actionable reason (duplicate id,
      dangling ref, schema error each covered by a test).
- [ ] `loadRegistryFromManifests(DATA_DIR)` deep-equals `pilotRegistrySeed`
      (equivalence oracle test).
- [ ] `contextBundleService` builds bundles from the manifest loader by default;
      `pilotRegistry.ts` is no longer the runtime source of truth (kept only as a
      test fixture / equivalence oracle).
- [ ] Existing context-layer + `atlas-acceptance` + portal suites pass **unchanged**.
- [ ] `validate:registry` wired into root scripts; `pnpm -r test` green.

## Out of scope (explicitly deferred)

- FED-LZ hero-slice reshape (rename / de-brand / S3·API Gateway·Textract / conflict
  relocation) — next goal, through this seam.
- New anchor kinds (`availability-cell`, `module-field`), `severity` on mappings,
  `review_frequency` — Availability / TFE / Guardrails legs (ADR-0009/0010).
- DynamoDB-backed registry storage — bundled/static manifest is the accepted first
  step (mvp_next_steps §4).
