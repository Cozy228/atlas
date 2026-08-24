import { IconHistory, IconShieldCheck } from "@tabler/icons-react";

import type { Application } from "./fixtures";
import { Eyebrow, Id, Panel } from "./ui";
import { DiagnosisView } from "./diagnosis-view";

export function DiagnosticsArchiveView({ application }: { application: Application }) {
  const diagnoses = application.diagnoses;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 bg-background pr-1">
        <div>
          <Eyebrow>Workbench · Root Cause Analysis</Eyebrow>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
            Diagnostics Archive
          </h1>
          <p className="mt-1 max-w-[65ch] text-[13px] leading-relaxed text-muted-foreground">
            Correlated failure diagnoses, symptom history, and recovery actions for{" "}
            {application.name}.
          </p>
        </div>
      </header>

      {diagnoses.length === 0 ? (
        <Panel title="Diagnostics History" note="No active or past diagnoses recorded.">
          <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
            <span className="grid size-10 place-items-center rounded-full bg-success/15 text-success-ink">
              <IconShieldCheck size={22} />
            </span>
            <h3 className="font-bold text-[15px] text-foreground">
              All Systems Operating Normally
            </h3>
            <p className="text-[12.5px] text-muted-foreground max-w-[45ch]">
              Atlas has not detected any failed pipeline runs or configuration anomalies requiring
              diagnosis.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-6">
          {diagnoses.map((d) => (
            <div key={d.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <IconHistory size={14} />
                <span>
                  Diagnosis Record: <Id>{d.id}</Id>
                </span>
                <span>
                  • Generated for Run <Id>{d.runId}</Id>
                </span>
              </div>
              <DiagnosisView diagnosis={d} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
