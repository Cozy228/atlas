import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  server,
  DEV_AVAILABILITY_PAGE_ID_AWSF,
  DEV_CONFLUENCE_BASE_URL,
  DEV_CONFLUENCE_SPACE_KEYS,
  DEV_TERRAFORM_BASE_URL,
} from "@atlas/context-layer/devMocks";

import { serverContextApiClient } from "./inProcessContextApi";

// Integration: drive the in-process Context API against the shared MSW source-space
// fixture (plan 018). Point the Confluence channel at the fixture so reference
// discovery resolves live via CQL, and the Terraform channel so textract's
// terraform-backed sections resolve live from the registry (single live path, G2).
const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  process.env.ATLAS_CONFLUENCE_BASE_URL = DEV_CONFLUENCE_BASE_URL;
  process.env.ATLAS_CONFLUENCE_TOKEN = "dev-mock-token";
  process.env.ATLAS_CONFLUENCE_SPACE_KEYS = DEV_CONFLUENCE_SPACE_KEYS.join(",");
  process.env.ATLAS_CONFLUENCE_AVAILABILITY_PAGE_AWSF = DEV_AVAILABILITY_PAGE_ID_AWSF;
  process.env.ATLAS_TERRAFORM_BASE_URL = DEV_TERRAFORM_BASE_URL;
  process.env.ATLAS_TERRAFORM_TOKEN = "dev-mock-token";
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

describe("serverContextApiClient", () => {
  it("returns the registered topics, parsed through the shared schema", async () => {
    const response = await serverContextApiClient.discoverTopics();
    expect(response.topics.length).toBeGreaterThan(0);
    expect(
      response.topics.every((topic) => ["service", "security-policy"].includes(topic.topic_type)),
    ).toBe(true);
  });

  it("returns the registered sources, parsed through the shared schema", async () => {
    const response = await serverContextApiClient.discoverSources();
    expect(response.sources.length).toBeGreaterThan(0);
    expect(response.sources.every((source) => source.id.length > 0)).toBe(true);
  });

  it("submits feedback through the shared Context API contract", async () => {
    const response = await serverContextApiClient.submitFeedback({
      target_type: "topic",
      target_id: "aws-textract",
      feedback_type: "stale",
      message: "The getting started guidance needs a new review.",
    });

    expect(response.feedback.target_id).toBe("aws-textract");
    expect(response.feedback.id).toMatch(/^feedback-/);
  });

  it("projects a configured service with governance + reference-only links (plan 017)", async () => {
    const projection = await serverContextApiClient.getResourceContext("service", "aws/textract");

    expect(projection.resource.id).toBe("service/aws/textract");
    expect(projection.governance).toBe("configured");
    expect(projection.references.length).toBeGreaterThan(0);
    // Every link is honestly reference-only — the agent/UI never reads the body.
    for (const reference of projection.references) {
      expect(reference.content_mode).toBe("reference_only");
      expect(reference.agent_accessible).toBe(false);
    }
  });

  it("projects a spine-only service as governance:unconfigured, not a 404", async () => {
    // aws/cloudwatch is spine-only (in the awsf grid, no resources.yaml overlay).
    const projection = await serverContextApiClient.getResourceContext("service", "aws/cloudwatch");

    expect(projection.governance).toBe("unconfigured");
    expect(projection.sections).toEqual({});
    expect(projection.referenceDiscovery?.status).toBe("fresh");
  });

  it("throws resource_not_found for a service that is neither spined nor overlaid", async () => {
    await expect(
      serverContextApiClient.getResourceContext("service", "aws/not-a-real-service"),
    ).rejects.toMatchObject({ name: "ContextApiError", code: "resource_not_found", status: 404 });
  });

  it("reads an overlay-backed service's presentation metadata (plan 020 15d)", async () => {
    const record = await serverContextApiClient.getResourceRecord("service", "aws/textract");

    expect(record.id).toBe("service/aws/textract");
    expect(record.governance).toBe("configured");
    // The identity metadata migrated off the Topic onto the Resource record.
    expect(record.owner_team).toBe("cloud-platform");
    expect(record.support_channel).toBe("#cloud-platform");
    expect(record.category).toBe("ai-ml");
    expect(record.entry_tools?.length ?? 0).toBeGreaterThan(0);
    expect(record.topics).toContain("aws-textract");
  });

  it("reads a spine-only service's record as identity-only, unconfigured", async () => {
    const record = await serverContextApiClient.getResourceRecord("service", "aws/cloudwatch");

    expect(record.id).toBe("service/aws/cloudwatch");
    expect(record.governance).toBe("unconfigured");
    expect(record.owner_team).toBeUndefined();
    expect(record.entry_tools).toBeUndefined();
  });
});
