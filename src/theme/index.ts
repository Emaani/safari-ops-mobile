export type ThemeMode = 'light' | 'dark';

export interface AppTheme {
  mode: ThemeMode;
  dark: boolean;
  statusBarStyle: 'light' | 'dark';
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    surfaceElevated: string;
    hero: string;
    heroAccent: string;
    border: string;
    borderStrong: string;
    text: string;
    textMuted: string;
    textSoft: string;
    accent: string;
    accentSoft: string;
    accentContrast: string;
    success: string;
    successSoft: string;
    warning: string;
    warningSoft: string;
    danger: string;
    dangerSoft: string;
    input: string;
    overlay: string;
    shadow: string;
  };
}

export const lightTheme: AppTheme = {
  mode: 'light',
  dark: false,
  statusBarStyle: 'dark',
  colors: {
    background:      '#F2F2F7',
    surface:         '#FFFFFF',
    surfaceMuted:    '#F2F2F7',
    surfaceElevated: '#FFFFFF',
    hero:            '#1C1611',
    heroAccent:      '#2E1F0F',
    border:          '#E5E5EA',
    borderStrong:    '#C7C7CC',
    text:            '#1C1C1E',
    textMuted:       '#6C6C70',
    textSoft:        '#AEAEB2',
    accent:          '#8B6B3E',
    accentSoft:      '#FEF0DC',
    accentContrast:  '#FFFFFF',
    success:         '#34A853',
    successSoft:     '#E8F7EE',
    warning:         '#F5A623',
    warningSoft:     '#FEF3DC',
    danger:          '#FF3B30',
    dangerSoft:      '#FFEEED',
    input:           '#F2F2F7',
    overlay:         'rgba(0, 0, 0, 0.18)',
    shadow:          '#000000',
  },
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  dark: true,
  statusBarStyle: 'light',
  colors: {
    background:      '#0F0C09',
    surface:         '#1C1611',
    surfaceMuted:    '#231B12',
    surfaceElevated: '#2A2117',
    hero:            '#100D0A',
    heroAccent:      '#2E1F0F',
    border:          '#3A2E22',
    borderStrong:    '#4A3C2E',
    text:            '#F5ECD9',
    textMuted:       '#C4A882',
    textSoft:        '#9a8f7e',
    accent:          '#C6A563',
    accentSoft:      '#3A2912',
    accentContrast:  '#F5ECD9',
    success:         '#34A853',
    successSoft:     '#0D2B1A',
    warning:         '#F5A623',
    warningSoft:     '#3A2912',
    danger:          '#FF3B30',
    dangerSoft:      '#381a14',
    input:           '#231B12',
    overlay:         'rgba(0, 0, 0, 0.55)',
    shadow:          '#000000',
  },
};

export const themes: Record<ThemeMode, AppTheme> = {
  light: lightTheme,
  dark: darkTheme,
};
