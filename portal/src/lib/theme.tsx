import { flushSync } from "react-dom";
import {
  createContext,
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
  setMode: (mode: ThemeMode, origin?: { x: number; y: number }) => void;
};

const STORAGE_KEY = "atlas-theme";
const TRANSITION_DURATION = 400;

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const systemPref = useSyncExternalStore<ResolvedTheme>(
    subscribeSystemPreference,
    getSystemPreference,
    () => "light",
  );
  const activeTransition = useRef<ViewTransition | null>(null);
  const request = useRef(0);

  const resolved: ResolvedTheme = mode === "system" ? systemPref : mode;

  // Magic UI's snapshot reveal: theme and React state commit in the same frame.
  const setMode = useCallback(async (next: ThemeMode, origin?: { x: number; y: number }) => {
    const id = ++request.current;
    const previous = activeTransition.current;
    if (previous) {
      previous.skipTransition();
      await previous.updateCallbackDone.catch(() => {});
      if (id !== request.current) return;
    }
    const root = document.documentElement;
    const nextResolved = next === "system" ? getSystemPreference() : next;
    const commit = () =>
      flushSync(() => {
        applyThemeToDOM(nextResolved);
        setModeState(next);
        localStorage.setItem(STORAGE_KEY, next);
      });
    const cleanup = () => {
      delete root.dataset.themeReveal;
      root.style.removeProperty("--theme-reveal-origin");
      activeTransition.current = null;
    };
    if (
      !origin ||
      typeof document.startViewTransition !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      root.classList.contains("dark") === (nextResolved === "dark")
    ) {
      cleanup();
      commit();
      return;
    }
    const { x, y } = origin;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    const point = `${(x / width) * 100}% ${(y / height) * 100}%`;
    const radiusPercent = (radius / (Math.hypot(width, height) / Math.SQRT2)) * 100;
    // Percentage clip coordinates keep the snapshot origin correct at fractional display scales.
    const from = `circle(0% at ${point})`;
    root.dataset.themeReveal = "active";
    root.style.setProperty("--theme-reveal-origin", from);
    const transition = document.startViewTransition(commit);
    activeTransition.current = transition;
    let animation: Animation | undefined;
    try {
      await transition.ready;
      if (id !== request.current) return;
      animation = root.animate(
        { clipPath: [from, `circle(${radiusPercent}% at ${point})`] },
        {
          duration: TRANSITION_DURATION,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
          fill: "forwards",
        },
      );
      await transition.finished;
    } catch {
      // A newer selection or hidden document can skip the snapshot animation.
    } finally {
      animation?.cancel();
      if (id === request.current) cleanup();
    }
  }, []);

  useEffect(
    () => () => {
      request.current++;
      activeTransition.current?.skipTransition();
      delete document.documentElement.dataset.themeReveal;
      document.documentElement.style.removeProperty("--theme-reveal-origin");
    },
    [],
  );

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
