import { describe, expect, it } from "vitest";

import { ContextApiError } from "../contextApiError";
import { createFetchContextApiClient, createServerContextApiClient } from "./httpContextApiClient";

describe("fetch Context API client", () => {
  it("fetches the resource catalog through the deployed HTTP API", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = createFetchContextApiClient({
      baseUrl: "https://atlas.example.com/api",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });
        return jsonResponse(200, {
          resources: [
            {
              kind: "service",
              id: "service/aws/textract",
              slug: "aws/textract",
              provider: "aws",
              name: "AWS Textract",
              aliases: ["AWS Textract"],
              category: "AI Services",
              status: "active",
              description: "Extract text from documents.",
              entry_tools: [],
            },
          ],
        });
      },
    });

    const response = await client.discoverResources();

    expect(response.resources[0]?.slug).toBe("aws/textract");
    expect(requests[0]).toMatchObject({
      url: "https://atlas.example.com/api/resources/catalog",
      init: { method: "GET" },
    });
  });

  it("submits feedback through POST /feedback", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = createFetchContextApiClient({
      baseUrl: "https://atlas.example.com/api/",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });
        return jsonResponse(201, {
          feedback: {
            id: "feedback-1",
            target_type: "resource",
            target_id: "service/aws/textract",
            feedback_type: "missing",
            message: "Add region guidance.",
            submitted_at: "2026-05-11T00:00:00.000Z",
          },
        });
      },
    });

    await client.submitFeedback({
      target_type: "resource",
      target_id: "service/aws/textract",
      feedback_type: "missing",
      message: "Add region guidance.",
    });

    expect(requests[0]?.url).toBe("https://atlas.example.com/api/feedback");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(requests[0]?.init?.body).toBe(
      JSON.stringify({
        target_type: "resource",
        target_id: "service/aws/textract",
        feedback_type: "missing",
        message: "Add region guidance.",
      }),
    );
  });

  it("throws ContextApiError for structured HTTP errors", async () => {
    const client = createFetchContextApiClient({
      baseUrl: "https://atlas.example.com/api",
      fetch: async () =>
        jsonResponse(404, {
          error: {
            code: "resource_not_found",
            message: "Resource was not found in the Atlas registry.",
          },
        }),
    });

    await expect(client.getResourceContext("service", "missing")).rejects.toBeInstanceOf(
      ContextApiError,
    );
  });

  it("uses HTTP client when CONTEXT_API_BASE_URL is configured", () => {
    const client = createServerContextApiClient({
      env: { CONTEXT_API_BASE_URL: "https://atlas.example.com/api" },
      fetch: async () => jsonResponse(200, { resources: [] }),
    });

    expect(client.kind).toBe("http");
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
