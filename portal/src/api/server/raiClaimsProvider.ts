import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { z } from "zod";
import {
  createGeneratedClaimsAdapter,
  type ClaimsAdapterFetch,
  type GenerateClaimsObject,
} from "./claimsLlmShared";
import type { LlmAdapter } from "@/ask/askAtlas";

export type RaiTokenProviderInput = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  fetch?: ClaimsAdapterFetch;
  now?: () => number;
};

export type RaiTokenProvider = {
  getToken(): Promise<string>;
};

export function createRaiTokenProvider(
  input: RaiTokenProviderInput,
): RaiTokenProvider {
  const fetchImpl = input.fetch ?? globalThis.fetch;
  const now = input.now ?? Date.now;
  let cachedToken: { token: string; expiresAt: number } | undefined;

  return {
    async getToken(): Promise<string> {
      if (cachedToken && cachedToken.expiresAt > now()) {
        return cachedToken.token;
      }

      const response = await fetchImpl(input.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: input.clientId,
          client_secret: input.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`RAI token request failed with ${response.status}.`);
      }

      const parsed = raiTokenResponseSchema.parse(await response.json());
      const expiresInMs = (parsed.expires_in ?? 300) * 1_000;
      cachedToken = {
        token: parsed.access_token,
        expiresAt: now() + Math.max(0, expiresInMs - 30_000),
      };
      return cachedToken.token;
    },
  };
}

export type RaiModelInput = {
  baseUrl: string;
  modelId: string;
  accessToken: string;
  fetch?: ClaimsAdapterFetch;
};

export type RaiClaimsAdapterInput = {
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  modelId: string;
  fetch?: ClaimsAdapterFetch;
  createModel?: (input: RaiModelInput) => LanguageModel | Promise<LanguageModel>;
  generateObject?: GenerateClaimsObject;
};

export function createRaiClaimsAdapter(input: RaiClaimsAdapterInput): LlmAdapter {
  const tokenProvider = createRaiTokenProvider(input);

  return createGeneratedClaimsAdapter({
    resolveModel: async () => {
      const accessToken = await tokenProvider.getToken();
      const createModel = input.createModel ?? createRaiModel;
      return createModel({
        baseUrl: input.baseUrl,
        modelId: input.modelId,
        accessToken,
        fetch: input.fetch,
      });
    },
    generateObject: input.generateObject,
  });
}

function createRaiModel(input: RaiModelInput): LanguageModel {
  const rai = createOpenAICompatible({
    name: "RAI",
    baseURL: input.baseUrl,
    apiKey: input.accessToken,
    fetch: input.fetch,
    supportsStructuredOutputs: true,
  });
  return rai(input.modelId);
}

const raiTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive().optional(),
});
