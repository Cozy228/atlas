# 019 — ContextBundle retirement + authority defer (portal evidence/contract decontamination)

> Status: **implemented** 2026-06-28 — green at `pnpm -r typecheck · lint · test`.
> **Sequencing: 019 runs BEFORE [018](018-msw-dev-driver-registry-decontamination.md).**
> (Higher number, earlier execution — it clears the portal/contract surface so 018
> can touch only the source side. Renumber if the inversion is confusing.)
> Builds on plan 017 (HEAD `e693e05`).

## Implementation outcome (2026-06-28)

Done in 4 batches (B1 authority→optional · B2 migrate consumers · B3 delete contract ·
B4 authority residue + gate relax), each ending green. ContextBundle is fully retired:
`buildContextBundle`, `contextRoute`/`handleContextRequest`, the MCP `atlas_get_context_bundle`
tool, `ContextBundleResponse` + `disclosure_level`/`expansion_paths`/`anchor_references`/
`ContextBundleSource`/`ContextRequest`/`ExpansionRequest`/`Excerpt` are gone; consumers read
the live resource projection. Verification grep (app code) → 0. `AuthorityLevel` +
`authority_conflict` kept dormant.

Reshape decisions that emerged in the session (beyond the original plan):

- **Source ≠ Resource.** A Resource (`{kind}/{slug}`) aggregates Sources via Section bindings;
  a Source is the evidence document beneath. So the `/sources/$sourceId` dossier is NOT a
  resource-projection consumer — it became a pure registry view (metadata + related), dropping
  live excerpts (the retired per-source ContextBundle resolve). No anchors-read added.
- **Services are uniform** — no S3 / API Gateway / Textract "hero" special-casing; all are
  `kind: service`. The v1 acceptance HARD GATE proves the mechanism on the one governed service
  (textract) + adoption-journey wiring, not a per-hero overlay.
- **Policy = a discovered Resource** (`kind: guardrail`). The `policies/$policyId` route resolves
  its guardrail by the policy topic id through the guardrail's aliases (`s3-guardrails` →
  `guardrail/s3-public-access`); unconfigured policies render an honest empty.
- **Landing zone removed from the catalog.** LZ is the availability scope (aws/azure), not a
  catalog topic — the catalog LZ tab + the 3 LZ topics + their 6 mappings are gone, and
  `catalog.$topicId` is service-only. The 3 LZ Confluence **sources** stay (orphaned evidence /
  resolver fixtures); the `landing-zone` topic_type enum stays dormant.
- **DI container** `ContextBundleService` (a misnomer now) kept its name to avoid a wide rename;
  the survivors (the type + `discoverSources`/`discoverTopics`) moved to `services/contextService.ts`.
- **Ask Atlas** migrated to resource-projection: resolve topic→resource via the availability
  spine or free-text→resource via `searchResources`, then feed Section content+citations to the
  LLM. The `=== "authoritative"` gate is gone (all discovered Section content is admissible).

## Context

Two legacy concerns sit on the **same ~20 portal files** (`askAtlas`, `evidence-panel`,
`sources/detail`, `detail/evidence-section`, …) and must be removed together so that
surface is edited once, not twice:

1. **`ContextBundle` is still a live contract.** `contracts.ts` has
   `ContextLayerContract = ContextBundleResponse`; `buildContextBundle` is a core
   service; the portal evidence/ask surface still consumes `ContextBundleResponse`
   (`disclosure_level` / `expansion_paths` / `anchor_references` / `sources[].excerpts`).
   Plans 013–015 already pivoted to the resource-projection "one core, many views"
   model (`resourceContextService` / `ResourceContextResponse`, live on catalog), so
   ContextBundle is a parallel legacy path its consumers were never migrated off.

2. **`authority_level` / `authority_scope` are required and over-modelled.** They are
   woven through schema + context-layer + ~20 portal files, including **logic** (not
   just badges): `askAtlas` / `ask` / `claimsLlmShared` / `support` gate the LLM input
   on `authority_level === "authoritative"`.

Both retire for the **same reason chain** established in the grill:

- The **TOC + anchor two-phase retrieval** model (a doc's heading list is a free
  byproduct of the existing fetch+parse; the agent picks a heading; the section is
  located at runtime) makes `disclosure_level` and `expansion_paths` redundant.
- **Discovery's entry scope already crawls only authoritative sources** — anything
  discovered is system-of-record by construction — so the `=== "authoritative"` gates
  are no-ops and `authority_*` is not a required attribute. Authority only re-earns its
  place later for **contributed** content (guidance, where other people contribute), so
  the vocabulary is kept dormant, not deleted.

## Principle

- **descriptive → discovery; normative → Atlas rules** (carried from 017 / memory
  `atlas-registry-is-discovery-output`). authority, as a *separate per-source overlay*,
  is not normative-essential here: it collapses into (discovery scope = authoritative) +
  (discovered metadata). Defer it; do not re-introduce it as hand-set instance data.
- **Edit a surface once.** ContextBundle retirement and authority defer share the portal
  evidence/ask files → one plan, sequential batches clustered by file.

## Locked decisions

| # | Decision |
|---|---|
| ContextBundle | **Retire the `/api/context` contract**: `buildContextBundle`, `contextRoute`, `handleContextRequest`, the MCP context tool, and `ContextBundleResponse` (with `disclosure_level` / `expansion_paths` / `anchor_references`). Consumers migrate to resource-projection. Explicit contract removal, not silent. |
| disclosure / expansion | **Gone.** Replaced by TOC(=parse byproduct) + anchor(=runtime-located heading). No level-based progressive disclosure, no expansion hints. |
| authority | **Defer end-to-end.** `Source.authority_level` / `authority_scope` → **optional**; stop requiring, displaying, sorting, and gating on them. `authorityConflictWarnings` emitter deleted. |
| ask / claims gate | The `authority_level === "authoritative"` filters in `askAtlas` / `ask` / `claimsLlmShared` / `support` **relax to "use all discovered sources"** — correct because discovery scope already guarantees authoritative. Behaviour change to validate (no low-trust content leak). |
| keep dormant | **Keep** the `AuthorityLevel` type + the `authority_conflict` warning-code slot in the vocabulary (un-emitted). Re-activated later for guidance multi-contributor authority. Delete only the dead emitter. |
| anchor_references | Removed here (it is a `ContextBundle` field). The **inline-locator binding** rewrite itself is 018's anchor "3 去". |

## Surface (where it lands)

- **schema** (`packages/atlas-schema/src/index.ts`): `authority_level?` / `authority_scope?`
  optional on `SourceSchema`; **delete** `ContextBundleResponse` + `disclosure_level` /
  `expansion_paths` / `anchor_references` / the `ContextBundleSource` excerpt wrapper as
  consumers migrate; **keep** `AuthorityLevel` / `authorityLevels` and the
  `authority_conflict` code in `warningCodes`.
- **context-layer**: delete `services/contextBundleService.ts` (incl. `authorityConflictWarnings`,
  `buildAnchorReferences`, `buildExpansionPaths`), `api/contextRoute.ts`, the
  `handleContextRequest` export, `contracts.ts` `ContextLayerContract`, the
  `disclosure_level` compaction in `api/httpRoute.ts`, and the MCP context tool. Drop
  `sourceRepository.findByAuthorityScope` if it loses its last caller.
- **portal — evidence/ask cluster** (migrate to resource-projection *and* drop authority
  display in the same pass): `ask/askAtlas.ts`, `components/evidence/evidence-panel.tsx`,
  `components/detail/evidence-section.tsx`, `components/sources/detail.tsx`.
- **portal — authority residue** (hide/relax): `components/evidence/badges.tsx`
  (`AuthorityBadge`), `components/sources/byclass.tsx` (drop the authority **filter axis**),
  `components/sources/scale.ts`, `lib/evidence.ts` (`AUTHORITY_ORDER` / `authorityRank` /
  authority sort + severity), `components/evidence/warning-stack.tsx` (`authority_conflict`
  display), `components/guidance/shared.tsx`, `routes/catalog.$topicId.tsx`,
  `routes/support.tsx`, `routes/sources.$sourceId.tsx`, `api/server/ask.ts`,
  `api/server/claimsLlmShared.ts`, `api/server/mcp/tools.ts`, `api/server/openapiDocument.ts`,
  `fixtures/contextBundles.ts`, `views/portalViews.ts`.

## Implementation batches (each ends green: `pnpm -r typecheck · lint · test`)

- **B1 — schema authority → optional.** Make `authority_level` / `authority_scope`
  optional; keep `AuthorityLevel` + `authority_conflict` slot. Guard the now-optional
  reads so everything still compiles. Nothing deleted yet.
- **B2 — migrate ContextBundle consumers → resource-projection.** Re-point `askAtlas` /
  `evidence-panel` / `detail/evidence-section` / `sources/detail` at `ResourceContextResponse`,
  dropping `disclosure_level` / `expansion_paths` rendering and `AuthorityBadge` / scope in
  the same files. **Pre-check:** confirm resource-projection already exposes what these
  consumers need (citations, multi-source excerpts, governance/warnings) — if a field is
  missing, that gap is the first task.
- **B3 — delete the ContextBundle contract.** Remove `buildContextBundle` / `contextRoute` /
  `handleContextRequest` / MCP context tool / `contextBundleService.ts`; delete
  `ContextBundleResponse` + `disclosure_level` / `expansion_paths` / `anchor_references` from
  schema; clean `httpRoute.ts`; re-point `contracts.ts`.
- **B4 — authority residue + gate relax.** Hide `AuthorityBadge`/scope, remove the
  `byclass` authority filter axis, drop authority sort/severity in `lib/evidence`, and
  **relax the `=== "authoritative"` gates to "all discovered sources"** in
  `askAtlas`/`ask`/`claimsLlmShared`/`support`. Update MCP/OpenAPI docs + fixtures/views.

## Verification

1. `pnpm -r typecheck && pnpm -r lint && pnpm -r test` green after each batch.
2. `rg -n "buildContextBundle|ContextBundleResponse|/api/context|disclosure_level|expansion_paths|anchor_references"`
   over `context-layer/src` + `portal/src` (excluding tests) → **0** in app code.
3. Portal evidence/ask surface renders via resource-projection only; no AuthorityBadge,
   no disclosure/expansion UI.
4. `AuthorityLevel` type + `authority_conflict` code still present (dormant) — compiles.
5. Ask/claims: with no `authority_level`, all discovered sources feed the LLM; spot-check
   no low-trust/unwanted content leaks (the gate was the only filter).

## Risks

- **Resource-projection coverage.** If `ResourceContextResponse` lacks something the
  ContextBundle consumers relied on (a warning class, multi-source excerpt shape), B2
  grows. Verify coverage before deleting (B3 gated on B2).
- **MCP context-tool retirement** breaks external clients calling the old tool — confirm
  the resource-projection MCP tool is the documented replacement and announce the removal.
- **Gate-relax behaviour change.** Feeding all discovered sources to the LLM is correct
  only under "discovery scope = authoritative"; until 018 enforces that scope, dev/test
  run against MSW fixtures that must stay authoritative-only.
- **Public-safe**: all fixtures stay fictional (no real space keys / page ids / creds).
