/**
 * shared vocabulary for the `/sources`
 * directions: class labels, freshness + authority colour maps, and a freshness
 * lookup helper. All directions read the real source discovery projection.
 */
import type { Source } from "@atlas/schema";

import { classifyFreshness, type FreshnessState } from "@/lib/evidence";

export const CLASS_LABEL: Record<Source["source_class"], string> = {
  "terraform-module": "Terraform module",
  "confluence-page": "Confluence page",
  "policy-document": "Policy document",
  "availability-matrix": "Availability matrix",
};

/**
 * Where the content comes from — the source of record per `source_class`. Shown
 * instead of a "demo" tag so a reader (human or agent) sees the provenance of
 * the context. Phrased "From <system>", not "Live from", because live
 * resolution is off by default; the live prefix is reserved for content that
 * was actually fetched at request time.
 */
export const SOURCE_PROVENANCE: Record<Source["source_class"], string> = {
  "terraform-module": "From Terraform README",
  "confluence-page": "From Confluence",
  "policy-document": "From policy doc",
  "availability-matrix": "From availability matrix",
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

/** Page title block for the source registry surface. */
export function Header({ sources }: { sources: ReadonlyArray<Source> }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="w-fit text-2xl font-bold tracking-[-0.02em] text-foreground">
        Source registry
      </h1>
      <p className="w-fit max-w-[66ch] text-[13.5px] leading-[1.55] text-muted-foreground">
        Every claim in Atlas resolves to one of these {sources.length} registered documents.
        Authority and freshness are computed live from the registry, not asserted.
      </p>
    </header>
  );
}
