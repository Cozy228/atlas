# MVP handoff — remaining work

Snapshot 2026-06-20. The MVP "done" bar is `mvp-product-design.md` §14. **Deployment is
descoped** (public-safe repo; no live cloud deploy). This file tracks what is reached and the
items the next session should add.

## Reached

- Data control plane: registry is manifest-driven (`data/*.yaml` → `loadRegistryFromManifests`),
  validated by `pnpm validate:registry`; `pilotRegistry.ts` is no longer the runtime source.
- Consumer hero-slice adoption hard gate — **S3 / API Gateway / Textract** — each grounded and
  cited (module + Terraform starter + adoption route + a "User guide" service link). Spec +
  e2e journey: [`api-gateway-adoption-gate.md`](./api-gateway-adoption-gate.md); enforced by the
  `HARD GATE` scenario in `packages/atlas-acceptance`.
- Live-resolution **capability** for Confluence (Cloud Basic auth) and Terraform (GitHub README),
  offline by default: [`../architecture/live-resolution.md`](../architecture/live-resolution.md).
- One authority conflict surfaced (`s3-guardrails`). `pnpm lint` / `typecheck` / `test` clean
  (context-layer 84, portal 96, acceptance 5, schema 32).

## Remaining DoD items (next session adds these)

### 1. Bundle-equivalence suite — ADR-0011 (priority)

- **Why:** §14 "Portal and Skill pass the bundle-equivalence suite." The single explicit DoD box
  with an accepted ADR and no implementation.
- **Current:** no equivalence test. `portal/src/api/server/contextApiContract.test.ts` exists but
  exercises the same client twice — it does not drive the Skill's raw-HTTP path.
- **Build:** for a fixed set of `ContextRequest`s, run (a) the Skill's documented raw-HTTP
  sequence (`portal/public/.well-known/agent-skills/atlas-context-consumer/SKILL.md`) against the
  HTTP Context API, and (b) the Portal in-process path (`portal/src/api/server/inProcessContextApi.ts`
  / context-layer `handleContextRequest`); assert the bundles are field-equal
  (sources / excerpts / citations / warnings / anchor_references; normalize the volatile
  `bundle_id`) and schema-valid. New scenario in `packages/atlas-acceptance` or a dedicated test.
- **Done =** test green in CI.

### 2. Availability from real sources + drift — ADR-0009

- **Why:** §14 item 2 — the availability matrix should resolve from real pages with citations and
  freshness/drift, not a fixture.
- **Current:** `portal/src/api/server/availability.ts` is static `seededAvailability(...)`.
- **Build:** model availability via a Source + a new `availability-cell` parametric anchor
  (ADR-0009); response precision mirrors query precision (cell / row / col); honest dead-end on
  parse failure (never a stale cache).
- **Done =** availability cells resolve from a registered source with citations; drift surfaces.

### 3. Live-resolution real-environment validation

- **Why:** the capability is built but unproven against a real site/repo.
- **Current:** `context-layer/src/sourceContent/{confluenceCloudContentProvider,terraformModuleContentProvider}.ts`;
  runbook `../architecture/live-resolution.md`; offline default; mocked-fetch tests pass.
- **Do:** register a Source whose `location` is a real Confluence page-id / GitHub repo, with an
  anchor matching a real heading; export `CONFLUENCE_BASE_URL` / `CONFLUENCE_EMAIL` /
  `CONFLUENCE_TOKEN` and/or `TERRAFORM_TOKEN`; run dev; confirm the cited excerpt comes
  from the live source. Operator-run (real creds; tokens never committed).
- **Done =** a real page/README excerpt resolves with a live citation.

### 4. TFE / Terraform-registry + Dashboard tail — ADR-0010

- **Why:** §14 item 3 — "TFE module docs resolve as a citable Source; TFE status read-only in the
  Dashboard, honestly labeled if fixture."
- **Current:** live Terraform resolves from a GitHub README; TFC/TFE private-registry is a TODO
  behind the same seam (`terraformModuleContentProvider.ts`); no Dashboard TFE status.
- **Build:** a TFC/TFE registry adapter (module metadata via a `module-field` anchor + README)
  behind the resolver seam; a Dashboard surface showing TFE status read-only (label as fixture if
  not live).
- **Status:** `module-field` resolution is built; the Dashboard TFE-status panel is built
  (`portal/src/components/overview/dashboard.tsx`, fixture-labeled). The live TFC/TFE registry
  adapter is still a TODO behind the resolver seam — operator/live work, same class as item 3.
- **Done =** a module resolves from the registry; Dashboard shows TFE status honestly.

## Descoped

- Deployment / "minimal AWS chain deployed" — not part of the MVP bar.

## Pointers

ADRs `docs/adr/0009..0011`; gate `docs/product/api-gateway-adoption-gate.md`; live runbook
`docs/architecture/live-resolution.md`; open-questions ledger `mvp-product-design.md` §13.
