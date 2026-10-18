import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Translate } from '@/i18n';
import { AppText } from '@/components/ui';
import { FONTS, RADIUS, type Palette } from '@/theme/tokens';

export function NumberPad({
  remaining,
  active,
  onDigit,
  layout,
  keySize,
  palette: p,
  t,
  notesMode,
}: {
  /** Index 1-9: digits still to place. */
  remaining: number[];
  /** Number-first mode: the chosen digit (0 = none). */
  active: number;
  onDigit: (d: number) => void;
  layout: 'row' | 'grid';
  keySize: { width: number; height: number };
  palette: Palette;
  t: Translate;
  notesMode: boolean;
}) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return (
    <View style={[styles.wrap, layout === 'grid' ? styles.grid : styles.row, layout === 'grid' ? { width: keySize.width * 3 + 16 } : null]}>
      {digits.map((d) => {
        const left = remaining[d];
        const done = left <= 0;
        const on = active === d;
        const digitSize = Math.min(keySize.height * 0.5, keySize.width * 0.7);
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={done ? t('game.digitDone', { d }) : t('game.digit', { d, left })}
            accessibilityState={{ selected: on }}
            onPress={() => onDigit(d)}
            style={({ pressed }) => [
              styles.key,
              {
                width: keySize.width,
                height: keySize.height,
                backgroundColor: on ? p.keyActive : p.key,
                borderColor: p.border,
                opacity: pressed ? 0.7 : done && !on ? 0.4 : 1,
              },
            ]}>
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: notesMode ? FONTS.medium : FONTS.regular,
                fontSize: notesMode ? digitSize * 0.75 : digitSize,
                lineHeight: digitSize * 1.2,
                color: on ? p.keyActiveText : notesMode ? p.notes : p.keyText,
                fontVariant: ['tabular-nums'],
              }}>
              {d}
            </Text>
            {!done ? (
              <View style={[styles.badge, { backgroundColor: on ? p.keyActiveText : p.badge }]}>
                <AppText variant="meta" color={on ? p.keyActive : p.badgeText} style={styles.badgeText} allowFontScaling={false}>
                  {String(left)}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignSelf: 'center' },
  key: { borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 3, right: 3, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 13 },
});
