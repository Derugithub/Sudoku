/**
 * Pure ad rules. Every function takes `now` (epoch ms) so the caps can be tested with a fake clock.
 * The game never waits on an ad: these only say whether one is allowed, and callers continue
 * either way.
 *
 * Interstitial: only after a finished puzzle, at most every 2nd finished puzzle, never in the first
 * session, 4+ minutes apart, at most 8 a day, never right after a rewarded ad, never mid-puzzle.
 * Banner: home and level select only, never on the board.
 * Rewarded: extra hint, second chance, unlock a missed daily, 1 hour ad-free. The ad-free pass is
 * the only way to turn ads off: up to 6 a day, stacking to at most 3 hours.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export const AD_RULES = {
  /** A cold start, or a resume after this long in the background, starts a new session. */
  sessionGapMs: 30 * MINUTE,
  interstitialFromSession: 2,
  interstitialEveryNFinished: 2,
  interstitialMinGapMs: 4 * MINUTE,
  interstitialDailyCap: 8,
  /** No interstitial this soon after a rewarded ad closed. */
  afterRewardedMs: 3 * MINUTE,
  adFreePassMs: HOUR,
  adFreePassesPerDay: 6,
  adFreeMaxMs: 3 * HOUR,
  /** Shared ceiling for rewarded shows a day (hints, second chances, unlocks, passes). */
  rewardedDailyCap: 40,
} as const;

export type DayCount = { date: string; count: number };

export type AdState = {
  sessionCount: number;
  lastBackgroundAt: number | null;
  /** Finished puzzles counted toward the every-Nth interstitial (from the interstitial session on). */
  finishedCount: number;
  lastInterstitialAt: number | null;
  interstitialsToday: DayCount;
  lastRewardedAt: number | null;
  rewardedToday: DayCount;
  adFreeUntil: number | null;
  adFreePassesToday: DayCount;
  /** Latest wall-clock time seen. Guards the ad-free pass against the clock being set back. */
  lastSeenAt: number;
};

export function emptyAdState(): AdState {
  return {
    sessionCount: 0,
    lastBackgroundAt: null,
    finishedCount: 0,
    lastInterstitialAt: null,
    interstitialsToday: { date: '', count: 0 },
    lastRewardedAt: null,
    rewardedToday: { date: '', count: 0 },
    adFreeUntil: null,
    adFreePassesToday: { date: '', count: 0 },
    lastSeenAt: 0,
  };
}

export function localDateKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function countToday(bucket: DayCount, now: number): number {
  return bucket.date === localDateKey(now) ? bucket.count : 0;
}

export function bumpToday(bucket: DayCount, now: number): DayCount {
  const date = localDateKey(now);
  return bucket.date === date ? { date, count: bucket.count + 1 } : { date, count: 1 };
}

/**
 * Call with every read of `now`. If the clock went back, the remaining ad-free time stays what it
 * was (it is not extended), and timestamps in the future are pulled back to now so cooldowns
 * cannot lock forever. The remaining pass is also never more than the 3 hour cap.
 */
export function normalizeClock(state: AdState, now: number): AdState {
  let next = state;
  if (state.lastSeenAt > now) {
    const shift = now - state.lastSeenAt; // negative
    next = {
      ...next,
      adFreeUntil: next.adFreeUntil != null ? next.adFreeUntil + shift : null,
    };
  }
  const clamp = (t: number | null) => (t != null && t > now ? now : t);
  const adFreeUntil = next.adFreeUntil != null ? Math.min(next.adFreeUntil, now + AD_RULES.adFreeMaxMs) : null;
  return {
    ...next,
    adFreeUntil,
    lastInterstitialAt: clamp(next.lastInterstitialAt),
    lastRewardedAt: clamp(next.lastRewardedAt),
    lastBackgroundAt: clamp(next.lastBackgroundAt),
    lastSeenAt: Math.max(now, 0),
  };
}

export function isAdFree(state: AdState, now: number): boolean {
  return state.adFreeUntil != null && state.adFreeUntil > now;
}

export function adFreeRemainingMs(state: AdState, now: number): number {
  return isAdFree(state, now) ? Math.min(state.adFreeUntil! - now, AD_RULES.adFreeMaxMs) : 0;
}

export type AdGate = { ready: boolean; canRequestAds?: boolean };

function gateReason(gate: AdGate): string | null {
  if (!gate.ready) return 'sdk not ready';
  if (gate.canRequestAds === false) return 'consent does not allow ad requests';
  return null;
}

export type BannerScreen = 'home' | 'levels' | 'game' | 'daily' | 'stats' | 'settings';

export function bannerBlockReason(screen: BannerScreen, state: AdState, now: number, gate: AdGate): string | null {
  if (screen !== 'home' && screen !== 'levels') return `no banner on ${screen}`;
  const g = gateReason(gate);
  if (g) return g;
  if (isAdFree(state, now)) return 'ad-free pass';
  return null;
}

export function canShowBanner(screen: BannerScreen, state: AdState, now: number, gate: AdGate): boolean {
  return bannerBlockReason(screen, state, now, gate) == null;
}

/** Counts a finished puzzle (won or lost) toward the every-Nth interstitial. */
export function noteFinishedPuzzle(state: AdState): AdState {
  if (state.sessionCount < AD_RULES.interstitialFromSession) return state;
  return { ...state, finishedCount: state.finishedCount + 1 };
}

export type InterstitialMoment = AdGate & {
  now: number;
  /** A rewarded ad was watched during the puzzle that just ended. */
  rewardedThisGame: boolean;
  /** The player is mid-puzzle. Always blocks. */
  inPuzzle?: boolean;
  loaded?: boolean;
};

/** Call after `noteFinishedPuzzle`. Null means the interstitial may show. */
export function interstitialBlockReason(state: AdState, m: InterstitialMoment): string | null {
  if (m.inPuzzle) return 'mid-puzzle';
  const g = gateReason(m);
  if (g) return g;
  if (m.loaded === false) return 'not loaded';
  if (isAdFree(state, m.now)) return 'ad-free pass';
  if (state.sessionCount < AD_RULES.interstitialFromSession) return 'first session';
  const every = AD_RULES.interstitialEveryNFinished;
  if (state.finishedCount <= 0 || state.finishedCount % every !== 0) return `finished ${state.finishedCount} is not a multiple of ${every}`;
  if (state.lastInterstitialAt != null && m.now - state.lastInterstitialAt < AD_RULES.interstitialMinGapMs) return 'interstitial gap';
  if (countToday(state.interstitialsToday, m.now) >= AD_RULES.interstitialDailyCap) return 'daily cap';
  if (m.rewardedThisGame) return 'rewarded ad in this puzzle';
  if (state.lastRewardedAt != null && m.now - state.lastRewardedAt < AD_RULES.afterRewardedMs) return 'right after a rewarded ad';
  return null;
}

export function canShowInterstitial(state: AdState, m: InterstitialMoment): boolean {
  return interstitialBlockReason(state, m) == null;
}

export function recordInterstitial(state: AdState, now: number): AdState {
  return { ...state, lastInterstitialAt: now, interstitialsToday: bumpToday(state.interstitialsToday, now) };
}

export type RewardedKind = 'hint' | 'second_chance' | 'daily_unlock' | 'ad_free';

export function rewardedBlockReason(kind: RewardedKind, state: AdState, now: number, gate: AdGate): string | null {
  const g = gateReason(gate);
  if (g) return g;
  if (countToday(state.rewardedToday, now) >= AD_RULES.rewardedDailyCap) return 'rewarded daily cap';
  if (kind === 'ad_free') return adFreeBlockReason(state, now);
  return null;
}

export function adFreeBlockReason(state: AdState, now: number): string | null {
  if (countToday(state.adFreePassesToday, now) >= AD_RULES.adFreePassesPerDay) return 'ad-free daily cap';
  if (adFreeRemainingMs(state, now) + AD_RULES.adFreePassMs > AD_RULES.adFreeMaxMs) return 'ad-free time is at the 3 hour cap';
  return null;
}

export function canOfferRewarded(kind: RewardedKind, state: AdState, now: number, gate: AdGate): boolean {
  return rewardedBlockReason(kind, state, now, gate) == null;
}

/** Adds one hour onto any time still left, never past the 3 hour cap. */
export function nextAdFreeUntil(state: AdState, now: number): number {
  const base = isAdFree(state, now) ? state.adFreeUntil! : now;
  return Math.min(base + AD_RULES.adFreePassMs, now + AD_RULES.adFreeMaxMs);
}

/** Applies a reward the earned-reward callback already confirmed. */
export function recordRewarded(state: AdState, kind: RewardedKind, now: number): AdState {
  const next: AdState = { ...state, lastRewardedAt: now, rewardedToday: bumpToday(state.rewardedToday, now) };
  if (kind !== 'ad_free') return next;
  return { ...next, adFreeUntil: nextAdFreeUntil(state, now), adFreePassesToday: bumpToday(state.adFreePassesToday, now) };
}

export type SessionEvent = 'launch' | 'background' | 'active';

export function nextSession(state: AdState, event: SessionEvent, now: number): AdState {
  if (event === 'launch') return { ...state, sessionCount: state.sessionCount + 1, lastBackgroundAt: null };
  if (event === 'background') return state.lastBackgroundAt != null ? state : { ...state, lastBackgroundAt: now };
  if (state.lastBackgroundAt == null) return state;
  const away = now - state.lastBackgroundAt;
  return {
    ...state,
    lastBackgroundAt: null,
    sessionCount: away >= AD_RULES.sessionGapMs ? state.sessionCount + 1 : state.sessionCount,
  };
}

export function formatRemaining(ms: number): { hours: number; minutes: number } {
  const total = Math.max(1, Math.ceil(ms / MINUTE));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

function day(v: unknown): DayCount {
  const d = v as DayCount;
  return d && typeof d.date === 'string' && typeof d.count === 'number' && Number.isFinite(d.count)
    ? { date: d.date, count: Math.max(0, Math.floor(d.count)) }
    : { date: '', count: 0 };
}

const time = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function parseAdState(raw: string | null): AdState {
  if (!raw) return emptyAdState();
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      sessionCount: int(v.sessionCount),
      lastBackgroundAt: time(v.lastBackgroundAt),
      finishedCount: int(v.finishedCount),
      lastInterstitialAt: time(v.lastInterstitialAt),
      interstitialsToday: day(v.interstitialsToday),
      lastRewardedAt: time(v.lastRewardedAt),
      rewardedToday: day(v.rewardedToday),
      adFreeUntil: time(v.adFreeUntil),
      adFreePassesToday: day(v.adFreePassesToday),
      lastSeenAt: time(v.lastSeenAt) ?? 0,
    };
  } catch {
    return emptyAdState();
  }
}
