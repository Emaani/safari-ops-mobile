/**
 * Design Tokens — single source of truth for every colour, radius,
 * spacing and typography value used across the app.
 *
 * All screens must import from here. Never define inline COLORS objects.
 */

// ─── Colour palette ───────────────────────────────────────────────────────────
export const palette = {
  // Backgrounds
  bg:           '#f6f2eb',
  card:         '#fffdf9',
  cardAlt:      '#ece6da',
  hero:         '#171513',
  heroAlt:      '#1e1a16',

  // Brand greens
  primary:      '#1f4d45',
  primaryMid:   '#2a6358',
  primarySoft:  '#dce8e3',
  primaryXSoft: '#edf5f2',

  // Semantic
  success:      '#3d8f6a',
  successSoft:  '#ddf0e8',
  successXSoft: '#eef9f3',

  warning:      '#b8883f',
  warningSoft:  '#f5e8ce',
  warningXSoft: '#fdf5e8',

  danger:       '#c96d4d',
  dangerSoft:   '#fdf0ec',
  dangerXSoft:  '#fef6f3',

  purple:       '#8366d7',
  purpleSoft:   '#ede8f9',
  purpleXSoft:  '#f5f2fd',

  gold:         '#b78a43',
  goldSoft:     '#f2e5ca',
  goldXSoft:    '#faf3e8',

  // Text
  text:         '#181512',
  textMuted:    '#7f7565',
  textSoft:     '#9a8f7e',
  textHero:     '#fffaf3',
  textHeroMuted:'#b8ab95',
  textInverse:  '#ffffff',

  // Borders / surface
  border:       '#e1d7c8',
  borderStrong: '#cdc0ad',
  surface:      '#f0ebe0',
  shadow:       '#201a13',

  // Transparent utilities
  white:        '#ffffff',
  black:        '#000000',
} as const;

// ─── Semantic status colours ──────────────────────────────────────────────────
// All status badge rendering must use these — never ad-hoc colours.
export const statusColors = {
  // Booking statuses
  Pending:      { bg: palette.warningSoft,  text: '#7a5522',      dot: palette.warning },
  Confirmed:    { bg: palette.primarySoft,  text: palette.primary, dot: palette.primary },
  'In-Progress':{ bg: palette.successSoft,  text: '#174f38',      dot: palette.success },
  Completed:    { bg: palette.purpleSoft,   text: '#4b2fa0',      dot: palette.purple  },
  Cancelled:    { bg: palette.dangerSoft,   text: '#8b3320',      dot: palette.danger  },

  // Vehicle statuses
  available:    { bg: palette.successSoft,  text: '#174f38',      dot: palette.success },
  booked:       { bg: palette.purpleSoft,   text: '#4b2fa0',      dot: palette.purple  },
  rented:       { bg: palette.primarySoft,  text: palette.primary, dot: palette.primary },
  maintenance:  { bg: palette.warningSoft,  text: '#7a5522',      dot: palette.warning },
  out_of_service:{ bg: palette.dangerSoft,  text: '#8b3320',      dot: palette.danger  },

  // CR / Finance statuses
  Approved:     { bg: palette.successSoft,  text: '#174f38',      dot: palette.success },
  Declined:     { bg: palette.dangerSoft,   text: '#8b3320',      dot: palette.danger  },
  Rejected:     { bg: palette.dangerSoft,   text: '#8b3320',      dot: palette.danger  },
  Resolved:     { bg: palette.purpleSoft,   text: '#4b2fa0',      dot: palette.purple  },
  Assigned:     { bg: palette.primarySoft,  text: palette.primary, dot: palette.primary },

  // Generic
  active:       { bg: palette.successSoft,  text: '#174f38',      dot: palette.success },
  inactive:     { bg: palette.surface,      text: palette.textMuted, dot: palette.textMuted },
  draft:        { bg: palette.goldSoft,     text: '#7a5522',      dot: palette.gold },
} as const;

export type StatusKey = keyof typeof statusColors;

export function getStatusColors(status: string): { bg: string; text: string; dot: string } {
  return (statusColors as Record<string, { bg: string; text: string; dot: string }>)[status]
    ?? { bg: palette.surface, text: palette.textMuted, dot: palette.textMuted };
}

// ─── Spacing scale (8pt grid) ─────────────────────────────────────────────────
export const spacing = {
  '1':  4,
  '2':  8,
  '3':  12,
  '4':  16,
  '5':  20,
  '6':  24,
  '8':  32,
  '10': 40,
  '12': 48,
  '16': 64,
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────
export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl':24,
  '3xl':28,
  full: 999,
} as const;

// ─── Typography scale ─────────────────────────────────────────────────────────
export const type = {
  // Size
  xs:   10,
  sm:   12,
  base: 14,
  md:   15,
  lg:   16,
  xl:   18,
  '2xl':20,
  '3xl':24,
  '4xl':28,
  '5xl':32,

  // Weight
  regular:    '400' as const,
  medium:     '500' as const,
  semibold:   '600' as const,
  bold:       '700' as const,
  extrabold:  '800' as const,
  black:      '900' as const,

  // Line height multipliers (× fontSize)
  tight:   1.2,
  snug:    1.35,
  normal:  1.5,
  relaxed: 1.65,
} as const;

// ─── Shadow presets ───────────────────────────────────────────────────────────
export const shadow = {
  sm: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  xl: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.20,
    shadowRadius: 32,
    elevation: 14,
  },
} as const;
