/** Debug geographies a developer may force for the UMP consent flow. */
export type DebugGeography = 'EEA' | 'OTHER' | 'DISABLED';

export type ConsentDebugSettings = {
  geography: DebugGeography;
  testDeviceIdentifiers: string[];
};

export type ConsentDebugInput = {
  /** `__DEV__`: a development client or Metro bundle. */
  dev: boolean;
  /** True for any build that is not an explicit `live` ads build. */
  testAdsMode: boolean;
  /** Raw `EXPO_PUBLIC_ADS_DEBUG_GEOGRAPHY`. */
  geography: string | undefined;
  /** Raw `EXPO_PUBLIC_ADS_TEST_DEVICE_IDS`, comma separated. */
  deviceIds: string | undefined;
  /** Device ids always allowed to see debug consent, for example the emulator alias. */
  defaultDeviceIds: readonly string[];
};

function parseGeography(raw: string | undefined): DebugGeography | null {
  const value = raw?.trim().toUpperCase();
  if (value === 'EEA' || value === 'OTHER' || value === 'DISABLED') return value;
  return null;
}

export function parseDeviceIds(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/**
 * Debug consent settings, or null for a normal request. Development clients default to the EEA so
 * the form always appears; preview builds opt in with the env flag. A live ads build never gets
 * debug settings, whatever the env says.
 */
export function resolveConsentDebug(input: ConsentDebugInput): ConsentDebugSettings | null {
  if (!input.testAdsMode) return null;
  const requested = parseGeography(input.geography);
  const geography = requested ?? (input.dev ? 'EEA' : null);
  if (!geography || geography === 'DISABLED') return null;
  const ids = [...input.defaultDeviceIds, ...parseDeviceIds(input.deviceIds)];
  return { geography, testDeviceIdentifiers: [...new Set(ids)] };
}
