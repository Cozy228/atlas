import { queryOptions } from "@tanstack/react-query";
import type {
  AvailabilityResponse,
  LandingZone,
  ResourceCatalogResponse,
  ResourceContextResponse,
  ResourceRecordResponse,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
} from "@atlas/schema";
import type { Announcement, Release } from "@atlas/context-layer";
import { LANDING_ZONES } from "@atlas/context-layer/landingZones";

import type { Guidance } from "@/lib/guidance";
import {
  fetchPortalAnnouncements,
  fetchPortalAvailability,
  fetchPortalGuidance,
  fetchPortalReleases,
  fetchPortalResourceCatalog,
  fetchPortalResourceContext,
  fetchPortalResourceRecord,
  fetchPortalSourceDiscovery,
} from "./portalContextApiClient";

export const releaseNotesQueryOptions = queryOptions<Release[]>({
  queryKey: ["release-notes"] as const,
  queryFn: ({ signal }) => fetchPortalReleases({ signal }),
  staleTime: 60_000,
});

export const announcementsQueryOptions = queryOptions<Announcement[]>({
  queryKey: ["announcements"] as const,
  queryFn: ({ signal }) => fetchPortalAnnouncements({ signal }),
  staleTime: 60_000,
});

export const guidanceQueryOptions = queryOptions<Guidance[]>({
  queryKey: ["guidance"] as const,
  queryFn: ({ signal }) => fetchPortalGuidance({ signal }),
  staleTime: Infinity,
});

export const availabilityQueryKey = ["availability"] as const;

export const availabilityQueryOptions = queryOptions<AvailabilityResponse>({
  queryKey: availabilityQueryKey,
  queryFn: ({ signal }) => fetchPortalAvailability({ signal }),
  staleTime: Infinity,
});

export const landingZonesQueryOptions = queryOptions<LandingZone[]>({
  queryKey: ["landing-zones"] as const,
  queryFn: async () => LANDING_ZONES.map((zone) => ({ ...zone })),
  // The LZ topology is config (dev=prod), effectively static within a session.
  staleTime: Infinity,
});

export const resourceCatalogQueryOptions = queryOptions<ResourceCatalogResponse>({
  queryKey: ["resource-catalog"] as const,
  queryFn: ({ signal }) => fetchPortalResourceCatalog({ signal }),
  staleTime: 60_000,
});

export function sourceDiscoveryQueryOptionsFor(request: SourceDiscoveryRequest = {}) {
  return queryOptions<SourceDiscoveryResponse>({
    queryKey: ["sources", request] as const,
    queryFn: ({ signal }) => fetchPortalSourceDiscovery(request, { signal }),
    staleTime: 60_000,
  });
}

export const sourceDiscoveryQueryOptions = sourceDiscoveryQueryOptionsFor();

export function resourceRecordQueryOptions(ref: { kind: string; slug: string }) {
  return queryOptions<ResourceRecordResponse>({
    queryKey: ["resource-record", ref] as const,
    queryFn: ({ signal }) => fetchPortalResourceRecord(ref, { signal }),
    // Durable presentation metadata (ADR-0015 §2) — long-lived like the topic read.
    staleTime: 5 * 60_000,
  });
}

export function resourceContextQueryOptions(ref: { kind: string; slug: string }) {
  return queryOptions<ResourceContextResponse>({
    queryKey: ["resource-context", ref] as const,
    queryFn: ({ signal }) => fetchPortalResourceContext(ref, { signal }),
    // Reference discovery is cached per Resource key on the server (plan 017 SWR);
    // a short client staleTime avoids re-fetching on intra-session re-nav.
    staleTime: 5 * 60_000,
  });
}
