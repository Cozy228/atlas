/**
 * Dev reference-discovery adapter (plan 017 B7) — returns sample
 * `DiscoveredReference[]` for a few known services IN CODE so the merge surface,
 * the spine-only page, and the `unconfigured` banner are developable + testable
 * fully offline (no creds, no network).
 *
 * It does NOT read `data/*.yaml`: discovery is a live-fetch port, not a governed
 * registry source (per `seed-dev-adapter-principle` — the design target is the
 * real-environment CQL fetch; this fixture is a mock, never the design standard).
 * Every reference is honestly reference-only: `content_mode: "reference_only"`,
 * `agent_accessible: false`. An unknown service is an honest empty list (a miss
 * is never a fabricated link).
 */
import type { DiscoveredReference } from "@atlas/schema";
import type { ResourceReferenceDiscovery } from "../../services/resourceReferenceDiscovery";

// Fixed fixture observation time — the in-code links were "observed" when this
// fixture was authored. Deterministic so tests need no clock injection.
const FIXTURE_OBSERVED_AT = "2026-06-28T00:00:00.000Z";

/** Build a reference-only link with the honesty fields baked in. */
function ref(
  title: string,
  url: string,
  docType: DiscoveredReference["doc_type"],
): DiscoveredReference {
  return {
    title,
    url,
    doc_type: docType,
    last_observed_at: FIXTURE_OBSERVED_AT,
    content_mode: "reference_only",
    access_mode: "service_credentials",
    agent_accessible: false,
  };
}

// Sample references keyed by canonical `{provider}/{id}`. Spans all three
// doc_types across a configured service (aws/textract) and spine-only services
// (aws/s3, azure/aks) so both the configured-merge and unconfigured-banner paths
// render with content. Fictional, public-safe URLs only.
const FIXTURE_REFERENCES: Record<string, DiscoveredReference[]> = {
  "aws/textract": [
    ref(
      "Textract — service design",
      "https://wiki.example.com/wiki/spaces/CLOUD/pages/1201/Textract+Service+Design",
      "design",
    ),
    ref(
      "Textract — onboarding & usage guide",
      "https://wiki.example.com/wiki/spaces/CLOUD/pages/1202/Textract+Usage+Guide",
      "user-guide",
    ),
    ref(
      "Textract — data handling policy",
      "https://wiki.example.com/wiki/spaces/CLOUD/pages/1203/Textract+Data+Policy",
      "policy",
    ),
  ],
  "aws/s3": [
    ref(
      "S3 — bucket design standards",
      "https://wiki.example.com/wiki/spaces/CLOUD/pages/1301/S3+Bucket+Design",
      "design",
    ),
    ref(
      "S3 — public access policy",
      "https://wiki.example.com/wiki/spaces/CLOUD/pages/1302/S3+Public+Access+Policy",
      "policy",
    ),
  ],
  "azure/aks": [
    ref(
      "AKS — onboarding guide",
      "https://wiki.example.com/wiki/spaces/CLOUD/pages/1401/AKS+Onboarding+Guide",
      "user-guide",
    ),
  ],
};

export function createDevReferenceDiscovery(): ResourceReferenceDiscovery {
  return {
    discover: (identity) =>
      Promise.resolve({
        references: FIXTURE_REFERENCES[identity.key] ?? [],
        status: "fresh",
        last_observed_at: FIXTURE_OBSERVED_AT,
        incomplete: false,
      }),
  };
}
