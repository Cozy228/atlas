import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { ResourceContextResponse } from "@atlas/schema";
import { logger, safeError } from "@atlas/logging";
import type { LlmAdapter } from "@/ask/askAtlas";

const log = logger("portal.llm");

const SYSTEM_PROMPT = [
  "You are Atlas, a governed cloud-platform assistant.",
  "Answer ONLY using the provided governed Atlas resource excerpts.",
  "Cite sources inline using the bracket form [source_id#anchor_id] that",
  "matches the excerpts. If the excerpts do not contain the answer, say so",
  "and do not invent claims.",
].join(" ");

export const claimResponseSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string().min(1),
      citation_ids: z.array(z.string().min(1)),
    }),
  ),
});

type ClaimResponse = z.infer<typeof claimResponseSchema>;

/** Mirrors the options our adapters pass through; used for test doubles. */
type GenerateClaimsObjectInput = {
  model: LanguageModel;
  schema: typeof claimResponseSchema;
  system: string;
  prompt: string;
};

export type GenerateClaimsObject = (
  input: GenerateClaimsObjectInput,
) => Promise<{ object: unknown }>;

export type ClaimsAdapterFetch = typeof fetch;

export function createSimulatedClaimsAdapter(projection: ResourceContextResponse): LlmAdapter {
  return {
    async answer(): Promise<ClaimResponse> {
      // First Section with resolved content + a citation to ground the claim.
      const section = Object.values(projection.sections).find(
        (entry) => Boolean(entry.content) && entry.citations.length > 0,
      );
      if (!section?.content) {
        return { claims: [] };
      }
      const citation = section.citations[0]!;

      return {
        claims: [
          {
            text: section.content,
            citation_ids: [citationId(citation.sourceId, citation.anchor)],
          },
        ],
      };
    },
  };
}

export function createGeneratedClaimsAdapter(input: {
  provider: "bedrock" | "rai";
  resolveModel(): Promise<LanguageModel>;
  generateObject?: GenerateClaimsObject;
}): LlmAdapter {
  return {
    async answer(prompt: string): Promise<ClaimResponse> {
      const startedAt = Date.now();
      try {
        const run = input.generateObject ?? defaultGenerateClaimsObject;
        const result = await run({
          model: await input.resolveModel(),
          schema: claimResponseSchema,
          system: SYSTEM_PROMPT,
          prompt,
        });
        const parsed = claimResponseSchema.safeParse(result.object);
        if (!parsed.success) {
          log.warn(
            {
              event: "llm.request.completed",
              provider: input.provider,
              outcome: "invalid_output",
              durationMs: Date.now() - startedAt,
            },
            "LLM request returned invalid structured output",
          );
          return { claims: [] };
        }
        log.info(
          {
            event: "llm.request.completed",
            provider: input.provider,
            outcome: "success",
            durationMs: Date.now() - startedAt,
            claimCount: parsed.data.claims.length,
          },
          "LLM request completed",
        );
        return parsed.data;
      } catch (err) {
        log.error(
          {
            event: "llm.request.failed",
            provider: input.provider,
            durationMs: Date.now() - startedAt,
            err: safeError(err, "LLM request failed"),
          },
          "LLM request failed",
        );
        throw err;
      }
    },
  };
}

async function defaultGenerateClaimsObject(
  input: GenerateClaimsObjectInput,
): Promise<{ object: unknown }> {
  const result = await generateText({
    model: input.model,
    system: input.system,
    prompt: input.prompt,
    output: Output.object({ schema: input.schema }),
  });
  return { object: result.output };
}

function citationId(sourceId: string, anchorId: string | undefined): string {
  return anchorId ? `${sourceId}#${anchorId}` : sourceId;
}
