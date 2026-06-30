/**
 * Data-mode signal for the top-nav badge (plan 026 WU-B).
 *
 * Reports whether the dev runtime is serving deterministic MSW fixtures ('mock')
 * or hitting real source systems ('live'). The decision itself is the
 * `shouldMockData` predicate, evaluated ONCE by the dev-only MSW plugin
 * (`server/devMocks/start.ts`), which records the result in `DEV_DATA_MODE` —
 * one source of truth. The prod build never registers that plugin, so the marker
 * is absent and prod reports 'live' (the badge stays hidden — smoke asserts this).
 */
import { createServerFn } from "@tanstack/react-start";

export type DataMode = "mock" | "live";

export function resolveDataMode(): DataMode {
  // Hard prod gate: the MSW plugin only registers under `vite serve`, so prod can
  // never be serving mocks. Ignore any DEV_DATA_MODE that leaked into the prod
  // environment (copied env dump / baked image) so the badge can't lie.
  if (process.env.NODE_ENV === "production") return "live";
  return process.env.DEV_DATA_MODE === "mock" ? "mock" : "live";
}

export const getDataMode = createServerFn({ method: "GET" }).handler(
  (): DataMode => resolveDataMode(),
);
