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
  return process.env.DEV_DATA_MODE === "mock" ? "mock" : "live";
}

export const getDataMode = createServerFn({ method: "GET", strict: { output: false } }).handler(
  (): DataMode => resolveDataMode(),
);
