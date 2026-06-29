/**
 * Dev-runtime MSW boot (plan 018 seam). Registered ONLY for `vite serve` via
 * `vite.config.ts` `nitro({ plugins })` — never the prod build — so `msw` (a
 * devDependency) never enters the production bundle. This file lives OUTSIDE the
 * auto-scanned `server/plugins/` dir on purpose: it loads only through that
 * conditional registration.
 *
 * It points the `ATLAS_*` discovery channels at the in-process MSW fixtures and
 * starts the Node-mode interceptor at module IMPORT TOP — before any route
 * handler's late-bound `ctx.fetch` captures `globalThis.fetch`. Without it the
 * dev portal's live discovery (Terraform / Confluence / guidance) hits nothing
 * and every surface degrades to an honest-empty catalog: this is the "dev = MSW"
 * half of plan 018's single live path (the "integration = MSW" half is the test
 * harnesses booting the same shared server).
 */
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

setDevDiscoveryEnv();
server.listen({ onUnhandledRequest: "bypass" });

// A plain Nitro plugin function (NOT `defineNitroPlugin` — that auto-import is
// unavailable here because this file loads via the vite `nitro({ plugins })`
// list, outside Nitro's auto-scanned `server/plugins/` dir). Nitro calls the
// default export at startup; the MSW boot + env above are import-time side
// effects, so the body is intentionally empty.
export default () => {};
