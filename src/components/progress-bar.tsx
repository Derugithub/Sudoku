import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import type { Translate } from '@/i18n';
import type { Palette } from '@/theme/tokens';
import { MOTION, PROGRESS } from '@/theme/tokens';

export const PROGRESS_ROW_HEIGHT = 30;

/** Puzzle progress under the stats row: the percentage centred above a 6px rounded bar. */
export function ProgressBar({ percent, palette: p, t }: { percent: number; palette: Palette; t: Translate }) {
  const width = useSharedValue(percent);
  useEffect(() => {
    width.set(withTiming(percent, { duration: MOTION.progressMs }));
  }, [percent, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.get()}%` }));
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('game.progress', { n: percent })}
      accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <AppText variant="heading" color={p.textMuted} style={styles.label}>
        {`${percent}%`}
      </AppText>
      <View style={[styles.track, { backgroundColor: p.progressTrack }]}>
        <Animated.View style={[styles.fill, { backgroundColor: p.progressFill }, fill]} />
      </View>
    </View>
  );
}

const R = PROGRESS.trackHeight / 2;
const styles = StyleSheet.create({
  wrap: { height: PROGRESS_ROW_HEIGHT, justifyContent: 'center', gap: PROGRESS.gap },
  // 12px Inter SemiBold (the heading face at a small size).
  label: { fontSize: PROGRESS.labelSize, lineHeight: 16, textAlign: 'center', fontVariant: ['tabular-nums'] },
  track: { height: PROGRESS.trackHeight, borderRadius: R, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: R },
});
