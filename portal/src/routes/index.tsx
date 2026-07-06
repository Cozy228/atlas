/**
 * APP home · route `/` (Step 5, I6)
 * ======================================================================
 * The Portal home is the APP home: the situation card (the shared APP / landing-
 * zone selector state, in the app shell + summarized here), a scoped change-feed
 * slice (the Step-2 derived feed, driven by that same selector), and the moment
 * entries linking the brief pages (`/briefs/{adopt,build,change}`; debug is marked
 * not-yet-available). The catalog-first home is gone — the catalog demotes to a
 * nav-reachable tool page (`/catalog` kept) — and the home never fabricates.
 *
 * P31 (load-bearing): the change-feed slice reuses the Step-2 changes machinery
 * (`changesQueryOptionsFor` + the shared `ChangeFeedList`), never the editorial
 * What's New (`/whatsnew`). The two surfaces never merge.
 *
 * Data: the live derived feed in production; in dev mock mode a deterministic
 * fictional feed renders the surface (public-safe).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { changesQueryOptionsFor } from "@/api/queries";
import { useSituation } from "@/components/landing-zone/context";
import { ChangeFeedList } from "@/components/changes/change-feed";
import { StaleSubgraphBanner } from "@/components/changes/stale-subgraph-banner";
import { PageBody, PageHeader } from "@/components/page-section";
import { cn } from "@/lib/utils";

/** The three live moments (Step 4) — each links its brief page. `debug` is Step 7
 *  (the operational-location floor), listed honestly as not-yet-available. */
const MOMENT_ENTRIES = [
  {
    moment: "adopt" as const,
    label: "Adopt",
    blurb:
      "Can I adopt this service here? Availability per landing zone, plus its adoption context.",
  },
  {
    moment: "build" as const,
    label: "Build",
    blurb: "What is my context? The join across the services your situation declares.",
  },
  {
    moment: "change" as const,
    label: "Change",
    blurb: "What changed for me? The derived feed scoped to your situation.",
  },
];

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    // Warm the unscoped derived feed without blocking navigation; the body reads
    // the scoped query (situation-dependent) and shows skeletons until it lands.
    void context.queryClient.ensureQueryData(changesQueryOptionsFor());
  },
  component: HomeRoute,
});

function HomeRoute() {
  const { selectedApp } = useSituation();
  const scope = selectedApp?.landingZoneIds;
  const { data, isLoading } = useQuery(changesQueryOptionsFor(scope));
  const events = data?.events ?? [];
  const roots = data?.roots ?? [];

  return (
    <>
      <PageHeader
        title="Home"
        description="For your app, in your landing zones, now — pick an app or landing zone in the top bar to scope the moments and the change feed below."
      />
      <PageBody>
        <div className="flex flex-col gap-8">
          <SituationCard appName={selectedApp?.name} zones={scope} />

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Moments</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {MOMENT_ENTRIES.map((entry) => (
                <Link
                  key={entry.moment}
                  to="/briefs/$moment"
                  params={{ moment: entry.moment }}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong"
                >
                  <span className="text-sm font-semibold text-foreground">{entry.label}</span>
                  <span className="text-xs leading-[1.5] text-muted-foreground">{entry.blurb}</span>
                </Link>
              ))}
              {/* Debug is Step 7 (the operational-location floor) — listed honestly,
                  never a fabricated door. */}
              <div
                aria-disabled="true"
                className="flex cursor-not-allowed flex-col gap-1 rounded-lg border border-dashed border-border bg-card/50 p-4"
              >
                <span className="text-sm font-semibold text-muted-foreground">Debug</span>
                <span className="text-xs leading-[1.5] text-muted-foreground">
                  Not yet available — arrives with the operational-location floor.
                </span>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Recent changes</h2>
            <StaleSubgraphBanner roots={roots} />
            <ChangeFeedList
              events={events}
              isLoading={isLoading}
              emptyText={
                selectedApp
                  ? `No changes in scope for ${selectedApp.name} yet. As sources change, derived events land here.`
                  : "No changes in scope yet. Pick an app or landing zone to scope this feed — What's New stays the editorial newsletter."
              }
            />
            <Link
              to="/changes"
              className="self-start text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              See all my changes →
            </Link>
          </section>
        </div>
      </PageBody>
    </>
  );
}

/** The situation card: a compact summary of the resolved APP / landing-zone scope
 *  the shared top-bar selector seats. Honest-empty (a prompt) when nothing is
 *  selected — never fabricated. */
function SituationCard({ appName, zones }: { appName?: string; zones?: string[] }) {
  const scoped = Boolean(appName);
  return (
    <section
      className={cn(
        "flex flex-col gap-1 rounded-xl border bg-card p-5",
        scoped ? "border-border" : "border-dashed border-border",
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Situation
      </span>
      {scoped ? (
        <>
          <p className="text-base font-semibold text-foreground">{appName}</p>
          <p className="text-xs text-muted-foreground">
            {zones && zones.length > 0 ? zones.join(" · ") : "No landing zones declared."}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No app selected. Use the App / landing zone selector in the top bar to scope your moments
          and change feed.
        </p>
      )}
    </section>
  );
}
