import { useQuery } from "@tanstack/react-query";
import { IconChevronDown } from "@tabler/icons-react";

import { landingZonesQueryOptions } from "@/api/queries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const { data: zones = [] } = useQuery(landingZonesQueryOptions);
  const current = zones.find((zone) => zone.id === currentLandingZoneId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Current landing zone"
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-sm font-medium text-foreground",
          "transition-colors hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
          LZ
        </span>
        <span className="max-w-[12ch] truncate">{current?.name ?? currentLandingZoneId}</span>
        <IconChevronDown size={14} strokeWidth={2} className="text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>Landing zone</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={currentLandingZoneId}
          onValueChange={(value) => setCurrentLandingZoneId(value)}
        >
          {zones.map((zone) => (
            <DropdownMenuRadioItem key={zone.id} value={zone.id}>
              <span className="truncate">{zone.name}</span>
              {zone.dataStatus === "not-available" ? (
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground/70">
                  no data
                </span>
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
