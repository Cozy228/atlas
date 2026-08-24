import { useState } from "react";
import { IconCheck, IconExternalLink, IconTicket } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Application } from "./fixtures";
import { Chip, Eyebrow, Id } from "./ui";

type TicketItem = {
  id: string;
  kind: "ticket" | "change" | "incident";
  title: string;
  status: "in-progress" | "open" | "closed" | "planned";
  environment: string;
  openedAt: string;
  assignee: string;
  summary: string;
};

export function TicketsView({ application }: { application: Application }) {
  const [filter, setFilter] = useState<"all" | "ticket" | "change" | "incident">("all");
  const [newTicketModal, setNewTicketModal] = useState(false);
  const [ticketCreated, setTicketCreated] = useState(false);

  const items: TicketItem[] = [
    {
      id: "CHG-2891",
      kind: "change",
      title: "Deploy Hotfix v2.4.1 to DEV & UAT",
      status: "in-progress",
      environment: "DEV / UAT",
      openedAt: "Today, 10:30 UTC",
      assignee: "Release Engineering",
      summary: "Patches connection pool starvation under concurrent refund payload spikes.",
    },
    {
      id: "INC-1204",
      kind: "incident",
      title: "PROD Retry Spike on Payment Webhook",
      status: "open",
      environment: "PROD",
      openedAt: "2 days ago",
      assignee: application.techLead,
      summary: "Elevated 5xx rate (1.84%) on external bank callback ingress.",
    },
    {
      id: "TCK-8830",
      kind: "ticket",
      title: "Update ECS Task Definition CPU Allocation",
      status: "closed",
      environment: "DEV",
      openedAt: "1 week ago",
      assignee: "Platform Infra",
      summary: "Scaled Fargate task CPU from 256 to 512 to accommodate high-volume batch tests.",
    },
    {
      id: "TCK-8722",
      kind: "ticket",
      title: "Secret Credential Renewal Request",
      status: "closed",
      environment: "ALL",
      openedAt: "2 weeks ago",
      assignee: "Security Operations",
      summary: "Renewed a 90-day credential lease for database secret injection.",
    },
  ];

  const filteredItems = filter === "all" ? items : items.filter((i) => i.kind === filter);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 bg-background pr-1">
        <div>
          <Eyebrow>Workbench · ITSM & Governance</Eyebrow>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
            Tickets & Platform Changes
          </h1>
          <p className="mt-1 max-w-[65ch] text-[13px] leading-relaxed text-muted-foreground">
            Aggregated ITSM tickets, change records, and operational incidents for{" "}
            {application.name}.
          </p>
        </div>
        <Button size="sm" onClick={() => setNewTicketModal(true)}>
          <IconTicket size={14} aria-hidden />
          Open Pre-filled Ticket
        </Button>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono font-semibold uppercase text-muted-foreground mr-1">
          Filter:
        </span>
        {(["all", "incident", "change", "ticket"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setFilter(kind)}
            className={cn(
              "rounded-[3px] border px-2.5 py-1 text-[11.5px] font-semibold transition-colors capitalize",
              filter === kind
                ? "border-brand bg-brand text-on-brand"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {kind === "all" ? "All Activity" : `${kind}s`}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-1">
          <span>ITSM Records & Change Log ({filteredItems.length})</span>
          <span>Service catalog synced</span>
        </div>

        <div className="rounded-[4px] border border-border bg-surface overflow-hidden">
          <div className="flex flex-col divide-y divide-border">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 flex flex-wrap items-start justify-between gap-3 text-[12.5px] transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-brand-ink">{item.id}</span>
                    <TicketKindBadge kind={item.kind} />
                    <TicketStatusBadge status={item.status} />
                    <span className="text-[11.5px] text-muted-foreground">
                      · Env: <span className="font-mono">{item.environment}</span>
                    </span>
                  </div>
                  <h3 className="mt-1 text-[13.5px] font-bold text-foreground">{item.title}</h3>
                  <p className="mt-0.5 max-w-[65ch] text-[12px] leading-relaxed text-muted-foreground">
                    {item.summary}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>
                      Assignee: <span className="text-foreground">{item.assignee}</span>
                    </span>
                    <span>• Opened {item.openedAt}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  render={
                    <a href="https://example.com/service-desk" target="_blank" rel="noreferrer" />
                  }
                >
                  Service desk <IconExternalLink size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pre-filled Ticket Modal */}
      {newTicketModal && (
        <>
          <button
            type="button"
            aria-label="Close modal"
            onClick={() => setNewTicketModal(false)}
            className="fixed inset-0 z-50 bg-overlay/25 backdrop-blur-xs"
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(520px,94vw)] rounded-[4px] border border-border bg-card shadow-lg p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <Eyebrow>ITSM Integration</Eyebrow>
                <h2 className="text-[17px] font-bold text-foreground mt-0.5">
                  Open Pre-filled Support Ticket
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  Automatically attaches {application.code}, cloud account, and repository context
                  to the service desk.
                </p>
              </div>
            </div>

            {ticketCreated ? (
              <div className="rounded-[4px] bg-success/[0.08] border border-success/30 p-4 text-[13px] flex flex-col gap-2">
                <div className="flex items-center gap-2 text-success-ink font-bold">
                  <IconCheck size={16} /> Ticket TCK-9941 Created!
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Your ticket has been dispatched with high priority to the Platform Engineering
                  on-call roster.
                </p>
                <Button
                  size="xs"
                  variant="outline"
                  className="self-start mt-2"
                  onClick={() => {
                    setNewTicketModal(false);
                    setTicketCreated(false);
                  }}
                >
                  Close
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setTicketCreated(true);
                }}
                className="flex flex-col gap-4 text-[12.5px]"
              >
                <div>
                  <label
                    htmlFor="ticket-type"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1"
                  >
                    Ticket Category
                  </label>
                  <select
                    id="ticket-type"
                    className="h-9 w-full rounded-[4px] border border-border bg-surface px-2.5 text-foreground focus:border-brand focus:outline-none"
                  >
                    <option value="incident">Incident / Service Disruption</option>
                    <option value="request">Platform Configuration Change</option>
                    <option value="access">Security / Secrets Exception</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ticket-title"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1"
                  >
                    Subject Summary
                  </label>
                  <input
                    id="ticket-title"
                    type="text"
                    defaultValue={`[${application.code}] Issue with DEV deployment verification`}
                    className="h-9 w-full rounded-[4px] border border-border bg-surface px-2.5 text-foreground focus:border-brand focus:outline-none"
                    required
                  />
                </div>

                <div className="rounded-[4px] bg-secondary/50 p-2.5 text-[11.5px] text-muted-foreground">
                  Context Attachment: App <Id>{application.code}</Id> · Account <Id>example-dev</Id>{" "}
                  · Lead <Id>{application.techLead}</Id>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewTicketModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Dispatch Ticket
                  </Button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TicketKindBadge({ kind }: { kind: TicketItem["kind"] }) {
  switch (kind) {
    case "incident":
      return <Chip tone="critical">Incident</Chip>;
    case "change":
      return <Chip tone="brand">Change</Chip>;
    case "ticket":
      return <Chip tone="neutral">Ticket</Chip>;
  }
}

function TicketStatusBadge({ status }: { status: TicketItem["status"] }) {
  switch (status) {
    case "in-progress":
      return <span className="text-[11px] text-brand-ink font-semibold">In Progress</span>;
    case "open":
      return <span className="text-[11px] text-critical-ink font-semibold">Open</span>;
    case "closed":
      return <span className="text-[11px] text-success-ink font-semibold">Closed</span>;
    case "planned":
      return <span className="text-[11px] text-muted-foreground font-semibold">Planned</span>;
  }
}
