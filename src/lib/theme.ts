/**
 * Shared design tokens — warm earth palette used across all screens.
 * Screens that previously used generic blue/gray should import from here
 * for visual consistency.
 */

export const COLORS = {
  // Backgrounds — Apple system hierarchy
  background:  '#F2F2F7',
  card:        '#FFFFFF',
  cardAlt:     '#F9F9F9',
  hero:        '#1C1611',

  // Brand accent
  primary:     '#8B6B3E',
  primarySoft: '#FEF0DC',
  success:     '#34A853',
  successSoft: '#E8F7EE',

  // Accents
  warning:     '#F5A623',
  warningSoft: '#FEF3DC',
  danger:      '#FF3B30',
  dangerSoft:  '#FFEEED',
  purple:      '#7A5AF8',
  purpleSoft:  '#EDE8FE',
  gold:        '#C6A563',
  goldSoft:    '#FDE8C0',

  // Text — Apple label hierarchy
  text:        '#1C1C1E',
  textMuted:   '#6C6C70',
  textSoft:    '#AEAEB2',
  heroText:    '#FFFFFF',
  heroMuted:   '#C4A882',

  // Border / surface
  border:      '#E5E5EA',
  shadow:      '#000000',
  surfaceMuted:'#F2F2F7',
} as const;

export type AppColor = keyof typeof COLORS;
