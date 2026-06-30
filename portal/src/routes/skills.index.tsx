/**
 * Skills · route `/skills`
 * ========================
 * Not available at the moment: the skills index was driven by a curated fixture
 * (`lib/skills.ts`), so the route is gated off — navigating here redirects home
 * and there is no nav entry, so it is neither accessible nor visible. The man-page
 * component + its data are kept in the tree (NOT deleted), parked for when a real
 * source is wired.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/skills/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
