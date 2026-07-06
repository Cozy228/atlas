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
 * A value fetch composes `allowlistedBase` + a path DERIVED from the location
 * (its id/kind), NEVER the registered `location.url`. The registered `url` is a
 * human link only — it never becomes a GET target, so a malicious registration
 * cannot steer Atlas at an arbitrary host.
 *
 * `Atlas never stores a team's secret` (M12): a `service-token` reads a
 * narrow-scoped env token at fetch time; a system needing team-owned credentials
 * is a fetch-access negotiation (Track B), not a vault feature.
 *
 * STEP 7 BATCH 0 STUB: bodies land in Batch 3 (locked decisions 2, 4).
 */
import type { OperationalLocation } from "@atlas/schema";
import type { FetchLike } from "../resolvers/resolverTypes";

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
 * Compose the value-fetch URL from the adapter's allowlisted base + a path
 * DERIVED from the location — the SSRF-closed-by-construction primitive. The
 * registered `location.url` is NEVER read here: a value fetch cannot be steered
 * at an arbitrary host by a registration.
 *
 * STEP 7 BATCH 0 STUB: body lands in Batch 3.
 */
export function composeValueUrl(_base: string, _location: OperationalLocation): string {
  throw new Error("unimplemented (Step 7 Batch 3)");
}

/**
 * Resolve the value-capable adapter for a `system`, or `undefined` when none is
 * registered (⇒ a labeled pointer, `reason: no-adapter`). The TFE `service-token`
 * adapter is the first entry (locked decision 4); further adapters plug in behind
 * this closed port as their fetch-access lands.
 *
 * STEP 7 BATCH 0 STUB: body lands in Batch 3.
 */
export function resolveStatusAdapter(
  _system: string,
  _env: Record<string, string | undefined>,
): StatusAdapter | undefined {
  throw new Error("unimplemented (Step 7 Batch 3)");
}
