/**
 * Design tokens: every color, type size and hint-button state in one place, so the design team's
 * token file can replace this one without touching components. v1 ships three themes: Paper
 * (light), Midnight (dark) and High contrast. Sage and Sand come after launch.
 *
 * Paper and Midnight board colors are the design spec; the rest are derived to pass WCAG AA
 * (tests/tokens.test.ts checks the text pairs).
 */
import type { Level } from '@/sudoku/grader';

export type ThemeName = 'paper' | 'midnight' | 'contrast';
export type ThemeSetting = 'system' | ThemeName;

export type Palette = {
  dark: boolean;
  // app chrome
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  overlay: string;
  // board
  board: string;
  lineThin: string;
  lineBox: string;
  given: string;
  player: string;
  selected: string;
  unitTint: string;
  sameNumber: string;
  notes: string;
  errorText: string;
  errorBg: string;
  hintCell: string;
  hintPattern: string;
  ripple: string;
  // number pad
  key: string;
  keyText: string;
  keyActive: string;
  keyActiveText: string;
  badge: string;
  badgeText: string;
};

export const PALETTES: Record<ThemeName, Palette> = {
  paper: {
    dark: false,
    bg: '#F7F5F0',
    surface: '#FFFFFF',
    surfaceAlt: '#EFECE5',
    border: '#D9D4CA',
    text: '#2B2D42',
    textMuted: '#5C6070',
    accent: '#3A6EA5',
    onAccent: '#FFFFFF',
    overlay: 'rgba(43,45,66,0.45)',
    board: '#FFFFFF',
    lineThin: '#D9D4CA',
    lineBox: '#2B2D42',
    given: '#2B2D42',
    player: '#3A6EA5',
    selected: '#DCE8F5',
    unitTint: '#EEF2F7',
    sameNumber: '#C8DAEF',
    notes: '#8A8F98',
    errorText: '#D64545',
    errorBg: '#FBE3E3',
    hintCell: '#FFF1C9',
    hintPattern: '#FDF7E3',
    ripple: '#B9D3EE',
    key: '#FFFFFF',
    keyText: '#2B2D42',
    keyActive: '#3A6EA5',
    keyActiveText: '#FFFFFF',
    badge: '#EFECE5',
    badgeText: '#4A4E5C',
  },
  midnight: {
    dark: true,
    bg: '#121417',
    surface: '#1B1E23',
    surfaceAlt: '#23272E',
    border: '#2E333B',
    text: '#E8E6E1',
    textMuted: '#A4AAB4',
    accent: '#7FB3E8',
    onAccent: '#0E1A27',
    overlay: 'rgba(0,0,0,0.6)',
    board: '#1B1E23',
    lineThin: '#30353D',
    lineBox: '#8C95A4',
    given: '#E8E6E1',
    player: '#7FB3E8',
    selected: '#26364A',
    unitTint: '#20262E',
    sameNumber: '#2C4560',
    notes: '#9EA4AE',
    errorText: '#FF6B6B',
    errorBg: '#3B2023',
    hintCell: '#3A3320',
    hintPattern: '#2A2719',
    ripple: '#2F4D6E',
    key: '#23272E',
    keyText: '#E8E6E1',
    keyActive: '#7FB3E8',
    keyActiveText: '#0E1A27',
    badge: '#30353D',
    badgeText: '#C9CED6',
  },
  contrast: {
    dark: false,
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F0F0',
    border: '#000000',
    text: '#000000',
    textMuted: '#2E2E2E',
    accent: '#0033A0',
    onAccent: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.6)',
    board: '#FFFFFF',
    lineThin: '#5A5A5A',
    lineBox: '#000000',
    given: '#000000',
    player: '#0033A0',
    selected: '#FFE36B',
    unitTint: '#E6E6E6',
    sameNumber: '#B5D0FF',
    notes: '#2E2E2E',
    errorText: '#A00018',
    errorBg: '#FFD5DB',
    hintCell: '#FFE36B',
    hintPattern: '#FFF4BF',
    ripple: '#B5D0FF',
    key: '#FFFFFF',
    keyText: '#000000',
    keyActive: '#0033A0',
    keyActiveText: '#FFFFFF',
    badge: '#000000',
    badgeText: '#FFFFFF',
  },
};

export const DIFFICULTY_COLORS: Record<Level, string> = {
  easy: '#6BAF8D',
  medium: '#3A6EA5',
  hard: '#E0A030',
  expert: '#D9663A',
  master: '#8E5BD6',
  extreme: '#2B2D42',
};

/** Difficulty color on a dark theme, where Extreme navy would vanish. */
export function difficultyColor(level: Level, palette: Palette): string {
  if (level === 'extreme' && palette.dark) return '#C9CED6';
  return DIFFICULTY_COLORS[level];
}

export const FONTS = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const TYPE = {
  display: { size: 30, line: 36, font: FONTS.bold },
  title: { size: 22, line: 28, font: FONTS.semibold },
  heading: { size: 17, line: 22, font: FONTS.semibold },
  body: { size: 15, line: 21, font: FONTS.regular },
  bodyMedium: { size: 15, line: 21, font: FONTS.medium },
  label: { size: 13, line: 17, font: FONTS.medium },
  meta: { size: 12, line: 16, font: FONTS.regular },
} as const;

export const BOARD = {
  /** Digits are about 60% of the cell height. */
  digitRatio: 0.6,
  noteRatio: 0.24,
  givenFont: FONTS.semibold,
  playerFont: FONTS.regular,
  noteFont: FONTS.medium,
  /** Tabular figures so digits line up. */
  fontVariant: ['tabular-nums'] as const,
  margin: 16,
  minMargin: 4,
  /** Cell tap targets aim for 48 px where the screen allows, and never under 40 if avoidable. */
  targetCell: 48,
  minCell: 40,
  lineThin: 1,
  lineBox: 2,
  radius: 10,
} as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const MOTION = {
  placeFrom: 0.9,
  placeMs: 160,
  rippleMs: 250,
  rippleStaggerMs: 22,
  confettiMs: 1600,
  confettiCount: 36,
} as const;

/** Hint button: free hints left, watch an ad for +1, or used up (3 rewarded hints used). */
export type HintButtonKind = 'free' | 'ad' | 'used';

export type HintButtonStyle = {
  icon: 'bulb' | 'bulb-outline';
  iconColor: string;
  badge: 'count' | 'play' | 'none';
  badgeBg: string;
  badgeText: string;
  opacity: number;
};

export function hintButtonStyle(kind: HintButtonKind, p: Palette): HintButtonStyle {
  switch (kind) {
    case 'free':
      return { icon: 'bulb', iconColor: p.text, badge: 'count', badgeBg: p.accent, badgeText: p.onAccent, opacity: 1 };
    case 'ad':
      return { icon: 'bulb', iconColor: p.text, badge: 'play', badgeBg: DIFFICULTY_COLORS.hard, badgeText: '#2B2D42', opacity: 1 };
    case 'used':
      return { icon: 'bulb-outline', iconColor: p.textMuted, badge: 'none', badgeBg: 'transparent', badgeText: p.textMuted, opacity: 0.55 };
  }
}

export function resolveTheme(setting: ThemeSetting, systemDark: boolean): ThemeName {
  if (setting === 'system') return systemDark ? 'midnight' : 'paper';
  return setting;
}
