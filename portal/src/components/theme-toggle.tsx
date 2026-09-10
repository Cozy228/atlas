import { IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import "./theme-toggle.css";

const modes = [
  { mode: "light", label: "Light theme", Icon: IconSun },
  { mode: "dark", label: "Dark theme", Icon: IconMoon },
  { mode: "system", label: "Use system theme", Icon: IconDeviceDesktop },
] satisfies { mode: ThemeMode; label: string; Icon: typeof IconSun }[];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <div
      className="atlas-theme-switch relative inline-flex h-8 w-24 shrink-0 rounded-[4px] bg-muted shadow-[inset_0_0_0_1px_var(--border)]"
      role="group"
      aria-label="Theme"
    >
      <span
        className="atlas-theme-indicator absolute inset-y-0.5 left-0.5 w-7 rounded-[3px] bg-card shadow-[inset_0_0_0_1px_var(--border)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [[data-theme-reveal=active]_&]:transition-none"
        style={{
          transform: `translateX(${modes.findIndex((item) => item.mode === mode) * 32}px)`,
        }}
      />
      {modes.map(({ mode: option, label, Icon }) => (
        <button
          key={option}
          className="relative grid size-8 cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent p-0 text-muted-foreground transition-colors duration-200 ease-[ease] hover:text-foreground aria-pressed:text-foreground focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 motion-reduce:transition-none"
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={mode === option}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setMode(
              option,
              event.detail > 0
                ? { x: event.clientX, y: event.clientY }
                : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            );
          }}
        >
          <Icon size={16} stroke={1.75} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
