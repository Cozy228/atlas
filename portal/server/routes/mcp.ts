/**
 * Read-only MCP facade on the Portal origin. See `src/api/server/mcp/`.
 */
import type { H3Event } from "nitro";

import { handleMcpRequest } from "@/api/server/mcp/handler";

export default (event: H3Event): Promise<Response> => handleMcpRequest(event.req);
