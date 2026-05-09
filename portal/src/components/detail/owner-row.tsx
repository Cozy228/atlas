import { IconUsers } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

export function OwnerRow({
  team,
  channel,
  className,
}: {
  team: string;
  channel: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1",
        className,
      )}
    >
      <IconUsers
        aria-hidden
        className="size-3.5 text-muted-foreground"
      />
      <span className="text-[12px] font-semibold text-foreground">{team}</span>
      <span aria-hidden className="text-muted-foreground/50">
        ·
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {channel}
      </span>
    </span>
  );
}
