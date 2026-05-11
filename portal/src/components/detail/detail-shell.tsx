import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowLeft } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type BackLinkProps = {
  to: "/capabilities" | "/landing-zones" | "/sources" | "/explore" | "/";
  label: string;
};

export function BackLink({ to, label }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
      )}
    >
      <IconArrowLeft className="size-3.5" aria-hidden /> {label}
    </Link>
  );
}

type DetailHeaderProps = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  leading?: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function DetailHeader({
  eyebrow,
  title,
  description,
  leading,
  badges,
  meta,
  actions,
}: DetailHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          {leading ? <div className="mt-6 shrink-0">{leading}</div> : null}
          <div className="flex min-w-0 flex-col gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {eyebrow}
            </span>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-[28px] font-bold tracking-[-0.03em] text-foreground sm:text-[32px]">
                {title}
              </h1>
              {badges ? (
                <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
              ) : null}
            </div>
            {description ? (
              <p className="max-w-[68ch] text-[14px] leading-[1.6] text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
          {meta}
        </div>
      ) : null}
    </header>
  );
}

type DetailSectionProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DetailSection({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: DetailSectionProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          {eyebrow ? (
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {eyebrow}
            </span>
          ) : null}
          <h2 className="text-base font-bold tracking-[-0.02em] text-foreground">{title}</h2>
          {description ? (
            <p className="max-w-[68ch] text-[13px] leading-[1.6] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

type DetailLayoutProps = {
  main: ReactNode;
  side: ReactNode;
};

export function DetailLayout({ main, side }: DetailLayoutProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">{main}</div>
      <aside className="flex flex-col gap-3 lg:sticky lg:top-[72px] lg:self-start">{side}</aside>
    </div>
  );
}

type DetailMetaItem = {
  label: string;
  value: ReactNode;
  mono?: boolean;
};

type DetailMetaCardProps = {
  items: ReadonlyArray<DetailMetaItem>;
  actions?: ReactNode;
};

export function DetailMetaCard({ items, actions }: DetailMetaCardProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <dl className="flex flex-col divide-y divide-border">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {item.label}
            </dt>
            <dd
              className={cn(
                "min-w-0 flex-1 truncate text-right text-[12px] font-semibold text-foreground",
                item.mono && "font-mono text-[11px]",
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {actions ? (
        <div className="flex flex-col gap-1.5 border-t border-border bg-background p-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
