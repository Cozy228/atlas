import { buildLlmsTxt } from "@/api/server/agentDiscovery";

export default (): Response =>
  new Response(buildLlmsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
