/**
 * Adapter `authMode` model (Step 7, M12) — the closed set + the allowlisted base
 * that makes SSRF CLOSED BY CONSTRUCTION, not by filter. Each value-capable
 * system adapter declares:
 *
 *   - `authMode ∈ caller-bearer | service-token | none`:
 *       caller-bearer → thread the caller's `ctx.token` (Confluence class);
 *       service-token → a narrow-scoped read-only env token (TFE class);
 *       none          → no value channel (the location stays a labeled pointer).
 *   - an `allowlistedBase`: the ONLY origin a value fetch is composed against.
 *
 * A value fetch composes `allowlistedBase` + path segments the adapter DERIVES
 * from the location. The fetch ORIGIN is always the allowlisted base and every
 * segment is hardened to `[A-Za-z0-9_-]`, so a malicious registration can never
 * steer Atlas at an arbitrary host — SSRF is closed by construction, not by
 * blocklist. Which part of the registration a segment is derived from (a workspace
 * name parsed out of the human `url`, a `kind`, …) is the owning adapter's call;
 * `composeValueUrl` only guarantees the join can never leave the base origin.
 *
 * `Atlas never stores a team's secret` (M12): a `service-token` reads a
 * narrow-scoped env token at fetch time; a system needing team-owned credentials
 * is a fetch-access negotiation (Track B), not a vault feature.
 */
import type { OperationalLocation } from "@atlas/schema";
import type { FetchLike } from "../resolvers/resolverTypes";
import { createTfeStatusAdapter, TFE_ADAPTER_SYSTEM } from "./tfeStatusAdapter";

export const adapterAuthModes = ["caller-bearer", "service-token", "none"] as const;
export type AdapterAuthMode = (typeof adapterAuthModes)[number];

/** The read context a value fetch runs in: the shared late-bound fetch, the
 *  caller Bearer (threaded only by `caller-bearer` adapters), and the env
 *  (where a `service-token` adapter reads its narrow-scoped token). */
export type StatusAdapterContext = {
  fetch: FetchLike;
  token?: string;
  env: Record<string, string | undefined>;
};

/**
 * A value-capable system adapter (M12). `fetchValue` returns the live operational
 * status for a location, or `null` to degrade to a labeled pointer (missing
 * token, `authMode: none`, or a failed/again-null fetch — never a fabricated
 * value). It fetches ONLY through `allowlistedBase` (see `composeValueUrl`).
 */
export type StatusAdapter = {
  system: string;
  authMode: AdapterAuthMode;
  allowlistedBase: string;
  fetchValue(location: OperationalLocation, ctx: StatusAdapterContext): Promise<string | null>;
};

/**
 * The SSRF-closed-by-construction primitive: join the adapter's allowlisted base
 * with caller-supplied path `segments`. Each segment is hardened down to a
 * conservative allowlist (`[A-Za-z0-9_-]`) and empty segments are dropped, so
 * `..`, `/`, `//`, `@`, `:`, `?`, whitespace and percent-encodings all fall out —
 * the composed URL can never leave the allowlisted base origin regardless of what
 * a malicious registration feeds into a segment. The adapter owns WHAT the segments
 * are (e.g. a workspace name parsed from the registered `url`); this function only
 * guarantees WHERE the result can point.
 */
export function composeValueUrl(base: string, ...segments: string[]): string {
  // Trim trailing slashes so the base is a clean origin/prefix to append onto.
  const origin = base.replace(/\/+$/, "");
  const path = segments
    .map((segment) => segment.replace(/[^A-Za-z0-9_-]/g, ""))
    .filter((segment) => segment.length > 0)
    .join("/");
  return `${origin}/${path}`;
}

/**
 * Resolve the value-capable adapters for a scope's distinct systems (M12), one per
 * system, dropping systems with no adapter (they degrade to a labeled pointer
 * inside the board, `reason: no-adapter`). Shared by the status route and the
 * debug floor so both walk the SAME adapter resolution.
 */
export function resolveScopeAdapters(
  systems: readonly string[],
  env: Record<string, string | undefined>,
): StatusAdapter[] {
  return [...new Set(systems)]
    .map((system) => resolveStatusAdapter(system, env))
    .filter((adapter): adapter is StatusAdapter => adapter !== undefined);
}

/**
 * Resolve the value-capable adapter for a `system`, or `undefined` when none is
 * registered (⇒ a labeled pointer, `reason: no-adapter`). The TFE `service-token`
 * adapter is the first entry (locked decision 4); further adapters plug in behind
 * this closed port as their fetch-access lands.
 *
 */
export function resolveStatusAdapter(
  system: string,
  env: Record<string, string | undefined>,
): StatusAdapter | undefined {
  if (system === TFE_ADAPTER_SYSTEM) {
    return createTfeStatusAdapter(env);
  }
  return undefined;
}
