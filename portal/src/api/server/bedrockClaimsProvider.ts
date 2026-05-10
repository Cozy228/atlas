import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import type { LanguageModel } from "ai";
import {
  createGeneratedClaimsAdapter,
  type ClaimsAdapterFetch,
  type GenerateClaimsObject,
} from "./claimsLlmShared";
import type { LlmAdapter } from "@/ask/askAtlas";

export type BedrockClaimsAdapterInput = {
  modelId: string;
  region?: string;
  fetch?: ClaimsAdapterFetch;
  model?: LanguageModel;
  generateObject?: GenerateClaimsObject;
};

export function createBedrockClaimsAdapter(
  input: BedrockClaimsAdapterInput,
): LlmAdapter {
  return createGeneratedClaimsAdapter({
    resolveModel: async () =>
      input.model ??
      createBedrockModel({
        modelId: input.modelId,
        region: input.region,
        fetch: input.fetch,
      }),
    generateObject: input.generateObject,
  });
}

function createBedrockModel(input: {
  modelId: string;
  region?: string;
  fetch?: ClaimsAdapterFetch;
}): LanguageModel {
  const bedrock = createAmazonBedrock({
    region: input.region,
    fetch: input.fetch,
  });
  return bedrock(input.modelId);
}
