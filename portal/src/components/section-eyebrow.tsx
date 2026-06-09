import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionEyebrowProps = {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function SectionEyebrow({ eyebrow, title, description, className }: SectionEyebrowProps) {
  return (
    <header className={cn("flex flex-col gap-1.5", className)}>
      {eyebrow ? (
        <span className="w-fit bg-background font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {eyebrow}
        </span>
      ) : null}
      {title ? (
        <h2 className="w-fit bg-background type-section font-semibold tracking-[-0.03em] text-foreground">
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className="w-fit max-w-[52ch] bg-background text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </header>
  );
}
