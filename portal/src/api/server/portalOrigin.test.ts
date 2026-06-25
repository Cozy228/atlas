import { afterEach, describe, expect, it } from "vitest";
import type { H3Event } from "nitro";

import { DEFAULT_PORTAL_ORIGIN, resolvePortalOrigin } from "./portalOrigin";

/** Minimal H3Event stand-in: only the fields resolvePortalOrigin reads. */
function eventWith(
  headers: Record<string, string>,
  url = "http://internal:3201/llms.txt",
): H3Event {
  return {
    req: { headers: new Headers(headers) },
    url: new URL(url),
  } as unknown as H3Event;
}

describe("resolvePortalOrigin", () => {
  const original = process.env.PORTAL_ORIGIN;
  afterEach(() => {
    if (original === undefined) delete process.env.PORTAL_ORIGIN;
    else process.env.PORTAL_ORIGIN = original;
  });

  it("derives the origin from X-Forwarded-* set by the load balancer", () => {
    const event = eventWith({
      "x-forwarded-host": "portal.acme.example",
      "x-forwarded-proto": "https",
    });
    expect(resolvePortalOrigin(event)).toBe("https://portal.acme.example");
  });

  it("takes the first hop of a comma-separated proxy chain", () => {
    const event = eventWith({
      "x-forwarded-host": "portal.acme.example, internal-lb",
      "x-forwarded-proto": "https, http",
    });
    expect(resolvePortalOrigin(event)).toBe("https://portal.acme.example");
  });

  it("falls back to the Host header and the request protocol", () => {
    const event = eventWith({ host: "localhost:3201" }, "http://localhost:3201/llms.txt");
    expect(resolvePortalOrigin(event)).toBe("http://localhost:3201");
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
    const event = eventWith({
      "x-forwarded-host": "crawler-saw-this.example",
      "x-forwarded-proto": "https",
    });
    expect(resolvePortalOrigin(event, { preferEnv: true })).toBe("https://canonical.example");
    // Without the flag, the request still wins.
    expect(resolvePortalOrigin(event)).toBe("https://crawler-saw-this.example");
  });

  it("preferEnv still derives from the request when PORTAL_ORIGIN is unset", () => {
    delete process.env.PORTAL_ORIGIN;
    const event = eventWith({ host: "localhost:3201" }, "http://localhost:3201/robots.txt");
    expect(resolvePortalOrigin(event, { preferEnv: true })).toBe("http://localhost:3201");
  });
});
