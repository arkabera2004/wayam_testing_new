/**
 * TIER 1 — ICON REGISTRY
 *
 * The single place where a semantic concept binds to a glyph. Components ask
 * for meaning ("maintenance"), never for a specific icon, so one concept can
 * never drift into three different glyphs across the app.
 *
 * Glyphs currently come from lucide-react: it is already the app's only icon
 * dependency and matches the weight of the shipped UI. Swapping the whole app
 * to another family (Font Awesome included) is a change to this file alone —
 * every consumer goes through `IconName`.
 *
 * Imports are named, so the bundler keeps tree-shaking. Never `import *`.
 */
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bell,
  Book,
  Bug,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  GitCompare,
  CornerDownLeft,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Info,
  LayoutDashboard,
  Link2,
  ListFilter,
  Map,
  Maximize2,
  Minus,
  MoreVertical,
  Moon,
  Play,
  PlayCircle,
  Plug,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  TriangleAlert,
  User,
  Wrench,
  X,
} from "lucide-react";

export const icons = {
  // ---- Navigation ----
  dashboard: LayoutDashboard,
  applicationMap: Map,
  testPlan: ClipboardList,
  requirements: FileText,
  tests: FlaskConical,
  runs: PlayCircle,
  analytics: BarChart3,
  integrations: Plug,
  settings: Settings,
  maintenance: Wrench,
  quarantine: Bug,
  shield: ShieldCheck,
  codeReview: GitCompare,
  notification: Bell,
  docs: Book,

  // ---- Actions ----
  search: Search,
  add: Plus,
  minus: Minus,
  delete: Trash2,
  archive: Archive,
  download: Download,
  externalLink: ExternalLink,
  link: Link2,
  refresh: RotateCcw,
  close: X,
  check: Check,
  more: MoreVertical,
  play: Play,
  enterKey: CornerDownLeft,
  user: User,

  // ---- Direction ----
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  collapse: ChevronsLeft,
  expand: ChevronsRight,

  // ---- System / status ----
  info: Info,
  warning: TriangleAlert,
  fullscreen: Maximize2,
  target: Target,
  sparkle: Sparkles,
  themeDark: Moon,
  themeLight: Sun,

  // ---- Data ----
  chart: BarChart3,
  sort: ListFilter,
  filter: ListFilter,
  trend: TrendingUp,
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

/**
 * One stroke weight for the whole app. Mixing weights is what makes an icon
 * set look assembled rather than designed.
 */
export const ICON_STROKE_WIDTH = 1.75;
