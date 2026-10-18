import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_REVIEW,
  parseReview,
  recordReviewAttempt,
  recordWinForReview,
  reviewDecision,
  type ReviewMoment,
} from '../src/lib/review/review-policy.ts';

const H = 3_600_000;
const base: ReviewMoment = {
  now: 100 * H,
  sessionCount: 3,
  won: true,
  mistakes: 0,
  usedSecondChance: false,
  rewardedThisGame: false,
  interstitialNow: false,
  lastInterstitialAt: null,
  lastRewardedAt: null,
};
const wins = (n: number) => Array.from({ length: n }).reduce<typeof INITIAL_REVIEW>((s) => recordWinForReview(s), INITIAL_REVIEW);

test('asks first after the 3rd win from session 3', () => {
  assert.deepEqual(reviewDecision(wins(2), base), { ask: false, reason: 'few-wins' });
  assert.deepEqual(reviewDecision(wins(3), { ...base, sessionCount: 2 }), { ask: false, reason: 'early-session' });
  assert.deepEqual(reviewDecision(wins(3), base), { ask: true });
});

test('never after a loss, a mistake-heavy win, a second chance or any ad', () => {
  const s = wins(5);
  assert.equal(reviewDecision(s, { ...base, won: false }).ask, false);
  assert.deepEqual(reviewDecision(s, { ...base, mistakes: 2 }), { ask: false, reason: 'mistakes' });
  assert.deepEqual(reviewDecision(s, { ...base, usedSecondChance: true }), { ask: false, reason: 'second-chance' });
  assert.deepEqual(reviewDecision(s, { ...base, rewardedThisGame: true }), { ask: false, reason: 'ad' });
  assert.deepEqual(reviewDecision(s, { ...base, interstitialNow: true }), { ask: false, reason: 'ad' });
  assert.deepEqual(reviewDecision(s, { ...base, lastInterstitialAt: base.now - 60_000 }), { ask: false, reason: 'ad' });
  assert.deepEqual(reviewDecision(s, { ...base, lastRewardedAt: base.now - 60_000 }), { ask: false, reason: 'ad' });
});

test('then at most every 48 hours', () => {
  const s = recordReviewAttempt(wins(4), base.now);
  assert.deepEqual(reviewDecision(s, { ...base, now: base.now + 47 * H }), { ask: false, reason: 'too-soon' });
  assert.deepEqual(reviewDecision(s, { ...base, now: base.now + 48 * H }), { ask: true });
  assert.deepEqual(parseReview(JSON.stringify(s)), s);
});
