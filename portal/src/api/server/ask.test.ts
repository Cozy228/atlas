import { describe, expect, it } from "vitest";
import type { AskAtlasClaim } from "@/ask/askAtlas";
import { capabilityBundle } from "@/fixtures/contextBundles";
import {
  buildAskContextRequest,
  createAskAtlasResponse,
  type AskAtlasClaimsAdapter,
} from "./ask";

describe("Ask Atlas server contract", () => {
  it("uses the user question for context selection when no topic is provided", () => {
    expect(
      buildAskContextRequest({
        question: "How do I use Textract from a private subnet?",
      }),
    ).toEqual({
      query: "How do I use Textract from a private subnet?",
    });
  });

  it("uses the selected topic when a topic is provided", () => {
    expect(
      buildAskContextRequest({
        topicId: "aws-textract",
        question: "How do I use Textract from a private subnet?",
      }),
    ).toEqual({ topic_id: "aws-textract" });
  });

  it("returns only claims backed by accepted bundle citations", async () => {
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
      bundle: capabilityBundle,
      adapter,
      userId: "pilot-user",
    });

    expect(response.answer).toContain(
      "Use private endpoint configuration. [textract-module-readme#private-subnet-usage]",
    );
    expect(response.answer).not.toContain("Generate production Terraform automatically.");
    expect(response.warnings).toContain("uncited-claims-rejected");
  });
});
