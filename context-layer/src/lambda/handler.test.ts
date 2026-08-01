import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ResourceCatalogResponseSchema } from "@atlas/schema";
import { setDevDiscoveryEnv } from "../devMocks";
import { handler } from "./handler";

const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterAll(() => {
  process.env = savedEnv;
});

describe("context API Lambda handler", () => {
  it("adapts API Gateway HTTP API events to HTTP route responses", async () => {
    const response = await handler({
      version: "2.0",
      routeKey: "GET /resources/catalog",
      rawPath: "/resources/catalog",
      rawQueryString: "",
      headers: {},
      requestContext: {
        requestId: "gateway-request-123",
        http: { method: "GET", path: "/resources/catalog" },
      },
      isBase64Encoded: false,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBe("gateway-request-123");
    const body = ResourceCatalogResponseSchema.parse(JSON.parse(response.body));
    expect(body.resources.some((resource) => resource.kind === "guardrail")).toBe(true);
  });
});
