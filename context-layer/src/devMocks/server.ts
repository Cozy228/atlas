/**
 * Node-mode MSW server (`@mswjs/interceptors` patches `globalThis.fetch`
 * in-process — NOT a browser Service Worker). Shared by the integration vitest
 * setup and the portal dev-runtime Nitro plugin. `.listen()` must run before any
 * code captures `globalThis.fetch`, so callers start it at import top / in
 * `beforeAll`, ahead of the first resolver fetch.
 *
 * This module — and everything under `devMocks/` — is imported ONLY by tests and
 * the dev runtime, never by application/prod code, so `msw` (a devDependency)
 * stays out of the prod bundle.
 */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
