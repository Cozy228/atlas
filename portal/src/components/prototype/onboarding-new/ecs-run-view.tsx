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
import "./ecs-run.css";

function ExecutionAction({ children }: { children: ReactNode }) {
  const { reduced } = useOnboardingMotion();
  const present = useIsPresent();
  return (
    <motion.div
      className="ecs-action-content"
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
      className="ecs-file-reveal"
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
    <div className="ecs-live-run" data-phase={phase.id}>
      <header className="ecs-workspace-heading">
        <div>
          <span>{applicationStage ? "Application delivery" : "Infrastructure"}</span>
          <h2>{config.serviceName}</h2>
        </div>
        <p>
          {config.environment} · {config.region} · Internal
        </p>
      </header>
      <div className="ecs-execution-workspace">
        <section className="ecs-stack-pane" aria-label="Deployment architecture">
          <div className="ecs-stack-caption">
            <h3>Architecture</h3>
            <span>Planned → Created</span>
          </div>
          <ScaffoldArchitecture
            config={{ ...config, cluster: inputs.cluster }}
            executionPhase={phase.id}
            applyStep={applyStep}
            onOpenFile={openFile}
          />
        </section>
        <aside className="ecs-action-pane" aria-label="Current action">
          <AnimatePresence initial={false} mode="sync">
            <ExecutionAction key={phase.id}>
              {complete && (
                <motion.span
                  className="ecs-success-icon"
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
                  className="ecs-check-status"
                  data-status={status}
                  data-pr-state={activePr ? status : undefined}
                  role="status"
                >
                  {running ? (
                    <IconLoader2 size={15} />
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
              <h3>{actionTitle}</h3>
              <p>{description}</p>
              {(activePr || appReview) && (
                <div className="ecs-action-summary">
                  <span>Target repository</span>
                  <strong>{repository}</strong>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      openFile(scope === "infra" ? "ecs/service.tf" : "ecs/task-definition.json")
                    }
                  >
                    Review files
                  </Button>
                </div>
              )}
              {pipeline && (
                <div className="ecs-action-summary">
                  <span>{pipelineKind === "deploy" ? "Image to deploy" : "Pipeline"}</span>
                  <strong>
                    {pipelineKind === "deploy"
                      ? `${config.serviceName}:${inputs.imageTag}`
                      : values[`artifact:${pipelineArtifact}:pipeline`] || pipeline.title}
                  </strong>
                  {!missing && <small>Inputs ready · {pipeline.inputs.length} values filled</small>}
                </div>
              )}
              {appReview && !values["artifact:app-repository:repository"]?.trim() && (
                <div className="ecs-action-summary">
                  <strong>Application repository not confirmed</strong>
                  <Button variant="outline" onClick={onRepositorySetup}>
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
              <div className="ecs-current-action">
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
                  <p className="ecs-monitoring">
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
                  className="ecs-input-disclosure"
                >
                  <AccordionItem value="parameters">
                    <AccordionTrigger>
                      {missing ? "Complete missing inputs" : "Run details"}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="ecs-run-parameters">
                        {pipeline.inputs.map((input) => (
                          <label key={input.key}>
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
                <div className="ecs-observation-actions">
                  <Button variant="ghost" size="sm" onClick={checkNow}>
                    {activePr ? "Check PR status" : "Check run status"}
                    <IconRefresh size={14} />
                  </Button>
                  {!activePr && runUrl && (
                    <a href={runUrl} target="_blank" rel="noreferrer">
                      View run <IconExternalLink size={13} />
                    </a>
                  )}
                  <span role="status">
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
            <section className="ecs-file-evidence" aria-label="Generated file details">
              <header>
                <h3>Generated files</h3>
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
      <footer className="ecs-execution-footer">
        <Accordion className="ecs-simulation-controls">
          <AccordionItem value="simulation">
            <AccordionTrigger>Simulation controls</AccordionTrigger>
            <AccordionContent>
              <div className="ecs-live-toolbar">
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
