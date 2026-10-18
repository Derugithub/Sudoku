/**
 * Validity-preserving symmetries: relabel digits, shuffle bands, stacks, rows within a band and
 * columns within a stack, and maybe transpose. The result keeps exactly one solution and needs the
 * same techniques, so one bundled puzzle can look new many times.
 */
import { shuffle, type Rng } from './rng';

export function transformPuzzle(givens: string, solution: string, rng: Rng): { givens: string; solution: string } {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  const order = () => shuffle([0, 1, 2], rng).flatMap((band) => shuffle([0, 1, 2], rng).map((r) => band * 3 + r));
  const rows = order();
  const cols = order();
  const transpose = rng() < 0.5;
  const map = (text: string) => {
    let out = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const [sr, sc] = transpose ? [rows[c], cols[r]] : [rows[r], cols[c]];
        const ch = text[sr * 9 + sc];
        out += ch >= '1' && ch <= '9' ? String(digits[Number(ch) - 1]) : '.';
      }
    }
    return out;
  };
  return { givens: map(givens), solution: map(solution) };
}
