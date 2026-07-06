/**
 * In-process metrics registry (Step 6 honesty instruments, locked decision 1).
 *
 * A hand-rolled registry — NO Prometheus/OTel dependency, pino stays the stream
 * of record. It is fed at the SAME call-sites that already log, and the internal
 * `/instruments` dashboard reads its {@link snapshot}. State is process-global and
 * since-boot: a restart resets the window, and the snapshot's `since` label says
 * so (no durable metric store — longer windows are an ops-side concern over the
 * pino stream, out of repo).
 *
 * Honesty rules (locked decision 10): observation ONLY — a metrics failure must
 * NEVER fail a brief, so every public op is exception-safe ({@link safe}); labels
 * carry no identity/PII, only our own faces + closed vocabularies.
 */
import type { BriefDepth, MetricsSnapshot, Moment, SectionStatus } from "@atlas/schema";
import type { ResolutionChannel } from "../resolvers/resolverTypes";
import { logger, serializeError } from "./logging";

type Labels = Record<string, string>;

type CounterCell = { name: string; labels: Labels; value: number };
type HistogramCell = {
  name: string;
  labels: Labels;
  buckets: number[];
  /** Cumulative counts: `counts[i]` = observations with value ≤ `buckets[i]`. */
  counts: number[];
  count: number;
  sum: number;
};

/** Fixed duration buckets (ms) for time-to-brief + citation-follow latency. */
const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
/** Fixed size buckets (estimated tokens) for the brief payload cost. */
const TOKEN_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];

let sinceIso = new Date().toISOString();
const counters = new Map<string, CounterCell>();
const histograms = new Map<string, HistogramCell>();

/** Stable key for a labelled series: name + sorted `k=v` pairs. */
function seriesKey(name: string, labels: Labels): string {
  const pairs = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return `${name}{${pairs.join(",")}}`;
}

/**
 * Run an observation, swallowing any throw. Observation is never allowed to break
 * the caller (locked decision 10); a failure is surfaced at debug and dropped.
 */
function safe(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    try {
      logger("instruments").debug({ err: serializeError(error) }, "metrics observation failed");
    } catch {
      /* never throw from the guard itself */
    }
  }
}

/** Increment a labelled counter (exception-safe). */
export function incrementCounter(name: string, labels: Labels, delta = 1): void {
  safe(() => {
    const key = seriesKey(name, labels);
    const cell = counters.get(key);
    if (cell) {
      cell.value += delta;
    } else {
      counters.set(key, { name, labels: { ...labels }, value: delta });
    }
  });
}

/**
 * Observe a value into a labelled histogram (exception-safe). The first
 * observation for a series fixes its `buckets`.
 */
export function observeHistogram(
  name: string,
  labels: Labels,
  value: number,
  buckets: number[],
): void {
  safe(() => {
    const key = seriesKey(name, labels);
    let cell = histograms.get(key);
    if (!cell) {
      cell = {
        name,
        labels: { ...labels },
        buckets: [...buckets],
        counts: Array.from({ length: buckets.length }, () => 0),
        count: 0,
        sum: 0,
      };
      histograms.set(key, cell);
    }
    cell.count += 1;
    cell.sum += value;
    for (let i = 0; i < cell.buckets.length; i += 1) {
      if (value <= cell.buckets[i]) {
        cell.counts[i] += 1;
      }
    }
  });
}

/** Estimated tokens of a serialized payload: chars/4 (documented as an estimate,
 *  no tokenizer dependency — locked decision 5). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type BriefBlockObservation = {
  status: SectionStatus;
  subjectKind: string;
  warningCodes: string[];
};

/**
 * Record an assembled brief (time-to-brief + block/warning counters). Fed at the
 * assembleBrief / assembleChangeBrief call-sites next to the pino log line.
 * `brief_time_to_brief_ms` is the P28 verification-collapse metric;
 * `brief_blocks{status}` + `brief_block_warnings{code,subjectKind}` feed the
 * negotiation queue (P16/P22, locked decision 4).
 */
export function recordBriefAssembled(input: {
  moment: Moment;
  depth: BriefDepth;
  channel: ResolutionChannel;
  durationMs: number;
  blocks: BriefBlockObservation[];
}): void {
  safe(() => {
    const { moment, depth, channel, durationMs, blocks } = input;
    observeHistogram(
      "brief_time_to_brief_ms",
      { moment, depth, channel },
      durationMs,
      DURATION_BUCKETS_MS,
    );
    for (const block of blocks) {
      incrementCounter("brief_blocks", { status: block.status });
      for (const code of block.warningCodes) {
        incrementCounter("brief_block_warnings", { code, subjectKind: block.subjectKind });
      }
    }
  });
}

/** Record one brief call for the P20 agent-call-share metric (all moments, all
 *  faces, incl. `debug`). Fed once per brief request in `handleBriefRequest`. */
export function recordBriefCall(input: {
  moment: Moment;
  depth: BriefDepth;
  channel: ResolutionChannel;
}): void {
  incrementCounter("brief_calls", {
    moment: input.moment,
    depth: input.depth,
    channel: input.channel,
  });
}

/**
 * Record the estimated token cost of a serialized brief payload, per face
 * (`json` | `markdown`) — the P28 token-economy metric (locked decision 5).
 * `serialize` is a THUNK, run inside the exception-safe guard: the serialization
 * (e.g. `JSON.stringify`) is observation-only cost accounting and must NEVER throw
 * out to 500 an already-assembled brief (locked decision 10).
 */
export function recordBriefPayload(input: {
  moment: Moment;
  depth: BriefDepth;
  channel: ResolutionChannel;
  face: "json" | "markdown";
  serialize: () => string;
}): void {
  safe(() => {
    observeHistogram(
      "brief_payload_est_tokens",
      { moment: input.moment, depth: input.depth, channel: input.channel, face: input.face },
      estimateTokens(input.serialize()),
      TOKEN_BUCKETS,
    );
  });
}

/** Record a citation-follow beacon (P28 verification tax, locked decision 6). */
export function recordCitationFollow(input: { moment: Moment; msSinceRender: number }): void {
  incrementCounter("citation_follow", { moment: input.moment });
  observeHistogram(
    "citation_follow_ms",
    { moment: input.moment },
    input.msSinceRender,
    DURATION_BUCKETS_MS,
  );
}

/** Read-only, since-boot registry snapshot for the dashboard. */
export function snapshot(): MetricsSnapshot {
  return {
    since: sinceIso,
    counters: [...counters.values()].map((c) => ({
      name: c.name,
      labels: { ...c.labels },
      value: c.value,
    })),
    histograms: [...histograms.values()].map((h) => ({
      name: h.name,
      labels: { ...h.labels },
      count: h.count,
      sum: h.sum,
      buckets: [
        ...h.buckets.map((le, i) => ({ le: String(le), count: h.counts[i] })),
        { le: "+Inf", count: h.count },
      ],
    })),
  };
}

/** Test-only: clear all series and restamp the window. NOT used in production. */
export function resetMetrics(): void {
  counters.clear();
  histograms.clear();
  sinceIso = new Date().toISOString();
}
