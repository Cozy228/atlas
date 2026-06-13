/**
 * PROTOTYPE (production candidate) — Skills redesign · route `/proto/skills`
 * ==========================================================================
 * Round 2, un-anchored from the round-1 "package index". Researched against
 * VS Code Marketplace, Raycast, npm/crates.io, GitHub Marketplace; three
 * directions behind `?variant=` (see `prototype/NOTES.md`):
 *
 *   - `shelf`    (default) — "Tool shelf": stage rail + marketplace rows +
 *     a real detail page per skill (`/proto/skills/$skillId`).
 *   - `manpage`  — "Man pages": filterable, stage-grouped master index +
 *     manual-page reading pane (NAME / SYNOPSIS / DESCRIPTION / HISTORY),
 *     selection via `?skill=`.
 *
 * Data: the extended public-safe registry in `lib/skills.ts` (stage,
 * maintainer, what-it-does, changelog). Freshness = version + updated date;
 * no invented install counts (ship-state honesty).
 */
import { createFileRoute } from "@tanstack/react-router";

import { SkillsManpage } from "@/components/proto/skills/manpage";
import { SkillsShelf } from "@/components/proto/skills/shelf";
import { SCALE_SKILLS as SKILLS } from "@/components/proto/skills/scale";
import { VariantBar, type ProtoVariant } from "@/components/proto/variant-bar";

const SKILLS_VARIANTS = [
  {
    id: "manpage",
    label: "Man pages",
    summary: "Filterable apropos index + a manual-page reading pane per skill.",
  },
  {
    id: "shelf",
    label: "Tool shelf",
    summary: "Stage rail + marketplace rows; every skill gets a real detail page.",
  },
] as const satisfies ReadonlyArray<ProtoVariant>;

type SkillsVariant = (typeof SKILLS_VARIANTS)[number]["id"];

function isSkillsVariant(value: unknown): value is SkillsVariant {
  return SKILLS_VARIANTS.some((variant) => variant.id === value);
}

type SkillsSearch = { variant?: SkillsVariant; skill?: string };

export const Route = createFileRoute("/proto/skills")({
  validateSearch: (search: Record<string, unknown>): SkillsSearch => ({
    variant: isSkillsVariant(search.variant) ? search.variant : undefined,
    skill:
      typeof search.skill === "string" && SKILLS.some((entry) => entry.id === search.skill)
        ? search.skill
        : undefined,
  }),
  component: ProtoSkills,
});

function ProtoSkills() {
  const { variant, skill } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active: SkillsVariant = variant ?? "manpage";

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <VariantBar
        variants={SKILLS_VARIANTS}
        active={active}
        onSelect={(id) => void navigate({ search: { variant: id }, replace: true })}
      />
      {active === "shelf" ? <SkillsShelf /> : null}
      {active === "manpage" ? <SkillsManpage selectedId={skill ?? SKILLS[0]!.id} /> : null}
    </div>
  );
}
