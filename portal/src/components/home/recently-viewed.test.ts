import { describe, expect, it } from "vitest";

import { recentItemFromParts } from "./recently-viewed.js";

describe("recently viewed item construction", () => {
  it("returns null when the route identity is incomplete", () => {
    expect(recentItemFromParts(undefined, undefined, "Storage")).toBeNull();
    expect(recentItemFromParts("capability", undefined, "Storage")).toBeNull();
  });

  it("reconstructs recent items from stable route primitives", () => {
    expect(recentItemFromParts("capability", "s3", "S3")).toEqual({
      kind: "capability",
      topicId: "s3",
      name: "S3",
    });

    expect(recentItemFromParts("source", "cmdb", "CMDB")).toEqual({
      kind: "source",
      sourceId: "cmdb",
      name: "CMDB",
    });
  });
});
