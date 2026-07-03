# Goal Prompt: Step 1 — The Governance Gate (I2 + M11)

Implement implementation-plan.md **Step 1**: one `ResolutionContext` factory, the
default-context concept deleted at the type level, scope entering by value or by
reference. Loop until the Definition of Done is green.

Read `docs/architecture/implementation-plan.md` (§2–§4, Step 1),
`docs/architecture/mid-level-design.md` (§1 schema, §10 M11),
`docs/architecture/direction-decision-log.md` (P25–P26) and
`docs/adr/0001-identity-agnostic-bearer-pipe.md` before starting. This prompt is
the executable distillation; on conflict those documents win.

> Layout ruling (owner, 2026-07-04): everything lands **inside `context-layer`**,
> done once — no new package, no interim layout, no follow-up move. The design
> docs' layer numbering (L0–L4) is documentation vocabulary and must not appear
> in code, directory, or symbol names.

## Goal

After this step, an **ungoverned read is unrepresentable** (I2): every handler
requires a `ResolutionContext`, exactly one factory in the whole system can
construct one, and all four entries — HTTP router, Portal in-process client,
Nitro `.md` route, MCP handler — construct through it. Scope arrives by value
(inline manifest declaration, never writes) or by reference (`appId`), with the
`scope_drift` warning on disagreement (M11), in the P26 multi-LZ shape.

```text
portal (loaders · /api bridge · .md route · MCP)
   └── @atlas/context-layer
          ├── createResolutionContext(...)  ← the ONLY producer of a usable ctx
          └── handlers/resolvers            ← ctx REQUIRED, no default anywhere
                 └── @atlas/schema
```

## Current-tree facts (verified 2026-07-04)

- `ResolutionContext` lives at `context-layer/src/resolvers/resolverTypes.ts:54-74`
  (`token?`, `fetch`, `pageCache?`, unwired `scope?: { landingZoneId?, appId? }`).
- The default-context ladder to delete: `defaultResolutionContext()`
  (`resolverTypes.ts:85`), the default parameter at
  `resources/resourceContextService.ts:136`, optional `ctx?` at
  `resources/resourceRoutes.ts:93-96`.
- Governed base to absorb: `cachedResolutionContext(env?)` at
  `sourceContent/sourceContentCache.ts:303-309` (process-shared content cache).
- Bypasses to close: `portal/src/api/server/inProcessContextApi.ts:64-92` (no ctx
  at all); `portal/server/routes/resources/[...].ts:22-27` (`.md` route, no ctx);
  `portal/src/api/server/httpContextApiClient.ts:40-44` (MCP in-process fallback
  silently drops the caller token).
- Governed reference: `context-layer/src/api/httpRoute.ts:116-137`
  (`resolutionContextFromHeaders`).
- Equivalence-test precedent: `portal/src/api/server/contextApiContract.test.ts`
  (compares two HTTP consumers; the in-process-vs-HTTP guard does not exist yet).

## Locked decisions (do not re-litigate)

1. **Everything in `context-layer`, plainly named.** One new file
   `context-layer/src/resolvers/createResolutionContext.ts` holds the factory,
   the brand, `AppDirectoryPort` and its null adapter. Exports
   (`createResolutionContext`, `GovernedResolutionContext`, `AppDirectoryPort`,
   `nullAppDirectoryAdapter`) go through the existing package-root barrel. No
   new workspace package; no directory named after a design-doc layer.
2. **Type-level prohibition via a brand.** A module-private `unique symbol`
   (never exported from the package root) brands the governed type:
   `GovernedResolutionContext = ResolutionContext & { readonly [brand]: true }`.
   The factory is its only value-level producer; handler signatures take the
   branded type **required** — a hand-written object literal no longer
   typechecks. A `@ts-expect-error` fixture proves it. Known and accepted
   boundary: spreading an *existing* governed context preserves the brand in
   TS — not a hole, because governance already happened at its construction;
   what the brand forbids is construction from nothing.
3. **Factory contract** (I2: identity · scope · request cache · credential plane):
   `createResolutionContext({ identity, scope, env? })` where
   `identity: { bearer?: string }` (opaque, unparsed — ADR-0001; Entra arrives
   later as a richer identity input, per `entra-app-scope-implementation-plan.md`
   WS2, not a redesign) and `scope` is one of:
   - by value: `{ kind: "by-value", landingZones: string[], services?: string[] }`
   - by reference: `{ kind: "by-reference", appId: string }`
   - both (caller supplied both): factory scopes by **value** and appends
     `scope_drift` when they disagree (M11 conflict rule)
   - absent: anonymous unscoped context (public reads keep working — open
     discovery posture).
   The factory absorbs `cachedResolutionContext`'s role (process-shared content
   cache wired in). Output seats the **vetted** scope as
   `scope: { landingZoneIds?: string[], appId?: string, origin?: "by-value" | "by-reference" }`
   (P26 set shape; rename the current unwired singular field — it has zero
   readers, verified). The context stays identity-light: no raw principal field.
4. **By-reference resolves through `AppDirectoryPort`.** Step 1 ships the port
   interface plus a **null adapter** (always not-found): an
   unknown/unresolvable `appId` yields a context with no app scope and a
   `scope_unresolved` warning. `selfDeclaredAppsAdapter` + DynamoDB arrive in
   Step 3 — do not build them now. A by-value request **never writes** (M11);
   in Step 1 nothing writes, there is no store.
5. **Warning vocabulary.** Add exactly two codes where the existing warning
   union lives: `scope_drift` (M11) and `scope_unresolved`. They render with the
   existing unresolved/warning display treatment — no new Portal display states.
6. **Delete, don't deprecate** (I2): `defaultResolutionContext` is removed from
   the public surface; every `ctx?`/default-param becomes required, in this same
   step — the compiler surfaces every call site and each one is fixed by
   constructing through the factory, never by re-adding a default. Tests build
   contexts through the real factory (no-creds mock identity is Profile-specific,
   same three-state `DEV_MOCKS` posture). A test-only convenience wrapper is
   allowed only in test utils, itself calling the real factory.
7. **All four entries construct through the factory:**
   - HTTP router: `resolutionContextFromHeaders` delegates to the factory
     (Bearer from `Authorization`; scope from query/body when present).
   - Portal in-process client: builds the same governed context (shared content
     cache; token absent today — honest anonymous; scope from the current LZ
     selector where the loader has one). This closes P10's seam.
   - Nitro `.md` route: factory, with request headers.
   - MCP: the in-process fallback must stop dropping the caller Bearer — thread
     it into the factory input. HTTP mode is already governed; keep it.
8. **Scope rides, nothing reads it yet.** No resolver behavior change in Step 1;
   scoped *answers* are Step 3/4. Availability/LZ behavior is untouched.
9. **Surgical everywhere else.** Resolver logic, providers, parsers, discovery,
   MSW seams: signature-level changes only (required ctx). `pageCache` semantics
   unchanged. No Valkey/infra work. No new sources (P23).

## Constraints

- Public-safe (ADR-0004): fictional data only; no real tenant/tokens.
- Tests-not-gutted: no existing test deleted or weakened to get green; update
  call sites to construct via the factory instead.
- English code/comments; conventional commits are handled by the reviewer —
  implementer leaves the tree uncommitted.
- `pnpm` only. Node/TS toolchain as configured; Vitest 4 colocated tests.

## Definition of Done (acceptance criteria — each maps to a named test)

| # | Criterion | Proof |
|---|---|---|
| D1 | A usable `ResolutionContext` cannot be constructed outside the factory | `context-layer/src/resolvers/createResolutionContext.typecheck.test.ts`: `@ts-expect-error` on object-literal construction; factory path compiles |
| D2 | The default-context ladder is gone | grep-gate test: no `defaultResolutionContext` export from the package root; no optional-ctx defaults in the three named files; brand symbol absent from the root barrel |
| D3 | Previously ungoverned in-process path is governed | `inProcessContextApi.test.ts`: two consecutive reads share the content cache (second is a cache hit — observable via the cache's existing stats surface); context carries factory provenance |
| D4 | MCP fallback threads the Bearer | `mcp.test.ts` (extend): in-process fallback mode, caller Bearer reaches the resolver's ctx.token |
| D5 | `.md` route governed | route test: `.md` render builds through factory (bearer + cache observable) |
| D6 | Scope by value seats P26 shape | factory unit test: `landingZones:["awsf"]` → `scope.landingZoneIds===["awsf"]`, `origin:"by-value"`; never writes (null adapter untouched) |
| D7 | `scope_drift` on disagreement | factory unit test: value + reference disagreeing → value wins + `scope_drift` warning attached to the request result path |
| D8 | By-reference honest-empty | factory unit test: unknown `appId` via null `AppDirectoryPort` → no app scope + `scope_unresolved` |
| D9 | Transport-wiring guard: in-process face ≡ HTTP face | extend `contextApiContract.test.ts`: same resource read through in-process client and `handleHttpRequest` yields identical governed projection; both share cache + thread Bearer |
| D10 | Whole repo green | `pnpm -r typecheck` and `pnpm -r test` pass; no skipped/deleted tests vs. baseline |

## Batches

- **Batch 0 (test author):** `createResolutionContext.ts` with **signatures that
  throw `unimplemented`** (factory, port, null adapter, branded type — existing
  `ResolutionContext` and all existing signatures untouched, repo typecheck
  stays green), plus the full D1–D9 test suite, red for behavioral reasons only.
  Do not implement behavior.
- **Batch 1 (implementer):** factory + brand + scope resolution + warnings
  (D1, D6–D8 green).
- **Batch 2:** delete the default ladder; require ctx through context-layer
  (D2 green; the compiler forces every call site — fix via the factory).
- **Batch 3:** port the four entries (D3–D5 green).
- **Batch 4:** transport-wiring guard (D9), full-repo pass (D10).

## Execution arrangement (owner, 2026-07-04)

Batch 0 (the foundation) is built **once**. Batches 1–4 are built **twice,
independently** — one implementation by a Claude Opus agent, one by Codex
(gpt-5.5, medium) — each in an isolated git worktree forked from the reviewed
Batch-0 commit, both against the same frozen test suite. Fable reviews both,
scores them per the review standard, and merges the winner (grafting superior
fragments from the runner-up where warranted).

## Review gates (Fable)

1. After Batch 0: test suite reviewed against this DoD before implementation
   starts (the tests are the contract; implementers may not edit them — a test
   defect found mid-implementation is reported back, fixed at the gate, and
   re-frozen for both).
2. At DoD: both diffs reviewed per `atlas-review-standard` (boundaries, dead
   code, port design, type safety, barrel hygiene, honest-gap); winner merged
   and committed by the reviewer.

## Revert

The factory file is additive; the default-ladder deletion and entry-point ports
are a commit series on feat/1.0.0 — reverting them restores the current split
without data loss (implementation-plan Step 1 "Revert").
