import {
  IconArrowUpRight,
  IconCalendarClock,
  IconCircleCheck,
  IconMapPin,
} from "@tabler/icons-react";

import type { Location } from "@/api/server/availability";
import { cn } from "@/lib/utils";
import { regionLabel, type RegionHealth } from "./region-map";

export type RegionStats = {
  available: number;
  planned: number;
  interim: number;
  total: number;
};

export type RegionMaintenance = { window: string; detail: string };

const HEALTH_LABEL: Record<RegionHealth, string> = {
  operational: "Operational",
  maintenance: "Maintenance",
  degraded: "Degraded",
  expanding: "Expanding",
};

type RegionDetailProps = {
  region: Location;
  health: RegionHealth;
  stats: RegionStats;
  maintenance?: RegionMaintenance | null;
  className?: string;
};

export function RegionDetail({ region, health, stats, maintenance, className }: RegionDetailProps) {
  const profile = regionProfile(region.id);
  const share = stats.total > 0 ? Math.round((stats.available / stats.total) * 100) : 0;

  return (
    <aside
      className={cn("flex flex-col gap-4 rounded-xl border border-border bg-card p-5", className)}
    >
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Selected region
        </span>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-ink"
          >
            <IconMapPin className="size-5" stroke={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
              {regionLabel(region)}
            </h3>
            <p className="font-mono text-xs text-muted-foreground">{region.id}</p>
          </div>
          {/* Status beside the title, with uptime as a quiet second line below it. */}
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
              <span aria-hidden className={cn("size-2 rounded-full", HEALTH_DOT[health])} />
              {HEALTH_LABEL[health]}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {profile.uptime}% uptime
            </span>
          </div>
        </div>
      </header>

      <section className="border-t border-border pt-3.5">
        <h4 className="text-[13px] font-bold tracking-[-0.01em] text-foreground">Region details</h4>
        <dl className="mt-3 flex flex-col gap-2">
          <InfoRow label="Location" value={region.sub} />
          <InfoRow
            label="Type"
            value={region.kind === "outpost" ? "Outpost" : "Commercial region"}
          />
          <InfoRow label="Availability zones" value={String(profile.zones)} />
          <InfoRow label="Launched" value={profile.launched} />
        </dl>
      </section>

      <section className="border-t border-border pt-3.5">
        <div className="flex items-baseline justify-between">
          <h4 className="text-[13px] font-bold tracking-[-0.01em] text-foreground">
            Available services
          </h4>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {stats.available} of {stats.total}
          </span>
        </div>
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={share}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Service coverage"
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
        </div>
      </section>

      <section className="border-t border-border pt-3.5">
        <h4 className="text-[13px] font-bold tracking-[-0.01em] text-foreground">
          Scheduled maintenance
        </h4>
        {maintenance ? (
          <div className="mt-2.5 flex gap-2.5 rounded-lg border border-warning/30 bg-warning/8 p-2.5">
            <IconCalendarClock
              className="mt-px size-4 shrink-0 text-warning-ink"
              stroke={1.75}
              aria-hidden
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-foreground">
                {maintenance.window}
              </span>
              <span className="text-xs leading-[1.45] text-muted-foreground">
                {maintenance.detail}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2">
            <IconCircleCheck
              className="size-4 shrink-0 text-success-ink"
              stroke={1.75}
              aria-hidden
            />
            <span className="text-[13px] text-muted-foreground">No scheduled maintenance</span>
          </div>
        )}
      </section>

      <section className="border-t border-border pt-3.5">
        <h4 className="text-[13px] font-bold tracking-[-0.01em] text-foreground">Helpful links</h4>
        <ul className="mt-2 flex flex-col gap-1.5">
          <HelpfulLink title="Region guide" />
          <HelpfulLink title="Data residency" />
        </ul>
      </section>
    </aside>
  );
}

/** Placeholder destination — the row is wired to a real guide later. */
function HelpfulLink({ title }: { title: string }) {
  return (
    <li>
      <button
        type="button"
        className={cn(
          "group inline-flex items-center gap-1 text-[13px] font-medium text-primary transition-colors",
          "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {title}
        <IconArrowUpRight
          aria-hidden
          className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </button>
    </li>
  );
}

const HEALTH_DOT: Record<RegionHealth, string> = {
  operational: "bg-success",
  maintenance: "bg-warning",
  degraded: "bg-critical",
  expanding: "bg-brand",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Deterministic, fictional region profile (zones / launch / uptime) from the id. */
function regionProfile(id: string): { zones: number; launched: string; uptime: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const years = ["2016", "2017", "2019", "2020", "2022", "2024"];
  const months = ["Mar", "Jun", "Sep", "Nov"];
  return {
    zones: 3 + (h % 4),
    launched: `${months[h % months.length]} ${years[h % years.length]}`,
    uptime: (99.9 + (h % 9) / 100).toFixed(2),
  };
}
