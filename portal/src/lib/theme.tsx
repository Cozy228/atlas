import {
  createContext,
  startTransition,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode, event?: MouseEvent | React.MouseEvent | HTMLElement) => void;
};

const STORAGE_KEY = "atlas-theme";
const TRANSITION_DURATION = 500;

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPreference(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeSystemPreference(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function applyThemeToDOM(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function resolveThemeTransitionOrigin(
  trigger?:
    | MouseEvent
    | React.MouseEvent
    | HTMLElement
    | { clientX?: number; clientY?: number }
    | null,
): { x: number; y: number } {
  // 1. Explicit HTMLElement passed (e.g. buttonRef.current or e.currentTarget)
  if (
    trigger &&
    "getBoundingClientRect" in trigger &&
    typeof trigger.getBoundingClientRect === "function"
  ) {
    const rect = trigger.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
  }

  // 2. React SyntheticEvent or native DOM Event
  if (trigger && typeof trigger === "object") {
    const currentTarget =
      "currentTarget" in trigger ? (trigger.currentTarget as Element | null) : null;
    const target = "target" in trigger ? (trigger.target as Element | null) : null;
    const el = currentTarget ?? target;
    if (el && typeof el.getBoundingClientRect === "function") {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
    }
    if (
      "clientX" in trigger &&
      typeof trigger.clientX === "number" &&
      "clientY" in trigger &&
      typeof trigger.clientY === "number" &&
      (trigger.clientX !== 0 || trigger.clientY !== 0)
    ) {
      return { x: trigger.clientX, y: trigger.clientY };
    }
  }

  // 3. Fallback: currently active / focused element if it is a control
  if (
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== document.body &&
    document.activeElement !== document.documentElement
  ) {
    const rect = document.activeElement.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
  }

  // 4. Fallback: query theme toggle button directly in DOM
  if (typeof document !== "undefined") {
    const toggleBtn = document.querySelector('button[aria-label^="Theme"]');
    if (toggleBtn) {
      const rect = toggleBtn.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
    }
  }

  // 5. Default fallback to top-right corner where the header toggle sits
  const x = typeof window !== "undefined" ? window.innerWidth - 32 : 0;
  const y = 28;
  return { x, y };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const systemPref = useSyncExternalStore<ResolvedTheme>(
    subscribeSystemPreference,
    getSystemPreference,
    () => "light",
  );
  const isTransitioning = useRef(false);
  const activeAnimRef = useRef<Animation | null>(null);

  const resolved: ResolvedTheme = mode === "system" ? systemPref : mode;

  const setMode = useCallback(
    async (next: ThemeMode, event?: MouseEvent | React.MouseEvent | HTMLElement) => {
      const nextResolved = next === "system" ? getSystemPreference() : next;
      const prevResolved = document.documentElement.classList.contains("dark") ? "dark" : "light";
      const noVisualChange = nextResolved === prevResolved;

      const canAnimate =
        !noVisualChange &&
        !isTransitioning.current &&
        typeof document !== "undefined" &&
        "startViewTransition" in document &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!canAnimate) {
        applyThemeToDOM(nextResolved);
        localStorage.setItem(STORAGE_KEY, next);
        startTransition(() => setModeState(next));
        return;
      }

      // Calculate origin coordinates for the circular expansion directly from the button.
      const { x, y } = resolveThemeTransitionOrigin(event);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Use percentage coordinates to guarantee exact alignment under fractional DPI display scales.
      const toX = (val: number) => `${(val / viewportWidth) * 100}%`;
      const toY = (val: number) => `${(val / viewportHeight) * 100}%`;
      const toRadius = (r: number) =>
        `${(r / (Math.hypot(viewportWidth, viewportHeight) / Math.SQRT2)) * 100}%`;

      const endRadius = Math.hypot(Math.max(x, viewportWidth - x), Math.max(y, viewportHeight - y));

      activeAnimRef.current?.cancel();
      isTransitioning.current = true;

      const transition = document.startViewTransition(() => {
        applyThemeToDOM(nextResolved);
        localStorage.setItem(STORAGE_KEY, next);
      });

      startTransition(() => setModeState(next));

      transition.finished
        .catch(() => {})
        .finally(() => {
          isTransitioning.current = false;
          activeAnimRef.current = null;
        });

      try {
        await transition.ready;
      } catch {
        // Transition was skipped or aborted; the theme is already applied.
        return;
      }

      const anim = document.documentElement.animate(
        {
          clipPath: [
            `circle(0% at ${toX(x)} ${toY(y)})`,
            `circle(${toRadius(endRadius)} at ${toX(x)} ${toY(y)})`,
          ],
        },
        {
          duration: TRANSITION_DURATION,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      );
      activeAnimRef.current = anim;
    },
    [],
  );

  useEffect(() => {
    return () => {
      activeAnimRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    applyThemeToDOM(resolved);
  }, [resolved]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (
        e.key === STORAGE_KEY &&
        (e.newValue === "light" || e.newValue === "dark" || e.newValue === "system")
      ) {
        setModeState(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
