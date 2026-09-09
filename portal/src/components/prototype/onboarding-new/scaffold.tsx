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
import { EcsRunView } from "./ecs-run-view";
import { executionPatch, runPhaseKey } from "./ecs-run";
import { ecsStage, ecsStages, ecsCompleted, type EcsStage } from "./ecs-journey";
import { getScaffoldBuildMethod, scaffoldBuildMethods } from "./scaffold-build";
import { ScaffoldPreview } from "./scaffold-preview";
import "./scaffold.css";

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

function Provenance({ children }: { children: string }) {
  return <span className="on-scaffold-provenance">{children}</span>;
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
    <div className="on-scaffold-context-value" data-missing={missing}>
      <span className="on-scaffold-context-label">{label}</span>
      {editing ? (
        <Input
          autoFocus
          aria-label={label}
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
          className="on-scaffold-context-edit"
          aria-label={`Edit ${label}`}
          onClick={() => {
            cancelled.current = false;
            setDraft(value);
            setEditing(true);
          }}
        >
          <strong>{missing ? "Add value" : value}</strong>
          <IconPencil size={14} />
        </button>
      )}
      <Provenance>{missing ? "Not available from onboarding" : source}</Provenance>
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
    <section className="on-scaffold" aria-label="ECS service journey">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={stage === "config" || stage === "preview" ? stage : "execution"}
          className="on-scaffold-stage-panel"
          initial={{ opacity: 0, filter: reduced ? "blur(0px)" : "blur(2px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.32, ease: motionEase.out }}
        >
          {stage === "config" && (
            <>
              <div className="on-scaffold-decisions-layout">
                <section className="on-scaffold-name-entry" aria-label="Service configuration">
                  <label htmlFor="on-scaffold-service-name">
                    Service name <span>Required</span>
                  </label>
                  <Input
                    id="on-scaffold-service-name"
                    aria-label="Service name"
                    required
                    value={serviceName}
                    placeholder="checkout-api"
                    onChange={(event) => setField("scaffold:service_name", event.target.value)}
                  />
                  <p className="on-scaffold-decision-help">
                    Lowercase letters, numbers and hyphens, up to 32 characters.
                  </p>
                  <Accordion className="on-scaffold-build-settings">
                    <AccordionItem value="build-method">
                      <AccordionTrigger indicator="plus">
                        <span>
                          Build method <strong>{buildLabel}</strong>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div
                          className="on-scaffold-build-options"
                          role="group"
                          aria-label="Build method"
                        >
                          {scaffoldBuildMethods.map((method) => (
                            <Button
                              key={method.id}
                              type="button"
                              variant="ghost"
                              aria-pressed={buildMethod === method.id}
                              onClick={() => setField("scaffold:build_method", method.id)}
                            >
                              <span>
                                <strong>{method.label}</strong>
                                <small>{method.hint}</small>
                              </span>
                              <span
                                className="on-scaffold-build-check"
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
                  className="on-scaffold-prepared on-scaffold-derived on-scaffold-summary"
                  aria-label="Configuration summary"
                >
                  <h3>Configuration</h3>
                  <p>Defaults and values from your onboarding.</p>
                  <dl>
                    <div>
                      <dt>Deployment</dt>
                      <dd>DEV · us-east-1 · Internal</dd>
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
                  <Accordion className="on-scaffold-names">
                    <AccordionItem value="derived-names">
                      <AccordionTrigger indicator="plus">Resource names</AccordionTrigger>
                      <AccordionContent>
                        <p>Derived from your service name.</p>
                        <dl>
                          {[
                            { label: "ECS cluster", value: cluster },
                            { label: "Infrastructure repo", value: infraRepo },
                            { label: "Application repo", value: appRepo },
                            { label: "Stack", value: stackName },
                          ].map((item) => (
                            <div key={item.label}>
                              <dt>{item.label}</dt>
                              <dd>{item.value || "—"}</dd>
                            </div>
                          ))}
                        </dl>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </aside>
              </div>
              <div className="on-scaffold-actions">
                <span className="on-scaffold-action-note">
                  {!contextAppCode || !contextAccount
                    ? "Missing context remains marked in the preview."
                    : ""}
                </span>
                <Button type="button" disabled={!canPreview} onClick={() => setStage("preview")}>
                  Preview changes <IconArrowRight size={16} />
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
                <div className="on-scaffold-github-access">
                  <IconClock size={24} aria-hidden="true" />
                  <div>
                    <strong>Infrastructure repository not confirmed</strong>
                    <p>Complete repository setup in onboarding, then return to create the PR.</p>
                  </div>
                  <Button variant="outline" onClick={onRepositorySetup}>
                    Set up repositories
                  </Button>
                </div>
              )}
              <div className="on-scaffold-github-access">
                <IconBrandGithub size={24} aria-hidden="true" />
                <div>
                  <strong>GitHub App</strong>
                  <p>
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
                {!githubAuthorized && <small>Simulated authorization</small>}
              </div>
              <div className="on-scaffold-actions">
                <Button type="button" variant="ghost" onClick={() => setStage("config")}>
                  <IconArrowLeft size={16} /> Back to configuration
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
                  Create infrastructure PR <IconArrowRight size={16} />
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
