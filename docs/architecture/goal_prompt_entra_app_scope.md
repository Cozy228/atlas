---
status: active
review_after: 2026-07-28
---

# Goal Prompt: Entra ID + app-scope enforcement (movable feature, post-Step-3)

> **Status: RATIFIED — review findings applied + Q1 resolved 2026-07-07 (owner).**
> This is the executable distillation of `entra-app-scope-implementation-plan.md` (the
> ratified plan) + its 2026-07-06 mock-boundary exploration + the 2026-07-07
> design-authority hard review (4 blocking findings, all applied below); on conflict the
> plan wins, and the **live tree wins over both**.
>
> **Grounding caveat (read first):** the "Current-tree facts" below were re-verified
> 2026-07-07 against `feat/1.0.0` HEAD `129e36e7`. **Step 6 (`feat/step6-instruments`,
> landed as `8e2b62ab`) and Step 7 (`feat/step7-status-board`) are FULLY merged into
> `feat/1.0.0`** (merge `6696919e`; `OPEN.md` records `pnpm -r typecheck` + `pnpm -r test`
> green: context-layer 392/2skip, portal 168, acceptance 10, schema 80, infra 8 — e2e
> primary not re-run on the integrated tree, green on each parent, merge touched no route
> wiring). **Build precondition (R10):** start only on a pinned `feat/1.0.0` commit where
> this merge is complete and the same green bar holds. **PINNED at kickoff (2026-07-07):
> `06b64e0a`** — `pnpm -r typecheck` + `pnpm -r test` re-run green at this commit
> (portal 168, acceptance 10, context-layer green); delta vs the anchor-verified
> `129e36e7` is docs + two e2e specs only, so all line anchors below remain valid. Step 6 added a `channel` field to
> `createResolutionContext` (`GovernedResolutionContext.channel`,
> `createResolutionContext.ts:53`) and an `/instruments` read surface; Step 7 adds
> self-service location registration + a graph-derived location index (Batches 1-2), m12
> authMode adapters (Batch 3), and the status board (Batches 4-5). None of Step 6/7
> changes the identity seam this slice touches, but every file path + line anchor below
> was re-checked against `129e36e7` — re-verify again if your kickoff commit differs.

Execution arrangement (proposed): single-build (Opus) + Fable/Codex adversarial review,
per Steps 5–6. **Codex is review-only — it never implements**; it produces findings, Fable
triages them, and a separate Opus pass applies any fixes (see "Codex review prompt" at the
end). WS7 (mocks + tests) runs throughout — every workstream ships its mock and its test;
this repo NEVER wires a real tenant (ADR-0004, public-safe).

Read before starting: `docs/architecture/entra-app-scope-implementation-plan.md` (whole),
`docs/architecture/mid-level-design.md` (§1 AppRecord, I2/M11), `docs/adr/`
(ADR-0001 opaque bearer, ADR-0003 status board, ADR-0004 public-safe, ADR-0006 honesty
labels, ADR-0012 open-discovery), `direction-decision-log.md` (P25 identity-as-factory-
input, P30 self-declared fallback landing).

## Goal

After this slice, **a verified Entra identity becomes the first input to the single L2
`ResolutionContext` factory (I2)**, and `visibility:"app"` Sources are served only to a
caller's *verified* APP set behind a **fail-closed** gate — always, regardless of env
configuration (R5) — while non-app Sources (`visibility: internal | restricted`, what the
plan prose calls "public"; see Visibility vocabulary below) stay anonymously reachable at
every entry point (open-discovery, ADR-0012). Self-declared app-scope (already shipped,
P30) continues to work and see non-app Sources only; Entra claims gate visibility, not
scope selection. The repo ships only the generic seam + mock adapters; real Entra/OBO/
Azure adapters are company-side behind `AppDirectoryPort`.

## Three orthogonal axes — DO NOT conflate (plan §"Three orthogonal axes")

1. **scope selection** — anyone may self-declare an APP scope (by-value, M11); legal, sees
   non-app Sources only.
2. **membership gate** — Entra fail-closed; gates *access to `visibility:"app"` Sources*,
   not selection. `AppRecord.membershipSource: none | entra` (default `"none"` — existing
   self-declared records read `"none"`, R14). This is the field the verified-vs-
   self-asserted UI badge reads (WS5, R4) — never `origin`.
3. **content provenance** — `origin` flips to `registry` ONLY when a real registry supplies
   record content, **never** on an Entra claim (decision 9). This drives the content-
   provenance badge only, never the membership badge.

> **A naming collision, not a fourth axis (R4):** `ResolutionContext.scope.origin`
> (`by-value | by-reference`, `resolverTypes.ts:77`) is a THIRD, unrelated concept that
> happens to share the field name `origin` with `AppRecord.origin` (axis 3 above,
> `self-declared | registry`). `scope.origin` records *how* scope entered the factory this
> request (inline manifest vs. directory lookup) — it has nothing to do with content
> provenance. Do not conflate the two `origin` fields when reading or writing code for
> this slice.

## Visibility vocabulary — schema mapping (2026-07-07 review, R1)

The plan prose says `visibility: app (default public)`; the tree has no `"public"`
literal (`visibilityLevels = ["internal", "restricted"] as const`,
`packages/atlas-schema/src/index.ts:18`; `Source.visibility` is required, :90). Ruling:

- Extend the enum to `["internal", "restricted", "app"] as const`. No `"public"` literal
  is added anywhere.
- Everywhere this plan/prompt's prose says **"public"** it means **"any non-app value"**
  (`internal` or `restricted`) — both already openly served today (open-discovery
  posture, ADR-0012); this slice changes nothing about their reachability.
- `restricted` **keeps its current warning-only semantic** — it pushes a
  `restricted_source` honesty warning (`context-layer/src/api/availabilityRoute.ts`,
  `context-layer/src/resources/resourceContextService.ts`) and renders a badge
  (`portal/src/components/evidence/badges.tsx`); it is **never** access-gated. Only
  `visibility: "app"` is access-gated.
- Discovery keeps writing `"internal"` unconditionally
  (`context-layer/src/discovery/deriveGuardrails.ts`,
  `context-layer/src/discovery/deriveResources.ts`) and **never** emits `app_id` —
  discovered content cannot become app-scoped by this slice (plan decision 8's "always
  `visibility: public`" prose reads as "always non-app" under this ruling; unchanged).
- Cross-field invariant: `app_id` present **iff** `visibility === "app"` — enforce with a
  zod `.refine()` on `SourceSchema` (mirrors the existing `.refine()` pattern already on
  `AppUpdateRequestSchema`, `@atlas/schema`).

## Sequencing (re-cut for this goal prompt, plan §"Sequencing re-cut"; step order revised 2026-07-07 review, R3)

Self-declared app-scope has shipped (not Entra work). WS6 infra is **largely landed**
(Valkey serverless + IAM auth + session secret seat already in `infra/`); what remains of
WS6 is owner-side app registration + session-keyspace confirmation. Therefore:

1. **WS2 browser in-process path leads the code work, and now carries the mock
   `registryAppsAdapter`** (moved here from WS4 per R3 — WS2's claims→APP-set mapping
   needs the mock adapter; it cannot wait for step 3). The I2 identity seat is
   `defaultAppDirectory` at `createResolutionContext.ts:94-104` (composes
   `createSelfDeclaredAppsAdapter`; the Entra-era `registryAppsAdapter` swaps this same
   seat behind the same `AppDirectoryPort` — re-verify the exact lines at your kickoff
   commit). Build: mock `registryAppsAdapter` (fictional group → fictional `AppRecord`,
   `membershipSource: "entra"`, **and `origin: "registry"`** — the mock plays the real
   registry's role for tests/dev; decision 9's "only a real registry flips `origin`"
   constrains production composition only, not the mock, R8) → claims → APP set →
   `ResolutionContext.scope`; no HTTP, no JWKS, self-signed mock JWKS exercises the full
   machine-surface validate path. This de-risks what the WS1 cookie/session must carry.
2. **WS1 BFF** — `@azure/msal-node`; Nitro routes `auth/{login,callback,logout}.ts`
   (model on `portal/server/middleware/home-link-headers.ts`); auth-code + PKCE +
   `response_mode=form_post` + **`state`/`nonce` validation** (PKCE covers neither —
   assert it in the E2 round-trip test, R12); certificate credential; session cookie in
   Valkey (id_token claims + refresh token only — decision 7, NO Context-API access
   token); **session-id rotation on login**; guard ONLY app-scoped surfaces (non-app
   stays anonymous); **logout = local session destruction only — no Entra
   front-channel/single-logout this slice** (R12).
3. **WS4** — schema additions (`Source.app_id?` + `visibility` enum extended with
   `"app"`, `AppRecord.membershipSource`) + **introduce the fail-closed gate**: there is
   no existing authz filter function in context-layer to flip — this slice INTRODUCES the
   first enforcement function, seated at the source-listing/resolution seam, applied
   before source-content resolution, shared by every read surface (R2). The mock
   `registryAppsAdapter` and the claims mapping already exist from step 1; this step
   wires them behind the live gate + the selector union. Selector union = claims-derived
   ∪ self-declared, each labeled by **`membershipSource`** for the verified-vs-
   self-asserted badge — **not** `origin`, which stays the content-provenance badge only
   (R4). Only NOW may `visibility:"app"` ingestion turn on (F3-1). WS5 portal
   APP-selector renders off these fixtures.
4. **WS3 is a follow-on, out of this slice** (Q1 resolved, R16) — see "Follow-on (out of
   slice): WS3" below. Everything through WS5 is demoable with zero WS3 progress.

## Locked invariants (from the ratified plan — implement as written)

- **I2 seat, not a route bolt-on:** identity is the factory input, not a second validation
  seam at `httpRoute.ts` (that anchored the pre-P25 tree). `ResolutionContext` stays
  identity-light — carries the vetted `app_id`, not the raw principal; the principal is
  emitted **separately** to consumer-state handlers (feedback, subscriptions, apps
  mutation logging).
- **Confused-deputy rule — ignore, don't reject (R7):** browser routes accept **cookie
  only**; `/mcp`, `/api`, `/resources` accept **Bearer only**. A foreign credential is
  silently IGNORED, never rejected (browsers legitimately attach cookies everywhere,
  e.g. same-site fetches to `/api`) — no endpoint DERIVES identity from both. This needs
  an explicit test: send BOTH credentials to each surface class and assert identity
  derives only from the allowed one (today satisfied only by absence; WS1 cookies
  remove that).
- **Gate gates access, not selection (F3-2):** the gate is a NEW function this slice
  introduces (R2), not a flip of an existing filter. It filters app-scoped Sources by
  the verified APP set before source-content resolution; non-app Sources always visible.
  Its enforcement must hold on EVERY read surface — catalog, briefs, instruments,
  sources/resources detail, changes/Atom feed, availability, MCP tools (R2).
- **Fail-closed + revocation bound (F3-3):** a user removed from an APP retains access
  until session/token refresh. State this staleness bound in the gate module's doc
  comment AND assert/name it in a test — it is part of the gate's DoD proof (R13).
- **Session store is a port (R6):** memory adapter (for tests, so E2 is locally
  provable) + Valkey adapter (prod composition), cloned from the `sourceContentCache`
  factory shape (`sharedCache`/`withCache`,
  `context-layer/src/sourceContent/sourceContentCache.ts`) — not a Valkey-only
  implementation.
- **APP live status stays Portal-native** — action pointers, never an Excerpt, never the
  Context API (ADR-0003/P24; this is Step 7's status board, not this slice).
- **Parameterize issuer/JWKS/authority** — never hardcode `login.microsoftonline.com`
  (testability + sovereign clouds + public-safe mock issuer).
- **Public-safe:** `registryAppsAdapter` is a MOCK (fictional group → fictional AppRecord,
  `origin: "registry"` in the mock only, R8); real adapters company-side, env-configured.
  Dev seam = existing three-state `DEV_MOCKS`.
- **Local mock-Entra is the required dev posture, not just possible (R20):** the ENTIRE
  slice must be demoable and testable locally with ZERO tenant. No-creds `DEV_MOCKS` runs
  a mock signed-in identity + mock APP set via the plan's **Seam B** (resolved-outcome
  mock inside the server-fn branch — no HTTP at all), while the E2 BFF round-trip and E1
  JWKS validation run against a **mock issuer / self-signed JWKS** via the plan's **Seam
  A** (MSW network-level mock; or the injected-authority local fake server if MSAL bypasses
  `globalThis.fetch`, per local-dev risk 2). See plan §"Local mock-boundary exploration"
  for the two seams (do not conflate them). This makes explicit what E1/E2/E6 already
  imply: no build step, test, or demo in this slice may require a real Entra tenant.

## Local-dev risks the build MUST absorb (plan §"Local-dev risks")

1. **`__Host-` cookie needs HTTPS + no Domain** — browsers reject it on plain-HTTP
   `localhost`. Relax prefix/Secure behind the dev seam; prod keeps `__Host-`.
2. **MSAL-node transport unverified** — if it does not use `globalThis.fetch`, the MSW
   Seam-A mock will NOT intercept the token exchange. Verify MSAL's HTTP client first;
   fallback = injected authority URL → local fake server.
3. **Confused-deputy disjointness — ignore, not reject (R7)** — machine surfaces
   (`/mcp`, `/api`, `/resources`) never derive identity from a cookie; browser surfaces
   never derive identity from a Bearer header; the foreign credential is IGNORED, not
   rejected. Add the explicit test: send BOTH credentials to each surface class, assert
   identity derives only from the allowed one.
4. **`ENTRA_*`/`SESSION_*` env are documented in `portal/.env.example` (not a root
   `.env.example`, :88-95) but consumed nowhere** — inert today. Wire them with **loud
   fail-on-half-set** validation (half-configured identity must crash honestly, not
   silently run anonymous).
5. **`selfDeclaredAppsAdapter` is the current `AppDirectoryPort` default** (P30 landing),
   NOT `nullAppDirectoryAdapter` as older plan prose says — the tree is authoritative;
   the Entra adapter is an env-gated swap, not a default replacement.

## Definition of Done (ratified — each maps to a named test)

| # | Criterion | Proof |
|---|---|---|
| E1 | WS2 (now includes the mock adapter, R3): mock `registryAppsAdapter` (behind `AppDirectoryPort`, `origin:"registry"`, R8) → claims → APP set → `ResolutionContext.scope` via the L2 factory; self-signed JWKS validates the machine surface (aud/iss/sig/roles); principal emitted separately | factory + JWKS validator tests |
| E2 | WS1: BFF login/callback/logout round-trip against a mock IdP; `state`+`nonce` validated (R12); session-id rotates on login; session store is a port (memory adapter for tests, Valkey adapter for prod, R6) holding claims + refresh only (no Context-API token); guard covers only app-scoped surfaces; logout = local session destruction only (R12) | BFF round-trip test (mock issuer, memory session adapter) |
| E3 | Confused-deputy: browser=cookie-only, machine=Bearer-only; a foreign credential is IGNORED, not rejected (R7) | test sends BOTH credentials to each surface class; asserts identity derives only from the allowed one |
| E4 | WS4 schema: `Source.app_id?` + `visibility` enum extended with `"app"` (no `"public"` literal, R1), `app_id` ⟺ `visibility==="app"` via zod refine; `AppRecord.membershipSource` (default `"none"`, R14); ONE fail-closed gate function introduced at the source-listing/resolution seam (R2) serves `visibility:"app"` only to the verified APP set; non-app Sources always visible; selector = claims ∪ self-declared, labeled by **`membershipSource`** (verified badge) — `origin` stays the provenance badge only (R4); revocation staleness bound named in the gate's doc comment and asserted in a test (R13) | gate test enumerating a per-surface leak check — catalog, briefs, instruments, sources/resources detail, changes/Atom feed, availability, MCP tools (R2) — plus selector-union test and revocation-bound test |
| E5 | Ingestion boundary: fail-closed ALWAYS, regardless of env configuration — `visibility:"app"` Sources are never served to an unverified caller; identity unconfigured ⇒ verified APP set is empty ⇒ app-visibility Sources invisible everywhere (subsumes F3-1 in-slice, R5); app-visibility test Sources come from WS7 fixtures; the ADR-0007 app-inventory ingestion trigger/cadence stays OUT of this slice (open question 3, gated A2) | ingestion-boundary test (env-unconfigured case + configured-but-unverified-caller case) |
| E6 | Env wiring: half-set `ENTRA_*`/`SESSION_*` fails loud; fully-unset runs anonymous (non-app Sources only); dev seam relaxes `__Host-`/Secure, prod keeps it | composition wiring test |
| E7 | WS5: APP selector lists claims-derived ∪ self-declared; verified badge from `membershipSource`; provenance badge from `origin` (R9 — replaces the prior conditional WS3 row per R16) | component test + one e2e primary spec |
| E8 | Whole repo green relative to the pinned baseline (R11): `pnpm -r typecheck`, `pnpm -r test`, e2e primary; the `OPEN.md` known-RED e2e items (app-declare/status-board reused-server idempotency, the policy click-path gap) must not GROW — fresh-server/CI posture green; public-safe (no real tenant, mocks only); tests-not-gutted | CI-equivalent local run against the pinned commit |

## Follow-on (out of slice): WS3 — Agent / MCP OAuth (Q1 resolved 2026-07-07, R16)

Cut from this slice by owner ruling. Scheduled as a separate goal prompt once the no-DCR
precondition is resolved:

- **Precondition:** Entra has no RFC-7591 dynamic client registration, so arbitrary MCP
  clients cannot self-register. Decide **pre-registered shared public client**
  (auth-code + PKCE) vs a **broker** — a tenant-policy decision folded into the `A1`
  falsification run (agent reachability of `/mcp`).
- Fill `portal/server/routes/.well-known/oauth-protected-resource.ts` (via
  `buildOauthProtectedResource` in `agentDiscovery.ts`) with the Entra
  authorization-server pointer + scopes.
- MCP handler (`mcp/handler.ts`): app-scoped tools emit `401 + WWW-Authenticate →
  Entra`; anonymous/public tools keep serving non-app Sources.
- Everything through WS5 (this slice) is demoable with zero WS3 progress; if agents
  can't complete the flow, app-scoped context stays Portal-only and `P20`
  (agent-call-share) is unmet for exactly `visibility:"app"` content until WS3 ships —
  it is unaffected for non-app content.

## Open questions — non-blocking for this slice (Q1 resolved 2026-07-07, owner, R16)

1. ~~WS3 in or out of this slice?~~ **RESOLVED:** cut this slice at WS5; WS3 (MCP OAuth)
   is a follow-on slice, gated on the A1 no-DCR ruling — see "Follow-on (out of slice):
   WS3" above. Not decided by this build.

2. **Bare-REST app access — promoted externally, or browser + MCP only?** Product
   posture, affects docs only (whether the machine JWKS surface is documented
   publicly) — non-blocking for this slice's build.
3. **App-inventory ingestion trigger + cadence** (ADR-0007 live path) — gated behind
   `A2`; out of this slice by construction (E5, R5) — non-blocking for this slice's
   build.
4. **Two-registration split (OBO)** — revisit only if Portal and Context API must
   diverge; default is single registration / app roles — non-blocking, revisit-only.

## Owner-side real-tenant checklist (blocks only class-c items; not repo work)

Tenant id · client id · registered redirect URI(s) (`form_post`) · confidential-client
certificate (→ existing session-secret seat) · app-role manifest (names/values) · API scope
exposure (`api://…` audience) · MCP public-client / no-DCR policy ruling (WS3 / A1 —
applies to the WS3 follow-on slice, R16, not this build).

## Constraints

English code/comments; `pnpm` only; implementers leave the tree uncommitted; tests-not-
gutted; no new workspace package; the ONLY new runtime dep is `@azure/msal-node` (WS1) and
a JWKS-verify lib if not already present (WS2) — justify each. Surgical: the Step 6
instruments and Step 7 status board stay untouched except where identity legitimately
threads the shared L2 factory.

## Codex review prompt (post-build; review-only — Codex NEVER implements)

> **Hard rule, up front:** Codex **reviews only — it must not write, patch, or fix any
> code**; it returns findings only. Fixes are applied by a separate Opus pass after Fable
> triages the findings. Run this after the build lands, on the pinned base commit + the
> built worktree.

### How to run

Point Codex at the built worktree. Review the **whole slice diff** against the pinned base
commit recorded in the grounding caveat at kickoff (R10):

```
git -C <repo> diff <pinned-base-commit>...<built-worktree-ref>
```

### Ground truth documents (read first; on conflict they win over the code)

- `docs/architecture/goal_prompt_entra_app_scope.md` — THIS ratified goal prompt (Goal,
  Three axes, Visibility vocabulary, Sequencing, Locked invariants, DoD E1–E8, Constraints).
- `docs/architecture/entra-app-scope-implementation-plan.md` — the ratified plan
  (decisions locked, workstreams, the two mock seams).
- `docs/architecture/mid-level-design.md` §1 (AppRecord, I2/M11).
- `docs/adr/`: ADR-0001 (opaque bearer pipe), ADR-0004 (public-safe boundary), ADR-0006
  (honesty labels), ADR-0012 (open-discovery / app-scope).
- the builder's `implementation-notes.md` deviation log. **Verify every claim in it
  against the diff; do not trust it.**

### Your job: try to REFUTE, not to praise

For each finding give: **file:line**, the **concrete failure scenario** (inputs/state →
wrong output), and a **severity**. Default to "this is fine" only after you have actively
tried to break it. Report nothing you cannot tie to a real failure or a stated requirement.

#### Adversarial checklist (this-slice-specific)

1. **Gate leak per read surface (E4 / R2).** For EACH of catalog, briefs, instruments,
   sources/resources detail, changes/Atom feed, availability, MCP tools: can an
   *unverified* caller observe a `visibility:"app"` Source in ANY form — listing, resolved
   content, a count, warning text, a feed entry, a search-index hit? Find a surface that
   resolves or lists Sources WITHOUT passing through the single gate function (a bypass =
   the whole boundary is void).
2. **Fail-closed env matrix (E5 / E6).** Enumerate: identity env fully unset / half-set
   (some `ENTRA_*` present, some missing) / fully set but caller unverified. Does ANY
   combination fall **open** (serves an app Source) or fall **silently anonymous** where
   it should crash **loud** (half-set)? Prove the empty-verified-set ⇒ app Sources
   invisible-everywhere path.
3. **Confused-deputy derive test (E3 / R7).** Is "ignore, never derive" actually enforced,
   or does some middleware read the session cookie on `/api/*` / `/mcp` / `/resources`?
   Does any browser route derive identity from a `Bearer` header? Send BOTH credentials to
   each surface class and trace which one identity actually derives from.
4. **Visibility enum migration fallout (R1).** Existing `visibility` consumers —
   `availabilityRoute`, `resourceContextService`, portal badges + by-class filters, MCP
   tools serializers — does any exhaustive `switch`/enum check break, throw, or mislabel on
   the new `"app"` value? Does the zod `.refine()` (`app_id` ⟺ `visibility==="app"`) hold on
   EVERY write/ingest path, or can a Source be persisted app-visible without an `app_id`
   (or vice versa)?
5. **Axis-conflation regressions (R4).** Does any UI or API read `origin` for the
   verified-vs-self-asserted badge (it must read `membershipSource`)? Does anything flip
   `origin` on an Entra claim (decision 9 forbids it)? Any code path confusing
   `AppRecord.origin` with `ResolutionContext.scope.origin` (`by-value | by-reference`)?
6. **Mock leakage into prod composition (R8 / public-safe).** Can the mock
   `registryAppsAdapter`, the mock issuer, or the self-signed JWKS be selected under a
   PRODUCTION env configuration (creds present, `DEV_MOCKS` off)? Is the mock's
   `origin:"registry"` reachable outside `DEV_MOCKS`/tests?
7. **Session store (R6 / decision 7).** Does the session EVER hold a Context-API access
   token (it must hold id_token claims + refresh token only)? Does session-id rotation on
   login actually rotate the id? Is the TTL honest against token lifetime? Does the memory
   adapter drift in semantics from the Valkey adapter (so tests pass but prod differs)?
8. **OIDC correctness (R12).** Are `state` AND `nonce` actually validated (not just PKCE)?
   `response_mode=form_post` CSRF posture? Is the `__Host-` / `Secure` relaxation strictly
   behind the dev seam, with prod UNrelaxed? Is logout local-session-destruction only (no
   accidental Entra front-channel/single-logout)?
9. **Identity-light rule (I2).** Does `ResolutionContext` carry the raw principal anywhere
   (it must carry only the vetted `app_id`)? Is the principal emitted ONLY to the
   consumer-state handlers (feedback, subscriptions, apps-mutation logging), and nowhere
   near the resolver path?
10. **Tests-not-gutted + honest labels.** Diff the test count vs. base: was any pre-existing
    test skipped, deleted, or weakened to make E8 green? Are the new tests real assertions
    or green-by-construction? Was any honesty signal dropped — `restricted_source` warning,
    the self-declared provenance badge, the `membershipSource` verified badge?

### Review-standard rubric (house style)

Terminology/boundaries, API-map coherence, dead code, seed-coupling, honest-gap labeling,
type-safety (no `any` widening on the claims/APP-set maps or the new `visibility` union),
barrel/`index.ts` export hygiene.

### Output

A ranked findings list (most severe first), each CONFIRMED (you reproduced/traced it) or
PLAUSIBLE (argued, not run). If clean, say so and name what you actively tried to break.
**Findings only — do not implement, patch, or fix.**
