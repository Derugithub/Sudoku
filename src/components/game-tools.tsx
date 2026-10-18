import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Translate } from '@/i18n';
import { AppText, type IconName } from '@/components/ui';
import type { HintButtonState } from '@/sudoku/hints';
import { hintButtonStyle, RADIUS, type Palette } from '@/theme/tokens';

function Tool({
  icon,
  label,
  onPress,
  palette: p,
  active,
  disabled,
  badge,
  opacity = 1,
  iconColor,
  a11y,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  palette: Palette;
  active?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  opacity?: number;
  iconColor?: string;
  a11y?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tool, { opacity: disabled ? 0.4 : pressed ? 0.6 : opacity }]}>
      <View style={[styles.iconWrap, active ? { backgroundColor: p.accent } : null]}>
        <Ionicons name={icon} size={24} color={active ? p.onAccent : (iconColor ?? p.text)} />
        {badge}
      </View>
      <AppText variant="label" color={active ? p.accent : p.textMuted} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function GameTools({
  palette: p,
  t,
  canUndo,
  notesMode,
  hint,
  onUndo,
  onErase,
  onNotes,
  onHint,
}: {
  palette: Palette;
  t: Translate;
  canUndo: boolean;
  notesMode: boolean;
  hint: HintButtonState;
  onUndo: () => void;
  onErase: () => void;
  onNotes: () => void;
  onHint: () => void;
}) {
  const hs = hintButtonStyle(hint.kind, p);
  const badge =
    hs.badge === 'count' && hint.kind === 'free' ? (
      <View style={[styles.badge, { backgroundColor: hs.badgeBg }]}>
        <AppText variant="meta" color={hs.badgeText} style={styles.badgeText} allowFontScaling={false}>
          {String(hint.left)}
        </AppText>
      </View>
    ) : hs.badge === 'play' ? (
      <View style={[styles.badge, styles.playBadge, { backgroundColor: hs.badgeBg }]}>
        <Ionicons name="play" size={8} color={hs.badgeText} />
        <AppText variant="meta" color={hs.badgeText} style={styles.badgeText} allowFontScaling={false}>
          +1
        </AppText>
      </View>
    ) : null;
  const hintA11y =
    hint.kind === 'free'
      ? `${t('game.hint')}, ${t('game.hintFree', { n: hint.left })}`
      : hint.kind === 'ad'
        ? t('game.hintAd')
        : t('game.hintUsed');
  return (
    <View style={styles.row}>
      <Tool icon="arrow-undo-outline" label={t('game.undo')} onPress={onUndo} palette={p} disabled={!canUndo} />
      <Tool icon="backspace-outline" label={t('game.erase')} onPress={onErase} palette={p} />
      <Tool
        icon="pencil-outline"
        label={notesMode ? t('game.notesOn') : t('game.notes')}
        onPress={onNotes}
        palette={p}
        active={notesMode}
      />
      <Tool
        icon={hs.icon}
        label={t('game.hint')}
        onPress={onHint}
        palette={p}
        badge={badge}
        opacity={hs.opacity}
        iconColor={hs.iconColor}
        a11y={hintA11y}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  tool: { minWidth: 64, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: RADIUS.md },
  iconWrap: { width: 48, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  playBadge: { flexDirection: 'row', gap: 1, right: -4 },
  badgeText: { fontSize: 10, lineHeight: 13, fontWeight: '600' },
});
