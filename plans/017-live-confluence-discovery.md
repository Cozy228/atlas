# 017 — Live Confluence discovery adapter

> Status: design (decisions locked in the 2026-06-27 session). This is the **production
> source** behind the ports introduced by [`plans/016`](016-domain-decontamination.md) — the
> live adapter the composition root (`context-layer/src/composition.ts`) swaps in for the dev
> adapter. Dev/test keep the dev seed; this replaces it in prod.

## Goal
Given a Confluence space, auto-discover the pages documenting each platform service and return
them as **reference-only links categorized by doc type**, with ZERO per-service / per-page hand
configuration. The catalog of services is itself derived live from Confluence.

## Locked decisions
| Fork | Decision |
|---|---|
| Runtime / trigger | **On-demand lazy + TTL cache** — discovery runs at resource-detail view time, cached (~10 min); not a periodic crawl, off the hot path after first fill. |
| Catalog spine | **Confluence enumeration** — the service list is derived live from the space, not a hand-authored registry. |
| Service identification | **Derive from doc-title prefixes (zero anchor)** — enumerate pages whose title ends with a known doc-type suffix, strip the suffix; the distinct remainder = the service set. No per-service "landing page" required. |
| Resource → docs mapping | **Title convention + regex categorization** — `space = KEY AND type = page AND title ~ "<service>"` (CQL), then bucket by title suffix into `{tfe-module, design, user-guide, policy, other}`. `~` over-matches → anchor the categorization regex on `<service-prefix> + <doc-type-suffix>`; a service-prefixed page with no recognized suffix falls into `other` (never silently dropped). |
| Content mode | **reference_only** for Confluence (links + metadata; agent cannot read body); **resolved-capable** for TFE module / Git README / Atlas-native guidance. Schema seam: `content_mode: reference_only \| resolved`, `access_mode: public \| user_credentials \| service_credentials` (default reference_only). |
| Service-level metadata (owner/support/lifecycle) | NOT available under prefix-derivation — each needs its own source (availability already has one) or is honest-gapped. |

## Architecture (slots into plan 016 ports)
- Implements the `Registry` / `SourceContentProvider` ports. The composition root wires THIS
  adapter in production instead of the dev adapter — the single swap point; core stays unaware.
- Reuses the existing client stack: `context-layer/src/sourceContent/confluenceCloudContentProvider.ts`
  (`ConfluenceLiveConfig {token, baseUrl, email?}`, Basic-if-email / Bearer, injectable `FetchLike`).
  Discovery hits the **CQL search endpoint** (`GET /wiki/rest/api/content/search?cql=…&cursor=…`,
  v1) — same base URL + auth as the v2 content reads.
- Output maps to the source schema: `title`, `location` (page webui URL), `source_class:
  confluence-page`, `last_observed_at: now`, `observed_version: page.version.number`,
  `content_mode: reference_only`, `access_mode: service_credentials`, plus the categorized
  doc-type. TFE module link is `source_class: terraform-module` (resolved-capable), discovered
  by convention for the MVP and a real TFE-registry query later.

## Config surface (O(1) — the whole point)
| Config | Scale | Home |
|---|---|---|
| Confluence creds (token / baseUrl / email) | O(1), 3 secrets | AWS Secrets Manager |
| Space key(s) | O(spaces), start with 1 | env / config |
| Title convention + doc-type → bucket map | O(doc-type), fixed small set | code/config |
| per-service / per-page / per-section | **0 / 0 / 0** | — |

## Honesty (agent-facing)
- Each discovered doc carries `content_mode: reference_only` + `agent_accessible: false`
  (Confluence body unreadable without user creds); TFE/Git carry `resolved` + `true`. The agent
  never mistakes "a link exists" for "content obtained."
- Missing / unmatched → honest-gap (empty doc list / `other` bucket), never fabricated.

## Consumer UX
- Resource detail renders the categorized **doc-link list** (reference-only) and **replaces the
  current per-source resolved-content panel** for Confluence sources.

## Deploy (PROD on AWS ECS)
- Lazy + TTL in-process within the existing ECS service — zero new infra; the first detail view
  fills the cache, later reads hit the TTL cache. Creds from Secrets Manager via the task role.

## Out of scope / later
- Generic Confluence body parsing / citation (reference-only for now).
- Real TFE-registry integration (convention-discovered link for the MVP).
- Label-based discovery (`label in (...)`) as the robust upgrade to title-convention once the
  content team adopts a labeling convention.

## ADR impact
- ADR-0013: discovery is part of the live projection (the source SET is discovered, not just
  resolved); a Source entering Atlas ≠ its body entering Atlas (reference_only).
- New ADR candidate: convention-driven Confluence discovery (spine + categorization contract).
