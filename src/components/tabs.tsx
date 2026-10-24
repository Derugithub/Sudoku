import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { usePalette } from '@/theme/theme-context';
import { RADIUS, SPACE } from '@/theme/tokens';

export type TabItem<T extends string> = { value: T; label: string };

/** A horizontally scrolling row of pill tabs, in the same colors as the Segmented control. */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const p = usePalette();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => {
          const on = item.value === value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(item.value)}
              style={[styles.tab, { backgroundColor: on ? p.accent : p.surfaceAlt, borderColor: on ? p.accent : p.border }]}>
              <AppText variant="label" color={on ? p.onAccent : p.text} numberOfLines={1}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACE.sm, paddingVertical: SPACE.sm },
  tab: { minHeight: 44, paddingHorizontal: SPACE.lg, borderRadius: RADIUS.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
