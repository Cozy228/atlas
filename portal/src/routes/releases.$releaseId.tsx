/**
 * Release detail · route `/releases/$releaseId`
 * ==============================================
 * The full scope of one release as a dossier (matching the source record
 * layout): scope items by category in the main column — each with its
 * description and Jira ticket — and a record rail with the change request,
 * dates, and a link to the source of record on Confluence.
 */
import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { releaseNotesQueryOptions } from "@/api/queries";
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
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-7 px-6 py-8 sm:px-8">
      <Link
        to="/whatsnew"
        className="w-fit bg-background font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:text-brand-ink"
      >
        ← What&rsquo;s New
      </Link>

      <header className="flex flex-col gap-3">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 bg-background font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <span className="font-semibold">From Confluence release notes</span>
          {release.changeRequest ? (
            <>
              <span aria-hidden className="text-border-strong">
                ·
              </span>
              <span>{release.changeRequest}</span>
            </>
          ) : null}
        </span>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="w-fit bg-background text-[1.875rem] font-bold leading-[1.1] tracking-[-0.03em] text-foreground">
            {release.month ?? "Release"}
            {release.postedAt ? (
              <span className="text-muted-foreground"> · {release.postedAt}</span>
            ) : null}
          </h1>
          {release.link ? (
            <a
              href={release.link}
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-1 bg-background text-[12.5px] font-semibold text-brand-ink hover:underline"
            >
              Open release notes
              <span aria-hidden>↗</span>
            </a>
          ) : null}
        </div>
      </header>

      <div className="grid gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,1fr)_260px]">
        <main className="flex min-w-0 flex-col gap-7">
          {categories.map((c) => (
            <section key={c.category} className="flex flex-col gap-2.5">
              <SectionLabel>
                {c.category} · {c.count}
              </SectionLabel>
              <ul className="flex flex-col rounded-[4px] border border-border bg-card px-4">
                {release.items
                  .filter((item) => item.category === c.category)
                  .map((item, i) => (
                    <li
                      key={`${item.ticket ?? item.title}-${i}`}
                      className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
                    >
                      <span className="text-[12.5px] leading-[1.5] text-foreground/90">
                        {item.title}
                      </span>
                      {item.ticket ? (
                        <span className="shrink-0 rounded-[2px] border border-border px-1.5 py-px font-mono text-[10px] tabular-nums text-muted-foreground">
                          {item.ticket}
                        </span>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </main>

        <aside className="flex min-w-0 flex-col gap-2.5">
          <SectionLabel>Record</SectionLabel>
          <dl className="flex flex-col rounded-[4px] border border-border bg-card px-4 py-1.5">
            {release.changeRequest ? (
              <MetaRow label="Change" value={release.changeRequest} mono />
            ) : null}
            {release.postedAt ? <MetaRow label="Posted" value={release.postedAt} /> : null}
            <MetaRow label="Scope" value={`${release.items.length} changes`} />
            {categories.map((c) => (
              <MetaRow key={c.category} label={c.category} value={String(c.count)} />
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="w-fit bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h2>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          "text-right text-[12.5px] font-semibold text-foreground" +
          (mono ? " font-mono text-[11.5px] font-normal" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}
