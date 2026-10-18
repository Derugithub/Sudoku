import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AD_RULES,
  adFreeRemainingMs,
  canOfferRewarded,
  canShowBanner,
  emptyAdState,
  HOUR,
  interstitialBlockReason,
  isAdFree,
  MINUTE,
  nextSession,
  normalizeClock,
  noteFinishedPuzzle,
  parseAdState,
  recordInterstitial,
  recordRewarded,
  type AdState,
} from '../src/lib/ads/ad-policy.ts';

const T0 = new Date(2026, 9, 18, 10, 0).getTime();
const gate = { ready: true, canRequestAds: true };
const moment = (now: number, extra = {}) => ({ ...gate, now, rewardedThisGame: false, ...extra });

function session(n: number): AdState {
  let s = emptyAdState();
  for (let i = 0; i < n; i++) s = nextSession(s, 'launch', T0);
  return s;
}

test('no interstitial in the first session', () => {
  let s = session(1);
  s = noteFinishedPuzzle(noteFinishedPuzzle(s));
  assert.equal(interstitialBlockReason(s, moment(T0)), 'first session');
});

test('at most every 2nd finished puzzle, 4 minutes apart, 8 a day', () => {
  let s = session(2);
  s = noteFinishedPuzzle(s);
  assert.match(interstitialBlockReason(s, moment(T0))!, /multiple/);
  s = noteFinishedPuzzle(s);
  assert.equal(interstitialBlockReason(s, moment(T0)), null);
  s = recordInterstitial(s, T0);
  s = noteFinishedPuzzle(noteFinishedPuzzle(s));
  assert.equal(interstitialBlockReason(s, moment(T0 + 3 * MINUTE)), 'interstitial gap');
  assert.equal(interstitialBlockReason(s, moment(T0 + 4 * MINUTE)), null);
  let now = T0;
  for (let i = 1; i < AD_RULES.interstitialDailyCap; i++) {
    now += 5 * MINUTE;
    s = recordInterstitial(s, now);
  }
  s = noteFinishedPuzzle(noteFinishedPuzzle(s));
  assert.equal(interstitialBlockReason(s, moment(now + 5 * MINUTE)), 'daily cap');
});

test('never right after a rewarded ad, never mid-puzzle, never while ad-free', () => {
  let s = noteFinishedPuzzle(noteFinishedPuzzle(session(3)));
  assert.equal(interstitialBlockReason(s, moment(T0, { rewardedThisGame: true })), 'rewarded ad in this puzzle');
  assert.equal(interstitialBlockReason(s, moment(T0, { inPuzzle: true })), 'mid-puzzle');
  s = recordRewarded(s, 'hint', T0);
  assert.equal(interstitialBlockReason(s, moment(T0 + MINUTE)), 'right after a rewarded ad');
  s = recordRewarded(s, 'ad_free', T0);
  assert.equal(interstitialBlockReason(s, moment(T0 + 10 * MINUTE)), 'ad-free pass');
  assert.equal(interstitialBlockReason(s, moment(T0 + HOUR + 4 * MINUTE)), null);
});

test('ads off when consent or the SDK is not there', () => {
  const s = noteFinishedPuzzle(noteFinishedPuzzle(session(3)));
  assert.equal(interstitialBlockReason(s, { ...moment(T0), ready: false }), 'sdk not ready');
  assert.equal(interstitialBlockReason(s, { ...moment(T0), canRequestAds: false }), 'consent does not allow ad requests');
  assert.equal(canOfferRewarded('hint', s, T0, { ready: false }), false);
});

test('banner on home and level select only', () => {
  const s = session(1);
  assert.ok(canShowBanner('home', s, T0, gate));
  assert.ok(canShowBanner('levels', s, T0, gate));
  assert.equal(canShowBanner('game', s, T0, gate), false);
  assert.equal(canShowBanner('daily', s, T0, gate), false);
  const adFree = recordRewarded(s, 'ad_free', T0);
  assert.equal(canShowBanner('home', adFree, T0 + 1000, gate), false);
});

test('ad-free passes: 1 hour each, stack to 3 hours, 6 a day', () => {
  let s = session(1);
  s = recordRewarded(s, 'ad_free', T0);
  assert.equal(adFreeRemainingMs(s, T0), HOUR);
  s = recordRewarded(s, 'ad_free', T0);
  s = recordRewarded(s, 'ad_free', T0);
  assert.equal(adFreeRemainingMs(s, T0), 3 * HOUR);
  assert.equal(canOfferRewarded('ad_free', s, T0, gate), false);
  assert.equal(canOfferRewarded('ad_free', s, T0 + HOUR, gate), true);
  let now = T0 + 3 * HOUR;
  for (let i = 0; i < 3; i++) {
    s = recordRewarded(s, 'ad_free', now);
    now += 2 * HOUR;
  }
  assert.equal(canOfferRewarded('ad_free', s, now, gate), false); // 6 passes today
  assert.ok(canOfferRewarded('ad_free', s, now + 24 * HOUR, gate));
  assert.ok(canOfferRewarded('hint', s, now, gate));
});

test('the pass survives a restart and the clock going back does not add time', () => {
  let s = recordRewarded(session(1), 'ad_free', T0);
  s = normalizeClock(s, T0 + 10 * MINUTE);
  const saved = parseAdState(JSON.stringify(s));
  assert.deepEqual(saved, s);
  assert.equal(adFreeRemainingMs(saved, T0 + 10 * MINUTE), 50 * MINUTE);
  const rolled = normalizeClock(saved, T0 - 5 * HOUR);
  assert.equal(adFreeRemainingMs(rolled, T0 - 5 * HOUR), 50 * MINUTE);
  const future = normalizeClock({ ...s, adFreeUntil: T0 + 10 * HOUR }, T0);
  assert.equal(adFreeRemainingMs(future, T0), 3 * HOUR);
  assert.ok(isAdFree(future, T0));
});

test('sessions: cold start and a long background start a new one', () => {
  let s = session(1);
  s = nextSession(s, 'background', T0);
  s = nextSession(s, 'active', T0 + 5 * MINUTE);
  assert.equal(s.sessionCount, 1);
  s = nextSession(s, 'background', T0);
  s = nextSession(s, 'active', T0 + 31 * MINUTE);
  assert.equal(s.sessionCount, 2);
  assert.equal(nextSession(s, 'launch', T0).sessionCount, 3);
  assert.deepEqual(parseAdState('garbage'), emptyAdState());
});
