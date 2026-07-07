import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconChevronDown } from "@tabler/icons-react";

import { appsQueryOptions, landingZonesQueryOptions } from "@/api/queries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { AppDeclareDialog } from "./app-declare-dialog";
import { AppMembershipBadge, AppProvenanceBadge } from "./app-badges";
import { useSituation } from "./context";

/**
 * Top-nav situation selector (Step 3, locked decision 8; P17/P21/M3). The APP
 * selector SUBSUMES the LZ selector: registered self-declared APPs are offered
 * above the raw landing-zone list. Choosing an APP (a) narrows the zone choice
 * to the APP's declared set (default: first member) and (b) shows the APP name
 * with its VERIFIED badge (from `membershipSource`, axis 2) and content-provenance
 * badge (from `origin`, axis 3) — the two are never conflated (R4). A self-declare form drives
 * registration — the P21 fallback for non-repo situations. No APP selected ⇒
 * LZ-only behavior, unchanged (the revert posture). Unwired LZs are listed, not
 * hidden — selecting one is an honest dead-end (ADR-0006).
 */
export function LandingZoneSelector() {
  const { currentLandingZoneId, setCurrentLandingZoneId, selectedApp, selectApp } = useSituation();
  const { data: zones = [] } = useQuery(landingZonesQueryOptions);
  const { data: appsData } = useQuery(appsQueryOptions);
  const apps = appsData?.apps ?? [];
  const [formOpen, setFormOpen] = useState(false);
  // Controlled so picking an APP closes the picker (base-ui keeps radio menus
  // open on select): choosing your app should hand you back the page — the
  // situation-scoped surfaces (e.g. the Step-7 status board) become interactable.
  const [menuOpen, setMenuOpen] = useState(false);

  // When an APP is selected, the zone choice narrows to its declared set.
  const visibleZones = selectedApp
    ? zones.filter((zone) => selectedApp.landingZoneIds.includes(zone.id))
    : zones;

  const currentZone = zones.find((zone) => zone.id === currentLandingZoneId);
  const triggerLabel = selectedApp ? selectedApp.name : (currentZone?.name ?? currentLandingZoneId);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          aria-label="App / landing zone"
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-sm font-medium text-foreground",
            "transition-colors hover:bg-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span className="type-eyebrow text-muted-foreground">{selectedApp ? "APP" : "LZ"}</span>
          <span className="max-w-[20ch] truncate">{triggerLabel}</span>
          {selectedApp ? (
            <AppMembershipBadge
              membershipSource={selectedApp.membershipSource}
              className="shrink-0"
            />
          ) : null}
          <IconChevronDown
            size={14}
            strokeWidth={2}
            className="text-muted-foreground"
            aria-hidden
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[16rem]">
          {apps.length > 0 ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Apps</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuRadioGroup
                value={selectedApp?.id ?? ""}
                onValueChange={(value) => {
                  selectApp(apps.find((app) => app.id === value) ?? null);
                  // Picking an APP dismisses the picker so the scoped surfaces
                  // (status board, briefs) are immediately interactable.
                  setMenuOpen(false);
                }}
              >
                {apps.map((app) => (
                  <DropdownMenuRadioItem key={app.id} value={app.id}>
                    <span className="min-w-0 flex-1 truncate">{app.name}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      <AppMembershipBadge membershipSource={app.membershipSource} />
                      <AppProvenanceBadge origin={app.origin} />
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          ) : null}

          <DropdownMenuItem onClick={() => setFormOpen(true)}>Declare an app</DropdownMenuItem>
          {selectedApp ? (
            <DropdownMenuItem onClick={() => selectApp(null)}>
              Clear app (landing zones only)
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Landing zone</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={currentLandingZoneId}
            onValueChange={(value) => setCurrentLandingZoneId(value)}
          >
            {visibleZones.map((zone) => (
              <DropdownMenuRadioItem key={zone.id} value={zone.id}>
                <span className="min-w-0 flex-1 truncate">{zone.name}</span>
                {zone.dataStatus === "not-available" ? (
                  <span className="ml-auto shrink-0 whitespace-nowrap type-eyebrow text-muted-foreground/70">
                    no data
                  </span>
                ) : null}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AppDeclareDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        zones={zones}
        onDeclared={(app) => selectApp(app)}
      />
    </>
  );
}
