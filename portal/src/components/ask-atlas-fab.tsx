import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { IconMessageCircle } from "@tabler/icons-react";

import { useAskAtlas } from "@/components/ask-atlas/context";
import { AskOverlay } from "@/components/ask/ask-overlay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AskAtlasFab() {
  const { overlayOpen, overlayTab, openOverlay, setOverlayOpen, setOverlayTab } = useAskAtlas();
  // Asking is an in-place overlay (Search ⇄ Ask toggle) over the current
  // surface — never a separate page.
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // Hand off to dedicated ask surfaces: when a footer or a page's "just ask"
  // band scrolls into view (any [data-fab-dismiss]), the FAB fades out so it
  // never overlaps or competes with them.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const zones = Array.from(document.querySelectorAll("[data-fab-dismiss]"));
    if (zones.length === 0) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setDismissed(visible.size > 0);
      },
      { threshold: 0 },
    );
    for (const zone of zones) observer.observe(zone);
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (overlayOpen) setOverlayOpen(false);
        else openOverlay("search");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [overlayOpen, openOverlay, setOverlayOpen]);

  return (
    <>
      <Button
        onClick={() => openOverlay("ask")}
        className={cn(
          "fixed bottom-8 right-8 z-50 hidden h-10 items-center gap-2 rounded-lg px-4 shadow-lg lg:flex",
          "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
          // Fade/sink away when a dedicated ask surface is in view.
          dismissed && "pointer-events-none translate-y-3 scale-90 opacity-0",
        )}
      >
        <IconMessageCircle className="size-4" aria-hidden />
        Ask Atlas
      </Button>

      <AskOverlay
        open={overlayOpen}
        onOpenChange={setOverlayOpen}
        tab={overlayTab}
        onTabChange={setOverlayTab}
      />
    </>
  );
}
