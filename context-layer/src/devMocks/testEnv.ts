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
  DEV_TERRAFORM_BASE_URL,
} from "./fixtures";

/**
 * Set every discovery env var to the MSW fixture endpoints (idempotent).
 *
 * `referenceSpace` (default true) controls only the reference-discovery space
 * (`ATLAS_CONFLUENCE_SPACE_KEYS`): leave it off for tests that compare two live
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
  env.ATLAS_TERRAFORM_BASE_URL = DEV_TERRAFORM_BASE_URL;
  env.ATLAS_TERRAFORM_TOKEN = "dev-mock-token";
  // Confluence channel: availability page + guardrail space.
  env.ATLAS_CONFLUENCE_BASE_URL = DEV_CONFLUENCE_BASE_URL;
  env.ATLAS_CONFLUENCE_TOKEN = "dev-mock-token";
  env.ATLAS_CONFLUENCE_SECURITY_SPACE_KEY = DEV_CONFLUENCE_SECURITY_SPACE_KEY;
  env.ATLAS_CONFLUENCE_AVAILABILITY_PAGE_AWSF = DEV_AVAILABILITY_PAGE_ID_AWSF;
  // Reference-discovery space (optional): on by default.
  if (options.referenceSpace !== false) {
    env.ATLAS_CONFLUENCE_SPACE_KEYS = DEV_CONFLUENCE_SPACE_KEYS.join(",");
  } else {
    delete env.ATLAS_CONFLUENCE_SPACE_KEYS;
  }
}
