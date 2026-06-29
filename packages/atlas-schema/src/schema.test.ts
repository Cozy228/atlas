import { describe, expect, it } from "vitest";
import {
  DiscoveredReferenceSchema,
  FeedbackResponseSchema,
  FeedbackSchema,
  FeedbackSubmissionSchema,
  ResourceContextResponseSchema,
  ServiceIdentitySchema,
  SourceDiscoveryRequestSchema,
  SourceSchema,
  SourceTopicMappingSchema,
  TopicDiscoveryRequestSchema,
  TopicSchema,
  apiErrorCodes,
  authorityLevels,
  docTypes,
  sourceClasses,
  topicTypes,
} from "./index";

const source = {
  id: "textract-module-readme",
  title: "Textract Terraform Module",
  source_class: "terraform-module",
  location: "github.com/example/terraform-aws-textract",
  steward: "cloud-platform",
  visibility: "internal",
  authority_scope: ["module-usage"],
  authority_level: "authoritative",
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-05-01T00:00:00.000Z",
  review_frequency: "P90D",
};

const topic = {
  id: "aws-textract",
  name: "AWS Textract",
  topic_type: "service",
  category: "ai-ml",
  status: "active",
  description: "Managed OCR service for document workflows.",
  owner_team: "cloud-platform",
  support_channel: "#cloud-platform",
  entry_tools: [
    {
      label: "Terraform module",
      url: "https://github.com/example/terraform-aws-textract",
    },
  ],
};

describe("contract enums", () => {
  it("matches the V1 source classes exactly", () => {
    expect(sourceClasses).toEqual([
      "terraform-module",
      "confluence-page",
      "policy-document",
      "availability-matrix",
    ]);
  });

  it("matches the V1 topic types exactly", () => {
    expect(topicTypes).toEqual(["service", "security-policy"]);
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
      "resource_not_found",
      "invalid_request",
    ]);
  });
});

describe("entity schemas", () => {
  it("carries optional, dormant authority fields on Source (plan 019)", () => {
    const parsed = SourceSchema.parse(source);
    expect(parsed.authority_level).toBe("authoritative");
    expect(parsed.authority_scope).toEqual(["module-usage"]);
    expect(parsed.steward).toBe("cloud-platform");

    // Authority is deferred end-to-end: a Source without it still validates.
    const { authority_level, authority_scope, ...withoutAuthority } = source;
    void authority_level;
    void authority_scope;
    const reparsed = SourceSchema.parse(withoutAuthority);
    expect(reparsed.authority_level).toBeUndefined();
    expect(reparsed.authority_scope).toBeUndefined();
  });

  it("rejects unknown fields on a Source record (strict schema)", () => {
    expect(() => SourceSchema.parse({ ...source, unexpected_field: [] })).toThrow();
  });

  it("accepts operational feedback as a separate non-authoritative signal", () => {
    const parsed = FeedbackSchema.parse({
      id: "feedback-1",
      target_type: "source",
      target_id: "textract-module-readme",
      feedback_type: "broken",
      message: "The private subnet section is out of date.",
      submitted_at: "2026-05-06T00:00:00.000Z",
    });

    expect(parsed.target_type).toBe("source");
    expect(parsed.feedback_type).toBe("broken");
  });

  it("rejects malformed source enum values", () => {
    expect(() => SourceSchema.parse({ ...source, source_class: "sharepoint-page" })).toThrow();
  });

  it("keeps governance fields off Topic", () => {
    expect(() => TopicSchema.parse({ ...topic, authority_level: "authoritative" })).toThrow();
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
  it("accepts source and topic discovery requests", () => {
    expect(SourceDiscoveryRequestSchema.parse({ query: "textract" })).toEqual({
      query: "textract",
    });
    expect(TopicDiscoveryRequestSchema.parse({ topic_type: "service" })).toEqual({
      topic_type: "service",
    });
  });

  it("accepts feedback submissions and feedback responses", () => {
    const submission = FeedbackSubmissionSchema.parse({
      target_type: "topic",
      target_id: "aws-textract",
      feedback_type: "stale",
      message: "The getting started guidance needs a new review.",
    });
    const feedback = {
      id: "feedback-aws-textract-1",
      submitted_at: "2026-05-10T00:00:00.000Z",
      ...submission,
    };

    expect(submission.target_id).toBe("aws-textract");
    expect(FeedbackResponseSchema.parse({ feedback })).toEqual({ feedback });
  });
});

/* Convention-driven Confluence reference discovery (plan 017, ADR-0016). */

const serviceIdentity = {
  provider: "aws",
  id: "textract",
  name: "Amazon Textract",
  key: "aws/textract",
  recallAliases: ["amazon textract", "textract"],
  admissionAliases: ["amazon textract", "textract"],
};

const discoveredReference = {
  title: "Textract — design overview",
  url: "https://wiki.example.com/wiki/spaces/CLOUD/pages/101/Textract+Design",
  doc_type: "design" as const,
  last_observed_at: "2026-06-28T00:00:00.000Z",
  content_mode: "reference_only" as const,
  access_mode: "service_credentials" as const,
  agent_accessible: false as const,
};

const resourceSummary = {
  kind: "service" as const,
  id: "service/aws/s3",
  slug: "aws/s3",
  provider: "aws",
  name: "S3",
  aliases: ["S3", "Amazon S3"],
  resourceUrl: "/api/resources/service/aws/s3",
  markdownUrl: "/resources/service/aws/s3.md",
};

describe("reference discovery schemas", () => {
  it("defines the controlled doc-type vocabulary", () => {
    expect(docTypes).toEqual(["design", "user-guide", "policy"]);
  });

  it("carries a canonical key plus both alias tiers on ServiceIdentity", () => {
    const parsed = ServiceIdentitySchema.parse(serviceIdentity);

    expect(parsed.key).toBe("aws/textract");
    expect(parsed.recallAliases).toContain("textract");
    expect(parsed.admissionAliases).toContain("amazon textract");
    // strict — no stray fields leak into the normalized identity.
    expect(() => ServiceIdentitySchema.parse({ ...serviceIdentity, extra: true })).toThrow();
  });

  it("admits a reference-only link and keeps confidence optional", () => {
    const parsed = DiscoveredReferenceSchema.parse(discoveredReference);

    expect(parsed.content_mode).toBe("reference_only");
    expect(parsed.access_mode).toBe("service_credentials");
    expect(parsed.agent_accessible).toBe(false);
    expect(parsed.confidence).toBeUndefined();
    expect(
      DiscoveredReferenceSchema.parse({ ...discoveredReference, confidence: 0.5 }).confidence,
    ).toBe(0.5);
  });

  it("refuses to let a reference claim its body is obtainable", () => {
    // The whole point of decision #1 / §Honesty: a reference is never readable
    // content. The honesty literals cannot be relaxed by a producer.
    expect(() =>
      DiscoveredReferenceSchema.parse({ ...discoveredReference, agent_accessible: true }),
    ).toThrow();
    expect(() =>
      DiscoveredReferenceSchema.parse({ ...discoveredReference, content_mode: "resolved" }),
    ).toThrow();
    expect(() =>
      DiscoveredReferenceSchema.parse({ ...discoveredReference, doc_type: "runbook" }),
    ).toThrow();
  });
});

describe("resource context response — discovery merge container", () => {
  it("requires resource-level governance, a flat references list, and a discovery state", () => {
    const spineOnly = {
      resource: resourceSummary,
      governance: "unconfigured" as const,
      requestedSections: [],
      sections: {},
      missingSections: [],
      references: [discoveredReference],
      referenceDiscovery: {
        status: "fresh" as const,
        last_observed_at: "2026-06-28T00:00:00.000Z",
        incomplete: false,
      },
      resolvedAt: "2026-06-28T00:00:00.000Z",
    };

    const parsed = ResourceContextResponseSchema.parse(spineOnly);
    expect(parsed.governance).toBe("unconfigured");
    expect(parsed.references).toHaveLength(1);
    expect(parsed.referenceDiscovery?.status).toBe("fresh");

    // The new fields are mandatory — a producer cannot silently omit them.
    const { governance, ...withoutGovernance } = spineOnly;
    void governance;
    expect(() => ResourceContextResponseSchema.parse(withoutGovernance)).toThrow();
    const { references, ...withoutReferences } = spineOnly;
    void references;
    expect(() => ResourceContextResponseSchema.parse(withoutReferences)).toThrow();
    const { referenceDiscovery, ...withoutDiscovery } = spineOnly;
    void referenceDiscovery;
    expect(() => ResourceContextResponseSchema.parse(withoutDiscovery)).toThrow();
  });

  it("allows a null discovery state (no discovery ran) but rejects an unknown status", () => {
    const base = {
      resource: resourceSummary,
      governance: "configured" as const,
      requestedSections: [],
      sections: {},
      missingSections: [],
      references: [],
      resolvedAt: "2026-06-28T00:00:00.000Z",
    };
    expect(
      ResourceContextResponseSchema.parse({ ...base, referenceDiscovery: null }).referenceDiscovery,
    ).toBeNull();
    expect(() =>
      ResourceContextResponseSchema.parse({
        ...base,
        referenceDiscovery: { status: "expired", last_observed_at: null, incomplete: false },
      }),
    ).toThrow();
  });

  it("rejects an unknown governance state", () => {
    expect(() =>
      ResourceContextResponseSchema.parse({
        resource: resourceSummary,
        governance: "partial",
        requestedSections: [],
        sections: {},
        missingSections: [],
        references: [],
        referenceDiscovery: null,
        resolvedAt: "2026-06-28T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
