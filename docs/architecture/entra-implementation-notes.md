---
status: active
review_after: 2026-07-28
---

# Entra + app-scope slice — implementation notes (deviation log)

Work order: `docs/architecture/goal_prompt_entra_app_scope.md` (ratified). Plan:
`docs/architecture/entra-app-scope-implementation-plan.md`. Built on `feat/1.0.0`,
pinned base `06b64e0a` (HEAD `6f61e927`, docs-only on top). Tree left UNCOMMITTED.

The reviewer reads this before the diff. Every claim here is checkable against the diff.

## Decisions (choices the design left open)

- **New runtime deps.** `@azure/msal-node` (WS1 BFF confidential client — named by the
  plan) and `jose` (WS2 JWKS verify + machine-surface token validation; also used by tests
  to mint a self-signed JWKS/JWT with zero tenant). No JWKS/JWT lib pre-existed
  (`grep` of every package.json: no jose/msal/jsonwebtoken). `jose` is the standard,
  dependency-free JOSE implementation and covers both verify (prod) and sign (test-issuer).
- **Verified APP set seat.** The gate needs the caller's verified app membership at the
  resolution seam. `ResolutionContext` gains `verifiedApps?: readonly string[]` (app_id
  strings only — identity-light, no principal). This is axis-2 (membership), distinct from
  `scope.appId` (axis-1 selection). Absent ⇒ empty verified set ⇒ fail-closed.
- **Membership resolution port.** `AppDirectoryPort` gains an optional
  `resolveMembership?(claims)` method (axis 2). The default `selfDeclaredAppsAdapter` does
  NOT implement it (returns nothing ⇒ no verified apps ⇒ app Sources invisible). The mock
  `registryAppsAdapter` implements both `lookup` (axis-1 scope) and `resolveMembership`
  (axis-2 gate). Keeping it optional on the same port honours "a pure adapter swap over the
  same port — no factory signature change" (plan WS4).
- **Gate seat.** The single fail-closed gate is `isSourceVisible` / `gateSources` in
  `context-layer/src/resolvers/appScopeGate.ts`, seated at the ONE place a `Source` object
  is fetched by id before content resolution: `resolveSection`'s
  `deps.registry.sources.getById` (`resourceContextService.ts`), plus every surface that
  lists/serves Sources directly (see "Per-surface gate application" below).

## Per-surface gate application (E4 / R2 — the leak ledger)

Discovery never emits app Sources (always `visibility:"internal"`, never `app_id`), so in
this slice app Sources exist ONLY from WS7 fixtures injected into the `SourceRepository`.
Every `Source` object in the system is minted by the two-method `SourceRepository` port
(`getById`/`list`). The ONE gate function `gateSource`/`gateSources` (reads
`ctx.verifiedApps`) is seated at every site that reads that port:

| Surface | Site | Gate |
|---|---|---|
| resources detail + briefs + MCP resource-context | `resolveSection` `getById` (resourceContextService.ts) | `gateSource` before content resolution; a gated source is dropped from the effective binding list so it skews no `status`/count and emits no warning |
| source listing (`GET /sources`) | `discoverSources` `.list()` (contextService.ts) | `gateSources` — ctx threaded |
| source detail (`GET /sources/{id}`) + MCP `atlas_get_source` | `handleSourceRequest` `getById` (sourceRoute.ts) | `gateSource` — ctx threaded; gated ⇒ 404 `source_not_found` (indistinguishable from absent) |
| availability + MCP `atlas_get_availability` | `handleAvailabilityRequest` `getById` (availabilityRoute.ts) | `gateSource` — ctx already present; gated ⇒ 404 |
| feedback target existence | `handleFeedbackRequest` `getById` (feedbackRoute.ts) | `gateSource` — ctx threaded; closes the existence oracle |
| catalog (`listResourceCatalog`) | projects `ResourceContextRecord[]`, no `Source` | no Source leak by construction — asserted by `appScopeGate.test.ts` "surfaces that never touch a Source" (catalog: serialized output contains no `visibility`/`app_id`) |
| instruments | metrics/events only, no `Source` | no Source leak by construction — asserted by `appScopeGate.test.ts` "the instruments dashboard projects only class/counter aggregates" (serialized `handleInstrumentsRequest` body over an app-context fixture: no `visibility`/`app_id`/app-source id) |
| changes / Atom feed | `ChangeEvent`s cite `rootId` strings, no `Source` object; LZ-scoped | no Source leak by construction — asserted by `appScopeGate.test.ts` "the changes / Atom feed cites roots + subjects" (serialized JSON `handleChangesRequest` + rendered `renderChangesAtom` over an app-scoped ctx: no `visibility`/`app_id`/app-source id) |

`ctx.verifiedApps` is empty unless identity resolved a verified membership ⇒ fail-closed
everywhere by default (E5). The gate's doc comment states the revocation staleness bound.

## Deviations (departures from plan/prompt + why)

- **Gate applied at 5 concrete `SourceRepository`-read sites, not a `getById`/`list`
  signature change.** Plan mused "thread scope into the port OR seat the shared gate at
  each call site". I chose the call-site seating (the plan's option b) because it is
  surgical and keeps the port signature stable; the ctx-less routes
  (`sourceRoute`/`sourceDiscoveryRoute`/`feedbackRoute`) get `ctx` threaded from
  `httpRoute` (where a governed ctx already exists). Rationale logged so the reviewer can
  confirm no Source-read site is left ungated.
- **Machine-surface identity validation is inert unless `ENTRA_*` is configured.** Existing
  tests/dev run ENTRA-unset ⇒ anonymous ⇒ empty verified set ⇒ app Sources invisible
  (fail-closed) ⇒ existing opaque-bearer behaviour unchanged (E6, tests-not-gutted). The
  JWKS validator (E1) is unit-tested against a self-signed JWKS regardless.
- **In-process client channel for status/locations reads is now `"portal"` (was defaulting
  to `"http"`).** The refactor to a single `ctxFor` helper threads the identity claims +
  directory into EVERY read; it also unifies the channel to the client's `channel`
  (`"portal"` by default). This only affects Step-6 instruments face-attribution for
  status/locations (no metric asserts it); harmless. Logged for transparency.
- **`resolveMembership` widened to return `AppRecord[]`** (not `{id}[]`) so the portal can
  build the selector union + badges (WS5). The factory still seats only the id set (I2).
- **MSAL `msalIdpClient` is prod-only and NOT exercised by tests** (public-safe: no tenant,
  ADR-0004). The E2 round-trip runs against a mock `IdpClient`; MSAL sits behind that seam
  (local-dev risk 2: MSAL uses its own HTTP client, so MSW cannot intercept it — the
  interface, not the network, is the testable seam). MSAL manages the refresh token in its
  token cache; it is serialized as the session's refresh material (decision 7: refresh only,
  no access token). Same "real but unexercised-locally" posture as the Valkey adapters.
- **Session store has NO resilient in-memory fallback** (the content cache does). Sessions
  must stay consistent across Fargate tasks, so a Valkey outage fails hard rather than
  silently splitting sessions per task. Divergence from the cloned `sourceContentCache`
  shape, deliberate. The Valkey session adapter (`valkeySessionStore.ts`) is prod-only /
  not unit-tested (no local Valkey), like `valkeyContentCache.ts`.
- **Selector union is assembled in `fetchApps`** (self-declared store ∪ verified registry
  apps from the session), de-duped id-first, verified winning. Inert when Entra unset. This
  wires WS5's "claims ∪ self-declared" at runtime; without it the verified badge would have
  no verified records to render.

## Adjacent-found (untouched)

- **Concurrent external edits in the working tree, NOT part of this slice.** During this
  build the tree also acquired uncommitted changes I did not make: a Step-7 `statusAdapter`
  refactor (`context-layer/src/api/statusRoute.ts`, `locations/statusAdapter.ts`,
  `locations/tfeStatusAdapter.ts`, `locations/adapter.authMode.test.ts`,
  `api/statusRoute.test.ts`) plus a `/gc` run (`OPEN.md`,
  `docs/architecture/implementation-notes-step7.md`, and moving
  `docs/architecture/step7-codex-review-prompts.md` → `docs/archive/reviews/`). These are a
  concurrent session's work; I left them entirely untouched. They typecheck + test green
  alongside my changes. Flagged so the reviewer does not attribute them to this slice.
- Pre-existing OPEN.md items: post-Step-5 policy-detail click-path gap; two pre-existing
  oxlint warnings in `briefs/assembleBrief.ts` + `sourceContent/confluenceOnboardingProvider.ts`.
  Not in scope; untouched. A pre-existing dev-mode React hydration warning in
  `StaleSubgraphBanner` (Step-2, untouched) prints during the e2e webServer boot; not a test
  failure (42/42 e2e passed).

## Open questions

- The machine surface (`httpRoute`) validates the Bearer as an Entra token when `ENTRA_*` is
  configured, but the public repo has no real `registryAppsAdapter`, so machine claims always
  resolve to an EMPTY verified set (fail-closed). Wiring a real machine-surface directory is
  company-side (out of slice). WS3 (MCP OAuth 401 + `WWW-Authenticate`) is the separate
  follow-on that makes the machine surface fully usable — explicitly out of this slice.
- `ENTRA_ISSUER` derivation for the real machine surface is parameterized but the exact real
  Entra v2 `iss` (`.../{tid}/v2.0`) is a company-side detail; the public repo never wires it.
- **HTTP Context-API composition drops browser identity (fail-closed, by design).** When
  `CONTEXT_API_BASE_URL` selects the remote/HTTP branch (`httpContextApiClient.ts`), the
  cookie-derived `claims`/`appDirectory` do NOT propagate to the remote Context API, so a
  verified browser user reads app-visibility Sources as absent (fail-closed). Cross-process
  identity propagation (OBO / two-registration split) is explicitly OUT of this slice (open
  question 4); inventing a claims-forwarding header would be an unauthenticated trust channel,
  so the fail-closed behaviour is CORRECT and stays. The branch emits a once-per-process
  structured WARN (channel `context-api`) when identity is supplied; making the remote
  composition identity-aware is the OBO follow-on.

## E1–E8 self-verification

Baseline (pinned `06b64e0a`, pre-slice): context-layer 392/2skip · portal 168 · schema 80 ·
acceptance 10 · infra 8 · e2e primary green. (The concurrent Step-7 tree raised some counts
before my work landed; the deltas below are the tests THIS slice added.)

Final, all commands re-run at completion:
- `pnpm -r typecheck` → **all 7 projects Done** (green).
- `pnpm -r test` → **green**: context-layer 439/2skip · portal 183 · schema 89 · acceptance
  10 · infra 8 · azure-react-icons 1.
- `pnpm --filter @atlas/e2e e2e` (`DEV_MOCKS=1`, fresh server) → **42 passed** (0 failed;
  known-RED OPEN.md items did not grow).

| # | Criterion | Named test(s) | Result |
|---|---|---|---|
| E1 | mock `registryAppsAdapter` → claims → APP set → ctx; self-signed JWKS validates the machine surface; principal emitted separately (the factory `onPrincipal` sink; the portal consumer is `logMutationAttribution`, wired into apps register/update + feedback submit as I2 attribution logging — the principal never enters ctx/response/store) | `context-layer/src/identity/entraTokenValidator.test.ts` (7), `context-layer/src/resolvers/identityFactory.test.ts` (5), `portal/src/api/server/auth/requestIdentity.test.ts` (attribution block) | PASS |
| E2 | BFF login/callback/logout round-trip vs mock IdP; `state`+`nonce` validated; session-id rotates; store is a port (memory adapter) holding claims + refresh only; logout = local destruction | `portal/src/api/server/auth/bff.test.ts` (7), `context-layer/src/session/sessionStore.test.ts` (4) | PASS |
| E3 | confused-deputy: browser=cookie-only, machine=Bearer-only; foreign credential IGNORED | `context-layer/src/identity/machineIdentity.test.ts` (4), `portal/src/api/server/auth/confusedDeputy.test.ts` (4) | PASS |
| E4 | schema (`app_id`⟺`visibility:"app"`, `membershipSource` default `none`); ONE fail-closed gate on every read surface; selector labeled by `membershipSource`; revocation bound named + asserted | `packages/atlas-schema/src/schema.test.ts` (+7), `context-layer/src/resolvers/appScopeGate.test.ts` (per-surface leak + selector + revocation, ~17) | PASS |
| E5 | fail-closed ALWAYS regardless of env; unconfigured ⇒ empty verified ⇒ app Sources invisible everywhere; configured-but-unverified ⇒ invisible | `appScopeGate.test.ts` "ingestion boundary (E5)" block | PASS |
| E6 | half-set `ENTRA_*`/`SESSION_*` fails loud; fully-unset runs anonymous; dev seam relaxes `__Host-`/Secure | `context-layer/src/identity/entraConfig.test.ts` (10); dev-seam relaxation in `portal/src/api/server/auth/sessionCookie.ts` (`isDevCookieSeam`) | PASS |
| E7 | APP selector: verified badge from `membershipSource`, provenance badge from `origin` | `portal/src/components/landing-zone/app-badges.test.tsx` (7) + e2e `app-declare.spec.ts` (selector, in the 42-pass primary) | PASS |
| E8 | whole repo green vs pinned baseline; known-RED e2e not grown; public-safe; tests-not-gutted | `pnpm -r typecheck` + `pnpm -r test` + e2e primary (all above) | PASS |

## Review fix pass (2026-07-07)

A separate Opus pass applied five design-authority review findings. Surgical — nothing else
touched (the uncommitted doc move + `.claude/standing-rules.md` left alone).

1. **Tx cookie `SameSite` (critical, functional).** `sessionCookie.ts::serializeTxCookie` now
   emits `SameSite=None; Secure` in the NON-dev posture (Lax in the dev seam). The
   `/auth/callback` leg is a cross-site top-level `form_post` POST; browsers do not attach a
   Lax cookie to it, so the tx cookie never arrived and every real login died at
   `callback.ts` "Invalid callback" (400). The form_post/Lax incompatibility is documented in
   the module comment. `sessionCookie.test.ts` (new) asserts the full attribute matrix (dev
   vs prod × tx vs session; the SESSION cookie stays Lax in both).
2. **Mock membership directory no longer leaks into prod (major).**
   `requestIdentity.ts::membershipDirectory()` / `verifiedRegistryApps()` are now gated behind
   the existing three-state dev-mock seam (`resolveDataMode()==="mock"`, `dataMode.ts`). Mocks
   off ⇒ no membership directory (`undefined`) ⇒ the factory default self-declared adapter has
   no `resolveMembership` ⇒ membership resolves empty (fail-closed, honest); the real registry
   adapter is company-side injected. `contextApi.ts` only injects `appDirectory` when defined.
   `requestIdentity.test.ts` (new) proves the mock adapter is unreachable when mocks are off.
3. **R20 Seam-B local mock-identity posture added (major).**
   `requestIdentity.ts::requestBrowserClaims()` now returns a mock signed-in identity (roles
   `["app.orion.member","app.lyra.member"]`, mapping to the mock adapter's Orion/Lyra fixtures)
   as a resolved outcome — no HTTP, no session store — when the dev-mock seam is active AND
   Entra is unset. Real Entra configured ⇒ Seam B inert (session claims only). Consequence
   (intended, demoable): under `DEV_MOCKS=1` the selector union now carries the verified Orion
   /Lyra registry apps; e2e re-run to confirm no spec regressed.
4. **Test gaps vs the DoD closed (major).** (a) Added by-construction leak tests for
   instruments and changes/Atom in `appScopeGate.test.ts` (serialize each surface over an
   app-context fixture; assert no `visibility`/`app_id`/app-source id) — the leak-ledger rows
   above now name their asserting test. (b) Added the BOTH-credentials confused-deputy tests:
   browser side in `confusedDeputy.test.ts` (cookie + Bearer ⇒ identity from the cookie only;
   Bearer untouched), machine side in `machineConfusedDeputy.test.ts` (new — drive
   `handleHttpRequest` with a Cookie + Bearer; identity derives from the Bearer path only, the
   cookie is never consulted). (c) This section + the ledger wording updated.
5. **MSAL cert material fails loud (minor).** `msalIdpClient.ts::createMsalIdpClient` now throws
   `IdentityConfigError` (imported from `@atlas/context-layer`) when `ENTRA_CLIENT_CERT` or
   `ENTRA_CLIENT_CERT_THUMBPRINT` is missing/empty, naming the vars — instead of tolerating a
   missing thumbprint via a raw `process.env` read and dying at first login. The thumbprint is
   threaded through `EntraConfig` (`readEntraConfig` reads `ENTRA_CLIENT_CERT_THUMBPRINT` as an
   optional field alongside `clientCert`). `msalIdpClient.test.ts` (new) covers the throw.

Verification (this pass): see the final message; commands re-run at completion.

## Codex review fix pass (2026-07-07)

A separate Opus pass applied four Codex adversarial-review findings. Surgical — nothing else
touched (the uncommitted doc move + `.claude/standing-rules.md` left alone).

1. **C1 — session store silently in-memory in prod (major).**
   `entraConfig.ts::readSessionConfig` now throws `IdentityConfigError` (naming
   `SESSION_VALKEY_URL` / `CACHE_VALKEY_URL`) when identity is configured AND
   `NODE_ENV === "production"` AND no Valkey URL resolves — otherwise `createSessionStore`
   silently selects `InMemorySessionStore`, splitting sessions per ECS task so logged-in users
   randomly read as anonymous (fail-open; violates E6 loud-fail + R6). Non-production keeps the
   in-memory fallback (tests/dev). `entraConfig.test.ts` gains prod-throw / prod-with-Valkey /
   non-prod-fallback cases.
2. **C2 — serialized MSAL cache leaked access-token material (major).**
   `msalIdpClient.ts` now runs the serialized token cache through `stripToRefreshMaterial`
   before storing it as the session's refresh material: it keeps only `RefreshToken` / `Account`
   / `AppMetadata` and DROPS the `AccessToken` / `IdToken` sections (decision 7 / E2 — refresh
   only, never access-token material). Malformed JSON ⇒ store nothing (`undefined`), never the
   raw blob. Exported pure for tests; `msalIdpClient.test.ts` asserts kept/dropped sections + no
   surviving access-token/id-token secret + the malformed-JSON path.
3. **C3 — HTTP composition drops browser identity = HONEST GAP (major).**
   `httpContextApiClient.ts` HTTP branch now emits a once-per-process structured WARN (channel
   `context-api`) when `claims`/`appDirectory` are supplied — browser identity does NOT
   propagate over the remote Context API and app-visibility Sources stay fail-closed until the
   OBO follow-on. NO behavioural change (fail-closed is correct: forwarding claims would be an
   unauthenticated trust channel; OBO / two-registration split is out of slice, open question 4).
   Documented on the option doc comments + this notes' Open questions.
4. **C4 — principal sink wired to nothing (major).** The factory's `onPrincipal` hook had no
   portal consumer, so `apps.ts` register/update + `feedback.ts` submit ran identity-free
   (violating I2 "the principal is emitted separately to consumer-state handlers: feedback,
   subscriptions, apps mutation logging"). Added `requestIdentity.ts::logMutationAttribution`
   (uses the context-layer pino `logger("consumer-state")`): each handler resolves
   `requestBrowserClaims()` and, when a principal is present, emits ONE structured info line
   (action + target id + subject + name) — attribution logging only. The principal never enters
   the response payload, the ctx, or the store; anonymous ⇒ silent. No schema/response change.
   `requestIdentity.test.ts` asserts the emission-with-claims / silence-when-anonymous pair.

Verification (this pass): see the final message; commands re-run at completion.
