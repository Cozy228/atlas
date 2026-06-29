import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

import { serverContextApiClient } from "./inProcessContextApi";

// Integration: drive the in-process Context API against the shared MSW source-space
// fixture (plan 018). Post-flip (plan 018 G5) the registry + resource records are
// the OUTPUT of live discovery, so point EVERY discovery channel at the fixtures
// (service modules + availability spine + reference space + guardrail space) and
// boot the Node-mode server.
const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv();
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
    // The service Topic id is the resource slug post-flip.
    expect(response.topics.some((topic) => topic.id === "aws/textract")).toBe(true);
  });

  it("returns the registered sources, parsed through the shared schema", async () => {
    const response = await serverContextApiClient.discoverSources();
    expect(response.sources.length).toBeGreaterThan(0);
    expect(response.sources.every((source) => source.id.length > 0)).toBe(true);
  });

  it("submits feedback through the shared Context API contract", async () => {
    const response = await serverContextApiClient.submitFeedback({
      target_type: "topic",
      target_id: "aws/textract",
      feedback_type: "stale",
      message: "The getting started guidance needs a new review.",
    });

    expect(response.feedback.target_id).toBe("aws/textract");
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

  it("projects every discovered service as configured with cited sections (plan 018 G5)", async () => {
    // Post-flip every spine service has a derived overlay, so aws/cloudwatch (in
    // the awsf grid) is configured with cited sections, not a spine-only gap.
    const projection = await serverContextApiClient.getResourceContext("service", "aws/cloudwatch");

    expect(projection.governance).toBe("configured");
    expect(projection.sections.availability?.status).toBe("available");
    expect(projection.referenceDiscovery?.status).toBe("fresh");
  });

  it("throws resource_not_found for a service that is neither spined nor overlaid", async () => {
    await expect(
      serverContextApiClient.getResourceContext("service", "aws/not-a-real-service"),
    ).rejects.toMatchObject({ name: "ContextApiError", code: "resource_not_found", status: 404 });
  });

  it("reads a discovered service's presentation metadata (plan 018 G5)", async () => {
    const record = await serverContextApiClient.getResourceRecord("service", "aws/textract");

    expect(record.id).toBe("service/aws/textract");
    expect(record.governance).toBe("configured");
    // Category = the availability domain; one Terraform-module entry tool derived
    // from the discovered module. Owner/support/description are honest-gap.
    expect(record.category).toBe("AI Services");
    expect(record.entry_tools?.length ?? 0).toBeGreaterThan(0);
    expect(record.owner_team).toBeUndefined();
    expect(record.support_channel).toBeUndefined();
  });
});
