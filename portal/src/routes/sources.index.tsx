import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowRight, IconSearch } from "@tabler/icons-react";
import type { Source } from "@atlas/schema";

import { fetchSourceDiscovery } from "@/api/server/contextApi";
import { DetailHeader } from "@/components/detail/detail-shell";
import {
  AuthorityBadge,
  FreshnessIndicator,
  SourceClassBadge,
  VisibilityBadge,
} from "@/components/evidence/badges";
import { PageBody } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import { compareByAuthority } from "@/lib/evidence";
import { cn } from "@/lib/utils";

type LoaderData = {
  sources: ReadonlyArray<Source>;
};

export const Route = createFileRoute("/sources/")({
  loader: async (): Promise<LoaderData> => {
    const response = await fetchSourceDiscovery();
    return { sources: response.sources };
  },
  component: SourcesListRoute,
});

function SourcesListRoute() {
  const { sources } = Route.useLoaderData();
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sources.filter(
          (source) =>
            source.title.toLowerCase().includes(q) ||
            source.steward.toLowerCase().includes(q) ||
            source.id.toLowerCase().includes(q) ||
            source.authority_scope.some((scope) => scope.toLowerCase().includes(q)),
        )
      : sources;
    return [...filtered].sort((a, b) => compareByAuthority(a, b) || a.title.localeCompare(b.title));
  }, [sources, query]);

  return (
    <PageBody width="comfortable">
      <DetailHeader
        eyebrow="Discovery"
        title="Sources"
        description="Authoritative source lookup. Authority, freshness, and restricted visibility are visible inline so consumers can verify evidence before citing."
        badges={
          <Badge variant="outline" className="font-mono text-[10px]">
            authority-ranked
          </Badge>
        }
      />

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Filter sources… title, steward, id, scope"
      />

      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-card">
          {sorted.map((source, index) => (
            <li key={source.id} className={cn(index > 0 && "border-t border-border")}>
              <SourceRow source={source} />
            </li>
          ))}
        </ul>
      )}
    </PageBody>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label
      className={cn(
        "flex h-9 w-full max-w-[420px] items-center gap-2 rounded-lg border border-input bg-card px-2.5 shadow-xs transition-[border-color,box-shadow]",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
      )}
    >
      <IconSearch className="size-3.5 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function SourceRow({ source }: { source: Source }) {
  return (
    <Link
      to="/sources/$sourceId"
      params={{ sourceId: source.id }}
      className={cn(
        "group grid grid-cols-1 gap-3 px-4 py-3 transition-colors lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_auto]",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-[13px] font-bold tracking-[-0.01em] text-foreground">
          {source.title}
          <span className="font-mono text-[10px] font-medium text-muted-foreground">
            {source.id}
          </span>
        </p>
        <p className="text-[11px] leading-5 text-muted-foreground">
          steward {source.steward} · scope {source.authority_scope.join(", ")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <AuthorityBadge level={source.authority_level} />
        <VisibilityBadge value={source.visibility} />
        <FreshnessIndicator source={source} />
        <SourceClassBadge value={source.source_class} />
      </div>
      <span className="flex items-center justify-end gap-1 self-end font-mono text-[11px] text-primary lg:self-center">
        Inspect
        <IconArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-6 text-[13px] text-muted-foreground">
      <p className="font-bold text-foreground">No registered sources.</p>
      <p className="mt-1 leading-6">
        The Context API returned an empty discovery response. Suggest a source from any detail page
        feedback form.
      </p>
    </div>
  );
}
