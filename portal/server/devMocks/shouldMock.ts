/**
 * The dev-runtime mock/live decision — the ONE source of truth, shared by the
 * MSW boot (`start.ts`) and the data-mode badge (`src/api/server/dataMode.ts`).
 *
 * Three-state (plan 026 seam contract): an explicit `DEV_MOCKS` override wins
 * ('1' = force mock, '0' = force real); otherwise auto-detect by the presence of
 * real Confluence creds. Pure + dependency-free on purpose, so it is safe to
 * import from BOTH the Nitro dev plugin and the app's server bundle without
 * dragging in `msw` or `@tanstack/react-start`.
 */
export function shouldMockData(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = env.DEV_MOCKS; // '1' = force mock, '0' = force real
  const hasRealCreds = !!env.CONFLUENCE_TOKEN && !!env.CONFLUENCE_BASE_URL;
  return explicit != null ? explicit !== "0" : !hasRealCreds;
}
