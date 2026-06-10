/**
 * Serves the Context Layer's HTTP contract on the Portal origin at `/api/*`.
 * Same router the Lambda deployment dispatches; see `contextApiBridge.ts`.
 */
import type { H3Event } from "nitro";

import { bridgeContextApiRequest } from "@/api/server/contextApiBridge";

export default (event: H3Event): Promise<Response> => bridgeContextApiRequest(event.req);
