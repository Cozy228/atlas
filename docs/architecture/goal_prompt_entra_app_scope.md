---
status: draft
review_after: 2026-07-28
---

# Goal Prompt: Entra ID + app-scope enforcement (movable feature, post-Step-3)

> **Status: DRAFT — awaiting owner ratification.** Unlike the Step-6 prompt (whose three
> questions the owner pre-answered), the open questions at the end are NOT decided; ratify
> or amend them before a build starts. This is the executable distillation of
> `entra-app-scope-implementation-plan.md` (the ratified plan) + its 2026-07-06
> mock-boundary exploration; on conflict the plan wins, and the **live tree wins over both**.
>
> **Grounding caveat (read first):** the "Current-tree facts" below were true at the plan's
> `c79018f` reading. This prompt is cut while **Step 6 (`feat/step6-instruments @ 8e2b62ab`)
> and Step 7 (`feat/step7-status-board`) are still converging into `feat/1.0.0`.** Every
> file path + line anchor MUST be re-verified at the post-merge `feat/1.0.0` HEAD before
> building — Step 6 added a `channel` field to `createResolutionContext` and an
> `/instruments` read surface; Step 7 adds the location index + self-service registration.
> Both touch seams this slice also touches (the L2 factory, the schema, portal routes).

Execution arrangement (proposed): single-build (Opus) + Fable/Codex adversarial review,
per Steps 5–6. WS7 (mocks + tests) runs throughout — every workstream ships its mock and
its test; this repo NEVER wires a real tenant (ADR-0004, public-safe).

Read before starting: `docs/architecture/entra-app-scope-implementation-plan.md` (whole),
`docs/architecture/mid-level-design.md` (§1 AppRecord, I2/M11), `docs/architecture/adr/`
(ADR-0001 opaque bearer, ADR-0003 status board, ADR-0004 public-safe, ADR-0006 honesty
labels, ADR-0012 open-discovery), `direction-decision-log.md` (P25 identity-as-factory-
input, P30 self-declared fallback landing).

## Goal

After this slice, **a verified Entra identity becomes the first input to the single L2
`ResolutionContext` factory (I2)**, and `visibility:app` Sources are served only to a
caller's *verified* APP set behind a **fail-closed** gate — while public Sources stay
anonymously reachable at every entry point (open-discovery, ADR-0012). Self-declared
app-scope (already shipped, P30) continues to work and see public Sources only; Entra
claims gate visibility, not scope selection. The repo ships only the generic seam + mock
adapters; real Entra/OBO/Azure adapters are company-side behind `AppDirectoryPort`.

## Three orthogonal axes — DO NOT conflate (plan §"Three orthogonal axes")

1. **scope selection** — anyone may self-declare an APP scope (by-value, M11); legal, sees
   public Sources only.
2. **membership gate** — Entra fail-closed; gates *access to `visibility:app` Sources*, not
   selection. `AppRecord.membershipSource: none | entra`.
3. **content provenance** — `origin` flips to `registry` ONLY when a real registry supplies
   record content, **never** on an Entra claim (decision 9).

## Sequencing (re-cut for this goal prompt, plan §"Sequencing re-cut")

Self-declared app-scope has shipped (not Entra work). WS6 infra is **largely landed**
(Valkey serverless + IAM auth + session secret seat already in `infra/`); what remains of
WS6 is owner-side app registration + session-keyspace confirmation. Therefore:

1. **WS2 browser in-process path leads the code work** — the I2 identity seat already exists
   at `createResolutionContext.ts` (re-verify line after merge; Step 6 moved neighbours).
   Build claims → APP set → `ResolutionContext.scope` first; no HTTP, no JWKS, self-signed
   mock JWKS exercises the full machine-surface validate path. This de-risks what the WS1
   cookie/session must carry.
2. **WS1 BFF** — `@azure/msal-node`; Nitro routes `auth/{login,callback,logout}.ts`
   (model on `portal/server/middleware/home-link-headers.ts`); auth-code + PKCE +
   `response_mode=form_post`; certificate credential; session cookie in Valkey (id_token
   claims + refresh token only — decision 7, NO Context-API access token); guard ONLY
   app-scoped surfaces (public stays anonymous).
3. **WS4** — `Source` schema gains `app_id?` + `visibility: app` (default `public`);
   `AppRecord` gains `membershipSource`; mock `registryAppsAdapter` behind `AppDirectoryPort`;
   **flip the authz function filter → fail-closed gate**. Selector union = claims-derived ∪
   self-declared (labeled by `origin`). Only NOW may `visibility:app` ingestion turn on
   (F3-1). WS5 portal APP-selector renders off these fixtures.
4. **WS3 stays last** — MCP OAuth, blocked on the no-DCR precondition folded into `A1`.
   Everything through WS5 is demoable with zero WS3 progress.

## Locked invariants (from the ratified plan — implement as written)

- **I2 seat, not a route bolt-on:** identity is the factory input, not a second validation
  seam at `httpRoute.ts` (that anchored the pre-P25 tree). `ResolutionContext` stays
  identity-light — carries the vetted `app_id`, not the raw principal; the principal is
  emitted **separately** to consumer-state handlers (feedback, subscriptions, apps
  mutation logging).
- **Confused-deputy rule:** browser routes accept **cookie only**; `/mcp`, `/api`,
  `/resources` accept **Bearer only**. No endpoint accepts both — and this needs an
  explicit test (today it is satisfied only by absence; WS1 cookies remove that).
- **Gate gates access, not selection (F3-2):** Context API filters app-scoped Sources by
  the verified APP set before source-content resolution; public Sources always visible.
- **Fail-closed + revocation bound (F3-3):** a user removed from an APP retains access
  until session/token refresh — state this staleness bound as the guarantee's limit.
- **APP live status stays Portal-native** — action pointers, never an Excerpt, never the
  Context API (ADR-0003/P24; this is Step 7's status board, not this slice).
- **Parameterize issuer/JWKS/authority** — never hardcode `login.microsoftonline.com`
  (testability + sovereign clouds + public-safe mock issuer).
- **Public-safe:** `registryAppsAdapter` is a MOCK (fictional group → fictional AppRecord);
  real adapters company-side, env-configured. Dev seam = existing three-state `DEV_MOCKS`.

## Local-dev risks the build MUST absorb (plan §"Local-dev risks")

1. **`__Host-` cookie needs HTTPS + no Domain** — browsers reject it on plain-HTTP
   `localhost`. Relax prefix/Secure behind the dev seam; prod keeps `__Host-`.
2. **MSAL-node transport unverified** — if it does not use `globalThis.fetch`, the MSW
   Seam-A mock will NOT intercept the token exchange. Verify MSAL's HTTP client first;
   fallback = injected authority URL → local fake server.
3. **Confused-deputy disjointness** — add the explicit "no endpoint accepts both" test.
4. **`ENTRA_*`/`SESSION_*` env are documented in `.env.example` but consumed nowhere** —
   inert today. Wire them with **loud fail-on-half-set** validation (half-configured
   identity must crash honestly, not silently run anonymous).
5. **`selfDeclaredAppsAdapter` is the current `AppDirectoryPort` default** (P30 landing),
   NOT `nullAppDirectoryAdapter` as older plan prose says — the tree is authoritative;
   the Entra adapter is an env-gated swap, not a default replacement.

## Definition of Done (draft — each maps to a named test; ratify the list)

| # | Criterion | Proof |
|---|---|---|
| E1 | WS2: mock claims → APP set → `ResolutionContext.scope` via the L2 factory; self-signed JWKS validates the machine surface (aud/iss/sig/roles); principal emitted separately | factory + JWKS validator tests |
| E2 | WS1: BFF login/callback/logout round-trip against a mock IdP; session in Valkey (claims + refresh only, no Context-API token); guard covers only app-scoped surfaces | BFF round-trip test (mock issuer) |
| E3 | Confused-deputy: browser=cookie-only, machine=Bearer-only; no endpoint accepts both | explicit disjointness test |
| E4 | WS4 schema: `Source.app_id?` + `visibility:app` (default public), `AppRecord.membershipSource`; fail-closed gate serves `visibility:app` only to verified APP set; public always visible; selector = claims ∪ self-declared, labeled by origin | gate + selector-union tests |
| E5 | Ingestion boundary: no `visibility:app` Source is ingested/served until the gate is live (F3-1); ungated app content is labeled honestly public | ingestion-boundary test |
| E6 | Env wiring: half-set `ENTRA_*`/`SESSION_*` fails loud; fully-unset runs anonymous (public only); dev seam relaxes `__Host-`/Secure, prod keeps it | composition wiring test |
| E7 | WS3 (if in scope this slice): app-scoped MCP tools emit `401 + WWW-Authenticate → Entra`; public tools keep serving; `.well-known/oauth-protected-resource` filled | mcp handler test — GATED on A1 no-DCR ruling |
| E8 | Whole repo green: `pnpm -r typecheck`, `pnpm -r test`, e2e primary; public-safe (no real tenant, mocks only); tests-not-gutted | CI-equivalent local run |

## Open questions — DECIDE BEFORE BUILD (owner)

1. **WS3 in or out of this slice?** WS3 is blocked on the no-DCR precondition (pre-registered
   shared public client vs broker — a tenant-policy call) folded into the `A1` falsification
   run. If A1 hasn't run / the policy isn't decided, cut this slice at WS5 (browser + machine-
   REST demoable, P20 agent-share deferred) and schedule WS3 separately. **Recommend: cut at
   WS5 now; WS3 as a follow-on gated on A1.**
2. **Bare-REST app access — promoted externally, or browser + MCP only?** (product posture;
   affects whether the machine JWKS surface is documented publicly.)
3. **App-inventory ingestion trigger + cadence** (ADR-0007 live path) — gated behind `A2`;
   likely out of this slice, confirm.
4. **Two-registration split (OBO)** — revisit only if Portal and Context API must diverge;
   default is single registration / app roles.

## Owner-side real-tenant checklist (blocks only class-c items; not repo work)

Tenant id · client id · registered redirect URI(s) (`form_post`) · confidential-client
certificate (→ existing session-secret seat) · app-role manifest (names/values) · API scope
exposure (`api://…` audience) · MCP public-client / no-DCR policy ruling (WS3 / A1).

## Constraints

English code/comments; `pnpm` only; implementers leave the tree uncommitted; tests-not-
gutted; no new workspace package; the ONLY new runtime dep is `@azure/msal-node` (WS1) and
a JWKS-verify lib if not already present (WS2) — justify each. Surgical: the Step 6
instruments and Step 7 status board stay untouched except where identity legitimately
threads the shared L2 factory.
