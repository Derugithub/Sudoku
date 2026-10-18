import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { RADIUS, SPACE, type Palette } from '@/theme/tokens';

/** The hint explanation: technique name, plain-words reason, and a dismiss button. */
export function HintCard({
  title,
  body,
  dismissLabel,
  onDismiss,
  palette: p,
}: {
  title: string;
  body: string;
  dismissLabel: string;
  onDismiss: () => void;
  palette: Palette;
}) {
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <Ionicons name="bulb" size={18} color={p.accent} />
        <AppText variant="heading" style={styles.title}>
          {title}
        </AppText>
      </View>
      <AppText variant="body" color={p.text}>
        {body}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dismissLabel}
        onPress={onDismiss}
        style={({ pressed }) => [styles.dismiss, { backgroundColor: p.accent, opacity: pressed ? 0.8 : 1 }]}>
        <AppText variant="bodyMedium" color={p.onAccent}>
          {dismissLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.lg, gap: SPACE.sm, elevation: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  title: { flex: 1 },
  dismiss: { alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: SPACE.lg, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
});
