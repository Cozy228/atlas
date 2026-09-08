import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconBook,
  IconCompass,
  IconCornerDownLeft,
  IconDatabase,
  IconHome,
  IconLayoutGrid,
  IconLifebuoy,
  IconSearch,
} from "@tabler/icons-react";
import Fuse from "fuse.js";

import { resourceCatalogQueryOptions, sourceDiscoveryQueryOptions } from "@/api/queries";
import { CLASS_LABEL } from "@/components/sources/shared";
import { DialogClose } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type AskAtlasSearchProps = {
  onOpenChange: (open: boolean) => void;
  /** Optional bridge to the AI Ask mode. Omitted while AI is hidden (the bridge
   *  row then does not render); kept wired so re-enabling AI is one flag. */
  onSwitchToAsk?: () => void;
};

type SearchDirection = "next" | "previous";

type SearchResult = {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
};

const STATIC_NAV: ReadonlyArray<SearchResult> = [
  {
    id: "nav:home",
    label: "Home",
    description: "Cloud DevEx Portal dashboard",
    to: "/",
    icon: IconHome,
    category: "Navigate",
  },
  {
    id: "nav:explore",
    label: "Explore availability",
    description: "Regional availability map",
    to: "/availability",
    icon: IconCompass,
    category: "Navigate",
  },
  {
    id: "nav:sources",
    label: "Sources",
    description: "Authoritative source lookup",
    to: "/sources",
    icon: IconDatabase,
    category: "Navigate",
  },
];

/**
 * Shown when a query matches nothing — the same "reach a person" affordance the
 * Ask tab carries in its footer, rendered as a normal selectable result so ↵
 * routes to the Ask page instead of leaving a dead "no results" screen.
 */
const CONTACT_SUPPORT: SearchResult = {
  id: "contact-support",
  label: "Contact support",
  description: "Rather ask a person?",
  to: "/support",
  icon: IconLifebuoy,
  category: "Help",
};

const RESOURCE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  service: IconLayoutGrid,
};

function resourceIcon(kind: string) {
  return RESOURCE_ICON_MAP[kind] ?? IconLayoutGrid;
}

export function getNextSearchIndex(current: number, itemCount: number, direction: SearchDirection) {
  if (itemCount === 0) return 0;
  return direction === "next" ? (current + 1) % itemCount : (current - 1 + itemCount) % itemCount;
}

export function AskAtlasSearch({ onOpenChange, onSwitchToAsk }: AskAtlasSearchProps) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  // Keep typing responsive on slow machines: the input updates instantly while
  // the fuzzy search over the full result set runs against the deferred value.
  const deferredQuery = useDeferredValue(query);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const highlightLayoutId = `${baseId}-highlight`;

  function optionId(id: string) {
    return `${baseId}-option-${id}`;
  }

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    ...resourceCatalogQueryOptions,
    placeholderData: keepPreviousData,
  });

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    ...sourceDiscoveryQueryOptions,
    placeholderData: keepPreviousData,
  });

  const allResults = useMemo<ReadonlyArray<SearchResult>>(() => {
    const dynamic: SearchResult[] = [];

    if (catalogData) {
      for (const resource of catalogData.resources) {
        const isService = resource.kind === "service";
        dynamic.push({
          id: `resource:${resource.id}`,
          label: resource.name,
          description: resource.category
            ? `${resource.kind} · ${resource.category}`
            : resource.kind,
          to: isService ? `/service/${resource.slug}` : `/policies/${resource.slug}`,
          icon: resourceIcon(resource.kind),
          category: isService ? "Services" : "Security policies",
        });
      }
    }

    if (sourcesData) {
      for (const source of sourcesData.sources) {
        dynamic.push({
          id: `source:${source.id}`,
          label: source.title,
          description: `source · ${CLASS_LABEL[source.source_class]}`,
          to: `/sources/${source.id}`,
          icon: IconDatabase,
          category: "Sources",
        });
      }
    }

    return [...STATIC_NAV, ...dynamic];
  }, [catalogData, sourcesData]);

  const fuse = useMemo(
    () =>
      new Fuse(allResults as SearchResult[], {
        keys: ["label", "description", "category"],
        // Lenient matching: catch typos and partial terms so a query is more
        // likely to surface something than to dead-end on "no results".
        threshold: 0.5,
        ignoreLocation: true,
        minMatchCharLength: 1,
      }),
    [allResults],
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim();
    if (q.length === 0) return STATIC_NAV;
    return fuse.search(q).map((r) => r.item);
  }, [deferredQuery, fuse]);

  // A typed query that matches nothing still offers one actionable item —
  // contact support — so ↵ goes somewhere useful instead of a dead end. (An empty
  // query shows STATIC_NAV, so this only fires on a real no-match.)
  const items = useMemo<ReadonlyArray<SearchResult>>(
    () => (deferredQuery.trim().length > 0 && filtered.length === 0 ? [CONTACT_SUPPORT] : filtered),
    [deferredQuery, filtered],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const item of items) {
      const list = map.get(item.category);
      if (list) list.push(item);
      else map.set(item.category, [item]);
    }
    return [...map.entries()];
  }, [items]);

  const flatItems = useMemo(() => grouped.flatMap(([, groupItems]) => groupItems), [grouped]);
  const isLoading = catalogLoading || sourcesLoading;

  const activeIndex = Math.min(selectedIndex, Math.max(flatItems.length - 1, 0));

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [flatItems, activeIndex]);

  const highlightMotionEnabled = !reduced;

  function go(to: string) {
    onOpenChange(false);
    void navigate({ to });
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((i) =>
        getNextSearchIndex(
          Math.min(i, Math.max(flatItems.length - 1, 0)),
          flatItems.length,
          "next",
        ),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((i) =>
        getNextSearchIndex(
          Math.min(i, Math.max(flatItems.length - 1, 0)),
          flatItems.length,
          "previous",
        ),
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setSelectedIndex(event.key === "Home" ? 0 : Math.max(0, flatItems.length - 1));
    } else if (event.key === "Enter" && flatItems.length > 0) {
      event.preventDefault();
      go((flatItems[activeIndex] ?? flatItems[0]).to);
    }
  }

  return (
    <div className="flex flex-col" onKeyDown={handleKeyDown}>
      <div className="border-b border-border px-4 py-2">
        <label className="flex h-12 w-full items-center gap-3">
          <IconSearch className="size-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
            type="search"
            placeholder="Search for anything…"
            aria-label="Search the catalog"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded="true"
            aria-activedescendant={
              flatItems[activeIndex] ? optionId(flatItems[activeIndex].id) : undefined
            }
            role="combobox"
            className="h-full flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          {isLoading ? <Spinner className="size-4 text-muted-foreground" /> : null}
          <DialogClose
            className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
            aria-label="Close search"
          >
            Esc
          </DialogClose>
        </label>
      </div>

      {/* Bridge to AI Ask mode — only when wired (hidden while AI is off). */}
      {onSwitchToAsk ? (
        <div className="border-b border-border">
          <button
            type="button"
            onClick={onSwitchToAsk}
            className={cn(
              "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors",
              "hover:bg-accent",
            )}
          >
            <IconBook className="size-5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium text-foreground">
              Ask about{query.trim() ? ` "${query.trim()}"` : ""}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Start conversation
              <IconCornerDownLeft className="size-3.5" />
            </span>
          </button>
        </div>
      ) : null}

      <p className="sr-only" role="status">
        {flatItems.length} search results
      </p>
      <div
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label="Search results"
        className="max-h-96 overflow-y-auto p-2"
      >
        <LayoutGroup id={`${baseId}-groups`}>
          {grouped.map(([category, groupItems]) => (
            <motion.div key={category} layout={highlightMotionEnabled ? "position" : false}>
              <SearchGroup label={category}>
                {groupItems.map((result) => {
                  const globalIndex = flatItems.indexOf(result);
                  return (
                    <SearchItem
                      key={result.id}
                      optionId={optionId(result.id)}
                      result={result}
                      selected={globalIndex === activeIndex}
                      highlightLayoutId={highlightLayoutId}
                      motionEnabled={highlightMotionEnabled}
                      onSelect={() => go(result.to)}
                      onHover={() => setSelectedIndex(globalIndex)}
                    />
                  );
                })}
              </SearchGroup>
            </motion.div>
          ))}
        </LayoutGroup>
      </div>

      <footer className="border-t border-border px-5 py-2.5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-background px-1 py-px font-mono type-caption">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-background px-1 py-px font-mono type-caption">
              ↵
            </kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-background px-1 py-px font-mono type-caption">
              esc
            </kbd>
            close
          </span>
          <span className="ml-auto">
            <kbd className="rounded border border-border bg-background px-1.5 py-px font-mono type-caption">
              ⌘K
            </kbd>
          </span>
        </div>
      </footer>
    </div>
  );
}

function SearchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

function SearchItem({
  optionId,
  result,
  selected,
  highlightLayoutId,
  motionEnabled,
  onSelect,
  onHover,
}: {
  optionId: string;
  result: SearchResult;
  selected: boolean;
  highlightLayoutId: string;
  motionEnabled: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const Icon = result.icon;
  return (
    <div
      id={optionId}
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      onMouseEnter={onHover}
      data-active={selected || undefined}
      data-selected={selected || undefined}
      className="group relative flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors"
    >
      {selected && motionEnabled ? (
        <motion.div
          layoutId={highlightLayoutId}
          transition={{ type: "spring", visualDuration: 0.18, bounce: 0.12 }}
          aria-hidden="true"
          className="absolute inset-0 rounded-sm bg-accent"
        />
      ) : selected ? (
        <div aria-hidden="true" className="absolute inset-0 rounded-sm bg-accent" />
      ) : null}
      <Icon className="relative z-10 size-4 shrink-0 text-muted-foreground" />
      <span className="relative z-10 flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{result.label}</span>
        <span className="truncate text-xs text-muted-foreground">{result.description}</span>
      </span>
      <IconArrowRight
        className="relative z-10 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-data-selected:opacity-100"
        aria-hidden
      />
    </div>
  );
}
