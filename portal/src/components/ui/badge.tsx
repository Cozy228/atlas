import type { ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-muted-foreground",
        // Semantic chips: hairline border + -ink text, transparent fill (DESIGN.md §4).
        brand: "border-brand/45 bg-transparent text-brand-ink",
        success: "border-success/45 bg-transparent text-success-ink",
        warning: "border-warning/50 bg-transparent text-warning-ink",
        critical: "border-critical/45 bg-transparent text-critical-ink",
        info: "border-info/45 bg-transparent text-info-ink",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = ComponentPropsWithoutRef<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} data-slot="badge" {...props} />
  );
}

export { badgeVariants };
