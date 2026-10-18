/**
 * Teaching hints. A hint finds the next logical move from the player's current digits (pencil
 * notes are ignored), names the technique and the cells involved, and fills one correct cell.
 */
import { computeCandidates, popcount } from './grid';
import { applyStep, boardFrom, nextStep, type Step } from './techniques';

export type Hint =
  | {
      kind: 'logic';
      /** The pattern that made the placement possible (an elimination step, or the placement itself). */
      pattern: Step;
      /** The placement the hint fills. Same object as `pattern` for a single. */
      placement: Step;
      cell: number;
      digit: number;
    }
  | { kind: 'fix'; cell: number; digit: number; wrong: number }
  | { kind: 'reveal'; cell: number; digit: number };

/** Cells a hint highlights: the pattern cells plus the target. */
export function hintCells(hint: Hint): number[] {
  if (hint.kind !== 'logic') return [hint.cell];
  const set = new Set([...hint.pattern.cells, hint.cell]);
  return [...set];
}

/** Units a hint tints. */
export function hintUnits(hint: Hint): number[] {
  if (hint.kind !== 'logic') return [];
  return [...new Set([...hint.pattern.units, ...hint.placement.units])];
}

/**
 * The next hint for this board, or null when it is already solved.
 * `values` are the digits on the board now (givens and the player's), `solution` the answer.
 */
export function findHint(values: readonly number[], solution: readonly number[]): Hint | null {
  // A wrong digit poisons every deduction, so point it out first.
  for (let cell = 0; cell < 81; cell++) {
    const v = values[cell];
    if (v && v !== solution[cell]) return { kind: 'fix', cell, digit: solution[cell], wrong: v };
  }
  if (values.every((v) => v > 0)) return null;

  const board = boardFrom(values);
  let lastElimination: Step | null = null;
  for (let guard = 0; guard < 400; guard++) {
    const step = nextStep(board, 4);
    if (!step) break;
    if (step.placement) {
      const { cell, digit } = step.placement;
      if (solution[cell] !== digit) break; // cannot happen on a unique puzzle; stay safe
      return { kind: 'logic', pattern: lastElimination ?? step, placement: step, cell, digit };
    }
    lastElimination = step;
    applyStep(board, step);
  }

  // Beyond the technique set: reveal the most constrained empty cell.
  const cands = computeCandidates(values);
  let best = -1;
  let bestCount = 10;
  for (let cell = 0; cell < 81; cell++) {
    if (values[cell]) continue;
    const n = popcount(cands[cell]);
    if (n < bestCount) {
      best = cell;
      bestCount = n;
    }
  }
  return best < 0 ? null : { kind: 'reveal', cell: best, digit: solution[best] };
}

/** Free hints at the start of a game. */
export function freeHintsFor(level: string): number {
  return level === 'easy' || level === 'medium' ? 1 : 2;
}

/** Rewarded (watch an ad) hints allowed per game after the free ones run out. */
export const REWARDED_HINTS_PER_GAME = 3;

export type HintButtonState =
  | { kind: 'free'; left: number }
  | { kind: 'ad'; left: number }
  | { kind: 'used' };

export function hintButtonState(freeLeft: number, rewardedUsed: number): HintButtonState {
  if (freeLeft > 0) return { kind: 'free', left: freeLeft };
  const left = REWARDED_HINTS_PER_GAME - rewardedUsed;
  if (left > 0) return { kind: 'ad', left };
  return { kind: 'used' };
}
