/**
 * PROTOTYPE (production candidate) — Skill detail · route
 * `/proto/skills/$skillId`
 * ========================================================
 * The detail half of the "Tool shelf" direction: a marketplace-style page
 * answering "what will this do to my project?" before the install. README-
 * dominant main column (what it does · changelog) with a sticky FACTS BAY
 * (install command block, version, updated, maintainer, stage, tags) — the
 * npm / crates.io sidebar register. The trailing-underscore filename keeps
 * this route un-nested from the index.
 */
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { IconArrowLeft } from "@tabler/icons-react";

import { getProtoSkill } from "@/components/proto/skills/scale";
import { CommandBlock, InstallBay } from "@/components/proto/skills/shared";
import { Badge } from "@/components/ui/badge";
import { SKILL_STAGES, skillRunCommand } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/proto/skills_/$skillId")({
  loader: ({ params }) => {
    const skill = getProtoSkill(params.skillId);
    if (!skill) throw notFound();
    return { skill };
  },
  component: ProtoSkillDetail,
});

function ProtoSkillDetail() {
  const { skill } = Route.useLoaderData();
  const stage = SKILL_STAGES.find((entry) => entry.id === skill.stage);

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-7 px-6 py-8 sm:px-8">
      <Link
        to="/proto/skills"
        search={{ variant: "shelf" }}
        className="inline-flex w-fit items-center gap-1.5 bg-background text-[13px] font-semibold text-muted-foreground hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconArrowLeft aria-hidden className="size-3.5" />
        All skills
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-background font-mono text-[11px] text-muted-foreground">
            {skill.id}
          </span>
          {stage ? <Badge variant="outline">{stage.label}</Badge> : null}
        </div>
        <h1 className="w-fit bg-background text-[1.75rem] font-bold leading-[1.15] tracking-[-0.025em] text-foreground">
          {skill.name}
        </h1>
        <p className="w-fit max-w-[64ch] bg-background text-[14px] leading-[1.6] text-muted-foreground">
          {skill.description}
        </p>
      </header>

      <div className="grid items-start gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="flex min-w-0 flex-col gap-8">
          <section className="flex flex-col gap-3">
            <SectionLabel>What it does</SectionLabel>
            <ol className="flex flex-col gap-2.5">
              {skill.whatItDoes.map((line, index) => (
                <li key={line} className="flex gap-3">
                  <span className="w-5 shrink-0 bg-background text-right font-mono text-[12px] font-semibold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="w-fit max-w-[60ch] bg-background text-[13.5px] leading-[1.6] text-foreground/90">
                    {line}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>Run it</SectionLabel>
            <CommandBlock command={skillRunCommand(skill.id)} />
            <p className="w-fit bg-background text-[12px] leading-[1.6] text-muted-foreground">
              Runs against the current workspace; nothing is changed without the plan step
              succeeding first.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>Changelog</SectionLabel>
            <ol className="overflow-hidden rounded-[4px] border border-border bg-card">
              {skill.changelog.map((change, i) => (
                <li
                  key={change.version}
                  className={cn(
                    "grid grid-cols-[64px_minmax(0,1fr)] items-baseline gap-x-4 px-4 py-2.5 sm:grid-cols-[64px_110px_minmax(0,1fr)]",
                    i > 0 && "border-t border-border",
                  )}
                >
                  <span className="font-mono text-[11.5px] font-semibold tabular-nums text-foreground">
                    {change.version}
                  </span>
                  <span className="hidden font-mono text-[11px] tabular-nums text-muted-foreground sm:block">
                    {change.date}
                  </span>
                  <span className="text-[12.5px] leading-[1.5] text-muted-foreground">
                    {change.note}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-[72px]">
          <InstallBay skill={skill} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-[4px] border border-border bg-card px-4 py-3.5 text-xs">
            <FactRow label="Version" value={`v${skill.version}`} mono />
            <FactRow label="Updated" value={skill.updatedAt} mono />
            <FactRow label="Maintainer" value={skill.maintainer} />
            <FactRow label="Stage" value={stage?.label ?? skill.stage} />
          </dl>
          <div className="flex flex-wrap gap-1.5">
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-[2px] border border-border px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="w-fit bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h2>
  );
}

function FactRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right font-semibold text-foreground",
          mono && "font-mono font-medium tabular-nums",
        )}
      >
        {value}
      </dd>
    </>
  );
}
