import { describe, expect, it } from "vitest";
import { serviceBundle, landingZoneBundle } from "../fixtures/contextBundles.js";
import {
  buildFeedbackPayload,
  renderServiceDetail,
  renderLandingZoneNavigator,
  renderPortalHome,
  renderSourceLookup,
} from "./portalViews.js";

describe("Portal core views", () => {
  it("organizes the home screen around user intent", () => {
    const html = renderPortalHome({
      services: [serviceBundle],
      landingZones: [landingZoneBundle],
    });

    expect(html).toContain("Find a platform service");
    expect(html).toContain("Choose a landing zone");
    expect(html).toContain("Ask Atlas");
  });

  it("renders service detail data from API responses", () => {
    const html = renderServiceDetail(serviceBundle);

    expect(html).toContain("AWS Textract");
    expect(html).toContain("cloud-platform");
    expect(html).toContain("authoritative");
    expect(html).toContain("Terraform module");
  });

  it("renders landing zone navigation data from API responses", () => {
    const html = renderLandingZoneNavigator([landingZoneBundle]);

    expect(html).toContain("Central Landing Zone");
    expect(html).toContain("environment-matrix");
    expect(html).toContain("landing-zone-guidance");
  });

  it("renders source lookup warning states visibly", () => {
    const html = renderSourceLookup({
      ...serviceBundle,
      warnings: [
        {
          code: "stale_source",
          message: "Source is past its review frequency.",
          source_id: "textract-module-readme",
        },
        {
          code: "broken_anchor",
          message: "Registered anchor could not be resolved.",
          source_id: "textract-module-readme",
          anchor_id: "private-subnet-usage",
        },
      ],
    });

    expect(html).toContain("stale_source");
    expect(html).toContain("broken_anchor");
  });

  it("builds feedback payloads for missing and broken guidance", () => {
    expect(
      buildFeedbackPayload({
        bundleId: "bundle-aws-textract",
        reason: "broken",
        message: "The private subnet link is stale.",
      }),
    ).toEqual({
      bundle_id: "bundle-aws-textract",
      reason: "broken",
      message: "The private subnet link is stale.",
    });
  });
});
