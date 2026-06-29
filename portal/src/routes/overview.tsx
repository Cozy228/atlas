/**
 * Operations dashboard · route `/overview`
 * ================================================================================
 * Not available at the moment: the operations snapshot was driven entirely by
 * fictional fixtures (`lib/ops.ts`), so the route is gated off — navigating here
 * redirects home and there is no nav entry, so it is neither accessible nor
 * visible. The dashboard component + its data are kept in the tree (NOT deleted),
 * parked for when a real source is wired.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/overview")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
