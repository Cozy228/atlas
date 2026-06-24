/**
 * Release-notes section for What's New. Each release is summarised as a card
 * (a month can hold several — releases land roughly twice a month), grouped
 * under its month. The full scope lives on the release detail page; the card is
 * the browse-once summary that links into it.
 */
import { Link } from "@tanstack/react-router";

import type { Release } from "@/api/server/releaseNotes";

export function ReleasesSection({ releases }: { releases: ReadonlyArray<Release> }) {
  if (releases.length === 0) {
    return null;
  }
  const months = groupByMonth(releases);

  return (
    <section className="mt-8 flex flex-col gap-4 border-t-2 border-border-strong pt-6">
      <h2 className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
          Platform releases
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          From Confluence release notes
        </span>
      </h2>

      {months.map(({ month, items }) => (
        <div key={month} className="flex flex-col gap-2.5">
          <h3 className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
            {month}
          </h3>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {items.map((release) => (
              <ReleaseCard key={release.id} release={release} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function ReleaseCard({ release }: { release: Release }) {
  const counts = categoryCounts(release.items);
  return (
    <li className="flex flex-col gap-2 rounded-[4px] border border-border bg-card p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          {release.postedAt ?? release.month}
        </span>
        {release.changeRequest ? (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {release.changeRequest}
          </span>
        ) : null}
      </div>

      <p className="text-[13px] font-semibold text-foreground">
        {release.items.length} {release.items.length === 1 ? "change" : "changes"}
        <span className="font-normal text-muted-foreground">
          {" · "}
          {counts.map((c) => `${c.count} ${c.category.toLowerCase()}`).join(" · ")}
        </span>
      </p>

      <Link
        to="/releases/$releaseId"
        params={{ releaseId: release.id }}
        className="flex w-fit items-center gap-1 text-[12.5px] font-semibold text-brand-ink hover:underline"
      >
        View release
        <span aria-hidden>→</span>
      </Link>
    </li>
  );
}

export function categoryCounts(
  items: Release["items"],
): ReadonlyArray<{ category: string; count: number }> {
  const order: string[] = [];
  const byCategory = new Map<string, number>();
  for (const item of items) {
    if (!byCategory.has(item.category)) {
      byCategory.set(item.category, 0);
      order.push(item.category);
    }
    byCategory.set(item.category, byCategory.get(item.category)! + 1);
  }
  return order.map((category) => ({ category, count: byCategory.get(category)! }));
}

function groupByMonth(
  releases: ReadonlyArray<Release>,
): ReadonlyArray<{ month: string; items: Release[] }> {
  const order: string[] = [];
  const byMonth = new Map<string, Release[]>();
  for (const release of releases) {
    const month = release.month ?? "Undated";
    if (!byMonth.has(month)) {
      byMonth.set(month, []);
      order.push(month);
    }
    byMonth.get(month)!.push(release);
  }
  return order.map((month) => ({ month, items: byMonth.get(month)! }));
}
