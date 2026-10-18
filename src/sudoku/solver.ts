/** Fast bitmask backtracking: counts solutions (for uniqueness) and builds random full grids. */
import { bit, boxOf, colOf, rowOf, type Grid } from './grid';
import { shuffle, type Rng } from './rng';

const ROW = Array.from({ length: 81 }, (_, i) => rowOf(i));
const COL = Array.from({ length: 81 }, (_, i) => colOf(i));
const BOX = Array.from({ length: 81 }, (_, i) => boxOf(i));

type Search = {
  cells: Int8Array;
  rows: Int16Array;
  cols: Int16Array;
  boxes: Int16Array;
};

function setup(grid: readonly number[]): Search | null {
  const s: Search = {
    cells: Int8Array.from(grid),
    rows: new Int16Array(9),
    cols: new Int16Array(9),
    boxes: new Int16Array(9),
  };
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (!v) continue;
    const b = bit(v);
    if ((s.rows[ROW[i]] | s.cols[COL[i]] | s.boxes[BOX[i]]) & b) return null;
    s.rows[ROW[i]] |= b;
    s.cols[COL[i]] |= b;
    s.boxes[BOX[i]] |= b;
  }
  return s;
}

const POP = Array.from({ length: 512 }, (_, m) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
});

/** Picks the empty cell with the fewest options. Returns -1 when full, -2 on a dead end. */
function pick(s: Search): { cell: number; mask: number } {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (s.cells[i]) continue;
    const mask = 0x1ff & ~(s.rows[ROW[i]] | s.cols[COL[i]] | s.boxes[BOX[i]]);
    const n = POP[mask];
    if (n < bestCount) {
      best = i;
      bestMask = mask;
      bestCount = n;
      if (n <= 1) break;
    }
  }
  if (best >= 0 && bestCount === 0) return { cell: -2, mask: 0 };
  return { cell: best, mask: bestMask };
}

function place(s: Search, i: number, d: number) {
  const b = bit(d);
  s.cells[i] = d;
  s.rows[ROW[i]] |= b;
  s.cols[COL[i]] |= b;
  s.boxes[BOX[i]] |= b;
}

function unplace(s: Search, i: number, d: number) {
  const b = ~bit(d);
  s.cells[i] = 0;
  s.rows[ROW[i]] &= b;
  s.cols[COL[i]] &= b;
  s.boxes[BOX[i]] &= b;
}

/** Counts solutions up to `limit` (2 is enough to test uniqueness). */
export function countSolutions(grid: readonly number[], limit = 2): number {
  const s = setup(grid);
  if (!s) return 0;
  let count = 0;
  const walk = (): boolean => {
    const { cell, mask } = pick(s);
    if (cell === -1) {
      count++;
      return count >= limit;
    }
    if (cell === -2) return false;
    for (let d = 1; d <= 9; d++) {
      if (!(mask & bit(d))) continue;
      place(s, cell, d);
      if (walk()) return true;
      unplace(s, cell, d);
    }
    return false;
  };
  walk();
  return count;
}

export function hasUniqueSolution(grid: readonly number[]): boolean {
  return countSolutions(grid, 2) === 1;
}

/** The first solution found, or null. */
export function solve(grid: readonly number[]): Grid | null {
  const s = setup(grid);
  if (!s) return null;
  const walk = (): boolean => {
    const { cell, mask } = pick(s);
    if (cell === -1) return true;
    if (cell === -2) return false;
    for (let d = 1; d <= 9; d++) {
      if (!(mask & bit(d))) continue;
      place(s, cell, d);
      if (walk()) return true;
      unplace(s, cell, d);
    }
    return false;
  };
  return walk() ? Array.from(s.cells) : null;
}

/** A random complete, valid grid. */
export function randomSolvedGrid(rng: Rng): Grid {
  const s = setup(new Array(81).fill(0))!;
  const walk = (): boolean => {
    const { cell, mask } = pick(s);
    if (cell === -1) return true;
    if (cell === -2) return false;
    const digits = shuffle(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => mask & bit(d)),
      rng,
    );
    for (const d of digits) {
      place(s, cell, d);
      if (walk()) return true;
      unplace(s, cell, d);
    }
    return false;
  };
  walk();
  return Array.from(s.cells);
}
