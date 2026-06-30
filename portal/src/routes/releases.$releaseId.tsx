/**
 * Release detail · route `/releases/$releaseId`
 * ==============================================
 * The full scope of one release, in the same broadsheet idiom as What's New: a
 * masthead, the scope by category in the main column (each item with its
 * description and Jira ticket), and a rail of references — Jira release, change
 * request, DOP, Go/No-Go, Viva Engage — plus who to contact.
 */
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { LastFetchChip } from "@/components/last-fetch-chip";
import { releaseNotesQueryOptions } from "@/api/queries";
import { categoryCounts } from "@/components/whatsnew/releases";
import { Skeleton } from "@/components/ui/skeleton";
import { DeferredRegion } from "@/components/deferred-region";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const Route = createFileRoute("/releases/$releaseId")({
  loader: async ({ context, params }) => {
    const releases = await context.queryClient.ensureQueryData(releaseNotesQueryOptions);
    const release = releases.find((r) => r.id === params.releaseId);
    if (!release) {
      throw notFound();
    }
    // The right rail (references, support, link) derives from the already-loaded
    // release record, so it resolves immediately — kept behind DeferredRegion for
    // a uniform detail-page shape. Pass the whole release (its type is nameable;
    // extracting resources/support/link would surface context-layer's internal
    // ReleaseResource type → TS2883).
    const rail = Promise.resolve(release);
    return { release, rail };
  },
  component: ReleaseDetailRoute,
});

function ReleaseDetailRoute() {
  const { release, rail } = Route.useLoaderData();
  const { dataUpdatedAt } = useQuery(releaseNotesQueryOptions);
  const categories = categoryCounts(release.items);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <Link
        to="/whatsnew"
        className="w-fit font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:text-brand-ink"
      >
        ← What&rsquo;s New
      </Link>

      <header className="flex flex-col gap-4 border-b-[3px] border-double border-border-strong pb-5">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="tabular-nums">{release.postedAt ?? release.month}</span>
          <span className="hidden tracking-[0.2em] sm:inline">Platform release</span>
          <span className="flex items-center gap-3">
            {dataUpdatedAt ? (
              <LastFetchChip updatedAt={dataUpdatedAt} className="tracking-normal" />
            ) : null}
            <span>{release.changeRequest ?? "Release"}</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="w-fit text-[2.75rem] font-bold leading-[0.95] tracking-[-0.04em] text-foreground">
            {friendlyDate(release.postedAt) ?? release.month ?? "Release"}
          </h1>
          <p className="w-fit max-w-[60ch] text-[13px] italic leading-[1.5] text-muted-foreground">
            {release.items.length} {release.items.length === 1 ? "change" : "changes"} across{" "}
            {categories.map((c) => c.category.toLowerCase()).join(" and ")}
            {release.changeRequest ? `, change ${release.changeRequest}` : ""}.
          </p>
        </div>
      </header>

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_240px]">
        <main className="flex min-w-0 flex-col gap-7">
          <DeferredRegion
            promise={rail}
            fallback={<ReleaseMainSkeleton />}
            label="the release scope"
            retry
          >
            {(r) =>
              categoryCounts(r.items).map((c) => (
                <section key={c.category}>
                  <h2 className="mb-3 flex items-baseline gap-3 border-t border-border pt-3">
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {c.category}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                      {c.count}
                    </span>
                  </h2>
                  <ul className="flex flex-col">
                    {r.items
                      .filter((item) => item.category === c.category)
                      .map((item, i) => (
                        <li
                          key={`${item.ticket ?? item.title}-${i}`}
                          className="flex items-baseline justify-between gap-4 border-t border-border py-2.5 first:border-t-0"
                        >
                          <span className="text-[13px] leading-[1.5] text-foreground">
                            {item.title}
                          </span>
                          {item.ticket && r.jiraBase ? (
                            <a
                              href={`${r.jiraBase}/browse/${item.ticket}`}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 font-mono text-[10.5px] tabular-nums text-brand-ink hover:underline"
                            >
                              {item.ticket}
                            </a>
                          ) : item.ticket ? (
                            <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                              {item.ticket}
                            </span>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                </section>
              ))
            }
          </DeferredRegion>
        </main>

        <aside className="flex min-w-0 flex-col gap-8 lg:border-l lg:border-border lg:pl-7">
          <DeferredRegion promise={rail} fallback={<ReleaseRailSkeleton />} label="the references">
            {(rail) => (
              <>
                {rail.resources && rail.resources.length > 0 ? (
                  <RailModule label="References">
                    <ul className="flex flex-col">
                      {rail.resources.map((resource, i) => (
                        <li
                          key={resource.label}
                          className={i > 0 ? "border-t border-border" : undefined}
                        >
                          {resource.url ? (
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group flex items-baseline justify-between gap-3 py-2"
                            >
                              <span className="text-[12.5px] text-foreground group-hover:text-brand-ink">
                                {resource.label}
                              </span>
                              <span
                                aria-hidden
                                className="shrink-0 text-muted-foreground group-hover:text-brand-ink"
                              >
                                ↗
                              </span>
                            </a>
                          ) : (
                            <span className="block py-2 text-[12.5px] text-muted-foreground">
                              {resource.label}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </RailModule>
                ) : null}

                {rail.support ? (
                  <RailModule label="Questions">
                    <p className="text-[12px] leading-[1.6] text-muted-foreground">
                      For questions or follow-up, reach the {rail.support}.
                    </p>
                  </RailModule>
                ) : null}

                {rail.link ? (
                  <a
                    href={rail.link}
                    target="_blank"
                    rel="noreferrer"
                    className="w-fit text-[12.5px] font-semibold text-brand-ink hover:underline"
                  >
                    Open release notes ↗
                  </a>
                ) : null}
              </>
            )}
          </DeferredRegion>
        </aside>
      </div>
    </div>
  );
}

function RailModule({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="w-fit border-b-2 border-border-strong pb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </h2>
      {children}
    </section>
  );
}

/** Placeholder for the deferred release main column (the live newsletter body —
 * change categories + items), so only the masthead paints before it lands. */
function ReleaseMainSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-7">
      {Array.from({ length: 3 }, (_, i) => (
        <section key={i} className="flex flex-col gap-3 border-t border-border pt-3">
          <Skeleton className="h-3 w-28" />
          <div className="flex flex-col">
            {Array.from({ length: 3 }, (_, j) => (
              <div
                key={j}
                className="flex items-baseline justify-between gap-4 border-t border-border py-2.5 first:border-t-0"
              >
                <Skeleton className="h-3 w-full max-w-[42ch]" />
                <Skeleton className="h-3 w-14 shrink-0" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Placeholder for the deferred release rail (references, questions, link). */
function ReleaseRailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <section className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-24" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-full" />
      </section>
    </div>
  );
}

function friendlyDate(iso: string | undefined): string | undefined {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : undefined;
}
