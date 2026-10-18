/**
 * Human-style solving techniques on a candidate grid. Each finder returns the first Step it can
 * make, or null. The grader and the hint system both use these, so a hint always names a technique
 * the difficulty grade was based on.
 */
import { bit, CELL_UNITS, computeCandidates, digitsOf, firstDigit, PEERS, popcount, sees, UNITS } from './grid';

export type Technique =
  | 'fullHouse'
  | 'hiddenSingle'
  | 'nakedSingle'
  | 'pointing'
  | 'claiming'
  | 'nakedPair'
  | 'hiddenPair'
  | 'nakedTriple'
  | 'hiddenTriple'
  | 'xWing'
  | 'xyWing'
  | 'nakedQuad'
  | 'swordfish'
  | 'xyzWing'
  | 'jellyfish'
  | 'hiddenQuad';

/**
 * Difficulty tier of each technique: 0 singles (Easy, Medium), 1 locked candidates (Hard),
 * 2 pairs and triples (Expert), 3 X-Wing, XY-Wing and quads (Master), 4 swordfish, XYZ-Wing and
 * jellyfish (Extreme). Extreme also takes puzzles that need more than this set.
 */
export const TECHNIQUE_TIER: Record<Technique, number> = {
  fullHouse: 0,
  hiddenSingle: 0,
  nakedSingle: 0,
  pointing: 1,
  claiming: 1,
  nakedPair: 2,
  hiddenPair: 2,
  nakedTriple: 2,
  hiddenTriple: 2,
  xWing: 3,
  xyWing: 3,
  nakedQuad: 3,
  swordfish: 4,
  xyzWing: 4,
  jellyfish: 4,
  hiddenQuad: 3,
};

export type CellDigit = { cell: number; digit: number };

export type Step = {
  technique: Technique;
  placement?: CellDigit;
  eliminations: CellDigit[];
  /** Cells that form the pattern (a hint highlights these). */
  cells: number[];
  /** Units the pattern lives in (0-8 rows, 9-17 columns, 18-26 boxes). */
  units: number[];
  /** The digits the pattern is about. */
  digits: number[];
};

export type Board = { values: number[]; cands: number[] };

export function boardFrom(values: readonly number[]): Board {
  return { values: [...values], cands: computeCandidates(values) };
}

export function applyStep(board: Board, step: Step): void {
  if (step.placement) {
    const { cell, digit } = step.placement;
    board.values[cell] = digit;
    board.cands[cell] = 0;
    for (const p of PEERS[cell]) board.cands[p] &= ~bit(digit);
  }
  for (const e of step.eliminations) board.cands[e.cell] &= ~bit(e.digit);
}

function combos<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const walk = (start: number) => {
    if (pick.length === size) {
      out.push([...pick]);
      return;
    }
    for (let i = start; i <= items.length - (size - pick.length); i++) {
      pick.push(items[i]);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return out;
}

function cellsWith(board: Board, unit: number, digit: number): number[] {
  const b = bit(digit);
  return UNITS[unit].filter((c) => board.cands[c] & b);
}

// Order of units scanned for singles: boxes first (how people look), then rows, then columns.
const SCAN_UNITS = [...Array.from({ length: 9 }, (_, i) => 18 + i), ...Array.from({ length: 18 }, (_, i) => i)];

export function findFullHouse(board: Board): Step | null {
  for (const unit of SCAN_UNITS) {
    const empty = UNITS[unit].filter((c) => !board.values[c]);
    if (empty.length !== 1) continue;
    const cell = empty[0];
    const digit = firstDigit(board.cands[cell]);
    if (!digit || popcount(board.cands[cell]) !== 1) continue;
    return { technique: 'fullHouse', placement: { cell, digit }, eliminations: [], cells: [cell], units: [unit], digits: [digit] };
  }
  return null;
}

export function findHiddenSingle(board: Board): Step | null {
  for (const unit of SCAN_UNITS) {
    for (let d = 1; d <= 9; d++) {
      const cells = cellsWith(board, unit, d);
      if (cells.length !== 1) continue;
      return {
        technique: 'hiddenSingle',
        placement: { cell: cells[0], digit: d },
        eliminations: [],
        cells,
        units: [unit],
        digits: [d],
      };
    }
  }
  return null;
}

export function findNakedSingle(board: Board): Step | null {
  for (let cell = 0; cell < 81; cell++) {
    if (board.values[cell] || popcount(board.cands[cell]) !== 1) continue;
    const digit = firstDigit(board.cands[cell]);
    return { technique: 'nakedSingle', placement: { cell, digit }, eliminations: [], cells: [cell], units: [], digits: [digit] };
  }
  return null;
}

/** A digit confined to one line inside a box leaves the rest of that line (pointing). */
export function findPointing(board: Board): Step | null {
  for (let box = 18; box < 27; box++) {
    for (let d = 1; d <= 9; d++) {
      const cells = cellsWith(board, box, d);
      if (cells.length < 2) continue;
      for (const lineIndex of [0, 1]) {
        const line = CELL_UNITS[cells[0]][lineIndex];
        if (!cells.every((c) => CELL_UNITS[c][lineIndex] === line)) continue;
        const elim = UNITS[line].filter((c) => CELL_UNITS[c][2] !== box && board.cands[c] & bit(d));
        if (elim.length) {
          return {
            technique: 'pointing',
            eliminations: elim.map((cell) => ({ cell, digit: d })),
            cells,
            units: [box, line],
            digits: [d],
          };
        }
      }
    }
  }
  return null;
}

/** A digit confined to one box inside a line leaves the rest of that box (claiming). */
export function findClaiming(board: Board): Step | null {
  for (let line = 0; line < 18; line++) {
    for (let d = 1; d <= 9; d++) {
      const cells = cellsWith(board, line, d);
      if (cells.length < 2) continue;
      const box = CELL_UNITS[cells[0]][2];
      if (!cells.every((c) => CELL_UNITS[c][2] === box)) continue;
      const lineIndex = line < 9 ? 0 : 1;
      const elim = UNITS[box].filter((c) => CELL_UNITS[c][lineIndex] !== line && board.cands[c] & bit(d));
      if (elim.length) {
        return {
          technique: 'claiming',
          eliminations: elim.map((cell) => ({ cell, digit: d })),
          cells,
          units: [line, box],
          digits: [d],
        };
      }
    }
  }
  return null;
}

const NAKED: Record<number, Technique> = { 2: 'nakedPair', 3: 'nakedTriple', 4: 'nakedQuad' };
const HIDDEN: Record<number, Technique> = { 2: 'hiddenPair', 3: 'hiddenTriple', 4: 'hiddenQuad' };

export function findNakedSubset(board: Board, size: number): Step | null {
  for (let unit = 0; unit < 27; unit++) {
    const open = UNITS[unit].filter((c) => !board.values[c]);
    if (open.length <= size) continue;
    const pool = open.filter((c) => {
      const n = popcount(board.cands[c]);
      return n >= 2 && n <= size;
    });
    for (const group of combos(pool, size)) {
      let union = 0;
      for (const c of group) union |= board.cands[c];
      if (popcount(union) !== size) continue;
      const elim: CellDigit[] = [];
      for (const c of open) {
        if (group.includes(c)) continue;
        for (const d of digitsOf(board.cands[c] & union)) elim.push({ cell: c, digit: d });
      }
      if (elim.length) {
        return { technique: NAKED[size], eliminations: elim, cells: group, units: [unit], digits: digitsOf(union) };
      }
    }
  }
  return null;
}

export function findHiddenSubset(board: Board, size: number): Step | null {
  for (let unit = 0; unit < 27; unit++) {
    const open = UNITS[unit].filter((c) => !board.values[c]);
    if (open.length <= size) continue;
    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) {
      const n = cellsWith(board, unit, d).length;
      if (n >= 2 && n <= size) digits.push(d);
    }
    for (const group of combos(digits, size)) {
      let mask = 0;
      for (const d of group) mask |= bit(d);
      const cells = open.filter((c) => board.cands[c] & mask);
      if (cells.length !== size) continue;
      const elim: CellDigit[] = [];
      for (const c of cells) for (const d of digitsOf(board.cands[c] & ~mask)) elim.push({ cell: c, digit: d });
      if (elim.length) {
        return { technique: HIDDEN[size], eliminations: elim, cells, units: [unit], digits: group };
      }
    }
  }
  return null;
}

const FISH: Record<number, Technique> = { 2: 'xWing', 3: 'swordfish', 4: 'jellyfish' };

export function findFish(board: Board, size: number): Step | null {
  for (let d = 1; d <= 9; d++) {
    const b = bit(d);
    for (const byRow of [true, false]) {
      // base lines and, for each, the cover positions (0-8) where d can go
      const lines: { line: number; spots: number[] }[] = [];
      for (let i = 0; i < 9; i++) {
        const unit = byRow ? i : 9 + i;
        const spots = UNITS[unit].filter((c) => board.cands[c] & b).map((c) => (byRow ? c % 9 : Math.floor(c / 9)));
        if (spots.length >= 2 && spots.length <= size) lines.push({ line: unit, spots });
      }
      for (const group of combos(lines, size)) {
        const cover = new Set<number>();
        for (const g of group) for (const s of g.spots) cover.add(s);
        if (cover.size !== size) continue;
        const baseIdx = new Set(group.map((g) => g.line % 9));
        const elim: CellDigit[] = [];
        const cells: number[] = [];
        for (const pos of cover) {
          const coverUnit = byRow ? 9 + pos : pos;
          for (const c of UNITS[coverUnit]) {
            if (!(board.cands[c] & b)) continue;
            const baseOfCell = byRow ? Math.floor(c / 9) : c % 9;
            if (baseIdx.has(baseOfCell)) cells.push(c);
            else elim.push({ cell: c, digit: d });
          }
        }
        if (elim.length) {
          const coverUnits = [...cover].map((p) => (byRow ? 9 + p : p));
          return {
            technique: FISH[size],
            eliminations: elim,
            cells: cells.sort((a, b2) => a - b2),
            units: [...group.map((g) => g.line), ...coverUnits],
            digits: [d],
          };
        }
      }
    }
  }
  return null;
}

/** XY-Wing: pivot {x,y} sees wings {x,z} and {y,z}; anything seeing both wings loses z. */
export function findXyWing(board: Board): Step | null {
  for (let pivot = 0; pivot < 81; pivot++) {
    const pm = board.cands[pivot];
    if (board.values[pivot] || popcount(pm) !== 2) continue;
    const wings = PEERS[pivot].filter((c) => !board.values[c] && popcount(board.cands[c]) === 2);
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const a = board.cands[wings[i]];
        const c = board.cands[wings[j]];
        if (a === c || a === pm || c === pm) continue;
        if (popcount(a & pm) !== 1 || popcount(c & pm) !== 1 || (a & pm) === (c & pm)) continue;
        const z = a & ~pm;
        if (popcount(z) !== 1 || (c & ~pm) !== z) continue;
        const digit = firstDigit(z);
        const elim = PEERS[wings[i]]
          .filter((x) => x !== pivot && x !== wings[j] && sees(x, wings[j]) && board.cands[x] & z)
          .map((cell) => ({ cell, digit }));
        if (elim.length) {
          return {
            technique: 'xyWing',
            eliminations: elim,
            cells: [pivot, wings[i], wings[j]],
            units: [],
            digits: [...digitsOf(pm), digit],
          };
        }
      }
    }
  }
  return null;
}

/** XYZ-Wing: pivot {x,y,z} sees wings {x,z} and {y,z}; anything seeing all three loses z. */
export function findXyzWing(board: Board): Step | null {
  for (let pivot = 0; pivot < 81; pivot++) {
    const pm = board.cands[pivot];
    if (board.values[pivot] || popcount(pm) !== 3) continue;
    const wings = PEERS[pivot].filter(
      (c) => !board.values[c] && popcount(board.cands[c]) === 2 && (board.cands[c] & ~pm) === 0,
    );
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const a = board.cands[wings[i]];
        const c = board.cands[wings[j]];
        if (a === c) continue;
        const z = a & c;
        if (popcount(z) !== 1) continue;
        const digit = firstDigit(z);
        const elim = PEERS[pivot]
          .filter((x) => x !== wings[i] && x !== wings[j] && sees(x, wings[i]) && sees(x, wings[j]) && board.cands[x] & z)
          .map((cell) => ({ cell, digit }));
        if (elim.length) {
          return {
            technique: 'xyzWing',
            eliminations: elim,
            cells: [pivot, wings[i], wings[j]],
            units: [],
            digits: [...digitsOf(pm)],
          };
        }
      }
    }
  }
  return null;
}

type Finder = (board: Board) => Step | null;

/** Simplest first, ordered by tier. The grader always takes the simplest available step. */
export const FINDERS: [Technique, Finder][] = [
  ['fullHouse', findFullHouse],
  ['hiddenSingle', findHiddenSingle],
  ['nakedSingle', findNakedSingle],
  ['pointing', findPointing],
  ['claiming', findClaiming],
  ['nakedPair', (b) => findNakedSubset(b, 2)],
  ['hiddenPair', (b) => findHiddenSubset(b, 2)],
  ['nakedTriple', (b) => findNakedSubset(b, 3)],
  ['hiddenTriple', (b) => findHiddenSubset(b, 3)],
  ['xWing', (b) => findFish(b, 2)],
  ['xyWing', findXyWing],
  ['nakedQuad', (b) => findNakedSubset(b, 4)],
  ['hiddenQuad', (b) => findHiddenSubset(b, 4)],
  ['swordfish', (b) => findFish(b, 3)],
  ['xyzWing', findXyzWing],
  ['jellyfish', (b) => findFish(b, 4)],
];

/** The simplest step available, optionally limited to techniques at or below `maxTier`. */
export function nextStep(board: Board, maxTier = 4): Step | null {
  for (const [technique, finder] of FINDERS) {
    if (TECHNIQUE_TIER[technique] > maxTier) break;
    const step = finder(board);
    if (step) return step;
  }
  return null;
}

/** True when some empty cell has no candidate left (the board contradicts itself). */
export function isBroken(board: Board): boolean {
  for (let i = 0; i < 81; i++) if (!board.values[i] && !board.cands[i]) return true;
  return false;
}

export function isSolved(board: Board): boolean {
  return board.values.every((v) => v > 0);
}
