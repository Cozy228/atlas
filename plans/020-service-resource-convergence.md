# 020 — Service-resource convergence (ADR-0015 / plan 015 remainder, reconciled with 019)

> Executes the **still-open core** of [`plans/015`](015-portal-resource-first-ia.md)
> ([ADR-0015](../docs/adr/0015-portal-resource-first-ia.md)) — Portal Resource-first IA.
> Plan 015 is the canonical step list (15a–15g); this plan is the **grounded, do-it-now
> increment** for the service Resources, **reconciled with [`plans/019`](019-contextbundle-retirement-and-authority-defer.md)**
> which already reshaped the ground beneath 015. It supersedes the stale parts of 015's
> 15a / 15d / 15f; it does **not** re-derive ADR-0015. Builds on plan 019 (HEAD `e693e05`).

## Already done before this plan (do NOT redo)

- **15b — addressing unified on `{kind}/{slug}`.** Agent surface is already
  `/api/resources/{kind}/{slug}` + `/resources/{kind}/{slug}.md` (see
  `context-layer/src/api/resourceRoutes.ts`, `openapiDocument.ts`). This plan does **not**
  touch the agent address or re-run the blind-loop (the agent surface is unchanged).
- **`/topics/{id}/context` retired** (019).
- **`s3-guardrails` already Decomposed** → `guardrail/s3-public-access` (record exists, the
  `s3-guardrails` topic resolves to it via aliases; `policies/$policyId` consumes it). The
  guardrail disposition is **closed**.
- **Landing zones removed from the catalog** (019) — 015's `central-landing-zone → Resource`
  disposition is **void**; LZ is availability scope only. No LZ Resource record.

## What this executes

The catalog detail page is still **topic-centric** (`catalog.$topicId.tsx`, keyed by `topic-id`)
and identity metadata still lives on `topics.yaml`. This plan moves the **service** content object
from Topic identity to Resource identity:

1. **15a (services) — author the service Resource records + migrate identity metadata.** For each
   service Topic, create/complete its `resources.yaml` record (`kind: service`, `slug`, `provider`)
   and move identity/presentation metadata (`owner_team` → owner, `support_channel`, `status`,
   `category`, `description`, `entry_tools`) **off the Topic onto the record**. Section→Source
   bindings exist only where governed evidence exists (today: `textract`); other services carry
   **no** bindings and render an honest-empty content body — services are uniform (019), no
   per-service special-casing.
2. **15d (services) — re-key the catalog detail page** from `catalog/$topicId` to the canonical
   `{kind}/{slug}` address; the page composes **record-metadata + live `getResourceContext`** (it
   already reads the resource projection — this is an identity re-key, not a data-source change).
3. **15f (services) — retire & 301 the old service Topic URLs** by disposition; migrate every
   in-Portal link off `$topicId`.

### Service disposition table (the 6 service Topics)

| Topic id | Disposition | Resource address | Note |
|---|---|---|---|
| `aws-textract` | Resource | `service/aws/textract` | record exists; **migrate metadata only** (sections already bound — the governed pilot) |
| `aws-bedrock` | Resource | `service/aws/bedrock` | new record; honest-empty sections |
| `api-gateway` | Resource | `service/aws/api-gateway` | new record; honest-empty sections |
| `aws-s3` | Resource | `service/aws/s3` | new record; honest-empty sections |
| `serverless-compute` | **Decompose** → Resource | `service/aws/lambda` | umbrella is 1:1 with Lambda in the seed; split out Lambda, demote the umbrella to a `topics:` facet label on the record (no own content page) → old URL 301s to the single split-out Resource |

### Security-policy Topics — out of scope here (unchanged this plan)

`s3-guardrails` (closed, see above), `private-networking`, `iam-boundary`, `logging-monitoring`
stay topic-shaped for now. Their Facet pages + the bounded-concurrency aggregate (15e) and the
`iam-boundary` Resource-vs-Facet test are **deferred to 021**. `policies/$policyId` keeps working
as-is.

## Locked decisions (carried from the design pass; flag any to change)

| # | Decision |
|---|---|
| Address | Follow ADR-0015 decision 1/4 — the service content page is the **canonical top-level `/{kind}/{slug}`** (e.g. `/service/aws/textract`), matching the agent address path shape. *(Considered: keep a `/catalog/{kind}/{slug}` prefix for a smaller routing change — rejected as a quiet divergence from the accepted ADR; see Risks for the route-collision handling.)* |
| Metadata home | Migrate identity metadata **onto the Resource record** (ADR-0015 d.1). `getResourceContext` stays content-only; the page composes record-metadata + resolved content. This is the migration's bulk. |
| Honest-empty | Services without governed Source bindings get a record + metadata and render **honest-empty** content sections — uniform service shape (019), not a coverage gate. |
| serverless-compute | **Decompose → `service/aws/lambda`** (1:1 in seed, like LZ's collapse); umbrella demotes to a `topics:` facet label, not its own content page. No "true umbrella split" — if real multi-compute appears, that's a 021 facet. |
| Topic-as-facet | Service Topics demote to thin `topics: [...]` labels on records (ADR-0015 d.3); they keep **no** independent content page after re-key. |
| Source detail | **Unchanged** — `sources/$sourceId` stays the thin registry view 019 made it. The earlier "source document view + per-source live excerpts" idea is **dropped** (it would reverse 019). |

## Invariants to preserve (ADR-0013/0014) — do NOT regress

- **Live projection:** request-time resolution through the shared resolver; no stored excerpts;
  `resolvedAt`, never `generatedAt`. The re-key changes the page's *identity*, not its read.
- **One atomic result, many deterministic assemblers.** The re-keyed page consumes
  `getResourceContext` output verbatim — no re-resolution, no status reinterpretation.
- **Honest empty over fabricated content** for service records lacking governed bindings.

## Migration order — contract-neutral data first, breaking route last

| Step | Scope | Breaking? | Verify |
|---|---|---|---|
| **a** | **Data authoring.** Add the 4 missing service records (`bedrock`, `lambda`, `api-gateway`, `s3`) + complete `textract`; move identity metadata off the service Topics onto records; add `topics: [...]` labels; decompose `serverless-compute` → `lambda`. | No — additive; `catalog/$topicId` still reads Topic metadata until step b. | `data/*.yaml` count-oracle + equivalence-oracle green; every service Topic has exactly one Resource record carrying its identity metadata; existing acceptance (`packages/atlas-acceptance`, `registry-manifest.test.ts`) green. |
| **b** | **Re-key the detail page + compose metadata from the record.** New route at canonical `{kind}/{slug}`; `catalog.$topicId` logic migrated — page reads the Resource record for metadata + `getResourceContext` for content; availability strip + related-guidance + related-in-domain re-resolved by `{kind}/{slug}`. Add in parallel; leave `catalog/$topicId` live. | **Yes** — changes the Portal route identity. | New page is information-lossless vs the old datasheet (specs / entry_tools / availability strip / related guidance / related-in-domain all present); deferred-loading + skeletons do **not** regress to blocking loaders. |
| **c** | **Migrate consumers + clean-remove the old route.** Re-point every in-Portal link (`home/recently-viewed`, `catalog/adopted`, `detail/related-column`, the agent `sitemap.xml`) to `{kind}/{slug}`; **delete** `catalog/$topicId` outright — **no 301/redirect** (dev-stage, no external URLs to preserve; user decision 2026-06-29). Drop the now-dead `landing-zone` RecentItem variant (LZ left the catalog in 019). | **Yes** — removes the old route. | No dangling `$topicId` refs; `pnpm -r typecheck && pnpm -r lint && pnpm -r test && build` green. |

> **Implemented 2026-06-29** — all gates green (typecheck · lint · 68 test files · portal build). Two decisions changed from the draft above: **metadata home = A (full migration now** — a new `getResourceRecord` read contract: schema `ResourceRecordResponse`, `handleResourceRecordRequest`, `/resources/{kind}/{slug}/record`, ContextApiClient + in-process + HTTP + static clients, `resourceRecordQueryOptions`); and **clean removal, no 301** for the old route. The detail route moved `catalog.$topicId.tsx` → `service.$provider.$id.tsx` (canonical top-level `/service/$provider/$id`).

## Out of scope (defer to 021 / decoupled)

- **15e — Facet pages + bounded-concurrency aggregator** (`private-networking`,
  `logging-monitoring`) and the `iam-boundary` Resource-vs-Facet decision.
- **15c — APP-scope seam reservation** and **15g — terminal blind-loop / §26 finalize**.
- **`portal/src/api/server/availability.ts` retirement** — gated on availability-matrix data
  coverage, not on this migration (015 "Out of scope").

## Risks / wiring notes

- **Route collision (decision: top-level `/{kind}/{slug}`).** A top-level splat can collide with
  existing top-level routes (`catalog`, `sources`, `guidance`, `availability`, `policies`,
  `support`). Use kind-prefixed file routes (e.g. `service.$provider.$slug` /
  `guardrail.$slug`) rather than an open `$kind/$slug` splat; verify the generated `routeTree`
  has no ambiguous match. If collision proves costly, the `/catalog/{kind}/{slug}` fallback is the
  escape hatch — but record it as a decision, don't silently diverge.
- **Availability spine keys off Topic id.** `findAvailabilityServiceForTopic`
  (`serverless-compute → lambda`, etc.) maps Topic → availability service. The re-keyed page must
  reach the availability row by `{kind}/{slug}` — add the slug→availability lookup (or carry the
  topic-id facet label through) so the region strip keeps working. This is the most likely
  step-b breakage.
- **Guidance `applies_to` references Topic ids.** Related-guidance association resolves by Topic id
  today; after re-key, resolve guidance via the record's `topics:` facet labels (keep the Topic-id
  link, do not invent a new join).
- **Count/equivalence oracles.** Decomposing `serverless-compute` and adding records shifts the
  seed counts — update the oracle expectations deliberately (they are the guardrail, not noise).
- **Public-safe:** all new records stay fictional (no real provider slugs beyond the established
  `aws/...` sample, no real channels/URLs).
