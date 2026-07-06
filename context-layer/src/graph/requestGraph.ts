/**
 * Request-time graph derivation (Step 4) — pins ONE graph version at brief entry
 * (I1) from the current source roots, so a template traverses a single consistent
 * substrate. This now reads the SAME shared snapshot store as the composition and
 * the lifecycle refresher (D3 projection inversion): a warm root serves with ZERO
 * crawls; a cold/stale root crawls once through the shared single-flight. One
 * failing root ages its own subgraph (acceptance B) — the brief still assembles
 * honest-empty over the roots that served.
 *
 * The content the executor later resolves is fetched through the SAME `ctx.fetch`
 * (the content cache underneath), so this parse shares that cache — no second
 * clock (M4).
 */
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import { createConfluenceAvailabilityProvider } from "../sourceContent/confluenceAvailabilityProvider";
import type { GraphVersion } from "@atlas/schema";
import { deriveGraph } from "./deriveGraph";
import { serveRootSnapshots } from "./serveSnapshots";

export async function deriveRequestGraph(ctx: GovernedResolutionContext): Promise<GraphVersion> {
  const env = readProcessEnv();
  const availabilityProvider = createConfluenceAvailabilityProvider({ fetch: ctx.fetch, env });
  const { snapshots } = await serveRootSnapshots({ ctx, availabilityProvider, env });
  return deriveGraph(snapshots);
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
