/**
 * Dev-only latency shim.
 *
 * In the real adapters several projections are live fetches (Confluence pages,
 * the resolver's per-anchor fetch + parse). The public-safe mocks in this repo
 * return instantly, which hides the deferred + skeleton UX. `withDevLatency`
 * wraps a value in a promise that resolves after a fixed delay IN DEV ONLY so
 * those skeletons are visible/testable; in prod builds it resolves immediately.
 *
 * Use it in loaders to defer data the mock has synchronously (e.g. a detail
 * page's right-rail record/metadata) so it matches the slow live-fetch shape.
 * Accepts a plain value or a promise (e.g. an `ensureQueryData(...)` call), so a
 * fast-mock query can be made to look slow without touching the query itself.
 */
export const DEV_LATENCY_MS = 2000;

export function withDevLatency<T>(value: T | Promise<T>): Promise<T> {
  if (import.meta.env.DEV) {
    return Promise.resolve(value).then(
      (resolved) => new Promise((resolve) => setTimeout(() => resolve(resolved), DEV_LATENCY_MS)),
    );
  }
  return Promise.resolve(value);
}
