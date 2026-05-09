import { queryOptions } from "@tanstack/react-query";
import type { SourceDiscoveryResponse, TopicDiscoveryResponse } from "@atlas/schema";

import { fetchAvailability, type AvailabilityResponse } from "@/api/server/availability";
import { fetchSourceDiscovery, fetchTopicDiscovery } from "@/api/server/contextApi";

export const availabilityQueryKey = ["availability"] as const;

export const availabilityQueryOptions = queryOptions<AvailabilityResponse>({
  queryKey: availabilityQueryKey,
  queryFn: () => fetchAvailability(),
});

export const topicDiscoveryQueryOptions = queryOptions<TopicDiscoveryResponse>({
  queryKey: ["topics"],
  queryFn: () => fetchTopicDiscovery(),
  staleTime: 60_000,
});

export const sourceDiscoveryQueryOptions = queryOptions<SourceDiscoveryResponse>({
  queryKey: ["sources"],
  queryFn: () => fetchSourceDiscovery(),
  staleTime: 60_000,
});
