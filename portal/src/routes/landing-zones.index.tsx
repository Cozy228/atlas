import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowRight, IconExternalLink } from "@tabler/icons-react";
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
  const zones = [...topics].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageBody width="comfortable">
      <div className="flex flex-col gap-2 pt-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Discovery
        </span>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[40px]">
            Landing zones
          </h1>
          <Badge variant="outline" className="font-mono text-[10px]">
            topic_type = landing-zone
          </Badge>
        </div>
        <p className="max-w-[56ch] text-[15px] leading-[1.6] text-muted-foreground">
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
    <article
      className={cn(
        "group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow]",
        "hover:border-border-strong hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            to="/landing-zones/$topicId"
            params={{ topicId: zone.id }}
            className={cn(
              "inline-flex items-center gap-1 text-[15px] font-bold tracking-[-0.01em] text-foreground",
              "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            {zone.name}
            <IconArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>
          <p className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">
            {zone.description}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3 text-[12px]">
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
              className={cn(
                "inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5",
                "font-mono text-[11px] font-semibold text-muted-foreground transition-colors",
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
    </article>
  );
}

function DefRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("truncate text-[12px] text-foreground", mono && "font-mono text-[12px]")}>
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
