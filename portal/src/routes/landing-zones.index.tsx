import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";
import type { Topic } from "@atlas/schema";

import { topicDiscoveryQueryOptionsFor } from "@/api/queries";
import { PageBody } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LoaderData = {
  topics: ReadonlyArray<Topic>;
};

export const Route = createFileRoute("/landing-zones/")({
  loader: async ({ context }): Promise<LoaderData> => {
    const response = await context.queryClient.ensureQueryData(
      topicDiscoveryQueryOptionsFor({ topic_type: "landing-zone" }),
    );
    return { topics: response.topics };
  },
  component: LandingZonesListRoute,
});

function LandingZonesListRoute() {
  const { topics } = Route.useLoaderData();
  const zones = topics.toSorted((a, b) => a.name.localeCompare(b.name));

  return (
    <PageBody width="comfortable">
      <div className="flex flex-col gap-2 pt-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Discovery
        </span>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="type-display font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:type-display-lg">
            Landing zones
          </h1>
          <Badge variant="outline" className="font-mono type-caption">
            topic_type = landing-zone
          </Badge>
        </div>
        <p className="max-w-[56ch] type-body leading-[1.6] text-muted-foreground">
          Compare environments, guardrails, and provisioning entry tools side by side. Select a zone
          for guardrail evidence and onboarding paths.
        </p>
      </div>

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
        "group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow]",
        "hover:border-border-strong hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="inline-flex items-center gap-1 type-body font-bold tracking-[-0.01em] text-foreground">
            {zone.name}
            <IconArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </p>
          <p className="line-clamp-2 type-detail leading-5 text-muted-foreground">
            {zone.description}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs">
        <DefRow label="Domain" value={zone.category} />
        <DefRow label="Owner" value={zone.owner_team} />
        <DefRow label="Support" value={zone.support_channel} mono />
        <DefRow label="Status" value={zone.status} mono />
      </dl>
      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate font-semibold text-foreground">{zone.owner_team}</span>
        <span className="font-mono">{zone.support_channel}</span>
      </div>
    </Link>
  );
}

function DefRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("truncate text-xs text-foreground", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-6 type-detail text-muted-foreground">
      <p className="font-bold text-foreground">No registered landing zones.</p>
      <p className="mt-1 leading-6">
        Add a landing zone to the registry or report the gap from a source detail page.
      </p>
    </div>
  );
}
