import { createFileRoute } from "@tanstack/react-router";
import type {
  Source,
  SourceDiscoveryResponse,
  Topic,
  TopicDiscoveryResponse,
} from "@atlas/schema";

import {
  fetchSourceDiscovery,
  fetchTopicDiscovery,
} from "@/api/server/contextApi";
import { CatalogHighlights } from "@/components/home/catalog-highlights";
import { EntryCards } from "@/components/home/entry-cards";
import { HealthBand } from "@/components/home/health-band";
import { JourneyGrid } from "@/components/home/journey-grid";
import { RecentlyViewed } from "@/components/home/recently-viewed";
import { ResourceLinkGrid } from "@/components/home/resource-link-grid";
import { IntentSearch } from "@/components/intent-search";
import { PageBody } from "@/components/page-section";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { classifyFreshness } from "@/lib/evidence";

type HomeLoaderData = {
  capabilities: ReadonlyArray<Topic>;
  landingZones: ReadonlyArray<Topic>;
  sources: ReadonlyArray<Source>;
  signals: HomeSignals;
};

type HomeSignals = {
  capabilityCount: number;
  landingZoneCount: number;
  sourceCount: number;
  staleSourceCount: number;
  restrictedSourceCount: number;
  brokenAnchorCount: number;
};

export const Route = createFileRoute("/")({
  loader: async (): Promise<HomeLoaderData> => {
    const [topicsResp, sourcesResp]: [
      TopicDiscoveryResponse,
      SourceDiscoveryResponse,
    ] = await Promise.all([fetchTopicDiscovery(), fetchSourceDiscovery()]);

    const capabilities = topicsResp.topics.filter(
      (topic) => topic.topic_type === "capability",
    );
    const landingZones = topicsResp.topics.filter(
      (topic) => topic.topic_type === "landing-zone",
    );

    const signals: HomeSignals = {
      capabilityCount: capabilities.length,
      landingZoneCount: landingZones.length,
      sourceCount: sourcesResp.sources.length,
      staleSourceCount: sourcesResp.sources.filter(
        (source) => classifyFreshness(source) === "stale",
      ).length,
      restrictedSourceCount: sourcesResp.sources.filter(
        (source) => source.visibility === "restricted",
      ).length,
      brokenAnchorCount: 0,
    };

    return {
      capabilities,
      landingZones,
      sources: sourcesResp.sources,
      signals,
    };
  },
  component: HomeRoute,
});

function HomeRoute() {
  const { capabilities, landingZones, signals } = Route.useLoaderData();

  return (
    <PageBody width="narrow">
      <Hero />
      <Section eyebrow="Platform" title="Choose your starting point" description="Pick the question that matches where you are in your platform journey.">
        <EntryCards capabilities={capabilities} landingZones={landingZones} />
      </Section>

      <Section eyebrow="Developer journey" title="From idea to production" description="Follow the lifecycle or jump to what you need right now.">
        <JourneyGrid />
      </Section>

      <Section eyebrow="Catalog" title="Capability highlights" description="A snapshot of the current catalog across regions and domains.">
        <CatalogHighlights
          serviceCount={signals.capabilityCount}
          regionCount={REGIONS.length}
          regionLabel={REGIONS.join(", ")}
        />
      </Section>

      <Section eyebrow="Recently viewed">
        <RecentlyViewed />
      </Section>

      <Section eyebrow="Health">
        <HealthBand
          staleSourceCount={signals.staleSourceCount}
          restrictedSourceCount={signals.restrictedSourceCount}
          brokenAnchorCount={signals.brokenAnchorCount}
        />
      </Section>

      <Section eyebrow="Resources" title="Keep exploring">
        <ResourceLinkGrid />
      </Section>
    </PageBody>
  );
}

const REGIONS = ["US-East-1", "CA-Central-1", "GDC", "DC16", "MT10"] as const;

function Hero() {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="max-w-[20ch] text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[34px]">
          Find the right platform path
        </h1>
        <p className="max-w-[52ch] text-[15px] leading-[1.6] text-muted-foreground">
          Search across capabilities, landing zones, tools, and owners. Start
          from a question or browse the catalog.
        </p>
      </div>
      <IntentSearch />
    </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionEyebrow
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      {children}
    </section>
  );
}
