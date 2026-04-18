/**
 * Shared design tokens — warm earth palette used across all screens.
 * Screens that previously used generic blue/gray should import from here
 * for visual consistency.
 */

export const COLORS = {
  // Backgrounds
  background:  '#f6f2eb',
  card:        '#fffdf9',
  cardAlt:     '#efe6d8',
  hero:        '#171513',

  // Brand greens
  primary:     '#1f4d45',
  primarySoft: '#dce8e3',
  success:     '#3d8f6a',
  successSoft: '#ddf0e8',

  // Accents
  warning:     '#b8883f',
  warningSoft: '#f5e8ce',
  danger:      '#c96d4d',
  dangerSoft:  '#fdf0ec',
  purple:      '#8366d7',
  purpleSoft:  '#ede8f9',
  gold:        '#b78a43',
  goldSoft:    '#f2e5ca',

  // Text
  text:        '#181512',
  textMuted:   '#7f7565',
  textSoft:    '#9a8f7e',
  heroText:    '#fffaf3',
  heroMuted:   '#b8ab95',

  // Border / surface
  border:      '#e1d7c8',
  shadow:      '#201a13',
  surfaceMuted:'#f0ebe0',
} as const;

export type AppColor = keyof typeof COLORS;
