/**
 * Search / Ask in-place overlay (dialog).
 *
 * Searching never pulls you off the surface you're on: a fast catalog jump (⌘K)
 * over services, sources, and navigation. The conversational (AI) mode is built
 * but HIDDEN for now behind {@link SHOW_AI} — flip it to true to bring back the
 * Search ⇄ Ask toggle and the cited chat. The chat code path is intentionally
 * kept (not deleted) so re-enabling is a one-line change.
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

// Feature flag: the AI chat mode is hidden for now. The code below stays wired so
// turning this on restores the Search ⇄ Ask toggle and the cited conversation.
const SHOW_AI = false;

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
  tab = "search",
  onTabChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab?: AskTab;
  onTabChange?: (tab: AskTab) => void;
}) {
  // With AI hidden, the overlay is always search.
  const activeTab: AskTab = SHOW_AI ? tab : "search";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl",
          activeTab === "ask"
            ? "h-[min(640px,calc(100vh-6rem))]"
            : "max-h-[min(640px,calc(100vh-6rem))]",
        )}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search the catalog for services, sources, and pages.
        </DialogDescription>

        <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3.5 pb-3">
          <span className="text-sm font-semibold text-foreground">Search</span>
          {SHOW_AI ? (
            <ToggleGroup
              type="single"
              value={activeTab}
              onValueChange={(value) => {
                if (value === "search" || value === "ask") onTabChange?.(value);
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
                Ask
              </ToggleGroupItem>
            </ToggleGroup>
          ) : null}
        </header>

        {activeTab === "search" ? (
          <ClientOnly fallback={<TabSkeleton />}>
            <AskAtlasSearch
              onOpenChange={onOpenChange}
              onSwitchToAsk={SHOW_AI ? () => onTabChange?.("ask") : undefined}
            />
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
