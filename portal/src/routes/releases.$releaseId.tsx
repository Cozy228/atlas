/**
 * Release detail · route `/releases/$releaseId`
 * ==============================================
 * The full scope of one release — too many items to sit on the What's New card,
 * so each item gets its description here plus its Jira ticket, grouped by
 * category. Aggregated and cited from the Confluence release-notes page; the
 * card on What's New is the browse-once summary that links here.
 */
import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { releaseNotesQueryOptions } from "@/api/queries";
import type { Release } from "@/api/server/releaseNotes";
import { categoryCounts } from "@/components/whatsnew/releases";

export const Route = createFileRoute("/releases/$releaseId")({
  loader: async ({ context, params }) => {
    const releases = await context.queryClient.ensureQueryData(releaseNotesQueryOptions);
    const release = releases.find((r) => r.id === params.releaseId);
    if (!release) {
      throw notFound();
    }
    return { release };
  },
  component: ReleaseDetailRoute,
});

function ReleaseDetailRoute() {
  const { release } = Route.useLoaderData();
  const categories = categoryCounts(release.items);

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-7 px-6 py-8 sm:px-8">
      <Link
        to="/whatsnew"
        className="w-fit font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:text-brand-ink"
      >
        ← What&rsquo;s New
      </Link>

      <header className="flex flex-col gap-2 border-b-2 border-border-strong pb-5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
          From Confluence release notes
        </span>
        <h1 className="text-[2rem] font-bold leading-tight tracking-[-0.03em] text-foreground">
          {release.month ?? "Release"}
          {release.postedAt ? (
            <span className="text-muted-foreground"> · {release.postedAt}</span>
          ) : null}
        </h1>
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11.5px] text-muted-foreground">
          {release.changeRequest ? <Meta label="Change">{release.changeRequest}</Meta> : null}
          <Meta label="Scope">
            {release.items.length} {release.items.length === 1 ? "change" : "changes"}
          </Meta>
          {categories.map((c) => (
            <Meta key={c.category} label={c.category}>
              {c.count}
            </Meta>
          ))}
        </dl>
        {release.link ? (
          <a
            href={release.link}
            target="_blank"
            rel="noreferrer"
            className="w-fit text-[12.5px] font-semibold text-brand-ink hover:underline"
          >
            Open release notes ↗
          </a>
        ) : null}
      </header>

      {categories.map((c) => (
        <CategorySection
          key={c.category}
          category={c.category}
          items={release.items.filter((item) => item.category === c.category)}
        />
      ))}
    </div>
  );
}

function CategorySection({ category, items }: { category: string; items: Release["items"] }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="flex items-baseline gap-2.5">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-foreground">
          {category}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </h2>
      <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
        {items.map((item, i) => (
          <li
            key={`${item.ticket ?? item.title}-${i}`}
            className={
              "flex items-start justify-between gap-3 px-3.5 py-2.5" +
              (i > 0 ? " border-t border-border" : "")
            }
          >
            <span className="text-[13px] text-foreground">{item.title}</span>
            {item.ticket ? (
              <span className="shrink-0 rounded-[2px] border border-border px-1.5 py-px font-mono text-[10px] tabular-nums text-muted-foreground">
                {item.ticket}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground/60">{label}</dt>
      <dd className="tabular-nums text-foreground">{children}</dd>
    </div>
  );
}
