import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Ship-state honesty (DESIGN.md #6): one shared chip marking a surface or value
 * that renders fictional seed / demo data rather than a live feed. Every demo
 * surface says so the same way — reuse this instead of hand-rolling a label.
 */
export function SeedBadge({
  label = "demo data",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Badge variant="brand" className={cn("font-mono type-caption", className)}>
      {label}
    </Badge>
  );
}
