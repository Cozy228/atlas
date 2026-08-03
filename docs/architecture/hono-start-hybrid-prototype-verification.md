# Hono-hosted TanStack Start Hybrid Prototype Verification

- Verified: 2026-08-02, Asia/Taipei (UTC+08:00)
- Branch: `feat/nitro-removal-migration`
- Comparison reports:
  - `nitro-removal-pre-migration-baseline.md`
  - `nitro-removal-post-migration-verification.md`
- Scope: public-safe local prototype; no cloud deployment or real IAM-authenticated Valkey handshake is claimed

> **Superseded decision record.** This file preserves the measured Start/hybrid experiment. The
> prototype code, prerender artifact, Start runtime, and dual-build host were removed from the final
> worktree on 2026-08-03. The accepted route is documented in
> [`nitro-removal-post-migration-verification.md`](nitro-removal-post-migration-verification.md).

## Decision

Do **not** adopt the optimized hybrid as the final implementation. It remains a successful
performance prototype and a useful fallback if Atlas later gains a hard requirement for
request-specific document SSR. For the current product boundary, its first-paint win does not
justify the ongoing second rendering system.

The rejected prototype was:

```text
ALB -> one ECS task -> Hono Node host
                       |- API, MCP, discovery, health, static assets
                       `- TanStack Start document handler
                            |- initial SSR: in-process PortalDataClient
                            `- browser navigation: Hono HTTP PortalDataClient
                       static artifact: root only; service detail remains request-scoped SSR
```

The measurements remain valid within their stated fixtures: the optimized hybrid materially
improved LCP and approached the SPA's final interaction time. The architecture decision changed
after considering the whole system:

1. Atlas still needs Hono, the Context Layer, explicit browser APIs, and server-side caching under
   every rendering choice; Start does not remove those layers.
2. Hybrid additionally requires isomorphic loaders, SSR serialization/hydration, a custom
   middleware-mode development host, separate application builds, and Start release-candidate
   upgrade/debugging work.
3. The optimized hybrid artifact was 8,952 KiB versus 5,444 KiB for the final Router SPA artifact.
4. Stable, non-personalized first-screen content can be placed directly in the one SPA document,
   producing useful pre-JavaScript HTML without deploying an SSR runtime or build-time live-data
   snapshot.
5. Real Confluence wait remains a data-cache problem. iovalkey Cluster with IAM authentication,
   revision/head validation, and fail-open source reads is required regardless of SSR.

The selected boundary therefore keeps the Context Layer framework-neutral, Hono as the only host,
Router as the browser application, and one meaningful static SPA shell. Request-scoped SSR should
be reconsidered only when a concrete page needs identity-dependent HTML, document status/headers,
SEO, or another behavior that cannot be met by this boundary.

## Historical implemented boundary

- Hono remains the sole Node listener and owns request context, API/MCP/discovery routes, static representations, readiness, drain, and artifact assembly.
- TanStack Start owns document SSR, streaming, hydration, and route-level SSR policy. Nitro is not used.
- Initial server loaders receive a request-scoped, in-process `PortalDataClient`; browser navigation uses the existing Hono HTTP API. There is no server-to-self HTTP loopback.
- Start server functions are not a second API surface.
- Home and service-detail routes use SSR. Other leaf routes are client-rendered inside the server-rendered root shell.
- Home loaders serialize only the small projections rendered by home. They read through the shared
  `PortalDataClient` rather than also dehydrating complete source records into the Query cache.
- The mobile navigation uses the native Popover API and the landing-zone control uses a styled
  native select. The navigation can open before hydration. The landing-zone select now includes
  the complete static topology in SSR HTML, so the browser can open and change it before hydration;
  React application state is intentionally only synchronized after hydration. The smoke suite
  tests those as separate contracts rather than treating a visible control as hydrated state.
- Response completion follows the streaming body lifecycle, so active-request accounting and graceful shutdown do not finish when the handler merely returns a `Response`.
- Development uses one Hono-owned port with Vite middleware and Start SSR module loading. Browser HMR and SSR reload were verified.

## Source-content cache contract

The source-content cache is a read-through performance layer between the Context Layer and
Confluence/Terraform. It is deliberately not a second source of truth:

- generic successful responses use a hard `CACHE_TTL_SECONDS` (default 300 seconds); expired entries
  wait for a new source response and are never served stale;
- Confluence uses a two-tier policy: a cheap page-version head check uses
  `CACHE_VALIDATION_TTL_SECONDS` (300 seconds), while a revisioned storage-body entry uses
  `CACHE_CONTENT_TTL_SECONDS` (7 days). A fresh head must confirm the revision before the body is
  used, so unchanged pages avoid downloading the storage body without making old content current;
- non-OK responses use `CACHE_NEGATIVE_TTL_SECONDS` (default 30 seconds), preventing hot failures
  from repeatedly hitting the source without hiding recovery;
- concurrent misses single-flight per auth-scoped key, and the `Authorization` digest remains part
  of the key so one identity cannot receive another identity's content;
- Valkey read/write failures fail open to the source. A cache outage can reduce hit rate, but it
  cannot turn a live source read into a Portal failure;
- a failed Confluence head check returns `source_unavailable`; it never promotes a stale revision as
  current. External source changes become visible after the next successful head check. There is no
  Atlas content invalidation endpoint because Confluence/Terraform remain the systems of record;
- the production adapter is iovalkey Cluster + SigV4 IAM token generation. It rotates the cluster
  connection every 14 minutes, before the 15-minute token lifetime, and uses `rediss://` TLS. No
  native GLIDE binary or Lambda cache process is part of the ECS image.

Reference discovery intentionally remains a separate contract: it may expose bounded stale state
with `last_observed_at` and a maximum staleness window. That behavior is not applied to source
content or availability evidence.

## Historical verification

| Check                                   | Result                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Portal typecheck                        | pass                                                                                            |
| Portal lint                             | pass                                                                                            |
| Portal tests                            | 230/230 across 49 files                                                                         |
| Production build and exclusion gate     | pass; 282 output entries                                                                        |
| Linux/amd64 ECS image                   | pass; `/`, `/health`, `/openapi.json`, non-root runtime                                         |
| Context-layer cache tests               | pass; 179 tests, head/content, hard TTL, negative cache, single-flight, fail-open, IAM rotation |
| Primary Playwright E2E                  | 31/31; including redirect hydration parity                                                      |
| Production Playwright smoke             | 13/13; server markup, pre-hydration select, first-click controls, hydration, and request budget |
| Production SSR `/`                      | 200; useful home markup present in HTML                                                         |
| Production API `/health`                | 200                                                                                             |
| Browser hydration and client navigation | pass; no console errors                                                                         |
| Development HMR probe                   | pass; visible title update and restore without restart                                          |
| Hydration duplicate HTTP data reads     | none in the cold-home HAR                                                                       |
| Nitro in declared production surface    | absent                                                                                          |

## Profile C result

The same frozen profile was used: Chromium 150.0.7871.124, sitespeed.io 42.5.1 / Browsertime 28.2.0, 600/250 Kbit/s, 350 ms RTT, 8x CPU throttling, and five runs. The controlled source data is fictional. Cold 500 ms runs restarted the Portal process for every iteration. Warm 500 ms runs primed the same in-memory cache contract; they do not claim a real ElastiCache network measurement.

All values are medians in milliseconds.

| Home profile                        |  TTFB |   LCP |  Load | Shell interaction-ready | Primary / final interaction-ready | TBT |    CLS |
| ----------------------------------- | ----: | ----: | ----: | ----------------------: | --------------------------------: | --: | -----: |
| Router SPA, MSW 0 ms                | 1,113 | 6,496 | 5,194 |                   6,214 |                             6,236 |   0 | 0.0564 |
| Hybrid SSR, MSW 0 ms                | 1,343 | 3,884 | 6,821 |                   7,363 |                             7,473 | 128 | 0.0564 |
| Optimized hybrid, MSW 0 ms          | 1,300 | 3,060 | 5,840 |                   6,336 |                             6,414 |  46 | 0.0564 |
| Router SPA, 500 ms cold cache       | 1,129 | 6,584 | 5,284 |                   6,305 |                             8,097 |   0 | 0.0575 |
| Hybrid SSR, 500 ms cold cache       | 1,677 | 4,000 | 7,062 |                   7,454 |                             7,587 | 142 | 0.0569 |
| Router SPA, 500 ms warm cache       | 1,115 | 6,600 | 5,165 |                   6,233 |                             6,262 |   5 | 0.0564 |
| Hybrid SSR, 500 ms warm cache       | 1,354 | 3,984 | 6,851 |                   7,426 |                             7,529 | 186 | 0.0564 |
| Optimized hybrid, 500 ms warm cache | 1,310 | 3,260 | 5,740 |                   5,978 |                             6,097 | 107 | 0.0595 |

The current remote-main SSR control (`origin/main` at `dacfbd6e`) was measured separately with the
same Profile C and the same fictional fixture shape. Its five-run medians were TTFB 1,297 ms, LCP
3,032 ms, Load 8,335 ms, TBT 75 ms, and CLS 0.068. That build has no native hydration/readiness
mark, so a document-start browser probe measured the first catalog-selector state transition as
the final interaction signal: 7,963 ms median. This is a benchmark control, not an application
mark; it is intentionally reported separately from the native hybrid/SPA readiness marks.

An additional 500 ms external-fixture-delay run on the production SSR artifact remained close to
the same visual numbers (TTFB 1,294 ms, LCP 3,068 ms, final probe 8,005 ms). Because `origin/main`
uses deferred/in-process home reads and its production build does not register the MSW plugin, this
run must not be read as an equivalent MSW-500 or real Confluence-latency experiment.
Raw control reports are retained under `/tmp/atlas-ssr-perf-0`, `/tmp/atlas-ssr-probe3-5`,
`/tmp/atlas-ssr-perf-500`, and `/tmp/atlas-ssr-probe3-500`.

Material comparisons:

- Optimized 0 ms hybrid LCP is 3,436 ms faster than the SPA; final interaction is only 178 ms slower.
- Optimized warm-cache hybrid LCP is 3,340 ms faster and final interaction is 165 ms faster than the SPA.
- The optimization improves the original hybrid by 824 ms at 0 ms LCP, 1,059 ms at 0 ms final
  interaction, 724 ms at warm-cache LCP, and 1,432 ms at warm-cache final interaction.
- The optimized 500 ms cold-cache series was not rerun. The retained pre-optimization cold result is
  already 510 ms faster than the SPA at final interaction, but real cache-miss tail latency remains
  a staging concern.
- Under 500 ms controlled source delay, warming the cache reduces hybrid TTFB by 323 ms and server stream completion from about 2.32 seconds to 10-15 ms. Final browser interaction improves by only 58 ms because the constrained network and hydration work hide most upstream latency.
- Real Valkey remains necessary for source-system isolation, throughput, tail latency, and faster-client behavior. The browser optimization removes most of the hydration gap; Valkey addresses the independent source-wait path.

Original raw reports are under `/tmp/atlas-hybrid-perf`. Optimized comparable reports are under
`/tmp/atlas-hybrid-perf-optimized-fixture-0` and
`/tmp/atlas-hybrid-perf-optimized-fixture-500-warm`. The honest-empty reference is under
`/tmp/atlas-hybrid-perf-optimized-final`; it is not used for fixture-backed before/after claims.

## Historical static-prerendered home control

The current Hono host remains the runtime boundary, so the comparison variant is generated with
`pnpm --filter @atlas/portal build:prerender`. The script starts the already-built Hono + Start
document handler once at build time, writes the resulting `/` document to
`.output-prerender/public/index.html`, adds Brotli/gzip representations to the static manifest,
and leaves the normal `.output` untouched. At runtime, only a manifest entry for `/index.html`
activates the root-to-index mapping; `/catalog`, service detail, APIs, MCP, and discovery remain
request-scoped Hono/Start paths. This preserves the Context Layer and Valkey seams and is the
static-safe subset of the broader TanStack Start prerender capability.

The generated root is a deploy-time snapshot, so the build must not carry user tokens or
personalized data. Volatile announcements and availability figures may be stale in the HTML. The
static document marks the `<html>` element with `data-atlas-static-home="true"`; after hydration,
the home runs one active-route invalidation so those volatile loaders read the browser API again.
Request-scoped or identity-sensitive pages must not be added to this variant.

The prototype Docker path ran `pnpm --filter @atlas/portal build:prerender` and copied
`.output-prerender` into the runtime image. The smoke command starts `start:prerender`, so the
artifact that is verified is the same static-home artifact used by the ECS image. The runtime
fallback `start` command and the normal `.output` build remain available for request-scoped SSR
diagnostics.

Implementation verification on 2026-08-03 passed: `build:prerender` produced 282 verified output
entries and a 38,683-byte home document (6,090-byte Brotli, 7,411-byte gzip); production smoke was
13/13, including exactly one post-hydration request each for announcements, availability, and
data-mode; and the `linux/amd64` Docker image served `/`, `/health`, and `/openapi.json` as the
non-root `node` user.
This smoke/build verification does not replace the retained Profile C performance table; the
optimized 500 ms cold-cache series and the real IAM-authenticated Valkey cluster still require a
staging rerun.

The following is a five-run, honest-empty local control using the same Profile C browser conditions
(Chromium 150.0.7871.124, sitespeed.io 42.5.1 / Browsertime 28.2.0, 600/250 Kbit/s, 350 ms RTT,
8x CPU). It is an internal A/B of the two artifacts, not a replacement for the fixture-backed
MSW-0/MSW-500 table above. Raw reports are under `/tmp/atlas-static-vs-hybrid`.

| Home artifact           |           TTFB |            LCP |          Load |    TBT |    CLS |   HTML transfer | JS transfer | Requests / JS |
| ----------------------- | -------------: | -------------: | ------------: | -----: | -----: | --------------: | ----------: | ------------: |
| Runtime Hybrid          |       1,021 ms |       2,800 ms |      5,807 ms |  65 ms | 0.0676 |         40.9 KB |    161.2 KB |        12 / 9 |
| Static-prerendered root |         876 ms |       2,016 ms |      5,444 ms |  91 ms | 0.0676 |          7.2 KB |    161.2 KB |        12 / 9 |
| Change                  | -145 ms (-14%) | -784 ms (-28%) | -363 ms (-6%) | +26 ms |      0 | -33.7 KB (-82%) |           0 |             0 |

The static home improved perceived first paint without changing the browser JavaScript closure or
hydration work. It did not make the page application-interactive before hydration: the native
landing-zone control could change its DOM selection, while the React marker stayed at `awsf` until
the client entry ran. This was the fastest measured hybrid variant, but not the best overall
architecture after maintenance, failure surface, artifact size, and single-deployment simplicity
were weighted alongside LCP.

## Bundle and artifact

| Measure                                              | Router SPA + Hono | Initial hybrid | Optimized hybrid |       Optimized vs initial |
| ---------------------------------------------------- | ----------------: | -------------: | ---------------: | -------------------------: |
| Cold-home browser JS requests                        |                14 |              9 |                9 |                          0 |
| Cold-home browser JS transfer, including HAR headers |     208,377 bytes |  217,385 bytes |    169,064 bytes |           -48,321 (-22.2%) |
| Build static home closure                            |     202,476 bytes |  213,524 bytes |    165,204 bytes |           -48,320 (-22.6%) |
| Built client JS files                                |                55 |             50 |               57 |                         +7 |
| All-client effective transfer                        |     483,917 bytes |  494,191 bytes |    490,549 bytes |             -3,642 (-0.7%) |
| `.output` files                                      |               199 |            248 |              282 |                        +34 |
| `.output` size                                       |         5,444 KiB |      6,616 KiB |        8,952 KiB |          +2,336 KiB (+35%) |
| Old Start/Nitro artifact                             |     about 9.7 MiB |       6.46 MiB |         6.55 MiB | remains materially smaller |

The hybrid artifact increase is the Start SSR server/client runtime, not Nitro. The current ECS
image bundles Start server dependencies into `.output` so the runtime needs no `node_modules`; this
adds server bytes but removes a fragile workspace-runtime dependency. The production verifier permits
Start's internal H3/Srvx/Rou3 dependencies but still rejects actual `nitro`/`nitropack`, Nitro-specific
identifiers, MSW/dev mocks, symlinks, and absolute workspace paths.

For the same fresh `origin/main` SSR build, the cold home made 18 requests (14 JavaScript), with
247.5 KB JavaScript transfer and 368.1 KB total transfer; it produced 51 client JavaScript files,
292 output files, and a 10,644 KiB `.output`. The optimized hybrid is therefore close to SSR on
LCP while shipping 9 initial JavaScript requests / 169,064 bytes and an 8,952 KiB self-contained
artifact.

## Maintainability assessment

The module seam is clean: one shared data-client contract with a browser HTTP adapter and a server in-process adapter. Context Layer remains framework-neutral. Hono and Start do not duplicate public endpoints.

The ongoing cost is real:

- custom Vite middleware-mode development host;
- custom two-server-build artifact assembly;
- stream-aware lifecycle accounting;
- selective SSR and isomorphic-import discipline;
- Start release-candidate upgrade testing;
- a larger server artifact and more complex production debugging.

For the current product boundary, this cost is not justified. The final Router SPA keeps one
artifact and one rendering model, adds a meaningful stable shell to improve the first-screen
experience, and leaves live-data latency to the shared Valkey cache where it belongs. The hybrid
remains evidence for a future decision if a real request-scoped SSR requirement appears; it is not
the default.
