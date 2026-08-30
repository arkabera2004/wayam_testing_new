/**
 * Shared by both the server layout and the client provider, so it must NOT
 * live in a "use client" module: a server component importing from one gets a
 * client-reference proxy rather than the value, which silently breaks
 * cookies().get(...) and pins the theme to its default.
 */
export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "parikshan-theme";

/** Light is the product default; the cookie only ever overrides it to dark. */
export function themeFromCookie(value: string | undefined): ThemeMode {
  return value === "dark" ? "dark" : "light";
}
