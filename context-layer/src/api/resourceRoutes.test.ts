import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEV_TERRAFORM_BASE_URL } from "../devMocks/fixtures";
import { handleHttpRequest } from "./httpRoute";

// Single live path (plan 018 G2): textract's terraform-backed `network`/`examples`
// sections fetch from the registry now, so point ATLAS_TERRAFORM_* at the MSW
// Terraform fixture (the global devMocks/setup.ts keeps the server listening).
const savedTerraformEnv = {
  baseUrl: process.env.ATLAS_TERRAFORM_BASE_URL,
  token: process.env.ATLAS_TERRAFORM_TOKEN,
};
beforeAll(() => {
  process.env.ATLAS_TERRAFORM_BASE_URL = DEV_TERRAFORM_BASE_URL;
  process.env.ATLAS_TERRAFORM_TOKEN = "dev-mock-token";
});
afterAll(() => {
  restoreEnv("ATLAS_TERRAFORM_BASE_URL", savedTerraformEnv.baseUrl);
  restoreEnv("ATLAS_TERRAFORM_TOKEN", savedTerraformEnv.token);
});
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("resource HTTP routes", () => {
  it("searchResources resolves a free-text name to a canonical id", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/resources",
      query: { query: "textract" },
    });
    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as { items: { id: string }[] };
    expect(body.items[0]?.id).toBe("service/aws/textract");
  });

  it("searchResources without a query is a 400", async () => {
    const response = await handleHttpRequest({ method: "GET", path: "/api/resources", query: {} });
    expect(response.status).toBe(400);
  });

  it("getResourceContext returns JSON with network + availability available", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/resources/service/aws/textract",
      query: { sections: "network,availability" },
    });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    const body = JSON.parse(response.body) as {
      sections: Record<string, { status: string; content: string | null }>;
    };
    expect(body.sections.network?.status).toBe("available");
    expect(body.sections.availability?.content).toContain("us-east-1");
  });

  it("content-negotiates Markdown via Accept: text/markdown", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/resources/service/aws/textract",
      query: { sections: "network" },
      headers: { accept: "text/markdown" },
    });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/markdown");
    expect(response.body).toContain("# Amazon Textract");
    expect(response.body).toContain("Canonical resource: `service/aws/textract`");
  });

  it("returns 404 resource_not_found for an unregistered resource", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/resources/service/aws/nonexistent",
    });
    expect(response.status).toBe(404);
    expect((JSON.parse(response.body) as { error: { code: string } }).error.code).toBe(
      "resource_not_found",
    );
  });

  it("returns 400 invalid_request for an unknown kind", async () => {
    const response = await handleHttpRequest({ method: "GET", path: "/api/resources/bogus/x" });
    expect(response.status).toBe(400);
    expect((JSON.parse(response.body) as { error: { code: string } }).error.code).toBe(
      "invalid_request",
    );
  });

  it("builds absolute resource URLs from the request origin", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/resources",
      query: { query: "textract" },
      origin: "https://atlas.example.com",
    });
    const body = JSON.parse(response.body) as { items: { resourceUrl: string }[] };
    expect(body.items[0]?.resourceUrl).toBe(
      "https://atlas.example.com/api/resources/service/aws/textract",
    );
  });
});
