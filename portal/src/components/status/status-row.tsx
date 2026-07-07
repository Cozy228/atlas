/**
 * One operational-status entry, shared by the status board (Step 7, P24) and the
 * debug brief floor (M7, locked decision 7) so both render a live value / labeled
 * pointer with the SAME uncited vocabulary (ADR-0003): a fetched value is
 * operational status, NEVER dressed up as a cited claim. Degradation (no adapter /
 * `none` authMode / fetch failure) is shown plainly, never with alarm styling, and
 * never as a fabricated value.
 */
import { IconCircleDashed, IconExternalLink, IconPointFilled } from "@tabler/icons-react";
import type { LocationStatusEntry } from "@atlas/schema";

/** Honest, plain-language reasons a location renders as a labeled pointer. */
const REASON_COPY: Record<string, string> = {
  "no-adapter": "No value adapter for this system",
  "no-value-channel": "No live value channel",
  "fetch-failed": "Value fetch failed",
};

/** One board entry: a live value or a labeled pointer (the honest floor). */
export function StatusRow({ entry }: { entry: LocationStatusEntry }) {
  const hasValue = entry.value !== null;
  return (
    <div
      data-testid={hasValue ? "status-value" : "status-pointer"}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xs border border-border bg-card px-3 py-2.5"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">
            {entry.location.system}
          </span>
          <span className="shrink-0 rounded-xs border border-border px-1.5 py-0.5 type-detail text-muted-foreground">
            {entry.location.kind}
          </span>
        </div>
        <a
          href={entry.location.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-brand-ink underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          <span className="truncate">{entry.location.url}</span>
          <IconExternalLink className="size-3 shrink-0" aria-hidden />
        </a>
      </div>

      {hasValue ? (
        <ValueTag value={entry.value as string} fetchedAt={entry.fetchedAt} />
      ) : (
        <PointerTag reason={entry.reason} />
      )}
    </div>
  );
}

/** The live value — mono, tagged "uncited" so it never reads as a cited claim. */
function ValueTag({ value, fetchedAt }: { value: string; fetchedAt: string | null }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        aria-hidden
        className="rounded-xs border border-dashed border-border-strong px-1 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        uncited
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-xs bg-muted px-2 py-1 font-mono text-xs font-semibold text-foreground">
        <IconPointFilled className="size-3 shrink-0 text-success" aria-hidden />
        {value}
      </span>
      {fetchedAt ? (
        <time dateTime={fetchedAt} className="type-detail text-muted-foreground">
          {formatFetchedAt(fetchedAt)}
        </time>
      ) : null}
    </div>
  );
}

/**
 * A labeled pointer — the honest floor: name + link + an explicit "value
 * unavailable" state with its plain reason. Calm, never alarm: a missing value is
 * an expected condition, not an error.
 */
function PointerTag({ reason }: { reason?: string }) {
  const detail = reason ? (REASON_COPY[reason] ?? reason) : "No live value";
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
      <IconCircleDashed className="size-4 shrink-0" aria-hidden />
      <span className="type-label font-medium text-foreground">Value unavailable</span>
      <span className="type-detail">· {detail}</span>
    </div>
  );
}

/** A compact, locale-stable read-time stamp (e.g. "14:32 UTC"). */
function formatFetchedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(11, 16)} UTC`;
}
