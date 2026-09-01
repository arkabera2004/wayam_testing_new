import { cn } from "@/components/ui";
import { ICON_SIZES, ICON_STROKE_WIDTH, icons, type IconName, type IconSize } from "@/lib/icons";

type AppIconProps = {
  name: IconName;
  /** Defaults to `md` (16px) — the standard interface size. */
  size?: IconSize;
  className?: string;
  /**
   * Icons are decorative by default and hidden from assistive tech. Pass
   * `label` only when the icon is the sole carrier of meaning; the wrapping
   * control should normally own the label instead.
   */
  label?: string;
};

/**
 * The only way a glyph should enter the UI. Colour comes from the semantic
 * `icon-*` utilities (or `currentColor` inherited from the parent control),
 * never from a hardcoded value here.
 */
export function AppIcon({ name, size = "md", className, label }: AppIconProps) {
  const Glyph = icons[name];
  const px = ICON_SIZES[size];

  return (
    <Glyph
      size={px}
      strokeWidth={ICON_STROKE_WIDTH}
      className={cn("shrink-0", className)}
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
