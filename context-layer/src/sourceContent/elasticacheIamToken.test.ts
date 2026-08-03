import { describe, expect, it } from "vitest";

import { createElastiCacheIamTokenProvider } from "./elasticacheIamToken";

describe("createElastiCacheIamTokenProvider", () => {
  it("presigns the node-based ElastiCache connect request", async () => {
    const token = await createElastiCacheIamTokenProvider({
      cacheName: "Atlas-Production-Cache",
      region: "us-east-1",
      userId: "atlas-portal",
      credentials: async () => ({
        accessKeyId: "AKIDEXAMPLE",
        secretAccessKey: "example-secret",
        sessionToken: "example-session",
      }),
      now: () => new Date("2026-08-01T00:00:00.000Z"),
    })();

    expect(token).not.toContain("http://");
    expect(token).toContain("atlas-production-cache/");
    expect(token).toContain("Action=connect");
    expect(token).toContain("User=atlas-portal");
    expect(token).toContain("X-Amz-Expires=900");
    expect(token).toContain("X-Amz-Security-Token=example-session");
    expect(token).toMatch(/X-Amz-Signature=[a-f0-9]{64}/);
  });
});
