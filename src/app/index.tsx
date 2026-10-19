import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AdFreeButton } from '@/components/ad-free-button';
import { MenuBanner } from '@/components/ad-banner';
import { AppText, Button, Screen } from '@/components/ui';
import { levelName } from '@/i18n/explain';
import { useAppData } from '@/lib/app-data';
import { formatTime } from '@/lib/format';
import { useT } from '@/lib/settings';
import { useNow } from '@/lib/use-now';
import { currentStreak, dateKey } from '@/sudoku/daily';
import { usePalette } from '@/theme/theme-context';
import { difficultyColor, RADIUS, SPACE } from '@/theme/tokens';

export default function Home() {
  const t = useT();
  const p = usePalette();
  const data = useAppData();
  const now = useNow();
  const today = dateKey(now);
  const streak = currentStreak(data.daily, today);
  const doneToday = Boolean(data.daily.completed[today]);
  const game = data.game && data.game.status === 'playing' ? data.game : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Logo />
          <AppText variant="display" accessibilityRole="header">
            {t('app.name')}
          </AppText>
          <AppText variant="body" color={p.textMuted}>
            {t('app.tagline')}
          </AppText>
        </View>

        <View style={styles.actions}>
          {game ? (
            <Button
              label={t('home.continue')}
              icon="play"
              detail={t('home.continueDetail', { level: levelName(t, game.level), time: formatTime(game.elapsedMs) })}
              onPress={() => router.push('/game')}
            />
          ) : null}
          <Button label={t('home.newGame')} icon="grid-outline" kind={game ? 'secondary' : 'primary'} onPress={() => router.push('/levels')} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('home.daily')}. ${doneToday ? t('home.dailyDone', { n: streak }) : t('home.dailyOpen', { n: streak })}`}
            onPress={() => router.push('/daily')}
            style={({ pressed }) => [styles.daily, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.8 : 1 }]}>
            <View style={[styles.dailyIcon, { backgroundColor: doneToday ? difficultyColor('easy', p) : p.accent }]}>
              <Ionicons name={doneToday ? 'checkmark' : 'calendar-outline'} size={22} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <AppText variant="heading">{t('home.daily')}</AppText>
              <AppText variant="meta" color={p.textMuted}>
                {doneToday ? t('home.dailyDone', { n: streak }) : t('home.dailyOpen', { n: streak })}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={p.textMuted} />
          </Pressable>

          <View style={styles.row}>
            <Button style={styles.flex} kind="secondary" icon="stats-chart-outline" label={t('home.stats')} onPress={() => router.push('/stats')} />
            <Button style={styles.flex} kind="secondary" icon="settings-outline" label={t('home.settings')} onPress={() => router.push('/settings')} />
          </View>
          <AdFreeButton />
        </View>
      </ScrollView>
      <MenuBanner />
    </Screen>
  );
}

// The bare Sudoku mark (no tile), with @2x/@3x versions picked by screen density.
const LOGO_LIGHT = require('../../assets/images/logo-mark.png');
const LOGO_DARK = require('../../assets/images/logo-mark-dark.png');

function Logo() {
  const p = usePalette();
  return (
    <Image
      source={p.dark ? LOGO_DARK : LOGO_LIGHT}
      style={styles.logo}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: SPACE.xl, gap: SPACE.xl },
  hero: { alignItems: 'center', gap: SPACE.sm },
  actions: { gap: SPACE.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: SPACE.md },
  flex: { flex: 1 },
  daily: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, borderRadius: RADIUS.lg, borderWidth: 1, minHeight: 72 },
  dailyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 112, height: 112, marginBottom: SPACE.sm },
});
