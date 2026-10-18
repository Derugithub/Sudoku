/**
 * Generation time per level on this machine: `npm run bench` (optionally `-- 20` puzzles per level).
 * Runs the same generator the app uses, to completion (the app runs it in time slices).
 */
import { generatePuzzle } from '../src/sudoku/generator';
import { LEVELS } from '../src/sudoku/grader';
import { mulberry32 } from '../src/sudoku/rng';

const n = Number(process.argv[2] ?? 20);
console.log(`level      n  median ms   p90 ms   max ms  avg attempts`);
for (const level of LEVELS) {
  const times: number[] = [];
  let attempts = 0;
  for (let i = 0; i < n; i++) {
    const stats = { attempts: 0 };
    const start = performance.now();
    generatePuzzle(level, mulberry32(0xbe7c4 + i), stats);
    times.push(performance.now() - start);
    attempts += stats.attempts;
  }
  times.sort((a, b) => a - b);
  const at = (q: number) => times[Math.min(n - 1, Math.floor(q * n))].toFixed(0);
  console.log(
    `${level.padEnd(9)} ${String(n).padStart(2)} ${at(0.5).padStart(10)} ${at(0.9).padStart(8)} ${times[n - 1].toFixed(0).padStart(8)} ${(attempts / n).toFixed(1).padStart(13)}`,
  );
}
