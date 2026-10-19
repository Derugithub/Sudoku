import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AdsProvider } from '@/lib/ads/ads-provider';
import { AppDataProvider } from '@/lib/app-data';
import { preloadFeedback } from '@/lib/feedback';
import { setMusicEnabled } from '@/lib/music';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { useTheme } from '@/theme/theme-context';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useEffect(() => {
    preloadFeedback();
  }, []);
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <AdsProvider>
            <AppDataProvider>
              <Themed>
                <MusicSync />
                <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="levels" options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="game" options={{ gestureEnabled: false }} />
                  <Stack.Screen name="daily" options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="stats" options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
                </Stack>
              </Themed>
            </AppDataProvider>
          </AdsProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Follows the Music setting once settings are loaded, so a saved "off" never plays a note. */
function MusicSync() {
  const { settings, loaded } = useSettings();
  useEffect(() => {
    if (loaded) setMusicEnabled(settings.music);
  }, [loaded, settings.music]);
  return null;
}

/** Applies the resolved theme to navigation, the status bar and the window, and hides the splash. */
function Themed({ children }: { children: ReactNode }) {
  const { palette } = useTheme();
  const { loaded } = useSettings();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.bg).catch(() => undefined);
  }, [palette.bg]);
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);
  const base = palette.dark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background: palette.bg, card: palette.bg, text: palette.text, border: palette.border, primary: palette.accent },
      }}>
      <StatusBar style={palette.dark ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  );
}
