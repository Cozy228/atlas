import type { ResourceContextResponse } from "@atlas/schema";
import { logger } from "@atlas/logging";
import type { LlmAdapter } from "@/ask/askAtlas";
import { createBedrockClaimsAdapter } from "./bedrockClaimsProvider";
import { type ClaimsAdapterFetch, createSimulatedClaimsAdapter } from "./claimsLlmShared";
import { createRaiClaimsAdapter } from "./raiClaimsProvider";

const log = logger("portal.llm");

export type ConfiguredClaimsAdapterInput = {
  projection: ResourceContextResponse;
  env?: Record<string, string | undefined>;
  fetch?: ClaimsAdapterFetch;
};

export function createConfiguredClaimsAdapter(input: ConfiguredClaimsAdapterInput): LlmAdapter {
  const env = input.env ?? readProcessEnv();
  const provider = env.LLM_PROVIDER?.toLowerCase();

  if (provider === "bedrock" || (!provider && env.BEDROCK_MODEL_ID)) {
    log.debug({ event: "llm.provider.selected", provider: "bedrock" }, "LLM provider selected");
    const modelId = requiredEnv(env, "BEDROCK_MODEL_ID");
    return createBedrockClaimsAdapter({
      modelId,
      region: env.BEDROCK_REGION ?? env.AWS_REGION,
      fetch: input.fetch,
    });
  }

  if (provider === "rai" || (!provider && env.RAI_MODEL_ID)) {
    log.debug({ event: "llm.provider.selected", provider: "rai" }, "LLM provider selected");
    return createRaiClaimsAdapter({
      baseUrl: requiredEnv(env, "RAI_BASE_URL"),
      tokenUrl: requiredEnv(env, "RAI_TOKEN_URL"),
      clientId: requiredEnv(env, "RAI_CLIENT_ID"),
      clientSecret: requiredEnv(env, "RAI_CLIENT_SECRET"),
      modelId: requiredEnv(env, "RAI_MODEL_ID"),
      fetch: input.fetch,
    });
  }

  log.debug({ event: "llm.provider.selected", provider: "simulated" }, "LLM provider selected");
  return createSimulatedClaimsAdapter(input.projection);
}

export { claimResponseSchema } from "./claimsLlmShared";

export type { BedrockClaimsAdapterInput } from "./bedrockClaimsProvider";
export { createBedrockClaimsAdapter } from "./bedrockClaimsProvider";

export type {
  RaiClaimsAdapterInput,
  RaiModelInput,
  RaiTokenProvider,
  RaiTokenProviderInput,
} from "./raiClaimsProvider";
export { createRaiClaimsAdapter, createRaiTokenProvider } from "./raiClaimsProvider";

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required for Atlas LLM provider configuration.`);
  }
  return value;
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
