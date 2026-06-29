/**
 * Catalog · route `/catalog`
 * ==========================
 * Facet rail, type tabs, and a Cards ↔ Table toggle over the real topic +
 * availability projection. Services open the datasheet at their canonical
 * Resource address (`/service/$provider/$id`, plan 020 15d); security policies
 * keep their `/policies/$policyId` route. Sources are their own surface at
 * `/sources`.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { ResourceCatalogResponse, ResourceRecordResponse } from "@atlas/schema";

import { availabilityQueryOptions, resourceCatalogQueryOptions } from "@/api/queries";
import type { LandingZoneAvailability } from "@/api/server/availability";
import { CatalogAdopted } from "@/components/catalog/adopted";
import { DEFAULT_LANDING_ZONE_ID } from "@/components/landing-zone/context";
import { LandingZoneGate } from "@/components/landing-zone/landing-zone-gate";

type LoaderData = {
  resources: ReadonlyArray<ResourceRecordResponse>;
  zone: Promise<LandingZoneAvailability>;
};

export const Route = createFileRoute("/catalog/")({
  loader: async ({ context }): Promise<LoaderData> => {
    const catalogResp = (await context.queryClient.ensureQueryData(
      resourceCatalogQueryOptions,
    )) as ResourceCatalogResponse;
    // Slow: availability is a live Confluence fetch in the real adapter — defer it
    // (no await) so the catalog shell (header, tabs, search) paints immediately;
    // the workspace renders a skeleton until the zone lands.
    const zone = context.queryClient.ensureQueryData(availabilityQueryOptions).then(
      // The catalog shows the default (only wired) LZ's availability summary
      // until per-surface LZ scope lands (plans 022/023); pick it by id, not
      // by array position, so reordering LANDING_ZONES can't silently swap it.
      (availability) =>
        availability.zones.find((entry) => entry.id === DEFAULT_LANDING_ZONE_ID) ??
        availability.zones[0]!,
    );
    return { resources: catalogResp.resources, zone };
  },
  component: CatalogIndex,
});

function CatalogIndex() {
  const { resources, zone } = Route.useLoaderData();

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <LandingZoneGate surface="catalog">
        <CatalogAdopted resources={resources} zone={zone} />
      </LandingZoneGate>
    </div>
  );
}
