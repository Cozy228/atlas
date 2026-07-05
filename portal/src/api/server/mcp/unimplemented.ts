/**
 * Batch-0 stub helper (Step 5). The four moment/bootstrap tool `run` handlers
 * throw through this until their batch lands the behavior, so the frozen D1–D6
 * MCP suite is red for BEHAVIORAL reasons only (an unimplemented throw surfaced
 * as an `isError` tool result), never for import/type errors.
 *
 * Convention inherited from Step 2/3/4 Batch 0: a tiny local helper that is
 * deleted once every caller is implemented (nothing outside this MCP module
 * imports it).
 */
export function unimplemented(name: string): never {
  throw new Error(`Not implemented yet: ${name} (Step 5 Batch 0 signature).`);
}
