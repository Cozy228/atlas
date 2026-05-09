import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowRight, IconExternalLink } from "@tabler/icons-react";
import type { Topic } from "@atlas/schema";

import { fetchTopicDiscovery } from "@/api/server/contextApi";
import { DetailHeader } from "@/components/detail/detail-shell";
import { PageBody } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LoaderData = {
  topics: ReadonlyArray<Topic>;
};

export const Route = createFileRoute("/landing-zones/")({
  loader: async (): Promise<LoaderData> => {
    const response = await fetchTopicDiscovery({
      data: { topic_type: "landing-zone" },
    });
    return { topics: response.topics };
  },
  component: LandingZonesListRoute,
});

function LandingZonesListRoute() {
  const { topics } = Route.useLoaderData();
  const zones = [...topics].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageBody width="comfortable">
      <DetailHeader
        eyebrow="Discovery"
        title="Landing zones"
        description="Compare environments, guardrails, and provisioning entry tools side by side. Select a zone for guardrail evidence and onboarding paths."
        badges={
          <Badge variant="outline" className="font-mono text-[10px]">
            topic_type = landing-zone
          </Badge>
        }
      />

      {zones.length === 0 ? (
        <EmptyState />
      ) : (
        <ul
          className="grid gap-2.5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          }}
        >
          {zones.map((zone) => (
            <li key={zone.id}>
              <ZoneCard zone={zone} />
            </li>
          ))}
        </ul>
      )}
    </PageBody>
  );
}

function ZoneCard({ zone }: { zone: Topic }) {
  return (
    <Link
      to="/landing-zones/$topicId"
      params={{ topicId: zone.id }}
      className={cn(
        "group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-[border-color,box-shadow]",
        "hover:border-border-strong hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[14px] font-bold tracking-[-0.01em] text-foreground">{zone.name}</p>
          <p className="line-clamp-2 text-[12px] leading-5 text-muted-foreground">
            {zone.description}
          </p>
        </div>
        <IconArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3 text-[11px]">
        <DefRow label="Domain" value={zone.category} />
        <DefRow label="Owner" value={zone.owner_team} />
        <DefRow label="Support" value={zone.support_channel} mono />
        <DefRow label="Status" value={zone.status} mono />
      </dl>
      {zone.entry_tools.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
          {zone.entry_tools.slice(0, 3).map((tool) => (
            <a
              key={tool.url}
              href={tool.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5",
                "font-mono text-[10px] font-semibold text-muted-foreground transition-colors",
                "hover:border-primary hover:text-primary",
              )}
            >
              {tool.label}
              <IconExternalLink className="size-2.5" aria-hidden />
            </a>
          ))}
          {zone.entry_tools.length > 3 ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              +{zone.entry_tools.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

function DefRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("truncate text-[11px] text-foreground", mono && "font-mono text-[11px]")}>
        {value}
      </dd>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-6 text-[13px] text-muted-foreground">
      <p className="font-bold text-foreground">No registered landing zones.</p>
      <p className="mt-1 leading-6">
        Add a landing zone to the registry or report the gap from a source detail page.
      </p>
    </div>
  );
}
