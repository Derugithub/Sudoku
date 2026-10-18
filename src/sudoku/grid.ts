/** Board geometry and small helpers shared by the solver, generator, hints and the game. */

export type Grid = number[]; // 81 cells, 0 = empty, 1-9 = digit

export const ALL = 0x1ff; // candidate mask for digits 1-9 (bit d-1)

export const rowOf = (cell: number) => Math.floor(cell / 9);
export const colOf = (cell: number) => cell % 9;
export const boxOf = (cell: number) => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3);

export type UnitKind = 'row' | 'col' | 'box';

/** 27 units: rows 0-8, columns 9-17, boxes 18-26. */
export const UNITS: number[][] = [];
for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) {
  const r0 = Math.floor(b / 3) * 3;
  const c0 = (b % 3) * 3;
  UNITS.push(Array.from({ length: 9 }, (_, i) => (r0 + Math.floor(i / 3)) * 9 + c0 + (i % 3)));
}

export function unitKind(unit: number): UnitKind {
  return unit < 9 ? 'row' : unit < 18 ? 'col' : 'box';
}

export function unitIndex(unit: number): number {
  return unit % 9;
}

/** The three units of a cell: [row, column, box]. */
export const CELL_UNITS: number[][] = Array.from({ length: 81 }, (_, i) => [rowOf(i), 9 + colOf(i), 18 + boxOf(i)]);

/** The 20 cells that share a row, column or box with each cell. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const set = new Set<number>();
  for (const u of CELL_UNITS[i]) for (const c of UNITS[u]) if (c !== i) set.add(c);
  return [...set].sort((a, b) => a - b);
});

const PEER_SETS: Set<number>[] = PEERS.map((p) => new Set(p));

export function sees(a: number, b: number): boolean {
  return a !== b && PEER_SETS[a].has(b);
}

export const bit = (digit: number) => 1 << (digit - 1);

export function popcount(mask: number): number {
  let n = 0;
  while (mask) {
    mask &= mask - 1;
    n++;
  }
  return n;
}

export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
  return out;
}

export function firstDigit(mask: number): number {
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) return d;
  return 0;
}

export function parseGrid(text: string): Grid {
  const clean = text.replace(/\s/g, '');
  if (clean.length !== 81) throw new Error(`grid needs 81 cells, got ${clean.length}`);
  return [...clean].map((ch) => (ch >= '1' && ch <= '9' ? Number(ch) : 0));
}

export function formatGrid(grid: readonly number[]): string {
  return grid.map((v) => (v ? String(v) : '.')).join('');
}

export function isValidGridString(text: unknown): text is string {
  return typeof text === 'string' && /^[1-9.0]{81}$/.test(text);
}

/** Candidates for every empty cell from the placed digits alone. Filled cells get 0. */
export function computeCandidates(grid: readonly number[]): number[] {
  const out = new Array<number>(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    let mask = ALL;
    for (const p of PEERS[i]) if (grid[p]) mask &= ~bit(grid[p]);
    out[i] = mask;
  }
  return out;
}

/** True when the grid has no digit repeated in any unit (empties allowed). */
export function isConsistent(grid: readonly number[]): boolean {
  for (const unit of UNITS) {
    let seen = 0;
    for (const c of unit) {
      const v = grid[c];
      if (!v) continue;
      if (seen & bit(v)) return false;
      seen |= bit(v);
    }
  }
  return true;
}

/** Human row/column/box numbers start at 1. */
export function cellLabel(cell: number): { row: number; col: number; box: number } {
  return { row: rowOf(cell) + 1, col: colOf(cell) + 1, box: boxOf(cell) + 1 };
}
