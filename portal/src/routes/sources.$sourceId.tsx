/**
 * Source detail · route `/sources/$sourceId`
 * ==========================================
 * The source record rendered as the "dossier": an accession record with a
 * meta-ledger rail and related records.
 *
 * A Source is the evidence document beneath the Resource projection, not a
 * Resource (plan 019): this is a pure registry view from the source-discovery
 * projection. `useRecordRecent` keeps the source in the Home "recently viewed"
 * trail.
 */
import { createFileRoute, notFound } from "@tanstack/react-router";
import type { Source, SourceDiscoveryResponse } from "@atlas/schema";

import { sourceDiscoveryQueryOptions } from "@/api/queries";
import { SourceDossier } from "@/components/sources/detail";
import { useRecordRecent } from "@/components/home/recently-viewed";

type LoaderData = {
  source: Source;
  related: ReadonlyArray<Source>;
};

export const Route = createFileRoute("/sources/$sourceId")({
  loader: async ({ context, params }): Promise<LoaderData> => {
    const resp = (await context.queryClient.ensureQueryData(
      sourceDiscoveryQueryOptions,
    )) as SourceDiscoveryResponse;
    const source = resp.sources.find((entry) => entry.id === params.sourceId);
    if (!source) throw notFound();

    // Related = other registered sources sharing this one's class (real data).
    const related = resp.sources
      .filter((s) => s.id !== source.id && s.source_class === source.source_class)
      .slice(0, 5);

    return { source, related };
  },
  component: SourceDetailRoute,
});

function SourceDetailRoute() {
  const { source, related } = Route.useLoaderData();

  useRecordRecent({ kind: "source", sourceId: source.id, name: source.title });

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-6 py-8 sm:px-8">
      <SourceDossier source={source} related={related} />
    </div>
  );
}
