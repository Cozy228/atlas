/**
 * PROTOTYPE (production candidate) — Guidance detail · route
 * `/proto/guidance/$guidanceId`
 * ============================================================
 * The proto replacement for the mainline `/guidance/$guidanceId` stepper
 * workspace. Two registers behind `?variant=`, toggled in-page:
 *
 *   - `board` (default) → "Journey log": single-scroll document, every station
 *     visible down one spine.
 *   - `line` → "Track": full route on top, the selected station's platform below.
 *
 * Real data via `getProtoGuidance` (shared fixtures + proto-only flows) + the
 * source registry; progress tracking stays (localStorage via
 * `useGuidanceProgress`, shared with the mainline page). The trailing-underscore
 * filename keeps this route un-nested from the index.
 */
import { createFileRoute, notFound } from "@tanstack/react-router";

import { sourceDiscoveryQueryOptions } from "@/api/queries";
import { getProtoGuidance } from "@/components/proto/guidance/catalog";
import { GuidanceDetailLine } from "@/components/proto/guidance/detail-line";
import { GuidanceDetailLog } from "@/components/proto/guidance/detail-log";
import { VariantBar } from "@/components/proto/variant-bar";
import { defaultStepId } from "@/lib/guidance";

import { GUIDANCE_VARIANTS, isGuidanceVariant, type GuidanceVariant } from "./proto.guidance";

type DetailSearch = { variant?: GuidanceVariant; step?: string };

export const Route = createFileRoute("/proto/guidance_/$guidanceId")({
  validateSearch: (search: Record<string, unknown>): DetailSearch => ({
    variant: isGuidanceVariant(search.variant) ? search.variant : undefined,
    step: typeof search.step === "string" ? search.step : undefined,
  }),
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
  const { variant, step } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active: GuidanceVariant = variant ?? "board";

  const selectedStepId =
    step && guidance.steps.some((s) => s.id === step) ? step : defaultStepId(guidance);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-6 py-8 sm:px-8">
      <VariantBar
        variants={GUIDANCE_VARIANTS}
        active={active}
        onSelect={(id) => void navigate({ search: (prev) => ({ ...prev, variant: id }), replace: true })}
      />
      {active === "board" ? <GuidanceDetailLog guidance={guidance} sources={sources} /> : null}
      {active === "line" ? (
        <GuidanceDetailLine guidance={guidance} sources={sources} selectedStepId={selectedStepId} />
      ) : null}
    </div>
  );
}
