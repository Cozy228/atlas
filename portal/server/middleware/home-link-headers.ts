/**
 * Advertise the agent discovery surface (llms.txt, api-catalog, agent-skills,
 * mcp, sitemap) as `Link` headers on the homepage response.
 */
import { buildHomeLinkHeader } from "@/api/server/agentDiscovery";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

export default async (event: unknown, next: () => unknown): Promise<unknown> => {
  const result = await next();
  const request = handlerRequest(event);
  if (!request) return result;
  if (new URL(request.url).pathname === "/") {
    // The response surface differs by Nitro build: an `H3Event` exposes
    // `event.res.headers`, the fetch-style contract returns the `Response`.
    const eventRes = (event as { res?: { headers?: Headers } }).res?.headers;
    const headers = eventRes ?? (result as Response | undefined)?.headers;
    headers?.set("link", buildHomeLinkHeader(resolvePortalOrigin(request)));
  }
  return result;
};
