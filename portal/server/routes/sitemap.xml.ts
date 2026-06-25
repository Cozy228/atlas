import type { H3Event } from "nitro";

import { buildSitemapXml } from "@/api/server/agentDiscovery";
import { resolvePortalOrigin } from "@/api/server/portalOrigin";
import { serverContextApiClient } from "@/api/server/serverContextApiClient";
import { loadGuidance } from "@/api/server/loadGuidance";

export default async (event: H3Event): Promise<Response> => {
  const [topics, sources] = await Promise.all([
    serverContextApiClient.discoverTopics(),
    serverContextApiClient.discoverSources(),
  ]);
  const xml = buildSitemapXml(
    {
      topicIds: topics.topics.map((topic) => topic.id),
      sourceIds: sources.sources.map((source) => source.id),
      guidanceIds: loadGuidance().map((guidance) => guidance.id),
    },
    resolvePortalOrigin(event),
  );
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
