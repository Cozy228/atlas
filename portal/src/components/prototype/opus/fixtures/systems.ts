/**
 * Prototype `opus` — source systems
 * =================================
 * Generic platform roles rather than vendor products. Atlas reads from these and
 * delegates execution to them; it never owns their domain truth.
 */
import type { SourceSystem } from "./types";

export const SYSTEMS: ReadonlyArray<SourceSystem> = [
  {
    id: "atlas",
    label: "Atlas",
    kind: "atlas",
    stewardTeam: "Developer Experience",
    recordSpace: "journey / evidence store",
  },
  {
    id: "app-registry",
    label: "Application Registry",
    kind: "registry",
    stewardTeam: "Architecture Office",
    recordSpace: "application records",
  },
  {
    id: "access-governance",
    label: "Access Governance",
    kind: "access",
    stewardTeam: "Security Operations",
    recordSpace: "access requests / entitlements",
  },
  {
    id: "change-management",
    label: "Change Management",
    kind: "itsm",
    stewardTeam: "Service Management",
    recordSpace: "change records / requests",
  },
  {
    id: "infra-automation",
    label: "Infrastructure Automation",
    kind: "iac",
    stewardTeam: "Cloud Foundation",
    recordSpace: "workspaces / applies",
  },
  {
    id: "delivery-pipelines",
    label: "Delivery Pipelines",
    kind: "delivery",
    stewardTeam: "Delivery Engineering",
    recordSpace: "projects / pipelines / runs",
  },
  {
    id: "secret-platform",
    label: "Secret Platform",
    kind: "secrets",
    stewardTeam: "Security Engineering",
    recordSpace: "scopes / secret references",
  },
  {
    id: "artifact-registry",
    label: "Artifact Registry",
    kind: "artifacts",
    stewardTeam: "Delivery Engineering",
    recordSpace: "images / digests",
  },
  {
    id: "cloud-runtime",
    label: "Cloud Runtime",
    kind: "cloud",
    stewardTeam: "Cloud Foundation",
    recordSpace: "accounts / services / roles",
  },
  {
    id: "source-control",
    label: "Source Control",
    kind: "scm",
    stewardTeam: "Delivery Engineering",
    recordSpace: "repositories / branches",
  },
];

const SYSTEM_BY_ID = new Map(SYSTEMS.map((system) => [system.id, system]));

export function getSystem(id: string | undefined): SourceSystem | undefined {
  return id === undefined ? undefined : SYSTEM_BY_ID.get(id);
}

/** Display label for a system id; falls back to the raw id so gaps are visible. */
export function systemLabel(id: string | undefined): string {
  if (id === undefined) return "unknown system";
  return SYSTEM_BY_ID.get(id)?.label ?? id;
}
