import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

/** Icon button that flips [data-theme] on <html> between "dark" and
 * "light" and persists the choice — see src/lib/theme.ts and the
 * no-flash inline script in __root.tsx that reads the same key on first
 * paint. Reads its initial state from the DOM (already set by that
 * script) rather than defaulting blind, so it never has to guess. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={className}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
