import { describe, expect, it } from "vitest";
import type { ResourceRecordResponse } from "@atlas/schema";

import type { AvailabilityRecord } from "@/api/server/availability";
import { findAvailabilityServiceForResource } from "./availability-service";

const services = [
  { id: "textract", name: "Amazon Textract", iconKey: "TEX", domain: "AI", availability: {} },
  { id: "bedrock", name: "Amazon Bedrock", iconKey: "BDR", domain: "AI", availability: {} },
  { id: "lambda", name: "Lambda", iconKey: "LAM", domain: "Compute", availability: {} },
] as ReadonlyArray<AvailabilityRecord>;

function resource(slug: string, name: string): Pick<ResourceRecordResponse, "slug" | "name"> {
  return { slug, name };
}

describe("findAvailabilityServiceForResource", () => {
  it("maps a service resource's slug to its AWS availability service", () => {
    // A service resource slug is `{provider}/{id}` (e.g. `aws/textract`); the
    // availability service id is the slug tail.
    expect(
      findAvailabilityServiceForResource(resource("aws/textract", "Amazon Textract"), services)?.id,
    ).toBe("textract");
    expect(
      findAvailabilityServiceForResource(resource("aws/bedrock", "Amazon Bedrock"), services)?.id,
    ).toBe("bedrock");
    expect(findAvailabilityServiceForResource(resource("aws/lambda", "Lambda"), services)?.id).toBe(
      "lambda",
    );
  });
});
