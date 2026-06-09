import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  badge,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="flex flex-col gap-2">
        {eyebrow ? (
          <span className="w-fit bg-background font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {eyebrow}
          </span>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="w-fit bg-background type-heading-lg font-bold tracking-[-0.03em] text-balance text-foreground">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="w-fit max-w-[60ch] bg-background type-body leading-[1.6] text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:self-end">{actions}</div> : null}
    </header>
  );
}

type PageSectionProps = {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function PageSection({
  title,
  description,
  children,
  className,
  contentClassName,
}: PageSectionProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {title ? (
        <div className="flex flex-col gap-1">
          <h2 className="w-fit bg-background text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </h2>
          {description ? (
            <p className="w-fit max-w-[68ch] bg-background text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className={cn("flex flex-col", contentClassName)}>{children}</div>
    </section>
  );
}

type PageBodyProps = {
  children: ReactNode;
  className?: string;
  width?: "narrow" | "comfortable" | "wide";
  gap?: "compact" | "standard";
};

const PAGE_WIDTHS: Record<NonNullable<PageBodyProps["width"]>, string> = {
  // Canonical content column, shared across every page so widths stay consistent.
  narrow: "max-w-[960px]",
  comfortable: "max-w-[1200px]",
  wide: "max-w-[1360px]",
};

const PAGE_GAPS: Record<NonNullable<PageBodyProps["gap"]>, string> = {
  // Prototype section rhythm ~44px (DESIGN.md §5 "Section padding ~52px").
  compact: "gap-10",
  standard: "gap-11",
};

export function PageBody({ children, className, width = "wide", gap = "standard" }: PageBodyProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col px-6 pb-16 pt-12 sm:px-8",
        PAGE_WIDTHS[width],
        PAGE_GAPS[gap],
        className,
      )}
    >
      {children}
    </div>
  );
}
