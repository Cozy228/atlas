import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import { useOnboardingMotion } from "./motion";
import EcsIcon from "aws-react-icons/icons/ArchitectureServiceAmazonElasticContainerService";
import AlbIcon from "aws-react-icons/icons/ResourceElasticLoadBalancingApplicationLoadBalancer";
import EcrIcon from "aws-react-icons/icons/ArchitectureServiceAmazonElasticContainerRegistry";
import IamIcon from "aws-react-icons/icons/ArchitectureServiceAWSIdentityandAccessManagement";
import LogsIcon from "aws-react-icons/icons/ArchitectureServiceAmazonCloudWatch";
import { executionPhases, type ExecutionPhase } from "./ecs-run";
import { cn } from "@/lib/utils";
import "./scaffold-architecture.css";

type ScaffoldArchitectureProps = {
  config: {
    serviceName: string;
    environment: string;
    region: string;
    cluster: string;
    exposure: string;
  };
  onOpenFile: (path: string) => void;
  canOpenFile?: (path: string) => boolean;
  executionPhase?: ExecutionPhase;
  applyStep?: number;
};

type ArchitectureNodeId = "alb" | "ecs" | "ecr" | "iam" | "logs";
type NodeState = "preview" | "unavailable" | "creating" | "created";

const applyOrder: ArchitectureNodeId[] = ["ecr", "iam", "alb", "logs"];

function getNodeState(
  nodeId: ArchitectureNodeId,
  executionPhase?: ExecutionPhase,
  applyStep = 0,
): NodeState {
  if (!executionPhase) return "preview";

  switch (executionPhase) {
    case "waiting-pr":
    case "checking-pipeline":
    case "waiting-tfe":
    case "planning":
    case "awaiting-apply":
      return "unavailable";
    case "applying":
      return applyOrder.indexOf(nodeId) < 0 || applyOrder.indexOf(nodeId) > applyStep
        ? "unavailable"
        : applyOrder.indexOf(nodeId) === applyStep
          ? "creating"
          : "created";
    case "waiting-resources":
    case "running-resources":
    case "waiting-app-pr":
    case "task-definition":
    case "waiting-ci":
    case "building":
    case "waiting-deploy":
      return nodeId === "ecs" ? "unavailable" : "created";
    case "deploying":
      return nodeId === "ecs" ? "creating" : "created";
    case "complete":
      return "created";
    default: {
      const _exhaustive: never = executionPhase;
      return _exhaustive;
    }
  }
}

function getNodeStatusLabel(state: NodeState): string | null {
  switch (state) {
    case "preview":
      return null;
    case "unavailable":
      return "Planned";
    case "creating":
      return "Creating";
    case "created":
      return "Created";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

type ArchitectureNode = {
  id: ArchitectureNodeId;
  x: number;
  y: number;
  width: number;
  icon: ComponentType<{ size?: number | string }>;
  label: string;
  detail: string;
  filePath: string;
};

function getNodeDetail(node: ArchitectureNode, executionPhase?: ExecutionPhase): string {
  if (node.id !== "ecr") return node.detail;

  switch (executionPhase) {
    case "building":
      return "Image building";
    case "waiting-deploy":
    case "deploying":
    case "complete":
      return "Image ready";
    default:
      return node.detail;
  }
}

function ResourceFeedback({
  changeKey,
  x,
  y,
  width,
  height,
  tone = "success",
}: {
  changeKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tone?: "success" | "info";
}) {
  const element = useRef<SVGRectElement>(null);
  const previous = useRef(changeKey);
  const { reduced } = useOnboardingMotion();
  useEffect(() => {
    if (previous.current === changeKey) return;
    previous.current = changeKey;
    if (reduced) return;
    const animation = element.current?.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }],
      { duration: 900, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [changeKey, reduced]);
  return (
    <rect
      ref={element}
      className={cn(
        "pointer-events-none opacity-0 [stroke-width:1.5]",
        tone === "info" ? "fill-info-ink/8 stroke-info-ink" : "fill-success/10 stroke-success-ink",
      )}
      x={x}
      y={y}
      width={width}
      height={height}
      rx={4}
      aria-hidden="true"
    />
  );
}

type DiagramNodeProps = {
  node: ArchitectureNode;
  state: NodeState;
  executionPhase?: ExecutionPhase;
  onOpenFile: () => void;
  focused?: boolean;
  actionable?: boolean;
};

function DiagramNode({
  node,
  state,
  executionPhase,
  onOpenFile,
  focused = false,
  actionable = true,
}: DiagramNodeProps) {
  const { x, y, width, icon: Icon, label } = node;
  const shortLabel = label.length > 27 ? `${label.slice(0, 25)}…` : label;
  const statusLabel = getNodeStatusLabel(state);
  const detail = getNodeDetail(node, executionPhase);
  const shortDetail = detail.length > 31 ? `${detail.slice(0, 29)}…` : detail;
  const hitX = -8;
  const hitY = node.id === "ecs" ? 0 : -8;
  const hitWidth = width + 16;
  const hitHeight = node.id === "ecs" ? 140 : 148;
  const focusedInExecution = focused && Boolean(executionPhase);
  const nodeHitClassName = cn(
    "fill-transparent stroke-transparent [stroke-width:1.5] transition-[fill,stroke,opacity] duration-[180ms] motion-reduce:transition-none",
    state === "unavailable" && (executionPhase ? "fill-transparent" : "fill-muted"),
    state === "creating" && "stroke-info-ink",
    focusedInExecution && "fill-info/5 stroke-info-ink",
    actionable && "group-hover/sa-node:fill-muted group-hover/sa-node:stroke-border",
    actionable &&
      (focusedInExecution
        ? "group-focus-visible/sa-node:stroke-info-ink"
        : "group-focus-visible/sa-node:stroke-brand"),
    actionable && "group-focus-visible/sa-node:[stroke-width:2]",
  );
  const nodeTitleClassName = cn(
    "pointer-events-none fill-foreground text-[18px] font-semibold",
    state === "unavailable" && "fill-muted-foreground",
  );
  const nodeDetailClassName = cn(
    "pointer-events-none fill-muted-foreground text-[15px] tabular-nums [font-feature-settings:'tnum']",
    focusedInExecution && "fill-info-ink",
    executionPhase && "transition-[fill] duration-[320ms] motion-reduce:transition-none",
  );
  const nodeStatusClassName = cn(
    "pointer-events-none fill-muted-foreground text-[14px] font-semibold leading-4 tabular-nums [font-feature-settings:'tnum']",
    executionPhase && "transition-[fill] duration-[320ms] motion-reduce:transition-none",
    state === "unavailable" && "fill-warning-ink",
    state === "creating" && "fill-info-ink",
    state === "created" && "fill-success-ink",
  );
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={cn("group/sa-node outline-none", actionable && "cursor-pointer")}
      role={actionable ? "button" : "img"}
      tabIndex={actionable ? 0 : -1}
      aria-label={`${actionable ? "Inspect " : ""}${label}${statusLabel ? ` — ${statusLabel}` : ""}`}
      data-node-id={node.id}
      data-execution-state={state}
      data-focused={focused ? "true" : undefined}
      onClick={actionable ? onOpenFile : undefined}
      onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
        if (actionable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpenFile();
        }
      }}
    >
      <title>{statusLabel ? `${label} — ${statusLabel}` : label}</title>
      <rect
        x={(width - 64) / 2}
        width={64}
        height={64}
        rx={4}
        className={state === "unavailable" ? "fill-muted" : "fill-card"}
      />
      <rect
        x={hitX}
        y={hitY}
        width={hitWidth}
        height={hitHeight}
        rx={4}
        className={nodeHitClassName}
      />
      <ResourceFeedback
        changeKey={`${state}:${detail}`}
        x={hitX}
        y={hitY}
        width={hitWidth}
        height={hitHeight}
        tone={focusedInExecution ? "info" : "success"}
      />
      <svg
        className={cn(
          "transition-[filter] duration-[420ms] motion-reduce:transition-none",
          executionPhase && state === "unavailable" && "grayscale",
        )}
        x={(width - 48) / 2}
        y={8}
        width={48}
        height={48}
        viewBox={node.id === "alb" ? "2 2 44 44" : "0 0 48 48"}
        aria-hidden="true"
      >
        <Icon size={48} />
      </svg>
      <text x={width / 2} y={84} textAnchor="middle" className={nodeTitleClassName}>
        {shortLabel}
      </text>
      <text x={width / 2} y={107} textAnchor="middle" className={nodeDetailClassName}>
        {shortDetail}
      </text>
      {statusLabel ? (
        <text x={width / 2} y={130} textAnchor="middle" className={nodeStatusClassName}>
          {statusLabel}
        </text>
      ) : null}
    </g>
  );
}

export function ScaffoldArchitecture({
  config,
  executionPhase,
  applyStep = 0,
  onOpenFile,
  canOpenFile,
}: ScaffoldArchitectureProps) {
  const markerId = useId();
  const [animateConnections] = useState(executionPhase !== "complete");
  const phaseMeta = executionPhases.find((phase) => phase.id === executionPhase);
  const clusterState: NodeState =
    executionPhase === "applying"
      ? "creating"
      : executionPhase &&
          [
            "task-definition",
            "waiting-app-pr",
            "waiting-resources",
            "running-resources",
            "waiting-ci",
            "building",
            "waiting-deploy",
            "deploying",
            "complete",
          ].includes(executionPhase)
        ? "created"
        : getNodeState("ecs", executionPhase);
  const clusterStatusLabel = getNodeStatusLabel(clusterState);
  const nodes: ArchitectureNode[] = [
    {
      id: "alb",
      x: 64,
      y: 116,
      width: 224,
      icon: AlbIcon,
      label: "Application load balancer",
      detail: "Internal · HTTPS :443",
      filePath: "ecs/service.tf",
    },
    {
      id: "ecs",
      x: 368,
      y: 116,
      width: 224,
      icon: EcsIcon,
      label: config.serviceName,
      detail: "ECS service · Task / container",
      filePath: "ecs/task-definition.json",
    },
    {
      id: "ecr",
      x: 64,
      y: 340,
      width: 224,
      icon: EcrIcon,
      label: "ECR repository",
      detail: config.serviceName,
      filePath: "ecs/service.tf",
    },
    {
      id: "iam",
      x: 368,
      y: 340,
      width: 224,
      icon: IamIcon,
      label: "IAM roles",
      detail: "Task & execution roles",
      filePath: "ecs/service.tf",
    },
    {
      id: "logs",
      x: 672,
      y: 340,
      width: 224,
      icon: LogsIcon,
      label: "CloudWatch logs",
      detail: `/ecs/${config.serviceName}`,
      filePath: "ecs/service.tf",
    },
  ];
  const showConnections = !executionPhase || executionPhase === "complete";
  const connectionColorClassName =
    executionPhase === "deploying"
      ? "stroke-info-ink"
      : executionPhase === "complete"
        ? "stroke-success-ink"
        : "stroke-muted-foreground";
  const connectionClassName = cn(
    "fill-none [stroke-width:1.4] transition-[stroke] duration-[420ms] motion-reduce:transition-none",
    connectionColorClassName,
    animateConnections &&
      executionPhase &&
      "[stroke-dasharray:1] motion-safe:animate-[sa-connect_680ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none",
  );
  const arrowClassName = cn(
    "fill-none [stroke-width:1.4] transition-[stroke] duration-[420ms] motion-reduce:transition-none",
    connectionColorClassName,
    animateConnections &&
      executionPhase === "complete" &&
      "motion-safe:animate-[sa-connection-labels_180ms_ease-out_500ms_both] motion-reduce:animate-none",
  );
  const edgeLabelsClassName = cn(
    animateConnections &&
      executionPhase &&
      "motion-safe:animate-[sa-connection-labels_300ms_ease-out_380ms_both] motion-reduce:animate-none",
  );
  const clusterBoundaryClassName = cn(
    "fill-muted stroke-border-strong [stroke-width:1] [stroke-dasharray:4_4] transition-[stroke] duration-[420ms] motion-reduce:transition-none",
    clusterState === "creating" && "stroke-info-ink",
    clusterState === "created" && "stroke-success-ink",
    executionPhase === "applying" &&
      "motion-safe:animate-[sa-working_1800ms_ease-in-out_infinite] motion-reduce:animate-none",
  );
  const clusterStatusClassName = cn(
    "fill-muted-foreground text-[14px] font-semibold transition-[fill] duration-[320ms] motion-reduce:transition-none",
    clusterState === "unavailable" && "fill-warning-ink",
    clusterState === "creating" && "fill-info-ink",
    clusterState === "created" && "fill-success-ink",
  );
  return (
    <section
      className={cn(
        "min-w-0 text-foreground",
        executionPhase ? "border-0 bg-transparent" : "border border-border bg-card",
      )}
      aria-label={phaseMeta ? `Stack progress: ${phaseMeta.title}` : "Planned architecture"}
      data-execution-phase={executionPhase}
      data-animate-connections={animateConnections}
    >
      {!executionPhase && (
        <header className="flex items-center justify-between gap-4 px-6 pt-4">
          <h3 className="m-0 text-[15px] font-semibold leading-6 text-foreground">
            {phaseMeta ? "Stack progress" : "Generated architecture"}
          </h3>
          <span
            className={cn(
              "text-xs leading-6 text-muted-foreground",
              phaseMeta && "font-semibold text-info-ink",
            )}
            role={phaseMeta ? "status" : undefined}
            aria-live={phaseMeta ? "polite" : undefined}
            aria-label={phaseMeta ? `${phaseMeta.title}. ${phaseMeta.detail}` : undefined}
            title={phaseMeta?.detail}
          >
            {phaseMeta ? `Current phase · ${phaseMeta.title}` : "Planned · Fargate"}
          </span>
        </header>
      )}
      <div
        className={cn(
          "min-w-0 overflow-x-auto px-0 pt-4 pb-2",
          executionPhase && "overflow-visible p-0",
        )}
      >
        <svg
          className={cn(
            "sa-diagram block h-auto w-full min-w-0 max-w-full font-sans",
            executionPhase && "max-h-96",
          )}
          viewBox="0 0 960 512"
          role="group"
          aria-label={
            phaseMeta
              ? `${phaseMeta.title}. ALB, ECS cluster ${config.cluster}, service ${config.serviceName}, ECR, CloudWatch, and IAM roles.`
              : `Planned ALB, ECS cluster ${config.cluster}, service ${config.serviceName}, ECR and CloudWatch with task and execution IAM roles`
          }
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M1 1 L9 5 L1 9" className={arrowClassName} />
            </marker>
          </defs>
          <g
            className="group/sa-cluster"
            role="group"
            aria-label={`ECS cluster ${config.cluster}${clusterStatusLabel ? ` — ${clusterStatusLabel}` : ""}`}
            data-execution-state={clusterState}
          >
            <rect x={336} y={36} width={288} height={224} rx={6} className="fill-card" />
            <rect
              x={336}
              y={36}
              width={288}
              height={224}
              rx={6}
              className={clusterBoundaryClassName}
            />
            <ResourceFeedback
              changeKey={clusterState}
              x={336}
              y={36}
              width={288}
              height={224}
              tone={clusterState === "creating" ? "info" : "success"}
            />
            <text x={358} y={65} className="fill-foreground text-[18px] font-[550]">
              ECS cluster
            </text>
            <text
              x={358}
              y={88}
              className="fill-muted-foreground text-[15px] tabular-nums [font-feature-settings:'tnum']"
            >
              <title>{config.cluster}</title>
              {config.cluster.length > 36 ? `${config.cluster.slice(0, 34)}…` : config.cluster}
            </text>
            {clusterStatusLabel ? (
              <text x={358} y={112} className={clusterStatusClassName}>
                {clusterStatusLabel}
              </text>
            ) : null}
          </g>
          {showConnections && (
            <g className="group/sa-paths" aria-hidden="true">
              {[
                "M212 156 H440",
                "M208 372 H288 V180 H440",
                "M480 340 V264",
                "M516 156 H784 V340",
              ].map((path) => (
                <path
                  key={path}
                  d={path}
                  pathLength={1}
                  markerEnd={`url(#${markerId})`}
                  className={connectionClassName}
                />
              ))}
            </g>
          )}
          {showConnections && (
            <g className={edgeLabelsClassName}>
              <text
                x={296}
                y={140}
                textAnchor="middle"
                className="fill-muted-foreground text-[14px] tabular-nums [font-feature-settings:'tnum']"
              >
                HTTP · 8080
              </text>
              <text
                x={276}
                y={300}
                textAnchor="end"
                className="fill-muted-foreground text-[14px] tabular-nums [font-feature-settings:'tnum']"
              >
                Container image
              </text>
              <text
                x={496}
                y={304}
                className="fill-muted-foreground text-[14px] tabular-nums [font-feature-settings:'tnum']"
              >
                Permissions
              </text>
              <text
                x={800}
                y={300}
                className="fill-muted-foreground text-[14px] tabular-nums [font-feature-settings:'tnum']"
              >
                Logs
              </text>
            </g>
          )}
          {nodes.map((node) => {
            const state = getNodeState(node.id, executionPhase, applyStep);
            return (
              <DiagramNode
                key={node.id}
                node={node}
                executionPhase={executionPhase}
                actionable={canOpenFile?.(node.filePath) ?? true}
                state={state}
                focused={
                  state === "creating" || (node.id === "ecr" && executionPhase === "building")
                }
                onOpenFile={() => onOpenFile(node.filePath)}
              />
            );
          })}
        </svg>
      </div>
      {executionPhase && (
        <div
          className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] [transition-duration:640ms,480ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1),ease-out] data-[open=true]:grid-rows-[1fr] data-[open=true]:opacity-100 data-[open=true]:delay-[180ms] motion-reduce:transition-none"
          data-open={executionPhase === "complete"}
          inert={executionPhase !== "complete"}
          aria-hidden={executionPhase !== "complete"}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className="mt-4 grid min-h-32 grid-cols-1 items-start border border-border bg-muted p-6"
              data-ready="true"
            >
              <div className="grid min-w-0 gap-1 text-[13px] leading-6">
                <span className="text-xs text-muted-foreground">Service endpoint</span>
                <a
                  className="text-[20px] font-[550] leading-8 text-brand-ink [overflow-wrap:anywhere] hover:underline"
                  href={`https://${config.serviceName}.dev.example.com`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {config.serviceName}.dev.example.com ↗
                </a>
              </div>
              <dl className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4">
                <div>
                  <dt className="text-xs leading-6 text-muted-foreground">Environment</dt>
                  <dd className="m-0 text-[14px] leading-6 tabular-nums [font-feature-settings:'tnum'] [overflow-wrap:anywhere]">
                    {config.environment}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs leading-6 text-muted-foreground">Region</dt>
                  <dd className="m-0 text-[14px] leading-6 tabular-nums [font-feature-settings:'tnum'] [overflow-wrap:anywhere]">
                    {config.region}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
      {!executionPhase && (
        <div className="flex items-center justify-between gap-6 border-t border-border px-6 py-4">
          <div className="grid min-w-0 gap-1 text-[13px] leading-6">
            <strong className="font-[550]">Service endpoint</strong>
            <span className="text-xs text-muted-foreground">
              Route 53 → Application load balancer
            </span>
          </div>
          <div className="grid min-w-0 gap-1 text-[13px] leading-6">
            <code className="[overflow-wrap:anywhere]">{config.serviceName}.dev.example.com</code>
            <small className="text-xs text-muted-foreground">Planned DNS record</small>
          </div>
        </div>
      )}
    </section>
  );
}
