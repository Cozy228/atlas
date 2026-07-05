/**
 * Request-time graph derivation (Step 4) — pins ONE graph version at brief entry
 * (I1) from the current source roots, so a template traverses a single consistent
 * substrate. This is the READ counterpart to the lifecycle-plane
 * `refreshGraphSnapshots` (which also derives change events + persists snapshots):
 * here we only parse each root through the governed `ctx` (dev MSW / prod real)
 * and `deriveGraph`, adding NO cache and NO event derivation. Each root's parse is
 * isolated — one failing root ages its own subgraph (acceptance B), never the
 * whole graph — so a brief still assembles (honest-empty) when a source is down.
 *
 * The content the executor later resolves is fetched through the SAME `ctx.fetch`
 * (the content cache underneath), so this parse shares that cache — no second
 * clock (M4).
 */
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import { createConfluenceAvailabilityProvider } from "../sourceContent/confluenceAvailabilityProvider";
import { logger, serializeError } from "../observability/logging";
import type { GraphVersion } from "@atlas/schema";
import type { RootSnapshot } from "./graphTypes";
import { deriveGraph } from "./deriveGraph";
import { buildRootDescriptors } from "./rootConfig";

const log = logger("graph");

export async function deriveRequestGraph(ctx: GovernedResolutionContext): Promise<GraphVersion> {
  const env = readProcessEnv();
  const availabilityProvider = createConfluenceAvailabilityProvider({ fetch: ctx.fetch, env });
  const now = new Date().toISOString();

  const roots = buildRootDescriptors({ ctx, availabilityProvider, env });

  const snapshots: RootSnapshot[] = [];
  for (const root of roots) {
    try {
      snapshots.push({
        rootId: root.rootId,
        parse: await root.parse(),
        resolvedAt: now,
        contractVersion: root.contractVersion,
      });
    } catch (error) {
      // One root's failure ages exactly one subgraph — the brief still assembles
      // honest-empty over the roots that parsed (acceptance B).
      log.warn(
        { rootId: root.rootId, err: serializeError(error) },
        `request graph: root '${root.rootId}' failed to parse — skipped`,
      );
    }
  }

  return deriveGraph(snapshots);
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
