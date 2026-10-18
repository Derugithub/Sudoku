import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { mulberry32 } from '@/sudoku/rng';
import { DIFFICULTY_COLORS, MOTION } from '@/theme/tokens';

const COLORS = [DIFFICULTY_COLORS.easy, DIFFICULTY_COLORS.medium, DIFFICULTY_COLORS.hard, DIFFICULTY_COLORS.master, '#7FB3E8'];

type Piece = { x: number; delay: number; drift: number; spin: number; size: number; color: string };

/** A subtle one-shot confetti fall for the win screen. */
export function Confetti({ width, height, seed = 1 }: { width: number; height: number; seed?: number }) {
  const pieces = useMemo<Piece[]>(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: MOTION.confettiCount }, () => ({
      x: rng() * width,
      delay: rng() * 400,
      drift: (rng() - 0.5) * 80,
      spin: (rng() - 0.5) * 720,
      size: 6 + rng() * 5,
      color: COLORS[Math.floor(rng() * COLORS.length)],
    }));
  }, [width, seed]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => (
        <Bit key={i} piece={piece} height={height} />
      ))}
    </View>
  );
}

function Bit({ piece, height }: { piece: Piece; height: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(piece.delay, withTiming(1, { duration: MOTION.confettiMs, easing: Easing.out(Easing.quad) })));
  }, [piece.delay, progress]);
  const style = useAnimatedStyle(() => {
    const v = progress.get();
    return {
      opacity: v < 0.8 ? 1 : (1 - v) * 5,
      transform: [
        { translateX: piece.x + piece.drift * v },
        { translateY: -20 + v * height * 0.7 },
        { rotate: `${piece.spin * v}deg` },
      ],
    };
  });
  return <Animated.View style={[styles.bit, { width: piece.size, height: piece.size * 0.5, backgroundColor: piece.color }, style]} />;
}

const styles = StyleSheet.create({
  bit: { position: 'absolute', left: 0, top: 0, borderRadius: 1 },
});
