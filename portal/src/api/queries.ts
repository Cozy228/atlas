import { queryOptions } from "@tanstack/react-query";
import type {
  ContextRequest,
  ContextBundleResponse,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
  TopicDiscoveryRequest,
  TopicDiscoveryResponse,
} from "@atlas/schema";

import { fetchAvailability, type AvailabilityResponse } from "@/api/server/availability";
import {
  fetchContextBundle,
  fetchSourceDiscovery,
  fetchTopicDiscovery,
} from "@/api/server/contextApi";

export const availabilityQueryKey = ["availability"] as const;

export const availabilityQueryOptions = queryOptions<AvailabilityResponse>({
  queryKey: availabilityQueryKey,
  queryFn: () => fetchAvailability(),
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

export function contextBundleQueryOptions(request: ContextRequest) {
  return queryOptions<ContextBundleResponse>({
    queryKey: ["context-bundle", request] as const,
    queryFn: () => fetchContextBundle({ data: request }),
  });
}
