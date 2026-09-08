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
    <div className="atlas-theme-switch" role="group" aria-label="Theme">
      <span
        className="atlas-theme-indicator"
        style={{
          transform: `translateX(${modes.findIndex((item) => item.mode === mode) * 32}px)`,
        }}
      />
      {modes.map(({ mode: option, label, Icon }) => (
        <button
          key={option}
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
