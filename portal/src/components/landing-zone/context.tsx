import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import type { AppRecord } from "@atlas/schema";

/** The default landing zone — the one wired availability source (ADR-0017). */
export const DEFAULT_LANDING_ZONE_ID = "awsf";

type SituationValue = {
  /** The active landing zone driving the LZ-aware surfaces. */
  currentLandingZoneId: string;
  setCurrentLandingZoneId: (id: string) => void;
  /**
   * The selected self-declared APP (Step 3, P17), or null for LZ-only behavior.
   * Selecting an APP narrows the zone choice to its declared set and defaults
   * the current zone to the first member; clearing it restores LZ-only scoping
   * (the revert posture — locked decision 8).
   */
  selectedApp: AppRecord | null;
  selectApp: (app: AppRecord | null) => void;
};

const SituationContext = createContext<SituationValue | null>(null);

/**
 * Global situation state (Step 3, locked decision 8; P17/P21). The APP selector
 * subsumes the LZ selector: the situation carries both the current landing zone
 * (default `awsf`, the one wired LZ) and the optionally-selected APP. Lifted here
 * like AskAtlasProvider so the top-nav selector and the LZ-aware surfaces share
 * one value. The landing zone is a SCOPE filter, not an address (ADR-0015 §5).
 */
export function CurrentLandingZoneProvider({ children }: { children: ReactNode }) {
  const [currentLandingZoneId, setCurrentLandingZoneId] = useState(DEFAULT_LANDING_ZONE_ID);
  const [selectedApp, setSelectedApp] = useState<AppRecord | null>(null);

  const selectApp = useCallback((app: AppRecord | null) => {
    setSelectedApp(app);
    // Choosing an APP narrows the zone choice to its declared set (default: the
    // first member). Clearing leaves the current zone as-is (LZ-only revert).
    if (app && app.landingZoneIds.length > 0) {
      setCurrentLandingZoneId(app.landingZoneIds[0]);
    }
  }, []);

  const value = useMemo<SituationValue>(
    () => ({ currentLandingZoneId, setCurrentLandingZoneId, selectedApp, selectApp }),
    [currentLandingZoneId, selectedApp, selectApp],
  );
  return <SituationContext.Provider value={value}>{children}</SituationContext.Provider>;
}

function useSituationContext(): SituationValue {
  const ctx = use(SituationContext);
  if (!ctx) {
    throw new Error("useSituation must be used within CurrentLandingZoneProvider");
  }
  return ctx;
}

/** Current-LZ view (unchanged API for the LZ-aware surfaces). */
export function useCurrentLandingZone() {
  const { currentLandingZoneId, setCurrentLandingZoneId } = useSituationContext();
  return { currentLandingZoneId, setCurrentLandingZoneId };
}

/** Full situation view (APP selection + current LZ) for the selector. */
export function useSituation(): SituationValue {
  return useSituationContext();
}
