import type { LanguageModel } from "ai";
import { describe, expect, it, vi } from "vitest";
import { serviceProjection } from "@/fixtures/resourceContexts";
import {
  claimResponseSchema,
  createBedrockClaimsAdapter,
  createConfiguredClaimsAdapter,
  createRaiClaimsAdapter,
  createRaiTokenProvider,
} from "./llmProvider";

describe("Ask Atlas LLM provider selection", () => {
  it("falls back to the simulated adapter without provider configuration", async () => {
    const adapter = createConfiguredClaimsAdapter({
      projection: serviceProjection,
      env: {},
    });

    const result = await adapter.answer("How do I use Textract?");

    expect(result.claims[0]).toMatchObject({
      text: "Use the Textract module with private endpoint configuration.",
      citation_ids: ["textract-module-readme#private-subnet-usage"],
    });
  });

  it("uses the Bedrock model with the shared claim schema", async () => {
    const model = {
      provider: "bedrock",
      modelId: "us.anthropic.claude-sonnet-4-5",
    } as LanguageModel;
    const adapter = createBedrockClaimsAdapter({
      modelId: "us.anthropic.claude-sonnet-4-5",
      model,
      generateObject: async (input) => {
        expect(input.model).toBe(model);
        expect(input.schema).toBe(claimResponseSchema);
        return {
          object: {
            claims: [
              {
                text: "Bedrock answer.",
                citation_ids: ["textract-module-readme#private-subnet-usage"],
              },
            ],
          },
        };
      },
    });

    await expect(adapter.answer("Prompt")).resolves.toEqual({
      claims: [
        {
          text: "Bedrock answer.",
          citation_ids: ["textract-module-readme#private-subnet-usage"],
        },
      ],
    });
  });

  it("accepts uppercase RAI provider configuration", async () => {
    expect(() =>
      createConfiguredClaimsAdapter({
        projection: serviceProjection,
        env: { LLM_PROVIDER: "RAI" },
      }),
    ).toThrow("RAI_BASE_URL");
  });

  it("exchanges RAI client credentials for a bearer token", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: "rai-token", expires_in: 3600 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const provider = createRaiTokenProvider({
      tokenUrl: "https://rai.example.com/oauth/token",
      clientId: "client-id",
      clientSecret: "client-secret",
      fetch,
      now: () => 1_000,
    });

    await expect(provider.getToken()).resolves.toBe("rai-token");
    await expect(provider.getToken()).resolves.toBe("rai-token");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://rai.example.com/oauth/token");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(String(init?.body)).toContain("grant_type=client_credentials");
    expect(String(init?.body)).toContain("client_id=client-id");
    expect(String(init?.body)).toContain("client_secret=client-secret");
  });

  it("uses RAI as an OpenAI-compatible provider after token exchange", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: "rai-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const model = { provider: "RAI", modelId: "rai-chat" } as LanguageModel;
    const adapter = createRaiClaimsAdapter({
      baseUrl: "https://rai.example.com/v1",
      tokenUrl: "https://rai.example.com/oauth/token",
      clientId: "client-id",
      clientSecret: "client-secret",
      modelId: "rai-chat",
      fetch,
      createModel: async (input) => {
        expect(input.accessToken).toBe("rai-token");
        expect(input.baseUrl).toBe("https://rai.example.com/v1");
        expect(input.modelId).toBe("rai-chat");
        return model;
      },
      generateObject: async (input) => {
        expect(input.model).toBe(model);
        return {
          object: {
            claims: [
              {
                text: "RAI answer.",
                citation_ids: ["textract-module-readme#private-subnet-usage"],
              },
            ],
          },
        };
      },
    });

    await expect(adapter.answer("Prompt")).resolves.toEqual({
      claims: [
        {
          text: "RAI answer.",
          citation_ids: ["textract-module-readme#private-subnet-usage"],
        },
      ],
    });
  });
});
