/**
 * The citation-follow beacon (Step 6, D5 / locked decision 6):
 * `POST /api/internal/instruments/verify`. A shape-validated `{ moment, sourceId,
 * msSinceRender }` body increments the counter + observes the latency histogram +
 * logs, stores NOTHING durable, and returns 204. An invalid body is a 400. This is
 * the ONLY new write-shaped endpoint, and it writes only to the process registry +
 * the log — no identity, no cookie.
 */
import { handleVerifyBeacon } from "@atlas/context-layer";
import { handlerRequest } from "@/api/server/portalOrigin";

export default async (event: unknown): Promise<Response> => {
  const request = handlerRequest(event);
  if (!request || request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const result = handleVerifyBeacon(body);
  if (result.body) {
    return Response.json(result.body, { status: result.status });
  }
  return new Response(null, { status: result.status });
};
