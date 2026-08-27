/**
 * Design System Tokens — Loksewa Prep Pro
 *
 * Single source of truth for color, type, spacing, radius and elevation.
 * Screens must never hard-code raw values (master-prompt rules 45–50).
 *
 * Two complete themes are defined so dark mode later becomes a token switch,
 * not a color inversion (rule 74).
 */

export interface ThemeColors {
  // Brand
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;

  // Surfaces
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnPrimary: string;

  // Status
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  info: string;
  infoSoft: string;

  // Question option states (MCQ engine rule 12)
  optionIdleBg: string;
  optionIdleBorder: string;
  optionSelectedBg: string;
  optionSelectedBorder: string;
  optionCorrectBg: string;
  optionCorrectBorder: string;
  optionWrongBg: string;
  optionWrongBorder: string;

  // Misc
  overlay: string;
  skeleton: string;
}

export const palette = {
  navy950: '#081A38',
  navy900: '#0C2447',
  navy800: '#123258',
  navy700: '#1A4172',
  royal600: '#2563EB',
  royal500: '#3B82F6',
  royal300: '#93B8F9',
  blue100: '#DBEAFE',

  grays: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E3EAF3',
    300: '#CBD6E4',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    800: '#1E293B',
    900: '#0F172A',
  },

  green600: '#16A34A',
  green100: '#DCFCE7',
  amber600: '#D97706',
  amber100: '#FEF3C7',
  red600: '#DC2626',
  red100: '#FEE2E2',
} as const;

/** Light theme (default) */
export const lightTheme: ThemeColors = {
  primary: palette.navy900,
  primaryDark: palette.navy950,
  primaryLight: palette.blue100,
  secondary: palette.royal600,

  background: palette.grays[100],
  surface: '#FFFFFF',
  surfaceAlt: palette.grays[50],
  surfaceMuted: palette.grays[200],
  border: palette.grays[200],
  borderStrong: palette.grays[300],

  textPrimary: palette.grays[900],
  textSecondary: palette.grays[500],
  textTertiary: palette.grays[400],
  textOnPrimary: '#FFFFFF',

  success: palette.green600,
  successSoft: palette.green100,
  warning: palette.amber600,
  warningSoft: palette.amber100,
  error: palette.red600,
  errorSoft: palette.red100,
  info: palette.royal600,
  infoSoft: palette.blue100,

  optionIdleBg: '#FFFFFF',
  optionIdleBorder: palette.grays[200],
  optionSelectedBg: palette.blue100,
  optionSelectedBorder: palette.royal500,
  optionCorrectBg: palette.green100,
  optionCorrectBorder: palette.green600,
  optionWrongBg: palette.red100,
  optionWrongBorder: palette.red600,

  overlay: 'rgba(8, 26, 56, 0.55)',
  skeleton: palette.grays[200],
};


/** Dark theme — designed deliberately, not inverted */
export const darkTheme: ThemeColors = {
  primary: palette.royal300,
  primaryDark: palette.navy950,
  primaryLight: palette.navy800,
  secondary: palette.royal500,

  background: palette.navy950,
  surface: palette.navy900,
  surfaceAlt: palette.navy800,
  surfaceMuted: palette.navy700,
  border: palette.navy800,
  borderStrong: palette.navy700,

  textPrimary: '#F1F5F9',
  textSecondary: palette.grays[400],
  textTertiary: palette.grays[500],
  textOnPrimary: palette.navy950,

  success: '#4ADE80',
  successSoft: 'rgba(22, 163, 74, 0.18)',
  warning: '#FBBF24',
  warningSoft: 'rgba(217, 119, 6, 0.18)',
  error: '#F87171',
  errorSoft: 'rgba(220, 38, 38, 0.20)',
  info: palette.royal500,
  infoSoft: 'rgba(59, 130, 246, 0.16)',

  optionIdleBg: palette.navy800,
  optionIdleBorder: palette.navy700,
  optionSelectedBg: palette.navy700,
  optionSelectedBorder: palette.royal500,
  optionCorrectBg: 'rgba(22, 163, 74, 0.18)',
  optionCorrectBorder: '#4ADE80',
  optionWrongBg: 'rgba(220, 38, 38, 0.20)',
  optionWrongBorder: '#F87171',

  overlay: 'rgba(2, 8, 20, 0.70)',
  skeleton: palette.navy800,
};

/** Type scale (rule 48) — restrained sizes; keys describe role. */
export const typography = {
  pageTitle: { fontSize: 28, lineHeight: 34 },
  sectionTitle: { fontSize: 20, lineHeight: 26 },
  cardTitle: { fontSize: 16, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 21 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  micro: { fontSize: 11, lineHeight: 14 },
} as const;

/** Spacing scale (rule 49) — multiples of 4. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  screenX: 16,
  controlHeight: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Restrained elevation only (rule 50). */
export const elevation = {
  card: {
    shadowColor: palette.navy950,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  raised: {
    shadowColor: palette.navy950,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

export const touchTarget = 48;

export type AppTheme = ThemeColors & { dark: boolean };

export const themes = {
  light: { ...lightTheme, dark: false } as AppTheme,
  dark: { ...darkTheme, dark: true } as AppTheme,
};

export type ThemeMode = 'system' | 'light' | 'dark';
