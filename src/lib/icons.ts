/**
 * TIER 1 - ICON REGISTRY
 *
 * The single place where a semantic concept binds to a glyph. Components ask
 * for meaning ("maintenance"), never for a specific icon, so one concept can
 * never drift into three different glyphs across the app.
 *
 * Glyphs come from Font Awesome. The registry is the whole coupling: every
 * consumer goes through `IconName`, so the family behind these names can be
 * replaced by editing this file and nothing else. That claim was previously
 * written here and was not true - twenty-nine components imported their own
 * glyphs directly - so the migration to Font Awesome also routed those
 * through here, which is what makes it true now.
 *
 * Style note: the free Font Awesome tier ships `solid` for the full set and
 * `regular` for only a small subset. Mixing them would give the same UI two
 * visual weights, which is the thing an icon system exists to prevent, so the
 * whole registry is solid. A thinner set would need Font Awesome Pro; that is
 * a licence decision, not a code one.
 *
 * Imports are named, so the bundler keeps tree-shaking. Never `import *`.
 */
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import {
  faAnglesLeft,
  faAnglesRight,
  faArrowDown,
  faArrowDownWideShort,
  faArrowLeft,
  faArrowRight,
  faArrowRotateLeft,
  faArrowTrendUp,
  faArrowTurnDown,
  faArrowUp,
  faArrowUpRightFromSquare,
  faBell,
  faBook,
  faBoxArchive,
  faBug,
  faBullseye,
  faChartColumn,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircleInfo,
  faCirclePlay,
  faClipboardList,
  faCodeCompare,
  faCodePullRequest,
  faCopy,
  faDownload,
  faEllipsisVertical,
  faExpand,
  faFileArrowUp,
  faFileCode,
  faFileLines,
  faFilter,
  faFlask,
  faGauge,
  faGear,
  faGlobe,
  faLink,
  faLinkSlash,
  faLock,
  faMagnifyingGlass,
  faMap,
  faMinus,
  faMoon,
  faNetworkWired,
  faPaste,
  faPencil,
  faPlay,
  faPlug,
  faPlus,
  faPowerOff,
  faShieldHalved,
  faSpinner,
  faSun,
  faTag,
  faTrashCan,
  faTriangleExclamation,
  faUpload,
  faUser,
  faWandMagicSparkles,
  faWrench,
  faXmark,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

export const icons = {
  // ---- Navigation ----
  dashboard: faGauge,
  applicationMap: faMap,
  testPlan: faClipboardList,
  requirements: faFileLines,
  tests: faFlask,
  runs: faCirclePlay,
  analytics: faChartColumn,
  integrations: faPlug,
  settings: faGear,
  maintenance: faWrench,
  quarantine: faBug,
  shield: faShieldHalved,
  codeReview: faCodeCompare,
  notification: faBell,
  docs: faBook,

  // ---- Actions ----
  search: faMagnifyingGlass,
  add: faPlus,
  minus: faMinus,
  delete: faTrashCan,
  archive: faBoxArchive,
  download: faDownload,
  upload: faUpload,
  fileUpload: faFileArrowUp,
  externalLink: faArrowUpRightFromSquare,
  link: faLink,
  unlink: faLinkSlash,
  refresh: faArrowRotateLeft,
  close: faXmark,
  check: faCheck,
  more: faEllipsisVertical,
  play: faPlay,
  enterKey: faArrowTurnDown,
  user: faUser,
  edit: faPencil,
  copy: faCopy,
  paste: faPaste,
  logout: faRightFromBracket,
  power: faPowerOff,

  // ---- Direction ----
  arrowUp: faArrowUp,
  arrowDown: faArrowDown,
  arrowLeft: faArrowLeft,
  arrowRight: faArrowRight,
  chevronUp: faChevronUp,
  chevronDown: faChevronDown,
  chevronLeft: faChevronLeft,
  chevronRight: faChevronRight,
  collapse: faAnglesLeft,
  expand: faAnglesRight,

  // ---- System / status ----
  info: faCircleInfo,
  warning: faTriangleExclamation,
  fullscreen: faExpand,
  target: faBullseye,
  sparkle: faWandMagicSparkles,
  themeDark: faMoon,
  themeLight: faSun,
  loading: faSpinner,
  lock: faLock,

  // ---- Source control / integrations ----
  github: faGithub,
  pullRequest: faCodePullRequest,
  network: faNetworkWired,
  globe: faGlobe,
  fileCode: faFileCode,
  tag: faTag,

  // ---- Data ----
  chart: faChartColumn,
  sort: faArrowDownWideShort,
  filter: faFilter,
  trend: faArrowTrendUp,
} as const;

export type IconName = keyof typeof icons;

/** Size scale. Most interface icons live between `sm` and `xl`. */
export const ICON_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
} as const;

export type IconSize = keyof typeof ICON_SIZES;
