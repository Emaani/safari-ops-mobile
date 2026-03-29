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
    background: '#f4f7fb',
    surface: '#ffffff',
    surfaceMuted: '#eef3fb',
    surfaceElevated: '#f9fbff',
    hero: '#121822',
    heroAccent: '#24324b',
    border: '#d9e1ee',
    borderStrong: '#c5d1e3',
    text: '#121a24',
    textMuted: '#617084',
    textSoft: '#8593a6',
    accent: '#4d7cff',
    accentSoft: '#dce5ff',
    accentContrast: '#ffffff',
    success: '#16a56b',
    successSoft: '#daf6e9',
    warning: '#d49c2d',
    warningSoft: '#fff1cf',
    danger: '#e45d5d',
    dangerSoft: '#ffe1e1',
    input: '#eef3fb',
    overlay: 'rgba(18, 24, 34, 0.18)',
    shadow: '#08101b',
  },
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  dark: true,
  statusBarStyle: 'light',
  colors: {
    background: '#0a1018',
    surface: '#101823',
    surfaceMuted: '#141f2d',
    surfaceElevated: '#182333',
    hero: '#0d141d',
    heroAccent: '#1b2940',
    border: '#1d2a3c',
    borderStrong: '#27374e',
    text: '#f5f8ff',
    textMuted: '#91a0b5',
    textSoft: '#6d7d93',
    accent: '#4d7cff',
    accentSoft: '#17274b',
    accentContrast: '#ffffff',
    success: '#28c083',
    successSoft: '#103022',
    warning: '#efb13d',
    warningSoft: '#35270d',
    danger: '#ff6d6d',
    dangerSoft: '#381a20',
    input: '#141f2d',
    overlay: 'rgba(0, 0, 0, 0.42)',
    shadow: '#000000',
  },
};

export const themes: Record<ThemeMode, AppTheme> = {
  light: lightTheme,
  dark: darkTheme,
};
