import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import type { Palette } from '@/theme/tokens';
import { MOTION, SPACE } from '@/theme/tokens';

/** A short, non-blocking message (e.g. "Music off"). The screen removes it after a moment. */
export function Toast({ text, palette: p, top }: { text: string; palette: Palette; top: number }) {
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(MOTION.placeMs)}
      exiting={FadeOut.duration(MOTION.placeMs)}
      style={[styles.toast, { top, backgroundColor: p.text }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert">
      <AppText variant="label" color={p.bg}>
        {text}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: 18 },
});
