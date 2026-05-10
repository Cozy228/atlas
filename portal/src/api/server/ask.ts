import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ContextBundleResponse, ContextRequest } from "@atlas/schema";

import {
  askAtlas as answerFromContextBundle,
  createDailyRateLimiter,
  type AskAtlasClaim,
  type LlmAdapter,
} from "@/ask/askAtlas";
import { serverContextApiClient } from "./inProcessContextApi";

const SYSTEM_PROMPT = [
  "You are Atlas, a governed cloud-platform assistant.",
  "Answer ONLY using the provided Atlas context bundle excerpts.",
  "Cite sources inline using the bracket form [source_id#anchor_id] that",
  "matches the excerpts. If the excerpts do not contain the answer, say so",
  "and do not invent claims.",
].join(" ");

const askInputSchema = z.object({
  topicId: z.string().min(1).optional(),
  question: z.string().min(1),
});

const claimResponseSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string().min(1),
      citation_ids: z.array(z.string().min(1)),
    }),
  ),
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
    const bundle = await serverContextApiClient.getContextBundle(
      buildAskContextRequest(data),
    );

    return createAskAtlasResponse({
      question: data.question,
      bundle,
      adapter: createConfiguredAdapter(bundle),
      userId: "anonymous",
    });
  });

export type AskAtlasClaimsAdapter = LlmAdapter;

export function buildAskContextRequest(input: {
  topicId?: string;
  question: string;
}): ContextRequest {
  return input.topicId ? { topic_id: input.topicId } : { question: input.question };
}

export async function createAskAtlasResponse(input: {
  question: string;
  bundle: ContextBundleResponse;
  adapter: AskAtlasClaimsAdapter;
  userId: string;
}): Promise<AskAtlasResponse> {
  try {
    const result = await answerFromContextBundle({
      question: input.question,
      bundle: input.bundle,
      adapter: input.adapter,
      userId: input.userId,
      rateLimiter,
    });
    const warnings = [...result.warnings];

    if (result.rejected_claims.length > 0) {
      warnings.push("uncited-claims-rejected");
    }

    return {
      answer: formatClaims(result.claims),
      sources: authoritativeSourceRefs(input.bundle),
      warnings,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Ask Atlas daily limit exceeded.") {
      return { answer: "", sources: [], warnings: ["rate-limit-exceeded"] };
    }
    throw error;
  }
}

function createConfiguredAdapter(bundle: ContextBundleResponse): AskAtlasClaimsAdapter {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return createSimulatedAdapter(bundle);
  }
  return createOpenAiAdapter();
}

function createSimulatedAdapter(bundle: ContextBundleResponse): AskAtlasClaimsAdapter {
  return {
    async answer(): Promise<{ claims: AskAtlasClaim[] }> {
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

function createOpenAiAdapter(): AskAtlasClaimsAdapter {
  return {
    async answer(prompt: string): Promise<{ claims: AskAtlasClaim[] }> {
      const { generateText } = await import("ai");
      const { openai } = await import("@ai-sdk/openai");
      const result = await generateText({
        model: openai("gpt-4o-mini"),
        system: SYSTEM_PROMPT,
        prompt: `${prompt}\n\nReturn strict JSON only: {"claims":[{"text":"...","citation_ids":["source#anchor"]}]}`,
      });
      const parsed = claimResponseSchema.safeParse(parseJsonObject(result.text));
      return parsed.success ? parsed.data : { claims: [] };
    },
  };
}

function authoritativeSourceRefs(bundle: ContextBundleResponse): AskAtlasSourceRef[] {
  return bundle.sources
    .filter((source) => source.source.authority_level === "authoritative")
    .map((source) => ({
      source_id: source.source.id,
      title: source.source.title,
      authority_level: source.source.authority_level,
      url: source.source.location,
    }));
}

function formatClaims(claims: ReadonlyArray<AskAtlasClaim>): string {
  return claims
    .map((claim) => `${claim.text} ${claim.citation_ids.map((id) => `[${id}]`).join(" ")}`)
    .join("\n\n");
}

function citationId(sourceId: string, anchorId: string | undefined): string {
  return anchorId ? `${sourceId}#${anchorId}` : sourceId;
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  try {
    return JSON.parse(fenced?.[1] ?? trimmed);
  } catch {
    return {};
  }
}
