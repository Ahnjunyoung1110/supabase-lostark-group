"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeProviderProps = {
  children: ReactNode;
  attribute?: "class" | `data-${string}`;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  storageKey?: string;
};

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
  themes: Theme[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEMES: Theme[] = ["light", "dark", "system"];

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function disableTransitions(nonce?: string) {
  const style = document.createElement("style");
  if (nonce) style.setAttribute("nonce", nonce);
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important;animation:none!important}",
    ),
  );
  document.head.appendChild(style);

  return () => {
    // Force a style recalculation before removing the transition block.
    window.getComputedStyle(document.body);
    requestAnimationFrame(() => {
      document.head.removeChild(style);
    });
  };
}

function applyTheme({
  attribute,
  resolvedTheme,
  disableTransitionOnChange,
}: {
  attribute: NonNullable<ThemeProviderProps["attribute"]>;
  resolvedTheme: ResolvedTheme;
  disableTransitionOnChange: boolean;
}) {
  const restoreTransitions = disableTransitionOnChange
    ? disableTransitions()
    : undefined;
  const root = document.documentElement;

  if (attribute === "class") {
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  } else {
    root.setAttribute(attribute, resolvedTheme);
  }

  root.style.colorScheme = resolvedTheme;
  restoreTransitions?.();
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
  storageKey = "theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  const resolvedTheme =
    theme === "system" && enableSystem ? systemTheme : (theme as ResolvedTheme);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(storageKey) as Theme | null;
    if (storedTheme && THEMES.includes(storedTheme)) {
      setThemeState(storedTheme);
    }
    setSystemTheme(getSystemTheme());
  }, [storageKey]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemTheme(getSystemTheme());

    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const nextTheme = event.newValue as Theme | null;
      setThemeState(nextTheme && THEMES.includes(nextTheme) ? nextTheme : defaultTheme);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [defaultTheme, storageKey]);

  useEffect(() => {
    applyTheme({ attribute, resolvedTheme, disableTransitionOnChange });
  }, [attribute, disableTransitionOnChange, resolvedTheme]);

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      setThemeState(nextTheme);
      window.localStorage.setItem(storageKey, nextTheme);
    },
    [storageKey],
  );

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme, themes: THEMES }),
    [resolvedTheme, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
