# Entra ID app-scope identity — implementation plan (executes ADR-0012)

Status: active (post-MVP)
Date: 2026-07-03

> This plan **executes** [ADR-0012](../adr/0012-app-scoped-entra-identity.md) (app-scoped Entra
> identity, previously *proposed*). It resolves the AWS-specific and infra decisions the ADR left
> open and commits to going **straight to app-scoping** — not a login-only first slice. It builds on
> [ADR-0001](../adr/0001-identity-agnostic-bearer-pipe.md) (Bearer pipe), the `ResolutionContext.scope`
> seam of [ADR-0017](../adr/0017-landing-zone-discovery-root.md), and the public-safe boundary of
> [ADR-0004](../adr/0004-public-safe-proof-boundary.md).

## Decisions locked (resolving ADR-0012's open forks)

1. **Identity acquisition = in-app BFF (MSAL Node confidential client), NOT Azure Easy Auth.**
   ADR-0012 wrote "Easy Auth / BFF", but the deployment is AWS ECS Fargate + ALB — **Easy Auth does
   not exist on AWS**. The app runs the OIDC auth-code + PKCE flow itself (`@azure/msal-node`,
   `ConfidentialClientApplication`), holds all tokens server-side, and issues its own session cookie.
   ALB `authenticate-oidc` is rejected: it does not cover the agent (MCP OAuth) path and hands the app
   no clean claims to build app-scope from — in-app OIDC is needed for agents regardless, so run it
   in-app for everything.
2. **Session store = Valkey** (owner: Valkey is available). Sessions are a KV+TTL workload — Valkey's
   sweet spot — and the code already has a resilient Valkey adapter (`ResilientContentCache`) to model
   the store on. No new store type, lower latency than DynamoDB. DynamoDB-TTL rejected: extra store,
   higher latency, no reuse.
3. **Single Entra app registration → no OBO.** One Entra app plays both roles: the browser's OIDC
   client (returns an id_token whose claims build the scope — decision 7) and the Context-API resource
   that machine callers (MCP / CI) request an access token for. No cross-audience hop exists, so
   On-Behalf-Of is unnecessary. OBO stays a documented seam for a later split into two registrations
   (e.g. if the remote/lambda Context API diverges), not built now.
4. **Go straight to app-scoping.** The destination is ADR-0012's core (`visibility: app` Sources,
   `user → APP`, APP-selector Portal), not a bare SSO gate. Phases below are execution ordering, not a
   deferral of app-scope.
5. **Certificate credentials, not client secret** (MS-recommended for production confidential clients).
   Auth-code flow uses PKCE + `response_mode=form_post`.
6. **No Atlas-issued PAT** (ADR-0012 decision 4, unchanged). Every consumer acquires an Entra bearer
   its own way; Atlas validates and threads it.
7. **Browser path carries no Context-API access token.** The Context layer runs **in-process** in the
   Portal Nitro server, so the browser never makes an outbound HTTP call to it — there is nothing to
   bear a token. The BFF session holds the **id_token claims only** (+ refresh token, for membership
   freshness); the browser request builds `ResolutionContext.scope` **directly in-process, with no JWT
   re-validation**. Access-token acquisition + JWKS validation exist **only on the machine surface**
   (MCP / CI / any remote/lambda Context API).
8. **App-scope and discovery are disjoint by provenance — there is no source→app_id mapping to invent.**
   Discovered content (Confluence reference discovery, ADR-0016) is **always `visibility: public`,
   never carries an `app_id`**. App-scoped Sources exist **only** via the ADR-0007 app-inventory
   ingestion feed, which supplies `app_id` as feed metadata. The two source classes never overlap;
   `app_id` is a property of the *ingestion provenance*, not something derived from content.

## Architecture: two identity layers, in series

```
                 ┌─────────────── Layer 1: Entra app-scope (which Sources you may see) ──────────────────┐
 Browser  ─BFF─▶ │  session (id_token claims) ─▶ scope built IN-PROCESS · no access token · no revalidate │
 Agent    ─MCP─▶ │  401 + WWW-Authenticate ─▶ Entra access token (aud=Context API) ─▶ JWT validate        │
 CI/REST  ─────▶ │  client-credentials / device-code ─▶ Entra access token ─▶ JWT validate                │
                 │        claims resolve user → {APP set};  app_id is a per-request parameter              │
                 └────────────────────────────────────────────────┬──────────────────────────────────────┘
                                                                   ▼  filter app-scoped Sources by app authz
                 ┌─────────────── Layer 2: ADR-0001 opaque bearer (may you read each source) ──────────────┐
                 │        threaded unparsed to source systems; service-token fallback; offline map          │
                 └───────────────────────────────────────────────────────────────────────────────────────────┘
```

The two layers are **orthogonal and additive**. Layer 1 (new) resolves *which* Sources are visible
from the caller's APP set — on the **machine surface** it is a validated Entra access token (aud =
Context API); on the **browser surface** it is the in-process session claims, no token, no
re-validation (decision 7). Layer 2 (existing, ADR-0001) is the opaque source-content bearer,
unchanged. Atlas still "does not decide whose identity it is" — it *validates* the Entra token on the
machine surface and *threads* the opaque one. Agents inherit both through the same pipe the MCP
handler already threads (zero new mechanism in `mcp/handler.ts`).

## Workstreams

### WS1 — Identity acquisition (BFF)
- Add `@azure/msal-node`. New Nitro routes `portal/server/routes/auth/{login,callback,logout}.ts`.
  The only existing Nitro middleware is `portal/server/middleware/home-link-headers.ts` (the
  `(event, next)` chain) — model the auth middleware on it.
- Auth-code + PKCE + `response_mode=form_post`; certificate credential.
- Session cookie: `__Host-` prefix, HttpOnly, Secure, SameSite=Lax, rotation on login.
- Store: id_token claims + Context-API access token (+ refresh token) in Valkey keyed by opaque
  session id; TTL = token lifetime; silent refresh on expiry.
- **Route guard**: `beforeLoad` on protected TanStack routes → redirect `/auth/login`; server
  functions validate the session server-side.

### WS2 — Entra identity → scope (two transports, one authz model)
- **Browser (in-process):** the BFF session's id_token claims resolve the user's APP set; the server
  fn (`portal/src/api/server/contextApi.ts`) builds `ResolutionContext.scope` **directly — no access
  token, no JWT validation, no outbound header**. (This drops the prior draft's "attach a Context-API
  access token outbound"; decision 7.)
- **Machine (HTTP — MCP / CI / remote/lambda Context API):** **new JWT validation module** (Entra
  JWKS fetch+cache; verify `aud` = Context API, `iss`, signature, roles/scopes) at the HTTP boundary
  `context-layer/src/api/httpRoute.ts:111-133`. A **new layer in series** with ADR-0001's "thread
  unparsed" — it validates the Entra token and resolves the APP set; it does **not** replace the
  opaque source-content bearer (Layer 2). Parameterize issuer/JWKS/authority — never hardcode
  `login.microsoftonline.com` (testability + sovereign clouds + public-safe mock issuer).
- Both transports converge on **one authorization function** — `user × requested app_id → allow/deny`
  — which seats the **vetted** `app_id` in `ResolutionContext.scope.appId`. `ResolutionContext` stays
  identity-light: it carries the already-authorized `app_id`, not the raw principal.
- **Confused-deputy rule:** browser routes accept **cookie only**; `/mcp`, `/api`, `/resources`
  accept **Bearer only**. No endpoint accepts both.

### WS3 — Agent / MCP OAuth
- Fill `portal/server/routes/.well-known/oauth-protected-resource.ts` (via
  `buildOauthProtectedResource` in `portal/src/api/server/agentDiscovery.ts`) with the Entra
  authorization-server pointer + scopes (currently a generic empty shell — `bearer_methods_supported:
  ["header"]` only).
- MCP handler (`portal/src/api/server/mcp/handler.ts`): app-scoped tools emit `401 +
  WWW-Authenticate → Entra`; anonymous/public tools keep serving public Sources (open discovery
  preserved).
- Bare REST / CI: **no new app code** — reuse WS2 validation; caller mints its own token
  (client-credentials service principal, or device-code for a human at a CLI).

### WS4 — App-scoping (ADR-0012 core)
- **Provenance invariant (decision 8):** discovered Sources (ADR-0016) are **always
  `visibility: public`, no `app_id`**. App-scoped Sources exist **only** via the ADR-0007
  app-inventory ingestion feed, which supplies `app_id` as feed metadata. No content→app_id inference
  anywhere.
- Schema: `Source` gains `app_id?` + `visibility: app` (default `public`). Thin APP entity (≈ Entra
  group/app-role id + display name). Land in `@atlas/schema` per the schema-vs-seed split.
- Context API filters app-scoped Sources by the caller's APP set **before** source-content
  resolution; public Sources are always visible. Seat the vetted `app_id` in
  `ResolutionContext.scope.appId` (`context-layer/src/resolvers/resolverTypes.ts:54-73` — slot already
  reserved).
- **Fail-closed:** an anonymous / unauthenticated caller sees **only public (discovered) Sources**;
  app-scoped Sources are invisible. This differs from Layer-2's service-token fallback, which stays
  open for public content.
- `user → APP` membership: from Entra claims (**app roles vs group claims** — see open questions).
- **APP live status stays Portal-native** — action pointers, app-filtered, never an Excerpt, never
  the Context API (ADR-0003 / ADR-0012 decision 2).

### WS5 — Portal UX (APP-selector-first)
- Login → "the APPs you belong to" → pick one → existing surfaces (catalog / guidance / availability
  / …) filtered by that `app_id`. Single-focus; reuse existing surfaces behind one scope filter.
  Cross-APP aggregate dashboard is a later evolution, not the entry shape.

### WS6 — Infra
- **Provision Valkey/ElastiCache in Terraform** — `infra/` currently provisions only DynamoDB
  (feedback) + Secrets Manager; the app supports Valkey via `CACHE_VALKEY_*` env but infra does not
  create the cluster. Add the cluster + IAM auth (the code already does ElastiCache IAM via GLIDE
  `ServerCredentials`). Session store may share the cluster or use a dedicated one (separate keyspace).
- **Secrets**: Entra certificate + session signing key into Secrets Manager (reuse
  `aws_secretsmanager_secret.runtime` pattern; task role already has `secretsmanager:GetSecretValue`).
- **ALB**: HTTPS/ACM already supported (`infra/variables.tf` `alb_certificate_arn`); ensure the
  redirect URI is reachable. With a shared Valkey session store, **no ALB stickiness needed**.
- **Entra app registration**: redirect URIs, app roles / scopes, **group claims** (for `user → APP`).

### WS7 — Public-safe boundary + tests (ADR-0004)
- This repo ships **only the generic OIDC-shaped seam + a mock APP fixture** (one fictional APP + fake
  topology). Real Easy-Auth-equivalent / OBO / Azure Resource Graph adapters are company-side,
  env-configured.
- **Dev seam = the existing three-state `DEV_MOCKS` model**: no creds → mock identity + mock APP;
  real creds → live Entra. Never wire a real tenant into the repo.
- The claim is carried by **tests, not a live tenant** (mirror `onboardingGuidance.test.ts` /
  `validate_whatsnew.py` gate style).

## Config / env additions

Named by source system, added to `portal/.env.example` + read in `context-layer/src/composition.ts`
(the env-composition seam):

| Var | Meaning |
|---|---|
| `ENTRA_TENANT_ID` | Entra tenant |
| `ENTRA_CLIENT_ID` | app registration (single, shared audience) |
| `ENTRA_CLIENT_CERT` | confidential-client certificate (Secrets Manager) |
| `ENTRA_REDIRECT_URI` | BFF callback |
| `ENTRA_API_AUDIENCE` | expected `aud` for Context-API token validation |
| `SESSION_SECRET` | cookie signing key (Secrets Manager) |
| `SESSION_VALKEY_URL` | session store (may reuse `CACHE_VALKEY_URL` cluster, distinct keyspace) |

## Sequencing

1. **WS1 + WS6 (Valkey + secrets)** — BFF login/session working end-to-end against mock identity.
2. **WS2** — machine-surface JWT validation + browser in-process scope; live Entra behind creds.
3. **WS4** — `visibility: app` schema + Context-API app filter; `ResolutionContext.scope.appId` seated.
4. **WS3** — MCP OAuth challenge + discovery metadata; agents inherit app-scope.
5. **WS5** — APP-selector Portal shell over the now-scoped surfaces.
   (WS7 runs throughout — every workstream ships its mock + test.)

## Open implementation questions (from ADR-0012, not architecture)

- `user → APP` membership: **app roles vs group claims** (group claims overflow at ~200 groups + leak
  all tenant groups; app roles need admin assignment but are clean and app-scoped). Lean: app roles.
- **Entra ↔ MCP OAuth gap:** Entra has no RFC-7591 dynamic client registration, so external MCP
  clients may need a pre-registered `client_id` — the "401 → point at Entra → done" flow is not
  fully turnkey. Document the pre-registration step or front an intermediary.
- App-inventory ingestion trigger + cadence (ADR-0007 live path).
- Live-status proxy failure / degrade behavior.
- Whether bare-REST app access is promoted externally, or only browser + MCP (product posture).
- Single- vs two-registration split (OBO) — revisit only if Portal and Context API must diverge.
