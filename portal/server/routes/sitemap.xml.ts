import { buildSitemapXml } from "@/api/server/agentDiscovery";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";
import { serverContextApiClient } from "@/api/server/serverContextApiClient";
import { loadGuidance } from "@/lib/loadGuidance";

export default async (event: unknown): Promise<Response> => {
  const [topics, sources] = await Promise.all([
    serverContextApiClient.discoverTopics(),
    serverContextApiClient.discoverSources(),
  ]);
  // Canonical resource ids are derived from the discovered catalog (plan 018 G5):
  // a service Topic's id IS its resource slug (`aws/<id>`), a security-policy
  // Topic's id is the guardrail slug → `{kind}/{slug}`.
  const resourceIds = topics.topics.map(
    (topic) => `${topic.topic_type === "service" ? "service" : "guardrail"}/${topic.id}`,
  );
  const xml = buildSitemapXml(
    {
      topics: topics.topics,
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
