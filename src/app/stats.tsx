import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Tabs, type TabItem } from '@/components/tabs';
import { AppText, Panel, Screen } from '@/components/ui';
import { levelName } from '@/i18n/explain';
import { useAppData } from '@/lib/app-data';
import { formatTime } from '@/lib/format';
import { useT } from '@/lib/settings';
import { LEVELS } from '@/sudoku/grader';
import { averageMs, overallAverageMs, overallStats, overallWinRate, STATS_TABS, winRate, type StatsTab } from '@/sudoku/stats';
import { usePalette } from '@/theme/theme-context';
import { difficultyColor, SPACE } from '@/theme/tokens';

type Row = [string, string];

export default function Stats() {
  const t = useT();
  const p = usePalette();
  const { stats } = useAppData();
  const [tab, setTab] = useState<StatsTab>('overall');
  const none = t('stats.none');
  const percent = (rate: number, played: number) => (played ? `${Math.round(rate * 100)}%` : none);

  const items: TabItem<StatsTab>[] = STATS_TABS.map((value) => ({
    value,
    label: value === 'overall' ? t('stats.overall') : levelName(t, value),
  }));

  let body;
  if (tab === 'overall') {
    const o = overallStats(stats);
    const avg = overallAverageMs(o);
    const rows: Row[] = [
      [t('stats.played'), String(o.played)],
      [t('stats.won'), String(o.won)],
      [t('stats.winRate'), percent(overallWinRate(o), o.played)],
      [t('stats.average'), avg != null ? formatTime(avg) : none],
      [t('stats.bestStreak'), String(o.bestStreak)],
      [t('stats.perfect'), String(o.perfect)],
    ];
    body =
      o.played === 0 ? (
        <Empty text={t('stats.emptyAll')} />
      ) : (
        <>
          <Panel style={styles.card}>
            <StatRows rows={rows} />
          </Panel>
          <Panel style={styles.card}>
            <AppText variant="heading" style={styles.head}>
              {t('stats.byLevel')}
            </AppText>
            {LEVELS.map((level) => {
              const s = stats[level];
              const value = s.played ? `${s.won}/${s.played} · ${percent(winRate(s), s.played)}` : none;
              return (
                <View key={level} style={styles.row} accessible accessibilityLabel={`${levelName(t, level)}: ${value}`}>
                  <View style={styles.levelTag}>
                    <View style={[styles.dot, { backgroundColor: difficultyColor(level, p) }]} />
                    <AppText variant="body" color={p.textMuted} numberOfLines={1} style={styles.label}>
                      {levelName(t, level)}
                    </AppText>
                  </View>
                  <AppText variant="bodyMedium" style={styles.value}>
                    {value}
                  </AppText>
                </View>
              );
            })}
          </Panel>
        </>
      );
  } else {
    const s = stats[tab];
    const avg = averageMs(s);
    const rows: Row[] = [
      [t('stats.played'), String(s.played)],
      [t('stats.won'), String(s.won)],
      [t('stats.winRate'), percent(winRate(s), s.played)],
      [t('stats.best'), s.bestMs != null ? formatTime(s.bestMs) : none],
      [t('stats.average'), avg != null ? formatTime(avg) : none],
      [t('stats.streak'), String(s.streak)],
      [t('stats.bestStreak'), String(s.bestStreak)],
      [t('stats.perfect'), String(s.perfect)],
    ];
    body =
      s.played === 0 ? (
        <Empty text={t('stats.emptyLevel', { level: levelName(t, tab) })} />
      ) : (
        <Panel style={styles.card}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: difficultyColor(tab, p) }]} />
            <AppText variant="heading">{levelName(t, tab)}</AppText>
          </View>
          <StatRows rows={rows} />
        </Panel>
      );
  }

  return (
    <Screen title={t('stats.title')} back>
      <Tabs label={t('stats.tabs')} items={items} value={tab} onChange={setTab} />
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
    </Screen>
  );
}

function StatRows({ rows }: { rows: Row[] }) {
  const p = usePalette();
  return (
    <>
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
    </>
  );
}

function Empty({ text }: { text: string }) {
  const p = usePalette();
  return (
    <Panel style={styles.empty}>
      <AppText variant="body" color={p.textMuted} style={styles.emptyText}>
        {text}
      </AppText>
    </Panel>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingTop: SPACE.sm, paddingBottom: SPACE.lg },
  card: { gap: SPACE.xs },
  head: { marginBottom: SPACE.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.xs },
  levelTag: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 28, alignItems: 'center', gap: SPACE.md },
  // The label takes all the spare width instead of shrinking to its measured size. On Android,
  // a shrink-to-fit label can measure a few pixels short with Inter, wrap its last word and clip it
  // ("Win streak" showed as "Win").
  label: { flex: 1 },
  value: { flexShrink: 0, textAlign: 'right', fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center' },
  emptyText: { textAlign: 'center' },
});
