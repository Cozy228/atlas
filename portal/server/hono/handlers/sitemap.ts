import { buildSitemapXml } from "@/api/server/agentDiscovery";
import { resolvePortalOrigin } from "@/api/server/portalOrigin";
import { serverContextApiClient } from "@/api/server/serverContextApiClient";
import { loadGuidance } from "@/lib/loadGuidance";

export async function handleSitemap(request: Request): Promise<Response> {
  const [catalog, sources] = await Promise.all([
    serverContextApiClient.discoverResources(),
    serverContextApiClient.discoverSources(),
  ]);
  const xml = buildSitemapXml(
    {
      sourceIds: sources.sources.map((source) => source.id),
      guidanceIds: (await loadGuidance()).map((guidance) => guidance.id),
      resourceIds: catalog.resources.map((resource) => resource.id),
    },
    resolvePortalOrigin(request),
  );

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
