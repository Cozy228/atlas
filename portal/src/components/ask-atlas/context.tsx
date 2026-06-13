import { createContext, use, useCallback, useMemo, useState } from "react";

type TabValue = "search" | "ask";

type AskAtlasContextValue = {
  open: boolean;
  activeTab: TabValue;
  openSearch: () => void;
  openAsk: () => void;
  setOpen: (open: boolean) => void;
  setActiveTab: (tab: TabValue) => void;
  // Prototype-suite in-place overlay (Search ⇄ Ask). Lifted here so both the
  // floating FAB and surfaces like the Home "just ask" band open the same one.
  protoOpen: boolean;
  protoTab: TabValue;
  openProto: (tab?: TabValue) => void;
  setProtoOpen: (open: boolean) => void;
  setProtoTab: (tab: TabValue) => void;
};

const AskAtlasContext = createContext<AskAtlasContextValue | null>(null);

export function AskAtlasProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("search");
  const [protoOpen, setProtoOpen] = useState(false);
  const [protoTab, setProtoTab] = useState<TabValue>("ask");

  const openSearch = useCallback(() => {
    setActiveTab("search");
    setOpen(true);
  }, []);

  const openAsk = useCallback(() => {
    setActiveTab("ask");
    setOpen(true);
  }, []);

  const openProto = useCallback((tab: TabValue = "ask") => {
    setProtoTab(tab);
    setProtoOpen(true);
  }, []);

  const value = useMemo<AskAtlasContextValue>(
    () => ({
      open,
      activeTab,
      openSearch,
      openAsk,
      setOpen,
      setActiveTab,
      protoOpen,
      protoTab,
      openProto,
      setProtoOpen,
      setProtoTab,
    }),
    [open, activeTab, openSearch, openAsk, protoOpen, protoTab, openProto],
  );

  return (
    <AskAtlasContext.Provider value={value}>
      {children}
    </AskAtlasContext.Provider>
  );
}

export function useAskAtlas() {
  const ctx = use(AskAtlasContext);
  if (!ctx) throw new Error("useAskAtlas must be used within AskAtlasProvider");
  return ctx;
}
