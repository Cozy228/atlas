/**
 * Resource derivation (plan 018 G5): `resource = groupByKindIdentity(discovered)`
 * projected through the kernel's `SECTION_RULES`. Resources are the OUTPUT of
 * discovery, never authored seed. One `ResourceContextRecord` per discovered
 * service; its sections are bound where a rule + a discovered source agree, and
 * omitted otherwise (honest-gap — never an empty section, which the schema's
 * `min(1)` per section forbids).
 *
 * Section→source binding:
 *  - `terraform-module` sections (`network` / `examples`) bind to the module
 *    README, located at a heading whose text matches the rule's `headingPattern`.
 *    A heading binds to at most ONE section: rules are tried in `SECTION_RULES`
 *    key order, so a heading matching several patterns is claimed by the
 *    highest-priority section (network before examples), and a later section
 *    falls through to its next matching heading. This makes the projection
 *    deterministic when patterns overlap (e.g. "Private subnet usage" matches
 *    both the network and the examples pattern).
 *  - the `availability-matrix` section binds — for EVERY service — to the
 *    synthetic availability source by a `{ service }` selector.
 */
import type {
  EntryTool,
  ResourceContextRecord,
  ResourceSectionBinding,
  SectionId,
  Source,
} from "@atlas/schema";
import { SECTION_RULES, type SectionRule } from "../kernel/sectionRules";
import type { DiscoveredService } from "./discoverSources";

/** The one synthetic availability source every service's `availability` cites. */
const AVAILABILITY_MATRIX_SOURCE_ID = "availability-matrix";

// Fixed fictional, recent freshness stamps so a derived source is in-window (not
// flagged stale) when this engine later backs the live path. Public-safe.
const REVIEW_FREQUENCY = "quarterly";
const FIXED_OBSERVED_AT = "2026-06-20T09:00:00.000Z";
const FIXED_REVIEWED_AT = "2026-06-20T09:00:00.000Z";

type TerraformRule = Extract<SectionRule, { from: "terraform-module" }>;

/** Derive one `ResourceContextRecord` per discovered service. */
export function deriveServiceResources(discovered: DiscoveredService[]): ResourceContextRecord[] {
  return discovered.map(deriveServiceRecord);
}

function deriveServiceRecord(service: DiscoveredService): ResourceContextRecord {
  const rules = SECTION_RULES.service;
  const sections: Record<string, ResourceSectionBinding[]> = {};

  // Heading-located sections, accumulated ACROSS every module the service has.
  // Within one module a heading is claimed by at most one section (rule priority);
  // across modules the section collects one binding per contributing module (so a
  // multi-module service lists each module's network/examples section, in order).
  const tfRules = Object.entries(rules).filter(
    (entry): entry is [SectionId, TerraformRule] => entry[1]?.from === "terraform-module",
  );
  for (const module of service.modules) {
    const bound = new Set<string>();
    for (const heading of module.headings) {
      for (const [sectionId, rule] of tfRules) {
        if (bound.has(sectionId)) {
          continue;
        }
        if (rule.headingPattern.test(heading)) {
          const existing = sections[sectionId] ?? (sections[sectionId] = []);
          existing.push({
            source_id: module.sourceId,
            heading,
            citation_label: heading,
            order: 10 * (existing.length + 1),
          });
          bound.add(sectionId);
          break; // this heading is consumed by the first matching section
        }
      }
    }
  }

  // Availability binds for every service (selector-located, no heading).
  for (const [sectionId, rule] of Object.entries(rules)) {
    if (rule?.from !== "availability-matrix") {
      continue;
    }
    sections[sectionId] = [
      {
        source_id: AVAILABILITY_MATRIX_SOURCE_ID,
        // The matrix resolver matches a service by its machine id, not its name.
        selector: { service: service.identity.id },
        citation_label: `${service.identity.name} regional availability`,
        order: 10,
      },
    ];
  }

  // Presentation metadata (plan 018 G5): only what discovery can honestly back —
  // `category` from the availability domain, a default `status`, a `description`
  // from the FIRST module README's lead paragraph, and ONE entry tool per module.
  // `owner_team`/`support_channel` are not discoverable, so they stay unset (honest
  // gap, never fabricated); a module-less service has no entry tools / description.
  const multiModule = service.modules.length > 1;
  const entryTools =
    service.modules.length > 0
      ? service.modules.map((module) => moduleEntryTool(module, multiModule))
      : undefined;
  const description = service.modules.find((module) => module.summary)?.summary;

  return {
    kind: "service",
    slug: service.identity.key,
    provider: service.identity.provider,
    name: service.identity.name,
    aliases: service.identity.admissionAliases,
    category: service.domain,
    status: "active",
    ...(description ? { description } : {}),
    ...(entryTools ? { entry_tools: entryTools } : {}),
    sections,
  };
}

/**
 * One entry tool per Terraform module a service exposes: a link to the module on
 * the registry. The URL is built from the host-less module address
 * (`<namespace>/<name>/<provider>`). With a single module the label stays the plain
 * "Terraform module"; a multi-module service disambiguates by the module name.
 */
function moduleEntryTool(
  module: { name: string; address: string },
  multiModule: boolean,
): EntryTool {
  return {
    label: multiModule ? `Terraform module: ${module.name}` : "Terraform module",
    url: `https://app.terraform.io/example/registry/modules/${module.address}`,
  };
}

/**
 * The Source records the derived sections cite: one per discovered module plus
 * the single synthetic availability-matrix source. Freshness is fixed in-window
 * so a later live wiring does not falsely flag these stale.
 */
export function deriveServiceSourceRecords(discovered: DiscoveredService[]): Source[] {
  const sources: Source[] = [];
  for (const service of discovered) {
    const multiModule = service.modules.length > 1;
    for (const module of service.modules) {
      sources.push({
        id: module.sourceId,
        // A single-module service names the source after the service; a multi-module
        // service names each after its module so the sources stay distinguishable.
        title: multiModule
          ? `${service.identity.name} — ${module.name} Terraform Module`
          : `${service.identity.name} Terraform Module`,
        source_class: "terraform-module",
        location: module.address,
        category: service.domain,
        visibility: "internal",
        authority_scope: ["module-usage"],
        authority_level: "authoritative",
        last_observed_at: FIXED_OBSERVED_AT,
        last_reviewed_at: FIXED_REVIEWED_AT,
        review_frequency: REVIEW_FREQUENCY,
      });
    }
  }
  sources.push({
    id: AVAILABILITY_MATRIX_SOURCE_ID,
    title: "Regional Availability Matrix",
    source_class: "availability-matrix",
    location: "availability",
    category: "Platform",
    visibility: "internal",
    authority_scope: ["regional-availability"],
    authority_level: "authoritative",
    last_observed_at: FIXED_OBSERVED_AT,
    last_reviewed_at: FIXED_REVIEWED_AT,
    review_frequency: REVIEW_FREQUENCY,
  });
  return sources;
}
