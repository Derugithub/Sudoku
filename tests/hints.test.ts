import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainHint } from '../src/i18n/explain.ts';
import { t } from '../src/i18n/index.ts';
import { generatePuzzle } from '../src/sudoku/generator.ts';
import { LEVELS } from '../src/sudoku/grader.ts';
import { parseGrid } from '../src/sudoku/grid.ts';
import { findHint, freeHintsFor, hintButtonState, hintCells } from '../src/sudoku/hints.ts';
import { mulberry32 } from '../src/sudoku/rng.ts';
import { CLASSIC, CLASSIC_SOLUTION } from './helpers.ts';

test('hints fill correct cells until the puzzle is solved, at every level', () => {
  for (const level of LEVELS) {
    const p = generatePuzzle(level, mulberry32(77));
    const solution = [...p.solution].map(Number);
    const values = parseGrid(p.givens);
    let guard = 0;
    for (;;) {
      const hint = findHint(values, solution);
      if (!hint) break;
      assert.equal(values[hint.cell], 0, 'hint targets an empty cell');
      assert.equal(hint.digit, solution[hint.cell], `${level} hint is correct`);
      assert.ok(hintCells(hint).includes(hint.cell));
      const text = explainHint(t, hint);
      assert.ok(text.title.length > 0 && text.body.length > 10);
      assert.ok(!/\{\w+\}/.test(text.body), `no unfilled placeholder: ${text.body}`);
      values[hint.cell] = hint.digit;
      assert.ok(++guard <= 81);
    }
    assert.equal(values.join(''), p.solution);
  }
});

test('a wrong digit is pointed out first', () => {
  const values = parseGrid(CLASSIC);
  values[2] = 1; // correct is 4
  const hint = findHint(values, [...CLASSIC_SOLUTION].map(Number))!;
  assert.equal(hint.kind, 'fix');
  assert.equal(hint.cell, 2);
  assert.equal(hint.digit, 4);
  assert.match(explainHint(t, hint).body, /Row 1, column 3/);
});

test('a hidden single hint reads in plain words', () => {
  const hint = findHint(parseGrid(CLASSIC), [...CLASSIC_SOLUTION].map(Number))!;
  assert.equal(hint.kind, 'logic');
  const text = explainHint(t, hint);
  assert.match(text.body, /^Only one cell in (row|column|box) \d can hold a \d\.$/);
});

test('free hints per level and the three hint button states', () => {
  assert.equal(freeHintsFor('easy'), 1);
  assert.equal(freeHintsFor('medium'), 1);
  for (const l of ['hard', 'expert', 'master', 'extreme']) assert.equal(freeHintsFor(l), 2);
  assert.deepEqual(hintButtonState(2, 0), { kind: 'free', left: 2 });
  assert.deepEqual(hintButtonState(0, 0), { kind: 'ad', left: 3 });
  assert.deepEqual(hintButtonState(0, 2), { kind: 'ad', left: 1 });
  assert.deepEqual(hintButtonState(0, 3), { kind: 'used' });
});
