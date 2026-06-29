/**
 * Data-mode signal for the top-nav badge (plan 026 WU-B).
 *
 * Reports whether the dev runtime is serving deterministic MSW fixtures ('mock')
 * or hitting real source systems ('live'), from the SAME `shouldMockData`
 * predicate that gates the MSW boot (`server/devMocks/start.ts`) — one source of
 * truth. MSW only ever boots in the dev runtime (`vite serve`); the prod build
 * never registers the plugin, so the prod bundle always reports 'live' and the
 * badge is absent (the smoke layer asserts this).
 */
import { createServerFn } from "@tanstack/react-start";

import { shouldMockData } from "../../../server/devMocks/shouldMock";

export type DataMode = "mock" | "live";

export function resolveDataMode(): DataMode {
  // import.meta.env.DEV is statically `false` in the prod bundle, so the mock
  // predicate is only ever consulted in the dev runtime where MSW can boot.
  if (!import.meta.env.DEV) return "live";
  return shouldMockData() ? "mock" : "live";
}

export const getDataMode = createServerFn({ method: "GET", strict: { output: false } }).handler(
  (): DataMode => resolveDataMode(),
);
