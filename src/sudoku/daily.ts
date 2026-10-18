/**
 * Daily Challenge: the date picks the seed, so every player gets the same puzzle on the same day,
 * fully offline. Streaks and the calendar are computed from the set of completed days.
 */
import { generatePuzzleSteps, type Puzzle } from './generator';
import type { Level } from './grader';
import { rngFromString } from './rng';

/** Bump only with a deliberate puzzle change: it changes every daily puzzle. */
export const DAILY_SEED_VERSION = 'sudoku-calm-daily-v1';
/** How far back a missed day can be unlocked with a rewarded ad. */
export const MISSED_DAY_WINDOW = 30;

export function dateKey(time: number | Date): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Whole days from a to b (b later is positive). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86_400_000);
}

/** Medium Monday to Thursday, Hard on Friday and Saturday, Expert on Sunday. */
export function dailyLevel(key: string): Level {
  const day = parseDateKey(key).getDay();
  if (day === 0) return 'expert';
  if (day === 6) return 'hard';
  return day === 5 ? 'hard' : 'medium';
}

export function dailySeed(key: string): string {
  return `${DAILY_SEED_VERSION}:${key}`;
}

export function dailyPuzzleSteps(key: string): Generator<void, Puzzle, void> {
  return generatePuzzleSteps(dailyLevel(key), rngFromString(dailySeed(key)));
}

export function dailyPuzzle(key: string): Puzzle {
  const it = dailyPuzzleSteps(key);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

export type DailyResult = { timeMs: number; mistakes: number; hints: number };

export type DailyRecord = {
  completed: Record<string, DailyResult>;
  /** Missed days unlocked with a rewarded ad. */
  unlocked: string[];
};

export const EMPTY_DAILY: DailyRecord = { completed: {}, unlocked: [] };

export function completeDaily(record: DailyRecord, key: string, result: DailyResult): DailyRecord {
  const prev = record.completed[key];
  const best = prev && prev.timeMs <= result.timeMs ? prev : result;
  return { ...record, completed: { ...record.completed, [key]: best } };
}

export function unlockDay(record: DailyRecord, key: string): DailyRecord {
  if (record.unlocked.includes(key)) return record;
  return { ...record, unlocked: [...record.unlocked, key].slice(-120) };
}

export type DayStatus = 'done' | 'today' | 'missed' | 'unlocked' | 'future' | 'expired';

export function dayStatus(record: DailyRecord, key: string, today: string): DayStatus {
  if (record.completed[key]) return 'done';
  const diff = daysBetween(key, today);
  if (diff === 0) return 'today';
  if (diff < 0) return 'future';
  if (diff > MISSED_DAY_WINDOW) return 'expired';
  return record.unlocked.includes(key) ? 'unlocked' : 'missed';
}

/** Today's and unlocked missed days are playable. A missed day needs a rewarded ad first. */
export function canPlayDay(record: DailyRecord, key: string, today: string): boolean {
  const s = dayStatus(record, key, today);
  return s === 'today' || s === 'unlocked' || s === 'done';
}

/** Consecutive completed days ending today, or yesterday when today is still open. */
export function currentStreak(record: DailyRecord, today: string): number {
  let day = record.completed[today] ? today : addDays(today, -1);
  let n = 0;
  while (record.completed[day]) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(record: DailyRecord): number {
  const days = Object.keys(record.completed).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Calendar cells for a month: leading nulls (Monday first), then day keys. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1, 12);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0, 12).getDate();
  const out: (string | null)[] = new Array(lead).fill(null);
  for (let d = 1; d <= days; d++) out.push(dateKey(new Date(year, month, d, 12)));
  return out;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDaily(raw: string | null): DailyRecord {
  if (!raw) return EMPTY_DAILY;
  try {
    const v = JSON.parse(raw) as Partial<DailyRecord>;
    const completed: Record<string, DailyResult> = {};
    if (v.completed && typeof v.completed === 'object') {
      for (const [k, r] of Object.entries(v.completed)) {
        if (!DATE_KEY.test(k) || !r || typeof r !== 'object') continue;
        const res = r as DailyResult;
        completed[k] = {
          timeMs: Number.isFinite(res.timeMs) ? res.timeMs : 0,
          mistakes: Number.isFinite(res.mistakes) ? res.mistakes : 0,
          hints: Number.isFinite(res.hints) ? res.hints : 0,
        };
      }
    }
    const unlocked = Array.isArray(v.unlocked) ? v.unlocked.filter((k): k is string => typeof k === 'string' && DATE_KEY.test(k)) : [];
    return { completed, unlocked };
  } catch {
    return EMPTY_DAILY;
  }
}
