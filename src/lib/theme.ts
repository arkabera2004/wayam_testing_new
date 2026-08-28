// Theme persistence — dark-first by default (see styles.css's header
// comment), light mode is an explicit opt-in via [data-theme="light"] on
// <html>, not a media-query fallback. Shared by the no-flash inline script
// in __root.tsx and the ThemeToggle component so both agree on the same
// storage key and default.
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "parikshan-theme";
export const DEFAULT_THEME: Theme = "dark";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" ? "light" : DEFAULT_THEME;
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

/** Inlined verbatim into __root.tsx's <head> (as a string, not imported —
 * it must run before first paint, synchronously, with no module loading)
 * so the very first frame already has the right theme instead of flashing
 * dark then swapping to a stored light preference. */
export const NO_FLASH_THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");document.documentElement.dataset.theme=t==="light"?"light":"${DEFAULT_THEME}";}catch(e){document.documentElement.dataset.theme="${DEFAULT_THEME}";}})();`;
