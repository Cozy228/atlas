import { describe, expect, it } from "vitest";

import { resolutionContextFromHeaders } from "./requestResolutionContext";

describe("resolutionContextFromHeaders", () => {
  it("threads an opaque caller Bearer from Web-standard request headers", async () => {
    const context = await resolutionContextFromHeaders(
      new Headers({ authorization: "Bearer fictional-caller-token" }),
    );

    expect(context.token).toBe("fictional-caller-token");
  });
});
