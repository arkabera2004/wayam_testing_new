import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { cn } from "@/components/ui";
import { ICON_SIZES, icons, type IconName, type IconSize } from "@/lib/icons";

type AppIconProps = {
  name: IconName;
  /** Defaults to `md` (16px) - the standard interface size. */
  size?: IconSize;
  className?: string;
  /**
   * Icons are decorative by default and hidden from assistive tech. Pass
   * `label` only when the icon is the sole carrier of meaning; the wrapping
   * control should normally own the label instead.
   */
  label?: string;
  /** Spins the glyph. Only meaningful for `loading`. */
  spin?: boolean;
};

/**
 * The only way a glyph should enter the UI. Colour comes from the semantic
 * `icon-*` utilities (or `currentColor` inherited from the parent control),
 * never from a hardcoded value here.
 *
 * The size is applied as an explicit box rather than through Font Awesome's
 * own `size` prop, which works in relative `em` steps and would let a glyph
 * inherit whatever font-size happened to surround it. The scale in
 * `ICON_SIZES` is in pixels for a reason: an icon next to 12px label text and
 * the same icon next to a 40px metric should be the same icon.
 */
export function AppIcon({ name, size = "md", className, label, spin }: AppIconProps) {
  const px = ICON_SIZES[size];

  return (
    <FontAwesomeIcon
      icon={icons[name]}
      spin={spin}
      style={{ width: px, height: px }}
      className={cn("shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
