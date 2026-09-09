import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import { useOnboardingMotion } from "./motion";
import EcsIcon from "aws-react-icons/icons/ArchitectureServiceAmazonElasticContainerService";
import AlbIcon from "aws-react-icons/icons/ResourceElasticLoadBalancingApplicationLoadBalancer";
import EcrIcon from "aws-react-icons/icons/ArchitectureServiceAmazonElasticContainerRegistry";
import IamIcon from "aws-react-icons/icons/ArchitectureServiceAWSIdentityandAccessManagement";
import LogsIcon from "aws-react-icons/icons/ArchitectureServiceAmazonCloudWatch";
import { executionPhases, type ExecutionPhase } from "./ecs-run";
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
}: {
  changeKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
      className="sa-resource-feedback"
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
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={`sa-node${actionable ? " sa-node-action" : ""} sa-node-${state}`}
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
      <rect x={(width - 64) / 2} width={64} height={64} rx={4} className="sa-node-mask" />
      <rect x={hitX} y={hitY} width={hitWidth} height={hitHeight} rx={4} className="sa-node-hit" />
      <ResourceFeedback
        changeKey={`${state}:${detail}`}
        x={hitX}
        y={hitY}
        width={hitWidth}
        height={hitHeight}
      />
      <svg
        x={(width - 48) / 2}
        y={8}
        width={48}
        height={48}
        viewBox={node.id === "alb" ? "2 2 44 44" : "0 0 48 48"}
        aria-hidden="true"
      >
        <Icon size={48} />
      </svg>
      <text x={width / 2} y={84} textAnchor="middle" className="sa-node-title">
        {shortLabel}
      </text>
      <text x={width / 2} y={107} textAnchor="middle" className="sa-node-detail">
        {shortDetail}
      </text>
      {statusLabel ? (
        <text x={width / 2} y={130} textAnchor="middle" className="sa-node-status">
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
  return (
    <section
      className={`sa-architecture${executionPhase ? " sa-execution" : ""}`}
      aria-label={phaseMeta ? `Stack progress: ${phaseMeta.title}` : "Planned architecture"}
      data-execution-phase={executionPhase}
      data-animate-connections={animateConnections}
    >
      {!executionPhase && (
        <header className="sa-header">
          <h3>{phaseMeta ? "Stack progress" : "Generated architecture"}</h3>
          <span
            role={phaseMeta ? "status" : undefined}
            aria-live={phaseMeta ? "polite" : undefined}
            aria-label={phaseMeta ? `${phaseMeta.title}. ${phaseMeta.detail}` : undefined}
            title={phaseMeta?.detail}
          >
            {phaseMeta ? `Current phase · ${phaseMeta.title}` : "Planned · Fargate"}
          </span>
        </header>
      )}
      <div className="sa-canvas">
        <svg
          className="sa-diagram"
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
              <path d="M1 1 L9 5 L1 9" className="sa-arrow-head" />
            </marker>
          </defs>
          <g
            className={`sa-cluster sa-cluster-${clusterState}`}
            role="group"
            aria-label={`ECS cluster ${config.cluster}${clusterStatusLabel ? ` — ${clusterStatusLabel}` : ""}`}
            data-execution-state={clusterState}
          >
            <rect x={336} y={36} width={288} height={224} rx={6} className="sa-cluster-mask" />
            <rect x={336} y={36} width={288} height={224} rx={6} className="sa-cluster-boundary" />
            <ResourceFeedback changeKey={clusterState} x={336} y={36} width={288} height={224} />
            <text x={358} y={65} className="sa-cluster-title">
              ECS cluster
            </text>
            <text x={358} y={88} className="sa-cluster-name">
              <title>{config.cluster}</title>
              {config.cluster.length > 36 ? `${config.cluster.slice(0, 34)}…` : config.cluster}
            </text>
            {clusterStatusLabel ? (
              <text x={358} y={112} className="sa-cluster-status">
                {clusterStatusLabel}
              </text>
            ) : null}
          </g>
          {showConnections && (
            <g
              className={`sa-paths${executionPhase ? ` sa-paths-${executionPhase}` : ""}`}
              aria-hidden="true"
            >
              {[
                "M212 156 H440",
                "M208 372 H288 V180 H440",
                "M480 340 V264",
                "M516 156 H784 V340",
              ].map((path) => (
                <path key={path} d={path} pathLength={1} markerEnd={`url(#${markerId})`} />
              ))}
            </g>
          )}
          {showConnections && (
            <g className="sa-edge-labels">
              <text x={296} y={140} textAnchor="middle" className="sa-edge-label">
                HTTP · 8080
              </text>
              <text x={276} y={300} textAnchor="end" className="sa-edge-label">
                Container image
              </text>
              <text x={496} y={304} className="sa-edge-label">
                Permissions
              </text>
              <text x={800} y={300} className="sa-edge-label">
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
          className="sa-endpoint-reveal"
          data-open={executionPhase === "complete"}
          inert={executionPhase !== "complete"}
          aria-hidden={executionPhase !== "complete"}
        >
          <div className="sa-endpoint-clip">
            <div className="sa-endpoint" data-ready="true">
              <div>
                <span>Service endpoint</span>
                <a
                  href={`https://${config.serviceName}.dev.example.com`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {config.serviceName}.dev.example.com ↗
                </a>
              </div>
              <dl>
                <div>
                  <dt>Environment</dt>
                  <dd>{config.environment}</dd>
                </div>
                <div>
                  <dt>Region</dt>
                  <dd>{config.region}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
      {!executionPhase && (
        <div className="sa-endpoint">
          <div>
            <strong>Service endpoint</strong>
            <span>Route 53 → Application load balancer</span>
          </div>
          <div>
            <code>{config.serviceName}.dev.example.com</code>
            <small>Planned DNS record</small>
          </div>
        </div>
      )}
    </section>
  );
}
