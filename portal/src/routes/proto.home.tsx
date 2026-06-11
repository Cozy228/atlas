/**
 * PROTOTYPE (production candidate) — Home redesign · route `/proto/home`
 * ======================================================================
 * Round 2: the "Welcome desk" direction (the round-1 baseline the review
 * liked) carried forward as the single home. The centered hero + "From idea to
 * production" JourneyGrid stay; the formerly-samey sections each keep their own
 * register (ledger band · featured intent doors · catalog book index · change
 * timeline). The "front page" broadsheet moved to its own `/proto/whatsnew`.
 *
 * Renders inside the real PortalShell (top bar + grid canvas stay). Real
 * availability data feeds the domain index and stats; the rest is fictional
 * and public-safe. Links target the prototype suite so the flow stays
 * coherent.
 */
import { createFileRoute } from "@tanstack/react-router";

import { availabilityQueryOptions } from "@/api/queries";
import { HomeWelcome } from "@/components/proto/home/welcome";
import type { HomeLoaderData } from "@/components/proto/home/data";

function slugifyDomain(domain: string): string {
  return domain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const Route = createFileRoute("/proto/home")({
  loader: async ({ context }): Promise<HomeLoaderData> => {
    const availability = await context.queryClient.ensureQueryData(availabilityQueryOptions);
    // Same projection as /proto/catalog so the numbers on both pages agree.
    const zone = availability.zones.find((z) => z.id === "aws") ?? availability.zones[0]!;
    const services = zone.services.filter((service) => service.id !== "landing-zones");
    const byDomain = new Map<string, string[]>();
    for (const service of services) {
      const bucket = byDomain.get(service.domain) ?? [];
      bucket.push(service.name);
      byDomain.set(service.domain, bucket);
    }
    const domains = [...byDomain.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([domain, names]) => ({
        domain,
        anchor: `domain-${slugifyDomain(domain)}`,
        count: names.length,
        preview: names.toSorted((a, b) => a.localeCompare(b)).slice(0, 3).join(" · "),
      }));
    return {
      serviceCount: services.length,
      domainCount: domains.length,
      regionCount: availability.zones.reduce((sum, z) => sum + z.locations.length, 0),
      domains,
    };
  },
  component: ProtoHome,
});

function ProtoHome() {
  const data = Route.useLoaderData();

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-8 sm:px-8">
      <HomeWelcome data={data} />
    </div>
  );
}
