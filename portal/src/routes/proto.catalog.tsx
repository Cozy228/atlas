/**
 * PROTOTYPE (production candidate) — Catalog redesign · route `/proto/catalog`
 * ============================================================================
 * Round 2 (the round-1 "drafting-room parts catalog" is dropped). Two
 * directions behind `?variant=` (see `prototype/NOTES.md`):
 *
 *   - `adopted`   (default) — the review-liked mainline `/catalog` design
 *     carried into the suite: facet rail, type tabs, Cards ↔ Table toggle,
 *     reusing the mainline's exported components read-only.
 *   - `specsheet` — a typographic domain index (no cards, no table): heading
 *     blocks + flowing two-column service link lists. Domain blocks carry the
 *     `#domain-…` anchors that Home's catalog doorway targets.
 *
 * Capability details link to `/proto/capability` (the proto datasheet);
 * landing zones and guardrails keep their real detail routes.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IconSearch } from "@tabler/icons-react";
import type { Topic, TopicDiscoveryResponse } from "@atlas/schema";

import { availabilityQueryOptions, topicDiscoveryQueryOptions } from "@/api/queries";
import type { AvailabilityRecord, LandingZoneData, Location } from "@/api/server/availability";
import { CatalogAdopted } from "@/components/proto/catalog/adopted";
import { buildEntries, buildShelves } from "@/components/proto/catalog/data";
import { CatalogSpecsheet } from "@/components/proto/catalog/specsheet";
import { VariantBar, type ProtoVariant } from "@/components/proto/variant-bar";

const CATALOG_VARIANTS = [
  {
    id: "adopted",
    label: "Adopted mainline",
    summary: "The liked mainline catalog design: facet rail, tabs, cards ↔ table.",
  },
  {
    id: "specsheet",
    label: "Spec sheet",
    summary: "Typographic domain blocks with flowing service link lists.",
  },
] as const satisfies ReadonlyArray<ProtoVariant>;

type CatalogVariant = (typeof CATALOG_VARIANTS)[number]["id"];

function isCatalogVariant(value: unknown): value is CatalogVariant {
  return CATALOG_VARIANTS.some((variant) => variant.id === value);
}

type LoaderData = {
  topics: ReadonlyArray<Topic>;
  zone: LandingZoneData;
  services: ReadonlyArray<AvailabilityRecord>;
  locations: ReadonlyArray<Location>;
};

export const Route = createFileRoute("/proto/catalog")({
  validateSearch: (search: Record<string, unknown>): { variant?: CatalogVariant } => ({
    variant: isCatalogVariant(search.variant) ? search.variant : undefined,
  }),
  loader: async ({ context }): Promise<LoaderData> => {
    const [topicsResp, availability] = await Promise.all([
      context.queryClient.ensureQueryData(
        topicDiscoveryQueryOptions,
      ) as Promise<TopicDiscoveryResponse>,
      context.queryClient.ensureQueryData(availabilityQueryOptions),
    ]);
    const zone = availability.zones.find((entry) => entry.id === "aws") ?? availability.zones[0]!;
    return {
      topics: topicsResp.topics,
      zone,
      // The "landing-zones" record is a pseudo-service; the Landing zones tab
      // covers that ground with real topics instead.
      services: zone.services.filter((service) => service.id !== "landing-zones"),
      locations: zone.locations,
    };
  },
  component: ProtoCatalog,
});

function ProtoCatalog() {
  const { topics, zone, services, locations } = Route.useLoaderData();
  const { variant } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active: CatalogVariant = variant ?? "adopted";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-8 sm:px-8">
      <VariantBar
        variants={CATALOG_VARIANTS}
        active={active}
        onSelect={(id) => void navigate({ search: { variant: id }, replace: true })}
      />
      {active === "adopted" ? (
        <CatalogAdopted topics={topics} zone={zone} />
      ) : (
        <SpecsheetCatalog topics={topics} services={services} locations={locations} />
      )}
    </div>
  );
}

/** Shell (header + filter) for the projection-based spec-sheet direction. */
function SpecsheetCatalog({
  topics,
  services,
  locations,
}: {
  topics: ReadonlyArray<Topic>;
  services: ReadonlyArray<AvailabilityRecord>;
  locations: ReadonlyArray<Location>;
}) {
  const [query, setQuery] = useState("");
  const entries = useMemo(
    () => buildEntries(services, locations, topics),
    [services, locations, topics],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) =>
      [entry.name, entry.domain, entry.description, entry.owner].join(" ").toLowerCase().includes(q),
    );
  }, [entries, query]);
  const shelves = useMemo(() => buildShelves(filtered), [filtered]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="w-fit bg-background text-2xl font-bold tracking-[-0.02em] text-foreground">
            Catalog
          </h1>
          <p className="w-fit max-w-[60ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
            Every service offered through the platform, grouped by the domain it lives in.
          </p>
        </div>
        <label className="flex h-10 w-full max-w-[340px] items-center gap-2 rounded-lg border border-border bg-card px-3 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40 hover:border-border-strong">
          <IconSearch aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Filter services"
            aria-label="Filter services"
            className="h-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </header>

      <CatalogSpecsheet shelves={shelves} query={query} total={entries.length} />
    </div>
  );
}
