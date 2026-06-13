/**
 * PROTOTYPE (production candidate) — Skills direction "Tool shelf"
 * (marketplace register; pairs with the `/proto/skills/$skillId` detail).
 *
 * What VS Code Marketplace / Raycast actually do: a STAGE RAIL on the left
 * (categories as navigation, with counts), full-width ROWS as the listing
 * unit (name · version · maintainer · updated · description · tags), and a
 * DETAIL PAGE per skill answering "what does it do" before you install.
 * Freshness signals are version + updated date (honest fixture data — no
 * invented install counts).
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight, IconSearch, IconX } from "@tabler/icons-react";

import {
  SKILL_STAGES,
  skillInstallCommand,
  type Skill,
  type SkillStage,
} from "@/lib/skills";
import { cn } from "@/lib/utils";

import { SCALE_SKILLS as SKILLS } from "./scale";
import { InstallButton } from "./shared";

export function SkillsShelf() {
  const [stage, setStage] = useState<SkillStage | "all">("all");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      SKILLS.filter((skill) => {
        if (stage !== "all" && skill.stage !== stage) return false;
        if (!q) return true;
        return `${skill.name} ${skill.description} ${skill.maintainer} ${skill.tags.join(" ")}`
          .toLowerCase()
          .includes(q);
      }),
    [stage, q],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="w-fit bg-background text-2xl font-bold tracking-[-0.02em] text-foreground">
          Skills
        </h1>
        <p className="w-fit max-w-[64ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
          {SKILLS.length} installable automations that scaffold, validate, and roll out platform
          work. Open a skill to see exactly what it does before installing.
        </p>
      </header>

      <div className="grid items-start gap-x-10 gap-y-5 lg:grid-cols-[190px_minmax(0,1fr)]">
        <StageRail active={stage} onSelect={setStage} />
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[4px] border border-border bg-card px-3 py-2 focus-within:border-border-strong">
              <IconSearch aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, tag, or maintainer…"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <IconX aria-hidden className="size-3.5" />
                </button>
              ) : null}
            </label>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {visible.length} of {SKILLS.length}
            </span>
          </div>
          {visible.length === 0 ? (
            <p className="rounded-[4px] border border-dashed border-border bg-card px-5 py-8 text-center text-[13px] text-muted-foreground">
              No skills match. Clear the search or pick another stage.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {SKILL_STAGES.map((s) => {
                const items = visible.filter((skill) => skill.stage === s.id);
                if (items.length === 0) return null;
                return (
                  <section key={s.id} className="flex flex-col gap-2.5">
                    <div className="flex items-baseline gap-2.5 border-b-2 border-border-strong pb-2">
                      <h2 className="bg-background text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
                        {s.label}
                      </h2>
                      <span className="bg-background text-[12px] text-muted-foreground">
                        {s.description}
                      </span>
                      <span className="ml-auto bg-background font-mono text-[11px] tabular-nums text-muted-foreground">
                        {items.length}
                      </span>
                    </div>
                    <ul className="min-w-0 overflow-hidden rounded-[4px] border border-border bg-card">
                      {items.map((skill, i) => (
                        <li key={skill.id} className={cn(i > 0 && "border-t border-border")}>
                          <ShelfRow skill={skill} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StageRail({
  active,
  onSelect,
}: {
  active: SkillStage | "all";
  onSelect: (stage: SkillStage | "all") => void;
}) {
  return (
    <nav aria-label="Skill stages" className="lg:sticky lg:top-[76px]">
      <span className="mb-2.5 block w-fit bg-background font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Stage
      </span>
      <ul className="flex flex-row flex-wrap gap-1 lg:flex-col">
        <li>
          <RailItem
            label="All skills"
            count={SKILLS.length}
            active={active === "all"}
            onClick={() => onSelect("all")}
          />
        </li>
        {SKILL_STAGES.map((stage) => {
          const count = SKILLS.filter((skill) => skill.stage === stage.id).length;
          if (count === 0) return null;
          return (
            <li key={stage.id}>
              <RailItem
                label={stage.label}
                count={count}
                active={active === stage.id}
                onClick={() => onSelect(stage.id)}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function RailItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-baseline justify-between gap-3 rounded-[4px] px-2.5 py-1.5 text-left text-[13px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-brand-tint/50 font-semibold text-brand-ink"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      <span className="font-mono text-[10.5px] tabular-nums">{count}</span>
    </button>
  );
}

function ShelfRow({ skill }: { skill: Skill }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          to="/proto/skills/$skillId"
          params={{ skillId: skill.id }}
          className="group inline-flex w-fit items-center gap-1.5 text-[13.5px] font-bold tracking-[-0.01em] text-foreground hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {skill.name}
          <IconArrowRight
            aria-hidden
            className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
          />
        </Link>
        <span className="truncate text-[12.5px] text-muted-foreground">{skill.description}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden font-mono text-[10.5px] tabular-nums text-muted-foreground sm:inline">
          v{skill.version} · {skill.updatedAt}
        </span>
        <InstallButton command={skillInstallCommand(skill.id)} skillName={skill.name} />
      </div>
    </div>
  );
}
