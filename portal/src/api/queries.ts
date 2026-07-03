import { queryOptions } from "@tanstack/react-query";
import type {
  LandingZone,
  ResourceCatalogResponse,
  ResourceContextResponse,
  ResourceRecordResponse,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
} from "@atlas/schema";

import { fetchAvailability, type AvailabilityResponse } from "@/api/server/availability";
import {
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

export const landingZonesQueryOptions = queryOptions<LandingZone[]>({
  queryKey: ["landing-zones"] as const,
  queryFn: () => fetchLandingZones(),
  // The LZ topology is config (dev=prod), effectively static within a session.
  staleTime: Infinity,
});

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
