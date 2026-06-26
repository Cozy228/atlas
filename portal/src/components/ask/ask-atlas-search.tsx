import { useDeferredValue, useMemo, useState } from "react";
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
  IconMapPin,
  IconSearch,
} from "@tabler/icons-react";
import Fuse from "fuse.js";

import { sourceDiscoveryQueryOptions, topicDiscoveryQueryOptions } from "@/api/queries";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type AskAtlasSearchProps = {
  onOpenChange: (open: boolean) => void;
  onSwitchToAsk: () => void;
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
    description: "Atlas Portal dashboard",
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

const TOPIC_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  service: IconLayoutGrid,
  "landing-zone": IconMapPin,
};

function topicIcon(type: string) {
  return TOPIC_ICON_MAP[type] ?? IconLayoutGrid;
}

export function getNextSearchIndex(current: number, itemCount: number, direction: SearchDirection) {
  if (itemCount === 0) return 0;
  return direction === "next" ? (current + 1) % itemCount : (current - 1 + itemCount) % itemCount;
}

export function AskAtlasSearch({ onOpenChange, onSwitchToAsk }: AskAtlasSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  // Keep typing responsive on slow machines: the input updates instantly while
  // the fuzzy search over the full result set runs against the deferred value.
  const deferredQuery = useDeferredValue(query);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: topicsData, isLoading: topicsLoading } = useQuery({
    ...topicDiscoveryQueryOptions,
    placeholderData: keepPreviousData,
  });

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    ...sourceDiscoveryQueryOptions,
    placeholderData: keepPreviousData,
  });

  const allResults = useMemo<ReadonlyArray<SearchResult>>(() => {
    const dynamic: SearchResult[] = [];

    if (topicsData) {
      for (const topic of topicsData.topics) {
        dynamic.push({
          id: `topic:${topic.id}`,
          label: topic.name,
          description: `${topic.topic_type} · ${topic.category}`,
          to: `/catalog/${topic.id}`,
          icon: topicIcon(topic.topic_type),
          category:
            topic.topic_type === "landing-zone"
              ? "Landing Zones"
              : topic.topic_type === "security-policy"
                ? "Security policies"
                : "Services",
        });
      }
    }

    if (sourcesData) {
      for (const source of sourcesData.sources) {
        dynamic.push({
          id: `source:${source.id}`,
          label: source.title,
          description: `source · ${source.steward}`,
          to: `/sources/${source.id}`,
          icon: IconDatabase,
          category: "Sources",
        });
      }
    }

    return [...STATIC_NAV, ...dynamic];
  }, [topicsData, sourcesData]);

  const fuse = useMemo(
    () =>
      new Fuse(allResults as SearchResult[], {
        keys: ["label", "description", "category"],
        threshold: 0.35,
        ignoreLocation: true,
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

  const flatItems = items;
  const isLoading = topicsLoading || sourcesLoading;

  function go(to: string) {
    onOpenChange(false);
    void navigate({ to });
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((i) => getNextSearchIndex(i, flatItems.length, "next"));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((i) => getNextSearchIndex(i, flatItems.length, "previous"));
    } else if (event.key === "Enter" && flatItems.length > 0) {
      event.preventDefault();
      go((flatItems[selectedIndex] ?? flatItems[0]).to);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-border px-5 pb-4">
        <label className="flex h-12 w-full items-center gap-3">
          <IconSearch className="size-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            type="search"
            placeholder="Search for anything…"
            aria-label="Search Atlas catalog"
            className="h-full flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          {isLoading ? <Spinner className="size-4 text-muted-foreground" /> : null}
        </label>
      </div>

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

      <div className="max-h-80 overflow-y-auto p-2">
        {grouped.map(([category, groupItems]) => (
          <SearchGroup key={category} label={category}>
            {groupItems.map((result) => {
              const globalIndex = flatItems.indexOf(result);
              return (
                <SearchItem
                  key={result.id}
                  result={result}
                  selected={globalIndex === selectedIndex}
                  onSelect={() => go(result.to)}
                  onHover={() => setSelectedIndex(globalIndex)}
                />
              );
            })}
          </SearchGroup>
        ))}
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
    <div>
      <div className="px-3 py-1.5">
        <span className="font-mono type-caption font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function SearchItem({
  result,
  selected,
  onSelect,
  onHover,
}: {
  result: SearchResult;
  selected: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const Icon = result.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      data-selected={selected || undefined}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
        "data-selected:bg-accent",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{result.label}</span>
        <span className="truncate text-xs text-muted-foreground">{result.description}</span>
      </span>
      <IconArrowRight
        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-data-selected:opacity-100"
        aria-hidden
      />
    </button>
  );
}
