import { describe, expect, it } from "vitest";
import { createStaticContextApiClient } from "./contextApiClient.js";
import { capabilityBundle, landingZoneBundle } from "../fixtures/contextBundles.js";

describe("Context API client", () => {
  it("parses context bundles through the shared schema", async () => {
    const client = createStaticContextApiClient({
      contextBundles: {
        "aws-textract": capabilityBundle,
      },
      sourceDiscovery: { sources: [] },
      topicDiscovery: { topics: [] },
    });

    await expect(client.getContextBundle({ topic_id: "aws-textract" })).resolves.toEqual(
      capabilityBundle,
    );
  });

  it("does not expose Context Layer internals to Portal callers", async () => {
    const client = createStaticContextApiClient({
      contextBundles: {
        "central-landing-zone": landingZoneBundle,
      },
      sourceDiscovery: { sources: [] },
      topicDiscovery: { topics: [] },
    });

    const bundle = await client.getContextBundle({
      topic_id: "central-landing-zone",
    });

    expect(bundle.sources[0]?.source.steward).toBe("cloud-foundation");
    expect(bundle.sources[0]).not.toHaveProperty("repository");
  });
});
