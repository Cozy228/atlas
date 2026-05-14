import { useMemo, useState } from "react";
import {
  keepPreviousData,
  useQuery,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconBook,
  IconCompass,
  IconCornerDownLeft,
  IconDatabase,
  IconHome,
  IconLayoutGrid,
  IconMapPin,
  IconSearch,
} from "@tabler/icons-react";
import Fuse from "fuse.js";

import {
  sourceDiscoveryQueryOptions,
  topicDiscoveryQueryOptions,
} from "@/api/queries";
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

const TOPIC_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  capability: IconLayoutGrid,
  "landing-zone": IconMapPin,
};

function topicIcon(type: string) {
  return TOPIC_ICON_MAP[type] ?? IconLayoutGrid;
}

export function getNextSearchIndex(
  current: number,
  itemCount: number,
  direction: SearchDirection,
) {
  if (itemCount === 0) return 0;
  return direction === "next"
    ? (current + 1) % itemCount
    : (current - 1 + itemCount) % itemCount;
}

export function AskAtlasSearch({
  onOpenChange,
  onSwitchToAsk,
}: AskAtlasSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const topicsQuery = useQuery({
    ...topicDiscoveryQueryOptions,
    placeholderData: keepPreviousData,
  });

  const sourcesQuery = useQuery({
    ...sourceDiscoveryQueryOptions,
    placeholderData: keepPreviousData,
  });

  const allResults = useMemo<ReadonlyArray<SearchResult>>(() => {
    const dynamic: SearchResult[] = [];

    if (topicsQuery.data) {
      for (const topic of topicsQuery.data.topics) {
        const base =
          topic.topic_type === "landing-zone"
            ? "/guidance"
            : "/catalog";
        dynamic.push({
          id: `topic:${topic.id}`,
          label: topic.name,
          description: `${topic.topic_type} · ${topic.category}`,
          to: `${base}/${topic.id}`,
          icon: topicIcon(topic.topic_type),
          category:
            topic.topic_type === "landing-zone"
              ? "Landing Zones"
              : "Capabilities",
        });
      }
    }

    if (sourcesQuery.data) {
      for (const source of sourcesQuery.data.sources) {
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
  }, [topicsQuery.data, sourcesQuery.data]);

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
    const q = query.trim();
    if (q.length === 0) return STATIC_NAV;
    return fuse.search(q).map((r) => r.item);
  }, [query, fuse]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const item of filtered) {
      const list = map.get(item.category);
      if (list) list.push(item);
      else map.set(item.category, [item]);
    }
    return [...map.entries()];
  }, [filtered]);

  const flatItems = filtered;
  const isLoading =
    topicsQuery.isLoading || sourcesQuery.isLoading;

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
      go(flatItems[selectedIndex].to);
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
          {isLoading ? (
            <Spinner className="size-4 text-muted-foreground" />
          ) : null}
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
        {flatItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              No matches found
            </p>
            <p className="text-xs text-muted-foreground">
              Try a different search or start a conversation.
            </p>
          </div>
        ) : (
          grouped.map(([category, items]) => (
            <SearchGroup key={category} label={category}>
              {items.map((result) => {
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
          ))
        )}
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

function SearchGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
        <span className="truncate text-sm font-medium text-foreground">
          {result.label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {result.description}
        </span>
      </span>
      <IconArrowRight
        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-data-selected:opacity-100"
        aria-hidden
      />
    </button>
  );
}
