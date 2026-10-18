/**
 * A small typed dictionary. English is the only language in v1; the structure (one file per
 * language with the same keys, plus the language setting) is ready for Amharic after launch.
 */
import { en, type StringKey } from './en';

export type { StringKey };
export type Params = Record<string, string | number>;
export type Translate = (key: StringKey, params?: Params) => string;

export const LANGUAGES = [{ code: 'en', name: 'English' }] as const;
export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const DICTIONARIES: Record<LanguageCode, Record<StringKey, string>> = { en };

export function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function translator(language: LanguageCode = 'en'): Translate {
  const dict = DICTIONARIES[language] ?? en;
  return (key, params) => format(dict[key] ?? en[key] ?? key, params);
}

export const t: Translate = translator('en');
