/**
 * Catalog · route `/catalog`
 * ==========================
 * Facet rail, type tabs, and a Cards ↔ Table toggle over the real topic +
 * availability projection. Capabilities and landing zones open the datasheet at
 * `/catalog/$topicId`; guardrail areas keep their `/guardrails/$guardrailId`
 * route. Sources are their own surface at `/sources`.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { Topic, TopicDiscoveryResponse } from "@atlas/schema";

import { availabilityQueryOptions, topicDiscoveryQueryOptions } from "@/api/queries";
import type { LandingZoneData } from "@/api/server/availability";
import { CatalogAdopted } from "@/components/catalog/adopted";

type LoaderData = {
  topics: ReadonlyArray<Topic>;
  zone: LandingZoneData;
};

export const Route = createFileRoute("/catalog/")({
  loader: async ({ context }): Promise<LoaderData> => {
    const [topicsResp, availability] = await Promise.all([
      context.queryClient.ensureQueryData(
        topicDiscoveryQueryOptions,
      ) as Promise<TopicDiscoveryResponse>,
      context.queryClient.ensureQueryData(availabilityQueryOptions),
    ]);
    const zone = availability.zones.find((entry) => entry.id === "aws") ?? availability.zones[0]!;
    return { topics: topicsResp.topics, zone };
  },
  component: CatalogIndex,
});

function CatalogIndex() {
  const { topics, zone } = Route.useLoaderData();

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <CatalogAdopted topics={topics} zone={zone} />
    </div>
  );
}
