import { useEffect, useState } from "react";
import { preparePullRequest, simulatePullRequest, type PullRequestCreator } from "./ecs-pr";
import { IconArrowRight, IconExternalLink, IconCheck } from "@tabler/icons-react";
import { Button } from "./uipros/button";
import { Input } from "./uipros/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./uipros/accordion";
import { SourceContent } from "./source-content";
import { artifactUrl as externalUrl } from "./artifacts";
import { ecsJourney, ecsPipelineSetup, type EcsStage } from "./ecs-journey";

type Props = {
  stage: EcsStage;
  values: Record<string, string>;
  serviceName: string;
  onValueChange: (key: string, value: string) => void;
  onContinue: () => void;
  createPullRequest?: PullRequestCreator;
};
export function EcsExecution({
  stage,
  values,
  serviceName,
  onValueChange,
  onContinue,
  createPullRequest = simulatePullRequest,
}: Props) {
  const [preparing, setPreparing] = useState<string[]>([]);
  const isPr = stage === "result";
  const isPipeline = stage === "pipelines";
  const isRun = stage === "run";
  const infraPipelineUrl = values["artifact:infra-pipeline:url"];
  useEffect(() => {
    if (!isPipeline || infraPipelineUrl) return;
    onValueChange("artifact:infra-pipeline:pipeline", `${serviceName}-infra`);
    onValueChange("journey:ecs-service:infra-pipeline-source", "simulated");
    onValueChange(
      "artifact:infra-pipeline:url",
      `https://harness.example.com/pipelines/${encodeURIComponent(serviceName)}-infra`,
    );
  }, [isPipeline, infraPipelineUrl, serviceName, onValueChange]);
  const kinds = ["infra", "app"];
  const checked = (key: string) => values[`journey:ecs-service:${key}`] === "true";
  function confirmation(key: string, label: string) {
    return (
      <label className="ecs-confirm">
        <input
          type="checkbox"
          checked={checked(key)}
          onChange={(event) =>
            onValueChange(`journey:ecs-service:${key}`, String(event.target.checked))
          }
        />
        <span>{label}</span>
      </label>
    );
  }
  const needsReview =
    isPr &&
    values["journey:ecs-service:config-changed"] === "true" &&
    !checked("reviewed-pr-config");
  const ready =
    !needsReview &&
    (isPr
      ? kinds.every((kind) => externalUrl(values[`artifact:${kind}-pr:url`]))
      : isPipeline
        ? kinds.every((kind) => externalUrl(values[`artifact:${kind}-pipeline:url`]))
        : isRun
          ? checked("infra-run") && checked("app-run")
          : checked("verified"));
  const demoPrs =
    isPr &&
    !needsReview &&
    kinds.every(
      (kind) =>
        values[`journey:ecs-service:pr:${kind}`] === "simulated" ||
        externalUrl(values[`artifact:${kind}-pr:url`]),
    );
  const sourceIds = isPr
    ? ["generate-stack"]
    : isPipeline
      ? ["infra-pipeline", "app-deploy-pipeline"]
      : isRun
        ? ["app-deploy-pipeline"]
        : ["dev-deploy-success"];
  return (
    <div className="ecs-execution">
      <p className="ecs-step-intro">
        {isPr
          ? "Create a pull request for each repository."
          : isPipeline
            ? "The infrastructure pipeline is resolved from your service. Connect the application pipeline to continue."
            : isRun
              ? "Open each pipeline and start the run there. Infrastructure runs first; application deployment follows."
              : "Check the service in DEV and record the outcome."}
      </p>
      {(isPr || isPipeline || isRun) && (
        <div className="ecs-output-list">
          {kinds.map((kind) => {
            const label = kind === "infra" ? "Infrastructure" : "Application";
            const repository = kind === "infra" ? `${serviceName}-infra` : serviceName;
            const key = `artifact:${kind}-${isPr ? "pr" : "pipeline"}:url`;
            const url = externalUrl(values[key]);
            const simulated = isPr && values[`journey:ecs-service:pr:${kind}`] === "simulated";
            return (
              <section className="ecs-output" key={kind}>
                <div className="ecs-output-heading">
                  <div>
                    <h3>
                      {label}
                      {isPr ? " pull request" : " pipeline"}
                    </h3>
                    <span>{repository}</span>
                  </div>
                  <span className="ecs-output-status">
                    {url
                      ? !isPr && kind === "infra"
                        ? values["journey:ecs-service:infra-pipeline-source"] === "simulated"
                          ? "Resolved · Prototype"
                          : "Resolved"
                        : "Link saved"
                      : simulated
                        ? "Demo prepared"
                        : "Not recorded"}
                  </span>
                </div>
                {isPr && (
                  <p>
                    {kind === "infra"
                      ? "ECS infrastructure and provisioning pipeline"
                      : "Task definition and application deployment pipeline"}
                  </p>
                )}
                {!isRun && !(isPipeline && kind === "infra") && (
                  <label className="ecs-url-field">
                    <span>{isPr ? "Pull request URL" : "Pipeline URL"}</span>
                    <Input
                      type="url"
                      aria-label={`${label} ${isPr ? "pull request" : "pipeline"} URL`}
                      placeholder="https://…"
                      value={values[key] ?? ""}
                      onChange={(event) => {
                        onValueChange(key, event.target.value);
                        if (isPipeline)
                          onValueChange(
                            `artifact:${kind}-pipeline:pipeline`,
                            `${serviceName}-${kind}`,
                          );
                      }}
                    />
                  </label>
                )}
                <div className="ecs-output-actions">
                  {isPipeline &&
                    kind !== "infra" &&
                    ecsPipelineSetup
                      .filter((setup) => setup.kind === kind)
                      .map((setup) => (
                        <a key={setup.kind} href={setup.url} target="_blank" rel="noreferrer">
                          {setup.label}
                          <IconExternalLink size={14} />
                        </a>
                      ))}
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer">
                      {isRun
                        ? "Open and trigger pipeline"
                        : isPr
                          ? "Open pull request"
                          : "Open pipeline"}
                      <IconExternalLink size={14} />
                    </a>
                  )}
                  {isPr && !url && (
                    <Button
                      variant="outline"
                      type="button"
                      disabled={simulated || preparing.includes(kind)}
                      onClick={async () => {
                        setPreparing((previous) => [...previous, kind]);
                        await preparePullRequest({
                          repository,
                          create: createPullRequest,
                          save: (result) => {
                            onValueChange(`journey:ecs-service:pr:${kind}`, result.kind);
                            if (result.kind === "created") onValueChange(key, result.url);
                            if (result.kind === "failed")
                              onValueChange(`journey:ecs-service:pr-error:${kind}`, result.message);
                          },
                        });
                        setPreparing((previous) => previous.filter((item) => item !== kind));
                      }}
                    >
                      {simulated ? (
                        <>
                          <IconCheck size={14} /> Demo prepared
                        </>
                      ) : preparing.includes(kind) ? (
                        "Creating…"
                      ) : values[`journey:ecs-service:pr:${kind}`] === "failed" ? (
                        `Retry ${label.toLowerCase()} PR`
                      ) : (
                        `Simulate ${label.toLowerCase()} PR`
                      )}
                    </Button>
                  )}
                  {isRun && !url && <span>Save the pipeline URL in Create pipelines first.</span>}
                </div>
                {isPr && values[`journey:ecs-service:pr:${kind}`] === "failed" && (
                  <p role="alert">{values[`journey:ecs-service:pr-error:${kind}`]}</p>
                )}
                {isRun &&
                  confirmation(`${kind}-run`, `${label} pipeline run completed successfully`)}
              </section>
            );
          })}
        </div>
      )}
      {stage === "verify" && (
        <section className="ecs-verification">
          <div className="ecs-output-heading">
            <div>
              <h3>{serviceName}</h3>
              <span>DEV · us-east-1 · Internal</span>
            </div>
          </div>
          <label className="ecs-url-field">
            <span>Service or deployment URL (optional)</span>
            <Input
              type="url"
              value={values["artifact:deployment:url"] ?? ""}
              onChange={(event) => onValueChange("artifact:deployment:url", event.target.value)}
            />
          </label>
          {confirmation("verified", "I verified that the DEV service is healthy")}
          <p>PRs, pipeline links and deployment details remain available in Artifacts.</p>
        </section>
      )}
      <Accordion>
        <AccordionItem value="instructions">
          <AccordionTrigger>Setup instructions</AccordionTrigger>
          <AccordionContent>
            {ecsJourney.steps
              .filter((step) => sourceIds.includes(step.id))
              .map((step) => (
                <section key={step.id}>
                  <h3>{step.title}</h3>
                  <SourceContent
                    blocks={step.content?.blocks ?? []}
                    applicationCode={values.app_code ?? ""}
                  />
                </section>
              ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {isPr && values["journey:ecs-service:config-changed"] === "true" && (
        <div role="status">
          <p>Configuration changed. Previously recorded links are preserved.</p>
          {confirmation(
            "reviewed-pr-config",
            "I checked the pull requests against the updated configuration",
          )}
        </div>
      )}
      {isRun && (
        <p className="ecs-step-note">
          Run status is confirmed by you; opening a link does not mark it complete.
        </p>
      )}
      <div className="on-scaffold-actions flex min-h-8 items-center justify-end gap-4 [&>span]:mr-auto [&>span]:text-xs [&>span]:text-muted-foreground">
        <span className="ecs-step-note">
          {!ready && !demoPrs ? "Complete the items above to continue." : ""}
        </span>
        <Button
          type="button"
          disabled={!ready && !demoPrs}
          onClick={() => {
            if (stage === "verify") {
              onValueChange("artifact:deployment:service", serviceName);
              onValueChange("artifact:deployment:environment", "DEV");
            }
            onContinue();
          }}
        >
          {isPr
            ? "Continue to pipelines"
            : isPipeline
              ? "Continue to run"
              : isRun
                ? "Verify deployment"
                : "Finish ECS journey"}
          <IconArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
