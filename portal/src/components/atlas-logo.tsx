import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type AtlasLogoProps = ComponentPropsWithoutRef<"div"> & {
  /**
   * `mark` reserves the icon-only square slot used in the collapsed sidebar
   * and mobile shell. `wordmark` reserves the desktop horizontal slot.
   */
  variant?: "mark" | "wordmark";
};

/**
 * AtlasLogo holds the company logo slot. The real asset is provided by the
 * brand team. Until that asset is supplied we render a neutral, stable
 * placeholder that occupies the same dimensions described in
 * `docs/architecture/portal_frontend_design_plan.md` (32px mark height,
 * 160px x 32px wordmark area). Replace this component when the asset lands.
 */
export function AtlasLogo({
  variant = "wordmark",
  className,
  ...props
}: AtlasLogoProps) {
  const isMark = variant === "mark";
  return (
    <div
      role="img"
      aria-label="Company logo"
      data-slot="logo"
      data-variant={variant}
      className={cn(
        "flex shrink-0 items-center justify-start",
        isMark ? "size-8" : "h-8 w-40",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-8 items-center justify-center rounded-md border border-border bg-brand-tint font-mono text-[11px] font-semibold uppercase tracking-tight text-foreground",
        )}
      >
        Co
      </span>
      {!isMark && (
        <span
          aria-hidden
          className="ml-2 text-sm font-semibold tracking-tight text-foreground"
        >
          Atlas Portal
        </span>
      )}
    </div>
  );
}
