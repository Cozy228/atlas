/**
 * Source detail · route `/sources/$sourceId`
 * ==========================================
 * The source record rendered as the "dossier": an accession record with a
 * meta-ledger rail and a main column carrying authority scope, key sections,
 * resting citations, related records, and a revision history.
 *
 * Real data via the source-discovery projection + the live context bundle
 * (absent bundles handled gracefully). `useRecordRecent` keeps the source in
 * the Home "recently viewed" trail.
 */
import { createFileRoute, notFound } from "@tanstack/react-router";
import type { ContextBundleResponse, Source, SourceDiscoveryResponse } from "@atlas/schema";

import { ContextApiError } from "@/api/contextApiError";
import { contextBundleQueryOptions, sourceDiscoveryQueryOptions } from "@/api/queries";
import { SourceDossier } from "@/components/sources/detail";
import { useRecordRecent } from "@/components/home/recently-viewed";

type LoaderData = {
  source: Source;
  bundle: ContextBundleResponse | null;
  related: ReadonlyArray<Source>;
};

export const Route = createFileRoute("/sources/$sourceId")({
  loader: async ({ context, params }): Promise<LoaderData> => {
    const resp = (await context.queryClient.ensureQueryData(
      sourceDiscoveryQueryOptions,
    )) as SourceDiscoveryResponse;
    const source = resp.sources.find((entry) => entry.id === params.sourceId);
    if (!source) throw notFound();

    // Related = other registered sources sharing this one's class or any of its
    // authority scopes (real data, ranked: shared-class first).
    const scopes = new Set(source.authority_scope);
    const related = resp.sources
      .filter((s) => s.id !== source.id)
      .map((s) => ({
        s,
        score:
          (s.source_class === source.source_class ? 2 : 0) +
          (s.authority_scope.some((sc) => scopes.has(sc)) ? 1 : 0),
      }))
      .filter((entry) => entry.score > 0)
      .toSorted((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((entry) => entry.s);

    let bundle: ContextBundleResponse | null = null;
    try {
      // disclosure_level 2 resolves every registered anchor on the source (the
      // default of 1 returns only the first), so "Key sections" shows the real
      // sections of this page, not just one.
      bundle = await context.queryClient.ensureQueryData(
        contextBundleQueryOptions({ source_id: source.id, disclosure_level: 2 }),
      );
    } catch (error) {
      if (error instanceof ContextApiError) bundle = null;
      else throw error;
    }
    return { source, bundle, related };
  },
  component: SourceDetailRoute,
});

function SourceDetailRoute() {
  const { source, bundle, related } = Route.useLoaderData();

  useRecordRecent({ kind: "source", sourceId: source.id, name: source.title });

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-6 py-8 sm:px-8">
      <SourceDossier source={source} bundle={bundle} related={related} />
    </div>
  );
}
