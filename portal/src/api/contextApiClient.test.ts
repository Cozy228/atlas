import { describe, expect, it } from "vitest";
import { createStaticContextApiClient } from "./contextApiClient";
import { serviceProjection } from "../fixtures/resourceContexts";

function client() {
  return createStaticContextApiClient({
    sourceDiscovery: { sources: [] },
    resourceCatalog: { resources: [] },
    resourceContexts: { "service/aws/textract": serviceProjection },
  });
}

describe("Context API client", () => {
  it("parses resource projections through the shared schema", async () => {
    await expect(client().getResourceContext("service", "aws/textract")).resolves.toEqual(
      serviceProjection,
    );
  });

  it("resolves a free-text name to a canonical resource id via search", async () => {
    const result = await client().searchResources("Textract");
    expect(result.items[0]?.id).toBe("service/aws/textract");
  });
});
