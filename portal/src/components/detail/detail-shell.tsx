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
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function DetailHeader({
  eyebrow,
  title,
  description,
  badges,
  meta,
  actions,
}: DetailHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {eyebrow}
          </span>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground sm:text-[28px]">
              {title}
            </h1>
            {badges ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {badges}
              </div>
            ) : null}
          </div>
          {description ? (
            <p className="max-w-[68ch] text-[14px] leading-[1.6] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
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
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          {eyebrow ? (
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {eyebrow}
            </span>
          ) : null}
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
            {title}
          </h2>
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
