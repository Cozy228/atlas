import { useState, useEffect } from "react";
import {
  IconChevronDown,
  IconChevronRight,
  IconCode,
  IconExternalLink,
  IconRefresh,
  IconRocket,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Application } from "./fixtures";
import { Eyebrow, Id, Panel } from "./ui";
import { ArchitectureCanvas, type ArchNodeId } from "./architecture-canvas";

const STAGES = [
  {
    id: "pr",
    label: "Open Infrastructure Pull Request",
    mark: "SCM",
    artifact: "PR #142 · example/repository",
  },
  {
    id: "connector",
    label: "Configure Cloud Connector",
    mark: "DEL",
    artifact: "Connector example-dev",
  },
  {
    id: "plan",
    label: "Trigger Infrastructure Workspace Plan",
    mark: "IAC",
    artifact: "Plan run-98214",
  },
  {
    id: "build",
    label: "Register ECR Container Repository",
    mark: "REG",
    artifact: "ecr.aws/payments/refund-processor",
  },
  {
    id: "deploy",
    label: "Trigger First DEV Canary Deployment",
    mark: "DEL",
    artifact: "https://example.com/deployments/refund-processor",
  },
];

export function ScaffoldView({ application }: { application: Application }) {
  // Phase 1 (decide) vs Phase 2 (executing) vs Phase 3 (completed)
  const [phase, setPhase] = useState<"decide" | "executing" | "completed">("decide");

  // Form decisions
  const [serviceName, setServiceName] = useState("refund-processor");
  const [ingressType, setIngressType] = useState<"internal" | "public">("internal");
  const [secretBinding, setSecretBinding] = useState(true);
  const [codePreviewOpen, setCodePreviewOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ArchNodeId>("ecs");

  // Execution stage simulation
  const [activeStageIdx, setActiveStageIdx] = useState(0);

  // Execute pipeline step timer
  useEffect(() => {
    if (phase === "executing") {
      const interval = setInterval(() => {
        setActiveStageIdx((current) => {
          if (current >= STAGES.length - 1) {
            clearInterval(interval);
            setPhase("completed");
            return current;
          }
          return current + 1;
        });
      }, 1600);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const archSpec = {
    serviceName,
    appCode: application.code,
    ingressType,
    secretBinding,
    activeStageIdx,
    isExecuting: phase !== "decide",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 bg-background pr-1">
        <div>
          <Eyebrow>Workbench · Governed Action</Eyebrow>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
            Scaffold Workload
          </h1>
          <p className="mt-1 max-w-[65ch] text-[13px] leading-relaxed text-muted-foreground">
            Provision a governed microservice for {application.name} with live architecture topology
            mapping.
          </p>
        </div>
        {phase !== "decide" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPhase("decide");
              setActiveStageIdx(0);
            }}
          >
            <IconRefresh size={14} /> Reconfigure
          </Button>
        )}
      </header>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Spec Configuration in Phase 1 OR Live Stream in Phase 2 */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {phase === "decide" ? (
            <Panel title="Specifications" note="Standardized managed-container recipe." ticks>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPhase("executing");
                  setActiveStageIdx(0);
                }}
                className="p-4 flex flex-col gap-4 text-[13px]"
              >
                <div>
                  <label
                    htmlFor="service-name"
                    className="block text-[11px] font-semibold text-foreground mb-1 uppercase font-mono tracking-wider"
                  >
                    Service Name
                  </label>
                  <input
                    id="service-name"
                    type="text"
                    value={serviceName}
                    onChange={(e) =>
                      setServiceName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                    }
                    className="h-9 w-full rounded-[4px] border border-border bg-surface px-3 font-mono text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    required
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Namespace:{" "}
                    <Id>
                      {application.code.toLowerCase()}-{serviceName}
                    </Id>
                  </p>
                </div>

                <div>
                  <span className="block text-[11px] font-semibold text-foreground mb-1 uppercase font-mono tracking-wider">
                    Network & Ingress
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIngressType("internal")}
                      className={cn(
                        "rounded-[4px] border p-2 text-left text-[12px] transition-colors",
                        ingressType === "internal"
                          ? "border-brand bg-brand-tint/30 text-brand-ink font-semibold"
                          : "border-border bg-surface text-muted-foreground",
                      )}
                    >
                      <span className="block font-bold text-foreground">Internal ALB</span>
                      <span className="block text-[10.5px] text-muted-foreground">Private VPC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIngressType("public")}
                      className={cn(
                        "rounded-[4px] border p-2 text-left text-[12px] transition-colors",
                        ingressType === "public"
                          ? "border-brand bg-brand-tint/30 text-brand-ink font-semibold"
                          : "border-border bg-surface text-muted-foreground",
                      )}
                    >
                      <span className="block font-bold text-foreground">Public Ingress</span>
                      <span className="block text-[10.5px] text-muted-foreground">WAF Edge</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-[4px] border border-border p-2.5 bg-surface">
                  <div>
                    <span className="font-semibold text-foreground block text-[12px]">
                      Attach Managed Secret
                    </span>
                    <span className="text-muted-foreground text-[11px] block">
                      Runtime credential injection
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={secretBinding}
                    onChange={(e) => setSecretBinding(e.target.checked)}
                    className="size-4 accent-brand rounded"
                  />
                </div>

                <div className="rounded-[4px] bg-secondary/50 p-2.5 text-[11.5px] text-muted-foreground">
                  Target Account: <Id>example-dev-4821</Id> · Preflight:{" "}
                  <span className="text-success-ink font-bold">Passed</span>
                </div>

                <Button type="submit" size="sm" className="w-full mt-2">
                  <IconRocket size={15} aria-hidden />
                  Generate & Open Pull Request
                </Button>
              </form>
            </Panel>
          ) : (
            <Panel
              title="Automation Stream"
              note="SCM -> infrastructure plan -> delivery execution."
              ticks
            >
              <div className="flex flex-col divide-y divide-border p-2">
                {STAGES.map((stg, idx) => {
                  const isDone = idx <= activeStageIdx;
                  const isCurrent = idx === activeStageIdx && phase === "executing";

                  return (
                    <div key={stg.id} className="p-2.5 flex flex-col gap-1 text-[12px]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="grid size-4 place-items-center rounded-full text-[10px] font-mono">
                            {isDone && !isCurrent ? (
                              <span className="text-success-ink font-bold">✓</span>
                            ) : isCurrent ? (
                              <span className="size-2 rounded-full bg-brand" />
                            ) : (
                              <span className="text-muted-foreground">•</span>
                            )}
                          </span>
                          <span
                            className={cn(
                              "font-semibold",
                              isDone ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {stg.label}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground uppercase">
                          {stg.mark}
                        </span>
                      </div>

                      {isDone && (
                        <div className="ml-6 mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-brand-ink bg-brand-tint/40 px-2 py-0.5 rounded-[2px] truncate">
                          <IconExternalLink size={11} />
                          <span className="truncate">{stg.artifact}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {phase === "completed" && (
                <div className="border-t border-border p-3 flex flex-col gap-2">
                  <Button
                    size="sm"
                    className="w-full"
                    render={
                      <a
                        href="https://example.com/pull-requests/142"
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    Review Pull Request #142 <IconExternalLink size={13} />
                  </Button>
                </div>
              )}
            </Panel>
          )}

          {/* Foldable Code / Terraform Preview */}
          <div className="rounded-[4px] border border-border bg-card p-3">
            <button
              type="button"
              onClick={() => setCodePreviewOpen(!codePreviewOpen)}
              className="flex w-full items-center justify-between text-[12px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-1.5 font-mono">
                <IconCode size={14} /> main.tf (Generated IaC)
              </span>
              {codePreviewOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </button>

            {codePreviewOpen && (
              <pre className="mt-2 overflow-x-auto rounded-[4px] border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                {`module "ecs_${serviceName}" {
  source       = "registry.example.com/example/ecs-service/aws"
  version      = "3.4.0"
  name         = "${application.code.toLowerCase()}-${serviceName}"
  ingress_type = "${ingressType}"
  secret_mount = ${secretBinding}
}`}
              </pre>
            )}
          </div>
        </div>

        {/* Right Column: Live Architecture Canvas & Node Spec */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <ArchitectureCanvas
            spec={archSpec}
            selectedNodeId={selectedNode}
            onSelectNode={(id) => setSelectedNode(id)}
          />

          {/* Node Spec Summary */}
          <div className="rounded-[4px] border border-border bg-surface-2 p-3.5 text-[12px] flex flex-col gap-1.5 font-mono text-muted-foreground">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-foreground font-bold">
              <span>Node Inspector · {selectedNode.toUpperCase()}</span>
              <span className="text-brand-ink text-[11px]">AWS Fargate Spec</span>
            </div>
            {selectedNode === "ecs" ? (
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11.5px]">
                <div>
                  • CPU Allocation: <span className="text-foreground">512 (0.5 vCPU)</span>
                </div>
                <div>
                  • Memory Allocation: <span className="text-foreground">1024 MB</span>
                </div>
                <div>
                  • Desired Count: <span className="text-foreground">2 Tasks (Multi-AZ)</span>
                </div>
                <div>
                  • Container Port: <span className="text-foreground">8080 (HTTP)</span>
                </div>
              </div>
            ) : selectedNode === "alb" ? (
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11.5px]">
                <div>
                  • Protocol: <span className="text-foreground">HTTPS (Port 443)</span>
                </div>
                <div>
                  • Target Group: <span className="text-foreground">tg-refund-8080</span>
                </div>
                <div>
                  • Health Check: <span className="text-foreground">/healthz (200 OK)</span>
                </div>
                <div>
                  • Scheme: <span className="text-foreground">{ingressType}</span>
                </div>
              </div>
            ) : (
              <div className="pt-1 text-[11.5px]">
                Managed by the example cloud baseline. Security policy: Least-privilege IAM profile.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
