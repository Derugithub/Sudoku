import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHint,
  canSecondChance,
  canWatchForHint,
  emptyAtStart,
  erase,
  freeHintsLeft,
  hasProgress,
  MISTAKE_LIMIT,
  newGame,
  parseGame,
  place,
  progressPercent,
  remainingCounts,
  restart,
  secondChance,
  serializeGame,
  tick,
  toggleNote,
  undo,
  type PlayOptions,
} from '../src/sudoku/game.ts';
import { bit } from '../src/sudoku/grid.ts';
import { findHint } from '../src/sudoku/hints.ts';
import { CLASSIC, CLASSIC_SOLUTION } from './helpers.ts';

const OPTS: PlayOptions = { mistakeCheck: true, autoRemoveNotes: true };
const fresh = () => newGame({ id: 'g', level: 'medium', givens: CLASSIC, solution: CLASSIC_SOLUTION, now: 1000 });

test('placing a digit removes it from notes in the same row, column and box', () => {
  let g = fresh();
  g = toggleNote(g, 3, 4).state; // r1c4 (row 0)
  g = toggleNote(g, 3, 6).state;
  g = toggleNote(g, 20, 4).state; // r3c3 (box 0)
  g = toggleNote(g, 74, 4).state; // r9c3 (column 2)
  g = toggleNote(g, 80, 4).state; // unrelated
  g = place(g, 2, 4, OPTS).state; // r1c3 = 4
  assert.equal(g.notes[3], bit(6));
  assert.equal(g.notes[20], 0);
  assert.equal(g.notes[74] & bit(4), 0);
  assert.equal(g.notes[80], 0); // r9c9 is given 9 in the classic, toggleNote was a no-op
});

test('auto-remove off keeps peer notes', () => {
  let g = fresh();
  g = toggleNote(g, 3, 4).state;
  g = place(g, 2, 4, { ...OPTS, autoRemoveNotes: false }).state;
  assert.equal(g.notes[3], bit(4));
});

test('notes and digits cannot go on givens; notes need an empty cell', () => {
  const g = fresh();
  assert.equal(place(g, 0, 1, OPTS).state, g);
  assert.equal(toggleNote(g, 0, 1).state, g);
  const placed = place(g, 2, 4, OPTS).state;
  assert.equal(toggleNote(placed, 2, 5).state, placed);
});

test('unlimited undo restores digits and notes, mistakes stay counted', () => {
  let g = fresh();
  const start = g.values.join('');
  g = toggleNote(g, 2, 7).state;
  g = place(g, 2, 1, OPTS).state; // wrong
  assert.equal(g.mistakes, 1);
  g = place(g, 3, 6, OPTS).state;
  g = erase(g, 3).state;
  for (let i = 0; i < 4; i++) g = undo(g).state;
  assert.equal(g.values.join(''), start);
  assert.equal(g.notes[2], 0);
  assert.equal(g.mistakes, 1);
  assert.equal(g.history.length, 0);
  assert.equal(undo(g).state, g);
});

test('erase clears a digit or notes, not a given', () => {
  let g = place(fresh(), 2, 4, OPTS).state;
  g = erase(g, 2).state;
  assert.equal(g.values[2], 0);
  assert.equal(erase(g, 0).state, g);
});

test('three mistakes lose the game; one second chance continues with one to spare', () => {
  let g = fresh();
  for (const d of [1, 2, 3]) g = place(g, 2, d, OPTS).state;
  assert.equal(g.status, 'lost');
  assert.ok(canSecondChance(g));
  g = secondChance(g);
  assert.equal(g.status, 'playing');
  assert.equal(g.mistakes, 2);
  assert.equal(g.rewardedAds, 1);
  g = place(g, 2, 5, OPTS).state;
  assert.equal(g.status, 'lost');
  assert.equal(canSecondChance(g), false);
});

test('mistake check off: wrong digits are not counted', () => {
  let g = fresh();
  for (const d of [1, 2, 3]) g = place(g, 2, d, { ...OPTS, mistakeCheck: false }).state;
  assert.equal(g.mistakes, 0);
  assert.equal(g.status, 'playing');
});

test('remaining counts drop with correct digits only', () => {
  let g = fresh();
  const before = remainingCounts(g)[4];
  g = place(g, 2, 4, OPTS).state;
  assert.equal(remainingCounts(g)[4], before - 1);
  g = place(g, 3, 4, OPTS).state; // wrong (r1c4 is 6)
  assert.equal(remainingCounts(g)[4], before - 1);
});

test('completing the board wins and reports completed units', () => {
  let g = fresh();
  let last;
  for (let i = 0; i < 81; i++) {
    if (g.values[i]) continue;
    last = place(g, i, Number(CLASSIC_SOLUTION[i]), OPTS);
    g = last.state;
  }
  assert.equal(g.status, 'won');
  assert.ok(last!.events.won);
  assert.ok(last!.events.completedUnits.length >= 1);
});

test('hints spend free then rewarded allowances', () => {
  let g = newGame({ id: 'g', level: 'hard', givens: CLASSIC, solution: CLASSIC_SOLUTION, now: 0 });
  const sol = [...CLASSIC_SOLUTION].map(Number);
  assert.equal(freeHintsLeft(g), 2);
  for (let i = 0; i < 2; i++) g = applyHint(g, findHint(g.values, sol)!, 'free', OPTS).state;
  assert.equal(freeHintsLeft(g), 0);
  assert.ok(canWatchForHint(g));
  assert.equal(applyHint(g, findHint(g.values, sol)!, 'free', OPTS).state, g);
  for (let i = 0; i < 3; i++) g = applyHint(g, findHint(g.values, sol)!, 'rewarded', OPTS).state;
  assert.equal(g.rewardedHintsUsed, 3);
  assert.equal(canWatchForHint(g), false);
  assert.equal(applyHint(g, findHint(g.values, sol)!, 'rewarded', OPTS).state, g);
});

test('timer ticks only while playing and ignores huge gaps', () => {
  let g = tick(fresh(), 1000);
  assert.equal(g.elapsedMs, 1000);
  g = tick(g, 60_000);
  assert.equal(g.elapsedMs, 6000);
});

test('save and load round-trips a game, and rejects broken saves', () => {
  let g = fresh();
  g = toggleNote(g, 2, 7).state;
  g = place(g, 3, 6, OPTS).state;
  g = tick(g, 4321);
  const back = parseGame(serializeGame(g))!;
  assert.deepEqual(back, g);
  assert.equal(parseGame(null), null);
  assert.equal(parseGame('{bad'), null);
  assert.equal(parseGame(JSON.stringify({ ...JSON.parse(serializeGame(g)), level: 'nope' })), null);
  const tampered = JSON.parse(serializeGame(g));
  tampered.values[0] = 9; // a given changed
  assert.equal(parseGame(JSON.stringify(tampered)), null);
});

test('the three-mistake limit is always on when mistakes are checked', () => {
  assert.equal(MISTAKE_LIMIT, 3);
  let g = fresh();
  for (const d of [1, 2]) g = place(g, 2, d, OPTS).state;
  assert.equal(g.status, 'playing');
  g = place(g, 2, 3, OPTS).state;
  assert.equal(g.status, 'lost');
});

/** Fills the first `n` empty cells correctly. */
function fillCorrect(g: ReturnType<typeof fresh>, n: number) {
  let filled = 0;
  for (let i = 0; i < 81 && filled < n; i++) {
    if (g.values[i]) continue;
    g = place(g, i, Number(CLASSIC_SOLUTION[i]), OPTS).state;
    filled++;
  }
  return g;
}

test('progress is correct cells over cells empty at the start, rounded down', () => {
  let g = fresh();
  assert.equal(emptyAtStart(g), 51);
  assert.equal(progressPercent(g), 0);
  g = fillCorrect(g, 13); // 13/51 = 25.49%
  assert.equal(progressPercent(g), 25);
  const wrongCell = g.values.indexOf(0);
  const wrongDigit = (Number(CLASSIC_SOLUTION[wrongCell]) % 9) + 1;
  g = place(g, wrongCell, wrongDigit, OPTS).state; // a wrong digit does not count
  assert.equal(progressPercent(g), 25);
  g = fillCorrect(fresh(), 50);
  assert.equal(progressPercent(g), 98); // 50/51: never shows 100% until the last cell
  g = fillCorrect(g, 1);
  assert.equal(g.status, 'won');
  assert.equal(progressPercent(g), 100);
});

test('progress exists once there are entries, notes or mistakes', () => {
  const g = fresh();
  assert.equal(hasProgress(g), false);
  assert.equal(hasProgress(tick(g, 3000)), false); // time alone is not progress
  assert.equal(hasProgress(toggleNote(g, 2, 4).state), true);
  assert.equal(hasProgress(place(g, 2, 4, OPTS).state), true);
  const mistakeErased = erase(place(g, 2, 1, OPTS).state, 2).state;
  assert.equal(hasProgress(mistakeErased), true);
});

test('restart resets the same puzzle but keeps spent hints and the second chance', () => {
  let g = fresh();
  g = toggleNote(g, 3, 6).state;
  g = fillCorrect(g, 5);
  const h = findHint(g.values, [...CLASSIC_SOLUTION].map(Number))!;
  g = applyHint(g, h, 'free', OPTS).state;
  const cell = g.values.indexOf(0);
  const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== Number(CLASSIC_SOLUTION[cell])).slice(0, 3);
  for (const d of wrong) g = place(g, cell, d, OPTS).state;
  assert.equal(g.status, 'lost');
  g = secondChance(g);
  g = tick(g, 4000);
  const before = g;

  const r = restart(g);
  assert.equal(r.id, before.id);
  assert.equal(r.givens, before.givens);
  assert.equal(r.values.join(''), CLASSIC.replace(/\./g, '0'));
  assert.ok(r.notes.every((n) => n === 0));
  assert.equal(r.history.length, 0);
  assert.equal(r.mistakes, 0);
  assert.equal(r.elapsedMs, 0);
  assert.equal(r.status, 'playing');
  assert.equal(progressPercent(r), 0);
  assert.equal(hasProgress(r), false);
  // Allowances stay spent: no free-hint farming, no second second chance.
  assert.equal(r.freeHintsUsed, before.freeHintsUsed);
  assert.equal(freeHintsLeft(r), freeHintsLeft(before));
  assert.equal(r.rewardedHintsUsed, before.rewardedHintsUsed);
  assert.equal(r.secondChanceUsed, true);
  assert.equal(r.rewardedAds, before.rewardedAds);
  // Losing again after a restart offers no further chance.
  let again = r;
  for (const d of [1, 2, 3]) again = place(again, 2, d, OPTS).state;
  assert.equal(again.status, 'lost');
  assert.equal(canSecondChance(again), false);
  // And it survives save/load.
  const loaded = parseGame(serializeGame(r))!;
  assert.equal(loaded.secondChanceUsed, true);
  assert.equal(loaded.freeHintsUsed, before.freeHintsUsed);
});
