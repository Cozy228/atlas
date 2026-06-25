/**
 * The Portal's own origin, used to build self-referential discovery URLs
 * (llms.txt, sitemap, api-catalog linkset, OpenAPI `servers`, the homepage
 * `Link` header). Derived from the incoming request so every environment is
 * correct with zero config; `PORTAL_ORIGIN` env is the backstop for
 * request-less callers (build steps, tests), and the public-safe placeholder
 * is the final default.
 *
 * Resolution works off the standard web `Request`, not the h3 `H3Event`
 * wrapper: Nitro's beta filesystem-route contract has shifted between releases
 * (some hand handlers an `H3Event`, others a bare `Request`), so `handlerRequest`
 * normalizes whatever a route receives into a `Request` and everything below
 * depends only on that stable shape.
 */

/** Last-resort placeholder when neither a request nor PORTAL_ORIGIN is set. */
export const DEFAULT_PORTAL_ORIGIN = "https://portal.example.com";

/**
 * Extract the web `Request` from whatever a Nitro route/middleware is handed —
 * a bare `Request` (current contract) or an `H3Event` whose `.req` is the
 * `Request` (older contract). Duck-typed, not `instanceof`, because srvx may
 * hand back a `Request` subclass. Returns `undefined` for request-less callers.
 */
export function handlerRequest(arg: unknown): Request | undefined {
  if (isRequestLike(arg)) return arg;
  const req = (arg as { req?: unknown } | null)?.req;
  if (isRequestLike(req)) return req;
  return undefined;
}

/**
 * `preferEnv` flips the precedence to env-first. Use it for spec-canonical
 * artifacts (robots `Sitemap:`, RFC 9728 `resource`, the MCP transport URL)
 * that must advertise a single stable identifier rather than reflect whatever
 * Host a crawler arrived on. Request-derivation remains the fallback so local
 * dev still works without `PORTAL_ORIGIN`.
 */
export function resolvePortalOrigin(request?: Request, options?: { preferEnv?: boolean }): string {
  const fromEnv = process.env.PORTAL_ORIGIN?.trim();
  if (options?.preferEnv && fromEnv) return stripTrailingSlash(fromEnv);
  const fromRequest = request ? originFromRequest(request) : undefined;
  if (fromRequest) return fromRequest;
  if (fromEnv) return stripTrailingSlash(fromEnv);
  return DEFAULT_PORTAL_ORIGIN;
}

/**
 * Trust `X-Forwarded-*` first (Atlas runs behind a load balancer that sets
 * them); fall back to the `Host` header, then to the parsed request URL.
 * Forwarded values may be comma-separated proxy chains — take the first hop.
 */
function originFromRequest(request: Request): string | undefined {
  const headers = request.headers;
  const host = firstHop(headers.get("x-forwarded-host")) ?? headers.get("host");
  if (host) {
    const proto =
      firstHop(headers.get("x-forwarded-proto")) ?? safeUrl(request.url)?.protocol.replace(":", "");
    return proto ? `${proto}://${host}` : undefined;
  }
  return safeUrl(request.url)?.origin || undefined;
}

function isRequestLike(value: unknown): value is Request {
  return (
    !!value &&
    typeof (value as Request).url === "string" &&
    typeof (value as Request).headers?.get === "function"
  );
}

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function firstHop(value: string | null): string | undefined {
  const first = value?.split(",")[0]?.trim();
  return first || undefined;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
