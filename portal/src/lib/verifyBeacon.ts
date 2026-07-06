/**
 * Citation-follow beacon client (Step 6, locked decision 6 — the P28
 * verification-tax instrument).
 *
 * When a human follows a brief citation to its source, the browser fires a small
 * `POST /api/internal/instruments/verify` with `{ moment, sourceId, msSinceRender }`
 * — client-computed, NO identity, NO cookie. The server records a counter + a
 * latency histogram and stores nothing durable. This is fire-and-forget: a failed
 * beacon must NEVER disrupt following the citation, so it never throws and never
 * blocks navigation.
 */
import type { Moment } from "@atlas/schema";

export const VERIFY_BEACON_PATH = "/api/internal/instruments/verify";

export type VerifyBeaconPayload = {
  moment: Moment;
  sourceId: string;
  /** Client-computed ms between the brief render and the citation follow. */
  msSinceRender: number;
};

type FetchLike = typeof globalThis.fetch;

/** The POST request parts for the beacon (pure — unit-testable without a DOM). */
export function verifyBeaconRequest(payload: VerifyBeaconPayload): {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
} {
  return {
    url: VERIFY_BEACON_PATH,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}

/**
 * Fire the citation-follow beacon, fire-and-forget. Swallows every error
 * (including a synchronous throw from a missing `fetch`) so a citation click is
 * never disrupted. `keepalive` lets the request survive the navigation it triggers.
 */
export function fireVerifyBeacon(
  payload: VerifyBeaconPayload,
  fetchImpl: FetchLike | undefined = globalThis.fetch,
): void {
  try {
    if (!fetchImpl) {
      return;
    }
    const request = verifyBeaconRequest(payload);
    void fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      keepalive: true,
    }).catch(() => {
      /* observation only — a failed beacon never disrupts the click */
    });
  } catch {
    /* never throw from the beacon */
  }
}
