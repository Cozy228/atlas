import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowRight, IconSearch } from "@tabler/icons-react";
import type { Topic } from "@atlas/schema";

import {
  fetchAvailability,
  type AvailabilityResponse,
} from "@/api/server/availability";
import { fetchTopicDiscovery } from "@/api/server/contextApi";
import { DetailHeader } from "@/components/detail/detail-shell";
import { StatusChip } from "@/components/explore/status-chip";
import { PageBody } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LoaderData = {
  topics: ReadonlyArray<Topic>;
  availability: AvailabilityResponse;
};

export const Route = createFileRoute("/capabilities/")({
  loader: async (): Promise<LoaderData> => {
    const [topicsResp, availability] = await Promise.all([
      fetchTopicDiscovery({ data: { topic_type: "capability" } }),
      fetchAvailability(),
    ]);
    return { topics: topicsResp.topics, availability };
  },
  component: CapabilitiesListRoute,
});

function CapabilitiesListRoute() {
  const { topics, availability } = Route.useLoaderData();
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? topics.filter(
          (topic) =>
            topic.name.toLowerCase().includes(q) ||
            topic.description.toLowerCase().includes(q) ||
            topic.category.toLowerCase().includes(q),
        )
      : topics;
    const map = new Map<string, Topic[]>();
    for (const topic of filtered) {
      const list = map.get(topic.category);
      if (list) list.push(topic);
      else map.set(topic.category, [topic]);
    }
    return [...map.entries()]
      .map(([key, items]) => [key, [...items].sort((a, b) => a.name.localeCompare(b.name))] as const)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [topics, query]);

  return (
    <PageBody width="comfortable">
      <DetailHeader
        eyebrow="Discovery"
        title="Capabilities"
        description="Approved cloud platform capabilities. Authority, owner, and entry tools stay scannable side by side."
        badges={
          <Badge variant="outline" className="font-mono text-[10px]">
            topic_type = capability
          </Badge>
        }
      />

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Filter capabilities… name, description, domain"
      />

      {grouped.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([category, items]) => (
            <section key={category} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                  {category}
                </h2>
                <span
                  className={cn(
                    "rounded-full bg-border px-1.5 py-px",
                    "font-mono text-[10px] font-bold text-muted-foreground",
                  )}
                >
                  {items.length}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                }}
              >
                {items.map((topic) => (
                  <CapabilityCard
                    key={topic.id}
                    topic={topic}
                    availability={availability}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageBody>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label
      className={cn(
        "flex h-9 w-full max-w-[420px] items-center gap-2 rounded-md border border-border bg-card px-2.5 transition-[border-color,box-shadow]",
        "focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_8%,transparent)]",
      )}
    >
      <IconSearch className="size-3.5 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function CapabilityCard({
  topic,
  availability,
}: {
  topic: Topic;
  availability: AvailabilityResponse;
}) {
  const service = availability.services.find((entry) => entry.id === topic.id);
  const activeLocations = service
    ? availability.locations.filter(
        (location) =>
          service.availability[location.id] &&
          service.availability[location.id]?.status !== "not-planned",
      )
    : [];
  const visibleChips = activeLocations.slice(0, 2);
  const overflow = activeLocations.length - visibleChips.length;

  return (
    <Link
      to="/capabilities/$topicId"
      params={{ topicId: topic.id }}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-[border-color,box-shadow]",
        "hover:border-border-strong hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[14px] font-bold tracking-[-0.01em] text-foreground">
            {topic.name}
          </p>
          <p className="line-clamp-2 text-[12px] leading-5 text-muted-foreground">
            {topic.description}
          </p>
        </div>
        <IconArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleChips.map((location) => {
          const cell = service!.availability[location.id]!;
          return (
            <StatusChip
              key={location.id}
              status={cell.status}
              text={
                cell.status === "planned" && cell.note
                  ? `${location.label} ${cell.note}`
                  : location.label
              }
            />
          );
        })}
        {overflow > 0 ? (
          <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            +{overflow}
          </span>
        ) : null}
        {activeLocations.length === 0 ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            no availability projection
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate font-semibold text-foreground">
          {topic.owner_team}
        </span>
        <span className="font-mono">{topic.support_channel}</span>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-6 text-[13px] text-muted-foreground">
      <p className="font-bold text-foreground">No registered capabilities.</p>
      <p className="mt-1 leading-6">
        Either the registry is empty or your filter excluded every topic.
      </p>
    </div>
  );
}
