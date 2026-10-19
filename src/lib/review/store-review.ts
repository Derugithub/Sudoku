import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';

import {
  parseReview,
  recordReviewAttempt,
  recordWinForReview,
  reviewDecision,
  type ReviewMoment,
  type ReviewState,
} from '@/lib/review/review-policy';
import { KEYS, readRaw, writeRaw } from '@/lib/storage';

const FALLBACK_PACKAGE = 'com.deredo.sudoku';

function appPackage(): string {
  const pkg = Constants.expoConfig?.android?.package;
  return typeof pkg === 'string' && /^[A-Za-z][\w.]*$/.test(pkg) ? pkg : FALLBACK_PACKAGE;
}

/** Opens the Play listing (Settings > Rate). The user chose this, so it is not the review prompt. */
export async function openStoreListing(): Promise<void> {
  const id = encodeURIComponent(appPackage());
  const web = `https://play.google.com/store/apps/details?id=${id}`;
  if (Platform.OS !== 'android') {
    await Linking.openURL(web).catch(() => undefined);
    return;
  }
  try {
    await Linking.openURL(`market://details?id=${id}`);
  } catch {
    await Linking.openURL(web).catch(() => undefined);
  }
}

let current: Promise<ReviewState> | null = null;

function update(change: (s: ReviewState) => ReviewState): Promise<ReviewState> {
  const base = current ?? readRaw(KEYS.review).then(parseReview);
  current = base.then((s) => {
    const next = change(s);
    if (next !== s) void writeRaw(KEYS.review, JSON.stringify(next));
    return next;
  });
  return current;
}

let requesting = false;

/**
 * After a win (counted here), asks Play for its in-app review card if the rules allow it.
 * Only uses the native In-App Review flow; never falls back to opening the store. Never throws.
 */
export async function noteWinAndMaybeAskReview(moment: ReviewMoment): Promise<void> {
  const state = await update(recordWinForReview);
  if (Platform.OS !== 'android' || requesting) return;
  if (!reviewDecision(state, moment).ask) return;
  requesting = true;
  try {
    const available = await StoreReview.isAvailableAsync().catch(() => false);
    if (!available) return;
    await update((s) => recordReviewAttempt(s, moment.now));
    await StoreReview.requestReview().catch(() => undefined);
  } finally {
    requesting = false;
  }
}
