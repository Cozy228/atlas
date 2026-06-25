import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_PORTAL_ORIGIN, handlerRequest, resolvePortalOrigin } from "./portalOrigin";

/**
 * Request-like stand-in: a bare `url` + `Headers`, which is the stable shape
 * `handlerRequest` normalizes to. `Headers` (unlike `new Request`) lets us set
 * the forbidden `Host`/forwarded headers a proxy would inject.
 */
function requestWith(
  headers: Record<string, string>,
  url = "http://internal:3201/llms.txt",
): Request {
  return { url, headers: new Headers(headers) } as unknown as Request;
}

describe("resolvePortalOrigin", () => {
  const original = process.env.PORTAL_ORIGIN;
  afterEach(() => {
    if (original === undefined) delete process.env.PORTAL_ORIGIN;
    else process.env.PORTAL_ORIGIN = original;
  });

  it("derives the origin from X-Forwarded-* set by the load balancer", () => {
    const request = requestWith({
      "x-forwarded-host": "portal.acme.example",
      "x-forwarded-proto": "https",
    });
    expect(resolvePortalOrigin(request)).toBe("https://portal.acme.example");
  });

  it("takes the first hop of a comma-separated proxy chain", () => {
    const request = requestWith({
      "x-forwarded-host": "portal.acme.example, internal-lb",
      "x-forwarded-proto": "https, http",
    });
    expect(resolvePortalOrigin(request)).toBe("https://portal.acme.example");
  });

  it("falls back to the Host header and the request protocol", () => {
    const request = requestWith({ host: "localhost:3201" }, "http://localhost:3201/llms.txt");
    expect(resolvePortalOrigin(request)).toBe("http://localhost:3201");
  });

  it("falls back to PORTAL_ORIGIN env when no request is available", () => {
    process.env.PORTAL_ORIGIN = "https://canonical.example/";
    expect(resolvePortalOrigin()).toBe("https://canonical.example");
  });

  it("falls back to the public-safe placeholder when nothing else is set", () => {
    delete process.env.PORTAL_ORIGIN;
    expect(resolvePortalOrigin()).toBe(DEFAULT_PORTAL_ORIGIN);
  });

  it("preferEnv lets the canonical PORTAL_ORIGIN win over the request Host", () => {
    process.env.PORTAL_ORIGIN = "https://canonical.example";
    const request = requestWith({
      "x-forwarded-host": "crawler-saw-this.example",
      "x-forwarded-proto": "https",
    });
    expect(resolvePortalOrigin(request, { preferEnv: true })).toBe("https://canonical.example");
    // Without the flag, the request still wins.
    expect(resolvePortalOrigin(request)).toBe("https://crawler-saw-this.example");
  });

  it("preferEnv still derives from the request when PORTAL_ORIGIN is unset", () => {
    delete process.env.PORTAL_ORIGIN;
    const request = requestWith({ host: "localhost:3201" }, "http://localhost:3201/robots.txt");
    expect(resolvePortalOrigin(request, { preferEnv: true })).toBe("http://localhost:3201");
  });
});

describe("handlerRequest", () => {
  it("returns a bare Request as-is (current Nitro contract)", () => {
    const request = new Request("http://localhost:3201/llms.txt");
    expect(handlerRequest(request)).toBe(request);
  });

  it("unwraps an H3Event-style { req } (older Nitro contract)", () => {
    const request = new Request("http://localhost:3201/llms.txt");
    expect(handlerRequest({ req: request, url: new URL("http://localhost:3201/llms.txt") })).toBe(
      request,
    );
  });

  it("returns undefined for request-less callers", () => {
    expect(handlerRequest(undefined)).toBeUndefined();
    expect(handlerRequest({})).toBeUndefined();
  });
});
