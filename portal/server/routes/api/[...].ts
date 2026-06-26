/**
 * Serves the Context Layer's HTTP contract on the Portal origin at `/api/*`.
 * Same router the Lambda deployment dispatches; see `contextApiBridge.ts`.
 */
import { bridgeContextApiRequest } from "@/api/server/contextApiBridge";
import { handlerRequest } from "@/api/server/portalOrigin";

export default (event: unknown): Promise<Response> => {
  const request = handlerRequest(event);
  if (!request) return Promise.resolve(new Response("Bad Request", { status: 400 }));
  return bridgeContextApiRequest(request);
};
