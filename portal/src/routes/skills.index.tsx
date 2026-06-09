import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IconCopy, IconDownload, IconExternalLink, IconPackage, IconTerminal2 } from "@tabler/icons-react";
import { toast } from "sonner";

import { PageBody, PageHeader } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SKILLS,
  skillInstallCommand,
  skillListCommand,
  type Skill,
} from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/skills/")({
  component: SkillsRoute,
});

function SkillsRoute() {
  // Selected skill drives the install dialog; closing clears it.
  const [selected, setSelected] = useState<Skill | null>(null);

  return (
    <PageBody width="comfortable" gap="compact">
      <PageHeader
        eyebrow="Skills"
        title="Skills registry"
        description="Installable automations that scaffold, validate, and roll out platform work. Open a skill to copy its install command."
      />

      <ul
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {SKILLS.map((skill) => (
          <li key={skill.id}>
            <SkillCard skill={skill} onOpen={() => setSelected(skill)} />
          </li>
        ))}
      </ul>

      <InstallDialog skill={selected} onClose={() => setSelected(null)} />
    </PageBody>
  );
}

const CARD_BASE = cn(
  "group relative flex h-full w-full flex-col gap-2.5 rounded-sm border border-border bg-card p-4 text-left transition-[border-color,box-shadow]",
  "hover:border-border-strong hover:shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

function SkillCard({ skill, onOpen }: { skill: Skill; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={CARD_BASE}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-tint text-primary"
        >
          <IconPackage className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em] text-foreground">
            {skill.name}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">v{skill.version}</p>
        </div>
        {/* Decorative "installable" affordance, not an action button. */}
        <IconDownload
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        />
      </div>

      <p className="line-clamp-2 min-h-[2.5rem] text-[13px] leading-[1.5] text-muted-foreground">
        {skill.description}
      </p>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {skill.tags.map((tag) => (
          <Badge key={tag} variant="neutral" className="font-mono text-[11px]">
            {tag}
          </Badge>
        ))}
      </div>
    </button>
  );
}

function InstallDialog({ skill, onClose }: { skill: Skill | null; onClose: () => void }) {
  return (
    <Dialog open={skill !== null} onOpenChange={(open) => !open && onClose()}>
      {skill ? (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{skill.name}</DialogTitle>
            <DialogDescription>{skill.description}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <CommandBlock label="Install" command={skillInstallCommand(skill.id)} />
            <CommandBlock label="List installed" command={skillListCommand()} />
          </div>

          <div className="flex flex-wrap gap-4 border-t border-border pt-3">
            <DocLink label="Documentation" />
            <DocLink label="Browse registry" />
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function CommandBlock({ label, command }: { label: string; command: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy — copy it manually");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
        <IconTerminal2 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <code className="min-w-0 flex-1 break-words font-mono text-[12.5px] leading-[1.5] text-foreground">
          {command}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label.toLowerCase()} command`}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
            "transition-colors hover:bg-secondary hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <IconCopy className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

// Placeholder external link — wire to a real destination when available.
function DocLink({ label }: { label: string }) {
  return (
    <a
      href="#"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm font-mono text-[12px] font-semibold text-primary",
        "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {label}
      <IconExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}
