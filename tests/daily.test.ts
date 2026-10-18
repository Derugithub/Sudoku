import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  bestStreak,
  canPlayDay,
  completeDaily,
  currentStreak,
  dailyLevel,
  dailyPuzzle,
  dayStatus,
  EMPTY_DAILY,
  monthGrid,
  parseDaily,
  unlockDay,
} from '../src/sudoku/daily.ts';
import { grade } from '../src/sudoku/grader.ts';
import { parseGrid } from '../src/sudoku/grid.ts';
import { countSolutions } from '../src/sudoku/solver.ts';

test('the daily puzzle is the same for everyone on a date and differs across dates', () => {
  const a = dailyPuzzle('2026-10-18');
  assert.deepEqual(dailyPuzzle('2026-10-18'), a);
  assert.notEqual(dailyPuzzle('2026-10-19').givens, a.givens);
  assert.equal(countSolutions(parseGrid(a.givens)), 1);
  assert.equal(grade(parseGrid(a.givens)).level, dailyLevel('2026-10-18'));
});

test('daily seed is stable across releases (pinned)', () => {
  // Changing the generator changes every daily puzzle. If this fails on purpose, bump DAILY_SEED_VERSION.
  assert.equal(dailyPuzzle('2026-01-01').givens, PINNED);
});

const PINNED = '23..87....7.5.63...853....9..6..3.8...........5.1..4..8....173...48.5.6....67..94';

test('daily levels by weekday', () => {
  assert.equal(dailyLevel('2026-10-19'), 'medium'); // Monday
  assert.equal(dailyLevel('2026-10-23'), 'hard'); // Friday
  assert.equal(dailyLevel('2026-10-24'), 'hard'); // Saturday
  assert.equal(dailyLevel('2026-10-25'), 'expert'); // Sunday
});

test('streaks count consecutive days and survive an open today', () => {
  let r = EMPTY_DAILY;
  for (const d of ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']) r = completeDaily(r, d, { timeMs: 1, mistakes: 0, hints: 0 });
  assert.equal(currentStreak(r, '2026-10-18'), 4);
  assert.equal(currentStreak(r, '2026-10-19'), 0);
  r = completeDaily(r, '2026-10-10', { timeMs: 1, mistakes: 0, hints: 0 });
  assert.equal(bestStreak(r), 4);
});

test('a missed day needs an unlock, then completing it mends the streak', () => {
  let r = EMPTY_DAILY;
  r = completeDaily(r, '2026-10-16', { timeMs: 1, mistakes: 0, hints: 0 });
  const today = '2026-10-18';
  assert.equal(dayStatus(r, '2026-10-17', today), 'missed');
  assert.equal(canPlayDay(r, '2026-10-17', today), false);
  assert.equal(canPlayDay(r, today, today), true);
  assert.equal(dayStatus(r, '2026-10-19', today), 'future');
  assert.equal(dayStatus(r, addDays(today, -40), today), 'expired');
  r = unlockDay(r, '2026-10-17');
  assert.ok(canPlayDay(r, '2026-10-17', today));
  r = completeDaily(r, '2026-10-17', { timeMs: 1, mistakes: 0, hints: 0 });
  assert.equal(currentStreak(r, today), 2);
  assert.deepEqual(parseDaily(JSON.stringify(r)), r);
  assert.deepEqual(parseDaily('nope'), EMPTY_DAILY);
});

test('month grid starts on Monday', () => {
  const g = monthGrid(2026, 9); // October 2026 starts on a Thursday
  assert.deepEqual(g.slice(0, 4), [null, null, null, '2026-10-01']);
  assert.equal(g.filter(Boolean).length, 31);
});
