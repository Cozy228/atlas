/**
 * The status board (Step 7, P24) — AGGREGATION-AT-READ of live operational values
 * for a scope's registered locations. For each location:
 *
 *   resolve the owning system's adapter (M12):
 *     value fetched  → a `LocationStatusEntry` with the uncited `value` + `fetchedAt`;
 *     no adapter / authMode `none` / fetch fails → a labeled pointer
 *       (`value: null` + a `reason`) — the honest floor, never a fabricated value.
 *
 * Hard lines (ADR-0003 + P24):
 *   - a value is uncited operational status — NEVER Evidence, NEVER stored;
 *   - NO durable store, NO history, NO alerting — the board is recomputed every
 *     read (this function performs ZERO writes — the D7 spy proves it);
 *   - value fetch goes ONLY through the adapter's allowlisted base (SSRF closed).
 *
 * Pure-ish: `assembleStatusBoard` takes the already-loaded `registrations` + the
 * injected `adapters` (the test seam) + the read context, and returns the board —
 * it never touches a repository, so no status value can reach any store.
 */
import type {
  LocationRecord,
  LocationStatusEntry,
  OperationalLocation,
  Situation,
  StatusBoardResponse,
} from "@atlas/schema";
import type { StatusAdapter, StatusAdapterContext } from "../locations/statusAdapter";

export type StatusBoardDeps = {
  /** The scope echo carried on the response. */
  situation: Situation;
  /** The scope's registered locations (already loaded — the board never queries). */
  registrations: LocationRecord[];
  /** Value-capable adapters, keyed by `adapter.system` (the injection seam). A
   *  system with no matching adapter degrades to a labeled pointer. */
  adapters: StatusAdapter[];
  /** The read context each value fetch runs in (fetch + caller token + env). */
  adapterContext: StatusAdapterContext;
};

/**
 * Project a stored `LocationRecord` (consumer state — carries `appId`/`registeredAt`)
 * down to the `OperationalLocation` pointer shape the board renders. The board never
 * echoes the storage clock or scope key; only the pointer's public identity travels.
 */
function toPointer(record: LocationRecord): OperationalLocation {
  return {
    id: record.id,
    system: record.system,
    kind: record.kind,
    url: record.url,
    discoveredFrom: record.discoveredFrom,
  };
}

/**
 * Resolve ONE location to its status entry (P24 aggregation-at-read). The honest
 * floor is always one of the closed reasons, never a fabricated value:
 *   - no adapter for the system            → `no-adapter`
 *   - adapter authMode `none`              → `no-value-channel` (never fetches)
 *   - fetch throws / returns null          → `fetch-failed`
 *   - fetch returns a value                → uncited `value` + `fetchedAt` (read moment)
 *
 * Fault isolation: a throwing adapter degrades ONLY this entry; the catch keeps one
 * bad system from poisoning the rest of the board.
 */
async function resolveEntry(
  record: LocationRecord,
  adapters: StatusAdapter[],
  ctx: StatusAdapterContext,
): Promise<LocationStatusEntry> {
  const location = toPointer(record);
  const adapter = adapters.find((a) => a.system === record.system);

  if (!adapter) {
    return { location, value: null, reason: "no-adapter", fetchedAt: null };
  }
  if (adapter.authMode === "none") {
    return { location, value: null, reason: "no-value-channel", fetchedAt: null };
  }

  try {
    const value = await adapter.fetchValue(location, ctx);
    if (value === null) {
      return { location, value: null, reason: "fetch-failed", fetchedAt: null };
    }
    return { location, value, fetchedAt: new Date().toISOString() };
  } catch {
    // An adapter throwing is the same honest floor as a null fetch — never a lie.
    return { location, value: null, reason: "fetch-failed", fetchedAt: null };
  }
}

/**
 * Assemble the status board: PURE aggregation over the injected inputs. Registrations
 * and adapters are handed in already loaded — this function performs NO repository
 * access, NO caching, NO persistence (P24 — recomputed at read, every time; the D7
 * spy proves ZERO store writes). Value fetches run concurrently, per-location fault
 * isolated; one entry per registered location, in registration order.
 */
export async function assembleStatusBoard(deps: StatusBoardDeps): Promise<StatusBoardResponse> {
  const { situation, registrations, adapters, adapterContext } = deps;
  const statuses = await Promise.all(
    registrations.map((record) => resolveEntry(record, adapters, adapterContext)),
  );
  return { situation, statuses, warnings: [] };
}
