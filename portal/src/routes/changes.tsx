/**
 * My changes · route `/changes`
 * ======================================================================
 * The machine-derived, per-scope change feed (Step 2, M8 / I6): `ChangeEvent`s
 * over the closed EventClass set, scoped by the shared APP / landing-zone
 * selector, each row cited to the source root it was derived from and carrying
 * its freshness. This is the seed of Step 5's APP-home change-feed slice.
 *
 * P31 (load-bearing): this is NOT What's New. What's New (`/whatsnew`) stays the
 * editorial Confluence newsletter, authored by humans; this surface is automatic,
 * derived, and scoped. The two are different surfaces and never merge.
 *
 * Data: the live derived feed (`fetchChanges`); in dev mock mode a deterministic
 * fictional feed renders the surface (a single discovery pass seeds baselines
 * silently, so the live feed is legitimately empty until changes accrue).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { changesQueryOptionsFor } from "@/api/queries";
import { useSituation } from "@/components/landing-zone/context";
import { ChangeFeedList } from "@/components/changes/change-feed";
import { PageBody, PageHeader } from "@/components/page-section";

export const Route = createFileRoute("/changes")({
  loader: ({ context }) => {
    // Warm the unscoped feed without blocking navigation; the body reads the
    // scoped query (situation-dependent) and shows skeletons until it lands.
    void context.queryClient.ensureQueryData(changesQueryOptionsFor());
  },
  component: MyChangesRoute,
});

function MyChangesRoute() {
  const { selectedApp } = useSituation();
  const scope = selectedApp?.landingZoneIds;
  const { data, isLoading } = useQuery(changesQueryOptionsFor(scope));

  const events = data?.events ?? [];

  return (
    <>
      <PageHeader
        title="My changes"
        description={
          selectedApp
            ? `Derived changes scoped to ${selectedApp.name}.`
            : "Derived changes across the platform. Pick an app or landing zone to scope this feed."
        }
      />
      <PageBody>
        <ChangeFeedList
          events={events}
          isLoading={isLoading}
          emptyText="No changes in scope yet. As sources change, derived events land here — What's New stays the editorial newsletter."
        />
      </PageBody>
    </>
  );
}
