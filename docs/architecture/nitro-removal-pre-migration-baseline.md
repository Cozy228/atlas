# Nitro Removal Pre-Migration Baseline

- Status: frozen before implementation
- Captured: 2026-08-01, Asia/Taipei (UTC+08:00)
- Source commit: `6e9a4bdc125519b836c9bd7f4595f8b255390517`
- Source subject: `feat(atlas): 0.2.0 — resource-first portal, dev mock/live seam, zero-download E2E (#18)`
- Branch: `feat/nitro-removal-migration`
- Base: `origin/main` at the same commit

This document freezes observable behavior before attempting to remove Nitro. It is a measurement record, not a migration design. A replacement is conformant only when an intentional decision explains every changed value or behavior recorded here.

## 1. Capture rules

- The branch was created in an isolated worktree from freshly fetched `origin/main`; the pre-existing dirty worktree was not used or modified.
- Measurements use the committed lockfile and a clean worktree-local dependency install.
- Production measurements use the real `portal/.output` build with no `DEV_MOCKS` flag and no production credentials.
- Hermetic data measurements use the existing `DEV_MOCKS=1` seam and fictional repository fixtures.
- No company URL, credential, private schema, private data, or internal environment value is recorded.
- Wall-clock timings are single local samples, not benchmarks. Preserve the commands and behavior; compare timing only on equivalent hardware and load.
- Generated and ignored directories (`node_modules`, `.output`, `dist`, `.terraform`) are not committed.

## 2. Host and toolchain

| Item                              | Captured value                        |
| --------------------------------- | ------------------------------------- |
| OS                                | macOS 26.5.2, build 25F84             |
| Architecture                      | arm64                                 |
| Node.js                           | v22.22.2                              |
| Root package manager contract     | `pnpm@11.8.0`                         |
| Executed pnpm                     | 11.8.0                                |
| Terraform                         | 1.15.8, darwin_arm64                  |
| System browser used by Playwright | Chrome 150.0.7871.187                 |
| Docker CLI                        | 29.6.1, client API 1.54, darwin/arm64 |
| Docker daemon                     | Docker 29.4.0 on OrbStack Linux/arm64 |
| Docker VM capacity                | 14 CPUs; 16,819,834,880 bytes memory  |

The Portal Dockerfile independently pins Node 22.21.1 and pnpm 11.1.1. Those image build versions differ from this capture host and from the root `packageManager` value.

## 3. Repository and workspace inventory

The repository contained 1,381 tracked files at the source commit. Selected tracked extensions were:

| Extension | Files |
| --------- | ----: |
| `.tsx`    |   821 |
| `.ts`     |   209 |
| `.md`     |   174 |
| `.mjs`    |   101 |
| `.tf`     |     3 |

The pnpm workspace contained eight projects including the private root:

1. `atlas` (root)
2. `@atlas/context-layer`
3. `@atlas/infra`
4. `@atlas/acceptance`
5. `@atlas/e2e`
6. `@atlas/schema`
7. `azure-react-icons`
8. `@atlas/portal`

There were 78 `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files across `portal`, `context-layer`, `packages`, and `infra`. The normal recursive unit/integration command executed 69 test files; Playwright owns another seven spec files. The remaining test files are excluded debug/measurement surfaces or otherwise outside the default recursive test scripts.

## 4. Current application ownership

### 4.1 Portal build and runtime

The Portal is one TanStack Start SSR application built by Vite and packaged by Nitro:

- `tanstackStart()` owns the React route tree and SSR integration.
- `nitro()` is registered as a Vite plugin for non-Vitest execution.
- Nitro uses `serverDir: "server"` for filesystem HTTP routes and middleware.
- Nitro produces the deployable `.output` directory using the `node-server` preset.
- Production starts with `node .output/server/index.mjs`.
- The process listens on `PORT`; the Docker and Terraform contract sets 8080.
- The Portal Docker runtime contains only `/app/.output`; repository source and workspace `node_modules` are not copied into the final image.

Portal scripts:

| Script      | Command                                                 |
| ----------- | ------------------------------------------------------- |
| `dev`       | `vite dev`                                              |
| `build`     | `node scripts/gen-agent-skills-index.mjs && vite build` |
| `start`     | `node .output/server/index.mjs`                         |
| `typecheck` | `tsc --noEmit --pretty false`                           |
| `lint`      | `oxlint`                                                |
| `test`      | `vitest run --exclude scripts/*.debug.test.tsx`         |

Resolved framework and build dependencies relevant to the server boundary:

| Package                     | Resolved version |
| --------------------------- | ---------------- |
| React / React DOM           | 19.2.7 / 19.2.7  |
| TanStack Start              | 1.168.26         |
| TanStack Router             | 1.170.16         |
| TanStack Router SSR Query   | 1.167.1          |
| TanStack Query              | 5.101.0          |
| Vite                        | 8.1.0            |
| Nitro                       | 3.0.260610-beta  |
| Vite React plugin           | 6.0.2            |
| React Compiler Babel plugin | 1.0.0            |
| Rolldown Babel plugin       | 0.2.3            |
| Tailwind CSS / Vite plugin  | 4.3.1 / 4.3.1    |
| TypeScript in Portal        | 7.0.1-rc         |
| Vitest                      | 4.1.9            |
| Zod                         | 4.4.3            |
| AI SDK core                 | 6.0.208          |
| Playwright test             | 1.61.1           |
| axe Playwright adapter      | 4.12.1           |

The Portal had 50 direct production and development packages in `pnpm --filter @atlas/portal list --depth 0`. Workspace packages were linked locally; the table above records the boundary-sensitive subset rather than treating the full dependency list as server requirements.

### 4.2 Nitro-specific surface

Resolved Nitro package:

| Field                               | Value                     |
| ----------------------------------- | ------------------------- |
| Direct Portal dev dependency        | `nitro@3.0.260610-beta`   |
| Resolved versions                   | one                       |
| Node engine                         | `^20.19.0 \|\| >=22.12.0` |
| Build preset                        | `node-server`             |
| Compatibility date printed by build | `2026-08-01`              |
| Generated server entry              | `server/index.mjs`        |
| Generated public directory          | `public`                  |

Nitro currently provides or participates in all of these observable responsibilities:

- filesystem discovery and compilation for 13 `portal/server/routes/**` files;
- one `portal/server/middleware/**` file;
- registration of a dev-only Nitro plugin that starts Node-mode MSW fixtures;
- composition of the TanStack Start SSR handler with server routes;
- Node listener creation, `PORT` binding, and signal-driven graceful shutdown;
- `.output/server` bundling and dependency tracing;
- `.output/public` copying;
- build-time gzip and Brotli sidecar generation for public assets over Nitro's threshold;
- selection and serving of precompressed variants from `Accept-Encoding`;
- immutable caching for content-hashed `/assets/*` files;
- ETag, Last-Modified, range metadata, and conditional 304 behavior for static files;
- the production artifact layout assumed by Docker, CI smoke tests, and package scripts.

`portal/vite.config.ts` also carries one explicit compatibility constraint: Vite 8.1 `chunkImportMap` is disabled because it breaks Nitro's server rebundle on import-map-driven SSR chunks.

### 4.3 Context Layer hosting seam

The Context Layer exposes a framework-neutral `handleHttpRequest(HttpRequest): Promise<HttpResponse>` router. The same router is used by:

- the Portal `/api/*` Nitro catch-all through `bridgeContextApiRequest()`;
- the Context Layer Lambda entry built from `src/lambda/handler.ts`.

The Lambda bundle targets Node 22 and is independent of the Portal's `.output` server. Removing Nitro therefore affects the Portal-hosted adapter and packaging, but not the existence of the Context Layer router or Lambda adapter.

## 5. Route inventory

### 5.1 TanStack Start page files

There are 19 top-level route files in `portal/src/routes`:

```text
__root.tsx
availability.index.tsx
availability.tsx
catalog.index.tsx
catalog.tsx
guidance.$guidanceId.tsx
guidance.index.tsx
guidance.tsx
index.tsx
overview.tsx
policies.$policyId.tsx
releases.$releaseId.tsx
service.$provider.$id.tsx
skills.index.tsx
sources.$sourceId.tsx
sources.index.tsx
sources.tsx
support.tsx
whatsnew.tsx
```

The primary E2E suite verifies seven static public pages, two gated routes, discovered dynamic detail routes, and mobile behavior. The production smoke suite verifies the seven static public pages.

### 5.2 Nitro filesystem routes

| Filesystem route                          | Public path                             | Role                                  | Captured production GET         |
| ----------------------------------------- | --------------------------------------- | ------------------------------------- | ------------------------------- |
| `.well-known/ai-catalog.json.ts`          | `/.well-known/ai-catalog.json`          | AI capability catalog                 | 200, JSON, 1,202 bytes          |
| `.well-known/api-catalog.ts`              | `/.well-known/api-catalog`              | RFC 9264-style linkset                | 200, linkset JSON, 493 bytes    |
| `.well-known/mcp/server-card.json.ts`     | `/.well-known/mcp/server-card.json`     | MCP server card                       | 200, JSON, 1,567 bytes          |
| `.well-known/oauth-protected-resource.ts` | `/.well-known/oauth-protected-resource` | OAuth protected-resource metadata     | 200, JSON, 170 bytes            |
| `api/[...].ts`                            | `/api/*`                                | Context Layer HTTP bridge             | unmatched path 404 JSON         |
| `api/internal/openapi.json.ts`            | `/api/internal/openapi.json`            | complete internal contract document   | 200, OpenAPI JSON, 35,408 bytes |
| `health.ts`                               | `/health`                               | process health                        | 200, `{"status":"ok"}`          |
| `llms.txt.ts`                             | `/llms.txt`                             | agent discovery text                  | 200, text, 2,281 bytes          |
| `mcp.ts`                                  | `/mcp`                                  | stateless JSON-RPC MCP facade         | GET 405; POST described below   |
| `openapi.json.ts`                         | `/openapi.json`                         | agent-facing OpenAPI document         | 200, OpenAPI JSON, 21,557 bytes |
| `resources/[...].ts`                      | `/resources/{kind}/{slug}[.md]`         | agent-facing live Markdown projection | mock-free unknown resource 404  |
| `robots.txt.ts`                           | `/robots.txt`                           | crawler discovery                     | 200, text, 364 bytes            |
| `sitemap.xml.ts`                          | `/sitemap.xml`                          | live discovery sitemap                | 200, XML, 394 bytes             |

The one Nitro middleware adds a `Link` header only to `/`. The captured header advertised:

- `/llms.txt` as `llms-txt`;
- `/openapi.json` as `service-desc`;
- `/.well-known/api-catalog` as `api-catalog`;
- `/.well-known/ai-catalog.json` as `ai-catalog`;
- `/.well-known/agent-skills/index.json` as `agent-skills`;
- `/mcp` as `mcp-server`;
- `/sitemap.xml` as `sitemap`.

### 5.3 Context API routes behind `/api/*`

`handleHttpRequest` normalizes the `/api` prefix and one trailing slash, then exposes:

| Method | Path                                  | Response mode                                       |
| ------ | ------------------------------------- | --------------------------------------------------- |
| GET    | `/api/sources`                        | JSON source discovery                               |
| GET    | `/api/sources/{sourceId}`             | JSON source record                                  |
| GET    | `/api/availability`                   | JSON availability grid with citation/warnings       |
| GET    | `/api/resources/catalog`              | JSON resource catalog                               |
| GET    | `/api/resources?query=...`            | JSON resource search                                |
| GET    | `/api/resources/{kind}/{slug}/record` | JSON presentation record                            |
| GET    | `/api/resources/{kind}/{slug}`        | JSON context; Markdown when `Accept: text/markdown` |
| POST   | `/api/feedback`                       | JSON feedback validation/write path                 |

Every unmatched Context API route returns 404 JSON with error code `invalid_request`.

## 6. MCP baseline

The implementation at this commit is a hand-written stateless JSON-RPC 2.0 endpoint. `@modelcontextprotocol/sdk` is not a Portal dependency.

| Property                  | Captured behavior                                |
| ------------------------- | ------------------------------------------------ |
| Transport URL             | `/mcp`                                           |
| Advertised transport      | `streamable-http`                                |
| Session model             | stateless; no session ID and no resumable stream |
| Wire response             | one `application/json` response per POST; no SSE |
| Protocol version returned | `2025-06-18`                                     |
| Server name/title/version | `atlas` / `Atlas Context Layer` / `1.0.0`        |
| Capabilities              | tools only: `{ "tools": {} }`                    |
| Authentication            | optional Bearer scheme; opaque token is trimmed  |
| Mutations                 | no write-shaped MCP tool                         |

Implemented tools, all with `readOnlyHint: true`:

1. `atlas_search_service`
2. `atlas_get_source`
3. `atlas_get_availability`
4. `atlas_get_resource_context`

Captured protocol behavior:

| Request                                  | HTTP / JSON-RPC result                                     |
| ---------------------------------------- | ---------------------------------------------------------- |
| `GET /mcp`                               | HTTP 405, JSON-RPC error `-32000`                          |
| valid `initialize`                       | HTTP 200; protocol/server/capabilities returned            |
| `tools/list`                             | HTTP 200; exactly four tools and input JSON Schemas        |
| `notifications/initialized` without `id` | HTTP 202, empty body                                       |
| malformed JSON                           | HTTP 400, JSON-RPC parse error `-32700`                    |
| unknown method                           | JSON-RPC method error `-32601`                             |
| batch body                               | HTTP 400, JSON-RPC invalid request `-32600`                |
| tool failure                             | HTTP 200 result with `isError: true`, not a protocol error |

The handler is more permissive than the table above alone suggests. These behaviors are part of the pre-SDK baseline, whether or not they remain desirable:

| Probe                                                                                                      | Captured result                                                                       |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `initialize` with `jsonrpc: "1.0"`, a fictional requested protocol, and arbitrary capabilities/client info | HTTP 200; request metadata is ignored and the fixed `2025-06-18` response is returned |
| `initialize` with no `jsonrpc` and no `params`                                                             | HTTP 200; fixed initialize response                                                   |
| any message with omitted `id`, including `tools/list` and an unknown method                                | HTTP 202, empty body; the method is not dispatched                                    |
| any method whose name starts with `notifications/`, even when an `id` is present                           | HTTP 202, empty body                                                                  |
| `id: null`                                                                                                 | treated as a request id; for `tools/list`, HTTP 200 with `id: null`                   |

The incoming `Authorization` value is accepted only when it matches the Bearer scheme. The opaque token is trimmed, then reattached as `Authorization: Bearer <token>` only when `CONTEXT_API_BASE_URL` selects the HTTP Context API client. The default in-process client ignores it. No JWT parsing or validation occurs in the Portal.

A production, credential-free call to `atlas_search_service` with the fictional query `fictional` returned a successful structured empty result: `total=0`, `returned=0`. This matches the mock-free honest-empty data state described below.

## 7. Install, checks, tests, and builds

All commands ran from the isolated source commit. Durations are `/usr/bin/time -p` real time.

| Command                                                   | Exit |      Real time | Result                                                                    |
| --------------------------------------------------------- | ---: | -------------: | ------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                          |    0 |         4.91 s | 521 packages linked; lockfile unchanged; supply-chain policy check passed |
| `pnpm -r typecheck`                                       |    0 |         7.00 s | all configured workspace typechecks passed                                |
| `pnpm -r lint`                                            |    0 |         2.45 s | all configured oxlint runs passed                                         |
| `pnpm -r test`                                            |    0 |         9.23 s | 69 files; 322 passed, 2 skipped                                           |
| `pnpm --filter @atlas/context-layer build:lambda`         |    0 |         1.46 s | Node 22 Lambda bundle built                                               |
| `pnpm --filter @atlas/portal build`                       |    0 |         5.65 s | client, SSR, and Nitro node-server output built                           |
| `pnpm --filter @atlas/e2e e2e:doctor`                     |    0 |         1.39 s | system Chrome launched and closed                                         |
| `pnpm --filter @atlas/e2e e2e`                            |    0 |        27.48 s | 30/30 primary tests passed                                                |
| `pnpm --filter @atlas/e2e e2e:smoke`                      |    0 |         9.59 s | production rebuild plus 7/7 smoke tests passed                            |
| `terraform -chdir=infra fmt -check -diff`                 |    0 | included below | formatting clean                                                          |
| `terraform -chdir=infra init -backend=false -input=false` |    0 | included below | AWS provider 5.100.0 installed from lockfile                              |
| `terraform -chdir=infra validate`                         |    0 | included below | configuration valid                                                       |

### 7.1 Unit and integration breakdown

| Project                | Test files |                         Passed | Skipped |
| ---------------------- | ---------: | -----------------------------: | ------: |
| `@atlas/infra`         |          1 |                              3 |       0 |
| `@atlas/schema`        |          2 |                             25 |       0 |
| `azure-react-icons`    |          1 |                              1 |       0 |
| `@atlas/context-layer` |         33 |                            172 |       2 |
| `@atlas/portal`        |         31 |                            118 |       0 |
| `@atlas/acceptance`    |          1 |                              5 |       0 |
| **Total**              |     **69** | **324 test cases: 322 passed** |   **2** |

The recursive unit/integration command does not execute Playwright. Browser suites are separate CI jobs and commands.

### 7.2 Build observations

- Client build transformed 1,305 modules in 2.51 s in the first measured build.
- SSR build transformed 750 modules in 426 ms.
- Nitro build transformed 1,763 modules in 296 ms.
- Nitro traced only `tslib` as an external production dependency: one package, four files.
- The build emitted a non-fatal `LARGE_BARREL_MODULES` warning for 6,149 re-exports from `@tabler/icons-react`.
- Nitro warned that the generated production environment should match the builder OS/architecture (`darwin-arm64`) if native modules are present.
- The Context Lambda build transformed one entry to a 1,674,320-byte `dist/lambda/handler.mjs` targeting Node 22.

Two Portal builds were executed from the same commit: the standalone baseline build and the rebuild inside `e2e:smoke`. Content-hashed client filenames remained the same, but `portal/.output/server/index.mjs` and `nitro.json` SHA-256 values changed because build metadata is embedded. Therefore, the current build is not byte-for-byte reproducible without normalizing that metadata.

## 8. Production artifact baseline

### 8.1 Directory layout and size

| Artifact                    |           Files | Disk-use bytes (`du -sk` × 1,024) | Human size |
| --------------------------- | --------------: | --------------------------------: | ---------: |
| `portal/.output`            | 290 total files |                        10,149,888 |    9.7 MiB |
| `portal/.output/public`     |             139 |                         3,162,112 |    3.0 MiB |
| `portal/.output/server`     |             150 |                         6,983,680 |    6.7 MiB |
| `context-layer/dist/lambda` |               1 |                         1,675,264 |    1.6 MiB |

The public asset directory contains 137 files under `public/assets`, composed of:

| Class                | Files | Total bytes |
| -------------------- | ----: | ----------: |
| Original asset files |    59 |   1,913,925 |
| Gzip sidecars        |    39 |     509,228 |
| Brotli sidecars      |    39 |     433,485 |

Nitro precompressed 39 eligible assets in both formats. Twenty smaller or already-compressed originals had no generated pair.

The 150 server files total 6,618,132 payload bytes before filesystem block rounding.

### 8.2 Largest public files

| File                                    |   Bytes |
| --------------------------------------- | ------: |
| `assets/index-d1oPy0JH.js`              | 452,349 |
| `assets/react-dom-Ckp3x1-a.js`          | 189,433 |
| `assets/index-d1oPy0JH.js.gz`           | 140,351 |
| `assets/globals-CwE4egEf.css`           | 128,083 |
| `assets/aws-icons-DepoDoI5.js`          | 125,285 |
| `assets/azure-icons-eK84aq-c.js`        | 121,685 |
| `assets/index-d1oPy0JH.js.br`           | 118,690 |
| `assets/availability.index-DD2JJvNn.js` | 108,219 |

Representative primary client chunk:

| Encoding |   Bytes | Reduction from raw |
| -------- | ------: | -----------------: |
| raw      | 452,349 |                  — |
| gzip     | 140,351 |              69.0% |
| Brotli   | 118,690 |              73.8% |

### 8.3 Current artifact checksums

These identify the final artifact left by the production smoke rebuild, not a stable cross-build identity:

| File                                    |     Bytes | SHA-256                                                            |
| --------------------------------------- | --------: | ------------------------------------------------------------------ |
| `portal/.output/server/index.mjs`       |    62,032 | `23f095f91cce175e34eb3b23181bcf99e6891a2e3d8ea6bb57c11ca70ade0f89` |
| `portal/.output/nitro.json`             |       335 | `598daf75140b18dd88c16970d2a315f71ef61893b7f231214e87d33dc1453c4a` |
| `context-layer/dist/lambda/handler.mjs` | 1,674,320 | `1b6aa8b330d8b311aaaf85f0e144686dbfbb3eca9fd58977b7aa052ecf1aa094` |

For comparison, the first Portal build produced different SHA-256 values for same-sized generated metadata-bearing files:

- `portal/.output/server/index.mjs`: `b688476aff598be5137dd5369d44db992da5040c3562cdbacb9b86ac0f1f95b0`
- `portal/.output/nitro.json`: `a063990e04503d42a79f8dd6173c3543224b1735c5b02db06e47e362de8b62fa`

### 8.4 Self-contained output check

The complete `portal/.output` directory was copied to a new temporary directory outside the repository and started from there with:

```sh
PORT=3218 NODE_ENV=production node .output/server/index.mjs
```

From that copied artifact:

- `/` returned 200 and 36,458 bytes;
- `/health` returned 200 and 15 bytes;
- the Brotli primary asset returned 200 and 118,690 wire bytes;
- SIGINT printed the graceful-stop message and the process exited 0.

This proves the artifact does not depend on repository-relative runtime source files for these paths.

## 9. Static assets, compression, and cache headers

The representative hashed asset was `/assets/index-d1oPy0JH.js`.

| Request `Accept-Encoding` | Status | `Content-Encoding` | `Content-Length` | `Vary`            | Cache                                 |
| ------------------------- | -----: | ------------------ | ---------------: | ----------------- | ------------------------------------- |
| `identity`                |    200 | absent             |          452,349 | absent            | `public, max-age=31536000, immutable` |
| `gzip`                    |    200 | `gzip`             |          140,351 | `Accept-Encoding` | `public, max-age=31536000, immutable` |
| `br`                      |    200 | `br`               |          118,690 | `Accept-Encoding` | `public, max-age=31536000, immutable` |

Each selected representation had its own ETag and Last-Modified value. Repeating the identity request with `If-None-Match` returned 304 with zero body bytes.

Other captured behavior:

| Path                                   | Status | Cache behavior                                    |
| -------------------------------------- | -----: | ------------------------------------------------- |
| `/assets/globals-CwE4egEf.css`         |    200 | one-year immutable                                |
| `/.well-known/agent-skills/index.json` |    200 | ETag and Last-Modified; no explicit Cache-Control |
| `/favicon.svg`                         |    404 | no public favicon at this path                    |
| `/missing-asset.js`                    |    404 | SSR-style HTML 404 response                       |

Dynamic HTML and generated discovery/API responses did not emit explicit `Cache-Control`, ETag, or Last-Modified headers in the production probes. They used chunked transfer.

## 10. SSR and HTTP runtime behavior

### 10.1 Process behavior

Production start command:

```sh
PORT=3217 NODE_ENV=production node .output/server/index.mjs
```

Observed startup line:

```text
➜ Listening on: http://localhost:3217/ (all interfaces)
```

On SIGINT, Nitro printed `Stopping server gracefully (5s)...`, then `Server closed successfully.` and exited 0 in approximately 0.91 seconds with no active request.

The dev server's pnpm wrapper exited 1 on an intentional SIGINT after the child Vite process stopped. Production and dev shutdown exit semantics are therefore different at this commit.

### 10.2 Homepage response

Cold process, first measured `/` request:

| Field         | Value                          |
| ------------- | ------------------------------ |
| Status        | 200                            |
| Content-Type  | `text/html; charset=utf-8`     |
| Body bytes    | 36,458                         |
| Transfer      | chunked; no Content-Length     |
| TTFB / total  | 127.789 ms / 127.869 ms        |
| Cache-Control | absent                         |
| Discovery     | homepage `Link` header present |

Five warmed curl requests had TTFB values of 6.642, 4.703, 4.811, 4.207, and 6.221 ms. Their body size stayed 36,458 bytes.

A Node Fetch stream probe on a warm request observed:

```json
{
  "status": 200,
  "headersMs": 20.911,
  "firstBodyChunkMs": 21.242,
  "completeMs": 22.754,
  "chunks": 1,
  "bytes": 36458
}
```

Although HTTP uses chunked transfer, this local Node client received the SSR body as one body chunk. The bytes begin with `<!DOCTYPE html>`, include the server-rendered application shell and asset preload references, and later contain TanStack Start's streamed serialization framing including NUL separator bytes. Do not treat the body as plain-text-only when writing low-level proxies or snapshot tooling.

### 10.3 Representative production route timings

These are single sequential samples from the same local process:

| Path                                    | Status |  Bytes |      TTFB |
| --------------------------------------- | -----: | -----: | --------: |
| `/health`                               |    200 |     15 |  1.545 ms |
| `/robots.txt`                           |    200 |    364 |  1.391 ms |
| `/sitemap.xml`                          |    200 |    394 | 23.576 ms |
| `/llms.txt`                             |    200 |  2,281 |  1.242 ms |
| `/openapi.json`                         |    200 | 21,557 |  3.418 ms |
| `/api/internal/openapi.json`            |    200 | 35,408 |  2.852 ms |
| `/.well-known/ai-catalog.json`          |    200 |  1,202 |  1.277 ms |
| `/.well-known/api-catalog`              |    200 |    493 |  1.898 ms |
| `/.well-known/mcp/server-card.json`     |    200 |  1,567 |  2.957 ms |
| `/.well-known/oauth-protected-resource` |    200 |    170 |  1.125 ms |

### 10.4 Mock-free production data state

Without credentials or live source configuration, the production server booted successfully and exposed honest-empty discovery instead of failing the process:

| Request                                   | Status | Shape / count               | Bytes |
| ----------------------------------------- | -----: | --------------------------- | ----: |
| `/api/sources`                            |    200 | `{sources}`                 |   391 |
| `/api/availability`                       |    200 | `{citation,warnings,zones}` |   457 |
| `/api/resources/catalog`                  |    200 | `{resources}`, empty        |    16 |
| `/api/resources?query=fictional`          |    200 | `{items}`, empty            |    12 |
| `/api/resources/service/aws/textract`     |    404 | `{error}`                   |   151 |
| same request with `Accept: text/markdown` |    404 | JSON error                  |   151 |
| `/resources/service/aws/textract.md`      |    404 | JSON error                  |   151 |
| invalid empty feedback POST               |    400 | JSON validation error       |    77 |

### 10.5 Mock-forced development data state

The existing deterministic seam starts Vite/Nitro with:

```sh
DEV_MOCKS=1 LLM_PROVIDER=simulated DEV_MOCK_LATENCY_MS=0 pnpm --filter @atlas/portal dev
```

Captured after dev startup:

| Request                               | Status | Shape / count           |                         Bytes |
| ------------------------------------- | -----: | ----------------------- | ----------------------------: |
| `/api/sources`                        |    200 | 23 sources              |                         8,762 |
| `/api/availability`                   |    200 | 3 zones                 |                         4,078 |
| `/api/resources/catalog`              |    200 | 22 resources            |                         8,267 |
| `/api/resources?query=textract`       |    200 | 1 item                  |                           350 |
| `/api/resources/service/aws/textract` |    200 | full context projection |                         4,084 |
| `/resources/service/aws/textract.md`  |    200 | Markdown                |             2,810 UTF-8 bytes |
| first measured `/` after route probes |    200 | SSR/dev body            | 54,326 bytes; 719.233 ms TTFB |

The dev mock plugin is registered only for Vite `serve`; it is absent from production builds. This separation is an explicit invariant.

## 11. E2E baseline

### 11.1 Browser policy and shared environment

- Playwright package: `@playwright/test ^1.61.1`.
- No Playwright browser download is used.
- macOS defaults to the installed `chrome` channel; Linux/Windows CI defaults to `msedge`.
- `PW_CHANNEL` and `PW_BASE_URL` can override the shared values.
- Default base URL is `http://localhost:3000`, intentionally not hard-coded to IPv4.
- The local doctor launched Chrome 150.0.7871.187 successfully.
- Trace is `on-first-retry`; screenshot is `only-on-failure`; video is disabled because the zero-download policy also omits Playwright ffmpeg.
- Color scheme is pinned to light for deterministic accessibility contrast checks.
- Local retries: zero. CI retries: one.

### 11.2 Primary suite

Command: `pnpm --filter @atlas/e2e e2e`

Server contract:

- command: `pnpm --filter @atlas/portal dev`;
- environment: `DEV_MOCKS=1`, `LLM_PROVIDER=simulated`, `DEV_MOCK_LATENCY_MS=250`;
- fully parallel;
- seven local workers in this capture;
- warmup visits `/`, `/availability`, `/catalog`, `/service/aws/textract`, `/guidance`, `/sources`, and `/whatsnew` before parallel execution;
- readiness timeout: 120 seconds;
- teardown: SIGTERM, then SIGKILL after 15 seconds if necessary;
- reuse existing server locally, never in CI.

Inventory and result:

| Area                    |  Tests | Result                                                   |
| ----------------------- | -----: | -------------------------------------------------------- |
| Accessibility           |      6 | passed                                                   |
| App boot                |      1 | passed                                                   |
| Full core journey       |      1 | passed                                                   |
| Loading/degraded states |      3 | passed                                                   |
| Full route smoke        |     10 | passed                                                   |
| Mobile 375 px behavior  |      9 | passed                                                   |
| **Total**               | **30** | **30 passed in Playwright 26.3 s; command real 27.48 s** |

The core journey took 7.6 s and the discovered dynamic-detail route sweep took 5.0 s. No retry, trace, screenshot, or failure artifact was produced.

### 11.3 Production smoke suite

Command: `pnpm --filter @atlas/e2e e2e:smoke`

The command first executes a real Portal production build, then starts `pnpm --filter @atlas/portal start` with only `PORT=3000`. It intentionally does not set `DEV_MOCKS`.

The seven pages `/`, `/availability`, `/catalog`, `/guidance`, `/sources`, `/whatsnew`, and `/support` each verified:

- HTTP 200;
- an SSR shell;
- successful hydration/routing;
- absence of the mock mode badge;
- no page-level JavaScript error.

Result: 7/7 passed in Playwright 3.7 s; build-plus-suite real time was 9.59 s. Production server teardown completed gracefully.

### 11.4 CI topology

The current GitHub Actions contract is split into:

1. a checks/build job: frozen install, recursive typecheck, lint, unit/integration tests, Portal build, and Context Lambda build;
2. primary E2E on both Ubuntu and Windows;
3. production smoke E2E on Ubuntu.

E2E failures upload Playwright report and test-result directories. Browser doctor runs before both browser layers.

## 12. Docker and deployment contract

### 12.1 Dockerfile

The four-stage Portal image currently:

1. enables Corepack and pnpm in `node:22.21.1-bookworm-slim`;
2. performs a frozen workspace install with a BuildKit pnpm-store cache;
3. runs `pnpm --filter @atlas/portal build`;
4. copies only `/app/portal/.output` into a fresh Node slim runtime;
5. sets `NODE_ENV=production`, `PORT=8080`, exposes 8080, and runs `node .output/server/index.mjs`.

There is no Dockerfile `HEALTHCHECK`; infrastructure health comes from the ALB target group.

OrbStack was started later in the same capture and the image was built from the frozen source commit:

| Item                   | Captured value                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Build command          | `docker build --progress=plain -f portal/Dockerfile -t atlas-portal:nitro-baseline-6e9a4bdc .` |
| Build result / elapsed | exit 0 / 22.30 s                                                                               |
| Build context sent     | 689.57 MB                                                                                      |
| Image ID               | `sha256:7503fa0ea61e9232ea2bb6deb539fe596a4f4b41bca25259d03cb64771d4c907`                      |
| Image platform         | Linux/arm64                                                                                    |
| Image size             | 255,718,807 bytes                                                                              |
| `.output` copy layer   | 9.48 MB                                                                                        |
| Runtime Node           | 22.21.1                                                                                        |
| Runtime command        | `node .output/server/index.mjs`                                                                |

A fresh container returned `/` as 200 with 36,458 bytes and 178.709 ms first-request TTFB. `/health` returned 200 with 15 bytes and 2.330 ms TTFB. A Brotli request for the primary asset returned 200, `Content-Encoding: br`, 118,690 bytes, an immutable cache header, and an ETag.

The first idle sample was 0.04% CPU, 50.01 MiB memory, and 11 PIDs. After the performance probes, the same process family remained at 11 PIDs and 58.9 MiB; neither sample is a load or leak test. `docker stop -t 10` delivered the signal, Nitro logged graceful shutdown, the container exited 0 with `OOMKilled=false`, and stop completed in 1.17 s.

### 12.2 ECS/ALB Terraform

Captured infrastructure contract:

| Item                           | Value                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Runtime                        | ECS Fargate                                                                         |
| Container name                 | `atlas-portal`                                                                      |
| Container/host port            | variable default 8080, TCP                                                          |
| Task environment               | `NODE_ENV=production`, `PORT`, `PORTAL_ORIGIN`, feedback table, runtime secret name |
| ALB target protocol            | HTTP, IP targets                                                                    |
| ALB health path                | `/`                                                                                 |
| Health matcher                 | 200-399                                                                             |
| Health interval / timeout      | 30 s / 5 s                                                                          |
| Healthy / unhealthy thresholds | 2 / 3                                                                               |
| ECS health-check grace         | 60 s                                                                                |
| Deployment min / max           | 50% / 200%                                                                          |
| Logging                        | CloudWatch Logs via `awslogs`                                                       |

Terraform formatting and validation passed after backend-disabled initialization with locked AWS provider 5.100.0. No `terraform plan` was run because no deployment inputs or cloud credentials were placed in scope.

The ALB probes `/`, not `/health`. Consequently, deployed health currently depends on the complete SSR homepage returning within five seconds, including any startup/source behavior reached by that render.

## 13. Pre-migration invariant ledger

Each row must be checked after any server replacement. A changed row requires an explicit acceptance decision and updated test or measurement.

| ID  | Invariant before migration                                                              | Verification                                |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------- |
| B01 | Fresh frozen install succeeds without lockfile mutation                                 | `pnpm install --frozen-lockfile`            |
| B02 | Recursive typecheck, lint, and unit/integration suite pass                              | commands in Section 7                       |
| B03 | Context Lambda build remains independent and targets Node 22                            | `build:lambda` plus artifact inspection     |
| B04 | One command builds client, SSR, server routes, and deployable output                    | Portal `build`                              |
| B05 | Production start needs only the generated output and Node                               | copied-output check                         |
| B06 | `PORT` binds the production listener on all interfaces                                  | production startup probe                    |
| B07 | SIGINT performs bounded graceful shutdown and exits 0                                   | process probe                               |
| B08 | All 19 TanStack route files continue to resolve as intended                             | E2E route suites                            |
| B09 | All 13 filesystem HTTP routes preserve status, content type, and body contract          | route matrix and contract tests             |
| B10 | `/api/*` delegates to the same Context Layer HTTP router as Lambda                      | code seam plus Context API tests            |
| B11 | Homepage is server-rendered before hydration and carries discovery links                | raw HTTP plus production smoke              |
| B12 | TanStack serialization bytes pass through without corruption                            | body byte probe and hydration tests         |
| B13 | Content-hashed assets receive one-year immutable caching                                | header probe                                |
| B14 | Gzip and Brotli variants are built and negotiated                                       | file counts plus `Accept-Encoding` probes   |
| B15 | Static representations retain ETag/Last-Modified and conditional 304 behavior           | asset header probe                          |
| B16 | Unversioned generated discovery files do not accidentally inherit immutable caching     | header probe                                |
| B17 | Production remains mock-free and supports credential-free honest-empty boot             | smoke plus API probes                       |
| B18 | Dev E2E can force deterministic MSW and simulated LLM behavior                          | primary E2E plus dev probes                 |
| B19 | MCP initialize, notifications, list, call, and error semantics remain compatible        | MCP tests and live probes                   |
| B20 | Four MCP tools remain read-only and their JSON Schemas remain discoverable              | `tools/list` and unit tests                 |
| B21 | Homepage ALB health contract remains 200-399 within the five-second timeout             | local and Linux-container production probes |
| B22 | Docker runtime can continue copying one deployable directory only                       | Dockerfile and copied-output check          |
| B23 | CI continues to run checks/build, cross-platform primary E2E, and prod smoke separately | workflow inspection                         |
| B24 | No browser download becomes necessary                                                   | doctor and package/CI policy                |
| B25 | No runtime process remains after E2E or manual probes                                   | listener/container cleanup check            |

## 14. Known gaps and non-claims

- No deployed ECS task, ALB, CDN, reverse proxy, or TLS terminator was queried.
- No cloud-backed source, feedback write, Valkey cache, DynamoDB table, Bedrock/OpenAI provider, SSO flow, or real Bearer identity was exercised.
- No production load, concurrency, soak, memory, CPU, heap, event-loop, or leak test was run.
- The direct curl timing samples are local and single-run; the separate sitespeed.io series uses three iterations and reports medians, but still is not a production SLO.
- The Node Fetch chunk count is client-observed and can be affected by buffering. It does not prove the server never streams under other routes, load, proxies, or timing.
- Accessibility E2E covers the six committed baseline flows, not every UI state.
- The production smoke covers seven static routes; dynamic routes are covered in the mock-forced primary suite.
- No coverage percentage is claimed because the workspace has no default coverage command in the captured script contract.
- Build outputs contain time-dependent metadata and are not byte-reproducible at this commit.

## 15. Reproduction command ledger

Run from a clean checkout at the source commit unless a command says otherwise:

```sh
/usr/bin/time -p pnpm install --frozen-lockfile
/usr/bin/time -p pnpm -r typecheck
/usr/bin/time -p pnpm -r lint
/usr/bin/time -p pnpm -r test
/usr/bin/time -p pnpm --filter @atlas/context-layer build:lambda
/usr/bin/time -p pnpm --filter @atlas/portal build
/usr/bin/time -p pnpm --filter @atlas/e2e e2e:doctor
pnpm --filter @atlas/e2e exec playwright test --list
/usr/bin/time -p pnpm --filter @atlas/e2e e2e
pnpm --filter @atlas/e2e exec playwright test --config=playwright.smoke.config.ts --list
/usr/bin/time -p pnpm --filter @atlas/e2e e2e:smoke
terraform -chdir=infra fmt -check -diff
terraform -chdir=infra init -backend=false -input=false
terraform -chdir=infra validate
```

Production runtime:

```sh
PORT=3217 NODE_ENV=production node portal/.output/server/index.mjs
curl -i http://localhost:3217/
curl -i http://localhost:3217/health
curl -i -H 'Accept-Encoding: br' http://localhost:3217/assets/index-d1oPy0JH.js
curl -i -H 'Accept-Encoding: gzip' http://localhost:3217/assets/index-d1oPy0JH.js
```

MCP initialization:

```sh
curl -i \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"baseline","version":"1.0.0"}}}' \
  http://localhost:3217/mcp
```

The hashed asset filename is build-specific. Re-extract it from the generated homepage or `.output/public/assets` when reproducing against a different build.

Artifact inventory and checksums:

```sh
find portal/.output -type f | wc -l
find portal/.output/public -type f | wc -l
find portal/.output/server -type f | wc -l
du -sk portal/.output portal/.output/public portal/.output/server context-layer/dist/lambda
find portal/.output/public/assets -maxdepth 1 -type f -name '*.gz' | wc -l
find portal/.output/public/assets -maxdepth 1 -type f -name '*.br' | wc -l
find portal/.output/public/assets -maxdepth 1 -type f -name '*.js' | wc -l
stat -f '%z %N' \
  portal/.output/server/index.mjs \
  portal/.output/nitro.json \
  context-layer/dist/lambda/handler.mjs
shasum -a 256 \
  portal/.output/server/index.mjs \
  portal/.output/nitro.json \
  context-layer/dist/lambda/handler.mjs
```

Status, bytes, and TTFB route matrix:

```sh
for atlas_path in \
  / /health /robots.txt /sitemap.xml /llms.txt /openapi.json \
  /api/internal/openapi.json /.well-known/ai-catalog.json \
  /.well-known/api-catalog /.well-known/mcp/server-card.json \
  /.well-known/oauth-protected-resource; do
  atlas_route_name=$(printf '%s' "$atlas_path" | sed 's#^/$#home#; s#^/##; s#[/.]#-#g')
  curl -sS \
    -D "/tmp/atlas-route-$atlas_route_name.headers" \
    -o "/tmp/atlas-route-$atlas_route_name.body" \
    -w "$atlas_path status=%{http_code} content_type=%{content_type} bytes=%{size_download} ttfb=%{time_starttransfer}\n" \
    "http://localhost:3217$atlas_path"
done
```

Static representation and conditional request probes:

```sh
atlas_asset=/assets/index-d1oPy0JH.js
curl -sS -D /tmp/atlas-identity-headers -o /tmp/atlas-identity-body \
  -H 'Accept-Encoding: identity' "http://localhost:3217$atlas_asset"
curl -sS -D /tmp/atlas-gzip-headers -o /tmp/atlas-gzip-body \
  -H 'Accept-Encoding: gzip' "http://localhost:3217$atlas_asset"
curl -sS -D /tmp/atlas-br-headers -o /tmp/atlas-br-body \
  -H 'Accept-Encoding: br' "http://localhost:3217$atlas_asset"
atlas_etag=$(awk 'BEGIN{IGNORECASE=1} /^etag:/ {sub(/^[^:]+:[[:space:]]*/, ""); sub(/\r$/, ""); print}' /tmp/atlas-identity-headers)
curl -sS -D - -o /dev/null \
  -H 'Accept-Encoding: identity' -H "If-None-Match: $atlas_etag" \
  "http://localhost:3217$atlas_asset"
wc -c /tmp/atlas-identity-body /tmp/atlas-gzip-body /tmp/atlas-br-body
```

Self-contained artifact and signal behavior:

```sh
atlas_copy_dir=$(mktemp -d)
cp -R portal/.output "$atlas_copy_dir/.output"
(
  cd "$atlas_copy_dir"
  exec env PORT=3218 NODE_ENV=production node .output/server/index.mjs
) > /tmp/atlas-copied-output.log 2>&1 &
atlas_copy_pid=$!
curl --retry 10 --retry-delay 1 --retry-all-errors -fsS http://localhost:3218/health
curl -fsS -o /tmp/atlas-copied-home http://localhost:3218/
kill -INT "$atlas_copy_pid"
wait "$atlas_copy_pid"
atlas_copy_exit=$?
printf 'copied-output-exit=%s\n' "$atlas_copy_exit"
```

The mock-forced data matrix uses the existing dev process and ordinary curl:

```sh
DEV_MOCKS=1 LLM_PROVIDER=simulated DEV_MOCK_LATENCY_MS=0 \
  pnpm --filter @atlas/portal dev
curl -sS http://localhost:3000/api/sources
curl -sS http://localhost:3000/api/availability
curl -sS http://localhost:3000/api/resources/catalog
curl -sS 'http://localhost:3000/api/resources?query=textract'
curl -sS http://localhost:3000/api/resources/service/aws/textract
curl -sS http://localhost:3000/resources/service/aws/textract.md
```

MCP permissiveness uses these exact request bodies. Preserve both the HTTP status and response body; a 202 notification has no body.

```sh
atlas_mcp=http://localhost:3217/mcp
curl -i -H 'content-type: application/json' \
  --data '{"jsonrpc":"1.0","id":1,"method":"initialize","params":{"protocolVersion":"fictional","capabilities":{"x":true},"clientInfo":{"name":"x","version":"x"}}}' \
  "$atlas_mcp"
curl -i -H 'content-type: application/json' \
  --data '{"id":2,"method":"initialize"}' "$atlas_mcp"
curl -i -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"tools/list"}' "$atlas_mcp"
curl -i -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":3,"method":"notifications/fictional"}' "$atlas_mcp"
curl -i -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"fictional"}' "$atlas_mcp"
curl -i -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":4,"method":"fictional"}' "$atlas_mcp"
curl -i -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":null,"method":"tools/list"}' "$atlas_mcp"
curl -i -H 'content-type: application/json' --data '[]' "$atlas_mcp"
printf '{' | curl -i -H 'content-type: application/json' --data-binary @- "$atlas_mcp"
```

## 16. Official performance-tooling references

This section records the first-party tooling contract used by the measured runs in Section 17 as of 2026-08-01.

### 16.1 Pinned tools and execution modes

| Tool         | Reproducible pin                                           | Intended use                                                                        | First-party reference                                                                                                                                                             |
| ------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sitespeed.io | `sitespeedio/sitespeed.io:42.5.1` or `sitespeed.io@42.5.1` | HTML report, HAR waterfall, page summary, Web Vitals, video, CPU/long-task analysis | [Docker version pinning and Chrome command](https://www.sitespeed.io/documentation/sitespeed.io/docker/), [npm registry metadata](https://registry.npmjs.org/sitespeed.io/42.5.1) |
| Browsertime  | `sitespeedio/browsertime:28.3.0` or `browsertime@28.3.0`   | Lower-level browser JSON/HAR output and scripted journeys                           | [Docker/native output contract](https://www.sitespeed.io/documentation/browsertime/details/), [npm registry metadata](https://registry.npmjs.org/browsertime/28.3.0)              |
| Throttle     | `@sitespeed.io/throttle@6.0.1`                             | Host-level bandwidth and RTT shaping on macOS/Linux                                 | [official README and CLI units](https://github.com/sitespeedio/throttle/tree/v6.0.1), [npm registry metadata](https://registry.npmjs.org/@sitespeed.io%2Fthrottle/6.0.1)          |

The pinned sitespeed.io package embeds Browsertime 28.2.0, while 28.3.0 is the pinned standalone Browsertime release; do not merge results from those two runners into one statistical series. Docker is the easiest way to retain the video/Visual Metrics dependency set, and the official guidance says to pin an exact image tag. On Apple Silicon, the ARM image uses Chromium rather than the same Chrome build as AMD64, so the image architecture and reported browser version are part of every result's identity. [sitespeed.io package metadata](https://registry.npmjs.org/sitespeed.io/42.5.1), [Docker details](https://www.sitespeed.io/documentation/sitespeed.io/docker/)

Docker/OrbStack against the host Portal:

```sh
ATLAS_PERF_RESULTS="$(mktemp -d)"
docker run --rm --shm-size=2g \
  -v "$ATLAS_PERF_RESULTS:/sitespeed.io" \
  sitespeedio/sitespeed.io:42.5.1 \
  -b chrome -n 5 --cpu --video --visualMetrics \
  http://host.docker.internal:3217/
```

Native Chrome without adding a repository dependency:

```sh
npm exec --yes --package=sitespeed.io@42.5.1 -- \
  sitespeed.io -b chrome -n 5 --cpu http://localhost:3217/
```

The browser selector is `-b chrome`, iteration count is `-n`, and sitespeed.io reports medians across iterations. The full current option surface is available through the pinned image's `--help-all`. [Configuration reference](https://www.sitespeed.io/documentation/sitespeed.io/configuration/)

### 16.2 Atlas network and CPU profiles

The custom connectivity values are in kbit/s and milliseconds. The exact sitespeed.io arguments are:

| Profile                          |          Down |           Up |    RTT | CPU | Arguments                                                                                        |
| -------------------------------- | ------------: | -----------: | -----: | --: | ------------------------------------------------------------------------------------------------ |
| A: normal enterprise             | 20,000 kbit/s | 5,000 kbit/s |  30 ms |  1x | `-c custom --downstreamKbps 20000 --upstreamKbps 5000 --latency 30 --chrome.CPUThrottlingRate 1` |
| B: constrained enterprise/Citrix |  5,000 kbit/s | 1,000 kbit/s | 100 ms |  4x | `-c custom --downstreamKbps 5000 --upstreamKbps 1000 --latency 100 --chrome.CPUThrottlingRate 4` |
| C: severely constrained          |    600 kbit/s |   250 kbit/s | 350 ms |  8x | `-c custom --downstreamKbps 600 --upstreamKbps 250 --latency 350 --chrome.CPUThrottlingRate 8`   |

`-c custom` requires the down/up/RTT values above; `--browsertime.connectivity.engine throttle` asks Browsertime to apply the profile, and `--cpu` enables the Chrome timeline plus Long Task collection. `--chrome.CPUThrottlingRate` is a slowdown multiplier. [Connectivity options](https://www.sitespeed.io/documentation/sitespeed.io/connectivity/), [CPU collection and throttling](https://www.sitespeed.io/documentation/sitespeed.io/cpu/)

For native Chrome talking to `localhost`, the explicit first-party Throttle sequence is:

```sh
npm exec --yes --package=@sitespeed.io/throttle@6.0.1 -- \
  throttle --down 5000 --up 1000 --rtt 100 --localhost
# Run the pinned native Browsertime/sitespeed.io command with connectivity.engine=external.
npm exec --yes --package=@sitespeed.io/throttle@6.0.1 -- \
  throttle --stop --localhost
```

Throttle uses `pfctl` on macOS and `tc` on Linux and requires elevated privileges. `NET_ADMIN` is not a competing throttler: it is the Linux capability that allows the sitespeed.io container's embedded Throttle process to configure `tc`. OrbStack runs containers inside a Linux VM, so the capture successfully used `--cap-add=NET_ADMIN` with `--browsertime.connectivity.engine throttle`; every run logged `Setting connectivity profile custom`. Use host shaping plus `connectivity.engine=external` only when the container runtime cannot grant the capability, and always stop host shaping in cleanup. [`@sitespeed.io/throttle` README](https://github.com/sitespeedio/throttle/tree/v6.0.1), [sitespeed.io connectivity guide](https://www.sitespeed.io/documentation/sitespeed.io/connectivity/)

Throttle shapes bandwidth, RTT, and optionally packet loss; it does not inject application/server processing delay. Therefore a “slow response” case needs an independently controlled server/API delay and must record that delay separately. TTFB is then observed as `responseStart - navigationStart`, so it includes the network and connection path as well as server wait; it is not a server-only duration. [TTFB definition](https://www.sitespeed.io/documentation/sitespeed.io/metrics/)

### 16.3 Cache, page-load, and journey matrix

- **Cold cache:** the default is a new browser profile per iteration; add `--browsertime.cacheClearRaw` when the run must force a raw browser-cache clear. [Official cache guidance](https://www.sitespeed.io/documentation/sitespeed.io/best-practice/)
- **Warm cache:** `--preURL <url>` loads an unmeasured URL in the same session before the measured URL. A scripted journey or `--multi` preserves cache between measured pages. [Browsertime configuration](https://www.sitespeed.io/documentation/browsertime/configuration/), [multi-page configuration](https://www.sitespeed.io/documentation/sitespeed.io/configuration/)
- **Cold deep link:** start a fresh iteration directly at each detail URL rather than reaching it through the home page.
- **Client navigation:** use a Browsertime script with `--spa --multi`; scripts are the official mechanism for clicks and multi-step flows, while `--spa` changes the completion check for SPA resource activity. [SPA guidance](https://www.sitespeed.io/documentation/sitespeed.io/spa/), [scripting guide](https://www.sitespeed.io/documentation/sitespeed.io/scripting/)

Chrome soft navigations can generate their own HAR page and FCP/LCP/CLS/INP metrics when Chrome detects the interaction/URL/paint sequence. The exact Atlas journey still needs scripting so each edge is named and repeatable: Home → Capability list → Capability detail → Supporting source → Back. Wrap every edge with `commands.measure.start(alias)` and `commands.measure.stop()`; use `commands.navigation.back({ waitForNavigation: true })` for the final edge. [soft-navigation behavior](https://www.sitespeed.io/documentation/sitespeed.io/spa/), [Measure API](https://www.sitespeed.io/documentation/sitespeed.io/scripting/Measure.html), [Navigation API](https://www.sitespeed.io/documentation/sitespeed.io/scripting/Navigation.html)

### 16.4 Metric and artifact mapping

| Required observation                                                                               | Official collection surface                                                                                                                                 | Important boundary                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TTFB, FCP, LCP                                                                                     | Chrome browser timings/Web Vitals; TTFB is `backEndTime`                                                                                                    | Subsequent SPA routes do not create classic Navigation Timing; use Chrome soft-navigation entries and/or user timings. [metrics](https://www.sitespeed.io/documentation/sitespeed.io/metrics/), [SPA](https://www.sitespeed.io/documentation/sitespeed.io/spa/)                                                                                 |
| TBT, Long Task count, total Long Task duration, longest tasks                                      | `--cpu` or `--chrome.collectLongTasks`; inspect the CPU report and trace                                                                                    | Default Long Task threshold is 50 ms; `--minLongTaskLength` may only increase it. [CPU metrics](https://www.sitespeed.io/documentation/sitespeed.io/cpu/)                                                                                                                                                                                       |
| JS parse/compile/evaluate and rendering work                                                       | `--cpu`; Chrome summary groups include `scriptParseCompile`, `scriptEvaluation`, `parseHTML`, `styleLayout`, `paintCompositeRender`, and garbage collection | React mount, router initialization, JSON parsing, ECharts/Markdown initialization, and bundle top-level side effects are not separately named built-ins; add app marks or inspect the trace. [CPU guide](https://www.sitespeed.io/documentation/sitespeed.io/cpu/)                                                                              |
| Raw and transferred JavaScript bytes                                                               | `contentSize.javascript` and `transferSize.javascript` in PageXray/page summary; HAR per-request sizes and headers                                          | “Transferred” is the selected wire encoding, not simultaneous gzip and Brotli sizes. Measure each encoding independently or retain the build-side sidecar inventory. [size definitions](https://www.sitespeed.io/documentation/sitespeed.io/metrics/), [page summary keys](https://www.sitespeed.io/documentation/sitespeed.io/configure-html/) |
| Initial JS and lazy chunks                                                                         | Sum JavaScript requests in the cold initial-page HAR; compare journey HAR pages for later chunks                                                            | An unfetched lazy chunk is absent from HAR, so the complete lazy-chunk count still comes from the build manifest/artifact inventory.                                                                                                                                                                                                            |
| Waterfall, API TTFB, serial requests, statuses, 304s, compression, cache reuse, bytes, DNS/TCP/TLS | `browsertime.har` plus the sitespeed.io HAR waterfall/PageXray report                                                                                       | Local HTTP has no TLS phase, and browser/OS connection reuse can leave DNS/TCP fields absent or zero. Preserve each HAR rather than only screenshots. [Browsertime output](https://www.sitespeed.io/documentation/browsertime/details/), [HAR-based analysis](https://www.sitespeed.io/documentation/coach/introduction/)                       |
| Report summary                                                                                     | `--summaryDetail` and repeated `--html.pageSummaryMetrics <metric>`; retain the generated HTML/data directory                                               | `pageSummary` is the aggregate over iterations; per-run values remain distinct from its median/min/max. [configuration](https://www.sitespeed.io/documentation/sitespeed.io/configuration/), [metric aggregation](https://www.sitespeed.io/documentation/sitespeed.io/configure-metrics/)                                                       |

The application-specific Atlas timings should use the User Timing API and stable names, for example `atlas:primary-content-ready-duration`, `atlas:interaction-ready-duration`, `atlas:route-shell-visible-duration`, and `atlas:route-primary-content-ready-duration`. Browsertime captures user timings by default; `--userTimingAllowList '^atlas:'` narrows the stored set. If a duration cannot be expressed as an in-page `performance.measure`, a journey can read a numeric value with `commands.js.run()` and attach it using `commands.measure.add()`/`addObject()`. [user-timing option](https://www.sitespeed.io/documentation/sitespeed.io/configuration/), [custom metrics API](https://www.sitespeed.io/documentation/sitespeed.io/scripting/custom-metrics/), [User Timing budgets](https://www.sitespeed.io/documentation/sitespeed.io/performance-budget/)

This supports the Atlas definitions without pretending the application already emits them: Primary Content Ready answers when decision-usable capability title, owner, support path, and primary entry content are rendered; Interaction Ready answers when search, tabs, links, expansion, routing, and query state can respond. Section 17 records benchmark-injected SPA route timings and separately records that native first-load marks are absent.

## 17. Measured Docker, sitespeed.io, and Browsertime baseline

### 17.1 Runner identity and interpretation rules

The benchmark used the frozen Linux/arm64 Portal image from Section 12, a fixture-backed Context API made only from the repository's fictional dev fixtures, and an isolated Docker network named `atlas-perf-baseline`. No application source or committed dependency changed. Raw reports, HARs, screenshots, and traces were written outside the repository under `/tmp/atlas-sitespeed-results`.

| Item                                        | Captured value                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| sitespeed.io image                          | `sitespeedio/sitespeed.io:42.5.1`                                         |
| Image digest                                | `sha256:2e6bb729031c5186308fdce3032955ed98a9381086d1ce51cc16857340c7fcbf` |
| Image architecture                          | arm64                                                                     |
| Container OS/kernel                         | Linux via OrbStack, kernel `7.0.11-orbstack-00360-gc9bc4d96ac70`          |
| sitespeed.io / embedded Browsertime / Coach | 42.5.1 / 28.2.0 / 9.2.1                                                   |
| Reported browser                            | Chromium/Chrome 150.0.7871.124 at startup; HAR reports 150.0.7871.181     |
| Node inside runner                          | 24.18.0                                                                   |
| Iterations                                  | 3 per retained series; medians below                                      |
| Connectivity implementation                 | container `NET_ADMIN` capability → embedded Throttle → Linux `tc`         |
| Fixture API delay                           | 0 ms normally; separate 750 ms server-response series                     |

`NET_ADMIN` grants authority; Throttle implements the shaping. Removing either one from this container command makes the pairing incomplete. The retained logs confirm that the custom profile was applied.

All browser measurements used plain HTTP on the Docker network. TLS is therefore absent (`ssl=-1`), and DNS/TCP values describe the container network, not a production edge. The runner's Chrome sent `Accept-Encoding: gzip, deflate` to the non-local `portal` hostname, so browser wire-size rows use gzip. The independent curl probes still prove that the server negotiates Brotli.

### 17.2 First-load home and warm-cache home

All values are medians in milliseconds. Warm runs preloaded `/` in the same browser session before measuring it.

| Profile | Cache | TTFB |   FCP |   LCP |  Load |
| ------- | ----- | ---: | ----: | ----: | ----: |
| A       | cold  |   83 |   336 |   336 |   319 |
| A       | warm  |   84 |   116 |   116 |   159 |
| B       | cold  |  226 |   716 |   716 | 1,073 |
| B       | warm  |  225 |   284 |   284 |   481 |
| C       | cold  |  824 | 2,716 | 2,716 | 6,401 |
| C       | warm  |  784 |   888 |   972 | 1,729 |

Cold home made 18 browser requests: one document, one stylesheet, one font, 14 JavaScript requests, and one TanStack server-function request. Warm home made only two wire requests—the HTML document and one server-function request—and downloaded no JavaScript again. No 304 occurred; immutable assets were reused without a network request.

In a representative Profile B cold run, the HTML request spent 0.192 ms in DNS, 151.269 ms connecting, 119.534 ms waiting, and 169.984 ms receiving. This is why browser TTFB must not be interpreted as server execution time.

### 17.3 Cold capability deep link and controlled slow response

The deep link was `/service/aws/textract`. The 750 ms series delayed every fixture Context API response independently; it did not change bandwidth or RTT. A fresh Portal container was used between the Profile B and C delayed series so process-level loader/query memoization could not leak across them.

| Profile | Fixture API delay |  TTFB |   FCP |   LCP |  Load |
| ------- | ----------------: | ----: | ----: | ----: | ----: |
| A       |              0 ms |    92 |   336 |   336 |   341 |
| B       |              0 ms |   230 |   736 |   736 | 1,084 |
| C       |              0 ms |   827 | 2,884 | 3,344 | 6,156 |
| B       |            750 ms | 1,749 | 2,136 | 2,688 | 2,669 |
| C       |            750 ms | 2,361 | 4,384 | 4,816 | 7,683 |

The undelayed deep link made 22 requests and transferred 438,705 HAR bytes including headers. It required 18 JavaScript chunks versus 14 on home. With a 750 ms fixture delay, Profile B TTFB rose by 1,519 ms and Profile C by 1,534 ms, showing that the SSR document path includes more than one upstream-delay interval or equivalent serialized work. This is an observed end-to-end effect, not proof of which server function or Context API call serialized.

### 17.4 Main-thread cost

The CPU category values are Chrome trace milliseconds. Long Tasks are reported as count / total duration / longest potential input delay.

| Page/profile             |    JS parse/compile |         JS evaluate |        Style/layout | TBT | Long Tasks       |
| ------------------------ | ------------------: | ------------------: | ------------------: | --: | ---------------- |
| Home A                   |                   1 |                  83 |                  44 |   0 | 0 / 0 / 0 ms     |
| Home B                   |                   5 |                 234 |                 139 |   3 | 3 / 187 / 53 ms  |
| Home C                   |                   7 |                 516 |                 281 |  59 | 3 / 389 / 105 ms |
| Capability A             |                   2 |                 100 |                  50 |   0 | 0 / 0 / 0 ms     |
| Capability B             |                   3 |                 275 |                 136 |   1 | 2 / 129 / 51 ms  |
| Capability C             |                   9 |                 585 |                 270 | 191 | 4 / 440 / 149 ms |
| Capability B, 750 ms API | not aggregated here | not aggregated here | not aggregated here |  32 | 2 / 138 / 71 ms  |
| Capability C, 750 ms API | not aggregated here | not aggregated here | not aggregated here | 203 | 6 / 538 / 128 ms |

On cold home, `react-dom-Ckp3x1-a.js` was the dominant named script in the trace. The browser trace does not expose React mount, router initialization, JSON parsing, Markdown, ECharts, or top-level side effects as separate stable counters. No ECharts-heavy route was part of this retained journey, and the captured capability/source pages did not perform a separately identifiable Markdown-render initialization. Those categories require application marks or trace-level attribution in a future comparison; no number is invented here.

### 17.5 JavaScript bytes and lazy chunks

The built public asset directory contains 51 original `.js` chunks. Cold home fetched 14 of them:

| Initial JavaScript measure                                  |   Bytes |
| ----------------------------------------------------------- | ------: |
| Raw build files / decoded HAR content                       | 798,478 |
| Gzip bodies from generated sidecars                         | 253,451 |
| Brotli bodies from generated sidecars                       | 218,246 |
| Actual browser gzip transfer including HAR response headers | 258,334 |

Therefore 37 built JavaScript chunks were not needed by the first home document. The measured journey fetched 16 additional distinct chunks, reaching 30 unique chunks in total and leaving 21 build chunks untouched. “Lazy chunk count” is consequently reported as both the complete build potential (37 after initial) and the observed journey increment (16), not one ambiguous number.

### 17.6 SPA click-to-content and Atlas-specific timings

The scripted sequence was Home → Catalog → filtered Textract capability → Sources → first supporting source → Back. `atlas:route-shell-visible-duration` starts immediately before the click and ends when the URL has changed and the new route's `<main>` exists. `atlas:route-primary-content-ready-duration` ends only when route-specific decision content is present. Values are three-run medians in milliseconds.

| Edge                        | A shell / primary | B shell / primary | C shell / primary |
| --------------------------- | ----------------: | ----------------: | ----------------: |
| Home → Catalog              |         142 / 259 |         222 / 790 |       333 / 2,065 |
| Catalog → capability        |         152 / 504 |         193 / 748 |       267 / 1,953 |
| Capability → Sources        |         189 / 191 |         167 / 483 |       241 / 1,268 |
| Sources → supporting source |         187 / 189 |         171 / 181 |         258 / 275 |
| Supporting source → Back    |           14 / 18 |           41 / 47 |           91 / 99 |

The shell/primary gap is material on the data-bearing routes: under Profile C the catalog shell existed at 333 ms but usable list content was not ready until 2,065 ms; the capability shell existed at 267 ms but the title, owner label, support label, Get started entry, and reference documents were not all present until 1,953 ms.

The application itself emitted zero `atlas:primary-content-ready` and zero `atlas:interaction-ready` marks in every initial-load run. After Browsertime's page-complete check, the benchmark confirmed both readiness conditions were true, but that is only an upper-bound observation and not a valid first-satisfaction duration. The SPA values above are exact relative to the benchmark-injected pre-click marks.

The comparison contract requested for native application instrumentation is:

```js
performance.mark("atlas:navigation-start");

// Capability title, owner, support path, and primary entry are all rendered.
performance.mark("atlas:primary-content-ready");
performance.measure(
  "atlas:primary-content-ready-duration",
  "atlas:navigation-start",
  "atlas:primary-content-ready",
);

// Search, tabs, primary links, expansion, router, and query state can respond.
performance.mark("atlas:interaction-ready");
performance.measure(
  "atlas:interaction-ready-duration",
  "atlas:navigation-start",
  "atlas:interaction-ready",
);
```

The marks must be emitted at the semantic transitions, not after a generic `load`, hydration, or `networkidle` event. Otherwise the metric stops answering when Atlas became usable for a decision.

Back navigation generated zero additional Resource Timing entries in all measured runs and returned primary content in 18/47/99 ms for Profiles A/B/C. This is evidence of in-session route/query reuse. It is not a browser bfcache claim: these are SPA history transitions, not document navigations. The scroll comparison happened at `scrollY=0`, so it does not establish non-zero scroll restoration.

The Profile C journey produced all 15 per-edge HTML/trace pages and the custom metric values above, but sitespeed.io exited 1 during its downstream Coach/HAR processing because Chrome soft-navigation detection produced fewer HAR pages than measured aliases. Profiles A and B exited 0. The Profile C custom values are retained as Browsertime page artifacts with this tooling failure disclosed; the aggregate report must not be described as wholly green.

### 17.7 SPA waterfall and warm API latency

One representative Profile B journey run produced this browser-visible sequence:

| Page reached      | Requests | Transfer bytes | New JS chunks / bytes | Server-function requests | Server-function wait times |
| ----------------- | -------: | -------------: | --------------------: | -----------------------: | -------------------------- |
| Initial home      |       18 |        383,382 |          14 / 258,334 |                        1 | 107 ms                     |
| Catalog           |        9 |         71,802 |            7 / 57,426 |                        2 | 136, 113 ms                |
| Capability        |        6 |         40,333 |            3 / 32,569 |                        3 | 149, 106, 123 ms           |
| Sources           |        4 |         19,672 |             3 / 6,051 |                        1 | 122 ms                     |
| Supporting source |        3 |          6,334 |             3 / 6,334 |                        0 | —                          |

The two catalog server functions began together. The three capability server functions began approximately 0, 156, and 284 ms apart, forming a browser-visible serial waterfall. Browser HAR sees only Portal `_serverFn` RPCs; the Context API requests made inside the Portal container are encapsulated and cannot be attributed separately from this HAR. A future comparison needs server-side timing if it wants to split route loader, Portal RPC, Context API, and upstream source time.

All retained browser requests were HTTP 200; no duplicate URL was fetched within the same measured page, no 304 occurred, and local HTTP had no TLS phase. Cache reuse was observable through omitted requests rather than 304 responses.

### 17.8 Slow-response stability probes

These probes used the 750 ms fixture API delay without browser bandwidth throttling, so they isolate behavior from the three combined network/CPU profiles:

- Rapid navigation Home → Catalog → Sources reached usable Sources content in 1,033 ms with no failed browser request. The superseded Catalog server-function request was **not aborted**; it completed HTTP 200 at 892 ms, after the Sources request had started. This can waste backend work during fast route switching.
- A true offline client transition rendered the in-shell retryable error, `Cloud DevEx Portal couldn’t reach that data.`, at `/catalog`; it did not blank the page or enter a redirect loop.
- A deterministic aborted `_serverFn` request produced the same error boundary. Removing the fault and clicking Retry restored Catalog content in 811 ms.
- The application has no Entra ID/auth redirect loop to test at this commit. No claim is made about auth-failure stability.
- No soak, timeout-threshold, packet-loss, automatic-retry-count, concurrent-user, or memory-leak series was run. The existing E2E degraded-state suite separately proves a visible loading skeleton, an honest fixture-backed feed, and an in-shell not-found error.

## 18. Exact performance reproduction ledger

The following commands recreate the retained Docker/network shape. Run them from the frozen source commit. Names and ports are intentionally explicit so cleanup targets only these resources.

```sh
docker build --progress=plain \
  -f portal/Dockerfile \
  -t atlas-portal:nitro-baseline-6e9a4bdc .

docker network create atlas-perf-baseline

PORT=3221 ATLAS_BASELINE_RESPONSE_DELAY_MS=0 \
  pnpm dlx tsx@4.20.6 .atlas-context-fixture-server.mts \
  > /tmp/atlas-context-fixture-server.log 2>&1 &
atlas_fixture_pid=$!

docker run -d \
  --name atlas-nitro-baseline-6e9a4bdc \
  --network atlas-perf-baseline \
  --network-alias portal \
  -e PORT=8080 \
  -e CONTEXT_API_BASE_URL=http://host.docker.internal:3221/api \
  atlas-portal:nitro-baseline-6e9a4bdc
```

The temporary fixture server used this repository-relative source and was not committed:

```ts
import { createServer } from "node:http";
import { handleHttpRequest } from "./context-layer/src/api/httpRoute.ts";
import { server as mockServer, setDevDiscoveryEnv } from "./context-layer/src/devMocks/index.ts";

const port = Number(process.env.PORT ?? 3221);
const delayMs = Number(process.env.ATLAS_BASELINE_RESPONSE_DELAY_MS ?? 0);

setDevDiscoveryEnv(process.env);
mockServer.listen({ onUnhandledRequest: "bypass" });

const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const result = await handleHttpRequest({
    method: request.method ?? "GET",
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") : value,
      ]),
    ),
    body: Buffer.concat(chunks).toString("utf8"),
    origin: `http://127.0.0.1:${port}`,
  });
  response.writeHead(result.status, result.headers);
  response.end(result.body);
});

server.listen(port, "0.0.0.0");
const shutdown = () => server.close(() => mockServer.close());
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

One cold URL series is:

```sh
docker run --rm \
  --cap-add=NET_ADMIN \
  --shm-size=2g \
  --network atlas-perf-baseline \
  -v /tmp/atlas-sitespeed-results:/sitespeed.io \
  sitespeedio/sitespeed.io:42.5.1 \
  http://portal:8080/ \
  -b chrome -n 3 -c custom \
  --browsertime.connectivity.engine throttle \
  --downstreamKbps 5000 \
  --upstreamKbps 1000 \
  --latency 100 \
  --chrome.CPUThrottlingRate 4 \
  --cpu \
  --video false \
  --visualMetrics false \
  --screenshot false \
  --summaryDetail \
  --outputFolder profile-b-home-cold
```

Change only the four profile values using Section 16.2. For warm home, add `--preURL http://portal:8080/`. For the deep link, replace the measured URL with `http://portal:8080/service/aws/textract`. For controlled server response, restart both the fixture process with `ATLAS_BASELINE_RESPONSE_DELAY_MS=750` and the Portal container before each profile.

The SPA series used the same container flags plus `--multi --spa --userTimingAllowList '^atlas:'`. Save the following as `.atlas-perf-journey.mjs` for reproduction, mount it read-only at `/journey.mjs`, and pass `/journey.mjs` instead of a URL:

<details>
<summary>Exact Browsertime journey script</summary>

```js
const BASE_URL = "http://portal:8080";

async function waitForCondition(commands, expression, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await commands.js.run(`return Boolean(${expression})`)) return;
    await commands.wait.byTime(50);
  }
  const state = await commands.js.run(`return {
    url: location.href,
    title: document.querySelector("h1")?.textContent ?? null,
    text: document.body.innerText.slice(0, 1200)
  }`);
  throw new Error(`Timed out waiting for: ${expression}; state=${JSON.stringify(state)}`);
}

async function markNavigationStart(commands) {
  await commands.js.run(`
    performance.clearMarks("atlas:route-navigation-start");
    performance.clearMarks("atlas:route-shell-visible");
    performance.clearMarks("atlas:route-primary-content-ready");
    performance.mark("atlas:route-navigation-start");
    return true;
  `);
}

async function collectRouteMetrics(commands, primaryCondition) {
  await waitForCondition(
    commands,
    `location.pathname !== window.__atlasPreviousPath && document.querySelector("main")`,
  );
  await commands.js.run(`
    performance.mark("atlas:route-shell-visible");
    performance.measure(
      "atlas:route-shell-visible-duration",
      "atlas:route-navigation-start",
      "atlas:route-shell-visible"
    );
    return true;
  `);
  await waitForCondition(commands, primaryCondition);
  return commands.js.run(`
    performance.mark("atlas:route-primary-content-ready");
    performance.measure(
      "atlas:route-primary-content-ready-duration",
      "atlas:route-navigation-start",
      "atlas:route-primary-content-ready"
    );
    return Object.fromEntries(
      performance
        .getEntriesByType("measure")
        .filter((entry) => entry.name.startsWith("atlas:route-"))
        .map((entry) => [entry.name, entry.duration])
    );
  `);
}

async function measureRoute(commands, alias, selector, path, primaryCondition) {
  await commands.js.run(`window.__atlasPreviousPath = location.pathname; return true;`);
  await markNavigationStart(commands);
  await commands.measure.start(alias);
  await commands.click(selector);
  await commands.waitForUrl(path, { timeout: 20_000 });
  const metrics = await collectRouteMetrics(commands, primaryCondition);
  await commands.measure.stop();
  commands.measure.addObject(metrics);
}

export default async function (_context, commands) {
  await commands.measure.start(`${BASE_URL}/`, "home-initial");
  commands.measure.addObject(
    await commands.js.run(`
      const primaryReady = Boolean(
        document.querySelector("main h1") && document.querySelector('a[href="/catalog"]')
      );
      const interactionReady = Boolean(
        document.readyState === "complete" &&
        document.querySelector('header button[aria-label="Search the catalog"]') &&
        document.querySelector('nav[aria-label="Primary"] a[href="/catalog"]')
      );
      return {
        "atlas:primary-content-ready-observed": primaryReady ? 1 : 0,
        "atlas:interaction-ready-observed": interactionReady ? 1 : 0,
        "atlas:native-primary-content-ready-mark": performance.getEntriesByName(
          "atlas:primary-content-ready"
        ).length,
        "atlas:native-interaction-ready-mark": performance.getEntriesByName(
          "atlas:interaction-ready"
        ).length
      };
    `),
  );

  await measureRoute(
    commands,
    "home-to-catalog",
    'nav[aria-label="Primary"] a[href="/catalog"]',
    "/catalog",
    `document.querySelector('input[placeholder^="Filter services"]') && document.querySelector('a[href="/service/aws/textract"]')`,
  );
  await commands.addText('input[placeholder^="Filter services"]', "Textract");
  await waitForCondition(
    commands,
    `document.querySelector('a[href="/service/aws/textract"]') && !document.querySelector('a[href="/service/aws/bedrock"]')`,
  );
  await measureRoute(
    commands,
    "catalog-to-capability",
    'a[href="/service/aws/textract"]',
    "/service/aws/textract",
    `document.querySelector("h1")?.textContent.includes("Textract") && document.body.innerText.includes("OWNER") && document.body.innerText.includes("SUPPORT") && document.body.innerText.includes("Get started") && document.body.innerText.includes("Reference documents")`,
  );
  await measureRoute(
    commands,
    "capability-to-sources",
    'nav[aria-label="Primary"] a[href="/sources"]',
    "/sources",
    `document.querySelector('input[placeholder="Search sources…"]') && document.querySelector('a[href^="/sources/"]')`,
  );
  await measureRoute(
    commands,
    "sources-to-supporting-source",
    'a[href^="/sources/"]',
    "/sources/",
    `document.querySelector('a[href="/sources"]') && document.querySelector("main h1")`,
  );

  const beforeBack = await commands.js.run(`return {
    resourceCount: performance.getEntriesByType("resource").length,
    scrollY: window.scrollY
  }`);
  await commands.js.run(`window.__atlasPreviousPath = location.pathname; return true;`);
  await markNavigationStart(commands);
  await commands.navigation.back();
  await commands.waitForUrl("/sources", { timeout: 20_000 });
  const backMetrics = await collectRouteMetrics(
    commands,
    `document.querySelector('input[placeholder="Search sources…"]') && document.querySelector('a[href^="/sources/"]')`,
  );
  const afterBack = await commands.js.run(`return {
    resourceCount: performance.getEntriesByType("resource").length,
    scrollY: window.scrollY
  }`);
  commands.measure.addObject({
    ...Object.fromEntries(
      Object.entries(backMetrics).map(([name, value]) => [
        name.replace("atlas:route-", "atlas:back-"),
        value,
      ]),
    ),
    "atlas:back-resource-request-count": afterBack.resourceCount - beforeBack.resourceCount,
    "atlas:back-scroll-position-restored": Number(afterBack.scrollY === beforeBack.scrollY),
  });
}
```

</details>

Run it with:

```sh
docker run --rm \
  --cap-add=NET_ADMIN \
  --shm-size=2g \
  --network atlas-perf-baseline \
  -v /tmp/atlas-sitespeed-results:/sitespeed.io \
  -v "$PWD/.atlas-perf-journey.mjs:/journey.mjs:ro" \
  sitespeedio/sitespeed.io:42.5.1 \
  /journey.mjs \
  -b chrome -n 3 --multi --spa -c custom \
  --browsertime.connectivity.engine throttle \
  --downstreamKbps 5000 --upstreamKbps 1000 --latency 100 \
  --chrome.CPUThrottlingRate 4 --cpu \
  --video false --visualMetrics false --screenshot false \
  --summaryDetail --userTimingAllowList '^atlas:' \
  --outputFolder profile-b-journey
```

The three stability probes require the 750 ms fixture delay and a host-published Portal port. Restart only the capture resources:

```sh
kill "$atlas_fixture_pid"
wait "$atlas_fixture_pid" || true
PORT=3221 ATLAS_BASELINE_RESPONSE_DELAY_MS=750 \
  pnpm dlx tsx@4.20.6 .atlas-context-fixture-server.mts \
  > /tmp/atlas-context-fixture-server-750ms.log 2>&1 &
atlas_fixture_pid=$!

docker stop -t 10 atlas-nitro-baseline-6e9a4bdc
docker rm atlas-nitro-baseline-6e9a4bdc
docker run -d \
  --name atlas-nitro-baseline-6e9a4bdc \
  --network atlas-perf-baseline \
  --network-alias portal \
  -p 3219:8080 \
  -e PORT=8080 \
  -e CONTEXT_API_BASE_URL=http://host.docker.internal:3221/api \
  atlas-portal:nitro-baseline-6e9a4bdc
curl --retry 10 --retry-delay 1 --retry-all-errors -fsS http://localhost:3219/health
```

Save this exact probe as `packages/atlas-e2e/.atlas-stability-probe.mjs`. It must live in that package so the ESM import resolves the package-local `@playwright/test` dependency:

<details>
<summary>Exact Playwright stability probe</summary>

```js
import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3219";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();

const rapidPage = await context.newPage();
const rapidEvents = [];
rapidPage.on("request", (request) => {
  if (request.url().includes("/_serverFn/")) {
    rapidEvents.push({
      type: "request",
      url: new URL(request.url()).pathname,
      at: Date.now(),
    });
  }
});
rapidPage.on("response", (response) => {
  if (response.url().includes("/_serverFn/")) {
    rapidEvents.push({
      type: "response",
      url: new URL(response.url()).pathname,
      status: response.status(),
      at: Date.now(),
    });
  }
});
rapidPage.on("requestfailed", (request) => {
  if (request.url().includes("/_serverFn/")) {
    rapidEvents.push({
      type: "failed",
      url: new URL(request.url()).pathname,
      reason: request.failure()?.errorText,
      at: Date.now(),
    });
  }
});

await rapidPage.goto(`${BASE_URL}/`, {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
const rapidStart = Date.now();
await rapidPage.locator("nav").getByRole("link", { name: "Catalog", exact: true }).click();
await rapidPage.waitForTimeout(50);
await rapidPage.locator("nav").getByRole("link", { name: "Sources", exact: true }).click();
await rapidPage.waitForURL("**/sources", { timeout: 30_000 });
await rapidPage.getByPlaceholder("Search sources…").waitFor({
  state: "visible",
  timeout: 30_000,
});
const rapidEnd = Date.now();
await rapidPage.waitForTimeout(1_200);

const offlinePage = await context.newPage();
await offlinePage.goto(`${BASE_URL}/`, {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await context.setOffline(true);
await offlinePage.locator("nav").getByRole("link", { name: "Catalog", exact: true }).click();
await offlinePage.getByRole("heading", { name: /couldn.t reach/i }).waitFor({
  timeout: 15_000,
});
const offline = {
  url: offlinePage.url(),
  heading: await offlinePage.locator("main h1").first().textContent(),
  body: (await offlinePage.locator("main").innerText()).slice(0, 300),
};
await context.setOffline(false);

const recoveryPage = await context.newPage();
await recoveryPage.goto(`${BASE_URL}/`, {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
const abortServerFunctions = (route) => route.abort("internetdisconnected");
await context.route("**/_serverFn/**", abortServerFunctions);
await recoveryPage.locator("nav").getByRole("link", { name: "Catalog", exact: true }).click();
await recoveryPage.getByRole("heading", { name: /couldn.t reach/i }).waitFor({
  timeout: 15_000,
});
await context.unroute("**/_serverFn/**", abortServerFunctions);
const retryStart = Date.now();
await recoveryPage.getByRole("button", { name: "Retry" }).click();
await recoveryPage.getByPlaceholder(/Filter services/i).waitFor({
  state: "visible",
  timeout: 30_000,
});

console.log(
  JSON.stringify(
    {
      rapid: {
        durationMs: rapidEnd - rapidStart,
        finalUrl: rapidPage.url(),
        events: rapidEvents.map((event) => ({
          ...event,
          atMs: event.at - rapidStart,
          at: undefined,
        })),
        failedRequests: rapidEvents.filter((event) => event.type === "failed").length,
      },
      offline,
      recovery: {
        recovered: true,
        url: recoveryPage.url(),
        retryToContentMs: Date.now() - retryStart,
      },
    },
    null,
    2,
  ),
);

await browser.close();
```

</details>

Run it from the workspace package that owns Playwright and retain the JSON output:

```sh
pnpm --filter @atlas/e2e exec node \
  .atlas-stability-probe.mjs \
  | tee /tmp/atlas-stability-probes.json
```

Raw-value extraction uses the HAR `log.pages[*]._googleWebVitals`, `pageTimings`, `_cpu.categories`, and `_cpu.longTasks` objects. Scripted values are under each run page's “Extra metrics collected using scripting” section. Report medians; do not average the three runs.

Run the setup and cleanup in the same shell so `atlas_fixture_pid` remains the exact host process started above. Targeted cleanup after capture:

```sh
docker stop -t 10 atlas-nitro-baseline-6e9a4bdc
docker rm atlas-nitro-baseline-6e9a4bdc
docker network rm atlas-perf-baseline
kill "$atlas_fixture_pid"
wait "$atlas_fixture_pid" || true
rm -f \
  .atlas-context-fixture-server.mts \
  .atlas-perf-journey.mjs \
  packages/atlas-e2e/.atlas-stability-probe.mjs
```
