import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema } from "@atlas/schema";
import { handleContextRequest, handleTopicRequest } from "@atlas/context-layer";
import {
  askAtlas,
  createDailyRateLimiter,
  getGuidance,
  relatedGuidanceForTopic,
  renderServiceDetail,
  renderLandingZoneNavigator,
  renderSourceLookup,
  type LlmAdapter,
} from "@atlas/portal";

describe("Atlas V1 acceptance", () => {
  it("proves service discovery from seed data through Portal rendering", async () => {
    const response = await handleContextRequest({ topic_id: "aws-textract" });
    expect(response.status).toBe(200);

    const bundle = ContextBundleResponseSchema.parse(response.body);
    const html = renderServiceDetail(bundle);

    expect(html).toContain("AWS Textract");
    expect(html).toContain("authoritative");
    expect(html).toContain("Private subnet usage");
  });

  it("proves landing zone navigation from seed data through Portal rendering", async () => {
    const response = await handleContextRequest({ topic_id: "central-landing-zone" });
    expect(response.status).toBe(200);

    const bundle = ContextBundleResponseSchema.parse(response.body);
    const html = renderLandingZoneNavigator([bundle]);

    expect(html).toContain("Central Landing Zone");
    expect(html).toContain("landing-zone-guidance");
    expect(html).toContain("environment-matrix");
  });

  it("proves Ask Atlas answers only with accepted citations", async () => {
    const response = await handleContextRequest({
      query: "How do I use Textract from a private subnet?",
    });
    const bundle = ContextBundleResponseSchema.parse(response.body);
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
      bundle,
      adapter,
      userId: "pilot-user",
      rateLimiter: createDailyRateLimiter(5),
    });

    expect(answer.claims).toHaveLength(1);
    expect(answer.rejected_claims).toHaveLength(1);
  });

  it("keeps restricted, stale, broken, and missing evidence visible", async () => {
    const restricted = ContextBundleResponseSchema.parse(
      (await handleContextRequest({ topic_id: "regulated-landing-zone" })).body,
    );
    const broken = ContextBundleResponseSchema.parse(
      (await handleContextRequest({ topic_id: "private-networking" })).body,
    );
    const missing = ContextBundleResponseSchema.parse(
      (await handleContextRequest({ query: "mainframe" })).body,
    );

    expect(renderSourceLookup(restricted)).toContain("restricted_source");
    expect(renderSourceLookup(broken)).toContain("broken_anchor");
    expect(missing.warnings[0]?.code).toBe("no_registered_source");
  });

  it("HARD GATE: proves the S3 / API Gateway / Textract adoption journeys are answerable end-to-end, grounded and cited", async () => {
    const HERO_SERVICES = [
      {
        topicId: "api-gateway",
        displayName: "API Gateway",
        moduleSourceId: "apigateway-module-readme",
        guidanceId: "api-gateway-adoption",
        terraformQuery: "api gateway terraform",
        unrelatedModuleId: "textract-module-readme",
      },
      {
        topicId: "aws-s3",
        displayName: "AWS S3",
        moduleSourceId: "s3-module-readme",
        guidanceId: "s3-adoption",
        terraformQuery: "amazon s3 storage terraform",
        unrelatedModuleId: "textract-module-readme",
      },
      {
        topicId: "aws-textract",
        displayName: "AWS Textract",
        moduleSourceId: "textract-module-readme",
        guidanceId: "textract-adoption",
        terraformQuery: "textract terraform",
        unrelatedModuleId: "apigateway-module-readme",
      },
    ];

    for (const hero of HERO_SERVICES) {
      // 1. The service is registered and its governed bundle resolves (disclosure 2 so
      //    every cited module excerpt — including the Terraform starter — is present).
      const response = await handleContextRequest({
        topic_id: hero.topicId,
        disclosure_level: 2,
      });
      expect(response.status, hero.topicId).toBe(200);
      const bundle = ContextBundleResponseSchema.parse(response.body);

      // 2. The Portal renders the datasheet for a human adopter.
      const html = renderServiceDetail(bundle);
      expect(html, hero.displayName).toContain(hero.displayName);
      expect(html).toContain("authoritative");

      // 3. "Give me terraform": an authoritative terraform-module Source carries a cited
      //    HCL starter — grounded, never synthesized — via the terraform module integration.
      const moduleSource = bundle.sources.find((entry) => entry.source.id === hero.moduleSourceId);
      expect(moduleSource?.source.source_class, hero.moduleSourceId).toBe("terraform-module");
      expect(moduleSource?.source.authority_level).toBe("authoritative");
      const starter = moduleSource?.excerpts.find((excerpt) => excerpt.text.includes('module "'));
      expect(starter?.citation.source_id, hero.moduleSourceId).toBe(hero.moduleSourceId);

      // 4. Relevance: a free-text terraform query returns this service's module and NOT an
      //    unrelated module (no cross-service bleed).
      const queryBundle = ContextBundleResponseSchema.parse(
        (await handleContextRequest({ query: hero.terraformQuery })).body,
      );
      const queriedIds = queryBundle.sources.map((entry) => entry.source.id);
      expect(queriedIds, hero.terraformQuery).toContain(hero.moduleSourceId);
      expect(queriedIds).not.toContain(hero.unrelatedModuleId);

      // 5. The user guide is a link on the service datasheet (not the adoption route).
      const topicResponse = handleTopicRequest(hero.topicId);
      expect(topicResponse.status).toBe(200);
      const topic = "topic" in topicResponse.body ? topicResponse.body.topic : undefined;
      expect(
        topic?.entry_tools.map((tool) => tool.label),
        hero.topicId,
      ).toContain("User guide");

      // 6. A governed adoption guide exists, is a route, and is wired to the topic.
      expect(getGuidance(hero.guidanceId)?.type, hero.guidanceId).toBe("route");
      expect(relatedGuidanceForTopic(hero.topicId).map((g) => g.id)).toContain(hero.guidanceId);
    }
  });
});
