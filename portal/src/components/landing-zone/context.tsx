import { createContext, use, useMemo, useState, type ReactNode } from "react";

/** The default landing zone — the one wired availability source (ADR-0017). */
export const DEFAULT_LANDING_ZONE_ID = "awsf";

type CurrentLandingZoneValue = {
  currentLandingZoneId: string;
  setCurrentLandingZoneId: (id: string) => void;
};

const CurrentLandingZoneContext = createContext<CurrentLandingZoneValue | null>(null);

/**
 * Global "current landing zone" (plan 021 G3, ADR-0017 d.7). A site-wide selector
 * state, default `awsf` (the one wired LZ), lifted here like AskAtlasProvider so
 * the top-nav dropdown and the LZ-aware surfaces share one value. The landing zone
 * is a SCOPE filter, not an address — it never enters `{kind}/{slug}` (ADR-0015 §5).
 */
export function CurrentLandingZoneProvider({ children }: { children: ReactNode }) {
  const [currentLandingZoneId, setCurrentLandingZoneId] = useState(DEFAULT_LANDING_ZONE_ID);
  const value = useMemo<CurrentLandingZoneValue>(
    () => ({ currentLandingZoneId, setCurrentLandingZoneId }),
    [currentLandingZoneId],
  );
  return (
    <CurrentLandingZoneContext.Provider value={value}>
      {children}
    </CurrentLandingZoneContext.Provider>
  );
}

export function useCurrentLandingZone() {
  const ctx = use(CurrentLandingZoneContext);
  if (!ctx) {
    throw new Error("useCurrentLandingZone must be used within CurrentLandingZoneProvider");
  }
  return ctx;
}
