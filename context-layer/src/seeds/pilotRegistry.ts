import {
  AnchorSchema,
  FeedbackSchema,
  SourceSchema,
  SourceTopicMappingSchema,
  TopicSchema,
} from "@atlas/schema";
import { InMemoryAnchorRepository } from "../repositories/anchorRepository.js";
import {
  InMemoryFeedbackRepository,
  type FeedbackRepository,
} from "../repositories/feedbackRepository.js";
import { InMemorySourceRepository } from "../repositories/sourceRepository.js";
import { InMemorySourceTopicMappingRepository } from "../repositories/sourceTopicMappingRepository.js";
import { InMemoryTopicRepository } from "../repositories/topicRepository.js";
import { pilotFeedbackSeed } from "./pilotFeedbackSeed.js";

export type PilotRegistrySeed = {
  anchors: unknown[];
  feedback: unknown[];
  sources: unknown[];
  topics: unknown[];
  mappings: unknown[];
};

export type PilotRegistry = {
  anchors: InMemoryAnchorRepository;
  feedback: FeedbackRepository;
  sources: InMemorySourceRepository;
  topics: InMemoryTopicRepository;
  mappings: InMemorySourceTopicMappingRepository;
};

export type PilotRegistryOptions = {
  feedback?: FeedbackRepository;
};

export function loadPilotRegistry(
  seed: PilotRegistrySeed,
  options: PilotRegistryOptions = {},
): PilotRegistry {
  const anchors = seed.anchors.map((anchor) => AnchorSchema.parse(anchor));
  const feedback = seed.feedback.map((item) => FeedbackSchema.parse(item));
  const sources = seed.sources.map((source) => SourceSchema.parse(source));
  const topics = seed.topics.map((topic) => TopicSchema.parse(topic));
  const mappings = seed.mappings.map((mapping) =>
    SourceTopicMappingSchema.parse(mapping),
  );

  const sourceIds = new Set(sources.map((source) => source.id));
  const topicIds = new Set(topics.map((topic) => topic.id));
  const anchorIds = new Set(anchors.map((anchor) => anchor.id));

  for (const anchor of anchors) {
    if (!sourceIds.has(anchor.source_id)) {
      throw new Error(`Unknown source_id in anchor: ${anchor.source_id}`);
    }
  }

  for (const mapping of mappings) {
    if (!sourceIds.has(mapping.source_id)) {
      throw new Error(`Unknown source_id in mapping: ${mapping.source_id}`);
    }
    if (!topicIds.has(mapping.topic_id)) {
      throw new Error(`Unknown topic_id in mapping: ${mapping.topic_id}`);
    }
  }

  for (const item of feedback) {
    if (item.target_type === "source" && !sourceIds.has(item.target_id)) {
      throw new Error(`Unknown source target_id in feedback: ${item.target_id}`);
    }
    if (item.target_type === "topic" && !topicIds.has(item.target_id)) {
      throw new Error(`Unknown topic target_id in feedback: ${item.target_id}`);
    }
    if (item.target_type === "anchor" && !anchorIds.has(item.target_id)) {
      throw new Error(`Unknown anchor target_id in feedback: ${item.target_id}`);
    }
  }

  return {
    anchors: new InMemoryAnchorRepository(anchors),
    feedback: options.feedback ?? new InMemoryFeedbackRepository(feedback),
    sources: new InMemorySourceRepository(sources),
    topics: new InMemoryTopicRepository(topics),
    mappings: new InMemorySourceTopicMappingRepository(mappings),
  };
}

export const pilotRegistrySeed = {
  topics: [
    {
      id: "aws-textract",
      name: "AWS Textract",
      topic_type: "capability",
      category: "ai-ml",
      status: "active",
      description: "Managed OCR capability for document workflows.",
      owner_team: "cloud-platform",
      support_channel: "#cloud-platform",
      entry_tools: [
        {
          label: "Terraform module",
          url: "https://github.com/acme/terraform-aws-textract",
        },
      ],
    },
    {
      id: "aws-bedrock",
      name: "AWS Bedrock",
      topic_type: "capability",
      category: "ai-ml",
      status: "active",
      description: "Managed foundation model access for approved workloads.",
      owner_team: "cloud-platform",
      support_channel: "#cloud-platform",
      entry_tools: [{ label: "Module", url: "https://github.com/acme/bedrock" }],
    },
    {
      id: "serverless-compute",
      name: "Serverless Compute",
      topic_type: "capability",
      category: "compute",
      status: "active",
      description: "Lambda-based compute patterns for event-driven workloads.",
      owner_team: "cloud-platform",
      support_channel: "#serverless-support",
      entry_tools: [{ label: "Module", url: "https://github.com/acme/lambda" }],
    },
    {
      id: "central-landing-zone",
      name: "Central Landing Zone",
      topic_type: "landing-zone",
      category: "platform",
      status: "active",
      description: "Default landing zone for standard application workloads.",
      owner_team: "cloud-foundation",
      support_channel: "#landing-zone-support",
      entry_tools: [{ label: "TFE", url: "https://tfe.example.com/central" }],
    },
    {
      id: "regulated-landing-zone",
      name: "Regulated Landing Zone",
      topic_type: "landing-zone",
      category: "platform",
      status: "active",
      description: "Restricted landing zone for regulated workloads.",
      owner_team: "cloud-foundation",
      support_channel: "#regulated-cloud",
      entry_tools: [{ label: "TFE", url: "https://tfe.example.com/regulated" }],
    },
    {
      id: "sandbox-landing-zone",
      name: "Sandbox Landing Zone",
      topic_type: "landing-zone",
      category: "platform",
      status: "active",
      description: "Short-lived experimentation environment.",
      owner_team: "cloud-foundation",
      support_channel: "#sandbox-cloud",
      entry_tools: [{ label: "TFE", url: "https://tfe.example.com/sandbox" }],
    },
    {
      id: "s3-guardrails",
      name: "S3 Guardrails",
      topic_type: "guardrail-area",
      category: "security",
      status: "active",
      description: "Storage encryption, public access, and lifecycle controls.",
      owner_team: "cloud-security",
      support_channel: "#cloud-security",
      entry_tools: [],
    },
    {
      id: "private-networking",
      name: "Private Networking",
      topic_type: "guardrail-area",
      category: "network",
      status: "active",
      description: "VPC endpoint and private subnet connectivity guidance.",
      owner_team: "network-platform",
      support_channel: "#network-platform",
      entry_tools: [],
    },
    {
      id: "iam-boundary",
      name: "IAM Boundary",
      topic_type: "guardrail-area",
      category: "security",
      status: "active",
      description: "Permission boundary and role delegation requirements.",
      owner_team: "cloud-security",
      support_channel: "#cloud-security",
      entry_tools: [],
    },
    {
      id: "logging-monitoring",
      name: "Logging and Monitoring",
      topic_type: "guardrail-area",
      category: "operations",
      status: "active",
      description: "Baseline telemetry requirements for platform workloads.",
      owner_team: "observability-platform",
      support_channel: "#observability",
      entry_tools: [],
    },
  ],
  sources: [
    {
      id: "textract-module-readme",
      title: "Textract Terraform Module",
      source_class: "terraform-module",
      location: "github.com/acme/terraform-aws-textract",
      steward: "cloud-platform",
      visibility: "internal",
      authority_scope: ["module-usage", "private-networking"],
      authority_level: "authoritative",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-05-01T00:00:00.000Z",
      review_frequency: "P90D",
    },
    {
      id: "bedrock-module-readme",
      title: "Bedrock Terraform Module",
      source_class: "terraform-module",
      location: "github.com/acme/terraform-aws-bedrock",
      steward: "cloud-platform",
      visibility: "internal",
      authority_scope: ["module-usage", "ai-ml"],
      authority_level: "authoritative",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-04-15T00:00:00.000Z",
      review_frequency: "P90D",
    },
    {
      id: "lambda-module-readme",
      title: "Lambda Terraform Module",
      source_class: "terraform-module",
      location: "github.com/acme/terraform-aws-lambda",
      steward: "serverless-platform",
      visibility: "internal",
      authority_scope: ["module-usage", "compute"],
      authority_level: "authoritative",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-04-20T00:00:00.000Z",
      review_frequency: "P90D",
    },
    {
      id: "central-lz-confluence",
      title: "Central Landing Zone Guide",
      source_class: "confluence-page",
      location: "https://confluence.example.com/display/CLOUD/Central+Landing+Zone",
      steward: "cloud-foundation",
      visibility: "internal",
      authority_scope: ["landing-zone-guidance"],
      authority_level: "authoritative",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-04-10T00:00:00.000Z",
      review_frequency: "P120D",
    },
    {
      id: "regulated-lz-confluence",
      title: "Regulated Landing Zone Guide",
      source_class: "confluence-page",
      location: "https://confluence.example.com/display/CLOUD/Regulated+Landing+Zone",
      steward: "cloud-foundation",
      visibility: "restricted",
      authority_scope: ["landing-zone-guidance", "regulated-workloads"],
      authority_level: "authoritative",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-03-20T00:00:00.000Z",
      review_frequency: "P90D",
    },
    {
      id: "sandbox-lz-confluence",
      title: "Sandbox Landing Zone Guide",
      source_class: "confluence-page",
      location: "https://confluence.example.com/display/CLOUD/Sandbox+Landing+Zone",
      steward: "cloud-foundation",
      visibility: "internal",
      authority_scope: ["landing-zone-guidance"],
      authority_level: "reference",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-04-25T00:00:00.000Z",
      review_frequency: "P120D",
    },
    {
      id: "s3-policy-doc",
      title: "S3 Security Policy",
      source_class: "policy-document",
      location: "s3://policy-docs/cloud/s3-security.md",
      steward: "cloud-security",
      visibility: "internal",
      authority_scope: ["security-guardrail", "storage"],
      authority_level: "authoritative",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-04-01T00:00:00.000Z",
      review_frequency: "P90D",
    },
    {
      id: "legacy-s3-policy",
      title: "Legacy S3 Policy",
      source_class: "policy-document",
      location: "s3://policy-docs/cloud/legacy-s3-security.md",
      steward: "cloud-security",
      visibility: "internal",
      authority_scope: ["security-guardrail", "storage"],
      authority_level: "deprecated",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2024-01-15T00:00:00.000Z",
      review_frequency: "P90D",
    },
    {
      id: "private-networking-policy",
      title: "Private Networking Policy",
      source_class: "policy-document",
      location: "s3://policy-docs/cloud/private-networking.md",
      steward: "network-platform",
      visibility: "internal",
      authority_scope: ["security-guardrail", "private-networking"],
      authority_level: "authoritative",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-04-05T00:00:00.000Z",
      review_frequency: "P90D",
    },
    {
      id: "iam-boundary-policy",
      title: "IAM Boundary Policy",
      source_class: "policy-document",
      location: "s3://policy-docs/cloud/iam-boundary.md",
      steward: "cloud-security",
      visibility: "restricted",
      authority_scope: ["security-guardrail", "iam-boundary"],
      authority_level: "authoritative",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-04-12T00:00:00.000Z",
      review_frequency: "P90D",
    },
    {
      id: "logging-standard-doc",
      title: "Telemetry Standard",
      source_class: "policy-document",
      location: "s3://policy-docs/cloud/telemetry-standard.md",
      steward: "observability-platform",
      visibility: "internal",
      authority_scope: ["operations-guardrail", "logging-monitoring"],
      authority_level: "authoritative",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-04-18T00:00:00.000Z",
      review_frequency: "P90D",
    },
    {
      id: "platform-reference-guide",
      title: "Cloud Platform Reference Guide",
      source_class: "confluence-page",
      location: "https://confluence.example.com/display/CLOUD/Platform+Reference",
      steward: "cloud-platform",
      visibility: "internal",
      authority_scope: ["reference-guidance"],
      authority_level: "draft",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-04-30T00:00:00.000Z",
      review_frequency: "P30D",
    },
  ],
  anchors: [
    {
      id: "private-subnet-usage",
      source_id: "textract-module-readme",
      anchor_strategy: "markdown-heading",
      title: "Private subnet usage",
      selector: { locator: "#private-subnet-usage" },
      citation_label: "Private subnet usage",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "model-access",
      source_id: "bedrock-module-readme",
      anchor_strategy: "markdown-heading",
      title: "Model access",
      selector: { locator: "#model-access" },
      citation_label: "Model access",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "event-sources",
      source_id: "lambda-module-readme",
      anchor_strategy: "markdown-heading",
      title: "Event sources",
      selector: { locator: "#event-sources" },
      citation_label: "Event sources",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "environment-matrix",
      source_id: "central-lz-confluence",
      anchor_strategy: "confluence-section",
      title: "Environment matrix",
      selector: { locator: "environment-matrix" },
      citation_label: "Environment matrix",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "regulated-controls",
      source_id: "regulated-lz-confluence",
      anchor_strategy: "confluence-section",
      title: "Regulated controls",
      selector: { locator: "regulated-controls" },
      citation_label: "Regulated controls",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "expiration-policy",
      source_id: "sandbox-lz-confluence",
      anchor_strategy: "confluence-section",
      title: "Expiration policy",
      selector: { locator: "expiration-policy" },
      citation_label: "Expiration policy",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "public-access",
      source_id: "s3-policy-doc",
      anchor_strategy: "document-clause",
      title: "Public access controls",
      selector: { locator: "clause-2.1" },
      citation_label: "Public access controls",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "legacy-public-access",
      source_id: "legacy-s3-policy",
      anchor_strategy: "document-clause",
      title: "Legacy public access",
      selector: { locator: "clause-1.4" },
      citation_label: "Legacy public access",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "vpc-endpoints",
      source_id: "private-networking-policy",
      anchor_strategy: "document-clause",
      title: "VPC endpoints",
      selector: { locator: "missing-clause-4.2" },
      citation_label: "VPC endpoints",
      status: "broken",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "delegated-roles",
      source_id: "iam-boundary-policy",
      anchor_strategy: "document-clause",
      title: "Delegated roles",
      selector: { locator: "clause-3.1" },
      citation_label: "Delegated roles",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "required-signals",
      source_id: "logging-standard-doc",
      anchor_strategy: "document-clause",
      title: "Required signals",
      selector: { locator: "clause-1.2" },
      citation_label: "Required signals",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "pilot-limitations",
      source_id: "platform-reference-guide",
      anchor_strategy: "confluence-section",
      title: "Pilot limitations",
      selector: { locator: "pilot-limitations" },
      citation_label: "Pilot limitations",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
  ],
  feedback: pilotFeedbackSeed,
  mappings: [
    { id: "map-textract-module", source_id: "textract-module-readme", topic_id: "aws-textract" },
    { id: "map-textract-networking", source_id: "textract-module-readme", topic_id: "private-networking" },
    { id: "map-bedrock-module", source_id: "bedrock-module-readme", topic_id: "aws-bedrock" },
    { id: "map-lambda-module", source_id: "lambda-module-readme", topic_id: "serverless-compute" },
    { id: "map-central-lz", source_id: "central-lz-confluence", topic_id: "central-landing-zone" },
    { id: "map-regulated-lz", source_id: "regulated-lz-confluence", topic_id: "regulated-landing-zone" },
    { id: "map-sandbox-lz", source_id: "sandbox-lz-confluence", topic_id: "sandbox-landing-zone" },
    { id: "map-s3-policy", source_id: "s3-policy-doc", topic_id: "s3-guardrails" },
    { id: "map-legacy-s3-policy", source_id: "legacy-s3-policy", topic_id: "s3-guardrails" },
    { id: "map-networking-policy", source_id: "private-networking-policy", topic_id: "private-networking" },
    { id: "map-networking-central", source_id: "private-networking-policy", topic_id: "central-landing-zone" },
    { id: "map-iam-boundary", source_id: "iam-boundary-policy", topic_id: "iam-boundary" },
    { id: "map-iam-regulated", source_id: "iam-boundary-policy", topic_id: "regulated-landing-zone" },
    { id: "map-logging-standard", source_id: "logging-standard-doc", topic_id: "logging-monitoring" },
    { id: "map-reference-textract", source_id: "platform-reference-guide", topic_id: "aws-textract" },
    { id: "map-reference-landing-zone", source_id: "platform-reference-guide", topic_id: "central-landing-zone" },
  ],
} satisfies PilotRegistrySeed;
