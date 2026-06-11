/**
 * PROTOTYPE (production candidate) — Source registry · route `/proto/sources`
 * ===========================================================================
 * Sources are Atlas's evidence backbone, so they get a first-class surface.
 * Three directions behind `?variant=` (see `prototype/NOTES.md`):
 *   - `ledger`  (default) — health band + numbered accession ledger, sortable
 *     by authority or freshness.
 *   - `board`   — stewardship triage: grouped by freshness, action-needed first.
 *   - `byclass` — browse by what the evidence is (Terraform / Confluence / Policy).
 *
 * Data: the real source discovery projection (no mocks).
 */
import { createFileRoute } from "@tanstack/react-router";
import type { SourceDiscoveryResponse } from "@atlas/schema";

import { sourceDiscoveryQueryOptions } from "@/api/queries";
import { SourcesBoard } from "@/components/proto/sources/board";
import { SourcesByClass } from "@/components/proto/sources/byclass";
import { SourcesLedger } from "@/components/proto/sources/ledger";
import { VariantBar, type ProtoVariant } from "@/components/proto/variant-bar";

const SOURCES_VARIANTS = [
  {
    id: "ledger",
    label: "Registry ledger",
    summary: "Health band + numbered accession ledger, sortable by authority or freshness.",
  },
  {
    id: "board",
    label: "Stewardship board",
    summary: "Triage grouped by freshness — what needs re-review, action-needed first.",
  },
  {
    id: "byclass",
    label: "By class",
    summary: "Browse by what the evidence is: Terraform, Confluence, Policy.",
  },
] as const satisfies ReadonlyArray<ProtoVariant>;

type SourcesVariant = (typeof SOURCES_VARIANTS)[number]["id"];

function isSourcesVariant(value: unknown): value is SourcesVariant {
  return SOURCES_VARIANTS.some((variant) => variant.id === value);
}

export const Route = createFileRoute("/proto/sources")({
  validateSearch: (search: Record<string, unknown>): { variant?: SourcesVariant } => ({
    variant: isSourcesVariant(search.variant) ? search.variant : undefined,
  }),
  loader: async ({ context }) => {
    const resp = (await context.queryClient.ensureQueryData(
      sourceDiscoveryQueryOptions,
    )) as SourceDiscoveryResponse;
    return { sources: resp.sources };
  },
  component: ProtoSources,
});

function ProtoSources() {
  const { sources } = Route.useLoaderData();
  const { variant } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active: SourcesVariant = variant ?? "ledger";

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-7 px-6 py-8 sm:px-8">
      <VariantBar
        variants={SOURCES_VARIANTS}
        active={active}
        onSelect={(id) => void navigate({ search: { variant: id }, replace: true })}
      />
      {active === "ledger" ? <SourcesLedger sources={sources} /> : null}
      {active === "board" ? <SourcesBoard sources={sources} /> : null}
      {active === "byclass" ? <SourcesByClass sources={sources} /> : null}
    </div>
  );
}
