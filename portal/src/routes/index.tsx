import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { Topic, TopicDiscoveryResponse } from "@atlas/schema";

import { availabilityQueryOptions, topicDiscoveryQueryOptions } from "@/api/queries";
import { cn } from "@/lib/utils";
import { EntryCards } from "@/components/home/entry-cards";
import { JourneyGrid } from "@/components/home/journey-grid";
import { PlatformUpdates } from "@/components/home/platform-updates";
import { RecentlyViewed } from "@/components/home/recently-viewed";
import { ResourceLinkGrid } from "@/components/home/resource-link-grid";
import { IntentSearch } from "@/components/intent-search";
import { PageBody } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";

type HomeLoaderData = {
  capabilities: ReadonlyArray<Topic>;
  landingZones: ReadonlyArray<Topic>;
  /** Total regions + outposts across all landing zones (for the hero meta chip). */
  regionCount: number;
};

export const Route = createFileRoute("/")({
  loader: async ({ context }): Promise<HomeLoaderData> => {
    const [topicsResp, availability] = await Promise.all([
      context.queryClient.ensureQueryData(topicDiscoveryQueryOptions) as Promise<TopicDiscoveryResponse>,
      context.queryClient.ensureQueryData(availabilityQueryOptions),
    ]);

    return {
      capabilities: topicsResp.topics.filter((topic) => topic.topic_type === "capability"),
      landingZones: topicsResp.topics.filter((topic) => topic.topic_type === "landing-zone"),
      regionCount: availability.zones.reduce((sum, zone) => sum + zone.locations.length, 0),
    };
  },
  component: HomeRoute,
});

function HomeRoute() {
  const { capabilities, landingZones, regionCount } = Route.useLoaderData();
  const domainCount = new Set(capabilities.map((topic) => topic.category)).size;

  return (
    <PageBody width="comfortable">
      <Hero
        capabilityCount={capabilities.length}
        domainCount={domainCount}
        regionCount={regionCount}
      />
      <Section
        title="Choose your starting point"
        description="Pick the question that matches where you are in your platform journey."
      >
        <EntryCards capabilities={capabilities} landingZones={landingZones} />
      </Section>

      <Section
        title="From idea to production"
        description="Follow the lifecycle or jump to what you need right now."
        className="gap-6"
      >
        <JourneyGrid />
      </Section>

      <Section title="Recently viewed">
        <RecentlyViewed />
      </Section>

      <Section title="What's new">
        <PlatformUpdates />
      </Section>

      <Section title="Keep exploring">
        <ResourceLinkGrid />
      </Section>
    </PageBody>
  );
}

function Hero({
  capabilityCount,
  domainCount,
  regionCount,
}: {
  capabilityCount: number;
  domainCount: number;
  regionCount: number;
}) {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-3.5">
        {/* Same-colour plates (bg-background w-fit) keep the grid out from behind copy. */}
        <span className="w-fit bg-background font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Platform catalog
        </span>
        <h1 className="w-fit max-w-[16ch] bg-background type-display font-bold leading-[1.03] tracking-[-0.035em] text-balance text-foreground sm:type-display-lg">
          Find the right platform path
        </h1>
        <p className="w-fit max-w-[60ch] bg-background text-[1.125rem] leading-[1.55] text-pretty text-muted-foreground">
          One place to find approved capabilities, see where they're available, and follow the path
          from idea to production.
        </p>
      </div>
      <IntentSearch className="h-12" />
      <div className="flex flex-wrap gap-2">
        <Badge variant="brand">{capabilityCount} capabilities</Badge>
        <Badge variant="outline">{domainCount} domains</Badge>
        <Badge variant="outline">{regionCount} regions &amp; outposts</Badge>
        <Badge variant="outline">L3–L5 landing zones</Badge>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      {title ? (
        <div className="flex flex-col gap-1">
          {/* Prototype .sec-head: 21px/700/-0.02em title + 13.5px sub, on bg plates. */}
          <h2 className="w-fit bg-background text-[1.3125rem] font-bold leading-tight tracking-[-0.02em] text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="w-fit max-w-[60ch] bg-background type-detail leading-[1.5] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
