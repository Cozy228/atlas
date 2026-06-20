import { createContext, use, useCallback, useMemo, useState } from "react";

type TabValue = "search" | "ask";

type AskAtlasContextValue = {
  // The in-place Ask overlay (Search ⇄ Ask). Lifted here so the floating FAB,
  // the top-bar search button, and surfaces like the Home "just ask" band all
  // open the same one. Asking is always an overlay over the current surface —
  // never a separate page.
  overlayOpen: boolean;
  overlayTab: TabValue;
  openOverlay: (tab?: TabValue) => void;
  setOverlayOpen: (open: boolean) => void;
  setOverlayTab: (tab: TabValue) => void;
};

const AskAtlasContext = createContext<AskAtlasContextValue | null>(null);

export function AskAtlasProvider({ children }: { children: React.ReactNode }) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayTab, setOverlayTab] = useState<TabValue>("ask");

  const openOverlay = useCallback((tab: TabValue = "ask") => {
    setOverlayTab(tab);
    setOverlayOpen(true);
  }, []);

  const value = useMemo<AskAtlasContextValue>(
    () => ({
      overlayOpen,
      overlayTab,
      openOverlay,
      setOverlayOpen,
      setOverlayTab,
    }),
    [overlayOpen, overlayTab, openOverlay],
  );

  return <AskAtlasContext.Provider value={value}>{children}</AskAtlasContext.Provider>;
}

export function useAskAtlas() {
  const ctx = use(AskAtlasContext);
  if (!ctx) throw new Error("useAskAtlas must be used within AskAtlasProvider");
  return ctx;
}
