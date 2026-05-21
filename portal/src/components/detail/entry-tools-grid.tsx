import { IconArrowUpRight, IconLink } from "@tabler/icons-react";
import type { EntryTool } from "@atlas/schema";

import { cn } from "@/lib/utils";

export function EntryToolsGrid({ tools }: { tools: ReadonlyArray<EntryTool> }) {
  if (tools.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-4 type-detail text-muted-foreground">
        No entry tools registered. Use feedback below if you expect Terraform modules, Harness
        pipelines, or onboarding forms here.
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {tools.map((tool) => (
        <li key={tool.url}>
          <EntryToolCard tool={tool} />
        </li>
      ))}
    </ul>
  );
}

function EntryToolCard({ tool }: { tool: EntryTool }) {
  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "group flex h-full flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3.5 transition-[border-color,box-shadow]",
        "hover:border-primary hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="type-detail font-bold tracking-[-0.01em] text-foreground">
          {tool.label}
        </span>
        <IconArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
        <IconLink className="size-3" aria-hidden />
        {safeHost(tool.url)}
      </span>
    </a>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
