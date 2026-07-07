import type { ApiErrorResponse, Situation, StatusBoardResponse } from "@atlas/schema";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import { sharedLocationsRepository } from "../repositories/locationsRepositoryFactory";
import { assembleStatusBoard } from "../status/statusBoard";
import { resolveScopeAdapters, type StatusAdapterContext } from "../locations/statusAdapter";
import type { ApiResponse } from "./routeTypes";

/**
 * The status board route (Step 7, P24; locked decision 8) — governed + scoped via
 * `ctx`, a scope reader like availability/changes:
 *
 *   GET /api/status?appId=   (fallback landingZones) → 200 `StatusBoardResponse`
 *
 * Filters to the scope's registered locations (the APP's self-service pointers),
 * resolves the owning system's adapter per distinct system (M12), and
 * live-fetches each value through the adapter's allowlisted base — threading
 * `ctx.token` (the caller-bearer class) + the house `FetchLike` + the process env
 * into the read context. Values render READ-ONLY, UNCITED, visually-separable
 * from Evidence (ADR-0003). A fetch failure / `none` authMode / missing adapter
 * degrades to a labeled pointer (locked decision 5). NO durable store, NO history,
 * NO alerting: `assembleStatusBoard` takes the loaded registrations + adapters and
 * performs ZERO writes — a status value never reaches any store (D7).
 */
export async function handleStatusRequest(
  ctx: GovernedResolutionContext,
): Promise<ApiResponse<ApiErrorResponse | StatusBoardResponse>> {
  const env = readProcessEnv();
  const situation = situationFromContext(ctx);

  // The board is over the scope's REGISTERED locations. A registration belongs to
  // an APP, so only a by-reference (or reconciled) scope yields any; a bare
  // landing-zone scope has no registrations and honestly returns an empty board.
  const appId = ctx.scope?.appId;
  const registrations = appId ? await sharedLocationsRepository(env).listByApp(appId) : [];

  // One adapter per DISTINCT system (M12): resolve each owning system once from
  // the process env, dropping systems with no value-capable adapter (they degrade
  // to a labeled pointer inside the board, `reason: no-adapter`).
  const adapters = resolveScopeAdapters(
    registrations.map((record) => record.system),
    env,
  );

  // The read context each value fetch runs in: the house fetch (content cache
  // underneath), the caller Bearer threaded for `caller-bearer` adapters, and the
  // env where a `service-token` adapter reads its narrow-scoped read-only token.
  const adapterContext: StatusAdapterContext = { fetch: ctx.fetch, token: ctx.token, env };

  const board = await assembleStatusBoard({ situation, registrations, adapters, adapterContext });
  return { status: 200, body: board };
}

/** Build the scope echo from the governed scope (I2/P30): the vetted LZ set + its
 *  provenance. An unscoped ctx yields an empty LZ set with the by-value default. */
function situationFromContext(ctx: GovernedResolutionContext): Situation {
  return {
    landingZoneIds: ctx.scope?.landingZoneIds ?? [],
    origin: ctx.scope?.origin ?? "by-value",
    ...(ctx.scope?.appId ? { appId: ctx.scope.appId } : {}),
  };
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
