import { queryOptions } from "@tanstack/react-query";

import {
  fetchAvailability,
  type AvailabilityResponse,
} from "@/api/server/availability";

export const availabilityQueryKey = ["availability"] as const;

export const availabilityQueryOptions = queryOptions<AvailabilityResponse>({
  queryKey: availabilityQueryKey,
  queryFn: () => fetchAvailability(),
});
