import { Suspense, lazy, useEffect, useState } from "react";

import { useAskAtlas } from "@/components/ask-atlas/context";

// Defer the overlay (and its search deps) out of the first-screen bundle — it
// loads on first open, not on every page view.
const AskOverlay = lazy(() =>
  import("@/components/ask/ask-overlay").then((m) => ({ default: m.AskOverlay })),
);

/**
 * Global search overlay host. There is no visible floating button — the overlay
 * is opened by ⌘K, the top-nav search icon, or the home search field. This
 * component just owns the keyboard shortcut and lazy-mounts the overlay.
 */
export function AskAtlasFab() {
  const { overlayOpen, openOverlay, setOverlayOpen } = useAskAtlas();

  // Only mount (and fetch the chunk for) the overlay once it has been opened.
  const [hasOpened, setHasOpened] = useState(false);
  useEffect(() => {
    if (overlayOpen) setHasOpened(true);
  }, [overlayOpen]);

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

  if (!hasOpened) return null;
  return (
    <Suspense fallback={null}>
      <AskOverlay open={overlayOpen} onOpenChange={setOverlayOpen} />
    </Suspense>
  );
}
