import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FeedbackResponseSchema, ResourceCatalogResponseSchema } from "@atlas/schema";
import { setDevDiscoveryEnv } from "../devMocks";
import { handleHttpRequest } from "./httpRoute";

// Post-collapse the registry/catalog are the OUTPUT of live discovery; point
// every channel at the MSW fixtures so resources/sources/feedback targets exist.
const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterAll(() => {
  process.env = savedEnv;
});

describe("context API HTTP route adapter", () => {
  it("maps GET /resources/catalog to the resource catalog feed", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/resources/catalog",
    });

    expect(response.status).toBe(200);
    const body = ResourceCatalogResponseSchema.parse(JSON.parse(response.body));
    expect(body.resources.some((resource) => resource.kind === "service")).toBe(true);
  });

  it("maps API Gateway /api-prefixed routes to the same HTTP adapter", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/resources/catalog",
    });

    expect(response.status).toBe(200);
    const body = ResourceCatalogResponseSchema.parse(JSON.parse(response.body));
    expect(body.resources.some((resource) => resource.kind === "guardrail")).toBe(true);
  });

  it("maps POST /feedback to feedback submission", async () => {
    const response = await handleHttpRequest({
      method: "POST",
      path: "/feedback",
      body: JSON.stringify({
        target_type: "resource",
        target_id: "service/aws/textract",
        feedback_type: "unclear",
        message: "Clarify private subnet guidance.",
      }),
    });

    expect(response.status).toBe(201);
    const body = FeedbackResponseSchema.parse(JSON.parse(response.body));
    expect(body.feedback.target_id).toBe("service/aws/textract");
  });

  it("returns structured errors for unknown HTTP routes", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/missing",
    });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      error: {
        code: "invalid_request",
        message: "Route was not found.",
      },
    });
  });
});
