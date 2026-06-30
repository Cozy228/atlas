/**
 * Shared discovery test-env helper (plan 018 G5). After the registry/resources
 * flip, the Context Layer catalog is the OUTPUT of env-gated, honest-empty
 * discovery: with no env set, a service has an EMPTY catalog (single live path).
 * So every test that needs catalog data must point the Confluence + Terraform
 * channels at the MSW fixtures AND boot the shared Node-mode server.
 *
 * This sets ALL the discovery env vars at once (service modules + availability
 * spine + reference-discovery space + guardrail space) so individual tests stop
 * hand-listing a subset. The Node-mode MSW server is booted by the global
 * `devMocks/setup.ts` (context-layer) or each test's own `server.listen()`.
 */
import { DEV_AVAILABILITY_PAGE_ID_AWSF } from "./availabilityFixture";
import {
  DEV_CONFLUENCE_BASE_URL,
  DEV_CONFLUENCE_SECURITY_SPACE_KEY,
  DEV_CONFLUENCE_SPACE_KEYS,
  DEV_RELEASE_NOTES_PAGE_ID,
  DEV_TERRAFORM_BASE_URL,
} from "./fixtures";
import { DEV_GUIDANCE_URL } from "./guidanceFixture";

/**
 * Set every discovery env var to the MSW fixture endpoints (idempotent).
 *
 * `referenceSpace` (default true) controls only the reference-discovery space
 * (`CONFLUENCE_SPACE_KEYS`): leave it off for tests that compare two live
 * projections for equality, because reference discovery stamps a run-time
 * `last_observed_at` that legitimately differs between two independent calls —
 * with the space unset, references are an honest empty list (deterministic),
 * exactly as before the flip when these tests set no discovery env at all.
 */
export function setDevDiscoveryEnv(
  env: Record<string, string | undefined> = process.env,
  options: { referenceSpace?: boolean } = {},
): void {
  // Service module discovery (Terraform registry) + the availability spine.
  env.TERRAFORM_BASE_URL = DEV_TERRAFORM_BASE_URL;
  env.TERRAFORM_TOKEN = "dev-mock-token";
  // Confluence channel: availability page + guardrail space.
  env.CONFLUENCE_BASE_URL = DEV_CONFLUENCE_BASE_URL;
  env.CONFLUENCE_TOKEN = "dev-mock-token";
  env.CONFLUENCE_SECURITY_SPACE_KEY = DEV_CONFLUENCE_SECURITY_SPACE_KEY;
  env.CONFLUENCE_AVAILABILITY_PAGE_AWSF = DEV_AVAILABILITY_PAGE_ID_AWSF;
  // "What's New" release-notes page (MSW serves CONFLUENCE_PAGES[this id]). Without
  // it resolveReleaseNotes bails on the unconfigured sentinel and /whatsnew is
  // honest-empty — so the release-detail route would never get dev/e2e coverage.
  env.CONFLUENCE_RELEASE_NOTES_PAGE_ID = DEV_RELEASE_NOTES_PAGE_ID;
  // Guidance store: the live loadGuidance loader fetches this URL (MSW-served).
  env.GUIDANCE_URL = DEV_GUIDANCE_URL;
  // Reference-discovery space (optional): on by default.
  if (options.referenceSpace !== false) {
    env.CONFLUENCE_SPACE_KEYS = DEV_CONFLUENCE_SPACE_KEYS.join(",");
  } else {
    delete env.CONFLUENCE_SPACE_KEYS;
  }
}
