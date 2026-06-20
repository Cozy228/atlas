/**
 * PROTOTYPE (production candidate) — Catalog · route `/proto/catalog`
 * ==================================================================
 * The review-liked mainline `/catalog` design carried into the suite: facet
 * rail, type tabs, Cards ↔ Table toggle, reusing the mainline's exported
 * components read-only. (Earlier `specsheet` / drafting-room directions dropped.)
 *
 * Capability details link to `/proto/capability` (the proto datasheet);
 * landing zones and guardrails keep their real detail routes.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { Topic, TopicDiscoveryResponse } from "@atlas/schema";

import { availabilityQueryOptions, topicDiscoveryQueryOptions } from "@/api/queries";
import type { LandingZoneData } from "@/api/server/availability";
import { CatalogAdopted } from "@/components/proto/catalog/adopted";

type LoaderData = {
  topics: ReadonlyArray<Topic>;
  zone: LandingZoneData;
};

export const Route = createFileRoute("/proto/catalog")({
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
  component: ProtoCatalog,
});

function ProtoCatalog() {
  const { topics, zone } = Route.useLoaderData();

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <CatalogAdopted topics={topics} zone={zone} />
    </div>
  );
}
