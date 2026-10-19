import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Linking, ScrollView, StyleSheet } from 'react-native';

import { AppText, Divider, LinkRow, Panel, Screen, SectionTitle, Segmented, ToggleRow } from '@/components/ui';
import { LANGUAGES } from '@/i18n';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '@/lib/ads/ad-config';
import { useAds } from '@/lib/ads/ads-context';
import { openStoreListing } from '@/lib/review/store-review';
import { useSettings } from '@/lib/settings';
import { usePalette } from '@/theme/theme-context';
import { SPACE, type ThemeSetting } from '@/theme/tokens';

export default function SettingsScreen() {
  const { settings: s, update, t } = useSettings();
  const ads = useAds();
  const p = usePalette();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <Screen title={t('settings.title')} back>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>{t('settings.appearance')}</SectionTitle>
        <Panel>
          <Segmented<ThemeSetting>
            label={t('settings.theme')}
            value={s.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'system', label: t('theme.system') },
              { value: 'paper', label: t('theme.paper') },
              { value: 'midnight', label: t('theme.midnight') },
              { value: 'contrast', label: t('theme.contrast') },
            ]}
          />
        </Panel>

        <SectionTitle>{t('settings.gameplay')}</SectionTitle>
        <Panel>
          <Segmented
            label={t('settings.inputMode')}
            value={s.inputMode}
            onChange={(inputMode) => update({ inputMode })}
            options={[
              { value: 'cell', label: t('input.cell') },
              { value: 'number', label: t('input.number') },
            ]}
          />
          <AppText variant="meta" color={p.textMuted}>
            {t('settings.inputHelp')}
          </AppText>
          <Divider />
          <ToggleRow label={t('settings.mistakeCheck')} help={t('settings.mistakeCheckHelp')} value={s.mistakeCheck} onChange={(v) => update({ mistakeCheck: v })} />
          <ToggleRow label={t('settings.highlightUnits')} value={s.highlightUnits} onChange={(v) => update({ highlightUnits: v })} />
          <ToggleRow label={t('settings.highlightSame')} value={s.highlightSame} onChange={(v) => update({ highlightSame: v })} />
          <ToggleRow label={t('settings.autoRemoveNotes')} value={s.autoRemoveNotes} onChange={(v) => update({ autoRemoveNotes: v })} />
          <ToggleRow label={t('settings.showTimer')} value={s.showTimer} onChange={(v) => update({ showTimer: v })} />
        </Panel>

        <SectionTitle>{t('settings.feedback')}</SectionTitle>
        <Panel>
          <ToggleRow label={t('settings.sound')} value={s.sound} onChange={(v) => update({ sound: v })} />
          <ToggleRow label={t('settings.music')} help={t('settings.musicHelp')} value={s.music} onChange={(v) => update({ music: v })} />
          <ToggleRow label={t('settings.vibration')} value={s.vibration} onChange={(v) => update({ vibration: v })} />
        </Panel>

        <SectionTitle>{t('settings.language')}</SectionTitle>
        <Panel>
          <Segmented
            label={t('settings.language')}
            value={s.language}
            onChange={(language) => update({ language })}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
          />
          <AppText variant="meta" color={p.textMuted}>
            {t('settings.languageHelp')}
          </AppText>
        </Panel>

        <SectionTitle>{t('settings.about')}</SectionTitle>
        <Panel>
          <LinkRow icon="star-outline" label={t('settings.rate')} onPress={() => void openStoreListing()} />
          <LinkRow icon="shield-checkmark-outline" label={t('settings.privacy')} onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL).catch(() => undefined)} />
          {ads.privacyOptionsRequired ? (
            <LinkRow icon="options-outline" label={t('settings.privacyOptions')} onPress={() => void ads.openPrivacyOptions()} />
          ) : null}
          <LinkRow
            icon="mail-outline"
            label={t('settings.support')}
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Sudoku')}`).catch(() => undefined)}
          />
          <AppText variant="meta" color={p.textMuted} style={styles.version}>
            {t('settings.version', { v: version })}
          </AppText>
        </Panel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: SPACE.xxl, maxWidth: 640, width: '100%', alignSelf: 'center' },
  version: { marginTop: SPACE.sm },
});
