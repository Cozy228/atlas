/**
 * Advertise the agent discovery surface (llms.txt, api-catalog, agent-skills,
 * mcp, sitemap) as `Link` headers on the homepage response.
 */
import type { H3Event } from "nitro";

import { buildHomeLinkHeader } from "@/api/server/agentDiscovery";
import { resolvePortalOrigin } from "@/api/server/portalOrigin";

export default async (event: H3Event, next: () => unknown): Promise<unknown> => {
  const result = await next();
  if (event.url.pathname === "/") {
    event.res.headers.set("link", buildHomeLinkHeader(resolvePortalOrigin(event)));
  }
  return result;
};
