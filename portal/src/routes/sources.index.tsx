/**
 * Source registry · route `/sources`
 * ==================================
 * Sources are Atlas's evidence backbone. Browse by class — a two-level register
 * (class → category) with search, facet filters, and a switchable grouping axis.
 *
 * Real data via the source-discovery projection (`SourcesByClass` already speaks
 * the registry `Source` type). The category sub-axis is keyword-derived and
 * gracefully collapses to source class for sources it does not recognise.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { SourceDiscoveryResponse } from "@atlas/schema";

import { sourceDiscoveryQueryOptions } from "@/api/queries";
import { SourcesByClass } from "@/components/sources/byclass";

export const Route = createFileRoute("/sources/")({
  loader: async ({ context }) => {
    const resp = (await context.queryClient.ensureQueryData(
      sourceDiscoveryQueryOptions,
    )) as SourceDiscoveryResponse;
    return { sources: resp.sources };
  },
  component: SourcesIndex,
});

function SourcesIndex() {
  const { sources } = Route.useLoaderData();

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-6 py-8 sm:px-8">
      <SourcesByClass sources={sources} />
    </div>
  );
}
