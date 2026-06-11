import { lazy, Suspense, useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { IconMessageCircle, IconSearch } from "@tabler/icons-react";

import { useAskAtlas } from "@/components/ask-atlas/context";
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
  const { open, activeTab, openAsk, openSearch, setOpen, setActiveTab } =
    useAskAtlas();
  const navigate = useNavigate();
  // On the prototype suite, the FAB opens the full-page `/proto/ask` reading
  // room instead of the mainline dialog; everywhere else it keeps the dialog.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isProto = pathname.startsWith("/proto");
  const onAsk = () => {
    if (isProto) void navigate({ to: "/proto/ask" });
    else openAsk();
  };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          openSearch();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, openSearch, setOpen]);

  return (
    <>
      {pathname === "/proto/ask" ? null : (
        <Button
          onClick={onAsk}
          className="fixed bottom-8 right-8 z-50 hidden h-10 items-center gap-2 rounded-lg px-4 shadow-lg lg:flex"
        >
          <IconMessageCircle className="size-4" aria-hidden />
          Ask Atlas
        </Button>
      )}

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
