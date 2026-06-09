import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("catalog route icons", () => {
  it("renders mapped AWS service icons in catalog list and detail routes", async () => {
    const [listRoute, detailRoute] = await Promise.all([
      readFile(new URL("../routes/catalog.index.tsx", import.meta.url), "utf8"),
      readFile(new URL("../routes/catalog.$topicId.tsx", import.meta.url), "utf8"),
    ]);

    expect(listRoute).toContain("ServiceIcon");
    expect(detailRoute).toContain("ServiceIcon");
    expect(listRoute).toContain("findAvailabilityServiceForTopic");
    expect(detailRoute).toContain("findAvailabilityServiceForTopic");
    expect(listRoute).toContain('<ServiceIcon serviceId={service.id} size="xl" />');
    expect(detailRoute).toContain('<ServiceIcon serviceId={service.id} size="hero" />');
  });
});
