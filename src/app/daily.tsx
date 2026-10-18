import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, IconButton, Panel, Screen } from '@/components/ui';
import { levelName } from '@/i18n/explain';
import { useAds } from '@/lib/ads/ads-context';
import { useAppData } from '@/lib/app-data';
import { formatTime, monthTitle, shortDate } from '@/lib/format';
import { useT } from '@/lib/settings';
import { useNow } from '@/lib/use-now';
import { bestStreak, currentStreak, dailyLevel, dateKey, dayStatus, monthGrid, parseDateKey, type DayStatus } from '@/sudoku/daily';
import { usePalette } from '@/theme/theme-context';
import { difficultyColor, RADIUS, SPACE } from '@/theme/tokens';

export default function Daily() {
  const t = useT();
  const p = usePalette();
  const data = useAppData();
  const ads = useAds();
  const now = useNow();
  const today = dateKey(now);
  const todayDate = parseDateKey(today);
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const view = month ?? { y: todayDate.getFullYear(), m: todayDate.getMonth() };
  const selected = picked ?? today;
  const status = dayStatus(data.daily, selected, today);
  const cells = monthGrid(view.y, view.m);
  const isCurrentMonth = view.y === todayDate.getFullYear() && view.m === todayDate.getMonth();
  const streak = currentStreak(data.daily, today);
  const best = bestStreak(data.daily);
  const days = (n: number) => (n === 1 ? t('daily.day') : t('daily.days', { n }));
  const weekdays = t('weekday.short').split(',');

  const shift = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1, 12);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  const play = async (key: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await data.startDaily(key);
      router.push('/game');
    } finally {
      setBusy(false);
    }
  };

  const unlock = async (key: string) => {
    if (busy) return;
    if (!ads.offers.daily_unlock) {
      setNote(t('daily.noAd'));
      return;
    }
    setBusy(true);
    const earned = await ads.showRewarded('daily_unlock');
    setBusy(false);
    if (earned) {
      data.unlockDaily(key);
      void play(key);
    }
  };

  const result = data.daily.completed[selected];

  return (
    <Screen title={t('daily.title')} back>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.streaks}>
          <Panel style={styles.streakPanel}>
            <AppText variant="meta" color={p.textMuted}>
              {t('daily.streak')}
            </AppText>
            <AppText variant="title">{days(streak)}</AppText>
          </Panel>
          <Panel style={styles.streakPanel}>
            <AppText variant="meta" color={p.textMuted}>
              {t('daily.bestStreak')}
            </AppText>
            <AppText variant="title">{days(best)}</AppText>
          </Panel>
        </View>

        <Panel>
          <View style={styles.monthBar}>
            <IconButton icon="chevron-back" label={t('daily.prevMonth')} onPress={() => shift(-1)} />
            <AppText variant="heading" style={styles.monthTitle}>
              {monthTitle(view.y, view.m)}
            </AppText>
            <IconButton icon="chevron-forward" label={t('daily.nextMonth')} onPress={() => shift(1)} disabled={isCurrentMonth} />
          </View>
          <View style={styles.week}>
            {weekdays.map((w, i) => (
              <AppText key={i} variant="meta" color={p.textMuted} style={styles.weekday}>
                {w}
              </AppText>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((key, i) =>
              key ? (
                <DayCell key={key} day={Number(key.slice(8))} status={dayStatus(data.daily, key, today)} selected={key === selected} onPress={() => setPicked(key)} label={shortDate(key)} />
              ) : (
                <View key={`e${i}`} style={styles.dayWrap} />
              ),
            )}
          </View>
          <View style={styles.legend}>
            <Legend color={difficultyColor('easy', p)} label={t('daily.legendDone')} />
            <Legend color={p.textMuted} label={t('daily.legendMissed')} hollow />
          </View>
        </Panel>

        <View style={styles.action}>
          <AppText variant="meta" color={p.textMuted} style={styles.center}>
            {`${shortDate(selected)} · ${levelName(t, dailyLevel(selected))}`}
          </AppText>
          {status === 'done' && result ? (
            <AppText variant="bodyMedium" style={styles.center}>
              {t('daily.doneToday', { time: formatTime(result.timeMs) })}
            </AppText>
          ) : null}
          {status === 'today' ? <Button label={t('daily.playToday')} icon="play" busy={busy} onPress={() => play(today)} /> : null}
          {status === 'unlocked' ? <Button label={t('daily.play', { date: shortDate(selected) })} icon="play" busy={busy} onPress={() => play(selected)} /> : null}
          {status === 'missed' ? (
            <Button
              label={t('daily.unlock')}
              icon="play-circle-outline"
              detail={note ?? t('daily.unlockDetail')}
              busy={busy}
              onPress={() => unlock(selected)}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function DayCell({ day, status, selected, onPress, label }: { day: number; status: DayStatus; selected: boolean; onPress: () => void; label: string }) {
  const p = usePalette();
  const done = status === 'done';
  const dim = status === 'future' || status === 'expired';
  const bg = done ? difficultyColor('easy', p) : selected ? p.selected : 'transparent';
  const border = status === 'today' ? p.accent : status === 'unlocked' ? p.accent : status === 'missed' ? p.border : 'transparent';
  return (
    <View style={styles.dayWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${status}`}
        accessibilityState={{ selected, disabled: dim }}
        disabled={dim}
        onPress={onPress}
        style={[styles.day, { backgroundColor: bg, borderColor: selected && !done ? p.accent : border, opacity: dim ? 0.35 : 1 }]}>
        {done ? (
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        ) : (
          <AppText variant="label" color={p.text}>
            {String(day)}
          </AppText>
        )}
      </Pressable>
    </View>
  );
}

function Legend({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  const p = usePalette();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, hollow ? { borderColor: color, borderWidth: 1.5 } : { backgroundColor: color }]} />
      <AppText variant="meta" color={p.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.lg, paddingVertical: SPACE.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  streaks: { flexDirection: 'row', gap: SPACE.md },
  streakPanel: { flex: 1, gap: 2 },
  monthBar: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row', marginTop: SPACE.sm },
  weekday: { width: `${100 / 7}%`, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACE.xs },
  dayWrap: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  day: { flex: 1, borderRadius: RADIUS.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  legend: { flexDirection: 'row', gap: SPACE.lg, justifyContent: 'center', marginTop: SPACE.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  action: { gap: SPACE.sm },
  center: { textAlign: 'center' },
});
