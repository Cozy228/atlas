import { describe, expect, it, vi } from "vitest";

import { ContextApiError } from "./contextApiError";
import { createFetchContextApiClient } from "./fetchContextApiClient";

describe("fetch Context API client", () => {
  it("uses the same-origin catalog contract and forwards cancellation", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(200, {
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
      }),
    );
    const client = createFetchContextApiClient({ baseUrl: "/api", fetch });
    const controller = new AbortController();

    const response = await client.discoverResources({ signal: controller.signal });

    expect(response.resources[0]?.slug).toBe("aws/textract");
    expect(fetch).toHaveBeenCalledWith("/api/resources/catalog", {
      method: "GET",
      signal: controller.signal,
    });
  });

  it("submits feedback through the explicit JSON mutation contract", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(201, {
        feedback: {
          id: "feedback-1",
          target_type: "resource",
          target_id: "service/aws/textract",
          feedback_type: "missing",
          message: "Add region guidance.",
          submitted_at: "2026-05-11T00:00:00.000Z",
        },
      }),
    );
    const client = createFetchContextApiClient({ baseUrl: "/api/", fetch });

    await client.submitFeedback({
      target_type: "resource",
      target_id: "service/aws/textract",
      feedback_type: "missing",
      message: "Add region guidance.",
    });

    expect(fetch).toHaveBeenCalledWith("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "resource",
        target_id: "service/aws/textract",
        feedback_type: "missing",
        message: "Add region guidance.",
      }),
    });
  });

  it("preserves structured Context API errors", async () => {
    const client = createFetchContextApiClient({
      baseUrl: "/api",
      fetch: async () =>
        jsonResponse(404, {
          error: {
            code: "resource_not_found",
            message: "Resource was not found in the Atlas registry.",
          },
        }),
    });

    await expect(client.getResourceContext("service", "missing")).rejects.toMatchObject({
      name: "ContextApiError",
      code: "resource_not_found",
      status: 404,
    } satisfies Partial<ContextApiError>);
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
