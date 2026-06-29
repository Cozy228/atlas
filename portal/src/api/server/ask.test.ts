import { describe, expect, it } from "vitest";
import type { AskAtlasClaim } from "@/ask/askAtlas";
import { serviceProjection } from "@/fixtures/resourceContexts";
import { createAskAtlasResponse, type AskAtlasClaimsAdapter } from "./ask";

describe("Ask Atlas server contract", () => {
  it("returns only claims backed by accepted projection citations", async () => {
    const adapter: AskAtlasClaimsAdapter = {
      async answer(): Promise<{ claims: AskAtlasClaim[] }> {
        return {
          claims: [
            {
              text: "Use private endpoint configuration.",
              citation_ids: ["textract-module-readme#private-subnet-usage"],
            },
            {
              text: "Generate production Terraform automatically.",
              citation_ids: [],
            },
          ],
        };
      },
    };

    const response = await createAskAtlasResponse({
      question: "How do I use Textract from a private subnet?",
      projection: serviceProjection,
      adapter,
      userId: "pilot-user",
    });

    expect(response.answer).toContain(
      "Use private endpoint configuration. [textract-module-readme#private-subnet-usage]",
    );
    expect(response.answer).not.toContain("Generate production Terraform automatically.");
    expect(response.warnings).toContain("uncited-claims-rejected");
    expect(response.sources).toContainEqual({
      source_id: "textract-module-readme",
      title: "Textract Module README",
      url: "https://confluence.example.com/display/CLOUD/Textract+Module",
    });
  });
});
