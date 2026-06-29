import type { ResourceContextResponse } from "@atlas/schema";

/**
 * A governed `service/aws/textract` projection — the Ask + evidence fixtures'
 * stand-in for a live resource read (plan 019). Public-safe and fictional.
 */
export const serviceProjection: ResourceContextResponse = {
  resource: {
    kind: "service",
    id: "service/aws/textract",
    slug: "aws/textract",
    provider: "aws",
    name: "Amazon Textract",
    aliases: ["AWS Textract", "Textract"],
    resourceUrl: "/api/resources/service/aws/textract",
    markdownUrl: "/resources/service/aws/textract.md",
  },
  governance: "configured",
  requestedSections: ["network", "examples"],
  sections: {
    network: {
      status: "available",
      content: "Use the Textract module with private endpoint configuration.",
      citations: [
        {
          sourceId: "textract-module-readme",
          title: "Textract Module README",
          url: "https://confluence.example.com/display/CLOUD/Textract+Module",
          anchor: "private-subnet-usage",
          resolvedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      warnings: [],
    },
    examples: {
      status: "available",
      content: 'module "textract" {\n  source = "app.terraform.io/example/textract/aws"\n}',
      citations: [
        {
          sourceId: "textract-module-readme",
          title: "Textract Module README",
          url: "https://confluence.example.com/display/CLOUD/Textract+Module",
          anchor: "textract-terraform-starter",
          resolvedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      warnings: [],
    },
  },
  missingSections: [],
  references: [],
  referenceDiscovery: null,
  resolvedAt: "2026-01-01T00:00:00.000Z",
};

/** A projection with no resolved Section content — the honest "no evidence" case. */
export const emptyProjection: ResourceContextResponse = {
  resource: {
    kind: "service",
    id: "service/aws/mainframe",
    slug: "aws/mainframe",
    provider: "aws",
    name: "Mainframe",
    aliases: [],
    resourceUrl: "/api/resources/service/aws/mainframe",
    markdownUrl: "/resources/service/aws/mainframe.md",
  },
  governance: "unconfigured",
  requestedSections: [],
  sections: {},
  missingSections: [],
  references: [],
  referenceDiscovery: null,
  resolvedAt: "2026-01-01T00:00:00.000Z",
};
