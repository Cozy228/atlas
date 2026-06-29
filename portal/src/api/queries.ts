import { queryOptions } from "@tanstack/react-query";
import type {
  LandingZone,
  ResourceContextResponse,
  ResourceRecordResponse,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
  TopicDiscoveryRequest,
  TopicDiscoveryResponse,
} from "@atlas/schema";

import { fetchAvailability, type AvailabilityResponse } from "@/api/server/availability";
import {
  fetchLandingZones,
  fetchResourceContext,
  fetchResourceRecord,
  fetchSourceDiscovery,
  fetchTopicDiscovery,
} from "@/api/server/contextApi";
import { fetchReleaseNotes, type Release } from "@/api/server/releaseNotes";
import { fetchAnnouncements, type Announcement } from "@/api/server/announcements";
import { fetchGuidance } from "@/api/server/guidance";
import type { Guidance } from "@/lib/guidance";

export const releaseNotesQueryOptions = queryOptions<Release[]>({
  queryKey: ["release-notes"] as const,
  queryFn: () => fetchReleaseNotes(),
  staleTime: 60_000,
});

export const announcementsQueryOptions = queryOptions<Announcement[]>({
  queryKey: ["announcements"] as const,
  queryFn: () => fetchAnnouncements(),
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

export function topicDiscoveryQueryOptionsFor(request: TopicDiscoveryRequest = {}) {
  return queryOptions<TopicDiscoveryResponse>({
    queryKey: ["topics", request] as const,
    queryFn: () => fetchTopicDiscovery({ data: request }),
    staleTime: 60_000,
  });
}

export const topicDiscoveryQueryOptions = topicDiscoveryQueryOptionsFor();

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
