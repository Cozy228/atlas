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

import { CLASS_LABEL, FRESHNESS_META } from "./shared";

const DAY_MS = 86_400_000;

/**
 * Mock "key sections" per source class — fictional, public-safe excerpts that
 * give the dossier's main column substance (the registry stores metadata, not
 * full text). Labelled as a demo excerpt where shown.
 */
const KEY_SECTIONS: Record<
  Source["source_class"],
  ReadonlyArray<{ anchor: string; text: string }>
> = {
  "terraform-module": [
    {
      anchor: "§ inputs",
      text: "Variables gate the blast radius: scope, tags, and a required owner are mandatory inputs.",
    },
    {
      anchor: "§ iam",
      text: "Provisions least-privilege roles; wildcard policies are rejected at plan time.",
    },
    {
      anchor: "§ outputs",
      text: "Exports the network and identifier outputs downstream modules depend on.",
    },
  ],
  "confluence-page": [
    {
      anchor: "# overview",
      text: "Describes the approved request-and-approval flow, with the required reviewers per environment.",
    },
    {
      anchor: "# steps",
      text: "Walks the change from intake to promotion, linking the runbook for the rollback path.",
    },
    {
      anchor: "# owners",
      text: "Names the accountable team and the escalation channel for exceptions.",
    },
  ],
  "policy-document": [
    {
      anchor: "§ controls",
      text: "States the mandatory controls and the enforcement point each one is checked at.",
    },
    {
      anchor: "§ exceptions",
      text: "Defines the exception process, its approvers, and the maximum waiver window.",
    },
    {
      anchor: "§ mapping",
      text: "Cites the upstream standard each control maps to, for audit traceability.",
    },
  ],
  "availability-matrix": [
    {
      anchor: "→ cell",
      text: "Answers a Service × region availability query at the grain it pins — cell, row, or column — each with a matrix citation.",
    },
  ],
};

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

/**
 * A demo revision log for the dossier's main column: the two real events
 * (reviewed, observed) plus earlier entries projected from the cadence. Marked
 * as a demo log where shown; gives the record a history without inventing facts.
 */
function revisionLog(source: Source): ReadonlyArray<{ date: string; label: string }> {
  const windowMs = parseDurationToMs(source.review_frequency) ?? 90 * DAY_MS;
  const reviewedMs = new Date(source.last_reviewed_at).getTime();
  const back = (cycles: number) => fmtDate(new Date(reviewedMs - windowMs * cycles).toISOString());
  return [
    {
      date: fmtDate(source.last_reviewed_at),
      label: `Reviewed by ${source.steward}; authority reaffirmed.`,
    },
    {
      date: fmtDate(source.last_observed_at),
      label:
        source.observed_version !== undefined
          ? `Observed at the source; version recorded as v${source.observed_version}.`
          : "Observed at the source; fingerprint unchanged.",
    },
    { date: back(1), label: "Scope reviewed on schedule; no drift detected." },
    { date: back(2), label: `Authority level set to ${source.authority_level}.` },
    { date: back(3), label: `Registered in the source registry under ${source.steward}.` },
  ];
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
                demo excerpt
              </span>
            </div>
            <ul className="flex flex-col gap-2.5">
              {KEY_SECTIONS[source.source_class].map((section) => (
                <li
                  key={section.anchor}
                  className="flex flex-col gap-0.5 border-l-2 border-border pl-3"
                >
                  <code className="font-mono text-[10.5px] text-muted-foreground">
                    {section.anchor}
                  </code>
                  <p className="max-w-[60ch] text-[12.5px] leading-[1.5] text-foreground/90">
                    {section.text}
                  </p>
                </li>
              ))}
            </ul>
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

          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-2.5">
              <SectionLabel>Revision history</SectionLabel>
              <span className="rounded-[2px] bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
                demo log
              </span>
            </div>
            <ol className="flex flex-col">
              {revisionLog(source).map((rev, i) => (
                <li
                  key={`${rev.date}-${i}`}
                  className={cn(
                    "grid grid-cols-[88px_minmax(0,1fr)] gap-x-4 py-2.5",
                    i > 0 && "border-t border-border",
                  )}
                >
                  <span className="font-mono text-[11px] tabular-nums leading-[1.5] text-muted-foreground">
                    {rev.date}
                  </span>
                  <span className="text-[12.5px] leading-[1.5] text-foreground/90">
                    {rev.label}
                  </span>
                </li>
              ))}
            </ol>
          </section>
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
