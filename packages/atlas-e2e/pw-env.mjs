/**
 * Shared zero-download Playwright run environment (plan 026), in ONE place so the
 * two configs, the browser doctor, and the warmup global-setup never drift. This
 * is a `.mjs` (not `.ts`) on purpose: the plain-node doctor (`node
 * scripts/doctor.mjs`) can import it directly, while the `.ts` configs read its
 * types from the sibling `pw-env.d.mts`.
 */

/**
 * Drive an already-installed SYSTEM browser via `channel` — never download
 * Chromium (decision 2). Edge ships on the Windows/Linux CI images; macOS uses
 * Chrome. Override with PW_CHANNEL.
 */
export const channel = process.env.PW_CHANNEL ?? (process.platform === "darwin" ? "chrome" : "msedge");

/**
 * One base URL for both the readiness probe and in-test navigation, so they never
 * drift. `localhost` (not 127.0.0.1) on purpose: the dev server binds whichever
 * loopback stack it prefers (IPv6 `::1` locally), which a hard-coded IPv4 probe
 * would miss; `localhost` resolves to whatever the server actually bound.
 */
export const baseURL = process.env.PW_BASE_URL ?? "http://localhost:3000";

/**
 * Routes whose client chunks are heavy + lazily code-split (the availability
 * matrix's react-table, service/policy/guidance detail). The warmup global-setup
 * visits them ONCE before the fullyParallel run so Vite's cold on-demand dep
 * optimization settles up-front — otherwise a mid-run re-optimize triggers a
 * full-reload that aborts any navigation racing it (net::ERR_ABORTED, observed
 * flaky on a cold dev server; masked only by retries in CI).
 */
export const WARMUP_ROUTES = [
  "/",
  "/availability",
  "/catalog",
  "/service/aws/textract",
  "/guidance",
  "/sources",
  "/whatsnew",
];
