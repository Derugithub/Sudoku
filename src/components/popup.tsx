import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { AppText, type IconName } from '@/components/ui';
import { useT } from '@/lib/settings';
import { usePalette } from '@/theme/theme-context';
import { hintButtonStyle, MOTION, POPUP, SPACE } from '@/theme/tokens';

/**
 * A compact card (about 280 wide, sized to its content) over a light scrim, so the board stays
 * visible behind it. It blocks touches to the board. Pause, out of mistakes and confirmations.
 */
export function Popup({
  title,
  subtitle,
  body,
  icon,
  iconColor,
  children,
}: {
  title: string;
  /** One small gray line under the title (e.g. time and difficulty). */
  subtitle?: string;
  body?: string;
  icon?: IconName;
  iconColor?: string;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} accessibilityViewIsModal>
      <Animated.View entering={FadeIn.duration(MOTION.placeMs)} style={[StyleSheet.absoluteFill, { backgroundColor: POPUP.scrim }]} />
      <Animated.View entering={ZoomIn.duration(MOTION.rippleMs)} style={[styles.card, { backgroundColor: p.surface }]}>
        {icon ? <Ionicons name={icon} size={28} color={iconColor ?? p.popupPrimary} style={styles.icon} /> : null}
        <AppText variant="heading" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="meta" color={p.textMuted} style={styles.text} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        {body ? (
          <AppText variant="body" color={p.textMuted} style={[styles.text, styles.body]}>
            {body}
          </AppText>
        ) : null}
        <View style={styles.actions}>{children}</View>
      </Animated.View>
    </View>
  );
}

/** 48px popup button: filled (the main action) or outlined. Optional rewarded-ad badge. */
export function PopupButton({
  label,
  onPress,
  kind = 'outlined',
  icon,
  detail,
  ad,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  kind?: 'filled' | 'outlined' | 'text';
  icon?: IconName;
  detail?: string;
  ad?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  const p = usePalette();
  const t = useT();
  const adStyle = hintButtonStyle('ad', p);
  const ink = kind === 'filled' ? p.popupPrimaryText : kind === 'outlined' ? p.popupPrimary : p.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, ad ? t('common.ad') : null, detail].filter(Boolean).join('. ')}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        kind === 'filled'
          ? { backgroundColor: p.popupPrimary, borderColor: p.popupPrimary }
          : kind === 'outlined'
            ? { borderColor: p.popupPrimary }
            : { borderColor: 'transparent' },
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}>
      {busy ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={ink} /> : null}
          <View style={styles.buttonText}>
            <AppText variant="bodyMedium" color={ink} numberOfLines={1}>
              {label}
            </AppText>
            {detail ? (
              <AppText variant="meta" color={ink} numberOfLines={1} style={styles.detail}>
                {detail}
              </AppText>
            ) : null}
          </View>
          {ad ? (
            <View style={[styles.adBadge, { backgroundColor: adStyle.badgeBg }]}>
              <Ionicons name="play" size={10} color={adStyle.badgeText} />
              <AppText variant="meta" color={adStyle.badgeText} style={styles.adText} allowFontScaling={false}>
                {t('common.ad')}
              </AppText>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  card: { width: '100%', maxWidth: POPUP.width, borderRadius: POPUP.radius, padding: POPUP.padding, alignItems: 'center' },
  icon: { marginBottom: SPACE.xs },
  title: { fontSize: POPUP.titleSize, lineHeight: 24, textAlign: 'center' },
  text: { textAlign: 'center', marginTop: 2 },
  body: { marginTop: SPACE.xs },
  actions: { alignSelf: 'stretch', gap: POPUP.buttonGap, marginTop: SPACE.lg },
  button: {
    height: POPUP.buttonHeight,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
  },
  buttonText: { alignItems: 'center', flexShrink: 1 },
  detail: { opacity: 0.85, fontSize: 11, lineHeight: 13 },
  adBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 20, paddingHorizontal: 6, borderRadius: 10 },
  adText: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
});
