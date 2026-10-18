import { bit } from '../src/sudoku/grid.ts';
import type { Board } from '../src/sudoku/techniques.ts';

/** An empty board with no candidates, then the given candidates per cell. */
export function candBoard(cands: Record<number, number[]>): Board {
  const board: Board = { values: new Array(81).fill(0), cands: new Array(81).fill(0) };
  for (const [cell, digits] of Object.entries(cands)) {
    for (const d of digits) board.cands[Number(cell)] |= bit(d);
  }
  return board;
}

export const CLASSIC = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
export const CLASSIC_SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
