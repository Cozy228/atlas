/**
 * Dev-runtime MSW boot (plan 018 seam · 026 three-state activation). Registered
 * ONLY for `vite serve` via `vite.config.ts` `nitro({ plugins })` — never the prod
 * build — so `msw` (a devDependency) never enters the production bundle. This file
 * lives OUTSIDE the auto-scanned `server/plugins/` dir on purpose: it loads only
 * through that conditional registration.
 *
 * Activation is three-state: an explicit `DEV_MOCKS` override wins ('1' = force
 * mock, '0' = force real); otherwise it auto-detects by the presence of real
 * Confluence creds. When mocking, it points the discovery channels at the
 * in-process MSW fixtures and starts the Node-mode interceptor at module IMPORT
 * TOP — before any route handler's late-bound `ctx.fetch` captures
 * `globalThis.fetch`. When NOT mocking (real creds in `.env.local`, or `=0`), it
 * no-ops so live discovery (Terraform / Confluence / guidance) reaches the real
 * source systems. A fresh clone with no creds still gets fixtures (zero-config).
 */
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

import { shouldMockData } from "./shouldMock";

const mock = shouldMockData();
// Record the resolved mode for the data-mode badge (dataMode.ts reads it). Set
// it BEFORE setDevDiscoveryEnv() mutates the discovery env, so the marker
// reflects the original creds, not the injected fixtures. The prod build never
// registers this plugin → the marker is absent → the badge reports 'live'.
process.env.DEV_DATA_MODE = mock ? "mock" : "live";
if (mock) {
  // Dev-runtime injected latency at the MSW network seam so a real source fetch
  // is visibly slow. The CORRECT behaviour: the FIRST fetch pays this; every
  // revisit reads the warm React Query cache and is instant (no refetch). Default
  // only when unset; the MSW default stays 0 so the test suite is never slowed.
  if (!process.env.DEV_MOCK_LATENCY_MS) {
    process.env.DEV_MOCK_LATENCY_MS = "800";
  }
  setDevDiscoveryEnv();
  server.listen({ onUnhandledRequest: "bypass" });
}

// A plain Nitro plugin function (NOT `defineNitroPlugin` — that auto-import is
// unavailable here because this file loads via the vite `nitro({ plugins })`
// list, outside Nitro's auto-scanned `server/plugins/` dir). Nitro calls the
// default export at startup; the MSW boot + env above are import-time side
// effects, so the body is intentionally empty.
export default () => {};
