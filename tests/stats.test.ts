import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageMs, emptyStats, parseStats, recordLoss, recordStart, recordWin, winRate } from '../src/sudoku/stats.ts';

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
