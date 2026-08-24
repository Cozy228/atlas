import { useState } from "react";
import { IconCheck, IconExternalLink, IconKey, IconUser, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import type { Application } from "./fixtures";
import { CURRENT_USER } from "./fixtures";
import { Chip, Eyebrow, Id, StatusDot } from "./ui";

type Grant = {
  id: string;
  who: string;
  role: string;
  status: "granted" | "pending" | "expired";
  sourceGroup: string;
  grantedAt?: string;
  requestId?: string;
};

export function AccessView({ application }: { application: Application }) {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("deployer");
  const [justification, setJustification] = useState(
    "Need deploy access for DEV hotfix validation.",
  );
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const [grants, setGrants] = useState<Grant[]>([
    {
      id: "g1",
      who: `${CURRENT_USER} (You)`,
      role: "Deployer (DEV)",
      status: "pending",
      sourceGroup: "example-pay-dev-deployers",
      requestId: "REQ-9812",
    },
    {
      id: "g2",
      who: application.techLead,
      role: "Application Owner",
      status: "granted",
      sourceGroup: "example-pay-owners",
      grantedAt: "2026-06-10",
    },
    {
      id: "g3",
      who: "Example Infrastructure Lead",
      role: "Infrastructure Lead",
      status: "granted",
      sourceGroup: "example-pay-infra",
      grantedAt: "2026-07-01",
    },
    {
      id: "g4",
      who: "Release Automation Service",
      role: "Automation Runner",
      status: "granted",
      sourceGroup: "example-automation-runner-pay",
      grantedAt: "2026-07-15",
    },
  ]);

  const pendingGrants = grants.filter((g) => g.status === "pending");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 bg-background pr-1">
        <div>
          <Eyebrow>Workbench · Access & IAM</Eyebrow>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
            Access & Permissions
          </h1>
          <p className="mt-1 max-w-[65ch] text-[13px] leading-relaxed text-muted-foreground">
            Access directory mappings and role assignments for {application.name}.
          </p>
        </div>
        <Button size="sm" onClick={() => setRequestModalOpen(true)}>
          <IconKey size={14} aria-hidden />
          Request Access
        </Button>
      </header>

      {/* 1. Pending Grants Callout */}
      {pendingGrants.length > 0 && (
        <div className="rounded-[4px] border border-warning/40 bg-warning/[0.04] p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-warning-ink">
              Pending Authorization ({pendingGrants.length})
            </span>
            <span className="text-[11px] text-muted-foreground">Waiting on manager approval</span>
          </div>

          <div className="flex flex-col divide-y divide-border/60">
            {pendingGrants.map((grant) => (
              <div
                key={grant.id}
                className="py-2 flex flex-wrap items-center justify-between gap-3 text-[12.5px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{grant.who}</span>
                    <Chip tone="warning">{grant.role}</Chip>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {grant.requestId}
                    </span>
                  </div>
                  <span className="text-[11.5px] text-muted-foreground">
                    · Directory target: <Id>{grant.sourceGroup}</Id>
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  render={<a href="https://example.com/access" target="_blank" rel="noreferrer" />}
                >
                  View in access directory <IconExternalLink size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Full Access Grants Table */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-1">
          <span>Active Role Assignments & Group Mappings ({grants.length})</span>
          <span>Access directory synced</span>
        </div>

        <div className="rounded-[4px] border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="border-b border-border bg-surface-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Member / Service</th>
                  <th className="px-4 py-2.5">Assigned Role</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Directory Group</th>
                  <th className="px-4 py-2.5 text-right">Granted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {grants.map((g) => (
                  <tr key={g.id} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <IconUser size={15} className="text-muted-foreground shrink-0" />
                      <span>{g.who}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{g.role}</td>
                    <td className="px-4 py-3">
                      {g.status === "granted" ? (
                        <span className="inline-flex items-center gap-1.5 text-success-ink font-semibold text-[11.5px]">
                          <StatusDot state="healthy" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-warning-ink font-semibold text-[11.5px]">
                          <StatusDot state="degraded" /> Pending Approval
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-muted-foreground">
                      {g.sourceGroup}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-muted-foreground">
                      {g.grantedAt ?? "Pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Request Access Drawer / Modal */}
      {requestModalOpen && (
        <>
          <button
            type="button"
            aria-label="Close modal"
            onClick={() => setRequestModalOpen(false)}
            className="fixed inset-0 z-50 bg-overlay/25 backdrop-blur-xs"
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(520px,94vw)] rounded-[4px] border border-border bg-card shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <Eyebrow>Governed Request</Eyebrow>
                <h2 className="text-[17px] font-bold text-foreground mt-0.5">
                  Request Application Access
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  Submits a tracked access request for {application.code} to the access directory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <IconX size={16} />
              </button>
            </div>

            {requestSubmitted ? (
              <div className="rounded-[4px] bg-success/[0.08] border border-success/30 p-4 text-[13px] flex flex-col gap-2">
                <div className="flex items-center gap-2 text-success-ink font-bold">
                  <IconCheck size={16} /> Access Request #REQ-9815 Submitted!
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Your request has been routed to {application.techLead} for approval. Atlas will
                  track status updates automatically.
                </p>
                <Button
                  size="xs"
                  variant="outline"
                  className="self-start mt-2"
                  onClick={() => {
                    setRequestModalOpen(false);
                    setRequestSubmitted(false);
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setRequestSubmitted(true);
                  setGrants((prev) => [
                    ...prev,
                    {
                      id: `g-${Date.now()}`,
                      who: `${CURRENT_USER} (You)`,
                      role: selectedRole === "deployer" ? "Deployer (DEV)" : "Operator (PROD)",
                      status: "pending",
                      sourceGroup: `example-pay-${selectedRole}`,
                      requestId: "REQ-9815",
                    },
                  ]);
                }}
                className="flex flex-col gap-4 text-[12.5px]"
              >
                <div>
                  <label
                    htmlFor="role-select"
                    className="block text-[11px] font-semibold uppercase font-mono tracking-wider text-muted-foreground mb-1"
                  >
                    Select Requested Role
                  </label>
                  <select
                    id="role-select"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="h-9 w-full rounded-[4px] border border-border bg-surface px-2.5 text-foreground focus:border-brand focus:outline-none"
                  >
                    <option value="deployer">Deployer (DEV / UAT Pipelines)</option>
                    <option value="operator">Operator (PROD Observability & Restart)</option>
                    <option value="owner">Co-Owner (Full IAM & Secrets Delegation)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="business-justification"
                    className="block text-[11px] font-semibold uppercase font-mono tracking-wider text-muted-foreground mb-1"
                  >
                    Business Justification
                  </label>
                  <textarea
                    id="business-justification"
                    rows={3}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    className="w-full rounded-[4px] border border-border bg-surface p-2.5 text-foreground focus:border-brand focus:outline-none"
                    required
                  />
                </div>

                <div className="rounded-[4px] bg-secondary/50 p-2.5 text-[11.5px] text-muted-foreground">
                  ✓ Preflight passed: Identity <Id>{CURRENT_USER}</Id> is verified against Entra ID.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRequestModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Submit Request
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
