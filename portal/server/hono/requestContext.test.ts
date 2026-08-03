import { describe, expect, it } from "vitest";

import { createPortalApp } from "./app";
import type { RequestContext } from "./requestContext";

describe("Hono request context", () => {
  it("accepts a safe request ID and exposes only anonymous trusted identity", async () => {
    let requestContext: RequestContext | undefined;
    const app = createPortalApp({
      now: () => 1_725_000_000_000,
      onRequestStart: (context) => {
        requestContext = context;
      },
    });
    const controller = new AbortController();
    const request = new Request("http://internal:8080/health?token=query-secret", {
      headers: {
        authorization: "Bearer authorization-secret",
        cookie: "session=cookie-secret",
        host: "internal:8080",
        "x-amzn-oidc-identity": "unverified-subject",
        "x-forwarded-host": "portal.example.com, internal-proxy",
        "x-forwarded-proto": "https, http",
        "x-request-id": "edge-request_123",
      },
      signal: controller.signal,
    });

    const response = await app.fetch(request);

    expect(response.headers.get("x-request-id")).toBe("edge-request_123");
    expect(requestContext).toMatchObject({
      requestId: "edge-request_123",
      receivedAt: 1_725_000_000_000,
      rawHost: "internal:8080",
      forwardedHost: "portal.example.com",
      forwardedProto: "https",
      publicOrigin: "https://portal.example.com",
      principal: null,
      authSource: "anonymous",
    });
    controller.abort();
    expect(requestContext?.abortSignal.aborted).toBe(true);
  });

  it("replaces an unsafe supplied request ID with a generated safe value", async () => {
    let requestContext: RequestContext | undefined;
    const response = await createPortalApp({
      generateRequestId: () => "generated-request-id",
      onRequestStart: (context) => {
        requestContext = context;
      },
    }).request("/health", {
      headers: { "x-request-id": "secret?access_token=do-not-accept" },
    });

    expect(requestContext?.requestId).toBe("generated-request-id");
    expect(response.headers.get("x-request-id")).toBe("generated-request-id");
  });
});
