import { buildSitemapXml } from "@/api/server/agentDiscovery";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";
import { serverContextApiClient } from "@/api/server/serverContextApiClient";
import { loadGuidance } from "@/lib/loadGuidance";

export default async (event: unknown): Promise<Response> => {
  const [catalog, sources] = await Promise.all([
    serverContextApiClient.discoverResources(),
    serverContextApiClient.discoverSources(),
  ]);
  // Canonical resource ids come straight off the discovered catalog records:
  // `{kind}/{slug}` (e.g. `service/aws/textract`, `guardrail/<slug>`).
  const resourceIds = catalog.resources.map((resource) => resource.id);
  const xml = buildSitemapXml(
    {
      sourceIds: sources.sources.map((source) => source.id),
      guidanceIds: (await loadGuidance()).map((guidance) => guidance.id),
      resourceIds,
    },
    resolvePortalOrigin(handlerRequest(event)),
  );
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
