import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema } from "@atlas/schema";
import { handleContextRequest } from "@atlas/context-layer";
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

  it("HARD GATE: proves the API Gateway adoption journey is answerable end-to-end, grounded and cited", async () => {
    // 1. The service is registered and its governed bundle resolves.
    const response = await handleContextRequest({ topic_id: "api-gateway" });
    expect(response.status).toBe(200);
    const bundle = ContextBundleResponseSchema.parse(response.body);

    // 2. The Portal renders the datasheet for a human adopter.
    const html = renderServiceDetail(bundle);
    expect(html).toContain("API Gateway");
    expect(html).toContain("authoritative");

    // 3. "Give me terraform": an authoritative terraform-module Source leads with a
    //    cited starter snippet — grounded, never synthesized.
    const moduleSource = bundle.sources.find(
      (entry) => entry.source.source_class === "terraform-module",
    );
    expect(moduleSource?.source.authority_level).toBe("authoritative");
    const starter = moduleSource?.excerpts[0];
    expect(starter?.text).toContain('module "api"');
    expect(starter?.citation.source_id).toBe("apigateway-module-readme");

    // 4. Relevance: a free-text "api gateway terraform" query returns the API Gateway
    //    module and NOT unrelated terraform modules (Textract/Bedrock/Lambda).
    const queryBundle = ContextBundleResponseSchema.parse(
      (await handleContextRequest({ query: "api gateway terraform" })).body,
    );
    const queriedIds = queryBundle.sources.map((entry) => entry.source.id);
    expect(queriedIds).toContain("apigateway-module-readme");
    expect(queriedIds).not.toContain("textract-module-readme");

    // 5. A governed adoption guide exists, is a route, and is wired to the topic.
    const guide = getGuidance("api-gateway-adoption");
    expect(guide?.type).toBe("route");
    expect(relatedGuidanceForTopic("api-gateway").map((g) => g.id)).toContain(
      "api-gateway-adoption",
    );
  });
});
