import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatGrid, isConsistent, parseGrid } from '../src/sudoku/grid.ts';
import { mulberry32 } from '../src/sudoku/rng.ts';
import { countSolutions, hasUniqueSolution, randomSolvedGrid, solve } from '../src/sudoku/solver.ts';
import { CLASSIC, CLASSIC_SOLUTION } from './helpers.ts';

test('solves a classic puzzle and finds it unique', () => {
  const grid = parseGrid(CLASSIC);
  assert.equal(solve(grid)!.join(''), CLASSIC_SOLUTION);
  assert.equal(countSolutions(grid), 1);
  assert.ok(hasUniqueSolution(grid));
});

test('detects multiple solutions and contradictions', () => {
  const sparse = parseGrid(CLASSIC);
  for (let i = 0; i < 30; i++) sparse[i] = 0;
  assert.equal(countSolutions(sparse, 2), 2);
  const broken = parseGrid(CLASSIC);
  broken[2] = 5; // second 5 in row 1
  assert.equal(countSolutions(broken), 0);
  assert.equal(solve(broken), null);
});

test('random solved grids are complete and valid, and seeded', () => {
  const a = randomSolvedGrid(mulberry32(42));
  const b = randomSolvedGrid(mulberry32(42));
  assert.deepEqual(a, b);
  assert.ok(a.every((v) => v >= 1 && v <= 9));
  assert.ok(isConsistent(a));
  assert.equal(formatGrid(a).length, 81);
});
