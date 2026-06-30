import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyProjection, serviceProjection } from "../fixtures/resourceContexts";
import {
  askAtlas,
  buildAskAtlasPrompt,
  createDailyRateLimiter,
  validateCitations,
  type LlmAdapter,
} from "./askAtlas";

describe("Ask Atlas", () => {
  it("builds prompts only from the resource projection and user question", () => {
    const prompt = buildAskAtlasPrompt({
      question: "How do I use Textract from a private subnet?",
      projection: serviceProjection,
    });

    expect(prompt).toContain("How do I use Textract from a private subnet?");
    expect(prompt).toContain("Use the Textract module with private endpoint configuration.");
    expect(prompt).toContain("textract-module-readme#private-subnet-usage");
    expect(prompt).not.toContain("production-ready Terraform");
    expect(prompt).not.toContain("bypass approval");
  });

  it("strips claims that do not map to projection citations", () => {
    const answer = validateCitations({
      projection: serviceProjection,
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

  it("accepts any cited discovered Section — no per-source authority gate (plan 019)", () => {
    const answer = validateCitations({
      projection: serviceProjection,
      claims: [
        {
          text: "Discovered guidance is admissible evidence.",
          citation_ids: ["textract-module-readme#private-subnet-usage"],
        },
      ],
    });

    expect(answer.claims).toHaveLength(1);
    expect(answer.rejected_claims).toEqual([]);
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
      projection: serviceProjection,
      adapter,
      userId: "user-1",
      rateLimiter: createDailyRateLimiter(5),
    });

    expect(answer.claims).toHaveLength(1);
    expect(answer.warnings).toEqual([]);
  });

  it("returns a no-evidence answer when the projection has no governed content", async () => {
    const answer = await askAtlas({
      question: "How do I use a mainframe?",
      projection: emptyProjection,
      adapter: {
        async answer() {
          throw new Error("Adapter should not be called without evidence.");
        },
      },
      userId: "user-1",
      rateLimiter: createDailyRateLimiter(5),
    });

    expect(answer.claims).toEqual([]);
    expect(answer.warnings[0]).toBe("no governed evidence found");
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
      projection: serviceProjection,
      adapter,
      userId: "user-1",
      rateLimiter,
    });

    await expect(
      askAtlas({
        question: "Second question",
        projection: serviceProjection,
        adapter,
        userId: "user-1",
        rateLimiter,
      }),
    ).rejects.toThrow("Ask Atlas daily limit exceeded.");
  });

  describe("createDailyRateLimiter daily reset", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears the counter once the UTC day rolls over", () => {
      vi.useFakeTimers();
      const start = Date.UTC(2026, 5, 30, 12, 0, 0);
      vi.setSystemTime(start);

      const limiter = createDailyRateLimiter(1);
      limiter.consume("user-1");
      expect(() => limiter.consume("user-1")).toThrow("Ask Atlas daily limit exceeded.");

      // Advance past the next UTC midnight.
      vi.setSystemTime(start + 86_400_000 + 1);
      expect(() => limiter.consume("user-1")).not.toThrow();
    });

    it("keeps independent counters per userId within a day", () => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.UTC(2026, 5, 30, 12, 0, 0));

      const limiter = createDailyRateLimiter(1);
      limiter.consume("user-a");
      expect(() => limiter.consume("user-a")).toThrow("Ask Atlas daily limit exceeded.");
      // user-b has its own bucket, unaffected by user-a hitting the limit.
      expect(() => limiter.consume("user-b")).not.toThrow();
    });
  });
});
