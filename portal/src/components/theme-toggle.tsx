import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const CYCLE: ThemeMode[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme();

  const next = CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length];
  const label =
    mode === "system"
      ? `Theme: system (${resolved})`
      : `Theme: ${mode}`;
  const tooltip =
    mode === "system"
      ? `System (${resolved}) · click for ${next}`
      : `${mode[0].toUpperCase()}${mode.slice(1)} · click for ${next}`;

  return (
    <button
      type="button"
      aria-label={label}
      title={tooltip}
      onClick={(e) => setMode(next, e)}
      className={cn(
        "relative flex size-7 items-center justify-center rounded-md text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <IconSun
        size={15}
        strokeWidth={2}
        className={cn(
          "absolute transition-[transform,opacity] duration-300",
          resolved === "dark" ? "scale-0 opacity-0" : "scale-100 opacity-100",
        )}
      />
      <IconMoon
        size={15}
        strokeWidth={2}
        className={cn(
          "absolute transition-[transform,opacity] duration-300",
          resolved === "dark" ? "scale-100 opacity-100" : "scale-0 opacity-0",
        )}
      />
      {mode === "system" && (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-2 items-center justify-center rounded-full bg-muted ring-1 ring-background">
          <span className="size-1 rounded-full bg-muted-foreground/60" />
        </span>
      )}
    </button>
  );
}
