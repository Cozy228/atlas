import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconInfoCircle,
  IconLayoutGrid,
  IconRocket,
  IconSearch,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import type { EntryTool, Topic } from "@atlas/schema";

import { cn } from "@/lib/utils";

type Phase = "evaluate" | "decide" | "onboard";

type EntryCardsProps = {
  capabilities: ReadonlyArray<Topic>;
  landingZones: ReadonlyArray<Topic>;
};

export function EntryCards({ capabilities, landingZones }: EntryCardsProps) {
  const [active, setActive] = useState<Phase | null>("evaluate");

  const toggle = (phase: Phase) => () => setActive((current) => (current === phase ? null : phase));
  const close = () => setActive(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <EntryCard
          phase="evaluate"
          active={active === "evaluate"}
          onClick={toggle("evaluate")}
          label="Evaluate"
          description="Which capability should I use?"
          icon={IconSearch}
        />
        <EntryCard
          phase="decide"
          active={active === "decide"}
          onClick={toggle("decide")}
          label="Decide"
          description="Which landing zone fits my workload?"
          icon={IconLayoutGrid}
        />
        <EntryCard
          phase="onboard"
          active={active === "onboard"}
          onClick={toggle("onboard")}
          label="Onboard"
          description="How do I provision and ship?"
          icon={IconRocket}
        />
      </div>

      {active ? (
        <PhasePanel phase={active} onClose={close}>
          {active === "evaluate" ? <EvaluatePanel capabilities={capabilities} /> : null}
          {active === "decide" ? <DecidePanel landingZones={landingZones} /> : null}
          {active === "onboard" ? <OnboardPanel landingZones={landingZones} /> : null}
        </PhasePanel>
      ) : null}
    </div>
  );
}

type EntryCardProps = {
  phase: Phase;
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  icon: typeof IconSearch;
};

function EntryCard({ phase, active, onClick, label, description, icon: Icon }: EntryCardProps) {
  return (
    <button
      type="button"
      data-phase={phase}
      data-active={active ? "true" : undefined}
      aria-pressed={active}
      aria-controls={`phase-panel-${phase}`}
      onClick={onClick}
      className={cn(
        "group relative flex h-full flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-4 text-left transition-[border-color,box-shadow,transform]",
        "hover:border-border-strong hover:shadow-sm",
        "active:scale-[0.99]",
        "data-[active=true]:border-primary data-[active=true]:shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_12%,transparent)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity",
          "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_5%,transparent),transparent_60%)]",
          "group-hover:opacity-100 group-data-[active=true]:opacity-100",
        )}
      />
      <span className="relative z-10 flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-md bg-brand-tint">
          <Icon className="size-3.5 text-primary" />
        </span>
        <span className="text-[14px] font-bold tracking-[-0.01em] text-foreground">{label}</span>
      </span>
      <span className="relative z-10 text-[13px] leading-[1.5] text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

function PhasePanel({
  phase,
  onClose,
  children,
}: {
  phase: Phase;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const heading = PANEL_HEADING[phase];
  return (
    <section
      id={`phase-panel-${phase}`}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        "[animation:slideIn_220ms_cubic-bezier(0.22,1,0.36,1)]",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold tracking-[-0.02em] text-foreground">
            {heading.title}
          </h3>
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
            {heading.description}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground",
            "transition-colors hover:bg-card hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <IconX className="size-3.5" />
        </button>
      </header>
      {children}
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </section>
  );
}

const PANEL_HEADING: Record<Phase, { title: string; description: string }> = {
  evaluate: {
    title: "Which capability should I use?",
    description: "Browse approved services with availability and guardrails across regions.",
  },
  decide: {
    title: "Which landing zone fits my workload?",
    description: "Compare environments, guardrails, and onboarding paths side by side.",
  },
  onboard: {
    title: "How do I start?",
    description: "Entry tools, pipelines, and support channels for your chosen stack.",
  },
};

function EvaluatePanel({ capabilities }: { capabilities: ReadonlyArray<Topic> }) {
  const [query, setQuery] = useState("");
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? capabilities.filter(
          (topic) =>
            topic.name.toLowerCase().includes(q) ||
            topic.category.toLowerCase().includes(q) ||
            topic.description.toLowerCase().includes(q),
        )
      : capabilities;
    const map = new Map<string, Topic[]>();
    for (const topic of filtered) {
      const key = topic.category;
      const list = map.get(key);
      if (list) list.push(topic);
      else map.set(key, [topic]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [capabilities, query]);

  return (
    <div className="flex flex-col gap-0">
      <div className="px-5 pt-3">
        <div className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5">
          <IconSearch className="size-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter capabilities…"
            aria-label="Filter capabilities"
            className="h-full flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 px-2 pb-5 pt-3">
        {grouped.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
            No capability matches “{query}”.
          </p>
        ) : (
          grouped.map(([domain, items]) => (
            <div key={domain}>
              <p className="mb-1 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                {domain}
              </p>
              <ul className="flex flex-col">
                {items.map((topic) => (
                  <li key={topic.id}>
                    <Link
                      to="/capabilities/$topicId"
                      params={{ topicId: topic.id }}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
                        "hover:bg-muted",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background",
                          "font-mono text-[8px] font-bold uppercase text-primary",
                        )}
                      >
                        {topic.name.slice(0, 3)}
                      </span>
                      <span className="flex flex-1 flex-col min-w-0">
                        <span className="text-[13px] font-semibold text-foreground">
                          {topic.name}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {topic.description}
                        </span>
                      </span>
                      <StatusPill status={topic.status} />
                      <IconArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Topic["status"] }) {
  const map = {
    active: {
      label: "Available",
      className: "bg-success/10 text-success",
    },
    planned: {
      label: "Planned",
      className: "bg-info/10 text-info",
    },
    deprecated: {
      label: "Deprecated",
      className: "bg-muted text-muted-foreground",
    },
  } as const;
  const tone = map[status];
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-1.5 py-0.5",
        "font-mono text-[10px] font-semibold",
        tone.className,
      )}
    >
      <span aria-hidden className="size-1 rounded-full bg-current" />
      {tone.label}
    </span>
  );
}

function DecidePanel({ landingZones }: { landingZones: ReadonlyArray<Topic> }) {
  if (landingZones.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
        No landing zones registered.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-5">
      {landingZones.map((zone) => (
        <Link
          key={zone.id}
          to="/landing-zones/$topicId"
          params={{ topicId: zone.id }}
          className={cn(
            "grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-border bg-background px-4 py-3.5 transition-[border-color,box-shadow]",
            "hover:border-border-strong hover:shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <div>
            <p className="text-[14px] font-bold tracking-[-0.01em] text-foreground">{zone.name}</p>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{zone.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <ZoneTag>{zone.category}</ZoneTag>
              <ZoneTag>{zone.owner_team}</ZoneTag>
              {zone.status !== "active" ? <ZoneTag>{zone.status}</ZoneTag> : null}
            </div>
          </div>
          <div className="flex flex-col items-end justify-center gap-1">
            <span className="font-mono text-[10px] text-muted-foreground">
              {zone.entry_tools.length} entry tools
            </span>
            <IconArrowRight className="size-4 text-muted-foreground" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function ZoneTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded border border-border bg-card px-1.5 py-0.5",
        "font-mono text-[10px] font-medium text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function OnboardPanel({ landingZones }: { landingZones: ReadonlyArray<Topic> }) {
  const tools: ReadonlyArray<EntryTool> = useMemo(() => {
    const seen = new Map<string, EntryTool>();
    for (const zone of landingZones) {
      for (const tool of zone.entry_tools) {
        if (!seen.has(tool.url)) seen.set(tool.url, tool);
      }
    }
    return [...seen.values()].slice(0, 4);
  }, [landingZones]);

  const owner = landingZones[0];

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tools.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No entry tools registered yet.</p>
        ) : (
          tools.map((tool) => (
            <a
              key={tool.url}
              href={tool.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex flex-col gap-2 rounded-lg border border-border bg-background px-4 py-3.5 transition-[border-color,box-shadow]",
                "hover:border-primary hover:shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <p className="text-[13px] font-bold text-foreground">{tool.label}</p>
              <p className="text-[12px] leading-5 text-muted-foreground">{safeHost(tool.url)}</p>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                Open <IconArrowRight className="size-3.5" />
              </span>
            </a>
          ))
        )}
      </div>
      {owner ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3.5 py-2.5">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full bg-brand-tint",
              "font-mono text-[11px] font-bold text-primary",
            )}
            aria-hidden
          >
            <IconUsers className="size-3.5" />
          </span>
          <span className="flex flex-col">
            <span className="text-[12px] font-bold text-foreground">{owner.owner_team}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {owner.support_channel}
            </span>
          </span>
        </div>
      ) : null}
      <p className="font-mono text-[10px] text-muted-foreground">
        <IconInfoCircle className="mr-1 inline size-3 align-text-bottom" />
        Tools are registered per landing zone. Owners shown reflect the first registered zone.
      </p>
    </div>
  );
}
