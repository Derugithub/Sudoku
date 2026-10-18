import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MenuBanner } from '@/components/ad-banner';
import { AppText, Screen } from '@/components/ui';
import { levelName } from '@/i18n/explain';
import type { StringKey } from '@/i18n';
import { useAppData } from '@/lib/app-data';
import { formatTime } from '@/lib/format';
import { useT } from '@/lib/settings';
import { LEVELS, type Level } from '@/sudoku/grader';
import { usePalette } from '@/theme/theme-context';
import { difficultyColor, RADIUS, SPACE } from '@/theme/tokens';

export default function Levels() {
  const t = useT();
  const p = usePalette();
  const data = useAppData();
  const [busy, setBusy] = useState<Level | null>(null);

  const start = async (level: Level) => {
    if (busy) return;
    setBusy(level);
    try {
      await data.startLevel(level);
      router.replace('/game');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title={t('levels.title')} back>
      <ScrollView contentContainerStyle={styles.list}>
        {LEVELS.map((level) => {
          const best = data.stats[level].bestMs;
          const color = difficultyColor(level, p);
          return (
            <Pressable
              key={level}
              accessibilityRole="button"
              accessibilityLabel={`${levelName(t, level)}. ${t(`levelInfo.${level}` as StringKey)}`}
              onPress={() => start(level)}
              style={({ pressed }) => [styles.item, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.stripe, { backgroundColor: color }]} />
              <View style={styles.text}>
                <AppText variant="heading">{levelName(t, level)}</AppText>
                <AppText variant="meta" color={p.textMuted}>
                  {t(`levelInfo.${level}` as StringKey)}
                </AppText>
              </View>
              {busy === level ? (
                <ActivityIndicator color={color} />
              ) : best != null ? (
                <AppText variant="meta" color={p.textMuted}>
                  {t('levels.best', { time: formatTime(best) })}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <MenuBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.md, paddingVertical: SPACE.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 72, borderRadius: RADIUS.lg, borderWidth: 1, paddingRight: SPACE.lg, overflow: 'hidden' },
  stripe: { width: 8, alignSelf: 'stretch' },
  text: { flex: 1, paddingVertical: SPACE.md, gap: 2 },
});
