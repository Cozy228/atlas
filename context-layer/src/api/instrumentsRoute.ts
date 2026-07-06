/**
 * The honesty-instruments read surface (Step 6, locked decisions 6 + 8).
 *
 * `GET /api/internal/instruments` returns the since-boot metrics registry
 * snapshot + change-feed volume by class (derived at read from the durable events
 * store — the append-only truth, locked decision 7) + the negotiation queue
 * (unresolved/warned block counts grouped by warning code × subject, sorted desc —
 * "which source do we negotiate next", P16/P22). Pure read-side: it stores nothing.
 *
 * `POST /api/internal/instruments/verify` is the citation-follow beacon (P28
 * verification tax): a shape-validated body increments the counter + observes the
 * latency histogram + logs, stores NOTHING durable, and returns 204. An invalid
 * body is a 400. Observation only — never a durable write.
 */
import {
  eventClasses,
  warningCodes,
  VerifyBeaconRequestSchema,
  type ApiErrorResponse,
  type ChangeEvent,
  type EventVolumeEntry,
  type InstrumentsResponse,
  type MetricCounterSample,
  type NegotiationQueueEntry,
  type WarningCode,
} from "@atlas/schema";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import { logger } from "../observability/logging";
import { recordCitationFollow, snapshot } from "../observability/metrics";
import { errorResponse, type ApiResponse } from "./routeTypes";

const log = logger("instruments");

/**
 * The dashboard read (D6). `env` selects the durable events store (same factory
 * the change feed uses), so the event-class volume agrees with the seeded feed.
 */
export async function handleInstrumentsRequest(
  env: Record<string, string | undefined>,
): Promise<ApiResponse<InstrumentsResponse>> {
  const snap = snapshot();
  const events = await sharedEventsRepository(env).listSince();
  return {
    status: 200,
    body: {
      since: snap.since,
      counters: snap.counters,
      histograms: snap.histograms,
      eventVolumeByClass: eventVolumeByClass(events),
      negotiationQueue: negotiationQueue(snap.counters),
    },
  };
}

/** Change-feed volume by class (D4): every closed class in enum order, with its
 *  count (0 when absent) so the dashboard shape is stable across restarts. */
function eventVolumeByClass(events: ChangeEvent[]): EventVolumeEntry[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.class, (counts.get(event.class) ?? 0) + 1);
  }
  return eventClasses.map((cls) => ({ class: cls, count: counts.get(cls) ?? 0 }));
}

/** The negotiation queue (P16/P22): the `brief_block_warnings{code,subjectKind}`
 *  counters, sorted desc by count — the "which source next" answer. The label is
 *  validated against the closed `warningCodes` vocabulary before it is narrowed to
 *  `WarningCode`, so an out-of-vocab code can never ship typed (an impossible label
 *  is dropped rather than mistyped). */
function negotiationQueue(counters: MetricCounterSample[]): NegotiationQueueEntry[] {
  return counters
    .filter(
      (counter) => counter.name === "brief_block_warnings" && isWarningCode(counter.labels.code),
    )
    .map((counter) => ({
      code: counter.labels.code as WarningCode,
      subjectKind: counter.labels.subjectKind ?? "unknown",
      count: counter.value,
    }))
    .sort((a, b) => b.count - a.count);
}

function isWarningCode(value: string | undefined): value is WarningCode {
  return value !== undefined && (warningCodes as readonly string[]).includes(value);
}

/**
 * The citation-follow beacon (D5). A valid, shape-checked body records the metric
 * + logs and returns 204 (no body, no durable write); an invalid body is a 400.
 * The body carries NO identity/cookie (locked decision 6) — client-computed
 * `msSinceRender` only.
 */
export function handleVerifyBeacon(rawBody: unknown): {
  status: number;
  /** Present only on the 400 path; the 204 success has no body. */
  body?: ApiErrorResponse;
} {
  const parsed = VerifyBeaconRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_request",
      "Invalid verify beacon: expected { moment, sourceId, msSinceRender }.",
    );
  }
  const { moment, sourceId, msSinceRender } = parsed.data;
  recordCitationFollow({ moment, msSinceRender });
  log.info({ moment, sourceId, msSinceRender }, `citation follow: ${moment} → ${sourceId}`);
  return { status: 204 };
}
