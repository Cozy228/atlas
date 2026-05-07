import type {
  AuthorityLevel,
  Source,
  Topic,
  Warning,
} from "@atlas/schema";

/**
 * Authority ranking used wherever the Portal sorts or compares sources.
 * Lower index = stronger authority. Matches the order called out in
 * docs/architecture/portal_frontend_design_plan.md.
 */
export const AUTHORITY_ORDER: ReadonlyArray<AuthorityLevel> = [
  "authoritative",
  "reference",
  "example",
  "draft",
  "deprecated",
];

export function authorityRank(level: AuthorityLevel): number {
  const index = AUTHORITY_ORDER.indexOf(level);
  return index === -1 ? AUTHORITY_ORDER.length : index;
}

export function compareByAuthority(a: Source, b: Source): number {
  return authorityRank(a.authority_level) - authorityRank(b.authority_level);
}

export type FreshnessState = "current" | "needs-review" | "stale";

const ISO_8601_DURATION = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?$/;

/**
 * Convert an ISO 8601 duration like "P90D" / "P1M" / "P1Y" to milliseconds.
 * Months and years use calendar approximations (30 / 365 days) which is what
 * the Context Layer pilot uses; this is good enough for visible review
 * indicators and explicitly avoids importing a date library.
 */
export function parseDurationToMs(value: string): number | undefined {
  const match = ISO_8601_DURATION.exec(value);
  if (!match) {
    return undefined;
  }
  const [, years, months, days] = match;
  const ms =
    (Number(years ?? 0) * 365 + Number(months ?? 0) * 30 + Number(days ?? 0)) *
    24 *
    60 *
    60 *
    1000;
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

/**
 * Classify a source's freshness against the registered review_frequency.
 * `current` is within the window, `needs-review` is in the soft warning band
 * (>=80% of the window elapsed), `stale` is past the window.
 */
export function classifyFreshness(
  source: Source,
  now: Date = new Date(),
): FreshnessState {
  const reviewedAt = Date.parse(source.last_reviewed_at);
  const window = parseDurationToMs(source.review_frequency);
  if (!Number.isFinite(reviewedAt) || window === undefined) {
    return "needs-review";
  }
  const elapsed = now.getTime() - reviewedAt;
  if (elapsed >= window) {
    return "stale";
  }
  if (elapsed >= window * 0.8) {
    return "needs-review";
  }
  return "current";
}

/**
 * Pick the most severe warning for a source/topic so list rows can show one
 * compact badge that still points at real evidence identity.
 */
const WARNING_PRIORITY: Record<Warning["code"], number> = {
  source_unavailable: 0,
  broken_anchor: 1,
  authority_conflict: 2,
  restricted_source: 3,
  stale_source: 4,
  weak_anchoring: 5,
  no_registered_source: 6,
};

export function highestPriorityWarning(
  warnings: ReadonlyArray<Warning>,
): Warning | undefined {
  if (warnings.length === 0) return undefined;
  return [...warnings].sort(
    (a, b) => WARNING_PRIORITY[a.code] - WARNING_PRIORITY[b.code],
  )[0];
}

export function topicSlug(topic: Topic): string {
  return topic.id;
}
