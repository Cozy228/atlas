import {
  IconClock,
  IconLockSquareRoundedFilled,
  IconRoute,
  IconShieldCheckFilled,
  IconShieldHalf,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { classifyFreshness, type FreshnessState } from "@/lib/evidence";
import type { Source, Visibility } from "@atlas/schema";

const VISIBILITY_VARIANT: Record<Visibility, React.ComponentProps<typeof Badge>["variant"]> = {
  internal: "neutral",
  restricted: "warning",
};

export function VisibilityBadge({ value }: { value: Visibility }) {
  const Icon = value === "restricted" ? IconShieldHalf : IconShieldCheckFilled;
  return (
    <Badge variant={VISIBILITY_VARIANT[value]}>
      <Icon className="size-3" aria-hidden />
      {value}
    </Badge>
  );
}

const FRESHNESS_VARIANT: Record<FreshnessState, React.ComponentProps<typeof Badge>["variant"]> = {
  current: "success",
  "needs-review": "warning",
  stale: "critical",
};

const FRESHNESS_LABEL: Record<FreshnessState, string> = {
  current: "current",
  "needs-review": "needs review",
  stale: "stale",
};

export function FreshnessIndicator({ source, now }: { source: Source; now?: Date }) {
  const state = classifyFreshness(source, now);
  return (
    <Badge variant={FRESHNESS_VARIANT[state]}>
      <IconClock className="size-3" aria-hidden />
      {FRESHNESS_LABEL[state]}
    </Badge>
  );
}

export function SourceClassBadge({ value }: { value: Source["source_class"] }) {
  return (
    <Badge variant="outline">
      <IconRoute className="size-3" aria-hidden />
      {value}
    </Badge>
  );
}

export function RestrictedSourceLockBadge() {
  return (
    <Badge variant="warning">
      <IconLockSquareRoundedFilled className="size-3" aria-hidden />
      restricted access
    </Badge>
  );
}
