import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBrandGithub,
  IconCheck,
  IconClock,
  IconPencil,
} from "@tabler/icons-react";
import { motionEase, useOnboardingMotion } from "./motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./uipros/accordion";
import { Button } from "./uipros/button";
import { Input } from "./uipros/input";
import { cn } from "@/lib/utils";
import { EcsRunView } from "./ecs-run-view";
import { executionPatch, runPhaseKey } from "./ecs-run";
import { ecsStage, ecsStages, ecsCompleted, type EcsStage } from "./ecs-journey";
import { getScaffoldBuildMethod, scaffoldBuildMethods } from "./scaffold-build";
import { ScaffoldPreview } from "./scaffold-preview";

type ScaffoldFieldKey =
  | "scaffold:app_code"
  | "scaffold:aws_account_id"
  | "scaffold:service_name"
  | "scaffold:build_method"
  | "scaffold:stage";
type EcsScaffoldProps = {
  values: Record<string, string>;
  onValueChange: (key: string, value: string) => void;
  onFinish: () => void;
  onRepositorySetup: () => void;
};
const ecsDeploymentPhases = new Set([
  "waiting-ci",
  "building",
  "waiting-deploy",
  "deploying",
  "complete",
]);

function toSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "service"
  );
}

function fieldValue(values: Record<string, string>, key: ScaffoldFieldKey, fallback: string) {
  return values[key] ?? fallback;
}

function Provenance({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        "on-scaffold-provenance inline-flex items-center gap-1.5 text-[11px] leading-[18px] font-[450] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

function ContextValue({
  label,
  value,
  source,
  onChange,
}: {
  label: string;
  value: string;
  source: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  const missing = !value.trim();
  return (
    <div
      className="on-scaffold-context-value grid min-w-0 grid-cols-[120px_minmax(0,1fr)] items-center gap-x-4 gap-y-0 border-b border-border py-3"
      data-missing={missing}
    >
      <span className="on-scaffold-context-label text-xs leading-[18px] text-muted-foreground">
        {label}
      </span>
      {editing ? (
        <Input
          autoFocus
          aria-label={label}
          className="h-8 w-full min-w-0 px-3 text-sm border-border rounded-md shadow-none text-foreground bg-card"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (!cancelled.current) onChange(draft);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              cancelled.current = event.key === "Escape";
              if (!cancelled.current) onChange(draft);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="on-scaffold-context-edit flex min-h-6 w-full items-center justify-between gap-2 rounded-md border border-transparent bg-transparent px-0 text-left text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-brand"
          aria-label={`Edit ${label}`}
          onClick={() => {
            cancelled.current = false;
            setDraft(value);
            setEditing(true);
          }}
        >
          <strong
            className={cn(
              "truncate text-[13px] font-medium leading-5 text-foreground",
              missing && "text-warning-ink",
            )}
          >
            {missing ? "Add value" : value}
          </strong>
          <IconPencil size={14} className="shrink-0 text-foreground" />
        </button>
      )}
      <Provenance className="col-start-2 text-xs leading-5">
        {missing ? "Not available from onboarding" : source}
      </Provenance>
    </div>
  );
}

export function EcsScaffold({
  values,
  onValueChange,
  onFinish,
  onRepositorySetup,
}: EcsScaffoldProps) {
  const [githubAuthorized, setGithubAuthorized] = useState(
    values["journey:ecs-service:github-authorized"] === "true",
  );
  const contextAppCode = values["scaffold:app_code"] ?? values.app_code?.trim() ?? "";
  const contextAccount = values["scaffold:aws_account_id"] ?? values.aws_account_id?.trim() ?? "";
  const appCode = contextAppCode || "APP";
  const appSlug = toSlug(appCode);
  const defaultServiceName = `${appSlug}-service`;
  const serviceName = fieldValue(values, "scaffold:service_name", defaultServiceName);
  const environment = "DEV";
  const region = "us-east-1";
  const exposure = "internal";
  const nameSlug = serviceName.trim() ? toSlug(serviceName) : "";
  const cluster = nameSlug ? `${nameSlug}-cluster` : "";
  const infraRepo =
    values["artifact:infra-repository:repository"] || (nameSlug ? `${nameSlug}-infra` : "");
  const appRepo = values["artifact:app-repository:repository"] || nameSlug;
  const infraRepositoryReady = Boolean(values["artifact:infra-repository:repository"]?.trim());
  const stackName = nameSlug ? `${nameSlug}-dev-ecs` : "";
  const selectedBuild = getScaffoldBuildMethod(values["scaffold:build_method"]);
  const buildMethod = selectedBuild.id;
  const buildLabel = selectedBuild.label;
  const stage = ecsStage(values);
  const { reduced } = useOnboardingMotion();
  const runPhase = values[runPhaseKey];
  const resourcesReady = values["journey:ecs-service:completed:resources"] === "true";

  useEffect(() => {
    if (runPhase && !resourcesReady && ecsDeploymentPhases.has(runPhase)) {
      for (const [key, value] of Object.entries(executionPatch("waiting-resources", serviceName)))
        onValueChange(key, value);
    }
  }, [onValueChange, resourcesReady, runPhase, serviceName]);

  const setField = (key: ScaffoldFieldKey, value: string) => {
    if (
      key !== "scaffold:stage" &&
      value !== values[key] &&
      ecsStages.some((item) => ecsCompleted(values, item.id))
    ) {
      for (const item of ecsStages)
        onValueChange(`journey:ecs-service:completed:${item.id}`, "false");
      for (const confirmation of ["infra-run", "app-run", "verified", "reviewed-pr-config"])
        onValueChange(`journey:ecs-service:${confirmation}`, "false");
      onValueChange("journey:ecs-service:config-changed", "true");
      onValueChange(runPhaseKey, "");
    }
    onValueChange(key, value);
  };
  const setStage = (nextStage: EcsStage) => {
    setField("scaffold:stage", nextStage);
  };
  const canPreview = /^[a-z][a-z0-9-]*$/.test(serviceName) && serviceName.length <= 32;

  return (
    <section
      className="on-scaffold @container grid w-full gap-4 text-foreground"
      aria-label="ECS service journey"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={stage === "config" || stage === "preview" ? stage : "execution"}
          className="on-scaffold-stage-panel grid gap-4 focus-visible:outline-none"
          initial={{ opacity: 0, filter: reduced ? "blur(0px)" : "blur(2px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.32, ease: motionEase.out }}
        >
          {stage === "config" && (
            <>
              <div className="on-scaffold-decisions-layout grid grid-cols-[minmax(0,1.4fr)_minmax(288px,1fr)] gap-8 py-2 pb-4 @max-[680px]:grid-cols-[minmax(0,1fr)]">
                <section
                  className="on-scaffold-name-entry min-w-0"
                  aria-label="Service configuration"
                >
                  <label
                    className="mb-3 flex items-baseline gap-3 text-lg font-semibold leading-6 text-foreground"
                    htmlFor="on-scaffold-service-name"
                  >
                    Service name{" "}
                    <span className="text-xs font-normal text-muted-foreground">Required</span>
                  </label>
                  <Input
                    id="on-scaffold-service-name"
                    aria-label="Service name"
                    className="h-8 w-full max-w-[416px] px-3 text-sm border-border rounded-md shadow-none text-foreground bg-card"
                    required
                    value={serviceName}
                    placeholder="checkout-api"
                    onChange={(event) => setField("scaffold:service_name", event.target.value)}
                  />
                  <p className="on-scaffold-decision-help mt-2 text-xs leading-6 text-muted-foreground">
                    Lowercase letters, numbers and hyphens, up to 32 characters.
                  </p>
                  <Accordion className="on-scaffold-build-settings mt-6 border-t border-border">
                    <AccordionItem value="build-method">
                      <AccordionTrigger
                        className="rounded-none! py-4 text-xs leading-[1.428571] text-muted-foreground"
                        indicator="plus"
                      >
                        <span>
                          Build method
                          <strong className="mt-1 block text-sm font-medium leading-6 text-foreground">
                            {buildLabel}
                          </strong>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div
                          className="on-scaffold-build-options grid grid-cols-[repeat(auto-fit,minmax(224px,1fr))] gap-2"
                          role="group"
                          aria-label="Build method"
                        >
                          {scaffoldBuildMethods.map((method) => (
                            <Button
                              key={method.id}
                              type="button"
                              variant="ghost"
                              aria-pressed={buildMethod === method.id}
                              className={cn(
                                "h-auto min-h-16 justify-between border-border p-3 text-left",
                                buildMethod === method.id && "border-brand bg-brand-tint",
                              )}
                              onClick={() => setField("scaffold:build_method", method.id)}
                            >
                              <span>
                                <strong className="block text-[13px] font-[550]">
                                  {method.label}
                                </strong>
                                <small className="block text-xs leading-6 font-normal text-muted-foreground">
                                  {method.hint}
                                </small>
                              </span>
                              <span
                                className={cn(
                                  "on-scaffold-build-check inline-flex transition-[opacity,scale,filter] duration-200 ease-out motion-reduce:transition-none",
                                  buildMethod === method.id
                                    ? "scale-100 opacity-100 blur-0"
                                    : "scale-[0.25] opacity-0 blur-[4px]",
                                )}
                                data-selected={buildMethod === method.id}
                                aria-hidden="true"
                              >
                                <IconCheck size={16} />
                              </span>
                            </Button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </section>
                <aside
                  className="on-scaffold-prepared on-scaffold-derived on-scaffold-summary min-w-0 border-l border-border pl-8 @max-[680px]:border-l-0 @max-[680px]:border-t @max-[680px]:p-0 @max-[680px]:pt-4"
                  aria-label="Configuration summary"
                >
                  <h3 className="mb-1 text-[15px] font-semibold leading-6 text-foreground">
                    Configuration
                  </h3>
                  <p className="mb-3 text-xs leading-6 text-muted-foreground">
                    Defaults and values from your onboarding.
                  </p>
                  <dl className="m-0">
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-4 border-b border-border py-3">
                      <dt className="text-xs leading-6 text-muted-foreground">Deployment</dt>
                      <dd className="m-0 break-words text-[13px] leading-6 text-foreground">
                        DEV · us-east-1 · Internal
                      </dd>
                    </div>
                  </dl>
                  <ContextValue
                    label="Application code"
                    value={contextAppCode}
                    source={
                      values["scaffold:app_code"] !== undefined
                        ? "Edited for this service"
                        : "From onboarding"
                    }
                    onChange={(value) => setField("scaffold:app_code", value)}
                  />
                  <ContextValue
                    label="AWS account"
                    value={contextAccount}
                    source={
                      values["scaffold:aws_account_id"] !== undefined
                        ? "Edited for this service"
                        : "From onboarding"
                    }
                    onChange={(value) => setField("scaffold:aws_account_id", value)}
                  />
                  <Accordion className="on-scaffold-names [&_h3]:mb-1 [&_h3]:font-semibold [&_p:not(:last-child)]:mb-0">
                    <AccordionItem value="derived-names">
                      <AccordionTrigger
                        className="rounded-none! py-3 text-xs leading-[1.428571]"
                        indicator="plus"
                      >
                        Resource names
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="m-0 text-xs leading-6 text-muted-foreground">
                          Derived from your service name.
                        </p>
                        <dl className="m-0">
                          {[
                            { label: "ECS cluster", value: cluster },
                            { label: "Infrastructure repo", value: infraRepo },
                            { label: "Application repo", value: appRepo },
                            { label: "Stack", value: stackName },
                          ].map((item) => (
                            <div
                              className="grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-4 border-b border-border py-3"
                              key={item.label}
                            >
                              <dt className="text-xs leading-6 text-muted-foreground">
                                {item.label}
                              </dt>
                              <dd className="m-0 break-words text-[13px] leading-6 text-foreground">
                                {item.value || "—"}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </aside>
              </div>
              <div className="on-scaffold-actions flex min-h-8 items-center justify-end gap-4">
                <span className="on-scaffold-action-note mr-auto inline-flex max-w-[480px] items-center gap-1.5 text-xs leading-[18px] text-muted-foreground">
                  {!contextAppCode || !contextAccount
                    ? "Missing context remains marked in the preview."
                    : ""}
                </span>
                <Button type="button" disabled={!canPreview} onClick={() => setStage("preview")}>
                  Preview changes
                  <IconArrowRight
                    size={16}
                    className="transition-transform duration-200 ease-out group-hover/button:translate-x-0.5 motion-reduce:transition-none"
                  />
                </Button>
              </div>
            </>
          )}

          {stage === "preview" && (
            <>
              <ScaffoldPreview
                scope="infra"
                config={{
                  serviceName,
                  environment,
                  region,
                  cluster,
                  infraRepo,
                  appRepo,
                  stackName,
                  account: contextAccount,
                  exposure,
                  buildMethod,
                }}
                onEdit={() => setStage("config")}
              />

              {!infraRepositoryReady && (
                <div className="on-scaffold-github-access grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-border py-4">
                  <IconClock size={24} aria-hidden="true" />
                  <div>
                    <strong className="text-sm leading-6 text-foreground">
                      Infrastructure repository not confirmed
                    </strong>
                    <p className="m-0 text-xs leading-6 text-muted-foreground">
                      Complete repository setup in onboarding, then return to create the PR.
                    </p>
                  </div>
                  <Button className="col-start-3" variant="outline" onClick={onRepositorySetup}>
                    Set up repositories
                  </Button>
                </div>
              )}
              <div className="on-scaffold-github-access grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-border py-4">
                <IconBrandGithub size={24} aria-hidden="true" />
                <div>
                  <strong className="text-sm leading-6 text-foreground">GitHub App</strong>
                  <p className="m-0 text-xs leading-6 text-muted-foreground">
                    {githubAuthorized
                      ? "Authorized · Prototype"
                      : "Authorize access to create pull requests in the target repositories."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={githubAuthorized}
                  onClick={() => {
                    setGithubAuthorized(true);
                    onValueChange("journey:ecs-service:github-authorized", "true");
                  }}
                >
                  {githubAuthorized ? (
                    <>
                      <IconCheck size={16} /> Authorized
                    </>
                  ) : (
                    "Authorize GitHub App"
                  )}
                </Button>
                {!githubAuthorized && (
                  <small className="col-start-3 justify-self-end text-[11px] text-muted-foreground">
                    Simulated authorization
                  </small>
                )}
              </div>
              <div className="on-scaffold-actions flex min-h-8 items-center justify-end gap-4">
                <Button type="button" variant="ghost" onClick={() => setStage("config")}>
                  <IconArrowLeft
                    size={16}
                    className="transition-transform duration-200 ease-out group-hover/button:translate-x-0.5 motion-reduce:transition-none"
                  />
                  Back to configuration
                </Button>
                <Button
                  type="button"
                  disabled={!githubAuthorized || !infraRepositoryReady}
                  onClick={() => {
                    onValueChange("journey:ecs-service:completed:config", "true");
                    onValueChange("journey:ecs-service:completed:preview", "true");
                    for (const [key, value] of Object.entries(
                      executionPatch("waiting-pr", serviceName),
                    ))
                      onValueChange(key, value);
                  }}
                >
                  Create infrastructure PR
                  <IconArrowRight
                    size={16}
                    className="transition-transform duration-200 ease-out group-hover/button:translate-x-0.5 motion-reduce:transition-none"
                  />
                </Button>
              </div>
            </>
          )}

          {stage !== "config" &&
            stage !== "preview" &&
            (values[runPhaseKey] ? (
              <EcsRunView
                onRepositorySetup={onRepositorySetup}
                config={{
                  serviceName,
                  environment,
                  region,
                  cluster,
                  infraRepo,
                  appRepo,
                  stackName,
                  account: contextAccount,
                  exposure,
                  buildMethod,
                }}
                values={values}
                onValueChange={onValueChange}
                onEdit={() => setStage("config")}
                onFinish={() => {
                  onValueChange("journey:ecs-service:completed:verify", "true");
                  onFinish();
                }}
              />
            ) : (
              <div className="ecs-run-prerequisite">
                <p>
                  Review the generated changes and create pull requests before running this step.
                </p>
                <Button variant="outline" onClick={() => setStage("preview")}>
                  Review changes
                </Button>
              </div>
            ))}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
