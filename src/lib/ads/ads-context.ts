import { createContext, useContext } from 'react';

import { emptyAdState, type AdState, type RewardedKind } from '@/lib/ads/ad-policy';

export type AdsContextValue = {
  /** Consent gathered and the SDK initialised; ad requests are allowed. */
  ready: boolean;
  /** UMP says the app must offer a privacy options entry point. */
  privacyOptionsRequired: boolean;
  /** A rewarded ad is loaded. */
  rewardedReady: boolean;
  /** Persisted counters (sessions, caps, ad-free pass). */
  state: AdState;
  /** Banner allowed on home and level select right now (not during an ad-free pass). */
  bannerAllowed: boolean;
  /** Which rewarded offers the caps allow right now. */
  offers: Record<RewardedKind, boolean>;
  /** Shows a rewarded ad. Resolves true only when the reward was earned. Never throws. */
  showRewarded: (kind: RewardedKind) => Promise<boolean>;
  /**
   * Call once when a puzzle ends (won or lost), from the end screen. Shows an interstitial only if
   * every cap allows it. Resolves true if one was shown. Never blocks the game.
   */
  puzzleFinished: (input: { rewardedThisGame: boolean }) => Promise<boolean>;
  openPrivacyOptions: () => Promise<void>;
};

const NO_OFFERS: Record<RewardedKind, boolean> = { hint: false, second_chance: false, daily_unlock: false, ad_free: false };

export const idleAdsContext: AdsContextValue = {
  ready: false,
  privacyOptionsRequired: false,
  rewardedReady: false,
  state: emptyAdState(),
  bannerAllowed: false,
  offers: NO_OFFERS,
  showRewarded: async () => false,
  puzzleFinished: async () => false,
  openPrivacyOptions: async () => undefined,
};

export const AdsContext = createContext<AdsContextValue>(idleAdsContext);

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}
