/**
 * Moment brief · route `/briefs/{moment}`
 * ======================================================================
 * One scoped `Brief` value (Step 4, I3/M9/P26) rendered for the human: the SAME
 * value the `/api/briefs/{moment}` JSON + `/briefs/{moment}.md` faces serve (face
 * drift is structurally inexpressible, I3), driven by the SAME shared APP /
 * landing-zone selector (in the app shell) as availability and my-changes.
 *
 * Each block states its question, its two-axis status, and its cited evidence;
 * per-zone blocks (availability, policy) render once per member zone (P26). The
 * human render asks the server for `excerpts` depth (the section bodies).
 *
 * P31 (load-bearing): the `change` moment is the DERIVED feed, never the editorial
 * What's New (`/whatsnew`) — separate surfaces that never merge.
 *
 * Data: the live assembled Brief (`fetchBrief`); in dev mock mode a deterministic
 * fictional Brief renders the surface.
 */
import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { moments, type BriefBlock, type BriefEvidence, type Moment } from "@atlas/schema";

import { briefQueryOptionsFor } from "@/api/queries";
import { useSituation } from "@/components/landing-zone/context";
import { PageBody, PageHeader } from "@/components/page-section";
import { Skeleton } from "@/components/ui/skeleton";
import { fireVerifyBeacon } from "@/lib/verifyBeacon";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/briefs/$moment")({
  loader: ({ context, params }) => {
    const moment = asMoment(params.moment);
    if (moment) {
      // Warm the unscoped brief without blocking navigation; the body reads the
      // scoped query (situation-dependent) and shows skeletons until it lands.
      void context.queryClient.ensureQueryData(briefQueryOptionsFor(moment));
    }
  },
  component: BriefRoute,
});

const MOMENT_LABEL: Record<Moment, string> = {
  adopt: "Adopt",
  build: "Build",
  debug: "Debug",
  change: "Change",
};

const MOMENT_DESCRIPTION: Record<Moment, string> = {
  adopt: "Can I adopt this service here? Availability per landing zone, plus its adoption context.",
  build: "What is my context? The join across the services this situation declares.",
  debug: "Diagnose an error — not yet available (arrives with the operational-location floor).",
  change: "What changed for me? The derived feed scoped to your situation (not What's New).",
};

const STATUS_TONE: Record<string, string> = {
  available: "text-emerald-600 dark:text-emerald-400",
  partial: "text-amber-600 dark:text-amber-400",
  unresolved: "text-muted-foreground",
};

function BriefRoute() {
  const { moment: rawMoment } = Route.useParams();
  const moment = asMoment(rawMoment);
  const { selectedApp } = useSituation();

  if (!moment) {
    return (
      <>
        <PageHeader title="Brief" description="Unknown moment." />
        <PageBody>
          <p className="text-sm text-muted-foreground">
            No such moment. Valid moments: {moments.join(", ")}.
          </p>
        </PageBody>
      </>
    );
  }

  const scope = selectedApp ? { landingZones: selectedApp.landingZoneIds } : undefined;
  const { data, isLoading } = useQuery(briefQueryOptionsFor(moment, scope));
  const blocks = data?.blocks ?? [];

  // Client-side render clock for the citation-follow beacon (P28 verification tax,
  // locked decision 6): the ms between the brief render and following a citation.
  // Re-stamped per moment — adopt→build re-renders without remount, so keying on
  // `moment` stops the prior moment's dwell leaking into `msSinceRender`.
  const renderedAtRef = useRef<number | null>(null);
  useEffect(() => {
    renderedAtRef.current = performance.now();
  }, [moment]);

  return (
    <>
      <PageHeader
        title={`${MOMENT_LABEL[moment]} brief`}
        description={
          selectedApp
            ? `${MOMENT_DESCRIPTION[moment]} Scoped to ${selectedApp.name}.`
            : MOMENT_DESCRIPTION[moment]
        }
      />
      <PageBody>
        {isLoading ? (
          <ul className="flex flex-col gap-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-24 w-full rounded-lg" />
              </li>
            ))}
          </ul>
        ) : blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {moment === "debug"
              ? "Debug briefs are not yet available — they arrive with the operational-location floor."
              : "No blocks in scope yet. Pick an app or landing zone, or set a target service."}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {blocks.map((block) => (
              <BriefBlockRow
                key={block.id}
                block={block}
                moment={moment}
                renderedAtRef={renderedAtRef}
              />
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}

function BriefBlockRow({
  block,
  moment,
  renderedAtRef,
}: {
  block: BriefBlock;
  moment: Moment;
  renderedAtRef: React.RefObject<number | null>;
}) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-foreground">{block.question}</h2>
        <span
          className={cn(
            "shrink-0 text-xs font-semibold uppercase tracking-wide",
            STATUS_TONE[block.status] ?? "text-muted-foreground",
          )}
        >
          {block.status}
          {block.landingZoneId ? ` · ${block.landingZoneId}` : ""}
        </span>
      </div>

      {block.evidence.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3">
          {block.evidence.map((evidence, index) => (
            <EvidenceRow
              key={`${evidence.resourceId}:${evidence.sectionId}:${index}`}
              evidence={evidence}
              moment={moment}
              renderedAtRef={renderedAtRef}
            />
          ))}
        </ul>
      ) : null}

      {block.warnings.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1">
          {block.warnings.map((warning, index) => (
            <li key={`${warning.code}:${index}`} className="text-xs text-muted-foreground">
              ⚠️ {warning.message}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function EvidenceRow({
  evidence,
  moment,
  renderedAtRef,
}: {
  evidence: BriefEvidence;
  moment: Moment;
  renderedAtRef: React.RefObject<number | null>;
}) {
  return (
    <li className="border-l-2 border-border pl-3">
      {evidence.excerpt ? (
        <p className="text-sm text-foreground">{evidence.excerpt}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {evidence.resourceId} · {evidence.sectionId}
        </p>
      )}
      {/* Provenance: every piece of evidence carries its citation (the join it delivers).
          Following one fires the citation-follow beacon (P28 verification tax). */}
      <ul className="mt-1 flex flex-col gap-0.5">
        {evidence.citations.map((citation, index) => (
          <li key={`${citation.sourceId}:${index}`} className="text-xs">
            <a
              href={citation.url}
              className="text-sky-600 hover:underline dark:text-sky-400"
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                const started = renderedAtRef.current ?? performance.now();
                fireVerifyBeacon({
                  moment,
                  sourceId: citation.sourceId,
                  msSinceRender: Math.max(0, Math.round(performance.now() - started)),
                });
              }}
            >
              {citation.title}
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}

function asMoment(value: string): Moment | undefined {
  return (moments as readonly string[]).includes(value) ? (value as Moment) : undefined;
}
