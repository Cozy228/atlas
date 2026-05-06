import { describe, expect, it } from "vitest";
import { capabilityBundle } from "../fixtures/contextBundles.js";
import {
  askAtlas,
  buildAskAtlasPrompt,
  createDailyRateLimiter,
  validateCitations,
  type LlmAdapter,
} from "./askAtlas.js";

describe("Ask Atlas", () => {
  it("builds prompts only from the context bundle and user question", () => {
    const prompt = buildAskAtlasPrompt({
      question: "How do I use Textract from a private subnet?",
      bundle: capabilityBundle,
    });

    expect(prompt).toContain("How do I use Textract from a private subnet?");
    expect(prompt).toContain("Use the Textract module with private endpoint configuration.");
    expect(prompt).toContain("textract-module-readme");
    expect(prompt).not.toContain("production-ready Terraform");
    expect(prompt).not.toContain("bypass approval");
  });

  it("strips claims that do not map to bundle citations", () => {
    const answer = validateCitations({
      bundle: capabilityBundle,
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
    });

    expect(answer.claims).toEqual([
      {
        text: "Use private endpoint configuration.",
        citation_ids: ["textract-module-readme#private-subnet-usage"],
      },
    ]);
    expect(answer.rejected_claims).toEqual([
      {
        text: "Generate production Terraform automatically.",
        citation_ids: [],
      },
    ]);
  });

  it("rejects claims backed only by non-authoritative sources", () => {
    const answer = validateCitations({
      bundle: {
        ...capabilityBundle,
        sources: [
          {
            ...capabilityBundle.sources[0],
            source: {
              ...capabilityBundle.sources[0]!.source,
              authority_level: "draft",
            },
          },
        ],
      },
      claims: [
        {
          text: "Draft guidance is enough for a factual answer.",
          citation_ids: ["textract-module-readme#private-subnet-usage"],
        },
      ],
    });

    expect(answer.claims).toEqual([]);
    expect(answer.rejected_claims).toEqual([
      {
        text: "Draft guidance is enough for a factual answer.",
        citation_ids: ["textract-module-readme#private-subnet-usage"],
      },
    ]);
  });

  it("uses an adapter instead of calling a provider directly", async () => {
    const adapter: LlmAdapter = {
      async answer() {
        return {
          claims: [
            {
              text: "Use private endpoint configuration.",
              citation_ids: ["textract-module-readme#private-subnet-usage"],
            },
          ],
        };
      },
    };

    const answer = await askAtlas({
      question: "How do I use Textract from a private subnet?",
      bundle: capabilityBundle,
      adapter,
      userId: "user-1",
      rateLimiter: createDailyRateLimiter(5),
    });

    expect(answer.claims).toHaveLength(1);
    expect(answer.warnings).toEqual([]);
  });

  it("returns no-source answer when the Context Layer has no evidence", async () => {
    const answer = await askAtlas({
      question: "How do I use a mainframe?",
      bundle: {
        ...capabilityBundle,
        sources: [],
        warnings: [{ code: "no_registered_source", message: "No registered source found." }],
        expansion_paths: [],
      },
      adapter: {
        async answer() {
          throw new Error("Adapter should not be called without evidence.");
        },
      },
      userId: "user-1",
      rateLimiter: createDailyRateLimiter(5),
    });

    expect(answer.claims).toEqual([]);
    expect(answer.warnings[0]).toBe("no registered authoritative source found");
  });

  it("enforces Portal-owned daily rate limits", async () => {
    const rateLimiter = createDailyRateLimiter(1);
    const adapter: LlmAdapter = {
      async answer() {
        return { claims: [] };
      },
    };

    await askAtlas({
      question: "First question",
      bundle: capabilityBundle,
      adapter,
      userId: "user-1",
      rateLimiter,
    });

    await expect(
      askAtlas({
        question: "Second question",
        bundle: capabilityBundle,
        adapter,
        userId: "user-1",
        rateLimiter,
      }),
    ).rejects.toThrow("Ask Atlas daily limit exceeded.");
  });
});
