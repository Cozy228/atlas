import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowRight, IconUsers } from "@tabler/icons-react";
import type { Topic } from "@atlas/schema";

import { fetchTopicDiscovery } from "@/api/server/contextApi";
import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";
import { cn } from "@/lib/utils";

type LoaderData = {
  topics: ReadonlyArray<Topic>;
};

export const Route = createFileRoute("/capabilities/")({
  loader: async (): Promise<LoaderData> => {
    const response = await fetchTopicDiscovery({
      data: { topic_type: "capability" },
    });
    return { topics: response.topics };
  },
  component: CapabilitiesListRoute,
});

function CapabilitiesListRoute() {
  const { topics } = Route.useLoaderData();
  const capabilities = [...topics].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageBody>
      <PageHeader
        eyebrow="Discovery"
        title="Capabilities"
        description="Approved cloud platform capabilities. Rows are dense by design so authority, owner, and entry tools stay scannable side-by-side."
        actions={<Badge variant="brand">topic_type = capability</Badge>}
      />
      <PageSection title="Comparison list">
        {capabilities.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="overflow-hidden rounded-md border border-border bg-card">
            {capabilities.map((topic, index) => (
              <li
                key={topic.id}
                className={cn("border-border", index > 0 && "border-t")}
              >
                <CapabilityRow topic={topic} />
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </PageBody>
  );
}

function CapabilityRow({ topic }: { topic: Topic }) {
  return (
    <Link
      to="/capabilities/$topicId"
      params={{ topicId: topic.id }}
      className={cn(
        "group grid grid-cols-1 gap-3 px-4 py-3 transition-colors lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]",
        "hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {topic.name}
          {topic.status !== "active" ? (
            <Badge variant={topic.status === "deprecated" ? "critical" : "warning"}>
              {topic.status}
            </Badge>
          ) : null}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          {topic.description}
        </p>
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="text-[11px] uppercase tracking-[0.12em]">Category</span>
        <span className="text-foreground">{topic.category}</span>
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em]">
          <IconUsers className="size-3" aria-hidden /> Owner
        </span>
        <span className="text-foreground">{topic.owner_team}</span>
        <span className="font-mono text-[11px]">{topic.support_channel}</span>
      </div>
      <div className="flex items-center justify-end gap-2 self-end text-xs text-muted-foreground lg:self-center">
        {topic.entry_tools.slice(0, 1).map((tool) => (
          <span key={tool.url} className="hidden text-foreground sm:inline">
            {tool.label}
          </span>
        ))}
        <IconArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">No registered capabilities.</p>
      <p className="mt-1 leading-6">
        Either the registry is empty or the discovery filter excluded every
        topic. Submit feedback if a capability is missing.
      </p>
    </div>
  );
}
