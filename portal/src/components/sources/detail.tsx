/**
 * Source detail for
 * `/sources/$sourceId`. Sources are Atlas's evidence backbone, so the
 * record deserves a first-class detail with its own register — not the generic
 * detail shell. Rendered as the "dossier": an accession RECORD — mono record
 * number, badge row, a meta ledger rail, and the citations that rest on this
 * source.
 *
 * Real data: the source-discovery projection + the live context bundle (which
 * may be absent — handled gracefully). Evidence badges are reused read-only
 * from the mainline; the layout is this surface's own.
 */
import { Link } from "@tanstack/react-router";
import { IconArrowLeft, IconExternalLink, IconLock } from "@tabler/icons-react";
import type { AnchorReference, ContextBundleResponse, Source } from "@atlas/schema";

import {
  AnchorStatusBadge,
  AuthorityBadge,
  FreshnessIndicator,
  VisibilityBadge,
} from "@/components/evidence/badges";
import { classifyFreshness, parseDurationToMs, type FreshnessState } from "@/lib/evidence";
import { cn } from "@/lib/utils";

import { CLASS_LABEL, FRESHNESS_META, SOURCE_PROVENANCE } from "./shared";

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "P90D" → "90 days" (months/weeks pass through as a readable phrase). */
function cadenceLabel(freq: string): string {
  const ms = parseDurationToMs(freq);
  if (!ms) return freq;
  const days = Math.round(ms / 86_400_000);
  if (days % 30 === 0 && days >= 30) {
    const months = days / 30;
    return `${months} ${months === 1 ? "month" : "months"}`;
  }
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function nextReviewDate(source: Source): Date | null {
  const ms = parseDurationToMs(source.review_frequency);
  if (!ms) return null;
  return new Date(new Date(source.last_reviewed_at).getTime() + ms);
}

const FRESHNESS_VERDICT: Record<FreshnessState, string> = {
  current: "On schedule — within the registered review window.",
  "needs-review": "Review due soon — approaching the registered window.",
  stale: "Overdue — past the registered review window. The steward sees it too.",
};

function anchorsFor(
  source: Source,
  bundle: ContextBundleResponse | null,
): ReadonlyArray<AnchorReference> {
  if (!bundle) return [];
  return bundle.anchor_references.filter((a) => a.source_id === source.id);
}

type Excerpt = ContextBundleResponse["sources"][number]["excerpts"][number];

/** The live-resolved excerpts for this source from the context bundle. */
function excerptsFor(source: Source, bundle: ContextBundleResponse | null): ReadonlyArray<Excerpt> {
  return bundle?.sources.find((s) => s.source.id === source.id)?.excerpts ?? [];
}

function BackLink() {
  return (
    <Link
      to="/sources"
      className="inline-flex w-fit items-center gap-1.5 bg-background text-[13px] font-semibold text-muted-foreground hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <IconArrowLeft aria-hidden className="size-3.5" />
      Source registry
    </Link>
  );
}

function RestrictedNotice() {
  return (
    <div className="rounded-[4px] border border-warning/30 bg-warning/10 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-warning-ink">
        <IconLock aria-hidden className="size-3.5" />
        Restricted source
      </p>
      <p className="mt-1 text-[12px] leading-[1.5] text-muted-foreground">
        Atlas surfaces metadata only. Direct fetches return{" "}
        <code className="rounded-[2px] bg-card px-1 py-0.5 font-mono text-[11px]">
          access_denied
        </code>
        . Contact the steward for access.
      </p>
    </div>
  );
}

function OpenAtSource({ source }: { source: Source }) {
  if (source.visibility === "restricted") return null;
  return (
    <a
      href={source.location}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors",
        "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      Open at source
      <IconExternalLink aria-hidden className="size-3.5" />
    </a>
  );
}

/** Citations resting on this source — the reason a source matters. */
function RestingCitations({ anchors }: { anchors: ReadonlyArray<AnchorReference> }) {
  if (anchors.length === 0) {
    return (
      <p className="rounded-[4px] border border-dashed border-border bg-card px-3.5 py-5 text-[12.5px] text-muted-foreground">
        No live citations resolve to this source in the current context bundle.
      </p>
    );
  }
  return (
    <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
      {anchors.map((anchor, i) => (
        <li
          key={anchor.anchor_id}
          className={cn(
            "flex items-center justify-between gap-3 px-3.5 py-3",
            i > 0 && "border-t border-border",
          )}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[13px] font-semibold text-foreground">
              {anchor.citation_label}
            </span>
            <code className="font-mono text-[10.5px] text-muted-foreground">
              {anchor.anchor_id}
            </code>
          </span>
          <AnchorStatusBadge status={anchor.status} />
        </li>
      ))}
    </ul>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="w-fit bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h2>
  );
}

/** Shared identity header — back link, record line, title, status badges. */
function DetailHeader({ source }: { source: Source }) {
  return (
    <>
      <BackLink />
      <header className="flex flex-col gap-3">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 bg-background font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <span className="font-semibold">{CLASS_LABEL[source.source_class]}</span>
          <span aria-hidden className="text-border-strong">
            ·
          </span>
          <span>{source.id}</span>
        </span>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="w-fit max-w-[24ch] bg-background text-[1.875rem] font-bold leading-[1.1] tracking-[-0.03em] text-foreground">
            {source.title}
          </h1>
          <OpenAtSource source={source} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AuthorityBadge level={source.authority_level} />
          <FreshnessIndicator source={source} />
          <VisibilityBadge value={source.visibility} />
        </div>
      </header>
      {source.visibility === "restricted" ? <RestrictedNotice /> : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Variant 1 — Dossier (accession record)                                    */
/* -------------------------------------------------------------------------- */

export function SourceDossier({
  source,
  bundle,
  related,
}: {
  source: Source;
  bundle: ContextBundleResponse | null;
  related: ReadonlyArray<Source>;
}) {
  const anchors = anchorsFor(source, bundle);
  const excerpts = excerptsFor(source, bundle);
  const fresh = classifyFreshness(source);
  const next = nextReviewDate(source);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-7">
      <DetailHeader source={source} />

      <div className="grid gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,1fr)_260px]">
        <main className="flex min-w-0 flex-col gap-7">
          <section className="flex flex-col gap-2.5">
            <SectionLabel>Authority over</SectionLabel>
            <ul className="flex flex-wrap gap-2">
              {source.authority_scope.map((scope) => (
                <li
                  key={scope}
                  className="rounded-[3px] border border-border bg-card px-2.5 py-1 font-mono text-[11.5px] text-foreground"
                >
                  {scope}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-2.5">
              <SectionLabel>Key sections</SectionLabel>
              <span className="rounded-[2px] bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
                {SOURCE_PROVENANCE[source.source_class]}
              </span>
            </div>
            {excerpts.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {excerpts.map((excerpt, i) => (
                  <li
                    key={excerpt.citation.anchor_id ?? excerpt.anchor_id ?? i}
                    className="flex flex-col gap-1 border-l-2 border-border pl-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-[10.5px] text-muted-foreground">
                        {excerpt.citation.label}
                      </code>
                      <a
                        href={excerpt.citation.location}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-[10.5px] text-primary underline-offset-2 hover:underline"
                      >
                        open source
                        <IconExternalLink aria-hidden className="size-3" />
                      </a>
                    </div>
                    <p className="max-w-[60ch] text-[12.5px] leading-[1.5] text-foreground/90">
                      {excerpt.text}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-[4px] border border-dashed border-border bg-card px-3.5 py-5 text-[12.5px] text-muted-foreground">
                {source.visibility === "restricted"
                  ? "Restricted source — Atlas surfaces metadata only; no excerpts are resolved."
                  : "No excerpts resolved from this source in the current context bundle."}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <SectionLabel>Citations resting on this source</SectionLabel>
              <span className="bg-background font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {anchors.length}
              </span>
            </div>
            <RestingCitations anchors={anchors} />
          </section>

          {related.length > 0 ? (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <SectionLabel>Related records</SectionLabel>
                <span className="bg-background font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  {related.length}
                </span>
              </div>
              <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
                {related.map((r, i) => (
                  <li key={r.id} className={cn(i > 0 && "border-t border-border")}>
                    <Link
                      to="/sources/$sourceId"
                      params={{ sourceId: r.id }}
                      className="group flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            FRESHNESS_META[classifyFreshness(r)].dot,
                          )}
                        />
                        <span className="truncate text-[12.5px] font-semibold text-foreground group-hover:text-brand-ink">
                          {r.title}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
                        {CLASS_LABEL[r.source_class]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </main>

        <aside className="flex min-w-0 flex-col gap-2.5">
          <SectionLabel>Record</SectionLabel>
          <dl className="flex flex-col rounded-[4px] border border-border bg-card px-4 py-1.5">
            <MetaRow label="Steward" value={source.steward} />
            <MetaRow label="Class" value={CLASS_LABEL[source.source_class]} />
            <MetaRow label="Visibility" value={source.visibility} mono />
            <MetaRow label="Cadence" value={`every ${cadenceLabel(source.review_frequency)}`} />
            <MetaRow label="Reviewed" value={fmtDate(source.last_reviewed_at)} />
            <MetaRow label="Observed" value={fmtDate(source.last_observed_at)} />
            {next ? <MetaRow label="Next review" value={fmtDate(next.toISOString())} /> : null}
            {source.observed_version !== undefined ? (
              <MetaRow label="Version" value={`v${source.observed_version}`} mono />
            ) : null}
            <MetaRow label="Citations" value={String(anchors.length)} />
          </dl>
          <p
            className={cn(
              "flex items-start gap-2 rounded-[4px] border px-3 py-2.5 text-[11.5px] leading-[1.45]",
              fresh === "stale"
                ? "border-critical/30 bg-critical/5 text-foreground"
                : fresh === "needs-review"
                  ? "border-warning/30 bg-warning/5 text-foreground"
                  : "border-border bg-card text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn("mt-1 size-2 shrink-0 rounded-full", FRESHNESS_META[fresh].dot)}
            />
            {FRESHNESS_VERDICT[fresh]}
          </p>
        </aside>
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-right text-[12.5px] font-semibold text-foreground",
          mono && "font-mono text-[11.5px] font-normal capitalize",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
