/**
 * PROTOTYPE (production candidate) — Guidance detail · route
 * `/proto/guidance/$guidanceId`
 * ============================================================
 * The proto replacement for the mainline `/guidance/$guidanceId` stepper
 * workspace, rendered as the "Journey log": a single-scroll document with every
 * station of the route visible down one spine.
 *
 * Real data via `getProtoGuidance` (shared fixtures + proto-only flows) + the
 * source registry; progress tracking stays (localStorage via
 * `useGuidanceProgress`, shared with the mainline page). The trailing-underscore
 * filename keeps this route un-nested from the index.
 */
import { createFileRoute, notFound } from "@tanstack/react-router";

import { sourceDiscoveryQueryOptions } from "@/api/queries";
import { getProtoGuidance } from "@/components/proto/guidance/catalog";
import { GuidanceDetailLog } from "@/components/proto/guidance/detail-log";

export const Route = createFileRoute("/proto/guidance_/$guidanceId")({
  loader: async ({ context, params }) => {
    const guidance = getProtoGuidance(params.guidanceId);
    if (!guidance) throw notFound();
    const sourcesResp = await context.queryClient.ensureQueryData(sourceDiscoveryQueryOptions);
    return { guidance, sources: sourcesResp.sources };
  },
  component: ProtoGuidanceDetail,
});

function ProtoGuidanceDetail() {
  const { guidance, sources } = Route.useLoaderData();

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-6 py-8 sm:px-8">
      <GuidanceDetailLog guidance={guidance} sources={sources} />
    </div>
  );
}
