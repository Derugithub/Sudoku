/** Settings shape and parsing (pure, tested). */
import type { LanguageCode } from '@/i18n';
import type { ThemeSetting } from '@/theme/tokens';

export type InputMode = 'cell' | 'number';

export type Settings = {
  theme: ThemeSetting;
  inputMode: InputMode;
  mistakeCheck: boolean;
  mistakeLimit: boolean;
  highlightUnits: boolean;
  highlightSame: boolean;
  autoRemoveNotes: boolean;
  showTimer: boolean;
  sound: boolean;
  vibration: boolean;
  language: LanguageCode;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  inputMode: 'cell',
  mistakeCheck: true,
  mistakeLimit: true,
  highlightUnits: true,
  highlightSame: true,
  autoRemoveNotes: true,
  showTimer: true,
  sound: true,
  vibration: true,
  language: 'en',
};

const THEMES = ['system', 'paper', 'midnight', 'contrast'];

export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    const bool = (k: keyof Settings) => (typeof v[k] === 'boolean' ? (v[k] as boolean) : (DEFAULT_SETTINGS[k] as boolean));
    return {
      theme: THEMES.includes(v.theme as string) ? (v.theme as ThemeSetting) : DEFAULT_SETTINGS.theme,
      inputMode: v.inputMode === 'number' ? 'number' : 'cell',
      mistakeCheck: bool('mistakeCheck'),
      mistakeLimit: bool('mistakeLimit'),
      highlightUnits: bool('highlightUnits'),
      highlightSame: bool('highlightSame'),
      autoRemoveNotes: bool('autoRemoveNotes'),
      showTimer: bool('showTimer'),
      sound: bool('sound'),
      vibration: bool('vibration'),
      language: 'en',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
