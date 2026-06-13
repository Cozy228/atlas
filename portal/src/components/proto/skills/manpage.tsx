/**
 * PROTOTYPE (production candidate) — Skills direction "Man pages" (default).
 *
 * Left: a filterable index in apropos style — friendly name + a one-line gloss,
 * grouped by lifecycle stage so it stays navigable as the registry grows.
 * Right: the selected skill's manual page. The page leads with a single title
 * block (the name, its id/version/date, a one-line tagline) so the name appears
 * once, then SYNOPSIS / DESCRIPTION / HISTORY / SEE ALSO. Selection is `?skill=`.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconSearch } from "@tabler/icons-react";

import { SKILL_STAGES, type Skill, type SkillStage } from "@/lib/skills";
import { cn } from "@/lib/utils";

import { SCALE_SKILLS as SKILLS } from "./scale";
import { InstallBay } from "./shared";

export function SkillsManpage({ selectedId }: { selectedId: string }) {
  const selected = SKILLS.find((skill) => skill.id === selectedId) ?? SKILLS[0]!;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="w-fit bg-background text-2xl font-bold tracking-[-0.02em] text-foreground">
          Skills
        </h1>
        <p className="w-fit max-w-[64ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
          {SKILLS.length} installable automations, documented like manual pages. Pick one from the
          index; its page opens on the right.
        </p>
      </header>

      <div className="grid items-start gap-x-10 gap-y-6 lg:grid-cols-[264px_minmax(0,1fr)]">
        <MasterList selectedId={selected.id} />
        <ManualPage skill={selected} />
      </div>
    </div>
  );
}

function MasterList({ selectedId }: { selectedId: string }) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<SkillStage | "all">("all");

  const q = query.trim().toLowerCase();
  const searchHits = useMemo(
    () =>
      SKILLS.filter(
        (skill) =>
          q === "" ||
          [skill.id, skill.name, skill.description, ...skill.tags].join(" ").toLowerCase().includes(q),
      ),
    [q],
  );

  const groups = useMemo(
    () =>
      SKILL_STAGES.map((stage) => ({
        stage,
        items: searchHits.filter(
          (skill) => skill.stage === stage.id && (stageFilter === "all" || stageFilter === stage.id),
        ),
      })).filter((group) => group.items.length > 0),
    [searchHits, stageFilter],
  );

  const shown = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <nav aria-label="Skill index" className="flex flex-col gap-2.5 lg:sticky lg:top-[76px]">
      <label className="flex h-9 items-center gap-2 rounded-[4px] border border-border bg-card px-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
        <IconSearch aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          placeholder="Filter name, id, or tag"
          aria-label="Filter skills"
          className="h-full flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {shown}/{SKILLS.length}
        </span>
      </label>

      {/* Stage filter pills — narrow the index to one lifecycle stage */}
      <div className="flex flex-wrap gap-1">
        <StagePill active={stageFilter === "all"} onClick={() => setStageFilter("all")}>
          All
        </StagePill>
        {SKILL_STAGES.map((stage) => {
          const count = searchHits.filter((s) => s.stage === stage.id).length;
          if (count === 0) return null;
          return (
            <StagePill
              key={stage.id}
              active={stageFilter === stage.id}
              onClick={() => setStageFilter(stage.id)}
            >
              {stage.label}
            </StagePill>
          );
        })}
      </div>

      {/* Fixed-height scroll region so the index never outgrows the viewport */}
      <div className="flex flex-col gap-4 overflow-y-auto pr-0.5 lg:max-h-[calc(100dvh-188px)]">
        {groups.length === 0 ? (
          <p className="px-1 py-2 text-[12.5px] text-muted-foreground">No skill matches the filter.</p>
        ) : (
          groups.map((group) => (
            <section key={group.stage.id} className="flex flex-col gap-1">
              <h3 className="sticky top-0 bg-background px-1 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.stage.label}
              </h3>
              <ul className="flex flex-col">
                {group.items.map((skill) => {
                  const isSelected = skill.id === selectedId;
                  return (
                    <li key={skill.id}>
                      <Link
                        to="/proto/skills"
                        search={{ variant: "manpage", skill: skill.id }}
                        replace
                        aria-current={isSelected ? "page" : undefined}
                        className={cn(
                          "flex flex-col gap-0.5 rounded-[4px] px-2.5 py-1.5 transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected ? "bg-brand-tint/60" : "hover:bg-muted/60",
                        )}
                      >
                        <span
                          className={cn(
                            "text-[13px] font-semibold tracking-[-0.01em]",
                            isSelected ? "text-brand-ink" : "text-foreground",
                          )}
                        >
                          {skill.name}
                        </span>
                        <span className="truncate font-mono text-[10.5px] text-muted-foreground">
                          {skill.id}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </nav>
  );
}

function StagePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-[4px] px-2 py-0.5 text-[11.5px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-brand-tint/60 font-semibold text-brand-ink"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ManualPage({ skill }: { skill: Skill }) {
  return (
    <article className="flex min-w-0 flex-col gap-6 rounded-[4px] border border-border bg-card px-6 py-6 sm:px-8">
      {/* Title block: the name appears once, with its identifier and meta. */}
      <div className="flex flex-col gap-2 border-b border-border pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[1.375rem] font-bold tracking-[-0.02em] text-foreground">
            {skill.name}
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {skill.id} · v{skill.version} · {skill.updatedAt}
          </span>
        </div>
        <p className="max-w-[64ch] text-[13.5px] leading-[1.6] text-muted-foreground">
          {skill.description}
        </p>
      </div>

      <ManSection title="Synopsis">
        <InstallBay skill={skill} />
      </ManSection>

      <ManSection title="Description">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-[1.6] text-foreground/90 marker:text-muted-foreground">
          {skill.whatItDoes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </ManSection>

      <ManSection title="History">
        <ol className="flex flex-col gap-1">
          {skill.changelog.map((change) => (
            <li key={change.version} className="flex flex-wrap items-baseline gap-x-3 text-[12.5px]">
              <span className="w-14 shrink-0 font-mono text-[11px] font-semibold tabular-nums text-foreground">
                {change.version}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {change.date}
              </span>
              <span className="min-w-0 flex-1 text-muted-foreground">{change.note}</span>
            </li>
          ))}
        </ol>
      </ManSection>

      <ManSection title="See also">
        <p className="text-[12.5px] leading-[1.6] text-muted-foreground">
          Maintained by <span className="font-semibold text-foreground">{skill.maintainer}</span>.
          Tags: <span className="font-mono text-[11px]">{skill.tags.join(", ")}</span>. Related
          guidance lives in{" "}
          <Link to="/proto/guidance" className="font-semibold text-brand-ink hover:underline">
            the guidance hub
          </Link>
          .
        </p>
      </ManSection>
    </article>
  );
}

function ManSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
