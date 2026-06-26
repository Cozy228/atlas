/**
 * shared pieces for the `/skills`
 * directions: clipboard copy with toast feedback, the copyable command block
 * (the registry's primary action, per VS Code / npm / crates.io practice),
 * and the compact install button for rows.
 */
import { useState } from "react";
import { IconCopy, IconTerminal2 } from "@tabler/icons-react";
import { toast } from "sonner";

import {
  SKILL_REQUIREMENTS,
  skillCiSnippet,
  skillInstallCommand,
  skillRunCommand,
  type Skill,
} from "@/lib/skills";
import { cn } from "@/lib/utils";

export async function copyCommand(command: string) {
  try {
    await navigator.clipboard.writeText(command);
    toast.success("Command copied", { description: command });
  } catch {
    toast.error("Couldn't copy — copy it manually", { description: command });
  }
}

/** Copyable command block: the primary action of a registry surface. */
export function CommandBlock({ command, label }: { command: string; label?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <span className="w-fit font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
      ) : null}
      <div className="flex items-center gap-2 rounded-[4px] border border-border bg-card py-1.5 pl-3 pr-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">
          {command}
        </code>
        <button
          type="button"
          aria-label={`Copy command: ${command}`}
          onClick={() => void copyCommand(command)}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
            "transition-colors hover:bg-secondary hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <IconCopy aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Multiline copyable code block (CI snippets, multi-step usage). */
export function CodeBlock({ code, ariaLabel }: { code: string; ariaLabel?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[4px] border border-border bg-card py-2 pl-3 pr-1.5">
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[12px] leading-[1.55] text-foreground">
        {code}
      </pre>
      <button
        type="button"
        aria-label={ariaLabel ?? "Copy snippet"}
        onClick={() => void copyCommand(code)}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
          "transition-colors hover:bg-secondary hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <IconCopy aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/* ========================================================================== *
 * Install bay — the registry's primary action, with the install *context* a
 * platform user actually picks between: add to the project, run once, or wire
 * it into CI. Replaces the lone copy-one-command affordance.
 * ========================================================================== */

type InstallMode = "add" | "run" | "ci";

const INSTALL_MODES: ReadonlyArray<{ id: InstallMode; label: string; hint: string }> = [
  { id: "add", label: "Add to project", hint: "Pins the skill into this workspace's skill set." },
  { id: "run", label: "Run once", hint: "Runs against the current workspace without pinning it." },
  { id: "ci", label: "CI step", hint: "Runs the skill on every pipeline that includes this step." },
];

export function InstallBay({ skill }: { skill: Skill }) {
  const [mode, setMode] = useState<InstallMode>("add");
  const active = INSTALL_MODES.find((m) => m.id === mode)!;

  return (
    <section
      aria-label="Install"
      className="flex flex-col gap-3 rounded-[4px] border border-border bg-card p-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <IconTerminal2 aria-hidden className="size-3.5" />
          Install
        </span>
        <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
          pins v{skill.version}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Install context"
        className="flex rounded-[5px] bg-muted p-0.5"
      >
        {INSTALL_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={m.id === mode}
            onClick={() => setMode(m.id)}
            className={cn(
              "flex-1 rounded-[4px] px-2 py-1 text-[11.5px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              m.id === mode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "ci" ? (
        <CodeBlock code={skillCiSnippet(skill.id)} ariaLabel={`Copy CI step for ${skill.name}`} />
      ) : (
        <CommandBlock
          command={mode === "add" ? skillInstallCommand(skill.id) : skillRunCommand(skill.id)}
        />
      )}

      <p className="text-[11.5px] leading-[1.5] text-muted-foreground">{active.hint}</p>
      <p className="border-t border-border pt-2.5 font-mono text-[10.5px] leading-[1.5] text-muted-foreground">
        Requires {SKILL_REQUIREMENTS}
      </p>
    </section>
  );
}

/** Compact `install` copy button for list rows. */
export function InstallButton({ command, skillName }: { command: string; skillName: string }) {
  return (
    <button
      type="button"
      aria-label={`Copy install command for ${skillName}`}
      title={command}
      onClick={() => void copyCommand(command)}
      className={cn(
        "flex items-center gap-1.5 rounded-[3px] border border-border-strong bg-card px-2.5 py-1.5",
        "font-mono text-[11px] font-semibold text-foreground",
        "transition-colors hover:border-primary hover:text-brand-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <IconCopy aria-hidden className="size-3.5" />
      install
    </button>
  );
}
