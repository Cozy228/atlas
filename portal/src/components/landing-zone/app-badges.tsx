import { IconShieldCheckFilled, IconShieldHalf } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import type { AppOrigin, MembershipSource } from "@atlas/schema";

/**
 * APP provenance badges (WS5, R4). Two ORTHOGONAL axes, never conflated:
 *
 *  - {@link AppMembershipBadge} reads `AppRecord.membershipSource` (axis 2) → the
 *    VERIFIED-vs-self-asserted badge. `entra` ⇒ membership is verified by an Entra claim;
 *    `none` ⇒ self-asserted (self-declared, unverified). This is NEVER `origin`.
 *  - {@link AppProvenanceBadge} reads `AppRecord.origin` (axis 3) → the CONTENT-provenance
 *    badge. `registry` ⇒ the record's content came from a real registry; `self-declared` ⇒
 *    the user declared it. An Entra claim never flips `origin` (decision 9), so a verified
 *    APP can still read `origin: "self-declared"`.
 */

const MEMBERSHIP: Record<
  MembershipSource,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  entra: { label: "verified", variant: "success" },
  none: { label: "self-asserted", variant: "neutral" },
};

export function AppMembershipBadge({
  membershipSource,
  className,
}: {
  membershipSource: MembershipSource;
  className?: string;
}) {
  const { label, variant } = MEMBERSHIP[membershipSource];
  const Icon = membershipSource === "entra" ? IconShieldCheckFilled : IconShieldHalf;
  return (
    <Badge variant={variant} className={className} data-membership={membershipSource}>
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

const PROVENANCE: Record<AppOrigin, string> = {
  registry: "registry",
  "self-declared": "self-declared",
};

export function AppProvenanceBadge({
  origin,
  className,
}: {
  origin: AppOrigin;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={className} data-origin={origin}>
      {PROVENANCE[origin]}
    </Badge>
  );
}
