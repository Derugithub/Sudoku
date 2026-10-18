/**
 * In-app review rules (MoneyTrack's rules, tightened for a game). Pure: every function takes
 * `now`. The prompt is only requested after a win, never tied to a reward or an ad, and Play decides
 * whether its card actually shows.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const REVIEW_RULES = {
  fromSession: 3,
  /** First request after the 3rd win, later ones on later wins. */
  minWins: 3,
  intervalMs: 48 * HOUR,
  afterInterstitialMs: 2 * MINUTE,
  afterRewardedMs: 2 * MINUTE,
  /** A win with this many mistakes is not a happy moment. */
  heavyMistakes: 2,
} as const;

export type ReviewState = { wins: number; attempts: number; lastAttemptAt: number };

export const INITIAL_REVIEW: ReviewState = { wins: 0, attempts: 0, lastAttemptAt: 0 };

export type ReviewMoment = {
  now: number;
  sessionCount: number;
  won: boolean;
  mistakes: number;
  usedSecondChance: boolean;
  /** Any rewarded ad watched during the game that just ended. */
  rewardedThisGame: boolean;
  /** An interstitial is showing or about to show at this break. */
  interstitialNow: boolean;
  lastInterstitialAt: number | null;
  lastRewardedAt: number | null;
};

export type ReviewBlock =
  | 'not-a-win'
  | 'early-session'
  | 'few-wins'
  | 'mistakes'
  | 'second-chance'
  | 'ad'
  | 'too-soon';

export type ReviewDecision = { ask: true } | { ask: false; reason: ReviewBlock };

export function recordWinForReview(state: ReviewState): ReviewState {
  return { ...state, wins: state.wins + 1 };
}

export function reviewDecision(stored: ReviewState, m: ReviewMoment): ReviewDecision {
  const state = stored.lastAttemptAt > m.now ? { ...stored, lastAttemptAt: m.now } : stored;
  const no = (reason: ReviewBlock): ReviewDecision => ({ ask: false, reason });
  if (!m.won) return no('not-a-win');
  if (m.sessionCount < REVIEW_RULES.fromSession) return no('early-session');
  if (state.wins < REVIEW_RULES.minWins) return no('few-wins');
  if (m.mistakes >= REVIEW_RULES.heavyMistakes) return no('mistakes');
  if (m.usedSecondChance) return no('second-chance');
  if (m.interstitialNow || m.rewardedThisGame) return no('ad');
  const recent = (t: number | null, gap: number) => t != null && m.now - t >= 0 && m.now - t < gap;
  if (recent(m.lastInterstitialAt, REVIEW_RULES.afterInterstitialMs)) return no('ad');
  if (recent(m.lastRewardedAt, REVIEW_RULES.afterRewardedMs)) return no('ad');
  if (state.lastAttemptAt > 0 && m.now - state.lastAttemptAt < REVIEW_RULES.intervalMs) return no('too-soon');
  return { ask: true };
}

export function recordReviewAttempt(state: ReviewState, now: number): ReviewState {
  return { ...state, attempts: state.attempts + 1, lastAttemptAt: now };
}

export function parseReview(raw: string | null): ReviewState {
  if (!raw) return INITIAL_REVIEW;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
    return { wins: n(v.wins), attempts: n(v.attempts), lastAttemptAt: n(v.lastAttemptAt) };
  } catch {
    return INITIAL_REVIEW;
  }
}
