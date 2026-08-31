/**
 * Design Tokens — single source of truth for every colour, radius,
 * spacing and typography value used across the app.
 *
 * All screens must import from here. Never define inline COLORS objects.
 */

// ─── Colour palette ───────────────────────────────────────────────────────────
export const palette = {
  // Backgrounds — Apple system grouped hierarchy
  bg:           '#F2F2F7',   // systemGroupedBackground
  card:         '#FFFFFF',   // systemBackground (pure white cards)
  cardAlt:      '#F9F9F9',   // secondarySystemBackground
  hero:         '#1C1611',   // retained for login / dramatic hero surfaces
  heroAlt:      '#231B12',

  // Brand accent — luxury bronze (unchanged)
  primary:      '#8B6B3E',
  primaryMid:   '#A07848',
  primarySoft:  '#FEF0DC',   // lighter so it reads on white cards
  primaryXSoft: '#FDF8EF',

  // Semantic — kept on-brand but works on white backgrounds
  success:      '#34A853',   // iOS green — replaces earthy #3d8f6a
  successSoft:  '#E8F7EE',
  successXSoft: '#F4FBF7',

  warning:      '#F5A623',   // iOS amber — replaces muddy #C6A563
  warningSoft:  '#FEF3DC',
  warningXSoft: '#FEFBF2',

  danger:       '#FF3B30',   // iOS red (system red)
  dangerSoft:   '#FFEEED',
  dangerXSoft:  '#FFF5F5',

  purple:       '#7A5AF8',   // iOS indigo-ish
  purpleSoft:   '#EDE8FE',
  purpleXSoft:  '#F6F3FF',

  gold:         '#C6A563',   // brand gold (unchanged)
  goldSoft:     '#FDE8C0',
  goldXSoft:    '#FFF8E0',

  // Text — Apple label hierarchy
  text:         '#1C1C1E',   // primaryLabel
  textMuted:    '#6C6C70',   // secondaryLabel
  textSoft:     '#AEAEB2',   // tertiaryLabel
  textHero:     '#FFFFFF',
  textHeroMuted:'#C4A882',
  textInverse:  '#ffffff',

  // Borders / surface — Apple separator system
  border:       '#E5E5EA',   // separator (non-opaque)
  borderStrong: '#C7C7CC',   // opaqueSeparator
  surface:      '#F2F2F7',   // same as bg for inset section backgrounds
  shadow:       '#000000',   // pure black for Apple-style subtle shadows

  // Utilities
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

// ─── Shadow presets — Apple-quality: very subtle, black base ─────────────────
export const shadow = {
  xs: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  lg: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 22,
    elevation: 6,
  },
  xl: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 10,
  },
} as const;
