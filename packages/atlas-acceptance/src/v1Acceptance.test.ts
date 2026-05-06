import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema } from "@atlas/schema";
import { handleContextRequest } from "@atlas/context-layer";
import {
  askAtlas,
  createDailyRateLimiter,
  renderCapabilityDetail,
  renderLandingZoneNavigator,
  renderSourceLookup,
  type LlmAdapter,
} from "@atlas/portal";

describe("Atlas V1 acceptance", () => {
  it("proves capability discovery from seed data through Portal rendering", () => {
    const response = handleContextRequest({ topic_id: "aws-textract" });
    expect(response.status).toBe(200);

    const bundle = ContextBundleResponseSchema.parse(response.body);
    const html = renderCapabilityDetail(bundle);

    expect(html).toContain("AWS Textract");
    expect(html).toContain("authoritative");
    expect(html).toContain("Private subnet usage");
  });

  it("proves landing zone navigation from seed data through Portal rendering", () => {
    const response = handleContextRequest({ topic_id: "central-landing-zone" });
    expect(response.status).toBe(200);

    const bundle = ContextBundleResponseSchema.parse(response.body);
    const html = renderLandingZoneNavigator([bundle]);

    expect(html).toContain("Central Landing Zone");
    expect(html).toContain("landing-zone-guidance");
    expect(html).toContain("environment-matrix");
  });

  it("proves Ask Atlas answers only with accepted citations", async () => {
    const response = handleContextRequest({
      question: "How do I use Textract from a private subnet?",
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

  it("keeps restricted, stale, broken, and missing evidence visible", () => {
    const restricted = ContextBundleResponseSchema.parse(
      handleContextRequest({ topic_id: "regulated-landing-zone" }).body,
    );
    const broken = ContextBundleResponseSchema.parse(
      handleContextRequest({ topic_id: "private-networking" }).body,
    );
    const missing = ContextBundleResponseSchema.parse(
      handleContextRequest({ keyword: "mainframe" }).body,
    );

    expect(renderSourceLookup(restricted)).toContain("restricted_source");
    expect(renderSourceLookup(broken)).toContain("broken_anchor");
    expect(missing.warnings[0]?.code).toBe("no_registered_source");
  });
});
