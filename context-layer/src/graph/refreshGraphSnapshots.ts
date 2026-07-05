/**
 * The discovery snapshot pass (Step 2, M2/M10) — the lifecycle-plane entry that
 * refreshes every source root's snapshot and derives change events inline at each
 * transition. Runs per-root through {@link serveRootSnapshot}: a fresh snapshot is
 * served without crawling; a stale/cold root crawls + transitions; a failed root
 * ages honestly (one aging note, zero phantom events).
 *
 * This is DERIVATION on the lifecycle plane (mid-level §4: a scheduled refresh
 * task, Optional at runtime), NOT the request hot path — so it never adds latency
 * to a resource/brief read and `createDefaultContextService` is unchanged. A
 * scheduler (or an explicit admin trigger) calls it; the first pass seeds each
 * root's baseline SILENTLY (no storm), and subsequent passes emit only confirmed,
 * damped deltas.
 *
 * ⚠️ SCOPED GAP (flagged for the reviewer): NO production caller exists yet — no
 * scheduler, admin route, or Nitro plugin invokes this pass, and composition.ts
 * still serves discovery from its in-process memo. Until the lifecycle trigger
 * and the composition rewire land, the live `/api/changes` feed stays empty
 * (dev renders via `changesMock`); the spine below is proven as library
 * behavior by `changeFeed.feature.test.ts`, not as wired system behavior.
 */
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { createConfluenceAvailabilityProvider } from "../sourceContent/confluenceAvailabilityProvider";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import { logger, serializeError } from "../observability/logging";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import { LANDING_ZONES } from "../landingZones";
import type { AgingNote } from "./graphTypes";
import { sharedSnapshotStore } from "./snapshotStoreFactory";
import { availabilityRootId, SECURITY_ROOT_ID, TERRAFORM_ROOT_ID } from "./rootIds";
import { parseAvailabilityRoot, parseSecurityRoot, parseTerraformRoot } from "./rootParsers";
import { serveRootSnapshot, type ServeRootSnapshotDeps } from "./snapshotTransition";

const log = logger("graph");

export type RefreshGraphSnapshotsOptions = {
  env?: Record<string, string | undefined>;
  /** Injectable spine (tests); defaults to the live Confluence availability provider. */
  availabilityProvider?: AvailabilityProvider;
  now?: () => Date;
};

export type RefreshGraphSnapshotsResult = {
  /** Total change events derived across every root this pass. */
  events: number;
  /** Aging notes for roots served last-good after a failed refresh (decision 8). */
  aging: AgingNote[];
};

function parseModuleMap(raw: string | undefined): Record<string, string[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const names = (Array.isArray(value) ? value : [value]).filter(
        (name): name is string => typeof name === "string" && name.length > 0,
      );
      if (names.length > 0) map[key] = names;
    }
    return map;
  } catch {
    return {};
  }
}

export async function refreshGraphSnapshots(
  options: RefreshGraphSnapshotsOptions = {},
): Promise<RefreshGraphSnapshotsResult> {
  const env = options.env ?? readProcessEnv();
  const ctx = await createResolutionContext({ env });
  const availabilityProvider =
    options.availabilityProvider ?? createConfluenceAvailabilityProvider({ fetch: ctx.fetch, env });
  const moduleMap = parseModuleMap(env.TERRAFORM_MODULE_MAP);

  const deps: ServeRootSnapshotDeps = {
    store: sharedSnapshotStore(env),
    events: sharedEventsRepository(env),
    now: options.now ?? (() => new Date()),
  };

  // One thunk per root; a root's own failure is isolated (one subgraph ages, the
  // others stay live — acceptance B).
  const roots: { id: string; crawl: () => Promise<import("./graphTypes").RootSnapshot> }[] = [
    ...LANDING_ZONES.map((zone) => ({
      id: availabilityRootId(zone.id),
      crawl: () =>
        parseAvailabilityRoot(zone.id, { ctx, availabilityProvider }).then((parse) => ({
          rootId: availabilityRootId(zone.id),
          parse,
          resolvedAt: deps.now().toISOString(),
          contractVersion: "availability-v1",
        })),
    })),
    {
      id: TERRAFORM_ROOT_ID,
      crawl: () =>
        parseTerraformRoot({
          ctx,
          availabilityProvider,
          terraform: {
            baseUrl: env.TERRAFORM_BASE_URL ?? "",
            token: env.TERRAFORM_TOKEN ?? "",
            org: env.TERRAFORM_ORG ?? "",
            moduleMap,
          },
        }).then((parse) => ({
          rootId: TERRAFORM_ROOT_ID,
          parse,
          resolvedAt: deps.now().toISOString(),
          contractVersion: "terraform-v1",
        })),
    },
    {
      id: SECURITY_ROOT_ID,
      crawl: () =>
        parseSecurityRoot({
          ctx,
          confluence: {
            baseUrl: env.CONFLUENCE_SECURITY_BASE_URL ?? env.CONFLUENCE_BASE_URL ?? "",
            token: env.CONFLUENCE_SECURITY_TOKEN ?? env.CONFLUENCE_TOKEN ?? "",
            email: env.CONFLUENCE_SECURITY_EMAIL ?? env.CONFLUENCE_EMAIL,
            spaceKey: env.CONFLUENCE_SECURITY_SPACE_KEY ?? "",
            rootPageId: env.CONFLUENCE_SECURITY_ROOT_PAGE_ID,
          },
        }).then((parse) => ({
          rootId: SECURITY_ROOT_ID,
          parse,
          resolvedAt: deps.now().toISOString(),
          contractVersion: "security-v1",
        })),
    },
  ];

  let events = 0;
  const aging: AgingNote[] = [];
  for (const root of roots) {
    try {
      const result = await serveRootSnapshot(root.id, root.crawl, deps);
      events += result.transition?.events.length ?? 0;
      if (result.aging) aging.push(result.aging);
    } catch (error) {
      // A cold root with no last-good and a failing crawl: honest dead subgraph,
      // logged and skipped — the other roots still refresh.
      log.warn(
        { rootId: root.id, err: serializeError(error) },
        `snapshot refresh failed: ${root.id}`,
      );
    }
  }

  log.info(
    { events, agingRoots: aging.map((a) => a.rootId) },
    `graph snapshot refresh: ${events} event(s)`,
  );
  return { events, aging };
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
