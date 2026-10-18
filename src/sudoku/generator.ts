/**
 * Puzzle generator. Builds a random solved grid, removes cells in symmetric pairs while the puzzle
 * keeps exactly one solution and stays within the target level's techniques, then grades it.
 *
 * Written as a generator function that yields after each unit of work, so the app can run it in
 * small slices on the JS thread without blocking input. `generatePuzzle` runs it to completion.
 */
import { formatGrid } from './grid';
import { grade, tierForLevel, type Level } from './grader';
import { mulberry32, rngFromString, shuffle, type Rng } from './rng';
import { hasUniqueSolution, randomSolvedGrid } from './solver';

export type Puzzle = {
  /** 81 chars, '.' for an empty cell. */
  givens: string;
  /** 81 digits. */
  solution: string;
  level: Level;
};

export type GenerateStats = { attempts: number };

function targetGivens(level: Level, rng: Rng): number {
  if (level === 'easy') return 36 + Math.floor(rng() * 5); // 36-40
  if (level === 'medium') return 30 + Math.floor(rng() * 5); // 30-34 (a pair removal can land on 29)
  return 0; // dig as far as uniqueness and the technique limit allow
}

/** Yields between units of work. Returns the puzzle. */
export function* generatePuzzleSteps(level: Level, rng: Rng, stats?: GenerateStats): Generator<void, Puzzle, void> {
  const limitTier = tierForLevel(level);
  const constrained = level !== 'extreme';
  for (;;) {
    if (stats) stats.attempts++;
    const solution = randomSolvedGrid(rng);
    yield;
    const puzzle = [...solution];
    const target = targetGivens(level, rng);
    const pairs = shuffle(
      Array.from({ length: 41 }, (_, i) => i),
      rng,
    );
    let givens = 81;
    for (const a of pairs) {
      if (givens <= target) break;
      const b = 80 - a;
      const removed = a === b ? [a] : [a, b];
      const saved = removed.map((c) => puzzle[c]);
      for (const c of removed) puzzle[c] = 0;
      let keep = hasUniqueSolution(puzzle);
      if (keep && constrained) keep = grade(puzzle, limitTier).solved;
      if (keep) givens -= removed.length;
      else removed.forEach((c, i) => (puzzle[c] = saved[i]));
      yield;
    }
    const result = grade(puzzle);
    yield;
    if (result.level === level) {
      return { givens: formatGrid(puzzle), solution: solution.join(''), level };
    }
  }
}

export function generatePuzzle(level: Level, rng: Rng, stats?: GenerateStats): Puzzle {
  const it = generatePuzzleSteps(level, rng, stats);
  for (;;) {
    const next = it.next();
    if (next.done) return next.value;
  }
}

export function generateFromSeed(level: Level, seed: number | string): Puzzle {
  const rng = typeof seed === 'number' ? mulberry32(seed) : rngFromString(seed);
  return generatePuzzle(level, rng);
}
