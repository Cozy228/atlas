import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-border pb-6",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          {eyebrow ? (
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2 sm:self-end">{actions}</div>
        ) : null}
      </div>
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
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </h2>
          {description ? (
            <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">
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
};

const PAGE_WIDTHS: Record<NonNullable<PageBodyProps["width"]>, string> = {
  narrow: "max-w-[860px]",
  comfortable: "max-w-[1100px]",
  wide: "max-w-[1280px]",
};

export function PageBody({ children, className, width = "wide" }: PageBodyProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-12 px-6 pb-16 pt-12 sm:px-8",
        PAGE_WIDTHS[width],
        className,
      )}
    >
      {children}
    </div>
  );
}
