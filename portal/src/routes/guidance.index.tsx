/**
 * Guidance index · route `/guidance`
 * =========================================================================
 * The index is filed by CATEGORY (the guidance's own subject area), not by an
 * imposed lifecycle. The one recommendation it makes is simply whatever you have
 * running — your next stop. Master–detail: a persistent category rail beside the
 * selected category's guidances. Rows land on `/guidance/$guidanceId`.
 */
import { createFileRoute } from "@tanstack/react-router";

import { guidanceQueryOptions } from "@/api/queries";
import { GuidanceDirectory } from "@/components/guidance/index-directory";

export const Route = createFileRoute("/guidance/")({
  loader: async ({ context }) => ({
    guidances: await context.queryClient.ensureQueryData(guidanceQueryOptions),
  }),
  component: GuidanceIndexRoute,
});

function GuidanceIndexRoute() {
  const { guidances } = Route.useLoaderData();
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <GuidanceDirectory guidances={guidances} />
    </div>
  );
}
