import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import type { IconName } from '@/components/ui';
import { TOP_BAR } from '@/theme/tokens';

/**
 * A 24px line icon in a square tap area (48dp, or 44 on very narrow screens). `off` draws the
 * icon at 60% opacity with a diagonal slash (used for Music off).
 */
export function TopIcon({
  icon,
  label,
  onPress,
  color,
  target,
  off,
  toggle,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color: string;
  target: number;
  off?: boolean;
  /** Announce as a switch with this on/off state. */
  toggle?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={toggle ? 'switch' : 'button'}
      accessibilityLabel={label}
      accessibilityState={toggle ? { checked: !off, disabled: !!disabled } : { disabled: !!disabled }}
      aria-checked={toggle ? !off : undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.target, { width: target, height: target, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>
      <View style={{ opacity: off ? TOP_BAR.offOpacity : 1 }}>
        <Ionicons name={icon} size={TOP_BAR.iconSize} color={color} />
        {off ? <View pointerEvents="none" style={[styles.slash, { backgroundColor: color }]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  slash: {
    position: 'absolute',
    left: -2,
    top: TOP_BAR.iconSize / 2 - 1,
    width: TOP_BAR.iconSize + 4,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
});
