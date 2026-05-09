import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildAskAtlasPrompt, createDailyRateLimiter } from "@/ask/askAtlas";
import { serverContextApiClient } from "./inProcessContextApi";

const SYSTEM_PROMPT = [
  "You are Atlas, a governed cloud-platform assistant.",
  "Answer ONLY using the provided Atlas context bundle excerpts.",
  "Cite sources inline using the bracket form [source_id#anchor_id] that",
  "matches the excerpts. If the excerpts do not contain the answer, say so",
  "and do not invent claims.",
].join(" ");

const askInputSchema = z.object({
  topicId: z.string().min(1),
  question: z.string().min(1),
});

export type AskAtlasSourceRef = {
  source_id: string;
  title: string;
  authority_level: string;
  url?: string;
};

export type AskAtlasResponse = {
  answer: string;
  sources: ReadonlyArray<AskAtlasSourceRef>;
  warnings: ReadonlyArray<string>;
};

const rateLimiter = createDailyRateLimiter(100);

export const askAtlas = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => askInputSchema.parse(input))
  .handler(async ({ data }): Promise<AskAtlasResponse> => {
    const bundle = await serverContextApiClient.getContextBundle({
      topic_id: data.topicId,
    });

    const authoritativeSources = bundle.sources.filter(
      (source) => source.source.authority_level === "authoritative",
    );

    if (authoritativeSources.length === 0) {
      return {
        answer: "",
        sources: [],
        warnings: ["no registered authoritative source found"],
      };
    }

    try {
      rateLimiter.consume("anonymous");
    } catch {
      return {
        answer: "",
        sources: [],
        warnings: ["rate-limit-exceeded"],
      };
    }

    const sources: AskAtlasSourceRef[] = authoritativeSources.map((source) => ({
      source_id: source.source.id,
      title: source.source.title,
      authority_level: source.source.authority_level,
      url: source.source.location,
    }));
    const warnings = bundle.warnings.map((w) => w.code);
    const prompt = buildAskAtlasPrompt({
      question: data.question,
      bundle,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        answer: simulatedAnswer(data.question, prompt),
        sources,
        warnings: [...warnings, "no-llm-provider-configured"],
      };
    }

    const { generateText } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      prompt,
    });

    return { answer: result.text, sources, warnings };
  });

function simulatedAnswer(question: string, prompt: string): string {
  return [
    `Atlas does not have an OPENAI_API_KEY in this environment, so this`,
    `is a simulated answer for the question:`,
    `"${question}".`,
    "",
    `Once a provider is configured, the model will receive the registered`,
    `Atlas context bundle and answer with inline [source_id] citations.`,
    "",
    `Prompt preview (first 300 chars):`,
    "",
    prompt.slice(0, 300) + (prompt.length > 300 ? "…" : ""),
  ].join(" ");
}
