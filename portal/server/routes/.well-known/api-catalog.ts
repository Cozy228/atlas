import { buildApiCatalog } from "@/api/server/agentDiscovery";

export default (): Response =>
  Response.json(buildApiCatalog(), {
    headers: { "content-type": "application/linkset+json" },
  });
