import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ResourceContextResponseSchema, ResourceSearchResponseSchema } from "@atlas/schema";
import {
  handleResourceContextRequest,
  handleResourceSearchRequest,
  handleTopicRequest,
} from "@atlas/context-layer";
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";
import {
  askAtlas,
  createDailyRateLimiter,
  getGuidance,
  loadGuidance,
  relatedGuidanceForTopic,
  type LlmAdapter,
} from "@atlas/portal";

// Single live path (plan 018 G5): the registry + resource records are the OUTPUT
// of live discovery, so every discovery channel must point at the MSW fixtures —
// service modules (Terraform), the availability spine, the reference space, and
// the guardrail space. Boot the shared Node-mode MSW server so the live adapters
// resolve through the in-process interceptor.
const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv();
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

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

  it("resolves a free-text name to a canonical resource id, with no cross-service bleed", async () => {
    const response = await handleResourceSearchRequest("AWS Textract", {});
    const search = ResourceSearchResponseSchema.parse(response.body);
    const ids = search.items.map((item) => item.id);
    expect(ids).toContain("service/aws/textract");
    expect(ids).not.toContain("guardrail/data-encryption-standard");
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

  it("keeps a security policy's documents cited from the discovered policy page", async () => {
    // A security policy is a discovered Resource (a guardrail): its governed
    // documents project as cited Sections, bound by heading to the discovered
    // SECPOL policy page.
    const response = await handleResourceContextRequest({
      kind: "guardrail",
      slug: "public-access-controls",
    });
    const projection = ResourceContextResponseSchema.parse(response.body);

    const enforced = projection.sections["enforced-controls"];
    expect(enforced?.status).toBe("available");
    expect(enforced?.citations[0]?.sourceId).toBe("public-access-controls-policy-doc");
    expect(enforced?.content?.toLowerCase()).toContain("public access");

    // The legacy-waiver exceptions section is cited from the same policy document,
    // surfaced alongside the enforced controls — never hidden.
    const exceptions = projection.sections.exceptions;
    expect(exceptions?.status).toBe("available");
    expect(exceptions?.citations[0]?.sourceId).toBe("public-access-controls-policy-doc");
  });

  it("HARD GATE: the S3 / API Gateway / Textract adoption journeys are wired end-to-end", async () => {
    const guidances = loadGuidance();
    const heroes = [
      { slug: "aws/api-gateway", guidanceId: "api-gateway-adoption" },
      { slug: "aws/s3", guidanceId: "s3-adoption" },
      { slug: "aws/textract", guidanceId: "textract-adoption" },
    ];

    for (const hero of heroes) {
      // The service is registered (its Topic id is the resource slug) and carries
      // a derived Terraform-module entry tool on its datasheet.
      const topicResponse = await handleTopicRequest(hero.slug);
      expect(topicResponse.status, hero.slug).toBe(200);
      const topic = "topic" in topicResponse.body ? topicResponse.body.topic : undefined;
      expect(topic?.topic_type, hero.slug).toBe("service");
      expect(topic?.entry_tools?.map((tool) => tool.label) ?? [], hero.slug).toContain(
        "Terraform module",
      );

      // A governed adoption guide exists, is a route, and is wired to the resource.
      expect(getGuidance(guidances, hero.guidanceId)?.type, hero.guidanceId).toBe("route");
      expect(relatedGuidanceForTopic(guidances, hero.slug).map((g) => g.id)).toContain(
        hero.guidanceId,
      );
    }
  });
});
