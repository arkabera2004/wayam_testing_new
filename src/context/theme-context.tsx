"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme";

export type { ThemeMode };

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
};

/**
 * A non-null default matters: during a partial RSC render the root layout is
 * not re-executed, so a consumer like ThemeToggle can be server-rendered with
 * the provider absent from that subtree. With a null default the hook threw
 * and took the whole page down with a 500. The fallback is inert — in the
 * browser the provider is always an ancestor, so these no-ops never run.
 */
const FALLBACK_THEME: ThemeContextValue = {
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
};

const ThemeContext = createContext<ThemeContextValue>(FALLBACK_THEME);

/**
 * Writes the theme everywhere it needs to live: the DOM attribute the tokens
 * key off, the native color-scheme (so form controls and scrollbars follow),
 * localStorage, and a cookie the server reads on the next request. The cookie
 * is what prevents a flash of the wrong theme on reload.
 */
function persist(theme: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Storage can be unavailable in private windows; the cookie still works. */
  }
  document.cookie = `${THEME_STORAGE_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeProvider({
  children,
  initialTheme = "light",
}: {
  children: ReactNode;
  initialTheme?: ThemeMode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  const setTheme = useCallback((next: ThemeMode) => {
    persist(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme, isDark: theme === "dark" }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
