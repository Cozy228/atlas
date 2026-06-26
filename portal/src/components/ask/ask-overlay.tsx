/**
 * Ask Atlas in-place overlay (dialog).
 *
 * Asking never pulls you off the surface you're on. Like the mainline dialog it
 * carries both modes behind a Search / Ask toggle: Search is the fast catalog
 * jump (⌘K), Ask is the cited conversation. The overlay stays lean; the deeper
 * accountability content (grounding, behaviour rules, owning teams) lives on the
 * `/ask` reference page, reached from the Ask footer's "Owning teams" link.
 *
 * Data: the chat + search are the production components, not mocks.
 */
import { Suspense, lazy } from "react";
import { Link } from "@tanstack/react-router";
import { IconMessageCircle, IconSearch } from "@tabler/icons-react";

import { AskAtlasSearch } from "@/components/ask/ask-atlas-search";
import { ClientOnly } from "@/components/client-only";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

// Chat pulls in the markdown renderer + syntax highlighter; keep it out of the
// search-only path (⌘K) by loading it lazily when the Ask tab is shown.
const AskAtlasChat = lazy(() =>
  import("@/components/ask/ask-atlas-chat").then((m) => ({ default: m.AskAtlasChat })),
);

export type AskTab = "search" | "ask";

const SUGGESTIONS = [
  { category: "Service", prompt: "Which storage service should a multi-region workload use?" },
  { category: "Availability", prompt: "Is Bedrock available in the DR outpost?" },
  { category: "Governance", prompt: "What approvals does a GDC deployment need?" },
  { category: "Onboarding", prompt: "How do I onboard a new application to the platform?" },
] as const;

export function AskOverlay({
  open,
  onOpenChange,
  tab,
  onTabChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: AskTab;
  onTabChange: (tab: AskTab) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl",
          tab === "ask" ? "h-[min(640px,calc(100vh-6rem))]" : "max-h-[min(640px,calc(100vh-6rem))]",
        )}
      >
        <DialogTitle className="sr-only">Ask Atlas</DialogTitle>
        <DialogDescription className="sr-only">
          Search the Atlas catalog or ask a question with cited answers.
        </DialogDescription>

        <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3.5 pb-3">
          <span className="text-sm font-semibold text-foreground">Ask Atlas</span>
          <ToggleGroup
            type="single"
            value={tab}
            onValueChange={(value) => {
              if (value === "search" || value === "ask") onTabChange(value);
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

        {tab === "search" ? (
          <ClientOnly fallback={<TabSkeleton />}>
            <AskAtlasSearch onOpenChange={onOpenChange} onSwitchToAsk={() => onTabChange("ask")} />
          </ClientOnly>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-hidden border-t border-border">
              <ClientOnly fallback={<TabSkeleton />}>
                <Suspense fallback={<TabSkeleton />}>
                  <AskAtlasChat suggestions={SUGGESTIONS} className="h-full min-h-0" />
                </Suspense>
              </ClientOnly>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-2.5">
              <span className="text-[12px] text-muted-foreground">Rather ask a person?</span>
              <Link
                to="/support"
                onClick={() => onOpenChange(false)}
                className="shrink-0 text-[12px] font-semibold text-brand-ink hover:underline"
              >
                Owning teams →
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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
