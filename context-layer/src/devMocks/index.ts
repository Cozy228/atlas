/**
 * Shared dev/integration MSW surface (plan 018). Consumed by:
 *   - context-layer integration tests (via `setup.ts`),
 *   - portal integration tests + the portal dev-runtime Nitro plugin,
 * all of which point `ATLAS_CONFLUENCE_*` / `ATLAS_TERRAFORM_*` at this fixture
 * and let the live adapters fetch through the Node-mode interceptor.
 *
 * Exposed under the `@atlas/context-layer/devMocks` subpath ONLY — never the main
 * barrel — so `msw` (a devDependency) stays out of the prod import graph.
 */
export { server } from "./server";
export { handlers, devMockLatencyMs } from "./handlers";
export * from "./fixtures";
export * from "./availabilityFixture";
