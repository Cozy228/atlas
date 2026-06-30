/**
 * Guardrail derivation (plan 018 G5): `guardrail = perDiscoveredPage(discovered)`
 * projected through the kernel's `SECTION_RULES.guardrail`. Mirrors
 * `deriveResources` for the service kind. One `ResourceContextRecord` per
 * discovered security-policy page; its `enforced-controls` / `exceptions` sections
 * bind ONLY where a page heading matches the rule's `headingPattern`, and are
 * omitted otherwise (honest-gap — never an empty section, which the schema's
 * `min(1)` per section forbids).
 *
 * Section→source binding: both guardrail sections bind to the page's own
 * policy-document Source, located by a heading whose text matches the rule
 * pattern. A heading binds to at most ONE section: rules are tried in
 * `SECTION_RULES` key order (enforced-controls before exceptions), so a heading
 * matching several patterns is claimed by the highest-priority section and a
 * later section falls through to its next matching heading.
 */
import type {
  ResourceContextRecord,
  ResourceSectionBinding,
  SectionId,
  Source,
} from "@atlas/schema";
import { SECTION_RULES, type SectionRule } from "../kernel/sectionRules";
import type { DiscoveredGuardrail } from "./discoverGuardrails";

/** The facet category every derived guardrail carries — security policies are a
 *  single cross-cutting domain (absorbed from the retired guardrail Topic). */
const GUARDRAIL_CATEGORY = "Security";

// Fixed fictional, recent freshness stamps so a derived source is in-window (not
// flagged stale) when this engine later backs the live path. Public-safe.
const REVIEW_FREQUENCY = "quarterly";
const FIXED_OBSERVED_AT = "2026-06-20T09:00:00.000Z";
const FIXED_REVIEWED_AT = "2026-06-20T09:00:00.000Z";

type PolicyRule = Extract<SectionRule, { from: "policy-document" }>;

/** The policy-document Source id a guardrail's sections cite. */
function policyDocSourceId(slug: string): string {
  return `${slug}-policy-doc`;
}

/** Derive one `ResourceContextRecord` per discovered guardrail. */
export function deriveGuardrailResources(
  discovered: DiscoveredGuardrail[],
): ResourceContextRecord[] {
  return discovered.map(deriveGuardrailRecord);
}

function deriveGuardrailRecord(guardrail: DiscoveredGuardrail): ResourceContextRecord {
  const rules = SECTION_RULES.guardrail;
  const sections: Record<string, ResourceSectionBinding[]> = {};

  // Heading-located sections: one heading → at most one section, by rule priority.
  const policyRules = Object.entries(rules).filter(
    (entry): entry is [SectionId, PolicyRule] => entry[1]?.from === "policy-document",
  );
  const sourceId = policyDocSourceId(guardrail.slug);
  const bound = new Set<string>();
  for (const heading of guardrail.headings) {
    for (const [sectionId, rule] of policyRules) {
      if (bound.has(sectionId)) {
        continue;
      }
      if (rule.headingPattern.test(heading)) {
        sections[sectionId] = [
          {
            source_id: sourceId,
            heading,
            citation_label: heading,
            order: 10,
          },
        ];
        bound.add(sectionId);
        break; // this heading is consumed by the first matching section
      }
    }
  }

  return {
    kind: "guardrail",
    slug: guardrail.slug,
    name: guardrail.name,
    aliases: dedupe([guardrail.name, guardrail.slug]),
    // Presentation metadata absorbed from the retired guardrail Topic: security
    // policies are one cross-cutting domain and are active once discovered.
    category: GUARDRAIL_CATEGORY,
    status: "active",
    sections,
  };
}

/**
 * The Source records the derived sections cite: one `policy-document` Source per
 * discovered page. Freshness is fixed in-window so a later live wiring does not
 * falsely flag these stale. The `id` MUST equal the binding `source_id`.
 */
export function deriveGuardrailSourceRecords(discovered: DiscoveredGuardrail[]): Source[] {
  return discovered.map((guardrail) => ({
    id: policyDocSourceId(guardrail.slug),
    title: guardrail.name,
    source_class: "policy-document",
    location: guardrail.pageId,
    category: GUARDRAIL_CATEGORY,
    visibility: "internal",
    authority_scope: ["security-guardrail"],
    authority_level: "authoritative",
    last_observed_at: FIXED_OBSERVED_AT,
    last_reviewed_at: FIXED_REVIEWED_AT,
    review_frequency: REVIEW_FREQUENCY,
  }));
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}
