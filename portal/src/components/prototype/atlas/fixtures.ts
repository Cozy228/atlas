/**
 * Prototype `atlas` — fixture layer
 * =================================
 * Implements docs/app-centric-experience-architecture.md on top of the shared
 * fictional record set from the `opus` exploration (`components/prototype/opus/fixtures`).
 * Nothing here contacts a real system; every person, team and record is invented.
 *
 * This module derives the view-models the new IA needs that the shared model
 * does not carry: an honest health verdict for the Workbench Overview, the
 * recent-activity timeline, and the About drawer connections.
 */
import {
  APPLICATIONS,
  DEFAULT_APPLICATION_ID,
  attentionItems,
  journeySummary,
  resolveApplication,
} from "@/components/prototype/opus/fixtures";
import type { Application, AttentionItem, Run } from "@/components/prototype/opus/fixtures/types";
import type { JourneySummary } from "@/components/prototype/opus/fixtures/derive";
import { FIXTURE_NOW, ago, elapsed } from "@/components/prototype/opus/fixtures/clock";

export {
  APPLICATIONS,
  DEFAULT_APPLICATION_ID,
  FIXTURE_NOW,
  ago,
  attentionItems,
  elapsed,
  journeySummary,
  resolveApplication,
};
export type { Application, AttentionItem, JourneySummary, Run };

/** The signed-in persona of this prototype (fictional). */
export const CURRENT_USER = "Demo User";

/* ------------------------------------------------------------------ */
/* Health verdict — Workbench Overview section A                       */
/* ------------------------------------------------------------------ */

export type VerdictTone = "healthy" | "attention" | "critical";

export type Metric = {
  id: string;
  label: string;
  value: string;
  /** Why a value is missing, shown verbatim instead of a fake number. */
  note?: string;
};

export type EnvironmentHealth = {
  environment: string;
  state: "healthy" | "degraded" | "unknown";
};

export type AppVerdict = {
  tone: VerdictTone;
  headline: string;
  notice: string;
  metrics: ReadonlyArray<Metric>;
  environments: ReadonlyArray<EnvironmentHealth>;
};

const NO_TRAFFIC_NOTE = "No live traffic until the first successful deployment.";

/**
 * Derives the Overview verdict from fixture state only — no invented uptime.
 * An onboarding application has not served traffic, so its runtime metrics are
 * reported as unknown rather than dressed up as numbers (governed honesty).
 */
export function deriveVerdict(app: Application): AppVerdict {
  if (app.lifecycle === "operating") {
    return {
      tone: "healthy",
      headline: "Operating normally",
      notice: "No open incidents. Latest scheduled runs succeeded.",
      metrics: [
        { id: "error-rate", label: "Error rate", value: "0.12%" },
        { id: "p95", label: "p95 duration", value: "212 ms" },
        { id: "uptime", label: "Uptime · 7d", value: "99.98%" },
      ],
      environments: app.environments.map((environment) => ({ environment, state: "healthy" })),
    };
  }

  const summary = journeySummary(app);
  const blocking = summary.blockingStep;
  const failedRun = app.runs.find((run) => run.result === "failed");

  if (blocking?.state === "failed") {
    return {
      tone: "critical",
      headline: "Attention needed — first DEV deployment failed",
      notice: `${failedRun?.id ?? "The last run"} failed before the service went live. Atlas has a ranked diagnosis.`,
      metrics: [
        { id: "error-rate", label: "Error rate", value: "—", note: NO_TRAFFIC_NOTE },
        { id: "p95", label: "p95 duration", value: "—", note: NO_TRAFFIC_NOTE },
        { id: "uptime", label: "Uptime · 7d", value: "—", note: NO_TRAFFIC_NOTE },
      ],
      environments: app.environments.map((environment) => ({ environment, state: "unknown" })),
    };
  }

  return {
    tone: "attention",
    headline: "Onboarding in progress",
    notice: blocking ? `Waiting on “${blocking.title}”.` : "Journey steps are still outstanding.",
    metrics: [
      { id: "error-rate", label: "Error rate", value: "—", note: NO_TRAFFIC_NOTE },
      { id: "p95", label: "p95 duration", value: "—", note: NO_TRAFFIC_NOTE },
      { id: "uptime", label: "Uptime · 7d", value: "—", note: NO_TRAFFIC_NOTE },
    ],
    environments: app.environments.map((environment) => ({ environment, state: "unknown" })),
  };
}

/** One health dot for the sidebar and switcher, from the same verdict source. */
export function healthDot(app: Application): EnvironmentHealth["state"] {
  return deriveVerdict(app).environments[0]?.state ?? "unknown";
}

/* ------------------------------------------------------------------ */
/* Recent activity — Workbench Overview section C                      */
/* ------------------------------------------------------------------ */

export type ActivityEntry =
  | {
      kind: "run";
      id: string;
      at: string;
      run: Run;
    }
  | {
      kind: "advisory";
      id: string;
      at: string;
      label: string;
      summary: string;
      severity: "notice" | "attention";
    };

/** Runs and platform advisories interleaved, newest first. */
export function recentActivity(app: Application): ReadonlyArray<ActivityEntry> {
  const entries: ActivityEntry[] = [];

  for (const run of app.runs) {
    entries.push({ kind: "run", id: `act-${run.id}`, at: run.startedAt, run });
  }
  for (const advisory of app.advisories) {
    entries.push({
      kind: "advisory",
      id: `act-${advisory.id}`,
      at: advisory.at,
      label: advisory.label,
      summary: advisory.summary,
      severity: advisory.severity,
    });
  }

  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/* ------------------------------------------------------------------ */
/* About drawer — Workbench Overview section D                         */
/* ------------------------------------------------------------------ */

export type Connection = {
  label: string;
  value: string;
  /** Source-system letter mark, e.g. SCM / IAC / DEL. */
  mark: string;
  systemName: string;
};

const CONNECTION_LABELS: ReadonlyArray<{ factLabel: string; systemName: string }> = [
  { factLabel: "Repository", systemName: "Source control" },
  { factLabel: "Account", systemName: "Cloud runtime" },
  { factLabel: "Workspace", systemName: "Infrastructure automation" },
  { factLabel: "Pipeline", systemName: "Delivery pipelines" },
];

/** Resolved external connections for the About drawer, in stable order. */
export function connections(app: Application): ReadonlyArray<Connection> {
  const found: Connection[] = [];
  for (const wanted of CONNECTION_LABELS) {
    const fact = app.context.find((candidate) => candidate.label === wanted.factLabel);
    if (!fact) continue;
    found.push({
      label: wanted.factLabel,
      value: fact.value,
      mark: systemMark(fact.systemId ?? ""),
      systemName: wanted.systemName,
    });
  }
  return found;
}

function systemMark(systemId: string): string {
  const marks: Record<string, string> = {
    scm: "SCM",
    iac: "IAC",
    cloud: "CLD",
    delivery: "DEL",
    registry: "REG",
    access: "IAM",
    itsm: "ITSM",
    secrets: "SEC",
    artifacts: "ART",
    atlas: "ATL",
  };
  return marks[systemId] ?? systemId.slice(0, 3).toUpperCase();
}
