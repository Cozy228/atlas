/**
 * PROTOTYPE (production candidate) — shared vocabulary for the `/proto/sources`
 * directions: class labels, freshness + authority colour maps, and a freshness
 * lookup helper. All directions read the real source discovery projection.
 */
import type { Source } from "@atlas/schema";

import { classifyFreshness, type FreshnessState } from "@/lib/evidence";

export const CLASS_LABEL: Record<Source["source_class"], string> = {
  "terraform-module": "Terraform module",
  "confluence-page": "Confluence page",
  "policy-document": "Policy document",
};

export const FRESHNESS_META: Record<FreshnessState, { label: string; dot: string }> = {
  current: { label: "Current", dot: "bg-success" },
  "needs-review": { label: "Review due", dot: "bg-warning" },
  stale: { label: "Stale", dot: "bg-critical" },
};

export const AUTHORITY_BAR: Record<string, string> = {
  authoritative: "bg-primary",
  reference: "bg-info",
  example: "bg-muted-foreground/50",
  draft: "bg-warning",
  deprecated: "bg-critical",
};

export function freshnessMap(sources: ReadonlyArray<Source>): Map<string, FreshnessState> {
  const map = new Map<string, FreshnessState>();
  for (const source of sources) map.set(source.id, classifyFreshness(source));
  return map;
}

export function reviewedLabel(source: Source): string {
  return new Date(source.last_reviewed_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
