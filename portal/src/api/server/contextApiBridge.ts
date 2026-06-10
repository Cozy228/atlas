/**
 * HTTP bridge from the Portal origin to the Context Layer's HTTP contract.
 *
 * Agents (and the published `atlas-context-consumer` skill) consume the
 * Context API at `/api/*` on the Portal host. This bridge hands the raw
 * request to the same `handleHttpRequest` router the Lambda deployment uses,
 * so Portal, skills, and agents all consume one bundle contract. The caller's
 * Bearer token passes through unparsed (Bearer pipe, ADR 0001).
 */
import { handleHttpRequest } from "@atlas/context-layer";

export async function bridgeContextApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const response = await handleHttpRequest({
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(request.headers.entries()),
    body: request.body ? await request.text() : undefined,
  });
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
