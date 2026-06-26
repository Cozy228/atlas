/**
 * Operations dashboard · route `/overview`
 * ================================================================================
 * Replaces the concept of the mainline `/overview` (a catalog/evidence ledger)
 * with an APPLICATION OPERATIONS snapshot: how the applications on the platform
 * are doing right now — health, delivery (CI/CD), security, and incidents.
 *
 * A single dense operator read (the earlier Ops-board / Delivery directions were
 * dropped). All data is fictional fixtures from `lib/ops.ts` (services, deploys,
 * incidents, pipelines, scans, tickets); the page carries the `demo snapshot`
 * badge + frozen timestamp (ship-state honesty). Motion is calm, first-paint only.
 */
import { createFileRoute } from "@tanstack/react-router";

import { OverviewDashboard } from "@/components/overview/dashboard";

export const Route = createFileRoute("/overview")({
  component: OverviewRoute,
});

function OverviewRoute() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <OverviewDashboard />
    </div>
  );
}
