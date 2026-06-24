/**
 * Release-notes section for What's New, in the page's broadsheet idiom — month
 * run-ins and hairline-separated briefs (Kicker + story link), not boxed cards.
 * A month can hold several releases (they land ~twice a month). The full scope
 * lives on the release detail page; the brief is the browse-once summary.
 */
import { Link } from "@tanstack/react-router";

import type { Release } from "@/api/server/releaseNotes";
import { TONE_DOT } from "@/components/whatsnew/data";
import { cn } from "@/lib/utils";

export function ReleasesSection({ releases }: { releases: ReadonlyArray<Release> }) {
  if (releases.length === 0) {
    return null;
  }
  const months = groupByMonth(releases);

  return (
    <section className="mt-8 flex flex-col gap-5 border-t-2 border-border-strong pt-6">
      <h2 className="flex items-baseline gap-3">
        <span className="bg-background font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
          Platform releases
        </span>
        <span className="bg-background font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          From Confluence release notes
        </span>
      </h2>

      {months.map(({ month, items }) => (
        <section key={month}>
          <h3 className="mb-3 flex items-baseline gap-3 border-t border-border pt-3">
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {month}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
              {items.length} {items.length === 1 ? "release" : "releases"}
            </span>
          </h3>
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {items.map((release) => (
              <ReleaseBrief key={release.id} release={release} />
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

function ReleaseBrief({ release }: { release: Release }) {
  const counts = categoryCounts(release.items);
  return (
    <li className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 sm:first:border-t">
      <span className="flex items-center gap-2">
        <span aria-hidden className={cn("size-1.5 rounded-full", TONE_DOT.info)} />
        <span className="bg-background font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Release · {release.postedAt ?? release.month}
        </span>
      </span>
      <h4 className="w-fit bg-background text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
        {release.changeRequest ?? release.month ?? "Release"}
      </h4>
      <p className="w-fit max-w-[44ch] bg-background text-[12px] leading-[1.5] text-muted-foreground">
        {release.items.length} {release.items.length === 1 ? "change" : "changes"}
        {counts.length > 0
          ? ` · ${counts.map((c) => `${c.count} ${c.category.toLowerCase()}`).join(" · ")}`
          : ""}
      </p>
      <Link
        to="/releases/$releaseId"
        params={{ releaseId: release.id }}
        className="flex w-fit items-center gap-1 bg-background text-[12.5px] font-semibold text-brand-ink hover:underline"
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
