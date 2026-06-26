/**
 * Skills · route `/skills`
 * ========================
 * "Man pages": a filterable, stage-grouped master index (friendly name + id)
 * beside a manual-page reading pane (NAME / SYNOPSIS / DESCRIPTION / HISTORY),
 * selection via `?skill=`.
 *
 * Data: the curated public-safe registry in `lib/skills.ts` (stage, maintainer,
 * what-it-does, changelog). Freshness = version + updated date; no invented
 * install counts (ship-state honesty).
 */
import { createFileRoute } from "@tanstack/react-router";

import { SkillsManpage } from "@/components/skills/manpage";
import { SKILLS } from "@/lib/skills";

type SkillsSearch = { skill?: string };

export const Route = createFileRoute("/skills/")({
  validateSearch: (search: Record<string, unknown>): SkillsSearch => ({
    skill:
      typeof search.skill === "string" && SKILLS.some((entry) => entry.id === search.skill)
        ? search.skill
        : undefined,
  }),
  component: SkillsIndex,
});

function SkillsIndex() {
  const { skill } = Route.useSearch();

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <SkillsManpage selectedId={skill ?? SKILLS[0]!.id} />
    </div>
  );
}
