import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionEyebrowProps = {
  eyebrow: string;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function SectionEyebrow({ eyebrow, title, description, className }: SectionEyebrowProps) {
  return (
    <header className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {eyebrow}
      </span>
      {title ? (
        <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">{title}</h2>
      ) : null}
      {description ? (
        <p className="max-w-[52ch] text-[14px] leading-6 text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}
