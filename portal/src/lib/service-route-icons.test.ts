import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("catalog route icons", () => {
  it("renders mapped AWS service icons in catalog list and detail routes", async () => {
    const [listSurface, detailRoute] = await Promise.all([
      // The `/catalog` list route delegates rendering to <CatalogAdopted>, which
      // owns the service-icon wiring (cards + table).
      readFile(new URL("../components/catalog/adopted.tsx", import.meta.url), "utf8"),
      readFile(new URL("../routes/service.$provider.$id.tsx", import.meta.url), "utf8"),
    ]);

    expect(listSurface).toContain("ServiceIcon");
    expect(detailRoute).toContain("ServiceIcon");
    expect(listSurface).toContain("findAvailabilityServiceForResource");
    // The resource-first detail route looks the service up by its slug tail
    // (plan 020 15d), not the catalog's name fuzzy match.
    expect(detailRoute).toContain("findAvailabilityServiceById");
    expect(listSurface).toContain('<ServiceIcon serviceId={service.id} size="xl" />');
    expect(detailRoute).toContain('<ServiceIcon serviceId={service.id} size="lg" />');
  });
});
