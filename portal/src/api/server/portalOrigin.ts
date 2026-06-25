/**
 * The Portal's own origin, used to build self-referential discovery URLs
 * (llms.txt, sitemap, api-catalog linkset, OpenAPI `servers`, the homepage
 * `Link` header). Derived from the incoming request so every environment is
 * correct with zero config; `PORTAL_ORIGIN` env is the backstop for
 * request-less callers (build steps, tests), and the public-safe placeholder
 * is the final default.
 */
import type { H3Event } from "nitro";

/** Last-resort placeholder when neither a request nor PORTAL_ORIGIN is set. */
export const DEFAULT_PORTAL_ORIGIN = "https://portal.example.com";

/**
 * `preferEnv` flips the precedence to env-first. Use it for spec-canonical
 * artifacts (robots `Sitemap:`, RFC 9728 `resource`, the MCP transport URL)
 * that must advertise a single stable identifier rather than reflect whatever
 * Host a crawler arrived on. Request-derivation remains the fallback so local
 * dev still works without `PORTAL_ORIGIN`.
 */
export function resolvePortalOrigin(event?: H3Event, options?: { preferEnv?: boolean }): string {
  const fromEnv = process.env.PORTAL_ORIGIN?.trim();
  if (options?.preferEnv && fromEnv) return stripTrailingSlash(fromEnv);
  const fromRequest = event ? originFromEvent(event) : undefined;
  if (fromRequest) return fromRequest;
  if (fromEnv) return stripTrailingSlash(fromEnv);
  return DEFAULT_PORTAL_ORIGIN;
}

/**
 * Trust `X-Forwarded-*` first (Atlas runs behind a load balancer that sets
 * them); fall back to the `Host` header, then to the parsed request URL.
 * Forwarded values may be comma-separated proxy chains — take the first hop.
 */
function originFromEvent(event: H3Event): string | undefined {
  const headers = event.req.headers;
  const host = firstHop(headers.get("x-forwarded-host")) ?? headers.get("host");
  if (host) {
    const proto = firstHop(headers.get("x-forwarded-proto")) ?? event.url.protocol.replace(":", "");
    return `${proto}://${host}`;
  }
  return event.url.origin || undefined;
}

function firstHop(value: string | null): string | undefined {
  const first = value?.split(",")[0]?.trim();
  return first || undefined;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
