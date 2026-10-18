import { useColorScheme } from 'react-native';

import { useSettings } from '@/lib/settings';
import { PALETTES, resolveTheme, type Palette, type ThemeName } from '@/theme/tokens';

export function useTheme(): { name: ThemeName; palette: Palette } {
  const { settings } = useSettings();
  const scheme = useColorScheme();
  const name = resolveTheme(settings.theme, scheme === 'dark');
  return { name, palette: PALETTES[name] };
}

export function usePalette(): Palette {
  return useTheme().palette;
}
