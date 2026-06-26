/**
 * Home redesign · route `/`
 * ======================================================================
 * Round 2: the "Welcome desk" direction (the round-1 baseline the review
 * liked) carried forward as the single home. The centered hero + "From idea to
 * production" JourneyGrid stay; the formerly-samey sections each keep their own
 * register (ledger band · featured intent doors · catalog book index · change
 * timeline). The "front page" broadsheet moved to its own `/whatsnew`.
 *
 * Renders inside the real PortalShell (top bar + grid canvas stay). Real
 * availability data feeds the domain index and stats; the rest is fictional
 * and public-safe. Links target the portal so the flow stays
 * coherent.
 */
import { createFileRoute } from "@tanstack/react-router";

import { availabilityQueryOptions, announcementsQueryOptions } from "@/api/queries";
import { withDevLatency } from "@/lib/dev-latency";
import { DOMAIN_BLURBS } from "@/components/catalog/data";
import { HomeWelcome } from "@/components/home/welcome";
import type {
  DomainService,
  HomeAnnouncement,
  HomeLoaderData,
  HomeStats,
} from "@/components/home/data";

function slugifyDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const Route = createFileRoute("/")({
  loader: ({ context }): HomeLoaderData => {
    // Deferred (a live newsletter feed in the real adapter): the What's-new ticker
    // — same dev latency + skeleton as the other live data on the page.
    const announcements = withDevLatency(
      context.queryClient
        .ensureQueryData(announcementsQueryOptions)
        .then((feed): HomeAnnouncement[] =>
          feed.slice(0, 8).map((a) => ({ kind: a.kind ?? "Update", title: a.title })),
        ),
    );

    // Slow: availability is a live Confluence fetch + parse in the real adapter —
    // defer it (no await) so the home shell (hero, intents, lifecycle, ticker)
    // paints immediately; the hero stat numbers + domain index show a skeleton
    // until it lands. Same projection as /catalog so the numbers agree.
    const stats: Promise<HomeStats> = context.queryClient
      .ensureQueryData(availabilityQueryOptions)
      .then((availability) => {
        const zone = availability.zones.find((z) => z.id === "aws") ?? availability.zones[0]!;
        const services = zone.services.filter((service) => service.id !== "landing-zones");
        const byDomain = new Map<string, DomainService[]>();
        for (const service of services) {
          let live = 0;
          let planned = 0;
          for (const loc of zone.locations) {
            const status = service.availability[loc.id]?.status;
            if (status === "available" || status === "interim") live += 1;
            else if (status === "planned") planned += 1;
          }
          const entry: DomainService = {
            id: service.id,
            name: service.name,
            status: live > 0 ? "ga" : planned > 0 ? "planned" : "none",
            liveRegions: live,
            plannedRegions: planned,
          };
          (
            byDomain.get(service.domain) ?? byDomain.set(service.domain, []).get(service.domain)!
          ).push(entry);
        }
        const domains = [...byDomain.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([domain, entries]) => {
            const sorted = entries.toSorted((a, b) => a.name.localeCompare(b.name));
            return {
              domain,
              anchor: `domain-${slugifyDomain(domain)}`,
              count: sorted.length,
              preview: sorted
                .slice(0, 3)
                .map((s) => s.name)
                .join(" · "),
              blurb: DOMAIN_BLURBS[domain] ?? "",
              services: sorted,
            };
          });
        return {
          serviceCount: services.length,
          domainCount: domains.length,
          regionCount: availability.zones.reduce((sum, z) => sum + z.locations.length, 0),
          domains,
        };
      });

    // withDevLatency on stats too (like announcements): the public-safe mock
    // resolves instantly, which hides the hero-stat + service-catalog skeletons in
    // dev; the real adapter's availability fetch is genuinely slow.
    return { announcements, stats: withDevLatency(stats) };
  },
  component: HomeRoute,
});

function HomeRoute() {
  const data = Route.useLoaderData();

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <HomeWelcome data={data} />
    </div>
  );
}
