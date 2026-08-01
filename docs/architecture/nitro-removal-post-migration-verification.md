# Nitro Removal Post-Migration Verification

- Status: complete on the migration branch
- Verified: 2026-08-01, Asia/Taipei (UTC+08:00)
- Implementation commit: `ca3725d4bca5642e6f572a1c91a7c217b4a950ab`
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

Commands were executed from a clean dependency install against the implementation commit.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | pass; 0.88 s; no lockfile mutation |
| `pnpm -r typecheck` | pass; 3.77 s |
| `pnpm -r lint` | pass; 1.14 s |
| `pnpm -r test` | pass; 9.36 s |
| `pnpm --filter @atlas/context-layer build:lambda` | pass; Node 22 target |
| `pnpm --filter @atlas/portal build` | pass; output verifier accepted 201 entries |
| `pnpm --filter @atlas/e2e doctor` | pass; system Chrome 150.0.7871.187 |
| Primary Playwright suite | pass; 31/31; 20.1 s |
| Production smoke suite | pass; 9/9 |
| `terraform fmt -check`, `init -backend=false`, `validate` | pass; AWS provider 5.100.0 |

Default unit and integration counts were:

| Workspace | Result |
| --- | ---: |
| `@atlas/infra` | 4 passed |
| `@atlas/schema` | 25 passed |
| `azure-react-icons` | 1 passed |
| `@atlas/context-layer` | 179 passed, 2 skipped |
| `@atlas/portal` | 220 passed across 45 files |
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
| `.output` entries | 201 |
| `.output` files | 201 |
| `.output/public` files | 162 |
| `.output/server` files | 38 |
| gzip sidecars | 44 |
| Brotli sidecars | 44 |
| JavaScript files | 58 |
| `.output` size | 5,188 KiB |
| `.output/public` size | 3,092 KiB |
| `.output/server` size | 2,092 KiB |
| Context Lambda size | 1,640 KiB |

No symlink, special filesystem entry, absolute source path, Start/Nitro import, MSW/dev-mock import, or development environment reachability was found in the deployable output.

Retained SHA-256 values:

- `.output/server/index.mjs`: `8fcf15e906393d49c28aecb789640a767de1e8130809fdfed6c73234903d43ee`
- `.output/BUILD_METADATA.json`: `52ba603c45d42190ec06dca7f8c3dd4bb23b8d496d2f367485677a2783081d18`
- Context Lambda `handler.mjs`: `c405481602c1ebaa8a2141602a0b8c5b2bd5784508a934edc2254b5064f0b273`

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
