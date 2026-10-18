import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFromSeed, generatePuzzle, generatePuzzleSteps } from '../src/sudoku/generator.ts';
import { grade, LEVELS, levelFor } from '../src/sudoku/grader.ts';
import { parseGrid } from '../src/sudoku/grid.ts';
import { mulberry32 } from '../src/sudoku/rng.ts';
import { countSolutions } from '../src/sudoku/solver.ts';
import { FALLBACK_PUZZLES } from '../src/sudoku/fallback-puzzles.ts';

test('every level generates a puzzle with exactly one solution, graded at that level', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 4; seed++) {
      const p = generatePuzzle(level, mulberry32(seed * 7919));
      const givens = parseGrid(p.givens);
      assert.equal(countSolutions(givens, 2), 1, `${level} unique`);
      for (let i = 0; i < 81; i++) if (givens[i]) assert.equal(givens[i], Number(p.solution[i]));
      assert.equal(grade(givens).level, level);
      const n = givens.filter(Boolean).length;
      if (level === 'easy') assert.ok(n >= 36 && n <= 40, `easy givens ${n}`);
      if (level === 'medium') assert.ok(n >= 29 && n <= 35, `medium givens ${n}`);
    }
  }
});

test('the same seed gives the same puzzle', () => {
  assert.deepEqual(generateFromSeed('hard', 'abc'), generateFromSeed('hard', 'abc'));
  assert.notDeepEqual(generateFromSeed('hard', 'abc'), generateFromSeed('hard', 'abd'));
});

test('the step generator yields often, so it can run in small slices', () => {
  const it = generatePuzzleSteps('medium', mulberry32(5));
  let yields = 0;
  for (;;) {
    const r = it.next();
    if (r.done) break;
    yields++;
  }
  assert.ok(yields > 20);
});

test('grade levels follow the hardest technique', () => {
  const base = { solved: true, counts: {}, hiddenSinglesOnly: false, givens: 30 };
  assert.equal(levelFor({ ...base, maxTier: 0, hiddenSinglesOnly: true, givens: 38 }), 'easy');
  assert.equal(levelFor({ ...base, maxTier: 0, hiddenSinglesOnly: true, givens: 32 }), 'medium');
  assert.equal(levelFor({ ...base, maxTier: 1 }), 'hard');
  assert.equal(levelFor({ ...base, maxTier: 2 }), 'expert');
  assert.equal(levelFor({ ...base, maxTier: 3 }), 'master');
  assert.equal(levelFor({ ...base, maxTier: 4 }), 'extreme');
  assert.equal(levelFor({ ...base, solved: false, maxTier: 5 }), 'extreme');
});

test('a famously hard puzzle grades Extreme', () => {
  // "AI Escargot"
  const g = grade(parseGrid('1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'));
  assert.equal(g.level, 'extreme');
});

test('the bundled fallback set is valid for every level', () => {
  for (const level of LEVELS) {
    const list = FALLBACK_PUZZLES[level];
    assert.ok(list.length >= 10, `${level} has a fallback set`);
    for (const [givens, solution] of list.slice(0, 3)) {
      const grid = parseGrid(givens);
      assert.equal(countSolutions(grid, 2), 1);
      assert.equal(grade(grid).level, level);
      for (let i = 0; i < 81; i++) if (grid[i]) assert.equal(grid[i], Number(solution[i]));
    }
  }
});

test('symmetry transforms keep one solution and the same level', async () => {
  const { transformPuzzle } = await import('../src/sudoku/transform.ts');
  for (const level of LEVELS) {
    const [g, s] = FALLBACK_PUZZLES[level][0];
    for (let seed = 1; seed <= 3; seed++) {
      const out = transformPuzzle(g, s, mulberry32(seed));
      const grid = parseGrid(out.givens);
      assert.equal(countSolutions(grid, 2), 1);
      assert.equal(grade(grid).level, level);
      assert.equal(grid.filter(Boolean).length, parseGrid(g).filter(Boolean).length);
      for (let i = 0; i < 81; i++) if (grid[i]) assert.equal(grid[i], Number(out.solution[i]));
    }
  }
});
