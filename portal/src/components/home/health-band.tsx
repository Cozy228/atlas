import { cn } from "@/lib/utils";

type HealthBandProps = {
  staleSourceCount: number;
  restrictedSourceCount: number;
  brokenAnchorCount: number;
};

export function HealthBand({
  staleSourceCount,
  restrictedSourceCount,
  brokenAnchorCount,
}: HealthBandProps) {
  const items: ReadonlyArray<{
    label: string;
    count: number;
    tone: "warn" | "ok" | "critical";
  }> = [
    {
      label: "stale sources",
      count: staleSourceCount,
      tone: staleSourceCount > 0 ? "warn" : "ok",
    },
    {
      label: "restricted sources",
      count: restrictedSourceCount,
      tone: restrictedSourceCount > 0 ? "warn" : "ok",
    },
    {
      label: "broken anchors",
      count: brokenAnchorCount,
      tone: brokenAnchorCount > 0 ? "critical" : "ok",
    },
  ];

  return (
    <div
      role="status"
      aria-label="Atlas guidance health"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-card px-4 py-3",
        "transition-colors",
      )}
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
        Health
      </span>
      <ul className="flex flex-1 flex-wrap items-center gap-x-3.5 gap-y-1">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted-foreground"
          >
            <span
              className={cn(
                "font-mono text-[12px] font-bold tabular-nums",
                item.tone === "warn" && "text-warning-foreground",
                item.tone === "critical" && "text-critical",
                item.tone === "ok" && "text-success",
              )}
            >
              {item.count}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
