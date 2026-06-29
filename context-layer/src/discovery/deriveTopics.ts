/**
 * Topic derivation (plan 018 G5): the catalog facets are the OUTPUT of discovery,
 * one `Topic` per discovered resource — never authored seed. A service Topic's
 * `id` is the resource slug (`aws/<id>`, = `record.slug`); a guardrail Topic's
 * `id` is the guardrail slug. Presentation metadata is honest-gap: only what
 * discovery can back (id/name/type/category/status, plus a service's module entry
 * tool) is set; `description`/`owner_team`/`support_channel` are omitted (the
 * `TopicSchema` made them optional for exactly this reason).
 */
import type { Topic } from "@atlas/schema";
import type { DiscoveredService } from "./discoverSources";
import type { DiscoveredGuardrail } from "./discoverGuardrails";

/** The guardrail facet category — security policies are cross-cutting. */
const GUARDRAIL_CATEGORY = "Security";

/** One service Topic per discovered service. `id` = the resource slug. */
export function discoverServiceTopics(discovered: DiscoveredService[]): Topic[] {
  return discovered.map(
    (service): Topic => ({
      id: service.identity.key,
      name: service.identity.name,
      topic_type: "service",
      // Category = the availability domain (the same value `deriveServiceResources`
      // uses for the resource record), so the catalog facets line up with it.
      category: service.domain,
      status: "active",
      ...(service.module ? { entry_tools: [moduleEntryTool(service.module.address)] } : {}),
    }),
  );
}

/** One security-policy Topic per discovered guardrail. `id` = the guardrail slug. */
export function discoverGuardrailTopics(discovered: DiscoveredGuardrail[]): Topic[] {
  return discovered.map(
    (guardrail): Topic => ({
      id: guardrail.slug,
      name: guardrail.name,
      topic_type: "security-policy",
      category: GUARDRAIL_CATEGORY,
      status: "active",
    }),
  );
}

/**
 * The single entry tool a module-backed service surfaces on its facet Topic: a
 * link to its Terraform module on the registry. Mirrors `deriveResources`'
 * `moduleEntryTool` so the Topic and the Resource record agree.
 */
function moduleEntryTool(address: string) {
  return {
    label: "Terraform module",
    url: `https://app.terraform.io/example/registry/modules/${address}`,
  };
}
