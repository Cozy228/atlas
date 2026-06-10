import {
  createContext,
  startTransition,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode, event?: MouseEvent | React.MouseEvent) => void;
};

const STORAGE_KEY = "atlas-theme";
const TRANSITION_DURATION = 500;

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPreference(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with static server-safe defaults so the initial render matches SSR.
  // The inline theme script in <head> already handles the visual dark class before
  // first paint, so there is no flash. State syncs to actual browser values after mount.
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemPref, setSystemPref] = useState<ResolvedTheme>("light");
  const isTransitioning = useRef(false);
  const hasMounted = useRef(false);

  const resolved: ResolvedTheme = mode === "system" ? systemPref : mode;

  const setMode = useCallback(
    async (next: ThemeMode, event?: MouseEvent | React.MouseEvent) => {
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

      let x = event?.clientX ?? window.innerWidth / 2;
      let y = event?.clientY ?? 0;
      // Keyboard-triggered clicks report (0, 0); expand from the control instead.
      if (event && event.clientX === 0 && event.clientY === 0) {
        const target = event.currentTarget;
        if (target instanceof Element) {
          const rect = target.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        }
      }
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      isTransitioning.current = true;

      // Apply DOM changes inside the VT callback so the browser captures the correct
      // before/after snapshots. React state is synced via startTransition concurrently.
      const transition = document.startViewTransition(() => {
        applyThemeToDOM(nextResolved);
        localStorage.setItem(STORAGE_KEY, next);
      });

      startTransition(() => setModeState(next));

      // Release the guard however the transition ends, including when the
      // browser skips it (`ready`/`finished` reject in that case).
      transition.finished
        .catch(() => {})
        .finally(() => {
          isTransitioning.current = false;
        });

      try {
        await transition.ready;
      } catch {
        // Transition was skipped; the theme is already applied.
        return;
      }

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: TRANSITION_DURATION,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    },
    [],
  );

  useEffect(() => {
    setModeState(readStoredMode());
    setSystemPref(getSystemPreference());
  }, []);

  useEffect(() => {
    // Skip the first run: `resolved` still holds the SSR default here, and the
    // inline head script already applied the correct class before first paint.
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    applyThemeToDOM(resolved);
  }, [resolved]);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemPref(e.matches ? "dark" : "light");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
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
