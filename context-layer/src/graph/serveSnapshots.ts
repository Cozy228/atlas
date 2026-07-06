/**
 * Serve-from-snapshot (Step-2 tail, D3) — the ONE read-path entry that turns the
 * three source roots into their current snapshots THROUGH the shared snapshot
 * store, instead of re-parsing per request. Both consumers use it: the
 * composition registry/resource projections and the Step-4 brief graph
 * (`deriveRequestGraph`). Together with the lifecycle-plane `refreshGraphSnapshots`
 * this leaves exactly ONE discovery path (the snapshot store).
 *
 * SWR gating (M2/M10, decision 8): a warm root serves from the store with ZERO
 * crawls; a cold/stale root crawls once and runs the CAS transition inline; a
 * failed crawl serves last-good + an aging note (one subgraph ages, the others
 * stay live). A module-level single-flight coalesces a cold burst so N concurrent
 * requests crawl a root ONCE — this is request coalescing, NOT a second cache or
 * a second clock (the snapshot store remains the only state).
 */
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import type { EventsRepository } from "../repositories/eventsRepository";
import type { AgingNote, RootSnapshot } from "./graphTypes";
import type { SnapshotStore } from "./snapshotStore";
import { sharedSnapshotStore, snapshotEnvHash } from "./snapshotStoreFactory";
import { buildRootDescriptors } from "./rootConfig";
import { serveRootSnapshot, type ServeRootSnapshotDeps } from "./snapshotTransition";

/** Module-level single-flight over the cold-start crawl: a cold burst for the
 *  same (env, root) shares ONE underlying parse. Cleared when the parse settles. */
const inFlightCrawls = new Map<string, Promise<RootSnapshot>>();

function coalesceCrawl(key: string, thunk: () => Promise<RootSnapshot>): Promise<RootSnapshot> {
  let pending = inFlightCrawls.get(key);
  if (!pending) {
    pending = thunk().finally(() => inFlightCrawls.delete(key));
    inFlightCrawls.set(key, pending);
  }
  return pending;
}

export type ServeRootSnapshotsParams = {
  ctx: GovernedResolutionContext;
  availabilityProvider: AvailabilityProvider;
  env: Record<string, string | undefined>;
  now?: () => Date;
  /** Override the store (tests / the injected-provider composition seam). */
  store?: SnapshotStore;
  /** Override the events repository (tests / the injected-provider seam). */
  events?: EventsRepository;
};

export type ServeRootSnapshotsResult = {
  /** The served snapshot per root (warm pending, just-crawled, or last-good). */
  snapshots: RootSnapshot[];
  /** Aging notes for roots served last-good after a failed refresh (decision 8). */
  aging: AgingNote[];
};

/**
 * Serve every source root's current snapshot through the shared store. A root
 * with no last-good and a failing crawl is skipped (honest-empty subgraph); the
 * others still serve, so one dead source never blanks the whole graph.
 */
export async function serveRootSnapshots(
  params: ServeRootSnapshotsParams,
): Promise<ServeRootSnapshotsResult> {
  const { ctx, availabilityProvider, env } = params;
  const now = params.now ?? (() => new Date());
  const deps: ServeRootSnapshotDeps = {
    store: params.store ?? (await sharedSnapshotStore(env)),
    events: params.events ?? sharedEventsRepository(env),
    now,
  };
  const envHash = snapshotEnvHash(env);
  const roots = buildRootDescriptors({ ctx, availabilityProvider, env });
  // The module-level single-flight is keyed on `envHash:rootId` only, so it must
  // NOT be shared across store identities: an injected store (the composition
  // seam that deliberately uses a fresh in-memory store + its own provider) would
  // otherwise coalesce onto an in-flight shared-path crawl from a DIFFERENT
  // availabilityProvider, masking the injected spine. When a store is injected we
  // bypass coalescing entirely and crawl directly.
  const useCoalesce = params.store === undefined;

  const served = await Promise.all(
    roots.map(async (root) => {
      const doCrawl = (): Promise<RootSnapshot> =>
        root.parse().then((parse) => ({
          rootId: root.rootId,
          parse,
          resolvedAt: now().toISOString(),
          contractVersion: root.contractVersion,
        }));
      const crawl = (): Promise<RootSnapshot> =>
        useCoalesce ? coalesceCrawl(`${envHash}:${root.rootId}`, doCrawl) : doCrawl();
      try {
        const result = await serveRootSnapshot(root.rootId, crawl, deps);
        return { snapshot: result.snapshot, aging: result.aging };
      } catch {
        // A cold root with no last-good and a failing crawl: honest dead subgraph
        // — skipped, the other roots still serve (acceptance B). The failure is
        // logged inside the parser/transition layer.
        return { snapshot: undefined, aging: undefined };
      }
    }),
  );

  const snapshots: RootSnapshot[] = [];
  const aging: AgingNote[] = [];
  for (const entry of served) {
    if (entry.snapshot) {
      snapshots.push(entry.snapshot);
    }
    if (entry.aging) {
      aging.push(entry.aging);
    }
  }
  return { snapshots, aging };
}
