# Nitro Removal Post-Migration Verification

- Status: complete on the migration branch
- Verified: 2026-08-01, Asia/Taipei (UTC+08:00)
- Migration commit: `ca3725d4bca5642e6f572a1c91a7c217b4a950ab`
- Performance-remediation code commit: `1584b418`
- Branch: `feat/nitro-removal-migration`
- Comparison baseline: `docs/architecture/nitro-removal-pre-migration-baseline.md`

This document records the final verification of the Router-only SPA and Hono runtime. It follows the frozen pre-migration command ledger and behavioral inventory. It does not claim a cloud deployment, production traffic, authenticated company behavior, or real-user performance.

## 1. Result

The migration is complete and accepted on this branch:

- Nitro, TanStack Start, server functions, Start SSR, and the H3 compatibility boundary are absent from the production runtime.
- Hono owns the Node listener, HTTP routes, request context, static serving, deployable artifact, readiness, structured request logs, and graceful shutdown.
- Vite owns the client build and development UI process; Hono is a separately watched development API process.
- The Portal build produces a self-contained Atlas-owned `.output` directory and rejects forbidden runtime surfaces.
- All repository checks, Portal primary E2E tests, production smoke tests, Linux/amd64 container probes, Terraform validation, route/static/MCP matrices, blank-output portability checks, and process-lifecycle checks passed.
- The retained five-iteration Profile C SPA journey improved every measured click-to-primary-content median relative to the frozen Nitro baseline.

## 2. Frozen-ledger rerun

Commands were executed from a clean dependency install against the final remediation code commit.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | pass; 0.88 s; no lockfile mutation |
| `pnpm -r typecheck` | pass |
| `pnpm -r lint` | pass |
| `pnpm -r test` | pass; 438 tests |
| `pnpm --filter @atlas/context-layer build:lambda` | pass; Node 22 target |
| `pnpm --filter @atlas/portal build` | pass; output verifier accepted 199 entries |
| `pnpm --filter @atlas/e2e doctor` | pass; system Chrome 150.0.7871.187 |
| Primary Playwright suite | pass; 31/31; 21.3 s |
| Production smoke suite | pass; 10/10; 5.6 s |
| `terraform fmt -check`, `init -backend=false`, `validate` | pass; AWS provider 5.100.0 |

Default unit and integration counts were:

| Workspace | Result |
| --- | ---: |
| `@atlas/infra` | 4 passed |
| `@atlas/schema` | 25 passed |
| `azure-react-icons` | 1 passed |
| `@atlas/context-layer` | 173 passed across 34 files |
| `@atlas/portal` | 230 passed across 47 files |
| `@atlas/acceptance` | 5 passed |

## 3. Production HTTP and artifact checks

The production route matrix returned the expected content and status for `/`, `/health`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/openapi.json`, `/api/internal/openapi.json`, all four well-known discovery routes, `/api/*`, `/resources/*`, and `/mcp`.

The representative hashed JavaScript asset passed all retained representation checks:

- identity, gzip, and Brotli negotiation;
- representation-specific ETags and `Vary: Accept-Encoding`;
- `Last-Modified` and conditional 304;
- `HEAD` without a body;
- satisfiable 206 and unsatisfiable 416 byte ranges;
- one-year immutable caching;
- direct missing-asset 404 without SPA fallback.

Final artifact inventory:

| Artifact | Value |
| --- | ---: |
| `.output` entries | 199 |
| `.output` files | 199 |
| `.output/public` files | 155 |
| `.output/server` files | 43 |
| gzip sidecars | 44 |
| Brotli sidecars | 44 |
| Client JavaScript files | 55 |
| `.output` size | 5,444 KiB |
| `.output/public` size | 3,076 KiB |
| `.output/server` size | 2,364 KiB |
| Context Lambda size | 1,896 KiB |

No symlink, special filesystem entry, absolute source path, Start/Nitro import, MSW/dev-mock import, or development environment reachability was found in the deployable output.

Retained SHA-256 values:

- `.output/server/index.mjs`: `9c38989206c43fb9a5dbc4be68dab677afa5747c151b870356f8c49b77680fbf`
- `.output/BUILD_METADATA.json`: `7811c6a58c5ee20e479802f0eb52cc3843b46da22b63ce04ecac89c83d40886b`
- Context Lambda `handler.mjs`: `6e872cff2c1f10e37e0ddf99914cccae7eb1e4e193a83b4845d582d37ef370fa`

## 4. Runtime and deployment checks

The final image was built for Linux/amd64 with pnpm 11.8.0 and ran as the non-root `node` user (`uid=1000`). Its `/health` Docker health check became healthy. Home, OpenAPI, missing-route, and static-representation probes passed inside the final runtime shape. The image contained only the self-contained application directory and no symlinks.

`SIGTERM` stopped the container in 0.15 s with exit code 0 and `OOMKilled=false`. Additional automated lifecycle cases passed for idle shutdown, keep-alive connections, active API requests, active MCP requests, forced shutdown deadlines, invalid `PORT`, invalid shutdown timeout, and corrupt manifests. A copied `.output` tree also started from a blank directory, served health and home, and exited 0 on `SIGINT`.

Terraform now uses `/health` for the ALB target health check, a 30-second deregistration delay, a 30-second ECS stop timeout, and the Linux x86_64 runtime platform.

## 5. MCP compatibility

The live protocol matrix preserved the frozen permissiveness and error semantics:

- `initialize` accepts JSON-RPC 1.0 and a missing `jsonrpc` field;
- id-less notifications return 202 with an empty body;
- unknown id-bearing methods return JSON-RPC `-32601`;
- `tools/list` with a null id returns the four read-only tools;
- batch input returns HTTP 400 with `-32600`;
- malformed JSON returns HTTP 400 with `-32700`;
- `GET /mcp` returns HTTP 405 with `-32000`.

## 6. Profile C performance comparison

The final journey used the same severely constrained Profile C as the frozen baseline: 600/250 Kbit/s, 350 ms RTT, 8x CPU throttling, sitespeed.io 42.5.1, Browsertime 28.2.0, Chromium 150.0.7871.124, and five iterations. A frozen fictional fixture API supplied the same public-safe data shape.

All values below are five-run medians in milliseconds. Negative deltas are improvements.

| Edge | Nitro shell / primary | Hono SPA shell / primary | Delta shell / primary |
| --- | ---: | ---: | ---: |
| Home → Catalog | 333 / 2,065 | 287 / 1,863 | -46 / -202 |
| Catalog → capability | 267 / 1,953 | 261 / 1,649 | -6 / -304 |
| Capability → Sources | 241 / 1,268 | 222 / 1,150 | -19 / -118 |
| Sources → supporting source | 258 / 275 | 239 / 256 | -19 / -19 |
| Supporting source → Back | 91 / 99 | 63 / 74 | -28 / -25 |

No measured warm-route primary-content median regressed; the provisional `+500 ms` route regression gate therefore passed. Back navigation added zero resource requests in all five runs and restored the measured scroll position.

Cold home changed more substantially because the architecture intentionally changed from SSR to a client-rendered shell. Profile C medians were TTFB 1,156 ms, FCP/LCP 6,768 ms, load 5,131 ms, TBT 7 ms, and CLS 0.084. Compared with the frozen cold-home baseline, TTFB increased 332 ms and FCP/LCP increased 4,052 ms, while load improved 1,270 ms and TBT improved 52 ms. This cold-content regression is explicitly accepted here as the documented cost of removing SSR; it must remain visible rather than being presented as performance parity.

All five application journeys completed and produced per-edge HTML and trace artifacts under `/tmp/atlas-final-perf-results-ca3725d/profile-c-final-rerun2`. As in the frozen Profile C capture, sitespeed.io's downstream Coach/HAR aggregation reported `PageIndex out of range` after Chrome soft-navigation pages and measured aliases diverged. The application journey and custom timings are retained, but the aggregate sitespeed run is not described as wholly green.

## 7. Invariant disposition

| ID | Disposition after migration |
| --- | --- |
| B01-B03 | pass; frozen install, recursive checks, and independent Node 22 Lambda build |
| B04 | intentionally changed; one Portal command builds the client and Hono deployable output, with no SSR |
| B05-B10 | pass; portable output, port binding, shutdown, route coverage, Hono routes, and Context API seam |
| B11 | intentionally changed; `/` is a static SPA shell and retains discovery `Link` headers, but is not server-rendered |
| B12 | retired; Start serialization and hydration transport no longer exist |
| B13-B20 | pass; static representations, mock boundary, and MCP compatibility |
| B21 | accepted deployment change; ALB health moved from `/` to explicit `/health`, while `/` remains 200 |
| B22-B25 | pass; one-directory image, CI topology, system-browser policy, and process cleanup |

## 8. Intentional semantic changes

- Document routes return the SPA shell and client routing owns page not-found behavior.
- Direct missing assets return a plain 404 instead of falling through to an SSR document.
- Start SSR, streaming, hydration serialization, server functions, middleware, and request context are removed rather than recreated.
- `nitro.json` is replaced by Atlas-owned `BUILD_METADATA.json` and an explicit static manifest.
- Readiness has an explicit `/health` contract and returns 503 while draining.

These differences are the approved Router-only boundary. They are not accidental parity gaps.

## 9. Performance remediation follow-up

- Verified: 2026-08-01, Asia/Taipei (UTC+08:00)
- Remediation commits: `060062ba` through `1584b418`
- Runner: the same Profile C network and CPU constraints as Section 6

The post-migration cold-load findings were fixed and remeasured. Production home no longer
requests data mode or landing zones. The service-detail loader validates the primary record before
starting the remaining expensive reads, then runs those valid-record reads in parallel. Motion,
Sonner, and Zod are absent from the successful passive home dependency closure. Native readiness
marks distinguish React interaction readiness from the later point at which both live home-data
regions have settled and committed.

### 9.1 Cold home and controlled source delay

The 0 ms and cold 500 ms rows are five-run medians. Every cold 500 ms iteration restarted the
Portal process so neither source-content cache nor in-flight state could leak between runs.
The warm 500 ms row is a three-run median after explicitly priming both home API paths. It uses the
in-memory implementation of the same cache contract; it does not measure a real ElastiCache
network hop.

| Profile C home | TTFB | FCP / LCP | Load | Shell ready* | Data interaction / primary ready | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Hono SPA before remediation | 1,156 ms | 6,768 / 6,768 ms | 5,131 ms | not instrumented | not instrumented | 7 ms | 0.084 |
| Remediated, MSW 0 ms | 1,113 ms | 6,496 / 6,496 ms | 5,194 ms | 6,214 ms | 6,236 ms | 0 ms | 0.0564 |
| Remediated, MSW 500 ms, cold server cache | 1,129 ms | 6,584 / 6,584 ms | 5,284 ms | 6,305 ms | 8,097 ms | 0 ms | 0.0575 |
| Remediated, MSW 500 ms, warm source cache | 1,115 ms | 6,600 / 6,600 ms | 5,165 ms | 6,233 ms | 6,262 ms | 5 ms | 0.0564 |

The controlled 500 ms delay adds only 88 ms to LCP but 1,860 ms to primary-content readiness.
That is the important distinction: paint remains visually fast while decision data is still
pending. In the representative cold process, announcements took 521 ms and availability took
2,058 ms because the latter resolves multiple source reads. After priming, those Portal API paths
returned in 2 ms and 3 ms respectively. The warm-cache median recovered 1,834 ms of the 1,860 ms
cold-data penalty (98.6%); the remaining 26 ms is within this small local series' browser/runtime
noise and cache-access overhead.

\* The captured series called the React-shell mark `atlas:interaction-ready`. Final code names that
transition `atlas:shell-interaction-ready`; `atlas:interaction-ready` is now emitted with
`atlas:primary-content-ready` only after both live-data regions settle and their UI commits. The
primary-ready column is therefore the final data-interaction metric.

Raw HTML reports, HARs, traces, screenshots, and videos are retained outside the repository under
`/tmp/atlas-perf-remediation-929a80c`. The final 0 ms series is
`profile-c-msw-0-ready-final`; forced-cold 500 ms runs are
`profile-c-msw-500-cold-{1..5}`; the primed comparison is
`profile-c-msw-500-source-cache-final`.

### 9.2 Request and bundle result

| Home cold-load measure | Before remediation | After remediation | Change |
| --- | ---: | ---: | ---: |
| Browser requests | 29 | 20 | -9 (-31%) |
| JavaScript requests | 21 | 14 | -7 (-33%) |
| JavaScript transfer, including HAR headers | 263,387 bytes | 208,377 bytes | -55,010 (-21%) |
| Portal JSON requests | 4 | 2 | -2 (-50%) |
| Built JavaScript files | 58 | 55 | -3 (-5%) |

The production build now fails if the home static closure exceeds 14 JavaScript files or 205,000
effective transfer bytes, if the whole client exceeds 56 JavaScript files or 500,000 bytes, or if
CSS exceeds 22,000 bytes. The final metadata records 14 home files / 202,476 bytes, 55 total
JavaScript files / 483,917 bytes, and 21,132 CSS bytes. Total `.output` size increased from 5,188
KiB to 5,444 KiB because the deployable server now includes iovalkey and AWS SigV4 credential
support; this server-only increase does not enter the browser bundle.

### 9.3 Shared Valkey deployment

The optional production cache is now a TLS iovalkey `Cluster` client seeded from the ElastiCache
configuration endpoint. It generates a SigV4 IAM password from the ECS task role, uses the IAM user
id as the Valkey username, and rotates the cluster connection before the 15-minute token expires.
Terraform provisions cluster mode, an IAM-enabled ElastiCache user and user group, task-role
`elasticache:Connect`, TLS, failover, and the four required Portal environment values. Cache keys
include a digest of the source authorization scope; successful entries use bounded
stale-while-revalidate, failures use a shorter negative TTL, and concurrent misses use
single-flight.

Unit tests cover token signing inputs, TLS enforcement, cluster options, token rotation, cache
isolation, SWR, negative caching, and single-flight; Terraform validates and the self-contained
production artifact contains the configured path. No AWS cache or credentials are available in
this public-safe local environment, so a real IAM-authenticated ElastiCache handshake and its
network latency remain deployment-time checks rather than claimed local passes.
