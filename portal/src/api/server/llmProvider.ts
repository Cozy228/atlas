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

type GenerateObjectInput = {
  model: unknown;
  schema: typeof claimResponseSchema;
  system: string;
  prompt: string;
};

type GenerateObject = (input: GenerateObjectInput) => Promise<{ object: unknown }>;

type Fetch = typeof fetch;

export type ConfiguredClaimsAdapterInput = {
  bundle: ContextBundleResponse;
  env?: Record<string, string | undefined>;
  fetch?: Fetch;
};

export function createConfiguredClaimsAdapter(
  input: ConfiguredClaimsAdapterInput,
): LlmAdapter {
  const env = input.env ?? readProcessEnv();
  const provider = env.ATLAS_LLM_PROVIDER?.toLowerCase();

  if (provider === "bedrock" || (!provider && env.ATLAS_BEDROCK_MODEL_ID)) {
    const modelId = requiredEnv(env, "ATLAS_BEDROCK_MODEL_ID");
    return createBedrockClaimsAdapter({
      modelId,
      region: env.ATLAS_BEDROCK_REGION ?? env.AWS_REGION,
      fetch: input.fetch,
    });
  }

  if (provider === "rai" || (!provider && env.RAI_MODEL_ID)) {
    return createRaiClaimsAdapter({
      baseUrl: requiredEnv(env, "RAI_BASE_URL"),
      tokenUrl: requiredEnv(env, "RAI_TOKEN_URL"),
      clientId: requiredEnv(env, "RAI_CLIENT_ID"),
      clientSecret: requiredEnv(env, "RAI_CLIENT_SECRET"),
      modelId: requiredEnv(env, "RAI_MODEL_ID"),
      fetch: input.fetch,
    });
  }

  return createSimulatedClaimsAdapter(input.bundle);
}

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

export type BedrockClaimsAdapterInput = {
  modelId: string;
  region?: string;
  fetch?: Fetch;
  model?: unknown;
  generateObject?: GenerateObject;
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

export type RaiTokenProviderInput = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  fetch?: Fetch;
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
  fetch?: Fetch;
};

export type RaiClaimsAdapterInput = {
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  modelId: string;
  fetch?: Fetch;
  createModel?: (input: RaiModelInput) => unknown | Promise<unknown>;
  generateObject?: GenerateObject;
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

function createGeneratedClaimsAdapter(input: {
  resolveModel(): Promise<unknown>;
  generateObject?: GenerateObject;
}): LlmAdapter {
  return {
    async answer(prompt: string): Promise<ClaimResponse> {
      const generateObject = input.generateObject ?? defaultGenerateObject;
      const result = await generateObject({
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

async function defaultGenerateObject(input: GenerateObjectInput): Promise<{ object: unknown }> {
  const { generateObject } = await import("ai");
  return generateObject({
    model: input.model as Parameters<typeof generateObject>[0]["model"],
    schema: input.schema,
    system: input.system,
    prompt: input.prompt,
  });
}

async function createBedrockModel(input: {
  modelId: string;
  region?: string;
  fetch?: Fetch;
}): Promise<unknown> {
  const { createAmazonBedrock } = await import("@ai-sdk/amazon-bedrock");
  const bedrock = createAmazonBedrock({
    region: input.region,
    fetch: input.fetch,
  });
  return bedrock(input.modelId);
}

async function createRaiModel(input: RaiModelInput): Promise<unknown> {
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
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

function citationId(sourceId: string, anchorId: string | undefined): string {
  return anchorId ? `${sourceId}#${anchorId}` : sourceId;
}

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
