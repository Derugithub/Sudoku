/** Per-level statistics. Pure functions over a plain record so they can be saved as JSON. */
import { LEVELS, type Level } from './grader';

export type LevelStats = {
  played: number;
  won: number;
  /** Wins with no mistakes and no hints. */
  perfect: number;
  bestMs: number | null;
  totalWinMs: number;
  streak: number;
  bestStreak: number;
};

export type Stats = Record<Level, LevelStats>;

export const EMPTY_LEVEL: LevelStats = { played: 0, won: 0, perfect: 0, bestMs: null, totalWinMs: 0, streak: 0, bestStreak: 0 };

export function emptyStats(): Stats {
  return Object.fromEntries(LEVELS.map((l) => [l, { ...EMPTY_LEVEL }])) as Stats;
}

export function recordStart(stats: Stats, level: Level): Stats {
  return { ...stats, [level]: { ...stats[level], played: stats[level].played + 1 } };
}

export function recordWin(stats: Stats, level: Level, ms: number, perfect: boolean): Stats {
  const s = stats[level];
  const streak = s.streak + 1;
  return {
    ...stats,
    [level]: {
      ...s,
      won: s.won + 1,
      perfect: s.perfect + (perfect ? 1 : 0),
      bestMs: s.bestMs == null ? ms : Math.min(s.bestMs, ms),
      totalWinMs: s.totalWinMs + ms,
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
    },
  };
}

/** A loss or an abandoned game ends the win streak. */
export function recordLoss(stats: Stats, level: Level): Stats {
  return { ...stats, [level]: { ...stats[level], streak: 0 } };
}

export function averageMs(s: LevelStats): number | null {
  return s.won > 0 ? Math.round(s.totalWinMs / s.won) : null;
}

export function winRate(s: LevelStats): number {
  return s.played > 0 ? s.won / s.played : 0;
}

export function parseStats(raw: string | null): Stats {
  const base = emptyStats();
  if (!raw) return base;
  try {
    const v = JSON.parse(raw) as Record<string, Partial<LevelStats>>;
    for (const level of LEVELS) {
      const s = v?.[level];
      if (!s || typeof s !== 'object') continue;
      const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
      base[level] = {
        played: n(s.played),
        won: n(s.won),
        perfect: n(s.perfect),
        bestMs: typeof s.bestMs === 'number' && s.bestMs > 0 ? s.bestMs : null,
        totalWinMs: n(s.totalWinMs),
        streak: n(s.streak),
        bestStreak: n(s.bestStreak),
      };
    }
    return base;
  } catch {
    return base;
  }
}
