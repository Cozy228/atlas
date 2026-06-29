import { describe, expect, it } from "vitest";

import { ContextApiError } from "../contextApiError";
import { createFetchContextApiClient, createServerContextApiClient } from "./httpContextApiClient";

describe("fetch Context API client", () => {
  it("fetches topic discovery through the deployed HTTP API", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = createFetchContextApiClient({
      baseUrl: "https://atlas.example.com/api",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });
        return jsonResponse(200, {
          topics: [
            {
              id: "aws-textract",
              name: "AWS Textract",
              topic_type: "service",
              category: "ai-ml",
              status: "active",
              description: "Extract text from documents.",
              owner_team: "Cloud Platform",
              support_channel: "#cloud-platform",
              entry_tools: [],
            },
          ],
        });
      },
    });

    const response = await client.discoverTopics({ topic_type: "service" });

    expect(response.topics[0]?.id).toBe("aws-textract");
    expect(requests[0]).toMatchObject({
      url: "https://atlas.example.com/api/topics?topic_type=service",
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
            target_type: "topic",
            target_id: "aws-textract",
            feedback_type: "missing",
            message: "Add region guidance.",
            submitted_at: "2026-05-11T00:00:00.000Z",
          },
        });
      },
    });

    await client.submitFeedback({
      target_type: "topic",
      target_id: "aws-textract",
      feedback_type: "missing",
      message: "Add region guidance.",
    });

    expect(requests[0]?.url).toBe("https://atlas.example.com/api/feedback");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(requests[0]?.init?.body).toBe(
      JSON.stringify({
        target_type: "topic",
        target_id: "aws-textract",
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
            code: "topic_not_found",
            message: "Topic was not found in the Atlas registry.",
          },
        }),
    });

    await expect(client.getResourceContext("service", "missing")).rejects.toBeInstanceOf(
      ContextApiError,
    );
  });

  it("uses HTTP client when ATLAS_CONTEXT_API_BASE_URL is configured", () => {
    const client = createServerContextApiClient({
      env: { ATLAS_CONTEXT_API_BASE_URL: "https://atlas.example.com/api" },
      fetch: async () => jsonResponse(200, { topics: [] }),
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
