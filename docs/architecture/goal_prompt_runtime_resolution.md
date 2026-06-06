# Goal Prompt: Runtime Confluence Resolution via Bearer Pipe

Implement live, ACL-aware Confluence Cloud excerpt resolution behind the
existing Context API. Loop until the Definition of Done is green.

Read `docs/architecture/mvp_next_steps.md`, `CONTEXT.md`, and
`docs/adr/0001-identity-agnostic-bearer-pipe.md` before starting. This prompt is
the executable distillation of those.

## Goal

When Portal or a Skill requests a context bundle, the Context Layer resolves
`confluence-page` excerpts **live from Confluence Cloud v2** at request time,
threading the caller's opaque Bearer token (or a narrow service-token fallback)
all the way to Confluence, so Confluence's own ACL governs what comes back. No
hardcoded excerpt map on the live path.

```text
browser → Portal server fn → HTTP Context API (Authorization: Bearer)
  → Lambda handler → resolver(ctx) → Confluence Cloud v2 API → excerpt + citation
```

## Locked decisions (do not re-litigate)

1. **Identity-agnostic Bearer pipe.** Read the `Authorization` header, thread it
   unparsed and unpersisted to Confluence. Token resolution order:
   `ctx.token` → server-side narrow-scoped `ATLAS_CONFLUENCE_TOKEN` → offline
   pilot map. Atlas never decides whose identity it is; Confluence enforces ACL
   against whatever identity the token represents (see ADR-0001). How each
   consumer obtains a per-user token (Portal OAuth, Agent config) is out of scope.
2. **Live/offline branch lives inside the `confluence-page` resolver** — not in
   `resolveAnchor`, not in `contextBundleService`. terraform/policy untouched.
3. **Confluence Cloud only**, REST v2
   `/wiki/api/v2/pages/{id}?body-format=storage`. Server/Data Center is out of
   scope (leave a generic adapter boundary + TODO).
4. **Schema:** add exactly one **optional** field `observed_version` to
   `SourceSchema`. `ContextRequest` stays untouched; Portal and Skill keep sharing
   the same `@atlas/schema` request contract.
5. **Caching (ElastiCache) is phase 2.** Build and verify the live path first.

## Constraints (from repo CLAUDE.md + mvp_next_steps.md)

- Public-safe: fictional names, generic sample data; no real token / page id /
  company content in the repo.
- No durable ingest of full source content. Runtime excerpts are ephemeral.
- Confluence calls happen server-side only (Lambda / Portal server fn). Token and
  source content must never reach the browser bundle.
- Surgical changes: keep `pilotSourceContent` as the offline/test fallback; do
  not delete it. Every changed line traces to this goal.
- Reuse existing warning codes; invent no new Portal display states.

## Two credential planes (keep separate)

| Plane | Credential | Trigger | Granularity |
|---|---|---|---|
| Health / lifecycle (mvp Step 2) | service credential | background | metadata only |
| **Runtime excerpt resolution (this goal)** | caller's Bearer when supplied, else narrow service-token fallback | per request | as fine as the supplied token — per-user only when the consumer supplies a per-user token |

This goal implements only the second plane. Atlas's job is the pipe, not the
identity.

## Confluence result → behavior (reuse existing codes)

| Confluence result | Atlas behavior |
|---|---|
| 401 / 403 | `restricted_source` warning (or `403 access_denied` on explicit source request) |
| 404 page | `source_unavailable` |
| anchor heading not found / matched-but-empty | `broken_anchor` |
| live `version.number` > recorded `observed_version` | `stale_source`, message "changed since registration" |

`changed_detected` is **not** a warning code — it is an internal lifecycle state
in `mvp_next_steps.md`. Drift reuses `stale_source` and its existing Portal
display state, distinguished only by the warning `message`. With no recorded
`observed_version`, drift never fires (no false positives).

## Implementation batches

### Batch 1 — Thread a request-scoped context (no behavior change)

- `resolvers/resolverTypes.ts`: make `AnchorResolver.resolve()` return a
  `Promise`; add `ctx: ResolutionContext` (`{ token?: string; fetch: FetchLike }`,
  extend later) to `ResolveRequest`; extend the `ResolverWarning` union with
  `restricted_source` so a resolver can name a runtime ACL denial directly (the
  bundle service already passes `resolved.warnings` through verbatim).
- `resolvers/resolveAnchor.ts`: becomes async (await the provider). No token logic.
- `services/contextBundleService.ts`: make `buildContextBundle` async; thread
  `ctx` into every `resolver.resolve(...)` call.
- `api/contextRoute.ts`: `handleContextRequest(request, ctx?)` becomes async.
  `ctx` is **optional**, defaulting to an offline context
  (`{ token: undefined, fetch: globalThis.fetch }`) so existing callers/tests that
  pass no `ctx` keep working and fall back to the pilot provider. **Remove the
  `resolver.resolve(...)` call from `validateExplicitRequest`** — keep only the
  cheap registry checks there (`topic_not_found`, `source_not_found`, static
  `visibility === "restricted"` → `403 access_denied`, without touching
  Confluence). Add a **post-build promotion**: for an explicit `source_id`
  request, scan `bundle.warnings` and promote `restricted_source` → `403
  access_denied`, `broken_anchor` → `422`, `source_unavailable` → `503`. This
  guarantees a single Confluence call per explicit request (no double-fetch).
- `api/httpRoute.ts` + `lambda/handler.ts`: add `headers` to the HTTP request
  shape; read the `Authorization` header; build `ctx`; pass it into
  `handleContextRequest(request, ctx)`.
- `portal/src/api/server/inProcessContextApi.ts` (offline in-process client):
  just `await` `handleContextRequest` and pass no `ctx` (offline → pilot).
- All existing resolvers (`terraform`, `confluence`, `policy`) keep working
  against the pilot content provider — they just ignore `ctx` for now.

**Verify:** `pnpm test` green; existing context-layer + portal suites pass
unchanged. No excerpt behavior changed yet.

### Batch 2 — Confluence Cloud live provider

- Add `context-layer/src/sourceContent/confluenceCloudContentProvider.ts` (async):
  - **Token:** `ctx.token` if present, else server-side narrow-scoped
    `ATLAS_CONFLUENCE_TOKEN`, else defer to the pilot provider.
  - Call `GET /wiki/api/v2/pages/{source.location}?body-format=storage`.
  - **Parsing:** parse `body.storage.value` with a tolerant HTML parser
    (`node-html-parser` — pure JS, lenient about Confluence `<ac:*>` tags). Match
    the anchor by **slugified heading text** (pilot locators like
    `environment-matrix` are heading-text slugs). Take content from the matched
    heading until the next heading; `.text` for the excerpt; matched-but-empty →
    `broken_anchor`.
  - **Citation:** build `citation.location` from the response `_links.webui`
    prefixed with `ATLAS_CONFLUENCE_BASE_URL` (a real clickable page URL),
    appending the heading anchor when available; fall back to `/wiki/pages/{id}`.
  - **Drift:** read `version.number`; if `source.observed_version` exists and is
    older, emit `stale_source` ("changed since registration").
- Wire it into the `confluence-page` resolver (the live/offline branch lives
  inside that resolver); keep `pilotSourceContent` as fallback when no token /
  no base URL is configured.
- Config: `ATLAS_CONFLUENCE_BASE_URL` (site base) + `ATLAS_CONFLUENCE_TOKEN`
  (narrow-scoped fallback). No secrets in repo.

**Verify (committed tests, mocked `fetch` via `ctx.fetch`, fictional data):**
1. success — known page + anchor → expected excerpt + clickable citation.
2. 401/403 → `restricted_source` (or `access_denied` on explicit source request).
3. 404 → `source_unavailable`.
4. missing anchor heading → `broken_anchor`.
5. live version > `observed_version` → `stale_source` ("changed since registration").
6. offline (no token/base url) → falls back to pilot provider, suite stays green.

### Batch 3 — Portal forwards whatever token it has

The Portal forwards the token it holds for the request, not necessarily a
per-user one: once Atlassian OAuth is wired it is the logged-in user's token;
until then there is none and the Context Layer applies the narrow service-token
fallback. Acquiring a per-user token is out of scope (see ADR-0001).

- `portal/src/api/server/contextApi.ts`: extract any caller token from the
  incoming request (`getWebRequest()` headers) in each server fn; pass it down.
- `portal/src/api/server/httpContextApiClient.ts`: accept a per-request token and
  set `Authorization: Bearer <token>` on every outbound call **when present**.
- Set `ATLAS_CONTEXT_API_BASE_URL` so Portal defaults to the HTTP client.

**Verify:** a contract test proves Portal and Skill send the same request shape
(token attached when present) and receive the same bundle shape; the token never
appears in any browser-facing output.

### Batch 4 (deferred) — ElastiCache runtime cache

Only after Batches 1–3 are green. Wrap the Confluence provider with a cache that:

- keys by `hash(token/userId) : source_id : anchor_id : version` — **never share
  cache entries across identities** (cross-identity sharing would bypass Confluence ACL).
- short TTL (60–300s); invalidate on version change; encrypted in transit + rest;
  cache only excerpt fragments, never whole pages; miss always re-fetches.

## Definition of Done

Two verification layers — keep them distinct:

**Committed (automated, fictional data, `pnpm test` green):**
- No hardcoded excerpt map is on the live path (pilot map is fallback only).
- New branch tests exist with mocked `fetch`: success, 401/403, 404, broken
  anchor, drift (`stale_source`), offline-fallback.
- A contract test proves Portal and Skill share one bundle shape; the token never
  reaches the browser bundle.
- `ContextRequest` schema is unchanged. `SourceSchema` gains exactly one new
  optional field, `observed_version`.

**Manual local smoke (one-time, NOT committed — no real token / page id / company
content enters the repo):**
- With a developer token, a real Confluence Cloud page resolves into a cited,
  clickable excerpt via the full chain.
- A page the supplied token cannot see returns a `restricted_source` warning, not
  content. (This per-identity guarantee holds only for the identity in the
  supplied token; under the service-token fallback, visibility is service-level —
  see ADR-0001.)
