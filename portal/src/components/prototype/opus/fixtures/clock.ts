/**
 * Prototype `opus` — fixed clock
 * ==============================
 * Every relative label ("2d 4h ago") is computed against `FIXTURE_NOW`, not the
 * wall clock, so the prototype renders identically on every machine and in every
 * test run. Nothing here is nondeterministic.
 */

/** The single "now" the whole prototype is frozen at. */
export const FIXTURE_NOW = "2026-08-14T14:05:00.000Z";

const FIXTURE_NOW_MS = Date.parse(FIXTURE_NOW);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Milliseconds between an ISO timestamp and the frozen now (negative = future). */
export function sinceNow(iso: string): number {
  return FIXTURE_NOW_MS - Date.parse(iso);
}

/** Compact elapsed label: `4m`, `6h 23m`, `2d 4h`. */
export function elapsed(iso: string): string {
  return formatSpan(Math.max(0, sinceNow(iso)));
}

/** Compact duration label for a span in milliseconds. */
export function formatSpan(ms: number): string {
  if (ms < MINUTE) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (ms < HOUR) {
    const minutes = Math.floor(ms / MINUTE);
    const seconds = Math.round((ms % MINUTE) / 1000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  if (ms < DAY) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.floor((ms % HOUR) / MINUTE);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

/** `2d 4h ago`, or `just now` inside the first minute. */
export function ago(iso: string): string {
  const ms = sinceNow(iso);
  if (ms < MINUTE) return "just now";
  return `${formatSpan(ms)} ago`;
}

/** Absolute UTC stamp for evidence: `14 Aug 2026 07:42 UTC`. */
export function stamp(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${date.getUTCFullYear()} ${hours}:${minutes} UTC`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
