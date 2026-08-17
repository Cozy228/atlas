/**
 * Prototype "kimi" — Scaffolder (governed self-service actions).
 *
 * Product goal: express an intent and trigger a governed platform action
 * without understanding internal platform parameters. Atlas resolves what it
 * can from application context and shows provenance per value, recommends with
 * reasons, asks only for decisions it cannot safely make, shows exactly what
 * will be sent and which system executes it, then hands off to an observable
 * (simulated) run. Fixture-only: nothing leaves the browser.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleDashed,
  IconKey,
  IconRocket,
  IconTemplate,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { AppId, AtlasApp, IntentId, SourceId } from "./fixtures";
import {
  CURRENT_USER,
  EXISTING_SERVICE_NAMES,
  GOLDEN_PATH,
  SCAFFOLDER_INTENTS,
  SOURCES,
  buildsFor,
  personName,
  runsFor,
  teamName,
  ticketsFor,
} from "./fixtures";
import { createSimulatedRun } from "./run-store";
import { usePrototypeApp } from "./shell";
import { EmptyState, PageHead, Panel, SectionHead } from "./ui";

// ---------------------------------------------------------------------------
// Resolution model
// ---------------------------------------------------------------------------

type ResolutionStatus = "resolved" | "recommended" | "decision" | "blocked";

interface ResolutionRow {
  param: string;
  value: string;
  status: ResolutionStatus;
  source?: SourceId;
  why?: string;
}

const RESOLUTION_LABEL: Record<ResolutionStatus, string> = {
  resolved: "Resolved",
  recommended: "Recommended",
  decision: "Decision needed",
  blocked: "Blocked",
};

function teamRepoPrefix(app: AtlasApp): string {
  return `git.example.com/${app.teamId.replace("t-", "")}`;
}

function buildResolutionRows(intentId: IntentId, app: AtlasApp): ResolutionRow[] {
  const team = teamName(app.teamId);
  const owner = personName(app.ownerId);
  if (intentId === "scaffold-workload") {
    return [
      { param: "Team", value: team, status: "resolved", source: "app-registry" },
      { param: "Owner", value: owner, status: "resolved", source: "app-registry" },
      {
        param: "Repository",
        value: `${teamRepoPrefix(app)}/<name>`,
        status: "resolved",
        source: "atlas",
        why: "Derived from the team's repository convention",
      },
      {
        param: "Cloud account",
        value: app.account ? `${app.account.id} (${app.account.provider})` : "Not mapped",
        status: app.account ? "resolved" : "blocked",
        source: app.account ? "aws" : undefined,
        why: app.account ? undefined : "Station 2 of the journey has not mapped an account yet",
      },
      {
        param: "Region",
        value: app.account?.region ?? "Not derivable",
        status: app.account ? "resolved" : "blocked",
        source: app.account ? "aws" : undefined,
      },
      {
        param: "Environment",
        value: "DEV",
        status: "resolved",
        source: "atlas",
        why: "Golden path scope",
      },
      {
        param: "Permission group",
        value: `${app.teamId.replace("t-", "")}-developers`,
        status: "resolved",
        source: "sailpoint",
      },
      {
        param: "Template version",
        value: "v1.3.2",
        status: "recommended",
        source: "atlas",
        why: "Pinned by the team standard. v1.4.0 is available but not yet adopted",
      },
      {
        param: "Instance size",
        value: "small",
        status: "recommended",
        source: "atlas",
        why: "Smallest size policy P-12 allows for DEV",
      },
      { param: "Service name", value: "", status: "decision", why: "A new name cannot be derived" },
      {
        param: "Workload type",
        value: "",
        status: "decision",
        why: "Changes the template's pipeline shape",
      },
      {
        param: "PROD account",
        value: "Out of scope",
        status: "blocked",
        why: "This golden path onboards to DEV only. PROD is a separate, later journey",
      },
    ];
  }
  if (intentId === "deploy-dev") {
    const latestGreen = buildsFor(app.id as AppId).find((b) => b.checks === "green");
    return [
      {
        param: "Application",
        value: `${app.name} (${app.code})`,
        status: "resolved",
        source: "app-registry",
      },
      {
        param: "Pipeline",
        value: `${app.id}-ci`,
        status: "resolved",
        source: "harness",
      },
      {
        param: "Cloud account",
        value: app.account ? `${app.account.id} (${app.account.provider})` : "Not mapped",
        status: app.account ? "resolved" : "blocked",
        source: app.account ? "aws" : undefined,
      },
      {
        param: "Environment / Region",
        value: app.account ? `${app.account.environment} · ${app.account.region}` : "Not derivable",
        status: app.account ? "resolved" : "blocked",
        source: app.account ? "aws" : undefined,
      },
      {
        param: "Task definition",
        value: `${app.id}:latest`,
        status: "resolved",
        source: "harness",
      },
      {
        param: "Artifact",
        value: latestGreen ? `${latestGreen.id} (latest green)` : "No builds",
        status: latestGreen ? "recommended" : "blocked",
        source: latestGreen ? "harness" : undefined,
        why: latestGreen
          ? `Latest build with green checks, from CI run ${latestGreen.ciRunId}`
          : "No CI builds exist for this application yet",
      },
      {
        param: "Artifact choice",
        value: "",
        status: "decision",
        why: "You may pin an older build",
      },
      {
        param: "Approval",
        value: "Not required for DEV",
        status: "resolved",
        source: "atlas",
        why: "Policy allows L3 DEV deployments with explicit confirmation",
      },
    ];
  }
  // request-access
  return [
    {
      param: "Requester",
      value: CURRENT_USER.name,
      status: "resolved",
      source: "atlas",
      why: "Enterprise identity",
    },
    {
      param: "Group",
      value: `${app.teamId.replace("t-", "")}-developers`,
      status: "resolved",
      source: "sailpoint",
      why: "Mapped from the application's team",
    },
    { param: "Approver", value: personName("p-elena"), status: "resolved", source: "sailpoint" },
    { param: "Role", value: "", status: "decision", why: "Access level is your choice" },
    {
      param: "Duration",
      value: "90 days",
      status: "recommended",
      source: "atlas",
      why: "Default access window in policy P-04",
    },
  ];
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

type PreflightStatus = "pass" | "warn" | "fail";

interface PreflightCheck {
  label: string;
  status: PreflightStatus;
  note?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const INTENT_ICON: Record<IntentId, typeof IconTemplate> = {
  "scaffold-workload": IconTemplate,
  "deploy-dev": IconRocket,
  "request-access": IconKey,
};

export function ScaffolderPage() {
  const { appId, app } = usePrototypeApp();
  const [intentId, setIntentId] = useState<IntentId>("scaffold-workload");

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        contour
        title="Scaffolder"
        description="Express an intent. Atlas resolves everything it can from application context and policy, shows where each value came from, and asks only for what it cannot safely decide."
        meta={
          <Badge variant="outline">
            Context: {app.name} · {app.code}
          </Badge>
        }
      />

      {/* Intent picker */}
      <div role="radiogroup" aria-label="Intent" className="grid gap-2 sm:grid-cols-3">
        {SCAFFOLDER_INTENTS.map((candidate) => {
          const IntentIcon = INTENT_ICON[candidate.id];
          const selected = candidate.id === intentId;
          return (
            <button
              key={candidate.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setIntentId(candidate.id)}
              className={cn(
                "flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-brand-tint/40"
                  : "border-border bg-card hover:border-border-strong",
              )}
            >
              <IntentIcon
                size={16}
                strokeWidth={2}
                aria-hidden
                className={cn(
                  "mt-0.5 shrink-0",
                  selected ? "text-brand-ink" : "text-muted-foreground",
                )}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-foreground">
                  {candidate.title}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {candidate.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <IntentForm key={`${appId}-${intentId}`} intentId={intentId} app={app} />
    </div>
  );
}

function IntentForm({ intentId, app }: { intentId: IntentId; app: AtlasApp }) {
  const appId = app.id as AppId;
  const navigate = useNavigate();
  const intent = SCAFFOLDER_INTENTS.find((i) => i.id === intentId)!;
  const rows = useMemo(() => buildResolutionRows(intentId, app), [intentId, app]);

  // Decisions (the only inputs the user must provide)
  const [serviceName, setServiceName] = useState(`${app.id}-reports`);
  const [variant, setVariant] = useState("http-api");
  const builds = buildsFor(appId);
  const defaultArtifact = builds.find((b) => b.checks === "green")?.id ?? "";
  const [artifactId, setArtifactId] = useState(defaultArtifact);
  const [role, setRole] = useState("read-write");
  const [confirmed, setConfirmed] = useState(false);

  const nameConflict =
    intentId === "scaffold-workload" &&
    EXISTING_SERVICE_NAMES.includes(serviceName.trim().toLowerCase());

  const preflight: PreflightCheck[] = useMemo(() => {
    if (intentId === "scaffold-workload") {
      return [
        serviceName.trim() === ""
          ? { label: "Naming conflict check", status: "fail", note: "A service name is required" }
          : nameConflict
            ? {
                label: "Naming conflict check",
                status: "fail",
                note: `A service named "${serviceName.trim()}" already exists`,
              }
            : {
                label: "Naming conflict check",
                status: "pass",
                note: `${serviceName.trim()} is free`,
              },
        {
          label: "Policy: template allow-list",
          status: "pass",
          note: `aws-ecs-service ${GOLDEN_PATH.version} is allowed for ${teamName(app.teamId)}`,
        },
        { label: "Account quota", status: "pass", note: "12 of 20 services in use" },
        {
          label: "Template currency",
          status: "warn",
          note: "v1.4.0 is available; the team standard pins v1.3.2",
        },
        ...(app.account
          ? []
          : ([
              {
                label: "Account mapping",
                status: "fail",
                note: "No AWS account is mapped to this application yet",
              },
            ] satisfies PreflightCheck[])),
      ];
    }
    if (intentId === "deploy-dev") {
      const failedRun = runsFor(appId).find((r) => r.status === "failed");
      const selected = builds.find((b) => b.id === artifactId);
      return [
        builds.length === 0
          ? {
              label: "Artifact availability",
              status: "fail",
              note: "No CI builds exist. Connect a repository and run CI first",
            }
          : selected?.checks === "green"
            ? { label: "Artifact checks", status: "pass", note: `${selected.id} passed CI` }
            : {
                label: "Artifact checks",
                status: "fail",
                note: `${artifactId} failed CI checks and cannot be deployed`,
              },
        { label: "Pipeline exists", status: "pass", note: `${app.id}-ci` },
        failedRun
          ? {
              label: "Previous deployment",
              status: "warn",
              note: `${failedRun.id} failed. Review the diagnosis before re-deploying`,
            }
          : { label: "Previous deployment", status: "pass", note: "Last deployment succeeded" },
        { label: "Permissions", status: "pass", note: "You may trigger DEV deployments (L3)" },
      ];
    }
    const pending = ticketsFor(appId).find(
      (t) => t.system === "sailpoint" && t.status === "pending-approval",
    );
    return [
      pending
        ? {
            label: "Duplicate request check",
            status: "warn",
            note: `${pending.id} is already pending for this team`,
          }
        : { label: "Duplicate request check", status: "pass" },
      { label: "Group mapping", status: "pass", note: "Team maps to a SailPoint group" },
    ];
  }, [intentId, app, appId, serviceName, nameConflict, builds, artifactId]);

  const hasFail = preflight.some((check) => check.status === "fail");
  const needsConfirm = intent.risk === "L3";
  const canExecute = !hasFail && (!needsConfirm || confirmed);

  const payload = useMemo((): Record<string, string> => {
    if (intentId === "scaffold-workload") {
      return {
        action: "scaffold_workload",
        template: `aws-ecs-service:${GOLDEN_PATH.version}`,
        name: serviceName.trim(),
        variant,
        team: teamName(app.teamId),
        owner: personName(app.ownerId),
        repository: `${teamRepoPrefix(app)}/${serviceName.trim()}`,
        account: app.account?.id ?? "unresolved",
        region: app.account?.region ?? "unresolved",
        environment: "DEV",
        permissionGroup: `${app.teamId.replace("t-", "")}-developers`,
        instanceSize: "small",
      };
    }
    if (intentId === "deploy-dev") {
      return {
        action: "trigger_deployment",
        application: app.code,
        pipeline: `${app.id}-ci`,
        artifact: artifactId,
        environment: app.account?.environment ?? "DEV",
        account: app.account?.id ?? "unresolved",
        taskDefinition: `${app.id}:latest`,
      };
    }
    return {
      action: "request_access",
      requester: CURRENT_USER.name,
      group: `${app.teamId.replace("t-", "")}-developers`,
      role,
      durationDays: "90",
    };
  }, [intentId, app, serviceName, variant, artifactId, role]);

  const execute = () => {
    const run = createSimulatedRun(intentId, appId, payload);
    void navigate({
      to: "/prototype/kimi/runs/$runId",
      params: { runId: run.id },
      search: { app: appId },
    });
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Resolution sheet */}
        <div className="lg:col-span-3">
          <SectionHead
            title="Resolution sheet"
            hint="what Atlas resolved, and from where"
            className="mb-2"
          />
          <Panel>
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li
                  key={row.param}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-x-4 px-4 py-2.5 sm:grid-cols-[140px_minmax(0,1fr)_auto]"
                >
                  <span className="pt-px text-xs font-medium text-muted-foreground">
                    {row.param}
                  </span>
                  <span className="min-w-0">
                    {row.status === "decision" ? (
                      <span className="text-[13px] font-medium text-brand-ink">
                        You decide below
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "text-[13px] break-words",
                          row.status === "blocked"
                            ? "text-critical-ink"
                            : "font-medium text-foreground",
                        )}
                      >
                        {row.value}
                      </span>
                    )}
                    {row.why ? (
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                        {row.why}
                      </span>
                    ) : null}
                    {row.source ? (
                      <span className="mt-1 inline-block text-[10px] tracking-[0.02em] text-muted-foreground uppercase">
                        via {SOURCES[row.source].label}
                      </span>
                    ) : null}
                  </span>
                  <span className="col-span-2 mt-1 sm:col-span-1 sm:mt-0 sm:justify-self-end">
                    <Badge
                      variant={
                        row.status === "resolved"
                          ? "success"
                          : row.status === "recommended"
                            ? "info"
                            : row.status === "decision"
                              ? "brand"
                              : "critical"
                      }
                    >
                      {RESOLUTION_LABEL[row.status]}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Decisions + preflight */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div>
            <SectionHead
              title="Your decisions"
              hint="only what cannot be derived"
              className="mb-2"
            />
            <Panel className="flex flex-col gap-4 px-4 py-4">
              {intentId === "scaffold-workload" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pv-service-name">Service name</Label>
                    <Input
                      id="pv-service-name"
                      value={serviceName}
                      onChange={(event) => setServiceName(event.target.value)}
                      aria-invalid={nameConflict}
                      aria-describedby="pv-service-name-hint"
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono text-[13px]"
                    />
                    <p id="pv-service-name-hint" className="text-xs text-muted-foreground">
                      {nameConflict
                        ? "This name is taken. Preflight below fails until it is unique."
                        : "Suggested from the application; lowercase, hyphenated."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pv-variant">Workload type</Label>
                    <select
                      id="pv-variant"
                      value={variant}
                      onChange={(event) => setVariant(event.target.value)}
                      className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <option value="http-api">HTTP API</option>
                      <option value="queue-worker">Queue worker</option>
                    </select>
                  </div>
                </>
              ) : null}

              {intentId === "deploy-dev" ? (
                builds.length === 0 ? (
                  <EmptyState
                    title="Nothing to deploy yet"
                    body="No CI builds exist for this application. Connect a repository in the onboarding journey, run CI, then return here."
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <Link
                            to="/prototype/kimi/onboarding"
                            search={{ app: appId, stage: undefined }}
                          >
                            Open onboarding
                          </Link>
                        }
                      />
                    }
                  />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pv-artifact">Artifact</Label>
                    <select
                      id="pv-artifact"
                      value={artifactId}
                      onChange={(event) => setArtifactId(event.target.value)}
                      className="h-10 rounded-md border border-input bg-transparent px-3 font-mono text-[13px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {builds.map((build) => (
                        <option key={build.id} value={build.id} disabled={build.checks !== "green"}>
                          {build.id}
                          {build.id === defaultArtifact ? " (recommended)" : ""}
                          {build.checks !== "green" ? " (failed checks)" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Recommended: latest build with green CI checks. Builds that failed checks are
                      not selectable.
                    </p>
                  </div>
                )
              ) : null}

              {intentId === "request-access" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pv-role">Role</Label>
                  <select
                    id="pv-role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="read-write">Developer, read-write</option>
                    <option value="read-only">Read-only</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    The approver sees this choice in SailPoint and can reject it there.
                  </p>
                </div>
              ) : null}

              {needsConfirm ? (
                <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 size-4 accent-(--color-primary)"
                  />
                  <span className="text-[13px] leading-snug text-foreground">
                    I understand this deploys to the DEV environment of {app.name}.
                  </span>
                </label>
              ) : null}
            </Panel>
          </div>

          <div>
            <SectionHead title="Preflight" hint="runs before anything is sent" className="mb-2" />
            <Panel>
              <ul className="divide-y divide-border">
                {preflight.map((check) => (
                  <li key={check.label} className="flex items-start gap-2.5 px-4 py-2.5">
                    {check.status === "pass" ? (
                      <IconCheck
                        size={15}
                        strokeWidth={2.2}
                        aria-hidden
                        className="mt-0.5 shrink-0 text-success-ink"
                      />
                    ) : check.status === "warn" ? (
                      <IconAlertTriangle
                        size={15}
                        strokeWidth={2}
                        aria-hidden
                        className="mt-0.5 shrink-0 text-warning-ink"
                      />
                    ) : (
                      <IconCircleDashed
                        size={15}
                        strokeWidth={2}
                        aria-hidden
                        className="mt-0.5 shrink-0 text-critical-ink"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-foreground">
                        {check.label}
                        <span
                          className={cn(
                            "ml-2 text-[11px] font-semibold uppercase",
                            check.status === "pass"
                              ? "text-success-ink"
                              : check.status === "warn"
                                ? "text-warning-ink"
                                : "text-critical-ink",
                          )}
                        >
                          {check.status}
                        </span>
                      </span>
                      {check.note ? (
                        <span className="block text-xs leading-snug text-muted-foreground">
                          {check.note}
                          {check.label === "Previous deployment" && check.status === "warn" ? (
                            <>
                              {" "}
                              <Link
                                to="/prototype/kimi/diagnosis"
                                search={{
                                  app: appId,
                                  run: runsFor(appId).find((r) => r.status === "failed")?.id ?? "",
                                }}
                                className="font-medium text-brand-ink underline-offset-3 hover:underline"
                              >
                                Open diagnosis
                              </Link>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </div>

      {/* Payload + execute */}
      <div>
        <SectionHead
          title="What will be sent"
          hint={`executed by ${SOURCES[intent.executedBy].label}, observed by Atlas`}
          className="mb-2"
        />
        <Panel className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{intent.risk}</Badge>
            <span className="text-xs text-muted-foreground">{intent.riskNote}</span>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-muted/60 p-3 font-mono text-[12px] leading-relaxed text-foreground">
            {JSON.stringify(payload, null, 2)}
          </pre>
          <ol className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
            <li>
              1. Atlas validates the payload and sends it to {SOURCES[intent.executedBy].label}.
            </li>
            <li>
              2. {SOURCES[intent.executedBy].label} executes; Atlas never applies changes itself.
            </li>
            <li>3. The run page shows progress, failure, outcome and evidence as they arrive.</li>
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button onClick={execute} disabled={!canExecute}>
              {intent.title} (simulated)
            </Button>
            {!canExecute ? (
              <span className="text-xs text-muted-foreground">
                {hasFail
                  ? "Resolve the failing preflight checks first."
                  : "Confirm the DEV deployment above to enable this."}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Creates a simulated run in this browser session. Nothing is sent to a real system.
              </span>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
