/**
 * PROTOTYPE (production candidate) — Source registry · route `/proto/sources`
 * ===========================================================================
 * Sources are Atlas's evidence backbone. A single direction now: browse by
 * class — a two-level register (class → category) with search, facet filters,
 * and a switchable grouping axis. The flat "registry ledger" direction was
 * retired: one undifferentiated list does not survive dozens of sources.
 *
 * Data: the scale fixture (~54 fictional sources) so the grouping reads at
 * realistic volume.
 */
import { createFileRoute } from "@tanstack/react-router";

import { SourcesByClass } from "@/components/proto/sources/byclass";
import { SCALE_SOURCES } from "@/components/proto/sources/scale";

export const Route = createFileRoute("/proto/sources")({
  component: ProtoSources,
});

function ProtoSources() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-6 py-8 sm:px-8">
      <SourcesByClass sources={SCALE_SOURCES} />
    </div>
  );
}
