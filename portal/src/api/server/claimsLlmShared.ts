import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { ContextBundleResponse } from "@atlas/schema";
import type { LlmAdapter } from "@/ask/askAtlas";

export const SYSTEM_PROMPT = [
  "You are Atlas, a governed cloud-platform assistant.",
  "Answer ONLY using the provided Atlas context bundle excerpts.",
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
export type GenerateClaimsObjectInput = {
  model: LanguageModel;
  schema: typeof claimResponseSchema;
  system: string;
  prompt: string;
};

export type GenerateClaimsObject = (
  input: GenerateClaimsObjectInput,
) => Promise<{ object: unknown }>;

export type ClaimsAdapterFetch = typeof fetch;

export function createSimulatedClaimsAdapter(bundle: ContextBundleResponse): LlmAdapter {
  return {
    async answer(): Promise<ClaimResponse> {
      const excerpt = bundle.sources
        .filter((source) => source.source.authority_level === "authoritative")
        .flatMap((source) => source.excerpts)[0];

      if (!excerpt) {
        return { claims: [] };
      }

      return {
        claims: [
          {
            text: excerpt.text,
            citation_ids: [citationId(excerpt.citation.source_id, excerpt.citation.anchor_id)],
          },
        ],
      };
    },
  };
}

export function createGeneratedClaimsAdapter(input: {
  resolveModel(): Promise<LanguageModel>;
  generateObject?: GenerateClaimsObject;
}): LlmAdapter {
  return {
    async answer(prompt: string): Promise<ClaimResponse> {
      const run = input.generateObject ?? defaultGenerateClaimsObject;
      const result = await run({
        model: await input.resolveModel(),
        schema: claimResponseSchema,
        system: SYSTEM_PROMPT,
        prompt,
      });
      const parsed = claimResponseSchema.safeParse(result.object);
      return parsed.success ? parsed.data : { claims: [] };
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
