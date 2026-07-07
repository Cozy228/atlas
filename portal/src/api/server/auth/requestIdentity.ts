import { getRequestHeader } from "@tanstack/react-start/server";
import {
  logger,
  mockRegistryAppsAdapter,
  principalOf,
  type AppDirectoryPort,
  type IdentityClaims,
} from "@atlas/context-layer";
import type { AppRecord } from "@atlas/schema";

import { loadAuthContext, resolveBrowserClaims } from "./authContext";
import { resolveDataMode } from "../dataMode";

/**
 * Request-bound browser identity helpers (WS2). The browser surface derives identity from
 * the session COOKIE ONLY (confused-deputy R7) — never a Bearer.
 *
 * Two identity postures, disjoint by the three-state dev-mock seam (`resolveDataMode()`):
 *  - **mocks off** (real Entra or fully anonymous): identity is the BFF session's
 *    cookie-derived claims. When Entra is unset every helper is inert (empty/undefined), so
 *    the Portal behaves exactly as before this slice (anonymous, app Sources fail-closed).
 *  - **mocks on** (`DEV_MOCKS`, Seam B / R20): a mock signed-in identity is returned as a
 *    resolved outcome — no HTTP, no session store — so the verified badge / selector union /
 *    gate-open path is demoable locally with ZERO tenant. Real Entra configured ⇒ Seam B is
 *    inert (session claims win).
 *
 * The mock `registryAppsAdapter` (and its `origin:"registry"` records) is reachable ONLY
 * through this seam: `membershipDirectory()` / `verifiedRegistryApps()` return it under
 * mocks, and nothing otherwise (R8 / ADR-0004 — never selected under a production env
 * configuration; the real registry adapter is company-side injected).
 */

/**
 * Seam-B mock signed-in identity (R20). Fictional, public-safe claims whose app-role values
 * map to the mock registry adapter's fixtures (Orion + Lyra) — so under `DEV_MOCKS` the
 * selector union carries the fictional VERIFIED registry apps and the gate can open locally.
 */
const MOCK_SEAM_B_CLAIMS: IdentityClaims = {
  subject: "mock-entra-user",
  name: "Mock Entra User",
  roles: ["app.orion.member", "app.lyra.member"],
  issuer: "https://mock-issuer.example/v2.0",
  audience: "api://atlas-context",
};

export async function requestBrowserClaims(): Promise<IdentityClaims | undefined> {
  const auth = await loadAuthContext();
  // Seam B (R20): no-creds DEV_MOCKS runs a mock signed-in identity as a resolved outcome.
  // Gated so it can NEVER fire under real Entra (auth present) or with mocks off.
  if (!auth && resolveDataMode() === "mock") {
    return MOCK_SEAM_B_CLAIMS;
  }
  if (!auth) {
    return undefined;
  }
  let cookie: string | undefined;
  try {
    cookie = getRequestHeader("cookie");
  } catch {
    return undefined;
  }
  if (!cookie) {
    return undefined;
  }
  return resolveBrowserClaims(cookie, auth);
}

/**
 * The membership/scope directory for a verified browser session. Gated behind the three-state
 * dev-mock seam: mocks active ⇒ the MOCK registry adapter; mocks off ⇒ `undefined` (no
 * membership directory, so the factory default self-declared adapter resolves NO membership ⇒
 * app Sources fail-closed = honest). The real Entra-backed registry adapter is company-side.
 */
export function membershipDirectory(): AppDirectoryPort | undefined {
  return resolveDataMode() === "mock" ? mockRegistryAppsAdapter : undefined;
}

/**
 * The caller's VERIFIED registry APPs (`membershipSource:"entra"`), for the selector union
 * (claims-derived ∪ self-declared, E7). Empty when unauthenticated OR when mocks are off (the
 * mock adapter is unreachable in a production posture, R8) — the real registry adapter that
 * would populate this is company-side injected.
 */
export async function verifiedRegistryApps(
  claims: IdentityClaims | undefined,
): Promise<AppRecord[]> {
  if (!claims || resolveDataMode() !== "mock") {
    return [];
  }
  return (await mockRegistryAppsAdapter.resolveMembership?.(claims)) ?? [];
}

/**
 * Consumer-state attribution logging (I2 locked invariant): the principal is emitted
 * SEPARATELY to consumer-state handlers (apps-mutation logging, feedback) — it never rides the
 * resolver `ctx`, the response payload, or the store. The caller resolves the browser session
 * claims (via {@link requestBrowserClaims}); this narrows them to the {@link principalOf}
 * principal and writes ONE structured info line naming the mutation (`action` + `targetId` +
 * `subject`/`name`). Anonymous ⇒ silent (no principal to attribute).
 */
export function logMutationAttribution(
  action: string,
  targetId: string,
  claims: IdentityClaims | undefined,
): void {
  if (!claims) {
    return;
  }
  const principal = principalOf(claims);
  logger("consumer-state").info(
    {
      action,
      targetId,
      subject: principal.subject,
      ...(principal.name ? { name: principal.name } : {}),
    },
    `${action} ${targetId} by ${principal.name ?? principal.subject}`,
  );
}
