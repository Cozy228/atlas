import { cn } from "@/lib/utils";

type CatalogHighlightsProps = {
  serviceCount: number;
  regionCount: number;
  regionLabel: string;
};

export function CatalogHighlights({
  serviceCount,
  regionCount,
  regionLabel,
}: CatalogHighlightsProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[2fr_1fr]">
      <Block
        stat={serviceCount}
        title="Services in the catalog"
        description="Across compute, storage, database, AI, analytics, integration, and migration domains."
      />
      <Block
        stat={regionCount}
        title="Regions and outposts"
        description={regionLabel}
      />
    </div>
  );
}

function Block({
  stat,
  title,
  description,
}: {
  stat: number;
  title: string;
  description: string;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow]",
        "hover:border-border-strong hover:shadow-sm",
      )}
    >
      <p
        className={cn(
          "mb-1 font-mono text-[28px] font-semibold tabular-nums tracking-[-0.04em] text-primary",
        )}
      >
        {stat}
      </p>
      <p className="text-[14px] font-bold tracking-[-0.01em] text-foreground">
        {title}
      </p>
      <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
        {description}
      </p>
    </article>
  );
}
