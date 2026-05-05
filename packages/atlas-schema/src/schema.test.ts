import { describe, expect, it } from "vitest";
import {
  AnchorSchema,
  ContextBundleResponseSchema,
  ContextRequestSchema,
  ExpansionRequestSchema,
  SourceDiscoveryRequestSchema,
  SourceSchema,
  SourceTopicMappingSchema,
  TopicDiscoveryRequestSchema,
  TopicSchema,
  apiErrorCodes,
  authorityLevels,
  sourceClasses,
  topicTypes,
} from "./index.js";

const anchor = {
  id: "textract-private-subnet",
  label: "Private subnet usage",
  locator: "#private-subnet-usage",
};

const source = {
  id: "textract-module-readme",
  title: "Textract Terraform Module",
  source_class: "terraform-module",
  location: "github.com/acme/terraform-aws-textract",
  steward: "cloud-platform",
  visibility: "internal",
  authority_scope: ["module-usage"],
  authority_level: "authoritative",
  anchor_strategy: "markdown-heading",
  available_anchors: [anchor],
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-05-01T00:00:00.000Z",
  review_frequency: "P90D",
};

const topic = {
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
};

describe("contract enums", () => {
  it("matches the V1 source classes exactly", () => {
    expect(sourceClasses).toEqual([
      "terraform-module",
      "confluence-page",
      "policy-document",
    ]);
  });

  it("matches the V1 topic types exactly", () => {
    expect(topicTypes).toEqual([
      "capability",
      "landing-zone",
      "guardrail-area",
    ]);
  });

  it("matches the V1 authority levels exactly", () => {
    expect(authorityLevels).toEqual([
      "authoritative",
      "reference",
      "example",
      "draft",
      "deprecated",
    ]);
  });

  it("defines stable machine-readable API error codes", () => {
    expect(apiErrorCodes).toEqual([
      "source_not_found",
      "anchor_broken",
      "source_unavailable",
      "access_denied",
      "topic_not_found",
      "invalid_request",
    ]);
  });
});

describe("entity schemas", () => {
  it("requires source governance fields on Source", () => {
    const parsed = SourceSchema.parse(source);

    expect(parsed.authority_level).toBe("authoritative");
    expect(parsed.authority_scope).toEqual(["module-usage"]);
    expect(parsed.steward).toBe("cloud-platform");
  });

  it("rejects malformed source enum values", () => {
    expect(() =>
      SourceSchema.parse({ ...source, source_class: "sharepoint-page" }),
    ).toThrow();
  });

  it("keeps governance fields off Topic", () => {
    expect(() =>
      TopicSchema.parse({ ...topic, authority_level: "authoritative" }),
    ).toThrow();
  });

  it("keeps governance fields off SourceTopicMapping", () => {
    expect(() =>
      SourceTopicMappingSchema.parse({
        id: "textract-module-to-topic",
        source_id: "textract-module-readme",
        topic_id: "aws-textract",
        authority_level: "authoritative",
      }),
    ).toThrow();
  });

  it("requires non-nullable Topic identity fields", () => {
    expect(() => TopicSchema.parse({ ...topic, owner_team: null })).toThrow();
  });
});

describe("request and response schemas", () => {
  it("accepts discovery, topic discovery, context, and expansion requests", () => {
    expect(SourceDiscoveryRequestSchema.parse({ query: "textract" })).toEqual({
      query: "textract",
    });
    expect(TopicDiscoveryRequestSchema.parse({ topic_type: "capability" })).toEqual({
      topic_type: "capability",
    });
    expect(ContextRequestSchema.parse({ topic_id: "aws-textract" })).toEqual({
      topic_id: "aws-textract",
    });
    expect(
      ExpansionRequestSchema.parse({
        source_id: "textract-module-readme",
        anchor_id: "textract-private-subnet",
        disclosure_level: 2,
      }),
    ).toEqual({
      source_id: "textract-module-readme",
      anchor_id: "textract-private-subnet",
      disclosure_level: 2,
    });
  });

  it("requires sources, warnings, and expansion_paths on every context bundle", () => {
    const response = {
      bundle_id: "bundle-textract",
      request: {
        topic_id: "aws-textract",
      },
      sources: [
        {
          source,
          anchors: [AnchorSchema.parse(anchor)],
          selection_rationale: "Authoritative module source for the topic.",
          excerpts: [
            {
              anchor_id: "textract-private-subnet",
              text: "Use the private endpoint configuration.",
              citation: {
                source_id: "textract-module-readme",
                anchor_id: "textract-private-subnet",
                label: "Private subnet usage",
                location: "github.com/acme/terraform-aws-textract#private-subnet-usage",
              },
            },
          ],
        },
      ],
      warnings: [],
      expansion_paths: [
        {
          source_id: "textract-module-readme",
          anchor_id: "textract-private-subnet",
          disclosure_level: 2,
          label: "Adjacent module examples",
        },
      ],
    };

    expect(ContextBundleResponseSchema.parse(response)).toEqual(response);
    expect(() =>
      ContextBundleResponseSchema.parse({
        bundle_id: "bundle-textract",
        request: {
          topic_id: "aws-textract",
        },
        sources: [],
        warnings: [],
      }),
    ).toThrow();
  });
});
