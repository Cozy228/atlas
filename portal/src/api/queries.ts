import { queryOptions } from "@tanstack/react-query";
import type {
  AppListResponse,
  Brief,
  ChangesResponse,
  InstrumentsResponse,
  LandingZone,
  Moment,
  ResourceCatalogResponse,
  ResourceContextResponse,
  ResourceRecordResponse,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
} from "@atlas/schema";

import type { StatusBoardResponse } from "@atlas/schema";

import { fetchApps } from "@/api/server/apps";
import { fetchAvailability, type AvailabilityResponse } from "@/api/server/availability";
import { fetchStatusBoard } from "@/api/server/locations";
import {
  fetchBrief,
  fetchChanges,
  fetchInstruments,
  fetchLandingZones,
  fetchResourceCatalog,
  fetchResourceContext,
  fetchResourceRecord,
  fetchSourceDiscovery,
} from "@/api/server/contextApi";
import { fetchWhatsNew, type WhatsNewFeed } from "@/api/server/whatsNew";
import { fetchGuidance } from "@/api/server/guidance";
import type { Guidance } from "@/lib/guidance";

/**
 * One key for the whole What's New feed — releases + standalone announcements
 * both project off a single Confluence page resolve. Home and /whatsnew read the
 * same cache entry, so navigating between them never re-resolves the page.
 */
export const whatsNewQueryOptions = queryOptions<WhatsNewFeed>({
  queryKey: ["whats-new"] as const,
  queryFn: () => fetchWhatsNew(),
  staleTime: 60_000,
});

export const guidanceQueryOptions = queryOptions<Guidance[]>({
  queryKey: ["guidance"] as const,
  queryFn: () => fetchGuidance(),
  staleTime: Infinity,
});

export const availabilityQueryKey = ["availability"] as const;

export const availabilityQueryOptions = queryOptions<AvailabilityResponse>({
  queryKey: availabilityQueryKey,
  queryFn: () => fetchAvailability(),
  staleTime: Infinity,
});

/**
 * Scoped availability (Step 3 decision 8): when the situation carries a selected
 * APP, its landing-zone set is threaded to the server as by-value scope so the
 * *server* returns only the member zones — closing Step 1's decision-7 tail on
 * the live surface. No scope ⇒ the shared unscoped query (LZ-only, unchanged).
 */
export function availabilityQueryOptionsFor(landingZones?: string[]) {
  if (!landingZones?.length) {
    return availabilityQueryOptions;
  }
  const key = [...landingZones].sort().join(",");
  return queryOptions<AvailabilityResponse>({
    queryKey: ["availability", "scoped", key] as const,
    queryFn: () => fetchAvailability({ data: { landingZones } }),
    staleTime: Infinity,
  });
}

/**
 * The per-scope derived change feed (Step 2, M8 / P31). Keyed by the situation's
 * landing-zone scope so switching APP/LZ narrows the "my changes" surface. This
 * is the machine-derived feed — SEPARATE from the editorial What's New
 * (`whatsNewQueryOptions`), which stays a curated Confluence projection.
 */
export function changesQueryOptionsFor(landingZones?: string[]) {
  const key = landingZones?.length ? [...landingZones].sort().join(",") : "";
  return queryOptions<ChangesResponse>({
    queryKey: ["changes", key] as const,
    queryFn: () => fetchChanges({ data: key ? { landingZones } : undefined }),
    staleTime: 30_000,
  });
}

/**
 * The one serialized moment `Brief` (Step 4, I3/M9). Keyed by moment + the
 * situation's LZ scope + the adopt/build target service, so switching APP/LZ or
 * moment re-assembles the scoped Brief. The Portal human render asks the server
 * for `excerpts` depth (the section bodies); the same value backs the `.md` +
 * `/api/briefs/*` faces (face drift is structurally inexpressible, I3).
 */
export function briefQueryOptionsFor(
  moment: Moment,
  scope?: { landingZones?: string[]; service?: string },
) {
  const zonesKey = scope?.landingZones?.length ? [...scope.landingZones].sort().join(",") : "";
  const serviceKey = scope?.service ?? "";
  return queryOptions<Brief>({
    queryKey: ["brief", moment, zonesKey, serviceKey] as const,
    queryFn: () =>
      fetchBrief({
        data: {
          moment,
          ...(scope?.landingZones?.length ? { landingZones: scope.landingZones } : {}),
          ...(scope?.service ? { service: scope.service } : {}),
          depth: "excerpts",
        },
      }),
    staleTime: 30_000,
  });
}

/**
 * The honesty-instruments dashboard (Step 6, D6). Since-boot data, so a short
 * staleTime keeps the view live without hammering the read. Aggregate counts only.
 */
export const instrumentsQueryOptions = queryOptions<InstrumentsResponse>({
  queryKey: ["instruments"] as const,
  queryFn: () => fetchInstruments(),
  staleTime: 10_000,
});

export const landingZonesQueryOptions = queryOptions<LandingZone[]>({
  queryKey: ["landing-zones"] as const,
  queryFn: () => fetchLandingZones(),
  // The LZ topology is config (dev=prod), effectively static within a session.
  staleTime: Infinity,
});

/** Registered self-declared APPs (Step 3) — the situation selector's app list. */
export const appsQueryOptions = queryOptions<AppListResponse>({
  queryKey: ["apps"] as const,
  queryFn: () => fetchApps(),
  staleTime: 30_000,
});

/**
 * The status board for a selected APP (Step 7, P24). Aggregation-at-read: every
 * fetch recomputes the scope's registered locations' live values — no store, no
 * history. Keyed by `appId` so switching APP re-reads. A short staleTime keeps it
 * fresh on re-nav without hammering the live adapters; a registration invalidates
 * it explicitly. Enabled only when an APP is selected (a registration belongs to
 * an APP, so the board is meaningless without one).
 */
export function statusBoardQueryOptionsFor(appId: string) {
  return queryOptions<StatusBoardResponse>({
    queryKey: ["status-board", appId] as const,
    queryFn: () => fetchStatusBoard({ data: { appId } }),
    staleTime: 15_000,
  });
}

export const resourceCatalogQueryOptions = queryOptions<ResourceCatalogResponse>({
  queryKey: ["resource-catalog"] as const,
  queryFn: () => fetchResourceCatalog(),
  staleTime: 60_000,
});

export function sourceDiscoveryQueryOptionsFor(request: SourceDiscoveryRequest = {}) {
  return queryOptions<SourceDiscoveryResponse>({
    queryKey: ["sources", request] as const,
    queryFn: () => fetchSourceDiscovery({ data: request }),
    staleTime: 60_000,
  });
}

export const sourceDiscoveryQueryOptions = sourceDiscoveryQueryOptionsFor();

export function resourceRecordQueryOptions(ref: { kind: string; slug: string }) {
  return queryOptions<ResourceRecordResponse>({
    queryKey: ["resource-record", ref] as const,
    queryFn: () => fetchResourceRecord({ data: ref }),
    // Durable presentation metadata (ADR-0015 §2) — long-lived like the topic read.
    staleTime: 5 * 60_000,
  });
}

export function resourceContextQueryOptions(ref: { kind: string; slug: string }) {
  return queryOptions<ResourceContextResponse>({
    queryKey: ["resource-context", ref] as const,
    queryFn: () => fetchResourceContext({ data: ref }),
    // Reference discovery is cached per Resource key on the server (plan 017 SWR);
    // a short client staleTime avoids re-fetching on intra-session re-nav.
    staleTime: 5 * 60_000,
  });
}
