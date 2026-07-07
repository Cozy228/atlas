/**
 * Honesty instruments · route `/instruments`
 * ======================================================================
 * The internal, since-boot honesty dashboard (Step 6, F / P16/P20/P22/P28). It
 * answers "which source do we negotiate next" from data (the negotiation queue,
 * P16/P22), and shows the P20/P28 cost metrics — agent call share, time-to-brief,
 * tokens-per-brief by depth tier — plus change-feed volume by class and the
 * citation-follow (time-to-verify) stats.
 *
 * Read-only, aggregate counts only (no identity). The window is SINCE PROCESS
 * BOOT and the banner says so — a restart resets it (no durable metric store;
 * longer windows are an ops-side CloudWatch concern, out of repo). Unlisted: not
 * in the sitemap, reachable by a support-page link, Entra-gated later.
 *
 * Data: `fetchInstruments` — the same value the internal
 * `GET /api/internal/instruments` endpoint serves.
 */
import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type {
  InstrumentsResponse,
  MetricCounterSample,
  MetricHistogramSample,
} from "@atlas/schema";

import { instrumentsQueryOptions } from "@/api/queries";
import { PageBody, PageHeader } from "@/components/page-section";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/instruments")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(instrumentsQueryOptions);
  },
  component: InstrumentsRoute,
});

function InstrumentsRoute() {
  const { data, isLoading } = useQuery(instrumentsQueryOptions);

  return (
    <>
      <PageHeader
        title="Honesty instruments"
        description="How honest the product is being — and which source to negotiate next. Aggregate counts only."
      />
      <PageBody>
        {isLoading || !data ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : (
          <div className="flex flex-col gap-6">
            <SinceBanner since={data.since} />
            <NegotiationQueue queue={data.negotiationQueue} />
            <CallShare counters={data.counters} />
            <TimeToBrief histograms={data.histograms} />
            <EstTokens histograms={data.histograms} />
            <EventVolume volume={data.eventVolumeByClass} />
            <CitationFollow counters={data.counters} histograms={data.histograms} />
          </div>
        )}
      </PageBody>
    </>
  );
}

function SinceBanner({ since }: { since: string }) {
  return (
    <p
      role="note"
      className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
    >
      Since-boot window — counts reset on every deploy/restart. Measuring since{" "}
      <time dateTime={since}>{since}</time>. Longer windows live in ops (CloudWatch over the pino
      stream), not here.
    </p>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

/** The negotiation queue (P16/P22): the "which source next" answer, sorted desc. */
function NegotiationQueue({ queue }: { queue: InstrumentsResponse["negotiationQueue"] }) {
  return (
    <Section
      title="Negotiation queue"
      hint="Unresolved / warned blocks grouped by warning code × subject — which source to negotiate next (P16/P22)."
    >
      {queue.length === 0 ? (
        <Empty text="No unresolved or warned blocks recorded yet." />
      ) : (
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-4 font-medium">Missing source (warning code)</th>
              <th className="py-1 pr-4 font-medium">Subject</th>
              <th className="py-1 text-right font-medium">Count</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((row) => (
              <tr key={`${row.code}:${row.subjectKind}`} className="border-t border-border/60">
                <td className="py-1 pr-4 font-mono">{row.code}</td>
                <td className="py-1 pr-4">{row.subjectKind}</td>
                <td className="py-1 text-right tabular-nums">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/** Agent call share by channel (P20). */
function CallShare({ counters }: { counters: MetricCounterSample[] }) {
  const byChannel = new Map<string, number>();
  for (const counter of counters) {
    if (counter.name !== "brief_calls") continue;
    const channel = counter.labels.channel ?? "unknown";
    byChannel.set(channel, (byChannel.get(channel) ?? 0) + counter.value);
  }
  const rows = [...byChannel.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  return (
    <Section title="Agent call share" hint="Brief calls by face (P20) — mcp / http / portal.">
      {rows.length === 0 ? (
        <Empty text="No brief calls recorded yet." />
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {rows.map(([channel, value]) => (
            <li key={channel} className="flex justify-between">
              <span className="font-mono">{channel}</span>
              <span className="tabular-nums text-muted-foreground">
                {value} {total > 0 ? `(${Math.round((value / total) * 100)}%)` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** time-to-brief by depth × channel (the merge time the product collapses). */
function TimeToBrief({ histograms }: { histograms: MetricHistogramSample[] }) {
  const rows = histograms
    .filter((h) => h.name === "brief_time_to_brief_ms")
    .map((h) => ({
      key: `${h.labels.moment}/${h.labels.depth}/${h.labels.channel}`,
      count: h.count,
      avg: h.count > 0 ? h.sum / h.count : 0,
    }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
  return (
    <Section title="Time to brief" hint="Assembly latency by moment / depth / channel (ms).">
      {rows.length === 0 ? (
        <Empty text="No briefs assembled yet." />
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {rows.map((row) => (
            <li key={row.key} className="flex justify-between">
              <span className="font-mono">{row.key}</span>
              <span className="tabular-nums text-muted-foreground">
                {row.count}× · avg {Math.round(row.avg)}ms
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** tokens-per-brief by depth tier × channel × face (P28 token economy, estimated). */
function EstTokens({ histograms }: { histograms: MetricHistogramSample[] }) {
  const rows = histograms
    .filter((h) => h.name === "brief_payload_est_tokens")
    .map((h) => ({
      key: `${h.labels.moment}/${h.labels.depth}/${h.labels.channel}/${h.labels.face}`,
      count: h.count,
      avg: h.count > 0 ? h.sum / h.count : 0,
    }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
  return (
    <Section
      title="Tokens per brief"
      hint="Estimated serialized payload cost (chars/4) by moment / depth / channel / face (P28)."
    >
      {rows.length === 0 ? (
        <Empty text="No brief payloads recorded yet." />
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {rows.map((row) => (
            <li key={row.key} className="flex justify-between">
              <span className="font-mono">{row.key}</span>
              <span className="tabular-nums text-muted-foreground">
                {row.count}× · ~{Math.round(row.avg)} est. tokens
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Change-feed volume by class (derived at read from the durable events store). */
function EventVolume({ volume }: { volume: InstrumentsResponse["eventVolumeByClass"] }) {
  const nonZero = volume.filter((entry) => entry.count > 0);
  return (
    <Section
      title="Change-feed volume"
      hint="Derived events by class, from the durable events store."
    >
      {nonZero.length === 0 ? (
        <Empty text="No change events recorded yet." />
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {nonZero.map((entry) => (
            <li key={entry.class} className="flex justify-between">
              <span className="font-mono">{entry.class}</span>
              <span className="tabular-nums text-muted-foreground">{entry.count}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** time-to-verify: citation-follow counts + latency (P28 verification tax). */
function CitationFollow({
  counters,
  histograms,
}: {
  counters: MetricCounterSample[];
  histograms: MetricHistogramSample[];
}) {
  const follows = counters.filter((c) => c.name === "citation_follow");
  const latency = new Map<string, { count: number; sum: number }>();
  for (const h of histograms) {
    if (h.name !== "citation_follow_ms") continue;
    latency.set(h.labels.moment ?? "unknown", { count: h.count, sum: h.sum });
  }
  return (
    <Section
      title="Time to verify"
      hint="Citation follows to source, by moment — the verification-tax instrument (P28)."
    >
      {follows.length === 0 ? (
        <Empty text="No citation follows recorded yet." />
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {follows.map((follow) => {
            const moment = follow.labels.moment ?? "unknown";
            const lat = latency.get(moment);
            const avg = lat && lat.count > 0 ? Math.round(lat.sum / lat.count) : undefined;
            return (
              <li key={moment} className="flex justify-between">
                <span className="font-mono">{moment}</span>
                <span className="tabular-nums text-muted-foreground">
                  {follow.value}× {avg !== undefined ? `· avg ${avg}ms` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
