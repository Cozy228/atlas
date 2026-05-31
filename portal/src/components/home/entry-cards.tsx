import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconArrowsExchange,
  IconRocket,
  IconSearch,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import type { Topic } from "@atlas/schema";

import { cn } from "@/lib/utils";

type Phase = "find-service" | "migrate" | "new-app";

type EntryCardsProps = {
  capabilities: ReadonlyArray<Topic>;
  landingZones: ReadonlyArray<Topic>;
};

export function EntryCards({ capabilities, landingZones }: EntryCardsProps) {
  const [active, setActive] = useState<Phase | null>(null);

  const toggle = (phase: Phase) => () => setActive((current) => (current === phase ? null : phase));
  const close = () => setActive(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <EntryCard
          phase="find-service"
          active={active === "find-service"}
          onClick={toggle("find-service")}
          label="Find the right service"
          description="Which approved service fits your use case?"
          icon={IconSearch}
        />
        <EntryCard
          phase="migrate"
          active={active === "migrate"}
          onClick={toggle("migrate")}
          label="Migrate existing app"
          description="Target environments and platform team contacts for your migration."
          icon={IconArrowsExchange}
        />
        <EntryCard
          phase="new-app"
          active={active === "new-app"}
          onClick={toggle("new-app")}
          label="Onboard a new app"
          description="Landing zones, provisioning tools, and support contacts."
          icon={IconRocket}
        />
      </div>

      {active ? (
        <PhasePanel phase={active} onClose={close}>
          {active === "find-service" ? <FindServicePanel capabilities={capabilities} /> : null}
          {active === "migrate" ? <MigratePanel landingZones={landingZones} /> : null}
          {active === "new-app" ? <OnboardingPanel landingZones={landingZones} /> : null}
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
  icon: Icon;
};

function EntryCard({ phase, active, onClick, label, description, icon: CardIcon }: EntryCardProps) {
  return (
    <button
      type="button"
      data-phase={phase}
      data-active={active ? "true" : undefined}
      aria-pressed={active}
      aria-controls={`phase-panel-${phase}`}
      onClick={onClick}
      className={cn(
        "group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-6 text-left",
        "transition-[border-color,background-color] duration-150",
        "hover:border-border-strong hover:bg-muted",
        "data-[active=true]:border-primary data-[active=true]:bg-brand-tint",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <CardIcon
        aria-hidden
        className={cn(
          "size-6 text-muted-foreground transition-colors",
          "group-data-[active=true]:text-primary",
        )}
      />
      <span className="flex flex-col gap-1">
        <span
          className={cn(
            "type-body font-bold leading-[1.3] tracking-[-0.01em] text-foreground",
            "group-data-[active=true]:text-primary",
          )}
        >
          {label}
        </span>
        <span className="text-sm leading-normal text-muted-foreground">{description}</span>
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
        "[animation:slideIn_220ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="type-body font-semibold tracking-[-0.02em] text-foreground">
            {heading.title}
          </h3>
          <p className="mt-0.5 type-detail leading-5 text-muted-foreground">
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
  "find-service": {
    title: "Which service should I use?",
    description: "Browse approved capabilities by domain or use case.",
  },
  migrate: {
    title: "Migrate an existing app",
    description: "Find the right target environment and connect with the platform migration team.",
  },
  "new-app": {
    title: "Onboard a new app",
    description: "Choose a landing zone, access provisioning tools, and find your support contacts.",
  },
};

function FindServicePanel({ capabilities }: { capabilities: ReadonlyArray<Topic> }) {
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
    return [...map.entries()].toSorted(([a], [b]) => a.localeCompare(b));
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
            className="h-full flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 px-2 pb-5 pt-3">
        {grouped.length === 0 ? (
          <p className="px-3 py-6 text-center type-detail text-muted-foreground">
            No capability matches “{query}”.
          </p>
        ) : (
          grouped.map(([domain, items]) => (
            <div key={domain}>
              <p className="mb-1 px-3 font-mono type-caption font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                {domain}
              </p>
              <ul className="flex flex-col">
                {items.map((topic) => (
                  <li key={topic.id}>
                    <Link
                      to="/catalog/$topicId"
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
                          "font-mono text-sm font-bold text-primary",
                        )}
                      >
                        {topic.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex flex-1 flex-col min-w-0">
                        <span className="type-detail font-semibold text-foreground">
                          {topic.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
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
        "font-mono type-caption font-semibold",
        tone.className,
      )}
    >
      <span aria-hidden className="size-1 rounded-full bg-current" />
      {tone.label}
    </span>
  );
}

function OnboardingPanel({ landingZones }: { landingZones: ReadonlyArray<Topic> }) {
  if (landingZones.length === 0) {
    return (
      <p className="px-5 py-8 text-center type-detail text-muted-foreground">
        No landing zones registered.
      </p>
    );
  }
  return (
    <div className="divide-y divide-border">
      {landingZones.map((zone) => (
        <div key={zone.id} className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to="/catalog/$topicId"
                params={{ topicId: zone.id }}
                className={cn(
                  "inline-flex items-center gap-1 text-sm font-bold tracking-[-0.01em] text-foreground",
                  "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
                )}
              >
                {zone.name}
                <IconArrowRight className="size-3.5 opacity-50" />
              </Link>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {zone.description}
              </p>
            </div>
            <ZoneTag>{zone.category}</ZoneTag>
          </div>

          {zone.entry_tools.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {zone.entry_tools.map((tool) => (
                <a
                  key={tool.url}
                  href={tool.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 transition-[border-color,color]",
                    "text-xs font-semibold text-foreground",
                    "hover:border-primary hover:text-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  {tool.label}
                  <IconArrowRight className="size-3 opacity-60" />
                </a>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <IconUsers className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-xs font-semibold text-foreground">{zone.owner_team}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {zone.support_channel}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MigratePanel({ landingZones }: { landingZones: ReadonlyArray<Topic> }) {
  if (landingZones.length === 0) {
    return (
      <p className="px-5 py-8 text-center type-detail text-muted-foreground">
        No landing zones registered.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-5">
      {landingZones.map((zone) => (
        <div
          key={zone.id}
          className="flex flex-col gap-3 rounded-lg border border-border bg-background px-4 py-3.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to="/catalog/$topicId"
                params={{ topicId: zone.id }}
                className={cn(
                  "inline-flex items-center gap-1 text-sm font-bold tracking-[-0.01em] text-foreground",
                  "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
                )}
              >
                {zone.name}
                <IconArrowRight className="size-3.5 opacity-50" />
              </Link>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {zone.description}
              </p>
            </div>
            <ZoneTag>{zone.category}</ZoneTag>
          </div>

          <div className="flex items-center gap-2.5 rounded-md bg-brand-tint/50 px-3 py-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-tint"
              aria-hidden
            >
              <IconUsers className="size-3 text-primary" />
            </span>
            <div className="min-w-0">
              <span className="text-xs font-bold text-foreground">{zone.owner_team}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {zone.support_channel}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ZoneTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded border border-border bg-card px-1.5 py-0.5",
        "font-mono type-caption font-medium text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
