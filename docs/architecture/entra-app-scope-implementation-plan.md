# Entra ID + app-scope enforcement — implementation plan (1.0.0 slice)

Status: active (post-MVP)
Date: 2026-07-03

> **What this is.** The identity + app-scope *enforcement* slice of the ratified 1.0.0
> `implementation-plan.md`. It is realized on the **new spine + Tier-B port** that P25 committed to —
> **not incremental patching of the current tree** (`implementation-plan.md` §Method). Identity is the
> **first input to the L2 governance factory** (`I2`: "one factory constructs the context —
> identity · scope · request cache · credential plane"), so Entra work *is* Step-1 work, not a bolt-on.
>
> **Sequencing is "B → Entra".** App-scope **ships first, self-declared, identity-free** (`M3`/`M11`/
> `P17`: `AppDirectoryPort` + `selfDeclaredAppsAdapter`, `AppRecord.origin='self-declared'`). All
> Application UI/API — brief pages, `/api/briefs/*`, MCP moment tools, APP selector, `/estate`, change
> feed, APP-filtered catalog — is built against that and **does not wait for Entra**. Entra is added
> later as (a) the **identity input** to the L2 factory and (b) an **`AppDirectoryPort` adapter swap**.
> This supersedes ADR-0012's "Entra *gates* app-scope" reading, per the trilogy's newer P17/M3 rulings.
>
> **P30 (2026-07-05) sharpens the framing.** "Ships first, self-declared" does NOT make
> self-declared the anchor — it is the **provenance-less fallback** used while Entra is not yet
> wired. Entra (and repo inference for agents) is the **provenanced main path** for situation
> identity; self-declared/manifest never become the truth or the anchor. Concretely: the
> `AppDirectoryPort` default stays `nullAppDirectoryAdapter` (by-reference honest-empty) until
> the **`registryAppsAdapter`** provides a provenanced identity; `AppRecord.origin:
> self-declared → registry` is exactly the no-provenance → provenanced upgrade this plan lands;
> and `AppRecord` persists as a subscription/feedback anchor (Step 2), not as a stored scope
> declaration.
>
> Builds on [ADR-0012](../adr/0012-app-scoped-entra-identity.md) (app-scope),
> [ADR-0001](../adr/0001-identity-agnostic-bearer-pipe.md) (Bearer pipe),
> [ADR-0007](../adr/0007-runtime-object-ingestion-seam.md) (ingestion seam), and the public-safe
> boundary of [ADR-0004](../adr/0004-public-safe-proof-boundary.md).

## Three orthogonal axes (do not conflate them)

Fable's review turned on keeping these separate. They are:

1. **Scope selection — *which* APP am I looking at.** Legal for **anyone**, no identity: by-value
   manifest (`M11`, zero-registration agent path, acceptance bar D), self-declared APP (`P17`/`P21`
   permanent fallback), or — once Entra is live — a claims-derived APP. Produces a candidate `app_id`.
2. **Membership gate — *may I see this APP's `visibility:app` Sources*.** This is the security
   boundary. Enforced by Entra claims when identity is present; **fail-closed** when it is not.
   It gates **Source access**, never scope *selection*.
3. **Content provenance — where an `AppRecord`'s *content* came from.** `AppRecord.origin`
   (`self-declared | registry`). Flips to `registry` **only when a real registry supplies the record's
   content** (`landingZoneId`, `serviceSlugs`) — **never on the strength of an Entra membership
   claim**, which carries membership, not content (`P14`/`P17`).

Entra touches axes 2 and (later, via a real registry) 3. It does **not** own axis 1.

## Decisions locked

1. **Identity acquisition = in-app BFF (MSAL Node confidential client), NOT Azure Easy Auth.**
   Deployment is AWS ECS Fargate + ALB — **Easy Auth does not exist on AWS**. The app runs the OIDC
   auth-code + PKCE flow itself (`@azure/msal-node`), holds tokens server-side, issues its own session
   cookie. ALB `authenticate-oidc` is rejected: it does not cover the agent (MCP OAuth) path and hands
   the app no clean claims to build scope from — in-app OIDC is needed for agents regardless.
2. **Session store = Valkey.** Sessions are a KV+TTL workload — Valkey's sweet spot — and the code has
   a resilient Valkey adapter (`ResilientContentCache`) to model the store on. DynamoDB-TTL rejected:
   extra store, higher latency, no reuse.
3. **Single Entra app registration → no OBO.** One app both is the browser's OIDC client (id_token) and
   **exposes the Context-API resource** (`api://…/.default` for client-credentials; app roles for the
   machine surface). No cross-audience hop → no On-Behalf-Of. Two-registration split (with OBO) stays a
   documented seam for if the remote/lambda Context API diverges.
4. **App-scope ships first, self-declared, identity-free — Entra is NOT a gate for shipping it.**
   (`M3`/`M11`/`P17`.) Entra later *enforces* scope (axis 2) and, with a real registry, upgrades
   content provenance (axis 3). This replaces the earlier "go straight to app-scope *through* Entra"
   framing.
5. **Certificate credentials, not client secret** (MS-recommended for production confidential
   clients). Auth-code flow uses PKCE + `response_mode=form_post`.
6. **No Atlas-issued PAT** (ADR-0012 decision 4). Every consumer acquires an Entra bearer its own way.
7. **Browser path carries no Context-API access token.** The Context layer runs **in-process** in the
   Portal Nitro server — the browser makes no outbound call to it, so there is nothing to bear a token.
   The BFF session holds **id_token claims + refresh token only** (no access token). Access-token
   acquisition + JWKS validation exist **only on the machine surface** (MCP / CI / remote Context API).
   **App roles is what makes this self-consistent:** roles avoid the ~200-group claims overflow that
   would otherwise force a Graph call the "claims-only" path forbids.
8. **App-scope and discovery are disjoint by provenance — no source→app_id mapping exists.**
   Discovered content (ADR-0016) is **always `visibility: public`, never carries an `app_id`**.
   App-scoped Sources exist **only** via the ADR-0007 ingestion feed, which supplies `app_id` as feed
   metadata. *(This sharpens `P14`; fold back into ADR-0012 as an amendment.)*
9. **`origin` ≠ membership; reuse `AppRecord`.** The APP entity is the trilogy's `AppRecord`
   (`mid-level-design.md` §1: `origin`, `landingZoneId`, `serviceSlugs`) — **not** a second "thin APP"
   shape in `@atlas/schema`. Add `membershipSource: none | entra` as the separate axis-2 property.

## Architecture

```
  scope selection (axis 1) ─ AppDirectoryPort ──┬─ selfDeclaredAppsAdapter   (now;   origin=self-declared)
                                                └─ registryAppsAdapter       (Entra; origin=registry, real registry only)
                                   │ produces candidate app_id
                                   ▼
  membership gate (axis 2) ── L2 governance factory (I2) ── identity in ─┬─ Browser: BFF session (id_token claims), in-process
                                   │ user × app_id → allow/deny          ├─ Machine: Entra access token → JWKS validate (aud, iss, roles)
                                   │ fail-closed for visibility:app      └─ principal → consumer-state writes (feedback/subs/POST /api/apps)
                                   ▼ seats VETTED app_id in ResolutionContext.scope.appId (identity-light: no raw principal)
  source-content ACL ─────── Layer 2 (ADR-0001) opaque bearer, threaded unparsed; service-token fallback; offline map  [UNCHANGED]
```

- **Before Entra (phase B):** the gate is pass-through — everyone selecting an APP sees its public
  Sources; **no `visibility:app` Sources are ingested yet** (see WS4 rule). App-scope is a *filter*.
- **With Entra:** the same seat becomes a *gate* — the authz function enforces `user × app_id`,
  fail-closed for `visibility:app`. Every Application UI/API surface built in phase B is **untouched**;
  it simply starts enforcing and showing verified data.
- Atlas still "does not decide whose identity it is" — it *validates* the Entra token on the machine
  surface and *threads* the opaque Layer-2 bearer. Agents inherit both through the same MCP pipe.

## Workstreams

### WS1 — Identity acquisition (BFF)
- Add `@azure/msal-node`. New Nitro routes `portal/server/routes/auth/{login,callback,logout}.ts`
  (model on the one existing middleware `portal/server/middleware/home-link-headers.ts`).
- Auth-code + PKCE + `response_mode=form_post`; certificate credential.
- Session cookie: `__Host-` prefix, HttpOnly, Secure, SameSite=Lax, rotation on login.
- **Store: id_token claims + refresh token only** (no Context-API access token — decision 7) in Valkey,
  keyed by opaque session id; TTL = token lifetime; silent refresh on expiry.
- **Route guard scope:** guard **only app-scoped surfaces** — public Sources stay anonymous at any
  entry point (ADR-0012 decision 3; open-discovery posture). Do **not** put the whole Portal behind SSO.

### WS2 — Identity into the L2 governance factory (I2)
- Identity is the **first input to the single L2 `ResolutionContext` factory** (Step 1 / `I2`) — **not**
  a second validation seam at a route. (This replaces the earlier draft's bolt-on at
  `httpRoute.ts` — that anchored on the pre-P25 tree the ratified plan rebuilds.)
- **Browser (in-process):** the factory reads the BFF session's id_token claims → resolves the APP set
  → builds `ResolutionContext.scope` directly. No token, no JWKS, no outbound header.
- **Machine (MCP / CI / remote):** the factory's identity input is an Entra access token validated by a
  **JWKS module** (verify `aud` = Context API, `iss`, signature, roles). **Parameterize
  issuer/JWKS/authority** — never hardcode `login.microsoftonline.com` (testability + sovereign clouds
  + public-safe mock issuer).
- **`ResolutionContext` stays identity-light** — it carries the **vetted `app_id`**, not the raw
  principal (`I2`/`M11`). The **principal is emitted separately by the factory to consumer-state
  handlers** that need attribution: feedback, subscriptions, `POST /api/apps` mutation logging (`M3`).
- **Confused-deputy rule:** browser routes accept **cookie only**; `/mcp`, `/api`, `/resources`
  accept **Bearer only**. No endpoint accepts both.

### WS3 — Agent / MCP OAuth
- **PRECONDITION (resolve before shipping WS3):** Entra has **no RFC-7591 dynamic client
  registration**, so arbitrary MCP clients cannot self-register. Decide **pre-registered shared public
  client (auth-code + PKCE)** vs a **broker** — a tenant-policy decision. **Fold this into the `A1`
  falsification run** (agent reachability of `/mcp`, which already gates the trilogy's Step 5). If
  agents can't complete the flow, app-scoped context is Portal-only and **`P20` (agent-call-share =
  the success metric) is dead** for exactly the content this slice serves.
- Fill `portal/server/routes/.well-known/oauth-protected-resource.ts` (via `buildOauthProtectedResource`
  in `agentDiscovery.ts`) with the Entra authorization-server pointer + scopes.
- MCP handler (`mcp/handler.ts`): app-scoped tools emit `401 + WWW-Authenticate → Entra`;
  anonymous/public tools keep serving public Sources.
- Bare REST / CI: no new app code — reuse WS2 validation; caller mints its own token.

### WS4 — App-scope enforcement
- **Reuse `AppRecord`** (`mid-level-design.md` §1). Add `membershipSource: none | entra` (axis 2).
  `origin` (axis 3) flips to `registry` **only** when a real registry supplies record content — never
  on an Entra claim (decision 9).
- Schema: `Source` gains `app_id?` + `visibility: app` (default `public`) in `@atlas/schema`.
- **Ingestion rule (F3-1):** **do not ingest any `visibility:app` Source until the fail-closed gate is
  live.** Before that, either don't ingest app-scoped content, or label it honestly as effectively
  public (ADR-0006) — an ungated `visibility:app` Source is world-readable to anyone who names the APP.
- **The gate gates Source access, not scope selection (F3-2):** by-value (`M11`) and self-declared
  scoping stay legal and see **public Sources only**; Entra claims gate **only `visibility:app`
  visibility**. Context API filters app-scoped Sources by the caller's *verified* APP set before
  source-content resolution; public Sources are always visible.
- **Selector union (F3-2):** the resolvable APP set = **claims-derived ∪ self-declared** (registry
  APPs enforced; self-declared remain as an unverified overlay, labeled by `origin`).
- **Revocation bound (F3-3):** a user removed from an APP retains access until session/token refresh;
  **state this staleness bound** as the fail-closed guarantee's limit.
- **APP live status stays Portal-native** — action pointers, app-filtered, never an Excerpt, never the
  Context API (ADR-0003 / `P24` / ADR-0012 decision 2).

### WS5 — Portal UX (APP-selector)
- Public Sources are visible with no APP. Selecting an APP scopes the moment surfaces (brief pages,
  catalog / guidance / availability filter). The selector lists **claims-derived ∪ self-declared** APPs
  (decision 9 / F3), each labeled by `origin` (verified vs self-asserted, ADR-0006 honesty).
- Reuse existing surfaces behind one scope filter (`scope … filters, never addresses`, ADR-0015).
  Cross-APP aggregate is a later evolution.

### WS6 — Infra
- **Provision Valkey/ElastiCache in Terraform** — `infra/` provisions only DynamoDB (feedback) +
  Secrets Manager today; the app supports Valkey via `CACHE_VALKEY_*` but infra does not create the
  cluster. Add cluster + IAM auth (code already does ElastiCache IAM via GLIDE `ServerCredentials`).
  Session store may share the cluster (distinct keyspace).
- **Secrets:** Entra certificate + session signing key into Secrets Manager (reuse
  `aws_secretsmanager_secret.runtime`; task role already has `secretsmanager:GetSecretValue`).
- **ALB:** HTTPS/ACM already supported (`alb_certificate_arn`); ensure the redirect URI is reachable.
  With a shared Valkey session store, **no ALB stickiness needed**.
- **Entra app registration:** redirect URIs, **app roles** (not raw group claims — decision 7), API
  scope exposure for the machine surface.

### WS7 — Public-safe boundary + tests (ADR-0004)
- This repo ships **only the generic seam + mock adapters**: `registryAppsAdapter` is a **mock**
  (fictional group → fictional `AppRecord`); real Entra / OBO / Azure Resource Graph adapters are
  company-side, env-configured, behind the `AppDirectoryPort`.
- **Dev seam = the existing three-state `DEV_MOCKS` model**: no creds → mock identity + self-declared
  mock APP; real creds → live Entra. Never wire a real tenant into the repo.
- Claim carried by **tests, not a live tenant** (mirror `onboardingGuidance.test.ts` /
  `validate_whatsnew.py` gate style). Include a **mock issuer / self-signed JWKS** to exercise WS2
  validation without a tenant.

## Config / env additions

Added to `portal/.env.example` + read in `context-layer/src/composition.ts`:

| Var | Meaning |
|---|---|
| `ENTRA_TENANT_ID` | Entra tenant |
| `ENTRA_CLIENT_ID` | single app registration |
| `ENTRA_CLIENT_CERT` | confidential-client certificate (Secrets Manager) |
| `ENTRA_REDIRECT_URI` | BFF callback |
| `ENTRA_API_AUDIENCE` | expected `aud` for machine-surface token validation |
| `ENTRA_AUTHORITY` | issuer/JWKS base (parameterized; not hardcoded — WS2) |
| `SESSION_SECRET` | cookie signing key (Secrets Manager) |
| `SESSION_VALKEY_URL` | session store (may reuse `CACHE_VALKEY_URL`, distinct keyspace) |

## Sequencing

This slice presupposes **self-declared app-scope has shipped** (ratified plan Step 3 / `M3`/`M11`) —
that is *not* Entra work. Then:

1. **WS6 + WS1** — Valkey/secrets + BFF login/session against a **mock identity**.
2. **WS2** — identity wired as the L2 factory input; machine-surface JWKS; principal → consumer-state.
3. **`registryAppsAdapter` behind `AppDirectoryPort`** (`membershipSource=entra`) + **flip the authz
   function to fail-closed** (filter → gate). Selector unions claims ∪ self-declared. **Only now** may
   `visibility:app` ingestion turn on (WS4 rule).
4. **WS3** — MCP OAuth — **after** the no-DCR precondition is resolved and folded into `A1`.

(WS7 runs throughout — every workstream ships its mock + test.)

## Open questions (implementation, not architecture)

- App-inventory ingestion trigger + cadence (ADR-0007 live path); gated behind `A2`.
- Live-status proxy failure / degrade behavior.
- Whether bare-REST app access is promoted externally, or only browser + MCP (product posture).
- Two-registration split (OBO) — revisit only if Portal and Context API must diverge.

## Fable review reconciliation (2026-07-03)

Applied from the design-authority review of the prior draft (commit f289807):

- **F1** — re-seated identity as the **L2 factory input (`I2`, Step 1)** on the new spine; removed
  pre-P25 current-tree line anchors (`httpRoute.ts`, `resolverTypes.ts`).
- **F2** — split **content provenance (`origin`)** from **membership (`membershipSource`)**; `origin`
  never flips on an Entra claim (decision 9 / axis 3).
- **F3** — gate rules: no `visibility:app` ingestion before the gate is live; the gate gates **Source
  access, not scope selection**; selector = **claims ∪ self-declared**; **revocation staleness bound**
  stated (WS4).
- **F4** — MCP no-DCR moved from an open question to a **WS3 precondition folded into `A1`**.
- **F5** — dropped the browser access-token store (decision 7 / WS1); **reuse `AppRecord`**
  (decision 9); route guard **only app-scoped surfaces** (WS1); **principal seat** named for
  consumer-state writes (WS2).
