import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { AdsConsentInfo } from 'react-native-google-mobile-ads';

import { TEST_DEVICE_IDENTIFIERS } from '@/lib/ads/ad-config';
import {
  canOfferRewarded,
  canShowBanner,
  emptyAdState,
  interstitialBlockReason,
  nextSession,
  normalizeClock,
  noteFinishedPuzzle,
  parseAdState,
  recordInterstitial,
  recordRewarded,
  type AdState,
  type RewardedKind,
} from '@/lib/ads/ad-policy';
import { getUnitId } from '@/lib/ads/ad-units';
import { AdsContext, type AdsContextValue } from '@/lib/ads/ads-context';
import { isTestAdsMode, logAdDecision } from '@/lib/ads/ads-mode';
import { gatherConsent, privacyOptionsRequired, resetConsent, showPrivacyOptions } from '@/lib/ads/consent';
import { loadGoogleMobileAds } from '@/lib/ads/native-ads';
import { blockMusic, unblockMusic } from '@/lib/music';
import { KEYS, readRaw, writeRaw, writeRawSync } from '@/lib/storage';

type Ads = ReturnType<typeof loadGoogleMobileAds>;
type Interstitial = ReturnType<Ads['InterstitialAd']['createForAdRequest']>;
type Rewarded = ReturnType<Ads['RewardedAd']['createForAdRequest']>;

const RETRY_MS = 60_000;
const REFRESH_MS = 30_000;
const KINDS: RewardedKind[] = ['hint', 'second_chance', 'daily_unlock', 'ad_free'];

type View = { state: AdState; offers: Record<RewardedKind, boolean>; bannerAllowed: boolean };

/**
 * Gathers UMP consent first, initialises the SDK only when consent allows ad requests, keeps one
 * interstitial and one rewarded ad preloaded, and applies the caps in ad-policy.ts. Consent is
 * re-read after the privacy options form closes, so a change takes effect at once. A failed consent
 * request falls back to the consent saved on the device; any other failure leaves ads off. The game
 * never waits on an ad. Background music pauses while any ad is on screen.
 */
export function AdsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [rewardedReady, setRewardedReady] = useState(false);
  const [view, setView] = useState<View>(() => ({
    state: emptyAdState(),
    offers: { hint: false, second_chance: false, daily_unlock: false, ad_free: false },
    bannerAllowed: false,
  }));

  const stateRef = useRef<AdState>(emptyAdState());
  const loadedRef = useRef(false);
  const readyRef = useRef(false);
  const startRef = useRef<Promise<void> | null>(null);
  const aliveRef = useRef(true);
  const interstitial = useRef<{ ad: Interstitial; loaded: boolean } | null>(null);
  const rewarded = useRef<{ ad: Rewarded; loaded: boolean } | null>(null);
  const rewardResolver = useRef<((earned: boolean) => void) | null>(null);
  const earned = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const unsubscribers = useRef<(() => void)[]>([]);

  const refresh = useCallback(() => {
    const now = Date.now();
    const s = normalizeClock(stateRef.current, now);
    stateRef.current = s;
    const gate = { ready: readyRef.current };
    const offers = Object.fromEntries(
      KINDS.map((k) => [k, canOfferRewarded(k, s, now, gate) && Boolean(rewarded.current?.loaded)]),
    ) as Record<RewardedKind, boolean>;
    setView({ state: s, offers, bannerAllowed: canShowBanner('home', s, now, gate) });
  }, []);

  const commit = useCallback(
    (next: AdState) => {
      stateRef.current = next;
      if (loadedRef.current) void writeRaw(KEYS.ads, JSON.stringify(next));
      refresh();
    },
    [refresh],
  );

  // Load counters and count this launch as a session.
  useEffect(() => {
    let alive = true;
    readRaw(KEYS.ads).then((raw) => {
      if (!alive) return;
      const now = Date.now();
      loadedRef.current = true;
      commit(nextSession(normalizeClock(parseAdState(raw), now), 'launch', now));
    });
    const sub = AppState.addEventListener('change', (status) => {
      if (!loadedRef.current) return;
      const now = Date.now();
      if (status === 'background') {
        const next = nextSession(normalizeClock(stateRef.current, now), 'background', now);
        stateRef.current = next;
        writeRawSync(KEYS.ads, JSON.stringify(next));
      } else if (status === 'active') {
        commit(nextSession(normalizeClock(stateRef.current, now), 'active', now));
      }
    });
    const tick = setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      sub.remove();
      clearInterval(tick);
    };
  }, [commit, refresh]);

  /** Ad requests only go out while consent allows them. */
  const loadIfAllowed = useCallback((ad: { load: () => void }) => {
    if (readyRef.current) ad.load();
  }, []);

  const setUp = useCallback(() => {
    const ads = loadGoogleMobileAds();
    const testMode = isTestAdsMode();
    const testIds = {
      menu_banner: ads.TestIds.ADAPTIVE_BANNER,
      finish_interstitial: ads.TestIds.INTERSTITIAL,
      game_rewarded: ads.TestIds.REWARDED,
    };

    const interstitialId = getUnitId('finish_interstitial', { testMode, testIds });
    if (interstitialId) {
      const ad = ads.InterstitialAd.createForAdRequest(interstitialId);
      const holder = { ad, loaded: false };
      interstitial.current = holder;
      unsubscribers.current.push(
        ad.addAdEventListener(ads.AdEventType.LOADED, () => {
          holder.loaded = true;
        }),
        ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
          holder.loaded = false;
          unblockMusic('interstitial');
          loadIfAllowed(ad);
        }),
        ad.addAdEventListener(ads.AdEventType.ERROR, (error) => {
          holder.loaded = false;
          unblockMusic('interstitial');
          logAdDecision('interstitial failed', { error: String(error) });
          timers.current.push(setTimeout(() => loadIfAllowed(ad), RETRY_MS));
        }),
      );
      loadIfAllowed(ad);
    }

    const rewardedId = getUnitId('game_rewarded', { testMode, testIds });
    if (rewardedId) {
      const ad = ads.RewardedAd.createForAdRequest(rewardedId);
      const holder = { ad, loaded: false };
      rewarded.current = holder;
      const finish = (value: boolean) => {
        const resolve = rewardResolver.current;
        rewardResolver.current = null;
        resolve?.(value);
      };
      unsubscribers.current.push(
        ad.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
          holder.loaded = true;
          setRewardedReady(true);
          refresh();
        }),
        ad.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
          earned.current = true;
        }),
        ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
          holder.loaded = false;
          setRewardedReady(false);
          finish(earned.current);
          loadIfAllowed(ad);
          refresh();
        }),
        ad.addAdEventListener(ads.AdEventType.ERROR, (error) => {
          holder.loaded = false;
          setRewardedReady(false);
          logAdDecision('rewarded failed', { error: String(error) });
          finish(false);
          timers.current.push(setTimeout(() => loadIfAllowed(ad), RETRY_MS));
          refresh();
        }),
      );
      loadIfAllowed(ad);
    }
  }, [refresh, loadIfAllowed]);

  /** Initialises the SDK and creates the ad instances once; concurrent callers share one run. */
  const startAds = useCallback((): Promise<void> => {
    if (!startRef.current) {
      startRef.current = (async () => {
        const ads = loadGoogleMobileAds();
        if (isTestAdsMode()) {
          await ads.default().setRequestConfiguration({ testDeviceIdentifiers: [...TEST_DEVICE_IDENTIFIERS] });
        }
        await ads.default().initialize();
      })().catch((error: unknown) => {
        startRef.current = null;
        throw error;
      });
    }
    return startRef.current;
  }, []);

  /** Turns ads on or off to match the latest consent. Safe to call again after any consent change. */
  const applyConsent = useCallback(
    async (info: AdsConsentInfo) => {
      if (!aliveRef.current) return;
      setPrivacyRequired(privacyOptionsRequired(info));
      if (!info.canRequestAds) {
        // Consent was withdrawn or never given: stop offering and stop requesting.
        readyRef.current = false;
        setReady(false);
        setRewardedReady(false);
        refresh();
        logAdDecision('consent does not allow ad requests');
        return;
      }
      await startAds();
      if (!aliveRef.current) return;
      const firstStart = !interstitial.current && !rewarded.current;
      readyRef.current = true;
      if (firstStart) {
        setUp();
      } else {
        // Ads were switched off earlier: reload whatever is not already loaded.
        for (const holder of [interstitial.current, rewarded.current]) {
          if (holder && !holder.loaded) holder.ad.load();
        }
      }
      setReady(true);
      refresh();
      logAdDecision('ads ready');
    },
    [refresh, setUp, startAds],
  );

  // UMP consent first, then the SDK. A failed consent request falls back to saved consent (see
  // consent.ts); an SDK failure leaves ads off.
  useEffect(() => {
    aliveRef.current = true;
    (async () => {
      try {
        await applyConsent(await gatherConsent());
      } catch (error) {
        logAdDecision('ads disabled', { error: String(error) });
      }
    })();
    const pending = timers.current;
    const subs = unsubscribers.current;
    return () => {
      aliveRef.current = false;
      readyRef.current = false;
      pending.forEach(clearTimeout);
      pending.length = 0;
      subs.forEach((unsubscribe) => unsubscribe());
      subs.length = 0;
      interstitial.current = null;
      rewarded.current = null;
    };
  }, [applyConsent]);

  const showRewarded = useCallback(
    async (kind: RewardedKind): Promise<boolean> => {
      const holder = rewarded.current;
      const now = Date.now();
      const s = normalizeClock(stateRef.current, now);
      if (!holder || !holder.loaded || rewardResolver.current) return false;
      if (!canOfferRewarded(kind, s, now, { ready: readyRef.current })) {
        logAdDecision('rewarded blocked', { kind });
        return false;
      }
      earned.current = false;
      blockMusic('rewarded');
      const got = await new Promise<boolean>((resolve) => {
        rewardResolver.current = resolve;
        holder.ad.show().catch(() => {
          rewardResolver.current = null;
          resolve(false);
        });
      });
      unblockMusic('rewarded');
      const closedAt = Date.now();
      const base = normalizeClock(stateRef.current, closedAt);
      commit(got ? recordRewarded(base, kind, closedAt) : { ...base, lastRewardedAt: closedAt });
      logAdDecision('rewarded closed', { kind, earned: got });
      return got;
    },
    [commit],
  );

  const puzzleFinished = useCallback(
    async ({ rewardedThisGame }: { rewardedThisGame: boolean }): Promise<boolean> => {
      const now = Date.now();
      const s = noteFinishedPuzzle(normalizeClock(stateRef.current, now));
      const holder = interstitial.current;
      const reason = interstitialBlockReason(s, {
        now,
        ready: readyRef.current,
        rewardedThisGame,
        loaded: Boolean(holder?.loaded),
      });
      logAdDecision('interstitial check', { reason, finished: s.finishedCount });
      if (reason || !holder) {
        commit(s);
        return false;
      }
      commit(recordInterstitial(s, now));
      holder.loaded = false;
      blockMusic('interstitial'); // resumed by the CLOSED or ERROR listener
      try {
        await holder.ad.show();
        return true;
      } catch {
        unblockMusic('interstitial');
        return false;
      }
    },
    [commit],
  );

  const openPrivacyOptions = useCallback(async () => {
    try {
      await applyConsent(await showPrivacyOptions());
    } catch (error) {
      logAdDecision('privacy options failed', { error: String(error) });
    }
  }, [applyConsent]);

  /** Development only: clears saved consent and runs the consent flow again. */
  const resetConsentForTesting = useCallback(async () => {
    if (!__DEV__) return;
    try {
      resetConsent();
      await applyConsent(await gatherConsent());
    } catch (error) {
      logAdDecision('consent reset failed', { error: String(error) });
    }
  }, [applyConsent]);

  const value = useMemo<AdsContextValue>(
    () => ({
      ready,
      privacyOptionsRequired: privacyRequired,
      rewardedReady: ready && rewardedReady,
      state: view.state,
      bannerAllowed: view.bannerAllowed,
      offers: view.offers,
      showRewarded,
      puzzleFinished,
      openPrivacyOptions,
      resetConsentForTesting,
    }),
    [ready, privacyRequired, rewardedReady, view, showRewarded, puzzleFinished, openPrivacyOptions, resetConsentForTesting],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}
