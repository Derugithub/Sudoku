/** Settings shape, parsing and migration (pure, tested). */
import type { LanguageCode } from '@/i18n';
import type { ThemeSetting } from '@/theme/tokens';

export type InputMode = 'cell' | 'number';

export type Settings = {
  theme: ThemeSetting;
  inputMode: InputMode;
  /** Wrong digits turn red and count as mistakes. Three mistakes always end the game. */
  mistakeCheck: boolean;
  highlightUnits: boolean;
  highlightSame: boolean;
  autoRemoveNotes: boolean;
  showTimer: boolean;
  sound: boolean;
  /** Soft background piano. On by default at a low volume. */
  music: boolean;
  vibration: boolean;
  language: LanguageCode;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  inputMode: 'cell',
  mistakeCheck: true,
  highlightUnits: true,
  highlightSame: true,
  autoRemoveNotes: true,
  showTimer: true,
  sound: true,
  music: true,
  vibration: true,
  language: 'en',
};

/**
 * Keys that older versions saved and this one dropped. `mistakeLimit` was the optional
 * three-mistake limit; the limit is now always on, so the saved choice is discarded.
 */
export const LEGACY_SETTING_KEYS = ['mistakeLimit'] as const;

const THEMES = ['system', 'paper', 'midnight', 'contrast'];

/**
 * Parses saved settings and reports whether the stored copy should be rewritten (it carried a
 * legacy key or predates a new setting), so the migration runs once and the old key disappears.
 */
export function migrateSettings(raw: string | null): { settings: Settings; changed: boolean } {
  if (!raw) return { settings: DEFAULT_SETTINGS, changed: false };
  let v: Partial<Record<string, unknown>>;
  try {
    v = JSON.parse(raw) as Partial<Record<string, unknown>>;
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
  } catch {
    return { settings: DEFAULT_SETTINGS, changed: true };
  }
  const bool = (k: keyof Settings) => (typeof v[k] === 'boolean' ? (v[k] as boolean) : (DEFAULT_SETTINGS[k] as boolean));
  const settings: Settings = {
    theme: THEMES.includes(v.theme as string) ? (v.theme as ThemeSetting) : DEFAULT_SETTINGS.theme,
    inputMode: v.inputMode === 'number' ? 'number' : 'cell',
    mistakeCheck: bool('mistakeCheck'),
    highlightUnits: bool('highlightUnits'),
    highlightSame: bool('highlightSame'),
    autoRemoveNotes: bool('autoRemoveNotes'),
    showTimer: bool('showTimer'),
    sound: bool('sound'),
    music: bool('music'),
    vibration: bool('vibration'),
    language: 'en',
  };
  const changed = LEGACY_SETTING_KEYS.some((k) => k in v) || !('music' in v);
  return { settings, changed };
}

export function parseSettings(raw: string | null): Settings {
  return migrateSettings(raw).settings;
}
