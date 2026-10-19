import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countsAsFinished, mayConsiderInterstitial, needsConfirmation, outOfMistakesActions, pauseActions } from '../src/lib/game-flow.ts';
import { newGame, place, restart, secondChance, toggleNote, type PlayOptions } from '../src/sudoku/game.ts';
import { CLASSIC, CLASSIC_SOLUTION } from './helpers.ts';

const OPTS: PlayOptions = { mistakeCheck: true, autoRemoveNotes: true };
const fresh = (daily: string | null = null) =>
  newGame({ id: 'g', level: 'hard', givens: CLASSIC, solution: CLASSIC_SOLUTION, daily, now: 1 });
const lose = (g: ReturnType<typeof fresh>) => {
  for (const d of [1, 2, 3]) g = place(g, 2, d, OPTS).state; // r1c3 is a 4
  return g;
};

test('pause popup: resume, restart, new game, and never an ad', () => {
  assert.deepEqual(pauseActions(fresh()), ['resume', 'restart', 'new']);
  assert.deepEqual(pauseActions(fresh('2026-10-19')), ['resume', 'restart']); // one daily puzzle per day
  assert.equal(mayConsiderInterstitial('pauseNew', { paused: true, status: 'playing' }), false);
  assert.equal(mayConsiderInterstitial('restart', { paused: true, status: 'playing' }), false);
  // Even a finished-puzzle action is never considered while paused.
  assert.equal(mayConsiderInterstitial('finishedLeave', { paused: true, status: 'lost' }), false);
  assert.equal(countsAsFinished('pauseNew'), false);
});

test('out of mistakes: another chance at most once per game, then restart, new puzzle, close', () => {
  let g = lose(fresh());
  assert.deepEqual(outOfMistakesActions(g), ['secondChance', 'restart', 'new', 'close']);
  g = lose(secondChance(g));
  assert.deepEqual(outOfMistakesActions(g), ['restart', 'new', 'close']);
  // Restarting cannot bring it back.
  g = lose(restart(g));
  assert.deepEqual(outOfMistakesActions(g), ['restart', 'new', 'close']);
  assert.deepEqual(outOfMistakesActions(lose(fresh('2026-10-19'))), ['secondChance', 'restart', 'close']);
});

test('restart never counts as a finished puzzle or triggers an interstitial', () => {
  assert.equal(countsAsFinished('restart'), false);
  for (const status of ['playing', 'lost', 'won'] as const) {
    assert.equal(mayConsiderInterstitial('restart', { paused: false, status }), false);
  }
});

test('interstitials are only considered when leaving a finished puzzle', () => {
  assert.equal(mayConsiderInterstitial('finishedNext', { paused: false, status: 'won' }), true);
  assert.equal(mayConsiderInterstitial('finishedLeave', { paused: false, status: 'lost' }), true);
  assert.equal(mayConsiderInterstitial('finishedNext', { paused: false, status: 'playing' }), false); // mid-puzzle
});

test('restart and new game ask first only when there is progress', () => {
  const g = fresh();
  assert.equal(needsConfirmation('restart', g), false);
  assert.equal(needsConfirmation('pauseNew', g), false);
  assert.equal(needsConfirmation('restart', toggleNote(g, 2, 4).state), true);
  assert.equal(needsConfirmation('pauseNew', place(g, 2, 4, OPTS).state), true);
});
