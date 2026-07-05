import type { Brief, BriefBlock, Moment, Situation } from "@atlas/schema";

/**
 * Deterministic mock moment Brief for dev/e2e (`DEV_DATA_MODE === "mock"`).
 *
 * A live Brief is assembled server-side from the governed graph + content path;
 * in mock mode we serve a small fictional, public-safe Brief so the moment page
 * renders exactly what the live value will — one heading, the shared APP/LZ
 * selector (from the shell), and blocks stating their question + cited evidence.
 * The live path (`resolveDataMode() === "live"`) assembles the real Brief and
 * never touches this fixture. All names are fictional.
 */

const RESOLVED_AT = "2026-07-04T09:00:00.000Z";

export type MockBriefScope = { landingZones?: string[]; service?: string };

function situation(scope: MockBriefScope | undefined): Situation {
  const landingZoneIds = scope?.landingZones?.filter((id) => id.length > 0) ?? ["awsf", "azuref"];
  return { landingZoneIds, origin: "by-value" };
}

function availabilityBlock(service: string, landingZoneId: string): BriefBlock {
  return {
    id: `service:${service}:availability@${landingZoneId}`,
    question: `Where is this service available (${service}) in ${landingZoneId}?`,
    landingZoneId,
    status: "available",
    evidence: [
      {
        resourceId: `service/${service}`,
        sectionId: "availability",
        citations: [
          {
            sourceId: "availability-matrix",
            title: `${service} regional availability`,
            url: "https://confluence.example.com/display/CLOUD/Regional+Availability+Matrix",
            resolvedAt: RESOLVED_AT,
          },
        ],
        excerpt: `${service} — us-east-1: available; ca-central-1: available.`,
      },
    ],
    pointers: [],
    warnings: [],
  };
}

function contextBlock(service: string): BriefBlock {
  return {
    id: `service:${service}:overview+security`,
    question: `How is this service secured (${service})?`,
    status: "partial",
    evidence: [
      {
        resourceId: `service/${service}`,
        sectionId: "network",
        citations: [
          {
            sourceId: `${service}-module-readme`,
            title: `${service} Terraform module`,
            url: "https://app.terraform.io/example/registry/modules/example/parser/aws",
            resolvedAt: RESOLVED_AT,
          },
        ],
        excerpt: "Private connectivity via a VPC endpoint; no public egress required.",
      },
    ],
    pointers: [],
    warnings: [
      {
        code: "no_registered_source",
        message: "Atlas has no registered overview source for this service yet.",
      },
    ],
  };
}

/** The deterministic mock Brief for a moment + scope. */
export function mockBrief(moment: Moment, scope?: MockBriefScope): Brief {
  const situated = situation(scope);
  const service = scope?.service ?? "aws/parser";

  if (moment === "debug") {
    return { moment, situation: situated, blocks: [], resolvedAt: RESOLVED_AT };
  }

  if (moment === "change") {
    const blocks: BriefBlock[] = [
      {
        id: "mock-available-in-added-parser-azuref",
        question: "What changed: aws/parser became available in azuref?",
        landingZoneId: "azuref",
        status: "available",
        evidence: [],
        pointers: [],
        warnings: [],
      },
    ];
    return { moment, situation: situated, blocks, resolvedAt: RESOLVED_AT };
  }

  // adopt / build: per-zone availability blocks (P26) + a once-rendered context block.
  const blocks: BriefBlock[] = [
    ...situated.landingZoneIds.map((zone) => availabilityBlock(service, zone)),
    contextBlock(service),
  ];
  return { moment, situation: situated, blocks, resolvedAt: RESOLVED_AT };
}
