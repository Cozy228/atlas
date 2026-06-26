import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "./routeTree.gen";
import { RouteError } from "@/components/route-error";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
      },
    },
  });

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // Loader-thrown (awaited primary data) errors render a real, status-aware
    // page in the shell instead of TanStack's bare default. Deferred secondary
    // data failures stay in place via DeferredRegion, so they never reach here.
    defaultErrorComponent: RouteError,
    // P1-5 View Transitions (`defaultViewTransition: true`) intentionally NOT
    // enabled: measured under CPU 6×+Slow-4G it RE-ADDS ~160–280 ms of main-thread
    // blocking to the `/`→`/availability` switch (vs 0 ms without it) — the
    // snapshot capture + cross-fade cost on a throttled CPU undoes the exact
    // tab-switch win this plan delivered, even with the matrix mount deferred
    // (P0-1). Net-negative on the slow-device lens; see perf-iteration-log Iter 9.
    context: { queryClient },
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
