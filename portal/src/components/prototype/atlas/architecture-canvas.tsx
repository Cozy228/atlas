/**
 * Prototype `atlas` — Architecture Canvas (Interactive AWS Topology Diagram)
 * =========================================================================
 * An authentic cloud architecture schematic diagram featuring official AWS icons,
 * connected SVG signal paths, VPC/Subnet security boundaries, and live node states.
 */
import { useState } from "react";
import ArchitectureServiceElasticLoadBalancing from "aws-react-icons/icons/ArchitectureServiceElasticLoadBalancing";
import ArchitectureServiceAmazonECSAnywhere from "aws-react-icons/icons/ArchitectureServiceAmazonECSAnywhere";
import ArchitectureServiceAWSIAMIdentityCenter from "aws-react-icons/icons/ArchitectureServiceAWSIAMIdentityCenter";
import ArchitectureServiceAWSSecretsManager from "aws-react-icons/icons/ArchitectureServiceAWSSecretsManager";
import ArchitectureServiceAmazonCloudWatch from "aws-react-icons/icons/ArchitectureServiceAmazonCloudWatch";
import ArchitectureServiceAmazonElasticContainerRegistry from "aws-react-icons/icons/ArchitectureServiceAmazonElasticContainerRegistry";
import ArchitectureServiceAWSWAF from "aws-react-icons/icons/ArchitectureServiceAWSWAF";
import ArchitectureServiceAmazonRoute53 from "aws-react-icons/icons/ArchitectureServiceAmazonRoute53";

import { cn } from "@/lib/utils";

export type ArchNodeId =
  | "route53"
  | "waf"
  | "alb"
  | "ecs"
  | "iam"
  | "secrets"
  | "ecr"
  | "cloudwatch";

export type NodeState = "idle" | "pending" | "provisioning" | "created";

export type ArchSpec = {
  serviceName: string;
  appCode: string;
  ingressType: "internal" | "public";
  secretBinding: boolean;
  activeStageIdx?: number;
  isExecuting?: boolean;
};

export function ArchitectureCanvas({
  spec,
  selectedNodeId,
  onSelectNode,
  className,
}: {
  spec: ArchSpec;
  selectedNodeId?: ArchNodeId | null;
  onSelectNode?: (id: ArchNodeId) => void;
  className?: string;
}) {
  const [internalSelected, setInternalSelected] = useState<ArchNodeId>("ecs");
  const activeSelected = selectedNodeId !== undefined ? selectedNodeId : internalSelected;

  const handleSelect = (id: ArchNodeId) => {
    setInternalSelected(id);
    onSelectNode?.(id);
  };

  // Node status resolver
  const getNodeState = (id: ArchNodeId): NodeState => {
    if (!spec.isExecuting) return "idle";
    const stage = spec.activeStageIdx ?? 0;
    switch (id) {
      case "ecr":
      case "iam":
        return stage >= 1 ? "created" : stage === 0 ? "provisioning" : "pending";
      case "alb":
      case "waf":
      case "route53":
        return stage >= 2 ? "created" : stage === 1 ? "provisioning" : "pending";
      case "secrets":
        return stage >= 3 ? "created" : stage === 2 ? "provisioning" : "pending";
      case "ecs":
      case "cloudwatch":
        return stage >= 4 ? "created" : stage >= 2 ? "provisioning" : "pending";
    }
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[4px] border border-border bg-surface select-none",
        className,
      )}
    >
      {/* Canvas Header & Subnet Legend */}
      <div className="flex items-center justify-between border-b border-border/80 bg-surface-2 px-4 py-2 text-[11px] font-mono text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <span className="size-2 rounded-full bg-brand" />
            Topology: Example Virtual Private Cloud (10.0.0.0/16)
          </span>
          <span className="hidden sm:inline text-muted-foreground/60">|</span>
          <span className="hidden sm:inline">
            Region: <span className="text-foreground">us-east-1 (Primary)</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="size-2 border border-brand bg-brand-tint" /> Public Tier
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 border border-border bg-secondary" /> Private Workload Tier
          </span>
        </div>
      </div>

      {/* SVG Canvas with SVG Diagram Lines & Boundaries */}
      <div className="relative h-[380px] w-full p-4 overflow-x-auto overflow-y-hidden">
        <svg
          className="absolute inset-0 size-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Arrow marker */}
            <marker
              id="arch-arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--color-border-strong, #888)" />
            </marker>
            <marker
              id="arch-arrow-active"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--brand, #001AFF)" />
            </marker>

            {/* Gradient stroke */}
            <linearGradient id="signal-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--brand, #001AFF)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--brand, #001AFF)" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* VPC Boundary Frame */}
          <rect
            x="20"
            y="20"
            width="95%"
            height="340"
            rx="6"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text
            x="36"
            y="42"
            fill="var(--color-muted-foreground)"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="600"
          >
            EXAMPLE VPC · DEV ENVIRONMENT
          </text>

          {/* Public Subnet Box */}
          <rect
            x="40"
            y="60"
            width="220"
            height="270"
            rx="4"
            fill="oklch(95% 0.045 264.18 / 0.08)"
            stroke="var(--brand)"
            strokeWidth="1"
            strokeOpacity="0.3"
          />
          <text
            x="52"
            y="80"
            fill="var(--brand-ink)"
            fontSize="9.5"
            fontFamily="monospace"
            fontWeight="700"
          >
            PUBLIC INGRESS TIER (DMZ)
          </text>

          {/* Private App Subnet Box */}
          <rect
            x="280"
            y="60"
            width="340"
            height="270"
            rx="4"
            fill="oklch(97% 0.006 264.18 / 0.15)"
            stroke="var(--color-border)"
            strokeWidth="1"
          />
          <text
            x="295"
            y="80"
            fill="var(--color-muted-foreground)"
            fontSize="9.5"
            fontFamily="monospace"
            fontWeight="700"
          >
            PRIVATE COMPUTE SUBNET (APP TIER)
          </text>

          {/* Governance & Secret Tier Box */}
          <rect
            x="640"
            y="60"
            width="280"
            height="270"
            rx="4"
            fill="oklch(97% 0.006 264.18 / 0.1)"
            stroke="var(--color-border)"
            strokeWidth="1"
          />
          <text
            x="655"
            y="80"
            fill="var(--color-muted-foreground)"
            fontSize="9.5"
            fontFamily="monospace"
            fontWeight="700"
          >
            SECURITY & GOVERNANCE PERIMETER
          </text>

          {/* SVG Connection Lines */}
          {/* 1. Client -> WAF/Route53 -> ALB */}
          <path
            d="M 150 145 L 150 185"
            fill="none"
            stroke={spec.isExecuting ? "var(--brand)" : "var(--color-border)"}
            strokeWidth="1.5"
            markerEnd="url(#arch-arrow)"
          />
          <text
            x="156"
            y="168"
            fill="var(--color-muted-foreground)"
            fontSize="8.5"
            fontFamily="monospace"
          >
            :443 HTTPS
          </text>

          {/* 2. ALB -> ECS Fargate */}
          <path
            d="M 230 220 C 270 220, 290 190, 340 190"
            fill="none"
            stroke={spec.isExecuting ? "var(--brand)" : "var(--color-border)"}
            strokeWidth="2"
            strokeDasharray={spec.isExecuting ? "5 3" : undefined}
            markerEnd={spec.isExecuting ? "url(#arch-arrow-active)" : "url(#arch-arrow)"}
          />
          <text
            x="250"
            y="195"
            fill="var(--brand-ink)"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="600"
          >
            Target Group :8080
          </text>

          {/* 3. ECS Fargate -> IAM Role */}
          <path
            d="M 480 170 C 530 170, 580 135, 680 135"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            markerEnd="url(#arch-arrow)"
          />
          <text
            x="540"
            y="145"
            fill="var(--color-muted-foreground)"
            fontSize="8.5"
            fontFamily="monospace"
          >
            AssumeRole
          </text>

          {/* 4. ECS Fargate -> Secrets Manager */}
          {spec.secretBinding && (
            <>
              <path
                d="M 480 205 C 530 205, 580 235, 680 235"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="1.5"
                markerEnd="url(#arch-arrow)"
              />
              <text
                x="540"
                y="230"
                fill="var(--color-muted-foreground)"
                fontSize="8.5"
                fontFamily="monospace"
              >
                secret reference
              </text>
            </>
          )}

          {/* 5. ECR -> ECS Fargate */}
          <path
            d="M 370 275 L 370 235"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            markerEnd="url(#arch-arrow)"
          />
          <text
            x="378"
            y="260"
            fill="var(--color-muted-foreground)"
            fontSize="8"
            fontFamily="monospace"
          >
            image pull
          </text>
        </svg>

        {/* --- Interactive Topology Nodes --- */}
        {/* Tier 1: Ingress (Route53/WAF & ALB) */}
        <div className="absolute left-[70px] top-[95px] z-10">
          <NodeCard
            id="waf"
            title={spec.ingressType === "public" ? "AWS WAF + Route53" : "Internal DNS"}
            subtitle={spec.ingressType === "public" ? "Global Edge ACL" : "Private Hosted Zone"}
            icon={
              spec.ingressType === "public" ? (
                <ArchitectureServiceAWSWAF size={28} />
              ) : (
                <ArchitectureServiceAmazonRoute53 size={28} />
              )
            }
            status={getNodeState("waf")}
            isSelected={activeSelected === "waf"}
            onClick={() => handleSelect("waf")}
          />
        </div>

        <div className="absolute left-[70px] top-[190px] z-10">
          <NodeCard
            id="alb"
            title={spec.ingressType === "public" ? "Internet-Facing ALB" : "Internal App ALB"}
            subtitle="Dual-AZ TLS Ingress"
            icon={<ArchitectureServiceElasticLoadBalancing size={28} />}
            status={getNodeState("alb")}
            isSelected={activeSelected === "alb"}
            onClick={() => handleSelect("alb")}
          />
        </div>

        {/* Tier 2: Compute (ECS Fargate & ECR) */}
        <div className="absolute left-[330px] top-[150px] z-10">
          <NodeCard
            id="ecs"
            title={`${spec.serviceName}`}
            subtitle="ECS Fargate Workload"
            badge="0.5 vCPU · 1GB RAM"
            icon={<ArchitectureServiceAmazonECSAnywhere size={32} />}
            status={getNodeState("ecs")}
            isSelected={activeSelected === "ecs"}
            onClick={() => handleSelect("ecs")}
            featured
          />
        </div>

        <div className="absolute left-[330px] top-[270px] z-10">
          <NodeCard
            id="ecr"
            title="Amazon ECR"
            subtitle={`${spec.appCode.toLowerCase()}/${spec.serviceName}`}
            icon={<ArchitectureServiceAmazonElasticContainerRegistry size={24} />}
            status={getNodeState("ecr")}
            isSelected={activeSelected === "ecr"}
            onClick={() => handleSelect("ecr")}
            compact
          />
        </div>

        {/* Tier 3: Governance & Security (IAM & Secrets Manager / CloudWatch) */}
        <div className="absolute left-[680px] top-[105px] z-10">
          <NodeCard
            id="iam"
            title="IAM Task Role"
            subtitle="Least Privilege Policy"
            icon={<ArchitectureServiceAWSIAMIdentityCenter size={28} />}
            status={getNodeState("iam")}
            isSelected={activeSelected === "iam"}
            onClick={() => handleSelect("iam")}
          />
        </div>

        {spec.secretBinding && (
          <div className="absolute left-[680px] top-[205px] z-10">
            <NodeCard
              id="secrets"
              title="AWS Secrets Manager"
              subtitle="Managed Secret Reference"
              icon={<ArchitectureServiceAWSSecretsManager size={28} />}
              status={getNodeState("secrets")}
              isSelected={activeSelected === "secrets"}
              onClick={() => handleSelect("secrets")}
            />
          </div>
        )}

        <div className="absolute left-[800px] top-[270px] z-10">
          <NodeCard
            id="cloudwatch"
            title="CloudWatch Logs"
            subtitle="/aws/ecs/logs"
            icon={<ArchitectureServiceAmazonCloudWatch size={24} />}
            status={getNodeState("cloudwatch")}
            isSelected={activeSelected === "cloudwatch"}
            onClick={() => handleSelect("cloudwatch")}
            compact
          />
        </div>
      </div>

      {/* Node Inspector Footer */}
      <div className="border-t border-border bg-surface-2/60 px-4 py-2.5 flex items-center justify-between text-[11.5px]">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold uppercase text-muted-foreground">
            Inspector:
          </span>
          <span className="font-bold text-foreground capitalize">{activeSelected} details</span>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          Click any node on the canvas to inspect its infrastructure attributes.
        </div>
      </div>
    </div>
  );
}

function NodeCard({
  id: _id,
  title,
  subtitle,
  badge,
  icon,
  status,
  isSelected,
  onClick,
  featured = false,
  compact = false,
}: {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ReactNode;
  status: NodeState;
  isSelected: boolean;
  onClick: () => void;
  featured?: boolean;
  compact?: boolean;
}) {
  const isCreated = status === "created";
  const isProvisioning = status === "provisioning";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-[4px] border bg-surface p-2 text-left shadow-xs transition-all",
        compact ? "min-w-[120px] py-1.5" : featured ? "min-w-[180px] p-2.5" : "min-w-[155px]",
        isSelected
          ? "border-brand ring-2 ring-brand/20 bg-brand-tint/30"
          : "border-border hover:border-border-strong hover:bg-secondary/70",
        isCreated && "border-success/50",
        isProvisioning && "border-brand animate-pulse-ring",
      )}
    >
      <div className="shrink-0 p-1 rounded-[3px] bg-secondary/80 flex items-center justify-center">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[12px] font-bold text-foreground group-hover:text-brand-ink">
            {title}
          </span>
        </div>
        <p className="truncate text-[10.5px] text-muted-foreground">{subtitle}</p>
        {badge && (
          <span className="mt-1 inline-block font-mono text-[9.5px] font-semibold text-brand-ink">
            {badge}
          </span>
        )}
      </div>

      {/* State dot */}
      <span className="absolute -top-1 -right-1">
        {isCreated ? (
          <span className="grid size-3.5 place-items-center rounded-full bg-success text-on-brand text-[9px] font-bold">
            ✓
          </span>
        ) : isProvisioning ? (
          <span className="size-2.5 rounded-full bg-brand" />
        ) : null}
      </span>
    </button>
  );
}
