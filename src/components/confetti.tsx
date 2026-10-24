import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { layoutConfetti, layoutStaticConfetti, type ConfettiPiece, type ConfettiShape } from '@/lib/confetti-layout';
import { DIFFICULTY_COLORS, MOTION } from '@/theme/tokens';

const COLORS = [
  DIFFICULTY_COLORS.easy,
  DIFFICULTY_COLORS.medium,
  DIFFICULTY_COLORS.hard,
  DIFFICULTY_COLORS.expert,
  DIFFICULTY_COLORS.master,
  '#7FB3E8',
  '#F2C94C',
];

/** Fall start sits above the screen; end sits below it. */
const MARGIN = 48;

function pieceBox(shape: ConfettiShape, size: number): { width: number; height: number; borderRadius: number } {
  switch (shape) {
    case 'dot':
      return { width: size * 0.7, height: size * 0.7, borderRadius: size };
    case 'strip':
      return { width: size * 0.45, height: size * 1.6, borderRadius: 1 };
    case 'rect':
      return { width: size, height: size * 0.55, borderRadius: 1.5 };
  }
}

/**
 * Full-screen confetti for the win card. It draws over everything and ignores touches. With
 * Reduce Motion on, it shows a lighter, still scatter instead of a fall.
 */
export function Confetti({ width, height, seed = 1 }: { width: number; height: number; seed?: number }) {
  const reduced = useReducedMotion();
  const options = useMemo(
    () => ({
      seed,
      width,
      colors: COLORS,
      count: reduced ? MOTION.confettiStaticCount : MOTION.confettiCount,
      minMs: MOTION.confettiMinMs,
      maxMs: MOTION.confettiMaxMs,
      maxDelayMs: MOTION.confettiDelayMs,
      height,
    }),
    [seed, width, height, reduced],
  );
  const falling = useMemo<ConfettiPiece[]>(() => (reduced ? [] : layoutConfetti(options)), [options, reduced]);
  const resting = useMemo(() => (reduced ? layoutStaticConfetti(options) : []), [options, reduced]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {falling.map((piece, i) => (
        <FallingBit key={i} piece={piece} height={height} />
      ))}
      {resting.map((piece, i) => (
        <View
          key={i}
          style={[
            styles.bit,
            pieceBox(piece.shape, piece.size),
            { backgroundColor: piece.color, opacity: 0.85, transform: [{ translateX: piece.x }, { translateY: piece.y }, { rotate: `${piece.tilt}deg` }] },
          ]}
        />
      ))}
    </View>
  );
}

function FallingBit({ piece, height }: { piece: ConfettiPiece; height: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(piece.delay, withTiming(1, { duration: piece.duration, easing: Easing.linear })));
    return () => cancelAnimation(progress);
  }, [piece.delay, piece.duration, progress]);
  const style = useAnimatedStyle(() => {
    const v = progress.get();
    return {
      opacity: v < 0.92 ? 1 : (1 - v) / 0.08,
      transform: [
        { translateX: piece.x + Math.sin(v * piece.swayCycles * 2 * Math.PI) * piece.sway },
        { translateY: -MARGIN + v * (height + MARGIN * 2) },
        { rotate: `${piece.spin * v}deg` },
        { perspective: 600 },
        { rotateX: `${piece.flip * v}deg` },
      ],
    };
  });
  return <Animated.View style={[styles.bit, pieceBox(piece.shape, piece.size), { backgroundColor: piece.color }, style]} />;
}

const styles = StyleSheet.create({
  bit: { position: 'absolute', left: 0, top: 0 },
});
