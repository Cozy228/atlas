/**
 * The dev-runtime mock/live decision — evaluated ONCE at boot by the MSW plugin
 * (`start.ts`), which caches the result in `DEV_DATA_MODE` for the data-mode badge
 * (`src/api/server/dataMode.ts`) to read. That cached marker is the runtime source
 * of truth, NOT this function: do NOT call `shouldMockData()` again after boot to
 * re-derive the mode, because `setDevDiscoveryEnv()` then injects fixture
 * CONFLUENCE_* creds, so a second call would see creds present and wrongly report
 * 'live' while MSW is still serving mocks. Pure + dependency-free on purpose, so
 * it is safe to import from the Nitro dev plugin without dragging in `msw`.
 *
 * Three-state contract: an explicit `DEV_MOCKS` override wins — exactly '1' forces
 * mock, exactly '0' forces real. ANY other value (unset, '', 'false', …) means "no
 * override" and falls through to auto-detect by the presence of real Confluence
 * creds. (Only the literals '1'/'0' are overrides, so a stray empty `DEV_MOCKS=`
 * never silently forces mock when real creds are present.)
 */
export function shouldMockData(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DEV_MOCKS === "1") return true; // force mock (E2E uses this; hermetic regardless of creds)
  if (env.DEV_MOCKS === "0") return false; // force real (debug the real path)
  // No override → auto-detect: mock unless BOTH real Confluence creds are present.
  const hasRealCreds = !!env.CONFLUENCE_TOKEN && !!env.CONFLUENCE_BASE_URL;
  return !hasRealCreds;
}
