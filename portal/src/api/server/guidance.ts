/**
 * Guidance data — server fn.
 *
 * Wraps the pure `loadGuidance` reader (`../../adapters/dev/loadGuidance`) in a `createServerFn`
 * so the portal app loads guidance like every other source (release notes,
 * registry) via `guidanceQueryOptions` -> route loaders. The reader lives in a
 * separate, react-start-free module so cross-package consumers can use it
 * without this server-fn runtime.
 */
import { createServerFn } from "@tanstack/react-start";
import type { Guidance } from "@/lib/guidance";
import { loadGuidance } from "@/lib/loadGuidance";

export const fetchGuidance = createServerFn({
  method: "GET",
  strict: { output: false },
}).handler(async (): Promise<Guidance[]> => loadGuidance());
