import { IconExternalLink } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import type { Application } from "./fixtures";
import { Chip, Eyebrow } from "./ui";

type DocSource = {
  id: string;
  title: string;
  type: string;
  docId: string;
  summary: string;
  owner: string;
  freshness: "fresh" | "aging" | "stale";
  updatedAt: string;
  sourceSystem: string;
};

export function DocsView({ application }: { application: Application }) {
  const documents: DocSource[] = [
    {
      id: "doc-1",
      title: "Ledger Refund API Runtime Configuration Guide",
      type: "guide",
      docId: "conf-4821",
      summary: "Environment variables, database pool parameters, and secret path conventions.",
      owner: "Payments Platform",
      freshness: "fresh",
      updatedAt: "3 days ago",
      sourceSystem: "GitHub Docs",
    },
    {
      id: "doc-2",
      title: "Managed Container Workload Onboarding Runbook",
      type: "runbook",
      docId: "rb-118",
      summary:
        "Standard operational runbook for container startup, ingress health checks, and autoscaling triggers.",
      owner: "DevEx Platform",
      freshness: "fresh",
      updatedAt: "1 week ago",
      sourceSystem: "Confluence",
    },
    {
      id: "doc-3",
      title: "ADR-0024: Distributed Idempotency Key Specification",
      type: "adr",
      docId: "adr-0024",
      summary:
        "Architectural decision on Redis lease acquisition for preventing double-refund execution.",
      owner: application.techLead,
      freshness: "aging",
      updatedAt: "3 months ago",
      sourceSystem: "Architecture Wiki",
    },
    {
      id: "doc-4",
      title: "Disaster Recovery & Multi-AZ Failover Runbook",
      type: "runbook",
      docId: "dr-pay-02",
      summary: "Emergency runbook for cross-region routing switchover during us-east-1 disruption.",
      owner: "SRE Core",
      freshness: "stale",
      updatedAt: "9 months ago",
      sourceSystem: "Runbook Hub",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 bg-background pr-1">
        <div>
          <Eyebrow>Workbench · Authoritative Knowledge</Eyebrow>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
            Documentation Sources
          </h1>
          <p className="mt-1 max-w-[65ch] text-[13px] leading-relaxed text-muted-foreground">
            Authoritative runbooks, ADRs, and technical guides registered for {application.name}.
          </p>
        </div>
      </header>

      {/* Document Registry Directory */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-1">
          <span>Registered Knowledge Sources ({documents.length})</span>
          <span>Verified Lineage</span>
        </div>

        <div className="rounded-[4px] border border-border bg-surface overflow-hidden">
          <div className="flex flex-col divide-y divide-border">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 flex flex-col md:flex-row items-start justify-between gap-4 transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13.5px] font-bold text-foreground hover:text-brand-ink transition-colors cursor-pointer">
                      {doc.title}
                    </h3>
                    <Chip tone="neutral" className="text-[10px]">
                      {doc.type} · <span className="font-mono">{doc.docId}</span>
                    </Chip>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground max-w-[65ch]">
                    {doc.summary}
                  </p>
                </div>

                {/* Right metadata */}
                <div className="flex flex-row md:flex-col items-end justify-between gap-2 shrink-0 self-stretch md:self-auto w-full md:w-auto pt-1 border-t md:border-t-0 border-border/50">
                  <div className="flex items-center gap-2">
                    <FreshnessBadge freshness={doc.freshness} />
                    <span className="text-[11px] text-muted-foreground">{doc.updatedAt}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <span>{doc.owner}</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      render={
                        <a href="https://example.com/docs" target="_blank" rel="noreferrer" />
                      }
                    >
                      {doc.sourceSystem} <IconExternalLink size={12} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FreshnessBadge({ freshness }: { freshness: DocSource["freshness"] }) {
  switch (freshness) {
    case "fresh":
      return <Chip tone="success">● Fresh</Chip>;
    case "aging":
      return <Chip tone="warning">● Aging</Chip>;
    case "stale":
      return <Chip tone="critical">● Stale</Chip>;
  }
}
