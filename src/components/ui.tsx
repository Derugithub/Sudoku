import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/lib/settings';
import { renderFontChildren, systemFaceOverride, type FontWeight } from '@/theme/font-text';
import { usePalette } from '@/theme/theme-context';
import { RADIUS, SPACE, TYPE } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];
type Variant = keyof typeof TYPE;

const WEIGHT: Record<Variant, FontWeight> = {
  display: '700',
  title: '600',
  heading: '600',
  body: '400',
  bodyMedium: '500',
  label: '500',
  meta: '400',
};

export const MAX_CONTENT_WIDTH = 720;

/** Text in Inter. Scripts Inter lacks (Amharic) switch to the system face per run. */
export function AppText({
  children,
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; children?: ReactNode }) {
  const palette = usePalette();
  const v = TYPE[variant];
  const weight = WEIGHT[variant];
  const only = typeof children === 'string' ? children : null;
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: v.font, fontSize: v.size, lineHeight: v.line, color: color ?? palette.text },
        style,
        only ? systemFaceOverride(only, weight) : null,
      ]}>
      {renderFontChildren(children, weight)}
    </Text>
  );
}

/** Full screen with safe-area insets on every side (edge-to-edge) and a centred column. */
export function Screen({
  children,
  title,
  back,
  right,
  style,
  wide,
}: {
  children: ReactNode;
  title?: string;
  back?: boolean;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
  wide?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const t = useT();
  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: palette.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}>
      {title || back ? (
        <View style={styles.header}>
          {back ? (
            <IconButton icon="chevron-back" label={t('game.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <AppText variant="heading" style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
            {title ?? ''}
          </AppText>
          {right ?? <View style={styles.headerSpacer} />}
        </View>
      ) : null}
      <View style={[styles.column, wide ? styles.columnWide : null, style]}>{children}</View>
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  busy,
  style,
  detail,
  color,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  detail?: string;
  /** Overrides the primary fill (e.g. a difficulty color). */
  color?: string;
}) {
  const p = usePalette();
  const colors =
    kind === 'primary'
      ? { bg: color ?? p.accent, ink: p.onAccent, border: color ?? p.accent }
      : kind === 'secondary'
        ? { bg: p.surface, ink: p.text, border: p.border }
        : { bg: 'transparent', ink: p.text, border: 'transparent' };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={colors.ink} /> : null}
          <View style={styles.buttonText}>
            <AppText variant="bodyMedium" color={colors.ink} numberOfLines={1}>
              {label}
            </AppText>
            {detail ? (
              <AppText variant="meta" color={colors.ink} style={styles.buttonDetail} numberOfLines={1}>
                {detail}
              </AppText>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  size = 22,
  style,
  color,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  color?: string;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }, style]}>
      <Ionicons name={icon} size={size} color={color ?? p.text} />
    </Pressable>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[styles.panel, { backgroundColor: p.surface, borderColor: p.border }, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  const p = usePalette();
  return (
    <AppText variant="label" color={p.textMuted} style={styles.section} accessibilityRole="header">
      {children}
    </AppText>
  );
}

export function ToggleRow({
  label,
  help,
  value,
  onChange,
  disabled,
}: {
  label: string;
  help?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={help}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}>
      <View style={styles.rowText}>
        <AppText variant="body">{label}</AppText>
        {help ? (
          <AppText variant="meta" color={p.textMuted}>
            {help}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: p.accent, false: p.border }}
        thumbColor={p.surface}
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

export function LinkRow({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={p.textMuted} />
      <AppText variant="body" style={styles.rowText}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
    </Pressable>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const p = usePalette();
  return (
    <View style={styles.segmentWrap}>
      <AppText variant="body">{label}</AppText>
      <View style={[styles.segment, { backgroundColor: p.surfaceAlt, borderColor: p.border }]} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={[styles.segmentItem, on ? { backgroundColor: p.accent } : null]}>
              <AppText variant="label" color={on ? p.onAccent : p.text} numberOfLines={2} style={{ textAlign: 'center' }}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Divider() {
  const p = usePalette();
  return <View style={[styles.divider, { backgroundColor: p.border }]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.sm, minHeight: 52 },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: 48 },
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: SPACE.lg },
  columnWide: { maxWidth: 1200 },
  button: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: { alignItems: 'center', flexShrink: 1 },
  buttonDetail: { opacity: 0.85 },
  iconButton: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  panel: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACE.lg },
  section: { marginTop: SPACE.xl, marginBottom: SPACE.sm, textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: SPACE.md, paddingVertical: SPACE.sm },
  rowText: { flex: 1, gap: 2 },
  segmentWrap: { gap: SPACE.sm, paddingVertical: SPACE.sm },
  segment: { flexDirection: 'row', borderRadius: RADIUS.md, borderWidth: 1, padding: 3 },
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm, paddingHorizontal: 6 },
  divider: { height: StyleSheet.hairlineWidth },
});

