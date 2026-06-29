import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ResourceContextResponseSchema, ResourceSearchResponseSchema } from "@atlas/schema";
import {
  handleResourceContextRequest,
  handleResourceSearchRequest,
  handleTopicRequest,
} from "@atlas/context-layer";
import {
  server,
  DEV_TERRAFORM_BASE_URL,
  DEV_CONFLUENCE_BASE_URL,
} from "@atlas/context-layer/devMocks";
import {
  askAtlas,
  createDailyRateLimiter,
  getGuidance,
  loadGuidance,
  relatedGuidanceForTopic,
  type LlmAdapter,
} from "@atlas/portal";

// Single live path (plan 018): textract's terraform-backed sections (network,
// examples) fetch from the registry; the guardrail's policy sections fetch from
// Confluence (G4). Boot the shared Node-mode MSW server and point ATLAS_TERRAFORM_*
// and ATLAS_CONFLUENCE_* at the fixtures so both channels resolve live.
const savedEnv = {
  terraformBaseUrl: process.env.ATLAS_TERRAFORM_BASE_URL,
  terraformToken: process.env.ATLAS_TERRAFORM_TOKEN,
  confluenceBaseUrl: process.env.ATLAS_CONFLUENCE_BASE_URL,
  confluenceToken: process.env.ATLAS_CONFLUENCE_TOKEN,
};
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  process.env.ATLAS_TERRAFORM_BASE_URL = DEV_TERRAFORM_BASE_URL;
  process.env.ATLAS_TERRAFORM_TOKEN = "dev-mock-token";
  process.env.ATLAS_CONFLUENCE_BASE_URL = DEV_CONFLUENCE_BASE_URL;
  process.env.ATLAS_CONFLUENCE_TOKEN = "dev-mock-token";
});
afterAll(() => {
  server.close();
  restoreEnv("ATLAS_TERRAFORM_BASE_URL", savedEnv.terraformBaseUrl);
  restoreEnv("ATLAS_TERRAFORM_TOKEN", savedEnv.terraformToken);
  restoreEnv("ATLAS_CONFLUENCE_BASE_URL", savedEnv.confluenceBaseUrl);
  restoreEnv("ATLAS_CONFLUENCE_TOKEN", savedEnv.confluenceToken);
});
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

/**
 * V1 acceptance, resource-projection era (plan 019). The agent-facing surface is
 * one core read — a live Resource projection — projected into many views.
 * Services, guardrails (security policies), and the adoption journeys are all
 * proven end-to-end through that one surface, from public-safe seed data.
 */
describe("Atlas V1 acceptance", () => {
  it("projects a governed service with cited Section content from seed data", async () => {
    const response = await handleResourceContextRequest({ kind: "service", slug: "aws/textract" });
    expect(response.status).toBe(200);
    const projection = ResourceContextResponseSchema.parse(response.body);

    expect(projection.resource.name).toContain("Textract");
    expect(projection.governance).toBe("configured");

    // "Give me terraform": the cited HCL starter is grounded in a registered
    // Source (an examples Section), never synthesized.
    const examples = projection.sections.examples;
    expect(examples?.content).toContain('module "');
    expect(examples?.citations[0]?.sourceId).toBe("textract-module-readme");
  });

  it("resolves a free-text name to a canonical resource id, with no cross-service bleed", () => {
    const response = handleResourceSearchRequest("AWS Textract", {});
    const search = ResourceSearchResponseSchema.parse(response.body);
    const ids = search.items.map((item) => item.id);
    expect(ids).toContain("service/aws/textract");
    expect(ids).not.toContain("guardrail/s3-public-access");
  });

  it("answers Ask Atlas only with accepted citations", async () => {
    const response = await handleResourceContextRequest({ kind: "service", slug: "aws/textract" });
    const projection = ResourceContextResponseSchema.parse(response.body);

    const adapter: LlmAdapter = {
      async answer() {
        return {
          claims: [
            {
              text: "Use the Textract module with private endpoint configuration.",
              citation_ids: ["textract-module-readme#private-subnet-usage"],
            },
            {
              text: "Use uncited production Terraform.",
              citation_ids: [],
            },
          ],
        };
      },
    };

    const answer = await askAtlas({
      question: "How do I use Textract from a private subnet?",
      projection,
      adapter,
      userId: "pilot-user",
      rateLimiter: createDailyRateLimiter(5),
    });

    expect(answer.claims).toHaveLength(1);
    expect(answer.rejected_claims).toHaveLength(1);
  });

  it("keeps a security policy's documents cited, with stale evidence still visible", async () => {
    // A security policy is a discovered Resource (a guardrail): its governed
    // documents project as cited Sections.
    const response = await handleResourceContextRequest({
      kind: "guardrail",
      slug: "s3-public-access",
    });
    const projection = ResourceContextResponseSchema.parse(response.body);

    expect(projection.sections["enforced-controls"]?.citations[0]?.sourceId).toBe("s3-policy-doc");
    // A deprecated allowance is retained for migration but flagged stale —
    // surfaced alongside the content, never hidden.
    const exceptions = projection.sections.exceptions;
    expect(exceptions?.warnings.some((warning) => warning.code === "stale_source")).toBe(true);
  });

  it("HARD GATE: the S3 / API Gateway / Textract adoption journeys are wired end-to-end", () => {
    const guidances = loadGuidance();
    const heroes = [
      { topicId: "api-gateway", guidanceId: "api-gateway-adoption" },
      { topicId: "aws-s3", guidanceId: "s3-adoption" },
      { topicId: "aws-textract", guidanceId: "textract-adoption" },
    ];

    for (const hero of heroes) {
      // The service is registered and the user guide is a link on its datasheet.
      const topicResponse = handleTopicRequest(hero.topicId);
      expect(topicResponse.status, hero.topicId).toBe(200);
      const topic = "topic" in topicResponse.body ? topicResponse.body.topic : undefined;
      expect(topic?.topic_type, hero.topicId).toBe("service");
      expect(
        topic?.entry_tools.map((tool) => tool.label),
        hero.topicId,
      ).toContain("User guide");

      // A governed adoption guide exists, is a route, and is wired to the topic.
      expect(getGuidance(guidances, hero.guidanceId)?.type, hero.guidanceId).toBe("route");
      expect(relatedGuidanceForTopic(guidances, hero.topicId).map((g) => g.id)).toContain(
        hero.guidanceId,
      );
    }
  });
});
