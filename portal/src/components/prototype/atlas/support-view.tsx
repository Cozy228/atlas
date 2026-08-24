import { IconMessages, IconPhoneCall } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import type { Application } from "./fixtures";
import { Chip, Eyebrow } from "./ui";

type SupportRoute = {
  id: string;
  problemType: string;
  responsibleTeam: string;
  channel: string;
  sla: string;
  contact: string;
  description: string;
};

export function SupportView({ application }: { application: Application }) {
  const routes: SupportRoute[] = [
    {
      id: "sr-deploy",
      problemType: "Deployments & Pipelines",
      responsibleTeam: "DevEx Platform Team",
      channel: "#example-platform-support",
      sla: "15 min",
      contact: "Primary on-call",
      description:
        "Pipeline stage execution, connector validation, and container image pull failures.",
    },
    {
      id: "sr-iam",
      problemType: "Identity & Cloud Access",
      responsibleTeam: "Identity & Access Management",
      channel: "#example-access-support",
      sla: "2 hours",
      contact: "Identity on-call",
      description: "Group membership sync, role elevation, and cross-account IAM role assumption.",
    },
    {
      id: "sr-cloud",
      problemType: "Cloud Infrastructure & Load Balancing",
      responsibleTeam: "Cloud Infrastructure Engineering",
      channel: "#example-cloud-ops",
      sla: "30 min",
      contact: "Cloud on-call",
      description: "Subnet routing, ALB health check failures, and AWS account quotas.",
    },
    {
      id: "sr-secrets",
      problemType: "Secrets & Encryption",
      responsibleTeam: "Security Operations (SecOps)",
      channel: "#example-secrets-support",
      sla: "1 hour",
      contact: "Security on-call",
      description:
        "Short-lived credential expiration, database credential rotation, and KMS key access.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 bg-background pr-1">
        <div>
          <Eyebrow>Workbench · Support Routing</Eyebrow>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
            Platform Escalation Directory
          </h1>
          <p className="mt-1 max-w-[65ch] text-[13px] leading-relaxed text-muted-foreground">
            Authoritative escalation routes and responsible platform engineering contacts for{" "}
            {application.name}.
          </p>
        </div>
      </header>

      {/* Directory List / Table */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-1">
          <span>Responsible Platform Teams</span>
          <span>SLA & Escalation Matrix</span>
        </div>

        <div className="rounded-[4px] border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="border-b border-border bg-surface-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Failure Domain</th>
                  <th className="px-4 py-2.5">Responsible Team & On-call</th>
                  <th className="px-4 py-2.5">SLA</th>
                  <th className="px-4 py-2.5">Support Channel</th>
                  <th className="px-4 py-2.5 text-right">Escalate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {routes.map((route) => (
                  <tr key={route.id} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3.5 align-top">
                      <span className="font-bold text-foreground block text-[13px]">
                        {route.problemType}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground leading-relaxed block mt-0.5 max-w-[32ch]">
                        {route.description}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <span className="font-semibold text-foreground block">
                        {route.responsibleTeam}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground block mt-0.5">
                        Contact: {route.contact}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <Chip tone="neutral" className="font-mono text-[11px]">
                        {route.sla}
                      </Chip>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <a
                        href={`https://example.com/support/${route.channel.slice(1)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-brand-ink hover:underline"
                      >
                        <IconMessages size={14} />
                        {route.channel}
                      </a>
                    </td>
                    <td className="px-4 py-3.5 align-top text-right">
                      <Button variant="outline" size="xs">
                        <IconPhoneCall size={12} />
                        Page On-call
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
