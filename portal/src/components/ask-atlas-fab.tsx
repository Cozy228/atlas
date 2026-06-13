import { lazy, Suspense, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { IconMessageCircle, IconSearch } from "@tabler/icons-react";

import { useAskAtlas } from "@/components/ask-atlas/context";
import { ProtoAskOverlay } from "@/components/proto/ask/ask-overlay";
import { ClientOnly } from "@/components/client-only";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const AskAtlasChat = lazy(() =>
  import("@/components/ask/ask-atlas-chat").then((mod) => ({
    default: mod.AskAtlasChat,
  })),
);

const AskAtlasSearch = lazy(() =>
  import("@/components/ask/ask-atlas-search").then((mod) => ({
    default: mod.AskAtlasSearch,
  })),
);

export function AskAtlasFab() {
  const {
    open,
    activeTab,
    openAsk,
    openSearch,
    setOpen,
    setActiveTab,
    protoOpen,
    protoTab,
    openProto,
    setProtoOpen,
    setProtoTab,
  } = useAskAtlas();
  // On the prototype suite, Ask/Search open the redesigned in-place overlay
  // (Search ⇄ Ask toggle); everywhere else they open the mainline dialog. Either
  // way it's an overlay over the current surface — never a separate page.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isProto = pathname.startsWith("/proto");
  const onAsk = () => {
    if (isProto) {
      openProto("ask");
    } else {
      openAsk();
    }
  };

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
        if (isProto) {
          if (protoOpen) {
            setProtoOpen(false);
          } else {
            openProto("search");
          }
        } else if (open) {
          setOpen(false);
        } else {
          openSearch();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, openSearch, setOpen, isProto, protoOpen, openProto, setProtoOpen]);

  return (
    <>
      <Button
        onClick={onAsk}
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

      <ProtoAskOverlay
        open={protoOpen}
        onOpenChange={setProtoOpen}
        tab={protoTab}
        onTabChange={setProtoTab}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            "w-full max-w-3xl sm:max-w-3xl",
            activeTab === "ask"
              ? "h-[min(640px,calc(100vh-6rem))]"
              : "max-h-[min(640px,calc(100vh-6rem))]",
          )}
        >
          <DialogTitle className="sr-only">Ask Atlas</DialogTitle>
          <DialogDescription className="sr-only">
            Search the Atlas catalog or ask a question with cited answers.
          </DialogDescription>

          <header className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3">
            <span className="text-sm font-semibold text-foreground">
              Ask Atlas
            </span>
            <ToggleGroup
              type="single"
              value={activeTab}
              onValueChange={(value) => {
                if (value === "search" || value === "ask") setActiveTab(value);
              }}
              size="sm"
              spacing={1}
              className="gap-0.5 rounded-lg bg-muted p-0.5"
            >
              <ToggleGroupItem
                value="search"
                className="rounded-md border-0 bg-transparent text-xs font-medium aria-pressed:bg-background aria-pressed:shadow-sm"
              >
                <IconSearch className="size-3.5" data-icon="inline-start" />
                Search
              </ToggleGroupItem>
              <ToggleGroupItem
                value="ask"
                className="rounded-md border-0 bg-transparent text-xs font-medium aria-pressed:bg-background aria-pressed:shadow-sm"
              >
                <IconMessageCircle className="size-3.5" data-icon="inline-start" />
                Ask Atlas
              </ToggleGroupItem>
            </ToggleGroup>
          </header>

          {activeTab === "search" ? (
            <ClientOnly fallback={<TabSkeleton />}>
              <Suspense fallback={<TabSkeleton />}>
                <AskAtlasSearch
                  onOpenChange={setOpen}
                  onSwitchToAsk={() => setActiveTab("ask")}
                />
              </Suspense>
            </ClientOnly>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden">
              <ClientOnly fallback={<TabSkeleton />}>
                <Suspense fallback={<TabSkeleton />}>
                  <AskAtlasChat className="h-full min-h-0" />
                </Suspense>
              </ClientOnly>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-32 w-3/4 rounded-lg" />
      <Skeleton className="h-10 w-1/2 rounded-lg" />
    </div>
  );
}
