/**
 * PROTOTYPE (production candidate) — Guidance index · route `/proto/guidance`
 * =========================================================================
 * Round 4: two index directions behind `?variant=`, both destination-aware:
 *   - `outcomes`  (default) — flows filed under the outcome they reach.
 *   - `byshape`   — organised by journey shape (Walkthrough / Decision / Checklist).
 *
 * Rows land on the proto detail `/proto/guidance/$guidanceId`, which keeps its
 * own register toggle. The detail register lives here as `GUIDANCE_VARIANTS`
 * (board = "Journey log", line = "Track").
 */
import { createFileRoute } from "@tanstack/react-router";

import { GuidanceIndex } from "@/components/proto/guidance/index";
import { GuidanceIndexShape } from "@/components/proto/guidance/index-shape";
import { VariantBar, type ProtoVariant } from "@/components/proto/variant-bar";

/** Index directions (the switcher on this page). */
const INDEX_VARIANTS = [
  {
    id: "outcomes",
    label: "Outcomes",
    summary: "Flows filed under the outcome they reach — a wayfinding directory.",
  },
  {
    id: "byshape",
    label: "By shape",
    summary: "Grouped by journey shape: Walkthroughs, Decisions, Checklists.",
  },
] as const satisfies ReadonlyArray<ProtoVariant>;

type IndexVariant = (typeof INDEX_VARIANTS)[number]["id"];

function isIndexVariant(value: unknown): value is IndexVariant {
  return INDEX_VARIANTS.some((variant) => variant.id === value);
}

/** Detail-page registers (used by the detail route + its in-page toggle). */
export const GUIDANCE_VARIANTS = [
  {
    id: "board",
    label: "Journey log",
    summary: "Single-scroll document; every station of the route visible at once.",
  },
  {
    id: "line",
    label: "Track",
    summary: "The whole line stays on top; the selected station's platform sits below.",
  },
] as const satisfies ReadonlyArray<ProtoVariant>;

export type GuidanceVariant = (typeof GUIDANCE_VARIANTS)[number]["id"];

export function isGuidanceVariant(value: unknown): value is GuidanceVariant {
  return GUIDANCE_VARIANTS.some((variant) => variant.id === value);
}

export const Route = createFileRoute("/proto/guidance")({
  validateSearch: (search: Record<string, unknown>): { variant?: IndexVariant } => ({
    variant: isIndexVariant(search.variant) ? search.variant : undefined,
  }),
  component: ProtoGuidance,
});

function ProtoGuidance() {
  const { variant } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active: IndexVariant = variant ?? "outcomes";

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <VariantBar
        variants={INDEX_VARIANTS}
        active={active}
        onSelect={(id) => void navigate({ search: { variant: id }, replace: true })}
      />
      {active === "outcomes" ? <GuidanceIndex /> : null}
      {active === "byshape" ? <GuidanceIndexShape /> : null}
    </div>
  );
}
