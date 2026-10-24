import type { AdsConsentInfo } from 'react-native-google-mobile-ads';

import { TEST_DEVICE_IDENTIFIERS } from '@/lib/ads/ad-config';
import { resolveConsentDebug } from '@/lib/ads/consent-debug';
import { isTestAdsMode, logAdDecision } from '@/lib/ads/ads-mode';
import { loadGoogleMobileAds } from '@/lib/ads/native-ads';

/** Debug geography and test devices for the consent request. Null in every live build. */
function debugOptions() {
  const settings = resolveConsentDebug({
    dev: __DEV__,
    testAdsMode: isTestAdsMode(),
    // Read statically so Metro can inline the values.
    geography: process.env.EXPO_PUBLIC_ADS_DEBUG_GEOGRAPHY,
    deviceIds: process.env.EXPO_PUBLIC_ADS_TEST_DEVICE_IDS,
    defaultDeviceIds: TEST_DEVICE_IDENTIFIERS,
  });
  if (!settings) return {};
  const { AdsConsentDebugGeography } = loadGoogleMobileAds();
  const geography =
    settings.geography === 'EEA' ? AdsConsentDebugGeography.EEA : AdsConsentDebugGeography.OTHER;
  return { debugGeography: geography, testDeviceIdentifiers: settings.testDeviceIdentifiers };
}

/** Reads the consent saved on this device by an earlier UMP request. */
export function readSavedConsent(): Promise<AdsConsentInfo> {
  return loadGoogleMobileAds().AdsConsent.getConsentInfo();
}

/**
 * Runs the UMP flow: refreshes consent info and shows the form when Google requires it. If the
 * request itself fails (offline, timeout) the saved consent from an earlier session decides, so a
 * returning user keeps their ads and the Privacy options entry.
 */
export async function gatherConsent(): Promise<AdsConsentInfo> {
  try {
    return await loadGoogleMobileAds().AdsConsent.gatherConsent(debugOptions());
  } catch (error) {
    logAdDecision('consent request failed, using saved consent', { error: String(error) });
  }
  return readSavedConsent();
}

export function privacyOptionsRequired(info: AdsConsentInfo): boolean {
  const { AdsConsentPrivacyOptionsRequirementStatus } = loadGoogleMobileAds();
  return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
}

/** Shows the privacy options form, then re-reads consent so callers see the user's new choice. */
export async function showPrivacyOptions(): Promise<AdsConsentInfo> {
  await loadGoogleMobileAds().AdsConsent.showPrivacyOptionsForm();
  return readSavedConsent();
}

/** Development only: forgets saved consent so the first-launch form can be tested again. */
export function resetConsent(): void {
  if (!__DEV__) return;
  loadGoogleMobileAds().AdsConsent.reset();
}
