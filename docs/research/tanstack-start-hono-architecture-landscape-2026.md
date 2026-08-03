# TanStack Start and Hono Architecture Landscape (2026)

- Researched: 2026-08-01
- Scope: public sources and the public-safe Atlas repository only
- Decision context: keep the current ALB -> single ECS deployment and the current product boundary

## Executive conclusion

TanStack Start and Nitro are separate decisions. The research and prototype established that a
single-process Hono + Start host is technically credible and can materially improve constrained
cold LCP. Atlas nevertheless selected the simpler Router SPA boundary after the prototype was
measured: the product has no hard request-scoped SSR requirement, and a stable static first-screen
shell captures the most important perceived-load benefit without a second rendering/build system.

The final Atlas boundary is:

```text
ALB
  -> ECS / Hono is the only Node host
       -> /health, /api, /mcp, /resources, discovery: Hono
       -> static assets and meaningful SPA document: Hono
       -> browser navigation and loaders: TanStack Router + Hono HTTP APIs

Context Layer
  -> framework-neutral application and domain logic
  -> Valkey source-content cache
  -> source-system adapters
```

The Hono + Start route is retained as a narrow prototype result, not an adopted runtime. It should
be reopened only if Atlas gains a concrete need for identity-dependent document HTML, route-level
document status/headers, SEO, or equivalent SSR-only behavior.

The prototype was subsequently implemented, optimized, and measured. The initial version missed the
strict warm-cache interaction gate by about 1.2 seconds under Profile C. The first-screen
optimization pass then reduced the cold-home JavaScript closure by 22.6% and made the optimized
warm-cache hybrid 165 ms faster than the older Router SPA at final interaction while retaining a
3.34 second LCP advantage. Those performance gates passed, but the final architecture review
rejected the additional development host, dual builds, SSR/hydration discipline, artifact growth,
and Start release-candidate surface for the current product. See
`docs/architecture/hono-start-hybrid-prototype-verification.md` for the implementation and
measurements.

## What current official sources establish

1. TanStack Start remains a release candidate. Its official overview calls it feature-complete with a stable API, but explicitly not bug-free.
2. Start adds full-document SSR, streaming, server functions/routes, middleware/context, and client/server builds. The same overview explicitly accepts Router-only when those capabilities are known not to be needed.
3. Start's server entry is a universal `Request -> Response` Fetch handler. Typed request context can be passed into the handler and made available to the router.
4. Start route loaders are isomorphic: they run on the server for the initial SSR request and in the browser on later navigation. Server-only imports must therefore not leak into route modules.
5. Start supports selective SSR: route rendering can be enabled, disabled, or set to `data-only`.
6. Deferred hydration exists, but is experimental and is intended for non-critical subtrees. It is not a substitute for making primary navigation or decision data interactive.
7. The official TanStack custom-server E2E uses Vite middleware and `ssrLoadModule` in development, then loads `dist/server/server.js` and serves `dist/client` in production. It does not use Nitro.
8. Hono's official API supports mounting handlers from other frameworks, and Hono is based on the same Web Request/Response primitives.
9. Vite's official SSR guide treats a custom host as a low-level integration: development uses middleware mode; production builds separate client and server outputs that the host must load and serve.

## Ecosystem recommendations are split

The recurring community positions are consistent even though their recommendations differ:

- Use Router + a dedicated API when the product is fundamentally an application client over an existing backend and does not require document SSR.
- Use Start as a frontend/BFF when public or cold-entry pages benefit from SSR, pre-rendering, streaming, or server-controlled presentation data.
- Keep reusable APIs and business capabilities outside Start server functions when other clients, agents, or mobile applications must consume them.
- Avoid two independently deployed processes unless independent scaling, ownership, or security boundaries justify the additional network and operational cost.
- Prefer a stable service interface even when the backend and frontend are co-located in one process.

TanStack creator Tanner Linsley reports that Start's SPA-mode overhead is small and personally prefers Start for optional pre-rendering and public static HTML. Other practitioners recommend Router alone when a real backend already exists. A separate discussion about Hono and Start converges on a BFF boundary: Hono owns reusable APIs, while Start is useful only for frontend-specific SSR and presentation concerns.

These are experience reports, not performance guarantees. They support prototyping the hybrid but do not replace Atlas measurements.

## Atlas-specific fit

The current repository is already close to the required seam:

- `context-layer/` is a framework-neutral package and exposes application handlers consumed by the Hono transport boundary.
- `portal/server/hono/` owns the listener, API/MCP routes, health, request context, static assets, output assembly, and shutdown.
- `portal/src/api/contextApiClient.ts` is a stable client contract.
- `portal/src/api/server/inProcessContextApi.ts` supplies an in-process server implementation.
- Browser-facing Portal data clients already call Hono's `/api` surface.

The Context Layer should therefore not be rewritten "into Hono." Hono owns its HTTP transport
adapter; the Context Layer remains independent. TanStack Router renders Portal UI in the browser
and consumes Hono's explicit HTTP contracts.

### Ownership rules

| Concern                                                         | Owner                                |
| --------------------------------------------------------------- | ------------------------------------ |
| Node listener, readiness, drain, static representations         | Hono host                            |
| Public API, MCP, discovery, resource Markdown                   | Hono routes                          |
| Context resolution, source adapters, repositories, cache policy | Context Layer                        |
| IAM-authenticated iovalkey Cluster connection                   | Context Layer runtime composition    |
| Portal document shell and static delivery                       | Vite build + Hono static host        |
| Route UI and client navigation                                  | TanStack Router SPA                  |
| Browser navigation data access                                  | HTTP `ContextApiClient` through Hono |

Start server functions are absent. Atlas already has explicit HTTP and MCP contracts, and external
consumers do not depend on an app-internal RPC protocol.

## Expected performance behavior

SSR improves when useful markup and prefetched data arrive before client JavaScript has executed. It does not remove the cost of Confluence/source resolution, serialization, downloading JavaScript, or hydration. React's documentation also warns that hydration mismatches and two-pass client rendering add work.

The current measurements show why both rendering and cache policy matter:

- The original Start/Nitro cold-home median had substantially earlier FCP/LCP than the Router SPA.
- The remediated Hono SPA reduced initial JavaScript transfer and improved every measured warm navigation.
- A controlled 500 ms source delay barely changed LCP but delayed primary-data readiness substantially.
- A warm source cache recovered almost all of that controlled data penalty.

The hybrid can address the cold document gap; Valkey addresses the upstream data gap. The final
route uses a meaningful static SPA shell for the first concern and Valkey for the second, without
adopting the hybrid runtime.

The old 9.7 MiB Start/Nitro artifact is not a valid prediction for Hono-hosted Start because it included Nitro. Likewise, the current 5.4 MiB Hono artifact cannot predict the hybrid. Client/server outputs, initial JavaScript, Docker size, and build time must be remeasured on the same code and profile.

## Material risks

1. **Development integration:** TanStack's maintained custom-host example is Express-based. Hono-front development must prove Vite HMR, SSR module reload, error stack rewriting, and environment propagation.
2. **Streaming lifecycle:** a Fetch handler can return before its response body finishes streaming. Hono request accounting, logging, cancellation, and graceful shutdown must track the body lifecycle, not only handler return.
3. **Isomorphic loader leakage:** route modules must not import Context Layer, IAM, iovalkey, AWS credential, or other server-only code into the browser build.
4. **Duplicate fetching:** server-prefetched Query state must dehydrate and hydrate correctly so the browser does not immediately repeat the same API calls.
5. **API ownership:** introducing Start server routes/functions for existing public contracts would recreate two backend surfaces.
6. **RC upgrade cost:** Start's API is considered stable, but deployment and response-semantics regressions remain an ecosystem risk. Dependency upgrades require an explicit production-host regression suite.
7. **Response semantics:** document 404s, redirects, cookies, cache headers, HEAD, stream cancellation, and error responses need coverage across the Hono/Start boundary.

## Options

| Option                                | Strength                                                                    | Cost                                                                                       | Atlas recommendation                                  |
| ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Router SPA + Hono                     | Smallest proven artifact; simplest ownership; best measured warm navigation | Live/route-specific content still waits for JavaScript and APIs                            | **Adopted final route with meaningful static shell**  |
| Hono host + Start documents, no Nitro | Restores SSR selectively; preserves Hono API/runtime ownership; one process | Custom dev/build seam; SSR/hydration and stream lifecycle return                           | Measured prototype; not selected                      |
| Start host + Hono under `/api`        | Less custom Start dev setup                                                 | Start owns outer lifecycle; weakens current Hono ownership; may reintroduce host ambiguity | Secondary option only                                 |
| Start + Nitro host                    | Most documented Vite/Node hosting path                                      | Reintroduces Nitro beta integration and the ownership removed by this migration            | Do not restore by default                             |
| Separate Start BFF and Hono service   | Cleanest independent service boundary and scaling                           | Two deployments, network hop, more operations                                              | Not justified while deployment/product stay unchanged |

## Historical acceptance gate for the hybrid prototype

The thresholds below are proposed project gates, not external standards:

- Improve Profile C cold-home LCP by at least 2 seconds relative to the remediated Hono SPA.
- Do not regress primary-data-ready median relative to an equivalent Valkey state.
- Keep initial JavaScript transfer within 10% of the current 208,377-byte browser measurement.
- Keep the deployable artifact materially below the old 9.7 MiB Start/Nitro artifact.
- Preserve all API, MCP, static-representation, container, signal, and graceful-shutdown tests.
- Add tests for SSR document 404/status/redirect/cookies, stream cancellation, Vite development HMR, and server-to-client Query hydration without duplicate fetches.
- Keep Hono as the sole listener and public API owner; use no Nitro.
- Verify a real IAM-authenticated iovalkey Cluster connection in the deployment environment before claiming cache latency or availability.

The optimized prototype passed its narrow performance gates. The final review still selected Router
SPA + Hono after maintenance, failure modes, artifact size, and the lack of a hard SSR product
requirement were included in the decision.

## Sources

Primary and maintainer sources:

- [TanStack Start overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- [TanStack Start server entry point](https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point)
- [TanStack Start execution model](https://tanstack.com/start/latest/docs/framework/react/guide/execution-model)
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [TanStack Start SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)
- [TanStack Start selective SSR](https://tanstack.com/start/v0/docs/framework/react/guide/selective-ssr)
- [TanStack Start deferred hydration](https://tanstack.com/start/latest/docs/framework/react/guide/deferred-hydration)
- [TanStack custom-server E2E](https://github.com/TanStack/router/tree/main/e2e/react-start/custom-basepath)
- [TanStack custom-server implementation](https://raw.githubusercontent.com/TanStack/router/main/e2e/react-start/custom-basepath/express-server.ts)
- [TanStack maintainer custom-server discussion](https://github.com/TanStack/router/discussions/3777)
- [Hono application and mount API](https://hono.dev/docs/api/hono)
- [Hono Web Standards](https://hono.dev/docs/concepts/web-standard)
- [Vite SSR guide](https://vite.dev/guide/ssr.html)
- [React `hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot)
- [web.dev rendering guidance](https://web.dev/articles/rendering-on-the-web)
- [Thoughtworks Technology Radar, Volume 34](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en_1.pdf)

Experience reports used only to map common recommendations:

- [TanStack Router or Start discussion, including Tanner Linsley](https://www.reddit.com/r/reactjs/comments/1r7mmfm/tanstack_router_or_start/)
- [Separate Hono backend versus Start discussion](https://www.reddit.com/r/reactjs/comments/1sxdseu/should_i_use_tasntack_start_with_the_separate/)
- [How I Use Hono and TanStack Start](https://sigh.dev/posts/how-i-use-hono-and-tanstack-start/)
