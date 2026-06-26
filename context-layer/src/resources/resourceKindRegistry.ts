import type { ResourceKind, SectionId } from "@atlas/schema";

/**
 * Resource-kind registry — the authoritative, extensible map of resource kinds
 * to their Section vocabulary (proposal §13-B "Agent capability registry").
 *
 * This is a kind-first framework, NOT a hard-coded service enum: adding a kind
 * is one entry here. The machine-readable surfaces are generated from it — the
 * OpenAPI `kind` / `sections` enums, the per-kind applicability notes, the
 * Markdown section template order, `llms.txt`, and `ai-catalog.json` — so the
 * vocabulary can never drift between documents (proposal §13.2).
 *
 * Per the plan's "complete" boundary, `service` carries the full Section
 * vocabulary and `guardrail` proves the framework extends to a non-service kind;
 * further kinds (landing-zone, guidance, skill, …) are added the same way.
 *
 * Section *order* here is the canonical projection / Markdown template order.
 */

export type SectionDef = {
  id: SectionId;
  /** Agent-facing description; feeds the OpenAPI `sections` enum docs + llms.txt. */
  description: string;
  /** Representative questions this Section answers (proposal §13-B). */
  exampleQuestions: string[];
};

export type ResourceKindDef = {
  kind: ResourceKind;
  /** Short display label. */
  label: string;
  /** What this kind of resource is. */
  description: string;
  /** The kind's Section vocabulary, in canonical projection order. */
  sections: SectionDef[];
};

const SERVICE_SECTIONS: SectionDef[] = [
  {
    id: "overview",
    description: "What the service is and the primary workloads it supports.",
    exampleQuestions: ["What is this service for?", "What does this service do?"],
  },
  {
    id: "availability",
    description:
      "Supported regions, partitions, and regional feature availability for this service.",
    exampleQuestions: [
      "Which regions support this service?",
      "Is it available in ca-central-1?",
      "Is it available in GovCloud?",
    ],
  },
  {
    id: "network",
    description:
      "Private connectivity: VPC endpoints, PrivateLink, private subnets, DNS, and internet egress.",
    exampleQuestions: [
      "Can this service be used in a private subnet?",
      "Does it support a VPC endpoint or PrivateLink?",
      "Can it be reached without the public internet?",
    ],
  },
  {
    id: "security",
    description: "Encryption, access control, key management, and data-protection posture.",
    exampleQuestions: ["How is data encrypted?", "Does it support customer-managed keys?"],
  },
  {
    id: "compliance",
    description: "Compliance scope, certifications, and regulated-workload considerations.",
    exampleQuestions: ["Is this service approved for regulated workloads?"],
  },
  {
    id: "pricing",
    description: "Cost model and pricing references.",
    exampleQuestions: ["How is this service priced?"],
  },
  {
    id: "limits",
    description: "Quotas, throughput limits, and service constraints.",
    exampleQuestions: ["What are the service limits or quotas?"],
  },
  {
    id: "guidance",
    description: "Internal adoption guidance and recommended patterns.",
    exampleQuestions: ["How should my team adopt this service?"],
  },
  {
    id: "examples",
    description: "Cited starter configuration and usage examples (e.g. the approved module).",
    exampleQuestions: ["Is there an approved module or starter example?"],
  },
  {
    id: "sources",
    description: "The registered Sources Atlas projects this resource from.",
    exampleQuestions: ["Where does this information come from?"],
  },
];

const GUARDRAIL_SECTIONS: SectionDef[] = [
  {
    id: "scope",
    description: "What workloads and resources this guardrail applies to.",
    exampleQuestions: ["What does this guardrail cover?"],
  },
  {
    id: "enforced-controls",
    description: "The controls this guardrail enforces.",
    exampleQuestions: ["What controls are enforced?", "Must buckets block public access?"],
  },
  {
    id: "exceptions",
    description: "Documented exceptions or deprecated allowances under this guardrail.",
    exampleQuestions: ["Are there any exceptions to this guardrail?"],
  },
];

export const resourceKindRegistry: Record<ResourceKind, ResourceKindDef> = {
  service: {
    kind: "service",
    label: "Cloud service",
    description:
      "A managed cloud service (e.g. service/aws/textract). Provider is folded into the slug tail.",
    sections: SERVICE_SECTIONS,
  },
  guardrail: {
    kind: "guardrail",
    label: "Guardrail",
    description: "A governance guardrail enforcing controls across workloads.",
    sections: GUARDRAIL_SECTIONS,
  },
};

export function listResourceKinds(): ResourceKind[] {
  return Object.keys(resourceKindRegistry) as ResourceKind[];
}

export function getResourceKindDef(kind: string): ResourceKindDef | undefined {
  return (resourceKindRegistry as Record<string, ResourceKindDef>)[kind];
}

/** The Section ids registered for a kind, in canonical projection order. */
export function sectionIdsForKind(kind: ResourceKind): SectionId[] {
  return resourceKindRegistry[kind].sections.map((section) => section.id);
}
