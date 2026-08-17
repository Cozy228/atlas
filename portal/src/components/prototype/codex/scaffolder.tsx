import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconCircleCheck,
  IconCloudCog,
  IconInfoCircle,
  IconLoader2,
  IconLock,
  IconPlayerPlay,
  IconShieldCheck,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { APP_CONTEXT, ONBOARDING_DECISIONS, RESOLVED_CONTEXT } from "./fixtures";
import { PrototypePanel, StateBadge } from "./ui";

type Stage = 1 | 2 | 3 | 4;

const STAGES = ["Intent", "Human decision", "Review", "Result"] as const;

export function CodexScaffolder() {
  const [stage, setStage] = useState<Stage>(1);
  const [exposure, setExposure] = useState<"internal" | "public" | "">("");
  const [running, setRunning] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const runAction = () => {
    setRunning(true);
    timer.current = window.setTimeout(() => {
      setRunning(false);
      setStage(4);
    }, 900);
  };

  const reset = () => {
    setStage(1);
    setExposure("");
    setRunning(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Governed action · fixture
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
            Prepare DEV runtime configuration
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Express the outcome. Atlas resolves platform parameters and asks only for a decision it
            cannot safely infer.
          </p>
        </div>
        <Progress value={stage * 25} className="gap-2" aria-label="Action progress">
          <ProgressLabel>{STAGES[stage - 1]}</ProgressLabel>
          <ProgressValue>{() => `Step ${stage} of 4`}</ProgressValue>
        </Progress>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to="/prototype/codex/onboarding" />}
        >
          <IconArrowLeft data-icon="inline-start" aria-hidden />
          Back to journey
        </Button>
      </header>

      <nav
        aria-label="Action steps"
        className="overflow-x-auto rounded-lg border border-border bg-card p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ol className="grid min-w-[640px] grid-cols-4">
          {STAGES.map((label, index) => {
            const number = (index + 1) as Stage;
            const complete = number < stage;
            const active = number === stage;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={number > stage || running}
                  onClick={() => setStage(number)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground",
                    active && "bg-brand-tint font-semibold text-brand-ink",
                    complete && "text-success-ink hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold",
                      active && "border-primary bg-primary text-primary-foreground",
                      complete && "border-success text-success-ink",
                    )}
                  >
                    {complete ? <IconCheck className="size-3.5" aria-hidden /> : number}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {stage === 1 ? <IntentStage onContinue={() => setStage(2)} /> : null}
      {stage === 2 ? (
        <DecisionStage
          exposure={exposure}
          setExposure={setExposure}
          onContinue={() => setStage(3)}
        />
      ) : null}
      {stage === 3 ? (
        <ReviewStage
          exposure={exposure}
          running={running}
          onRun={runAction}
          onBack={() => setStage(2)}
        />
      ) : null}
      {stage === 4 ? <ResultStage exposure={exposure} onReset={reset} /> : null}
    </div>
  );
}

function IntentStage({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <PrototypePanel className="p-5 lg:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand-ink">
            <IconCloudCog className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Intent
            </p>
            <h2 className="mt-1 text-xl font-bold">Make the DEV runtime ready for deployment</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Atlas will resolve the application, environment, account, region, naming, repository,
              and permission context from deterministic fixture relationships and policy.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["Application", APP_CONTEXT.name],
            ["Environment", APP_CONTEXT.environment],
            ["Outcome", "Validated runtime spec"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
              <p className="mt-2 text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end border-t border-border pt-5">
          <Button size="lg" onClick={onContinue}>
            Continue with this intent
            <IconArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        </div>
      </PrototypePanel>

      <PrototypePanel as="aside" className="p-5">
        <IconShieldCheck className="size-6 text-brand-ink" aria-hidden />
        <h2 className="mt-4 font-semibold">Action boundary</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Atlas prepares and triggers a simulated source-system request. The source remains
          responsible for execution, authorization, approval, and domain truth.
        </p>
        <Badge variant="outline" className="mt-4">
          No real changes
        </Badge>
      </PrototypePanel>
    </div>
  );
}

function DecisionStage({
  exposure,
  setExposure,
  onContinue,
}: {
  exposure: "internal" | "public" | "";
  setExposure: (value: "internal" | "public") => void;
  onContinue: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <PrototypePanel className="min-w-0 overflow-hidden">
        <div className="border-b border-border p-5 lg:p-6">
          <h2 className="text-xl font-bold">Resolved by Atlas</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            These values come from application context, observed relationships, policy, and platform
            defaults. They are not editable internal-ID fields.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-muted/55 text-xs uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Context</th>
                <th className="px-5 py-3 font-semibold">Resolved value</th>
                <th className="px-5 py-3 font-semibold">Source</th>
                <th className="px-5 py-3 font-semibold">State</th>
              </tr>
            </thead>
            <tbody>
              {RESOLVED_CONTEXT.map((entry) => (
                <tr key={entry.label} className="border-t border-border">
                  <th scope="row" className="px-5 py-3 font-semibold">
                    {entry.label}
                  </th>
                  <td className="px-5 py-3">{entry.value}</td>
                  <td className="px-5 py-3 text-muted-foreground">{entry.source}</td>
                  <td className="px-5 py-3">
                    <StateBadge state={entry.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PrototypePanel>

      <PrototypePanel className="p-5 lg:p-6">
        <Badge variant={exposure ? "brand" : "warning"}>
          {exposure ? "Decision captured" : "Human decision required"}
        </Badge>
        <h2 className="mt-4 text-xl font-bold">How should DEV be exposed?</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Atlas cannot safely infer this because endpoint exposure is a product decision, not
          missing system knowledge.
        </p>

        <fieldset className="mt-5 flex flex-col gap-3">
          <legend className="sr-only">DEV endpoint exposure</legend>
          {ONBOARDING_DECISIONS.map((decision) => (
            <label
              key={decision.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 hover:bg-muted/45",
                exposure === decision.id &&
                  "border-primary bg-brand-tint/45 ring-1 ring-primary/25",
              )}
            >
              <input
                type="radio"
                name="exposure"
                value={decision.id}
                checked={exposure === decision.id}
                onChange={() => setExposure(decision.id)}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-semibold">{decision.title}</span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  {decision.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5">
          {!exposure ? (
            <p className="flex items-start gap-2 text-sm text-warning-ink">
              <IconInfoCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Choose one option to continue. Atlas will not guess.
            </p>
          ) : null}
          <Button size="lg" disabled={!exposure} onClick={onContinue}>
            Review request
            <IconArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        </div>
      </PrototypePanel>
    </div>
  );
}

function ReviewStage({
  exposure,
  running,
  onRun,
  onBack,
}: {
  exposure: "internal" | "public" | "";
  running: boolean;
  onRun: () => void;
  onBack: () => void;
}) {
  const decision = ONBOARDING_DECISIONS.find((entry) => entry.id === exposure);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <PrototypePanel className="overflow-hidden">
        <div className="border-b border-border p-5 lg:p-6">
          <h2 className="text-xl font-bold">Review before execution</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Confirm the intent, resolved context, human decision, destination, and observable
            evidence before triggering the fixture action.
          </p>
        </div>
        <dl className="grid sm:grid-cols-2">
          {[
            ["Application", `${APP_CONTEXT.name} · ${APP_CONTEXT.code}`],
            ["Environment", APP_CONTEXT.environment],
            ["Human decision", decision?.title ?? "Not selected"],
            ["Source system", "Cloud orchestration system (simulated)"],
            ["Prepared change", "Correct runtime key contract and endpoint policy"],
            ["Expected evidence", "Validation run, logs, result, source link"],
          ].map(([label, value], index) => (
            <div
              key={label}
              className={cn(
                "p-5",
                index > 1 && "border-t border-border",
                index % 2 === 1 && "sm:border-l sm:border-border",
              )}
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-2 text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-border bg-muted/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Payload preview · fixture
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background p-4 font-mono text-xs leading-6 text-foreground">
            {JSON.stringify(
              {
                action: "prepare_dev_runtime",
                application: "APP-4821",
                environment: "DEV",
                exposure,
                simulated: true,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </PrototypePanel>

      <PrototypePanel className="flex flex-col p-5 lg:p-6">
        <IconLock className="size-6 text-brand-ink" aria-hidden />
        <h2 className="mt-4 font-semibold">Execution boundary</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Atlas will send this fixture request to a simulated source system, observe progress, and
          preserve evidence. No production resource or approval is changed.
        </p>
        <ul className="mt-5 flex flex-col gap-3 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <IconCheck className="mt-0.5 size-4 text-success-ink" aria-hidden />
            Inputs reviewed
          </li>
          <li className="flex gap-2">
            <IconCheck className="mt-0.5 size-4 text-success-ink" aria-hidden />
            Permission context resolved
          </li>
          <li className="flex gap-2">
            <IconCheck className="mt-0.5 size-4 text-success-ink" aria-hidden />
            Result evidence configured
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5">
          <Button size="lg" onClick={onRun} disabled={running}>
            {running ? (
              <>
                <IconLoader2 className="animate-spin" data-icon="inline-start" aria-hidden />
                Running fixture action…
              </>
            ) : (
              <>
                <IconPlayerPlay data-icon="inline-start" aria-hidden />
                Run simulated action
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={onBack} disabled={running}>
            Change decision
          </Button>
        </div>
      </PrototypePanel>
    </div>
  );
}

function ResultStage({ exposure, onReset }: { exposure: string; onReset: () => void }) {
  return (
    <PrototypePanel className="mx-auto w-full max-w-3xl overflow-hidden">
      <div className="flex flex-col items-center px-5 py-10 text-center sm:px-8">
        <span className="flex size-14 items-center justify-center rounded-full border border-success/45 bg-success/[0.055] text-success-ink">
          <IconCircleCheck className="size-8" aria-hidden />
        </span>
        <Badge variant="success" className="mt-4">
          Simulated action succeeded
        </Badge>
        <h2 className="mt-4 text-2xl font-bold tracking-[-0.025em]">Runtime request prepared</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Fixture run RUN-ACT-2048 prepared the corrected DEV specification with exposure set to{" "}
          <strong className="text-foreground">{exposure}</strong>. Atlas observed the result and
          recorded evidence; no external system was changed.
        </p>
      </div>
      <dl className="grid border-t border-border bg-muted/30 sm:grid-cols-3">
        {[
          ["Run", "RUN-ACT-2048"],
          ["Result", "Prepared for review"],
          ["Evidence", "4 source records"],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={cn("p-5 text-center", index > 0 && "sm:border-l sm:border-border")}
          >
            <dt className="text-xs uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
            <dd className="mt-2 font-mono text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onReset}>
          Start over
        </Button>
        <Button nativeButton={false} render={<Link to="/prototype/codex/diagnosis" />}>
          View diagnosis evidence
          <IconArrowRight data-icon="inline-end" aria-hidden />
        </Button>
      </div>
    </PrototypePanel>
  );
}
