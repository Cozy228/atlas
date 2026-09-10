import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { motionDuration, motionEase, useOnboardingMotion } from "./motion";
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconCopy,
  IconExternalLink,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconGitPullRequest,
  IconLoader2,
} from "@tabler/icons-react";
import { ScaffoldArchitecture } from "./scaffold-architecture";
import { ScaffoldPreview } from "./scaffold-preview";
import type { ScaffoldFileConfig } from "./scaffold-files";
import {
  allPrsMerged,
  executionInputs,
  executionPhase,
  executionPhases,
  executionPatch,
  nextExecutionPhase,
  prState,
  runPhaseKey,
  type ExecutionPhase,
} from "./ecs-run";
import { ecsPipelineRuns } from "./ecs-journey";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./uipros/accordion";
import { Button } from "./uipros/button";
import { Input } from "./uipros/input";
import { cn } from "@/lib/utils";
import "./ecs-run.css";

function ExecutionAction({ children }: { children: ReactNode }) {
  const { reduced } = useOnboardingMotion();
  const present = useIsPresent();
  return (
    <motion.div
      className={cn(
        !present &&
          "pointer-events-none absolute top-0 right-0 left-6 @max-[800px]:top-6 @max-[800px]:left-0",
      )}
      inert={!present}
      aria-hidden={!present}
      initial={{ opacity: 0, y: reduced ? 0 : 6, filter: reduced ? "blur(0px)" : "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: reduced ? 0 : -3, transition: { duration: reduced ? 0 : 0.12 } }}
      transition={{ duration: reduced ? 0 : 0.32, ease: motionEase.out }}
    >
      {children}
    </motion.div>
  );
}

function ExecutionFiles({ children }: { children: ReactNode }) {
  const { reduced } = useOnboardingMotion();
  const present = useIsPresent();
  return (
    <motion.div
      className="overflow-hidden"
      inert={!present}
      aria-hidden={!present}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: reduced ? 0 : motionDuration.task, ease: motionEase.out }}
    >
      {children}
    </motion.div>
  );
}

export function EcsRunView({
  config,
  values,
  onValueChange,
  onFinish,
  onEdit,
  onRepositorySetup,
}: {
  config: ScaffoldFileConfig;
  values: Record<string, string>;
  onValueChange: (key: string, value: string) => void;
  onFinish: () => void;
  onEdit: () => void;
  onRepositorySetup: () => void;
}) {
  const { reduced } = useOnboardingMotion();
  const phase = executionPhase(values[runPhaseKey]) ?? executionPhases[0];
  const [paused, setPaused] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [fileScope, setFileScope] = useState<"infra" | "app">("infra");
  const [checked, setChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const complete = phase.id === "complete";
  const merged = allPrsMerged(values);
  const activePr =
    phase.id === "waiting-pr" ? "infra" : phase.id === "waiting-app-pr" ? "app" : null;
  const activePrMerged = activePr !== null && prState(values, activePr) === "merged";
  const infrastructureReady = values["journey:ecs-service:infra-run"] === "true";
  const canCreateApp =
    infrastructureReady &&
    Boolean(values["artifact:app-repository:repository"]?.trim()) &&
    ["taskRoleArn", "executionRoleArn", "logGroup", "cluster"].every((key) =>
      Boolean(values[`journey:ecs-service:output:${key}`]),
    );
  const applyStep = Number(values["journey:ecs-service:apply-step"] ?? 0);
  const inputs = executionInputs(config, values);
  const pipelineKind =
    phase.id === "waiting-resources"
      ? "resources"
      : phase.id === "checking-pipeline"
        ? "infra"
        : phase.id === "waiting-ci"
          ? "ci"
          : phase.id === "waiting-deploy"
            ? "deploy"
            : null;
  const pipeline = ecsPipelineRuns.find((run) => run.kind === pipelineKind);
  const parameters = Object.fromEntries(
    (pipeline?.inputs ?? []).map((input) => [
      input.key,
      values[`journey:ecs-service:parameter:${pipelineKind}:${input.key}`] ??
        inputs[input.source] ??
        "",
    ]),
  );
  const missing = Object.values(parameters).some((value) => !value.trim());
  const pipelineArtifact = pipeline?.artifactId;
  function go(next: ExecutionPhase) {
    const patch = executionPatch(
      next,
      config.serviceName,
      values["journey:ecs-service:parameter:infra:account"] ?? config.account,
    );
    if (patch["journey:ecs-service:output:cluster"])
      patch["journey:ecs-service:output:cluster"] =
        values["journey:ecs-service:parameter:infra:cluster"] ?? config.cluster;
    if (patch["journey:ecs-service:output:imageTag"]) {
      const tag = values["journey:ecs-service:parameter:ci:imageTag"] ?? "build-001";
      patch["journey:ecs-service:output:imageTag"] = tag;
      patch["artifact:ci-pipeline:image"] = `${config.serviceName}:${tag}`;
    }
    for (const [key, value] of Object.entries(patch)) onValueChange(key, value);
    setCopied(false);
    setChecked(false);
  }
  const advanceResource = useEffectEvent(() =>
    onValueChange("journey:ecs-service:apply-step", String(applyStep + 1)),
  );
  useEffect(() => {
    if (phase.id !== "applying" || paused || applyStep >= 3) return;
    const timer = setTimeout(advanceResource, 1800);
    return () => clearTimeout(timer);
  }, [phase.id, paused, applyStep]);
  function advanceRun() {
    const next = nextExecutionPhase(phase.id);
    if (next) go(next.id);
  }
  function checkNow() {
    setChecked(true);
    if (activePrMerged) advanceRun();
  }
  const advanceSimulation = useEffectEvent(() => {
    if (activePr) checkNow();
    else advanceRun();
  });
  useEffect(() => {
    if (paused) return;
    if (activePr) {
      const timer = setInterval(advanceSimulation, 4500);
      return () => clearInterval(timer);
    }
    if (!phase.duration) return;
    const timer = setTimeout(advanceSimulation, phase.duration);
    return () => clearTimeout(timer);
  }, [phase, paused, activePr]);
  const appReview = phase.id === "task-definition";
  const approval = phase.id === "awaiting-apply";
  const waitingTfe = phase.id === "waiting-tfe";
  const running = phase.duration > 0;
  const applicationStage = infrastructureReady;
  const scope = activePr ?? (applicationStage ? "app" : "infra");
  const repository = scope === "infra" ? config.infraRepo : config.appRepo;
  const prUrl =
    values[`artifact:${scope}-pr:url`] ||
    `https://git.example.com/demo/${encodeURIComponent(repository)}/pull/1`;
  const runKind =
    pipelineKind ??
    (applicationStage
      ? phase.id === "running-resources"
        ? "resources"
        : phase.id === "building"
          ? "ci"
          : "deploy"
      : "infra");
  const runArtifact = ecsPipelineRuns.find((run) => run.kind === runKind)?.artifactId;
  const runUrl = runArtifact ? values[`artifact:${runArtifact}:url`] : undefined;
  const status = complete
    ? "complete"
    : activePr
      ? prState(values, activePr)
      : running
        ? "running"
        : waitingTfe
          ? "waiting"
          : approval
            ? "approval"
            : "ready";
  const statusLabel = complete
    ? "Deployment healthy"
    : activePr
      ? {
          open: "Awaiting merge",
          merged: "Merged",
          closed: "PR closed",
          unknown: "Status unavailable",
        }[prState(values, activePr)]
      : waitingTfe
        ? "TFE · Waiting to start"
        : phase.id === "planning"
          ? "TFE · Plan running"
          : phase.id === "applying"
            ? "TFE · Apply running"
            : running
              ? "Harness · Running"
              : approval
                ? "TFE · Approval needed"
                : pipeline
                  ? "Harness · Not started"
                  : "Ready for you";
  const actionTitle = complete
    ? "Your service is ready"
    : activePr
      ? `Merge the ${scope === "infra" ? "infrastructure" : "application"} PR`
      : approval
        ? "Approve the Terraform plan"
        : pipelineKind === "infra"
          ? "Create the infrastructure"
          : pipelineKind === "resources"
            ? "Set up application delivery"
            : pipelineKind === "ci"
              ? "Build the application image"
              : pipelineKind === "deploy"
                ? `Deploy ${config.serviceName}`
                : appReview
                  ? "Create the application PR"
                  : phase.title;
  const description =
    pipelineKind === "infra"
      ? "Run the infrastructure pipeline in Harness. It uses Terraform to create the AWS resources shown here."
      : pipelineKind === "resources"
        ? "Run the self-service pipeline to create the Harness service, environment and delivery configuration."
        : pipelineKind === "ci"
          ? "Build and publish the container image from your application repository."
          : pipelineKind === "deploy"
            ? "Deploy the completed build to this ECS cluster through Harness and Terraform."
            : appReview
              ? "Infrastructure outputs have been added to the task definition and deployment configuration."
              : activePr
                ? "Open the PR in GitHub to review and merge it. Its status is checked automatically."
                : phase.detail;
  function openFile(path: string) {
    setFileScope(path === "ecs/service.tf" || path === "pipelines/infra.yaml" ? "infra" : "app");
    setFile(path);
  }
  const fileConfig = {
    ...config,
    cluster: inputs.cluster,
    account: values["journey:ecs-service:parameter:infra:account"] ?? config.account,
    taskRoleArn: inputs.taskRoleArn,
    executionRoleArn: inputs.executionRoleArn,
    logGroup: inputs.logGroup,
    imageTag: inputs.imageTag,
    privateSubnetIds: inputs.privateSubnetIds,
    taskSecurityGroupIds: inputs.taskSecurityGroupIds,
    targetGroupArn: inputs.targetGroupArn,
  };
  return (
    <div className="ecs-live-run @container min-w-0" data-phase={phase.id}>
      <header className="flex min-h-20 items-end justify-between gap-4 border-b border-border py-2 pb-6">
        <div>
          <span className="m-0 text-xs leading-6 text-muted-foreground">
            {applicationStage ? "Application delivery" : "Infrastructure"}
          </span>
          <h2 className="m-0 text-[24px] font-semibold leading-8 text-foreground [overflow-wrap:anywhere]">
            {config.serviceName}
          </h2>
        </div>
        <p className="m-0 text-xs leading-6 text-muted-foreground">
          {config.environment} · {config.region} · Internal
        </p>
      </header>
      {appReview && (
        <ScaffoldPreview
          config={fileConfig}
          onEdit={onEdit}
          scope="app"
          executionPhase={phase.id}
        />
      )}
      <div
        className={`ecs-execution-workspace grid min-h-[512px] items-start gap-8 pt-6 @max-[800px]:gap-6 ${appReview ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_320px] @max-[800px]:grid-cols-1"}`}
      >
        {!appReview && (
          <section className="min-w-0" aria-label="Deployment architecture">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="m-0 text-[14px] font-[550] leading-6">Architecture</h3>
              <span className="m-0 text-xs leading-6 text-muted-foreground">Planned → Created</span>
            </div>
            <ScaffoldArchitecture
              config={{ ...config, cluster: inputs.cluster }}
              executionPhase={phase.id}
              applyStep={applyStep}
              onOpenFile={openFile}
            />
          </section>
        )}
        <aside
          className="relative min-h-96 min-w-0 border-l border-border pl-6 @max-[800px]:min-h-0 @max-[800px]:border-t @max-[800px]:border-l-0 @max-[800px]:px-0 @max-[800px]:pt-6"
          aria-label="Current action"
        >
          <AnimatePresence initial={false} mode="sync">
            <ExecutionAction key={phase.id}>
              {complete && (
                <motion.span
                  className="inline-flex size-8 items-center justify-center rounded-full bg-success/10 text-success-ink"
                  aria-hidden="true"
                  initial={{
                    opacity: 0,
                    scale: reduced ? 1 : 0.25,
                    filter: reduced ? "blur(0px)" : "blur(4px)",
                  }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  transition={{ type: "spring", duration: reduced ? 0 : 0.3, bounce: 0 }}
                >
                  <IconCheck size={22} />
                </motion.span>
              )}
              {!complete && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs leading-6 text-muted-foreground",
                    status === "open" && "text-[var(--color-pr-open)]",
                    status === "merged" && "text-[var(--color-pr-merged)]",
                    status === "closed" && "text-[var(--color-error)]",
                    status === "approval" && "text-warning-ink",
                    status === "running" && "text-info-ink",
                    status === "complete" && "text-success-ink",
                  )}
                  data-status={status}
                  data-pr-state={activePr ? status : undefined}
                  role="status"
                >
                  {running ? (
                    <IconLoader2
                      size={15}
                      className="motion-safe:animate-[ecs-check-spin_1.5s_linear_infinite] motion-reduce:animate-none"
                    />
                  ) : activePr ? (
                    <IconGitPullRequest size={15} />
                  ) : complete ? (
                    <IconCheck size={15} />
                  ) : (
                    <IconClock size={15} />
                  )}
                  {statusLabel}
                </span>
              )}
              <h3 className="mt-4 mb-2 text-[20px] font-semibold leading-7 text-foreground">
                {actionTitle}
              </h3>
              <p className="m-0 text-[13px] leading-6 text-muted-foreground">{description}</p>
              {activePr && (
                <div className="mt-5 grid min-w-0 gap-1">
                  <span className="text-xs leading-6 text-muted-foreground">Target repository</span>
                  <strong className="text-[13px] font-[550] leading-6 [overflow-wrap:anywhere]">
                    {repository}
                  </strong>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-self-start pl-0"
                    onClick={() =>
                      openFile(scope === "infra" ? "ecs/service.tf" : "ecs/task-definition.json")
                    }
                  >
                    Review files
                  </Button>
                </div>
              )}
              {pipeline && (
                <div className="mt-5 grid min-w-0 gap-1">
                  <span className="text-xs leading-6 text-muted-foreground">
                    {pipelineKind === "deploy" ? "Image to deploy" : "Pipeline"}
                  </span>
                  <strong className="text-[13px] font-[550] leading-6 [overflow-wrap:anywhere]">
                    {pipelineKind === "deploy"
                      ? `${config.serviceName}:${inputs.imageTag}`
                      : values[`artifact:${pipelineArtifact}:pipeline`] || pipeline.title}
                  </strong>
                  {!missing && (
                    <small className="text-xs leading-6 text-muted-foreground">
                      Inputs ready · {pipeline.inputs.length} values filled
                    </small>
                  )}
                </div>
              )}
              {appReview && !values["artifact:app-repository:repository"]?.trim() && (
                <div className="mt-5 grid min-w-0 gap-1">
                  <strong className="text-[13px] font-[550] leading-6 [overflow-wrap:anywhere]">
                    Application repository not confirmed
                  </strong>
                  <Button
                    className="justify-self-start"
                    variant="outline"
                    onClick={onRepositorySetup}
                  >
                    Set up repositories
                  </Button>
                </div>
              )}
              {appReview && values["journey:ecs-service:github-authorized"] !== "true" && (
                <Button
                  variant="outline"
                  onClick={() => onValueChange("journey:ecs-service:github-authorized", "true")}
                >
                  Authorize GitHub App
                </Button>
              )}
              <div className="mt-6 [&_[data-slot=button]]:max-w-full">
                {complete ? (
                  <Button
                    nativeButton={false}
                    role="link"
                    render={
                      <a
                        href={`https://${config.serviceName}.dev.example.com`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    Open endpoint <IconExternalLink size={15} />
                  </Button>
                ) : activePr ? (
                  <Button
                    nativeButton={false}
                    role="link"
                    render={<a href={prUrl} target="_blank" rel="noreferrer" />}
                  >
                    Open PR <IconExternalLink size={15} />
                  </Button>
                ) : pipeline || approval ? (
                  <Button
                    nativeButton={false}
                    role="link"
                    render={<a href={runUrl} target="_blank" rel="noreferrer" />}
                    disabled={missing}
                  >
                    {" "}
                    {approval ? "Review plan in Harness" : "Open pipeline in Harness"}{" "}
                    <IconExternalLink size={15} />
                  </Button>
                ) : appReview ? (
                  <Button
                    disabled={
                      !canCreateApp || values["journey:ecs-service:github-authorized"] !== "true"
                    }
                    onClick={() => {
                      for (const key of ["logGroup", "taskRoleArn", "executionRoleArn"])
                        onValueChange(`artifact:task-definition:${key}`, inputs[key]);
                      go("waiting-app-pr");
                    }}
                  >
                    Create application PR <IconArrowRight size={16} />
                  </Button>
                ) : (
                  <p className="m-0 text-[13px] leading-6 text-muted-foreground">
                    {waitingTfe
                      ? "Waiting for TFE to pick up the run."
                      : "Waiting for this run to report success."}
                  </p>
                )}
              </div>
              {pipeline && (
                <Accordion
                  key={pipeline.kind}
                  defaultValue={missing ? ["parameters"] : []}
                  className="mt-5 border-t border-border [&_[data-slot=accordion-trigger]]:text-xs"
                >
                  <AccordionItem value="parameters">
                    <AccordionTrigger>
                      {missing ? "Complete missing inputs" : "Run details"}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 px-2 pt-2 pb-4 @max-[800px]:grid-cols-2">
                        {pipeline.inputs.map((input) => (
                          <label
                            key={input.key}
                            className="grid min-w-0 gap-1.5 text-xs leading-6 text-muted-foreground"
                          >
                            <span>{input.label}</span>
                            <Input
                              value={parameters[input.key]}
                              placeholder="Provide a value"
                              onChange={(event) => {
                                onValueChange(
                                  `journey:ecs-service:parameter:${pipelineKind}:${input.key}`,
                                  event.target.value,
                                );
                                setCopied(false);
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              JSON.stringify(parameters, null, 2),
                            );
                            setCopied(true);
                          } catch {
                            setCopied(false);
                          }
                        }}
                      >
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        {copied ? "Copied" : "Copy run parameters"}
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
              {(activePr || running || approval || waitingTfe) && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={checkNow}>
                    {activePr ? "Check PR status" : "Check run status"}
                    <IconRefresh size={14} />
                  </Button>
                  {!activePr && runUrl && (
                    <a
                      className="inline-flex items-center gap-1 text-xs text-brand-ink"
                      href={runUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View run <IconExternalLink size={13} />
                    </a>
                  )}
                  <span className="basis-full text-xs text-muted-foreground" role="status">
                    {checked
                      ? activePr
                        ? activePrMerged
                          ? "Merged"
                          : "Not merged yet."
                        : `Last reported: ${statusLabel}.`
                      : ""}
                  </span>
                </div>
              )}
            </ExecutionAction>
          </AnimatePresence>
        </aside>
      </div>
      <AnimatePresence initial={false}>
        {file && (
          <ExecutionFiles>
            <section
              className="mt-6 border-t border-border pt-4"
              aria-label="Generated file details"
            >
              <header className="mb-3 flex items-center justify-between">
                <h3 className="m-0 text-[14px] font-[550] leading-6">Generated files</h3>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Close files
                </Button>
              </header>
              <ScaffoldPreview
                key={file}
                config={fileConfig}
                onEdit={onEdit}
                initialView="files"
                initialFilePath={file}
                scope={fileScope}
                filesOnly
              />
            </section>
          </ExecutionFiles>
        )}
      </AnimatePresence>
      <footer className="mt-8 flex items-start justify-between gap-8 border-t border-border pt-4">
        <Accordion className="max-w-[608px] [&_[data-slot=accordion-trigger]]:w-auto [&_[data-slot=accordion-trigger]]:flex-[0_1_auto] [&_[data-slot=accordion-trigger]]:gap-4 [&_[data-slot=accordion-trigger]]:text-xs [&_[data-slot=accordion-trigger]]:text-muted-foreground">
          <AccordionItem value="simulation">
            <AccordionTrigger>Simulation controls</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap items-center gap-3 px-1 py-2">
                {activePr && !activePrMerged && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onValueChange(`journey:ecs-service:pr-state:${activePr}`, "merged")
                    }
                  >
                    Simulate merge
                  </Button>
                )}
                {pipeline && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      missing ||
                      (pipelineKind === "infra" ? prState(values, "infra") !== "merged" : !merged)
                    }
                    onClick={() =>
                      go(
                        pipelineKind === "resources"
                          ? "running-resources"
                          : pipelineKind === "infra"
                            ? "waiting-tfe"
                            : pipelineKind === "ci"
                              ? "building"
                              : "deploying",
                      )
                    }
                  >
                    Simulate{" "}
                    {pipelineKind === "resources"
                      ? "Harness resources"
                      : pipelineKind === "infra"
                        ? "infrastructure"
                        : pipelineKind === "ci"
                          ? "CI"
                          : "deploy"}{" "}
                    run
                  </Button>
                )}
                {waitingTfe && (
                  <Button variant="outline" size="sm" onClick={() => go("planning")}>
                    Simulate TFE run
                  </Button>
                )}
                {approval && (
                  <Button variant="outline" size="sm" onClick={() => go("applying")}>
                    Simulate plan approval
                  </Button>
                )}
                {running && (
                  <Button variant="outline" size="sm" onClick={advanceRun}>
                    Simulate successful run
                  </Button>
                )}
                {!complete && (
                  <Button variant="ghost" size="sm" onClick={() => setPaused(!paused)}>
                    {paused ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />}
                    {paused ? "Resume simulation" : "Pause simulation"}
                  </Button>
                )}
                {complete && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      go("waiting-pr");
                      setPaused(false);
                    }}
                  >
                    Replay simulation
                  </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <AnimatePresence initial={false}>
          {complete && (
            <motion.div
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduced ? 0 : 0.3,
                delay: reduced ? 0 : 0.15,
                ease: motionEase.out,
              }}
            >
              <Button variant="outline" onClick={onFinish}>
                Finish ECS journey <IconArrowRight size={16} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>
    </div>
  );
}
