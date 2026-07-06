import type { ChangesResponse, ChangeEvent, ChangeFeedRoot } from "@atlas/schema";

/**
 * Deterministic mock change feed for dev/e2e (`DEV_DATA_MODE === "mock"`).
 *
 * A single live discovery pass seeds each root's baseline SILENTLY (no events),
 * so the derived feed is legitimately empty until a real change occurs — which
 * would make the dev "my changes" surface blank. In mock mode we serve a small
 * fictional, public-safe feed so the surface renders exactly what the live feed
 * will once changes accrue. The live path (`resolveDataMode() === "live"`) reads
 * the real derived feed and never touches this fixture.
 */
const MOCK_EVENTS: ChangeEvent[] = [
  {
    id: "mock-available-in-added-parser-azuref",
    class: "available-in-added",
    subject: { kind: "service", id: "azure/parser" },
    object: { kind: "landingZone", id: "azuref" },
    landingZoneIds: ["azuref"],
    rootId: "availability:azuref",
    graphVersionFrom: "mock-v3",
    graphVersionTo: "mock-v4",
    derivedAt: "2026-07-04T09:15:00.000Z",
  },
  {
    id: "mock-module-version-changed-ledger",
    class: "module-version-changed",
    subject: { kind: "service", id: "aws/ledger" },
    object: { kind: "module", id: "orion/ledger/aws" },
    landingZoneIds: ["awsf"],
    from: "2.4.1",
    to: "2.5.0",
    rootId: "terraform",
    graphVersionFrom: "mock-v2",
    graphVersionTo: "mock-v3",
    derivedAt: "2026-07-03T14:02:00.000Z",
  },
  {
    id: "mock-service-added-vault",
    class: "service-added",
    subject: { kind: "service", id: "aws/vault" },
    landingZoneIds: ["awsf"],
    rootId: "availability:awsf",
    graphVersionFrom: "mock-v1",
    graphVersionTo: "mock-v2",
    derivedAt: "2026-07-02T11:30:00.000Z",
  },
];

/**
 * Per-root substrate freshness for the mock feed (decision 8 / D10). Substrate
 * health is GLOBAL (never scope-filtered). One root is deliberately served
 * last-good so the dev/e2e "my changes" surface exercises the loud aging banner
 * exactly as the live feed will when a source root stops refreshing; the others
 * stay live. Public-safe fictional data.
 */
const MOCK_ROOTS: ChangeFeedRoot[] = [
  { rootId: "availability:awsf", resolvedAt: "2026-07-06T08:00:00.000Z", stale: false },
  {
    rootId: "availability:azuref",
    resolvedAt: "2026-07-04T09:15:00.000Z",
    stale: true,
    agingNote:
      "Source root 'availability:azuref' is aging: serving last-good from 2026-07-04T09:15:00.000Z.",
  },
  { rootId: "terraform", resolvedAt: "2026-07-06T08:00:00.000Z", stale: false },
  { rootId: "security", resolvedAt: "2026-07-06T08:00:00.000Z", stale: false },
];

export type MockChangesScope = {
  landingZones?: string[];
  since?: string;
};

/** The mock feed, filtered to the scope's zones and `since` cursor, newest-last. */
export function mockChangesFeed(scope?: MockChangesScope): ChangesResponse {
  const ordered = [...MOCK_EVENTS].sort((a, b) => (a.derivedAt < b.derivedAt ? -1 : 1));
  const scopeIds = scope?.landingZones?.filter((id) => id.length > 0);
  const scoped =
    scopeIds && scopeIds.length > 0
      ? ordered.filter((event) => event.landingZoneIds.some((id) => scopeIds.includes(id)))
      : ordered;
  const events = scope?.since
    ? scoped.filter((event) => `${event.derivedAt}#${event.id}` > scope.since!)
    : scoped;
  const cursor =
    events.length > 0
      ? `${events[events.length - 1].derivedAt}#${events[events.length - 1].id}`
      : null;
  // Substrate health is global — the roots are never scope/since filtered.
  return { events, cursor, roots: MOCK_ROOTS };
}
