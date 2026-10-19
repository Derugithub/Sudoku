import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText, Panel, Screen } from '@/components/ui';
import { levelName } from '@/i18n/explain';
import { useAppData } from '@/lib/app-data';
import { formatTime } from '@/lib/format';
import { useT } from '@/lib/settings';
import { LEVELS } from '@/sudoku/grader';
import { averageMs, winRate } from '@/sudoku/stats';
import { usePalette } from '@/theme/theme-context';
import { difficultyColor, SPACE } from '@/theme/tokens';

export default function Stats() {
  const t = useT();
  const p = usePalette();
  const { stats } = useAppData();
  const { width } = useWindowDimensions();
  const columns = width >= 900 ? 3 : width >= 600 ? 2 : 1;
  const none = t('stats.none');
  return (
    <Screen title={t('stats.title')} back wide={columns > 1}>
      <ScrollView contentContainerStyle={[styles.grid, columns > 1 ? styles.wrap : null]}>
        {LEVELS.map((level) => {
          const s = stats[level];
          const avg = averageMs(s);
          const rows: [string, string][] = [
            [t('stats.played'), String(s.played)],
            [t('stats.won'), String(s.won)],
            [t('stats.winRate'), s.played ? `${Math.round(winRate(s) * 100)}%` : none],
            [t('stats.best'), s.bestMs != null ? formatTime(s.bestMs) : none],
            [t('stats.average'), avg != null ? formatTime(avg) : none],
            [t('stats.streak'), String(s.streak)],
            [t('stats.bestStreak'), String(s.bestStreak)],
            [t('stats.perfect'), String(s.perfect)],
          ];
          return (
            <Panel key={level} style={[styles.card, columns > 1 ? { width: `${100 / columns - 2}%` } : null]}>
              <View style={styles.head}>
                <View style={[styles.dot, { backgroundColor: difficultyColor(level, p) }]} />
                <AppText variant="heading">{levelName(t, level)}</AppText>
              </View>
              {rows.map(([label, value]) => (
                <View key={label} style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
                  <AppText variant="body" color={p.textMuted} style={styles.label} numberOfLines={2}>
                    {label}
                  </AppText>
                  <AppText variant="bodyMedium" style={styles.value}>
                    {value}
                  </AppText>
                </View>
              ))}
            </Panel>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: SPACE.md, paddingVertical: SPACE.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  card: { gap: SPACE.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 28, alignItems: 'center', gap: SPACE.md },
  // The label takes all the spare width instead of shrinking to its measured size. On Android,
  // a shrink-to-fit label can measure a few pixels short with Inter, wrap its last word and clip it
  // ("Win streak" showed as "Win").
  label: { flex: 1 },
  value: { flexShrink: 0, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
