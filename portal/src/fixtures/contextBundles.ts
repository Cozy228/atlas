import type { ContextBundleResponse } from "@atlas/schema";

export const serviceBundle: ContextBundleResponse = {
  bundle_id: "bundle-aws-textract",
  request: { topic_id: "aws-textract", disclosure_level: 1 },
  sources: [
    {
      source: {
        id: "textract-module-readme",
        title: "Textract Terraform Module",
        source_class: "terraform-module",
        location: "example/textract/aws",
        steward: "cloud-platform",
        visibility: "internal",
        authority_scope: ["module-usage"],
        authority_level: "authoritative",
        last_observed_at: "2026-05-05T00:00:00.000Z",
        last_reviewed_at: "2026-05-01T00:00:00.000Z",
        review_frequency: "P90D",
      },
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
      ],
      selection_rationale: "Selected through explicit Source-Topic mapping.",
      excerpts: [
        {
          anchor_id: "private-subnet-usage",
          text: "Use the Textract module with private endpoint configuration.",
          citation: {
            source_id: "textract-module-readme",
            anchor_id: "private-subnet-usage",
            label: "Private subnet usage",
            location: "example/textract/aws#private-subnet-usage",
          },
        },
      ],
    },
  ],
  anchor_references: [
    {
      source_id: "textract-module-readme",
      anchor_id: "private-subnet-usage",
      citation_label: "Private subnet usage",
      status: "valid",
    },
  ],
  warnings: [],
  expansion_paths: [
    {
      source_id: "textract-module-readme",
      anchor_id: "private-subnet-usage",
      disclosure_level: 2,
      label: "Terraform module",
    },
  ],
};

export const landingZoneBundle: ContextBundleResponse = {
  bundle_id: "bundle-central-landing-zone",
  request: { topic_id: "central-landing-zone", disclosure_level: 1 },
  sources: [
    {
      source: {
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
      anchors: [
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
      ],
      selection_rationale: "Selected through explicit Source-Topic mapping.",
      excerpts: [
        {
          anchor_id: "environment-matrix",
          text: "Central Landing Zone separates production and non-production accounts.",
          citation: {
            source_id: "central-lz-confluence",
            anchor_id: "environment-matrix",
            label: "Environment matrix",
            location:
              "https://confluence.example.com/display/CLOUD/Central+Landing+Zoneenvironment-matrix",
          },
        },
      ],
    },
  ],
  anchor_references: [
    {
      source_id: "central-lz-confluence",
      anchor_id: "environment-matrix",
      citation_label: "Environment matrix",
      status: "valid",
    },
  ],
  warnings: [],
  expansion_paths: [
    {
      source_id: "central-lz-confluence",
      anchor_id: "environment-matrix",
      disclosure_level: 2,
      label: "environment-matrix",
    },
  ],
};
