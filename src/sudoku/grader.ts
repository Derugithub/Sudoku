/** Grades a puzzle by the hardest technique a human-style solver needs. */
import { nextStep, applyStep, boardFrom, isBroken, isSolved, TECHNIQUE_TIER, type Technique } from './techniques';

export const LEVELS = ['easy', 'medium', 'hard', 'expert', 'master', 'extreme'] as const;
export type Level = (typeof LEVELS)[number];

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

export type Grade = {
  /** Solved by the technique set. False means it needs something beyond (chains, guessing). */
  solved: boolean;
  /** Hardest tier used, 0-4, or 5 when the techniques ran out. */
  maxTier: number;
  /** Steps per technique. */
  counts: Partial<Record<Technique, number>>;
  /** Only full houses and hidden singles were needed. */
  hiddenSinglesOnly: boolean;
  givens: number;
  level: Level;
};

/** Givens allowed for the two singles-only levels. */
export const EASY_MIN_GIVENS = 36;
export const MEDIUM_MAX_GIVENS = 35;

export function levelFor(grade: Omit<Grade, 'level'>): Level {
  if (!grade.solved || grade.maxTier >= 4) return 'extreme';
  if (grade.maxTier === 3) return 'master';
  if (grade.maxTier === 2) return 'expert';
  if (grade.maxTier === 1) return 'hard';
  if (grade.hiddenSinglesOnly && grade.givens >= EASY_MIN_GIVENS) return 'easy';
  return 'medium';
}

/** The tier a level needs. Extreme also accepts puzzles beyond the technique set (tier 5). */
export function tierForLevel(level: Level): number {
  switch (level) {
    case 'easy':
    case 'medium':
      return 0;
    case 'hard':
      return 1;
    case 'expert':
      return 2;
    case 'master':
      return 3;
    case 'extreme':
      return 4;
  }
}

/** Runs the logical solver. `maxTier` stops early once a harder technique would be needed. */
export function grade(puzzle: readonly number[], maxTier = 4): Grade {
  const board = boardFrom(puzzle);
  const counts: Partial<Record<Technique, number>> = {};
  let top = 0;
  let hiddenOnly = true;
  let solved = false;
  for (;;) {
    if (isSolved(board)) {
      solved = true;
      break;
    }
    if (isBroken(board)) break;
    const step = nextStep(board, maxTier);
    if (!step) break;
    counts[step.technique] = (counts[step.technique] ?? 0) + 1;
    top = Math.max(top, TECHNIQUE_TIER[step.technique]);
    if (step.technique !== 'fullHouse' && step.technique !== 'hiddenSingle') hiddenOnly = false;
    applyStep(board, step);
  }
  const givens = puzzle.filter((v) => v > 0).length;
  const base = { solved, maxTier: solved ? top : 5, counts, hiddenSinglesOnly: solved && hiddenOnly, givens };
  return { ...base, level: levelFor(base) };
}
