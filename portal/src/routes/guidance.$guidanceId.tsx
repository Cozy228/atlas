import { useMemo } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { IconArrowRight, IconCheck, IconCircleCheck, IconFlag } from "@tabler/icons-react";
import type { Source } from "@atlas/schema";

import { sourceDiscoveryQueryOptions } from "@/api/queries";
import { BackLink } from "@/components/detail/detail-shell";
import { AuthorityBadge, FreshnessIndicator } from "@/components/evidence/badges";
import { ActionControl, GuidanceTypeBadge } from "@/components/guidance/shared";
import { PageBody } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import {
  defaultStepId,
  getGuidance,
  stepStatus,
  type Guidance,
  type GuidanceStep,
  type StepStatus,
} from "@/lib/guidance";
import { taskKey, useGuidanceProgress, type GuidanceProgress } from "@/lib/guidance-progress";
import { cn } from "@/lib/utils";

type WorkspaceSearch = { step?: string };

export const Route = createFileRoute("/guidance/$guidanceId")({
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    step: typeof search.step === "string" ? search.step : undefined,
  }),
  loader: async ({ context, params }) => {
    const guidance = getGuidance(params.guidanceId);
    if (!guidance) throw notFound();
    const sourcesResp = await context.queryClient.ensureQueryData(sourceDiscoveryQueryOptions);
    return { guidance, sources: sourcesResp.sources };
  },
  component: GuidanceWorkspaceRoute,
});

function GuidanceWorkspaceRoute() {
  const { guidance, sources } = Route.useLoaderData();
  const { step } = Route.useSearch();
  const progress = useGuidanceProgress(guidance.id);

  const selectedId =
    step && guidance.steps.some((s) => s.id === step) ? step : defaultStepId(guidance);
  const selectedIndex = guidance.steps.findIndex((s) => s.id === selectedId);
  const selected = guidance.steps[selectedIndex]!;
  const nextStep = guidance.steps[selectedIndex + 1];

  const sourceMap = useMemo(
    () => new Map<string, Source>(sources.map((s) => [s.id, s])),
    [sources],
  );

  const completableSteps = guidance.steps.filter((s) => s.kind !== "destination");
  const totalCount = completableSteps.length;
  const doneCount = completableSteps.filter((s) => progress.completedSteps.has(s.id)).length;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <PageBody width="comfortable" gap="compact">
      <BackLink to="/guidance" label="All guidance" />

      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {guidance.scenario.replace(/_/g, " ")}
          </span>
          <GuidanceTypeBadge type={guidance.type} />
          {guidance.status !== "published" ? (
            <Badge variant={guidance.status === "deprecated" ? "critical" : "warning"}>
              {guidance.status.replace("_", " ")}
            </Badge>
          ) : null}
        </div>
        <h1 className="type-heading font-semibold tracking-[-0.03em] text-foreground sm:type-heading-lg">
          {guidance.title}
        </h1>
        <p className="max-w-[68ch] type-body leading-[1.6] text-muted-foreground">
          {guidance.objective}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
            <IconFlag className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="font-mono type-caption font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Destination
            </span>
            <span className="font-semibold text-foreground">{guidance.destination.title}</span>
          </div>
          <ProgressStrip done={doneCount} total={totalCount} pct={pct} onReset={progress.reset} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-8">
        <aside className="lg:sticky lg:top-[72px] lg:self-start">
          <Stepper guidance={guidance} selectedId={selectedId} progress={progress} />
        </aside>
        <main className="min-w-0">
          <StepPanel
            guidance={guidance}
            step={selected}
            index={selectedIndex}
            sourceMap={sourceMap}
            nextStep={nextStep}
            progress={progress}
            allDone={totalCount > 0 && doneCount === totalCount}
          />
        </main>
      </div>
    </PageBody>
  );
}

function ProgressStrip({
  done,
  total,
  pct,
  onReset,
}: {
  done: number;
  total: number;
  pct: number;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Steps complete"
      >
        <span
          className="block h-full rounded-full bg-success transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono type-caption tabular-nums text-muted-foreground">
        {done} / {total} steps
      </span>
      {done > 0 ? (
        <button
          type="button"
          onClick={onReset}
          className="rounded-sm font-mono type-caption uppercase tracking-[0.05em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}

const STEP_MARKER: Record<StepStatus, string> = {
  available: "border-border-strong bg-card text-muted-foreground",
  selected: "border-primary bg-primary text-primary-foreground",
  destination: "border-primary bg-brand-tint text-primary",
  blocked: "border-critical bg-critical/15 text-critical",
  needs_support: "border-warning bg-warning/15 text-warning-foreground",
};

function Stepper({
  guidance,
  selectedId,
  progress,
}: {
  guidance: Guidance;
  selectedId: string;
  progress: GuidanceProgress;
}) {
  const completableIds = guidance.steps.filter((s) => s.kind !== "destination").map((s) => s.id);
  const allDone =
    completableIds.length > 0 && completableIds.every((id) => progress.completedSteps.has(id));

  return (
    <nav aria-label="Guidance steps">
      <ol className="flex flex-col gap-0">
        {guidance.steps.map((step, index) => {
          const status = stepStatus(step, selectedId);
          const isLast = index === guidance.steps.length - 1;
          const isComplete =
            step.kind === "destination" ? allDone : progress.completedSteps.has(step.id);
          return (
            <li key={step.id} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[0.625rem] font-bold",
                    isComplete ? "border-success bg-success text-success-foreground" : STEP_MARKER[status],
                  )}
                >
                  {isComplete ? (
                    <IconCheck className="size-3.5" strokeWidth={3} />
                  ) : step.kind === "destination" ? (
                    "★"
                  ) : (
                    index + 1
                  )}
                </span>
                {!isLast ? (
                  <span
                    aria-hidden
                    className={cn(
                      "w-px flex-1",
                      isComplete
                        ? "bg-success/40"
                        : status === "selected"
                          ? "bg-primary/40"
                          : "bg-border",
                    )}
                  />
                ) : null}
              </div>
              <Link
                to="/guidance/$guidanceId"
                params={{ guidanceId: guidance.id }}
                search={{ step: step.id }}
                className={cn(
                  "mb-3 flex min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 transition-colors",
                  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  status === "selected" && "bg-brand-tint",
                )}
                aria-current={status === "selected" ? "step" : undefined}
              >
                <span
                  className={cn(
                    "truncate type-detail font-semibold",
                    status === "selected" ? "text-primary" : "text-foreground",
                  )}
                >
                  {step.title}
                </span>
                <span className="font-mono type-caption uppercase tracking-[0.05em] text-muted-foreground">
                  {isComplete && step.kind !== "destination"
                    ? "done"
                    : step.marker
                      ? step.marker.replace("_", " ")
                      : step.kind}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepPanel({
  guidance,
  step,
  index,
  sourceMap,
  nextStep,
  progress,
  allDone,
}: {
  guidance: Guidance;
  step: GuidanceStep;
  index: number;
  sourceMap: Map<string, Source>;
  nextStep?: GuidanceStep;
  progress: GuidanceProgress;
  allDone: boolean;
}) {
  if (step.kind === "destination") {
    return (
      <section className="flex flex-col gap-4 rounded-lg border border-primary/30 bg-brand-tint/40 p-6">
        <div className="flex items-center gap-2">
          <IconCircleCheck
            className={cn("size-5", allDone ? "text-success" : "text-primary")}
            aria-hidden
          />
          <h2 className="type-heading font-semibold tracking-[-0.02em] text-foreground">
            {step.title}
          </h2>
        </div>
        {step.description ? (
          <p className="max-w-[64ch] type-body leading-[1.6] text-muted-foreground">
            {step.description}
          </p>
        ) : null}
        <p className="type-detail text-muted-foreground">
          {guidance.destination.description ?? guidance.destination.title}
        </p>
        {allDone ? (
          <p className="flex items-center gap-1.5 type-detail font-semibold text-success">
            <IconCheck className="size-4" strokeWidth={3} aria-hidden />
            All steps marked complete.
          </p>
        ) : null}
      </section>
    );
  }

  const stepDone = progress.completedSteps.has(step.id);
  const tasks = step.tasks ?? [];
  const doneTasks = tasks.filter((t) => progress.completedTasks.has(taskKey(step.id, t.id))).length;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="font-mono type-caption font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Step {index + 1} · {step.marker ? step.marker.replace("_", " ") : step.kind}
        </span>
        <h2 className="type-heading font-semibold tracking-[-0.02em] text-foreground">
          {step.title}
        </h2>
        {step.description ? (
          <p className="max-w-[68ch] type-body leading-[1.6] text-muted-foreground">
            {step.description}
          </p>
        ) : null}
      </div>

      {step.marker ? <MarkerNote marker={step.marker} support={support(guidance, step)} /> : null}

      {step.why ? (
        <Panel title="Why this matters">
          <p className="type-detail leading-[1.6] text-muted-foreground">{step.why}</p>
        </Panel>
      ) : null}

      {step.options && step.options.length > 0 ? (
        <Panel title="Choose a path">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {step.options.map((option) => (
              <div key={option.id} className="rounded-lg border border-border bg-card p-3.5">
                <p className="type-detail font-bold text-foreground">{option.title}</p>
                {option.description ? (
                  <p className="mt-1 type-caption leading-5 text-muted-foreground">
                    {option.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {tasks.length > 0 ? (
        <Panel title="Tasks" meta={`${doneTasks} / ${tasks.length}`}>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {tasks.map((task) => {
              const done = progress.completedTasks.has(taskKey(step.id, task.id));
              return (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    onClick={() => progress.toggleTask(taskKey(step.id, task.id))}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CheckBox checked={done} />
                    <span
                      className={cn(
                        "min-w-0 type-detail",
                        done ? "text-muted-foreground line-through" : "text-foreground",
                      )}
                    >
                      {task.title}
                    </span>
                    {task.required ? (
                      <span className="font-mono type-caption uppercase tracking-[0.05em] text-muted-foreground">
                        required
                      </span>
                    ) : null}
                  </button>
                  {task.action ? <ActionControl action={task.action} /> : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {step.sources && step.sources.length > 0 ? (
        <Panel title="Evidence">
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {step.sources.map((sourceId) => {
              const source = sourceMap.get(sourceId);
              return (
                <li
                  key={sourceId}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                >
                  {source ? (
                    <>
                      <Link
                        to="/sources/$sourceId"
                        params={{ sourceId: source.id }}
                        className="type-detail font-semibold text-foreground hover:text-primary"
                      >
                        {source.title}
                      </Link>
                      <span className="flex items-center gap-1.5">
                        <AuthorityBadge level={source.authority_level} />
                        <FreshnessIndicator source={source} />
                      </span>
                    </>
                  ) : (
                    <span className="font-mono type-caption text-muted-foreground">{sourceId}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <SupportRow support={support(guidance, step)} />

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <button
          type="button"
          aria-pressed={stepDone}
          onClick={() => progress.toggleStep(step.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            stepDone
              ? "border border-success/40 bg-success/10 text-success hover:bg-success/15"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          <IconCheck className="size-3.5" strokeWidth={3} aria-hidden />
          {stepDone ? "Step complete" : "Mark step complete"}
        </button>
        {nextStep ? (
          <Link
            to="/guidance/$guidanceId"
            params={{ guidanceId: guidance.id }}
            search={{ step: nextStep.id }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors",
              "hover:border-border-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            Next: {nextStep.title}
            <IconArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        checked
          ? "border-success bg-success text-success-foreground"
          : "border-border-strong bg-card text-transparent",
      )}
    >
      <IconCheck className="size-3" strokeWidth={3} />
    </span>
  );
}

function support(guidance: Guidance, step: GuidanceStep): { team: string; channel: string } {
  return step.support ?? { team: guidance.owner.team, channel: guidance.owner.support };
}

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono type-caption font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {title}
        </h3>
        {meta ? (
          <span className="font-mono type-caption tabular-nums text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function MarkerNote({
  marker,
  support,
}: {
  marker: "blocked" | "needs_support";
  support: { team: string; channel: string };
}) {
  const isBlocked = marker === "blocked";
  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-xs",
        isBlocked
          ? "border-critical/40 bg-critical/10 text-foreground"
          : "border-warning/40 bg-warning/10 text-foreground",
      )}
    >
      <p className="font-semibold">
        {isBlocked ? "This step is blocked." : "This step may need support."}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        Reach {support.team} on <span className="font-mono">{support.channel}</span> before
        continuing.
      </p>
    </div>
  );
}

function SupportRow({ support }: { support: { team: string; channel: string } }) {
  return (
    <Panel title="Need help?">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">{support.team}</span>
        <span className="font-mono text-muted-foreground">{support.channel}</span>
      </div>
    </Panel>
  );
}
