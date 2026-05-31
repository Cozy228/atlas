import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { Topic, TopicDiscoveryResponse } from "@atlas/schema";

import { topicDiscoveryQueryOptions } from "@/api/queries";
import { cn } from "@/lib/utils";
import { EntryCards } from "@/components/home/entry-cards";
import { JourneyGrid } from "@/components/home/journey-grid";
import { PlatformUpdates } from "@/components/home/platform-updates";
import { RecentlyViewed } from "@/components/home/recently-viewed";
import { ResourceLinkGrid } from "@/components/home/resource-link-grid";
import { IntentSearch } from "@/components/intent-search";
import { PageBody } from "@/components/page-section";
import { SectionEyebrow } from "@/components/section-eyebrow";

type HomeLoaderData = {
  capabilities: ReadonlyArray<Topic>;
  landingZones: ReadonlyArray<Topic>;
};

export const Route = createFileRoute("/")({
  loader: async ({ context }): Promise<HomeLoaderData> => {
    const topicsResp: TopicDiscoveryResponse = await context.queryClient.ensureQueryData(
      topicDiscoveryQueryOptions,
    );

    return {
      capabilities: topicsResp.topics.filter((topic) => topic.topic_type === "capability"),
      landingZones: topicsResp.topics.filter((topic) => topic.topic_type === "landing-zone"),
    };
  },
  component: HomeRoute,
});

function HomeRoute() {
  const { capabilities, landingZones } = Route.useLoaderData();

  return (
    <PageBody width="comfortable">
      <Hero />
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

function Hero() {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="max-w-[20ch] type-display font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:type-display-lg">
          Find the right platform path
        </h1>
        <p className="max-w-[52ch] type-body leading-[1.6] text-muted-foreground">
          Search across capabilities, landing zones, tools, and owners. Start from a question or
          browse the catalog.
        </p>
      </div>
      <IntentSearch />
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
      <SectionEyebrow title={title} description={description} />
      {children}
    </section>
  );
}
