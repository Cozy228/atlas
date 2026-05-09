import { createContext, useCallback, useContext, useMemo, useState } from "react";

type TabValue = "search" | "ask";

type AskAtlasContextValue = {
  open: boolean;
  activeTab: TabValue;
  openSearch: () => void;
  openAsk: () => void;
  setOpen: (open: boolean) => void;
  setActiveTab: (tab: TabValue) => void;
};

const AskAtlasContext = createContext<AskAtlasContextValue | null>(null);

export function AskAtlasProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("search");

  const openSearch = useCallback(() => {
    setActiveTab("search");
    setOpen(true);
  }, []);

  const openAsk = useCallback(() => {
    setActiveTab("ask");
    setOpen(true);
  }, []);

  const value = useMemo<AskAtlasContextValue>(
    () => ({ open, activeTab, openSearch, openAsk, setOpen, setActiveTab }),
    [open, activeTab, openSearch, openAsk],
  );

  return (
    <AskAtlasContext.Provider value={value}>
      {children}
    </AskAtlasContext.Provider>
  );
}

export function useAskAtlas() {
  const ctx = useContext(AskAtlasContext);
  if (!ctx) throw new Error("useAskAtlas must be used within AskAtlasProvider");
  return ctx;
}
