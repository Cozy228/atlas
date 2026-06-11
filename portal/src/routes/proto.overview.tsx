/**
 * PROTOTYPE (production candidate) — Operations overview · route `/proto/overview`
 * ================================================================================
 * Replaces the concept of the mainline `/overview` (a catalog/evidence ledger)
 * with an APPLICATION OPERATIONS snapshot: how the applications on the
 * platform are doing right now — CI/CD, health, incidents, and release state.
 *
 * Two directions behind `?variant=` (see `prototype/NOTES.md`):
 *   - `dashboard` (default) — the merged read: KPI scorecard (sparklines) +
 *     condition gauge & priority "needs attention" feed + fleet health table +
 *     dev → staging → prod promotion state in a lighter form.
 *   - `compact`  — the same snapshot distilled to a single screen: condition
 *     strip, top of the attention feed, a tight fleet list.
 *
 * All data is fictional fixtures from `lib/ops.ts`; every variant carries the
 * `demo snapshot` badge + frozen timestamp (ship-state honesty).
 */
import { createFileRoute } from "@tanstack/react-router";

import { OverviewCompact } from "@/components/proto/overview/compact";
import { OverviewDashboard } from "@/components/proto/overview/dashboard";
import { VariantBar, type ProtoVariant } from "@/components/proto/variant-bar";

const OVERVIEW_VARIANTS = [
  {
    id: "dashboard",
    label: "Dashboard",
    summary: "Merged: KPI scorecard + condition gauge + attention feed + fleet table.",
  },
  {
    id: "compact",
    label: "Compact",
    summary: "The same snapshot distilled to a single glanceable screen.",
  },
] as const satisfies ReadonlyArray<ProtoVariant>;

type OverviewVariant = (typeof OVERVIEW_VARIANTS)[number]["id"];

function isOverviewVariant(value: unknown): value is OverviewVariant {
  return OVERVIEW_VARIANTS.some((variant) => variant.id === value);
}

export const Route = createFileRoute("/proto/overview")({
  validateSearch: (search: Record<string, unknown>): { variant?: OverviewVariant } => ({
    variant: isOverviewVariant(search.variant) ? search.variant : undefined,
  }),
  component: ProtoOverview,
});

function ProtoOverview() {
  const { variant } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active: OverviewVariant = variant ?? "dashboard";

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <VariantBar
        variants={OVERVIEW_VARIANTS}
        active={active}
        onSelect={(id) => void navigate({ search: { variant: id }, replace: true })}
      />
      {active === "dashboard" ? <OverviewDashboard /> : null}
      {active === "compact" ? <OverviewCompact /> : null}
    </div>
  );
}
