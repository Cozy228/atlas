import { IconChevronDown } from "@tabler/icons-react";

import { LANDING_ZONES } from "@atlas/context-layer/landingZones";
import { cn } from "@/lib/utils";

import { useCurrentLandingZone } from "./context";

/**
 * Top-nav current-landing-zone selector (plan 021 G3, ADR-0017 d.7). Lists every
 * registered landing zone — wired and unwired alike (unwired are NOT hidden;
 * selecting one is an honest dead-end, ADR-0006). Switching sets the global
 * current-LZ that the LZ-aware surfaces read.
 */
export function LandingZoneSelector() {
  const { currentLandingZoneId, setCurrentLandingZoneId } = useCurrentLandingZone();
  const current = LANDING_ZONES.find((zone) => zone.id === currentLandingZoneId);

  return (
    <label
      data-current-landing-zone={currentLandingZoneId}
      className={cn(
        "relative flex h-8 max-w-[7.5rem] items-center gap-1.5 rounded-md border border-border bg-card pl-2.5 text-sm font-medium text-foreground sm:max-w-none",
        "transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring",
      )}
    >
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground sm:inline">
        LZ
      </span>
      <select
        aria-label="Current landing zone"
        value={currentLandingZoneId}
        onChange={(event) => setCurrentLandingZoneId(event.target.value)}
        className="h-full w-[6.5rem] appearance-none truncate bg-transparent pr-7 outline-none sm:w-auto sm:max-w-[20ch]"
      >
        {current ? null : <option value={currentLandingZoneId}>{currentLandingZoneId}</option>}
        {LANDING_ZONES.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name}
            {zone.dataStatus === "not-available" ? " (no data)" : ""}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={14}
        strokeWidth={2}
        className="pointer-events-none absolute right-2.5 text-muted-foreground"
        aria-hidden
      />
    </label>
  );
}
