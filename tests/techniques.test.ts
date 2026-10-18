import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle } from '../src/sudoku/generator.ts';
import { LEVELS } from '../src/sudoku/grader.ts';
import { bit, parseGrid } from '../src/sudoku/grid.ts';
import { mulberry32 } from '../src/sudoku/rng.ts';
import {
  applyStep,
  boardFrom,
  findClaiming,
  findFish,
  findHiddenSingle,
  findHiddenSubset,
  findNakedSingle,
  findNakedSubset,
  findPointing,
  findXyWing,
  findXyzWing,
  findFullHouse,
  isSolved,
  nextStep,
} from '../src/sudoku/techniques.ts';
import { candBoard, CLASSIC } from './helpers.ts';

test('full house: the last empty cell of a unit', () => {
  const grid = parseGrid('534678912672195348198342567859761423426853791713924856961537284287419635345286179');
  grid[80] = 0;
  const step = findFullHouse(boardFrom(grid))!;
  assert.deepEqual(step.placement, { cell: 80, digit: 9 });
  assert.equal(findFullHouse(boardFrom(parseGrid(CLASSIC))), null);
});

test('hidden single: only one cell in a unit can hold the digit', () => {
  const step = findHiddenSingle(candBoard({ 4: [7, 2], 5: [2], 13: [2] }))!;
  assert.equal(step.technique, 'hiddenSingle');
  assert.deepEqual(step.placement, { cell: 4, digit: 7 });
});

test('naked single: a cell with one candidate', () => {
  const step = findNakedSingle(candBoard({ 10: [3, 4], 20: [6] }))!;
  assert.deepEqual(step.placement, { cell: 20, digit: 6 });
});

test('pointing: a digit locked to one row of a box leaves the rest of that row', () => {
  const step = findPointing(candBoard({ 0: [3], 1: [3], 5: [3, 4] }))!;
  assert.equal(step.technique, 'pointing');
  assert.deepEqual(step.eliminations, [{ cell: 5, digit: 3 }]);
  assert.deepEqual(step.cells, [0, 1]);
});

test('claiming: a digit locked to one box of a row leaves the rest of that box', () => {
  const step = findClaiming(candBoard({ 0: [3], 1: [3], 10: [3, 4] }))!;
  assert.equal(step.technique, 'claiming');
  assert.deepEqual(step.eliminations, [{ cell: 10, digit: 3 }]);
});

test('naked pair removes the pair from the rest of the unit', () => {
  const step = findNakedSubset(candBoard({ 0: [1, 2], 1: [1, 2], 2: [1, 2, 3] }), 2)!;
  assert.equal(step.technique, 'nakedPair');
  assert.deepEqual(step.eliminations, [
    { cell: 2, digit: 1 },
    { cell: 2, digit: 2 },
  ]);
});

test('naked triple', () => {
  const step = findNakedSubset(candBoard({ 0: [1, 2], 1: [2, 3], 2: [1, 3], 3: [1, 4] }), 3)!;
  assert.equal(step.technique, 'nakedTriple');
  assert.deepEqual(step.eliminations, [{ cell: 3, digit: 1 }]);
});

test('hidden pair strips the other candidates from the pair cells', () => {
  const step = findHiddenSubset(candBoard({ 0: [4, 5, 6], 1: [4, 5, 7], 2: [6, 7] }), 2)!;
  assert.equal(step.technique, 'hiddenPair');
  assert.deepEqual(step.digits, [4, 5]);
  assert.deepEqual(step.eliminations, [
    { cell: 0, digit: 6 },
    { cell: 1, digit: 7 },
  ]);
});

test('X-Wing removes the digit from the rest of both columns', () => {
  const step = findFish(candBoard({ 1: [5], 6: [5], 37: [5], 42: [5], 64: [5, 8] }), 2)!;
  assert.equal(step.technique, 'xWing');
  assert.deepEqual(step.cells, [1, 6, 37, 42]);
  assert.deepEqual(step.eliminations, [{ cell: 64, digit: 5 }]);
});

test('Swordfish over three rows and three columns', () => {
  const step = findFish(candBoard({ 0: [2], 4: [2], 31: [2], 35: [2], 54: [2], 62: [2], 76: [2, 9] }), 3)!;
  assert.equal(step.technique, 'swordfish');
  assert.deepEqual(step.eliminations, [{ cell: 76, digit: 2 }]);
});

test('XY-Wing removes z from cells that see both wings', () => {
  const step = findXyWing(candBoard({ 0: [1, 2], 3: [1, 3], 27: [2, 3], 30: [3, 4] }))!;
  assert.equal(step.technique, 'xyWing');
  assert.deepEqual(step.cells, [0, 3, 27]);
  assert.deepEqual(step.eliminations, [{ cell: 30, digit: 3 }]);
});

test('XYZ-Wing removes z from cells that see all three', () => {
  // pivot r0c0 {1,2,3}; wings r0c1 {1,3} and r1c0 {2,3}; r0c2... must see all three: r1c1 (box 0)
  const step = findXyzWing(candBoard({ 0: [1, 2, 3], 1: [1, 3], 9: [2, 3], 10: [3, 5] }))!;
  assert.equal(step.technique, 'xyzWing');
  assert.deepEqual(step.eliminations, [{ cell: 10, digit: 3 }]);
});

test('every step is sound on generated puzzles of every level', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 3; seed++) {
      const p = generatePuzzle(level, mulberry32(seed * 101));
      const solution = [...p.solution].map(Number);
      const board = boardFrom(parseGrid(p.givens));
      for (;;) {
        const step = nextStep(board);
        if (!step) break;
        if (step.placement) assert.equal(solution[step.placement.cell], step.placement.digit, `${level} ${step.technique}`);
        for (const e of step.eliminations) {
          assert.notEqual(solution[e.cell], e.digit, `${level} ${step.technique} removed the answer`);
          assert.ok(board.cands[e.cell] & bit(e.digit), 'eliminates a live candidate');
        }
        applyStep(board, step);
      }
      if (level !== 'extreme') assert.ok(isSolved(board), `${level} solved by logic`);
    }
  }
});
