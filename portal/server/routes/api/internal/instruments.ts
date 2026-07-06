/**
 * The honesty-instruments dashboard JSON (Step 6, D6 / locked decision 8):
 * `GET /api/internal/instruments`. A specific filesystem route so it wins over the
 * `/api/[...]` Context-API catch-all (like `openapi.json.ts`); NOT advertised to
 * agents and NOT in the sitemap. Aggregate counts only — no identity. Pure
 * read-side: the since-boot registry snapshot + event-class volume + the
 * negotiation queue.
 */
import { handleInstrumentsRequest } from "@atlas/context-layer";
import { handlerRequest } from "@/api/server/portalOrigin";

export default async (event: unknown): Promise<Response> => {
  const request = handlerRequest(event);
  if (request && request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const result = await handleInstrumentsRequest(process.env);
  return Response.json(result.body, { status: result.status });
};
