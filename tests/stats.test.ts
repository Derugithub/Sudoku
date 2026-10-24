import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageMs, emptyStats, overallAverageMs, overallStats, overallWinRate, STATS_TABS, parseStats, recordLoss, recordStart, recordWin, winRate } from '../src/sudoku/stats.ts';

test('per-level stats: games, wins, best and average time, streaks', () => {
  let s = emptyStats();
  s = recordStart(s, 'hard');
  s = recordWin(s, 'hard', 300_000, true);
  s = recordStart(s, 'hard');
  s = recordWin(s, 'hard', 200_000, false);
  s = recordStart(s, 'hard');
  s = recordLoss(s, 'hard');
  const h = s.hard;
  assert.equal(h.played, 3);
  assert.equal(h.won, 2);
  assert.equal(h.perfect, 1);
  assert.equal(h.bestMs, 200_000);
  assert.equal(averageMs(h), 250_000);
  assert.equal(h.streak, 0);
  assert.equal(h.bestStreak, 2);
  assert.ok(Math.abs(winRate(h) - 2 / 3) < 1e-9);
  assert.equal(s.easy.played, 0);
  assert.deepEqual(parseStats(JSON.stringify(s)), s);
  assert.deepEqual(parseStats('x'), emptyStats());
});

test('overall stats add up every level and keep the best streak', () => {
  let s = emptyStats();
  assert.deepEqual(overallStats(s), { played: 0, won: 0, perfect: 0, totalWinMs: 0, bestStreak: 0 });
  assert.equal(overallAverageMs(overallStats(s)), null);
  assert.equal(overallWinRate(overallStats(s)), 0);
  s = recordStart(s, 'easy');
  s = recordWin(s, 'easy', 100_000, true);
  s = recordStart(s, 'easy');
  s = recordWin(s, 'easy', 200_000, false);
  s = recordStart(s, 'master');
  s = recordLoss(s, 'master');
  s = recordStart(s, 'master');
  s = recordWin(s, 'master', 600_000, false);
  const o = overallStats(s);
  assert.equal(o.played, 4);
  assert.equal(o.won, 3);
  assert.equal(o.perfect, 1);
  assert.equal(o.totalWinMs, 900_000);
  assert.equal(o.bestStreak, 2);
  assert.equal(overallAverageMs(o), 300_000);
  assert.equal(overallWinRate(o), 0.75);
});

test('stats tabs: Overall first, then one per level', () => {
  assert.deepEqual([...STATS_TABS], ['overall', 'easy', 'medium', 'hard', 'expert', 'master', 'extreme']);
});
