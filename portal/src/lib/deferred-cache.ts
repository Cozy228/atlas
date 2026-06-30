import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * A promise React's `use()` / TanStack's `<Await>` can read SYNCHRONOUSLY — it
 * carries the resolved `status`/`value` React looks for, so a region backed by it
 * renders its content on the first paint instead of flashing its skeleton for a
 * tick. A plain `Promise.resolve(v)` lacks these and still suspends once.
 */
function settled<T>(value: T): Promise<T> {
  const p = Promise.resolve(value) as Promise<T> & { status: string; value: T };
  p.status = "fulfilled";
  p.value = value;
  return p;
}

/**
 * Defer a query's projection only on a cache MISS.
 *
 * - HIT (the query is already in the cache): returns a synchronously-readable
 *   settled promise of `map(data)`, so a revisit paints the real content
 *   immediately — no skeleton, no flash. This is what makes "first visit is slow,
 *   every revisit is instant" actually true with deferred regions.
 * - MISS: returns the live `ensureQueryData(...)` promise (mapped), so the region
 *   shows its skeleton while the genuinely-slow fetch runs.
 */
export function deferUnlessCached<TData, TOut>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  ensure: () => Promise<TData>,
  map: (data: TData) => TOut,
): Promise<TOut> {
  const cached = queryClient.getQueryData<TData>(queryKey);
  if (cached !== undefined) return settled(map(cached));
  return ensure().then(map);
}
