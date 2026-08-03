import type { ReactNode } from "react";

import { LANDING_ZONES } from "@atlas/context-layer/landingZones";

import { useCurrentLandingZone } from "./context";
import { DataNotAvailableForZone } from "./data-not-available";

/** The current landing zone's topology record (name + `dataStatus`), or undefined
 *  when an unknown id is supplied. */
export function useCurrentLandingZoneRecord() {
  const { currentLandingZoneId } = useCurrentLandingZone();
  return LANDING_ZONES.find((zone) => zone.id === currentLandingZoneId);
}

/**
 * Per-LZ honesty gate (ADR-0006, plan 021 C2). When the current landing zone is a
 * registered-but-unwired target (`dataStatus: "not-available"`), every LZ-scoped
 * surface renders the honest dead-end instead of another landing zone's data; a
 * wired LZ renders its children. This is honesty ONLY — making a wired zone's
 * content actually vary per LZ (s3@awsf ≠ s3@azure) is plan 023.
 *
 * Default current-LZ is the wired `awsf`, so the first client paint renders
 * children; the dead-end only appears after a client-side switch to an unwired
 * zone (by which point the static LZ list is warm), so there is no flash.
 */
export function LandingZoneGate({ surface, children }: { surface: string; children: ReactNode }) {
  const zone = useCurrentLandingZoneRecord();
  if (zone?.dataStatus === "not-available") {
    return <DataNotAvailableForZone zoneName={zone.name} surface={surface} />;
  }
  return <>{children}</>;
}
