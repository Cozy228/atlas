import {
  IconAlertHexagon,
  IconAlertTriangle,
  IconBan,
  IconHelpHexagon,
  IconLockSquareRoundedFilled,
  IconShieldX,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import type { Warning } from "@atlas/schema";

type WarningCategory = "critical" | "warning" | "info";

const WARNING_META: Record<
  Warning["code"],
  { label: string; category: WarningCategory; icon: typeof IconAlertTriangle }
> = {
  source_unavailable: {
    label: "Source unavailable",
    category: "critical",
    icon: IconBan,
  },
  broken_anchor: {
    label: "Broken anchor",
    category: "critical",
    icon: IconShieldX,
  },
  authority_conflict: {
    label: "Authority conflict",
    category: "warning",
    icon: IconAlertHexagon,
  },
  restricted_source: {
    label: "Restricted source",
    category: "warning",
    icon: IconLockSquareRoundedFilled,
  },
  stale_source: {
    label: "Stale source",
    category: "warning",
    icon: IconAlertTriangle,
  },
  weak_anchoring: {
    label: "Weak anchoring",
    category: "warning",
    icon: IconAlertTriangle,
  },
  no_registered_source: {
    label: "No registered source",
    category: "info",
    icon: IconHelpHexagon,
  },
};

const CATEGORY_CLASS: Record<WarningCategory, string> = {
  critical: "bg-critical/10 text-critical [&_svg]:text-critical",
  warning: "bg-warning/15 text-warning-foreground [&_svg]:text-warning",
  info: "bg-info/10 text-info [&_svg]:text-info",
};

export function WarningStack({
  warnings,
  className,
}: {
  warnings: ReadonlyArray<Warning>;
  className?: string;
}) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <ul className={cn("flex flex-col gap-2", className)} aria-label="Warnings">
      {warnings.map((warning, index) => {
        const meta = WARNING_META[warning.code];
        const Icon = meta.icon;
        return (
          <li
            key={`${warning.code}-${warning.source_id ?? "global"}-${warning.anchor_id ?? index}`}
            className={cn(
              "flex items-start gap-3 rounded-md border border-border px-3 py-2",
              CATEGORY_CLASS[meta.category],
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                {meta.label}
                {warning.source_id ? (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {warning.source_id}
                    {warning.anchor_id ? `#${warning.anchor_id}` : ""}
                  </span>
                ) : null}
              </p>
              <p className="text-sm leading-5 text-muted-foreground">
                {warning.message}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
