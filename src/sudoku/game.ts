/**
 * The game as a pure state machine: place, notes, erase, undo, hints, mistakes, second chance,
 * restart, progress, timer. The screen keeps a GameState and feeds it actions; nothing here
 * touches React or storage.
 */
import { bit, CELL_UNITS, PEERS, UNITS } from './grid';
import { isLevel, type Level } from './grader';
import { freeHintsFor, REWARDED_HINTS_PER_GAME, type Hint } from './hints';

/** Three mistakes end the game (always on whenever mistakes are checked). */
export const MISTAKE_LIMIT = 3;
/** Undo snapshots kept in the autosave. In memory, undo is unlimited. */
export const SAVED_HISTORY = 200;

export type Snapshot = { values: string; notes: number[] };

export type GameStatus = 'playing' | 'won' | 'lost';

export type GameState = {
  id: string;
  level: Level;
  /** Local date key (YYYY-MM-DD) for a Daily Challenge, else null. */
  daily: string | null;
  givens: string;
  solution: string;
  values: number[];
  /** Pencil marks per cell as a 9-bit mask. */
  notes: number[];
  mistakes: number;
  history: Snapshot[];
  freeHints: number;
  freeHintsUsed: number;
  rewardedHintsUsed: number;
  secondChanceUsed: boolean;
  /** Rewarded ads watched during this game (hints, second chance, daily unlock). */
  rewardedAds: number;
  elapsedMs: number;
  status: GameStatus;
  startedAt: number;
};

export type PlayOptions = {
  /** Count and show wrong digits. Three counted mistakes end the game. */
  mistakeCheck: boolean;
  /** Placing a digit removes it from the notes in the same row, column and box. */
  autoRemoveNotes: boolean;
};

export type GameEvents = {
  placed?: { cell: number; digit: number };
  noted?: boolean;
  mistake?: boolean;
  /** Units (0-26) completed correctly by this move. */
  completedUnits: number[];
  won?: boolean;
  lost?: boolean;
};

export type Result = { state: GameState; events: GameEvents };

const none = (state: GameState): Result => ({ state, events: { completedUnits: [] } });

export function newGame(input: {
  id: string;
  level: Level;
  givens: string;
  solution: string;
  daily?: string | null;
  now: number;
}): GameState {
  const values = [...input.givens].map((ch) => (ch >= '1' && ch <= '9' ? Number(ch) : 0));
  return {
    id: input.id,
    level: input.level,
    daily: input.daily ?? null,
    givens: input.givens,
    solution: input.solution,
    values,
    notes: new Array(81).fill(0),
    mistakes: 0,
    history: [],
    freeHints: freeHintsFor(input.level),
    freeHintsUsed: 0,
    rewardedHintsUsed: 0,
    secondChanceUsed: false,
    rewardedAds: 0,
    elapsedMs: 0,
    status: 'playing',
    startedAt: input.now,
  };
}

export function isGiven(state: GameState, cell: number): boolean {
  const ch = state.givens[cell];
  return ch >= '1' && ch <= '9';
}

export function solutionAt(state: GameState, cell: number): number {
  return Number(state.solution[cell]);
}

export function isWrong(state: GameState, cell: number): boolean {
  const v = state.values[cell];
  return v > 0 && v !== solutionAt(state, cell);
}

export function solutionDigits(state: GameState): number[] {
  return [...state.solution].map(Number);
}

/** How many of each digit 1-9 are still to place (index 0 unused). Counts correct digits only. */
export function remainingCounts(state: GameState): number[] {
  const left = [0, 9, 9, 9, 9, 9, 9, 9, 9, 9];
  for (let i = 0; i < 81; i++) {
    const v = state.values[i];
    if (v && v === solutionAt(state, i)) left[v]--;
  }
  return left;
}

function snapshot(state: GameState): Snapshot {
  return { values: state.values.join(''), notes: [...state.notes] };
}

function pushHistory(state: GameState): Snapshot[] {
  return [...state.history, snapshot(state)];
}

function completedUnitsAt(state: GameState, cell: number): number[] {
  return CELL_UNITS[cell].filter((u) => UNITS[u].every((c) => state.values[c] === solutionAt(state, c)));
}

function isComplete(state: GameState): boolean {
  for (let i = 0; i < 81; i++) if (state.values[i] !== solutionAt(state, i)) return false;
  return true;
}

function writeDigit(state: GameState, cell: number, digit: number, autoRemoveNotes: boolean): GameState {
  const values = [...state.values];
  values[cell] = digit;
  const notes = [...state.notes];
  notes[cell] = 0;
  if (autoRemoveNotes) for (const p of PEERS[cell]) notes[p] &= ~bit(digit);
  return { ...state, values, notes };
}

export function place(state: GameState, cell: number, digit: number, options: PlayOptions): Result {
  if (state.status !== 'playing' || isGiven(state, cell) || digit < 1 || digit > 9) return none(state);
  if (state.values[cell] === digit) return none(state);
  let next = writeDigit({ ...state, history: pushHistory(state) }, cell, digit, options.autoRemoveNotes);
  const wrong = digit !== solutionAt(state, cell);
  const events: GameEvents = { placed: { cell, digit }, completedUnits: [] };
  if (wrong && options.mistakeCheck) {
    next = { ...next, mistakes: next.mistakes + 1 };
    events.mistake = true;
    if (next.mistakes >= MISTAKE_LIMIT) {
      next = { ...next, status: 'lost' };
      events.lost = true;
    }
  }
  if (!wrong) {
    events.completedUnits = completedUnitsAt(next, cell);
    if (isComplete(next)) {
      next = { ...next, status: 'won' };
      events.won = true;
    }
  }
  return { state: next, events };
}

export function toggleNote(state: GameState, cell: number, digit: number): Result {
  if (state.status !== 'playing' || isGiven(state, cell) || state.values[cell] || digit < 1 || digit > 9) {
    return none(state);
  }
  const notes = [...state.notes];
  notes[cell] ^= bit(digit);
  return { state: { ...state, history: pushHistory(state), notes }, events: { noted: true, completedUnits: [] } };
}

export function erase(state: GameState, cell: number): Result {
  if (state.status !== 'playing' || isGiven(state, cell)) return none(state);
  if (!state.values[cell] && !state.notes[cell]) return none(state);
  const values = [...state.values];
  const notes = [...state.notes];
  values[cell] = 0;
  notes[cell] = 0;
  return { state: { ...state, history: pushHistory(state), values, notes }, events: { completedUnits: [] } };
}

export function canUndo(state: GameState): boolean {
  return state.status === 'playing' && state.history.length > 0;
}

/** Restores the board before the last move. Mistakes already made stay counted. */
export function undo(state: GameState): Result {
  if (!canUndo(state)) return none(state);
  const history = state.history.slice(0, -1);
  const last = state.history[state.history.length - 1];
  return {
    state: { ...state, history, values: [...last.values].map(Number), notes: [...last.notes] },
    events: { completedUnits: [] },
  };
}

export function freeHintsLeft(state: GameState): number {
  return Math.max(0, state.freeHints - state.freeHintsUsed);
}

export function canWatchForHint(state: GameState): boolean {
  return freeHintsLeft(state) === 0 && state.rewardedHintsUsed < REWARDED_HINTS_PER_GAME;
}

/** Fills the hint's cell. `source` says which allowance pays for it. */
export function applyHint(state: GameState, hint: Hint, source: 'free' | 'rewarded', options: PlayOptions): Result {
  if (state.status !== 'playing') return none(state);
  if (source === 'free' && freeHintsLeft(state) <= 0) return none(state);
  if (source === 'rewarded' && state.rewardedHintsUsed >= REWARDED_HINTS_PER_GAME) return none(state);
  if (hint.digit !== solutionAt(state, hint.cell)) return none(state);
  let next = writeDigit({ ...state, history: pushHistory(state) }, hint.cell, hint.digit, options.autoRemoveNotes);
  next =
    source === 'free'
      ? { ...next, freeHintsUsed: next.freeHintsUsed + 1 }
      : { ...next, rewardedHintsUsed: next.rewardedHintsUsed + 1, rewardedAds: next.rewardedAds + 1 };
  const events: GameEvents = { placed: { cell: hint.cell, digit: hint.digit }, completedUnits: completedUnitsAt(next, hint.cell) };
  if (isComplete(next)) {
    next = { ...next, status: 'won' };
    events.won = true;
  }
  return { state: next, events };
}

export function hintsUsed(state: GameState): number {
  return state.freeHintsUsed + state.rewardedHintsUsed;
}

export function canSecondChance(state: GameState): boolean {
  return state.status === 'lost' && !state.secondChanceUsed;
}

/** After the rewarded ad: back to playing with one mistake to spare. */
export function secondChance(state: GameState): GameState {
  if (!canSecondChance(state)) return state;
  return {
    ...state,
    status: 'playing',
    mistakes: MISTAKE_LIMIT - 1,
    secondChanceUsed: true,
    rewardedAds: state.rewardedAds + 1,
  };
}

export function tick(state: GameState, ms: number): GameState {
  if (state.status !== 'playing' || ms <= 0) return state;
  return { ...state, elapsedMs: state.elapsedMs + Math.min(ms, 5_000) };
}

/** Cells that were empty when the puzzle started. */
export function emptyAtStart(state: GameState): number {
  let n = 0;
  for (let i = 0; i < 81; i++) if (!isGiven(state, i)) n++;
  return n;
}

/** Correctly filled cells as a share of the cells that started empty, 0-100, rounded down. */
export function progressPercent(state: GameState): number {
  const total = emptyAtStart(state);
  if (total === 0) return 100;
  let correct = 0;
  for (let i = 0; i < 81; i++) if (!isGiven(state, i) && state.values[i] === solutionAt(state, i)) correct++;
  return Math.floor((correct * 100) / total);
}

/** Anything a restart or a new puzzle would throw away: entries, notes or mistakes. */
export function hasProgress(state: GameState): boolean {
  if (state.mistakes > 0) return true;
  for (let i = 0; i < 81; i++) {
    if (isGiven(state, i)) continue;
    if (state.values[i] || state.notes[i]) return true;
  }
  return false;
}

/**
 * The same puzzle from its starting givens: entries, notes, undo history, mistakes and the timer
 * are cleared. Hint allowances already spent, the second chance and the count of rewarded ads stay
 * with the puzzle, so restarting cannot refill free hints or another chance. A restart is not a
 * finished puzzle (no stats, no interstitial).
 */
export function restart(state: GameState): GameState {
  const values = [...state.givens].map((ch) => (ch >= '1' && ch <= '9' ? Number(ch) : 0));
  return {
    ...state,
    values,
    notes: new Array(81).fill(0),
    history: [],
    mistakes: 0,
    elapsedMs: 0,
    status: 'playing',
  };
}

export function noteRewardedAd(state: GameState): GameState {
  return { ...state, rewardedAds: state.rewardedAds + 1 };
}

// ---- save / load ----

export function serializeGame(state: GameState): string {
  return JSON.stringify({ v: 1, ...state, history: state.history.slice(-SAVED_HISTORY) });
}

const digitString = (s: unknown): s is string => typeof s === 'string' && /^[0-9]{81}$/.test(s);
const givensString = (s: unknown): s is string => typeof s === 'string' && /^[1-9.]{81}$/.test(s);
const maskArray = (a: unknown): a is number[] =>
  Array.isArray(a) && a.length === 81 && a.every((n) => Number.isInteger(n) && n >= 0 && n <= 0x1ff);
const count = (n: unknown, max = 1_000_000): number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), max) : 0;

/** Parses a saved game. Returns null for anything malformed so a bad save never crashes the app. */
export function parseGame(raw: string | null): GameState | null {
  if (!raw) return null;
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object' || v.v !== 1) return null;
  if (!isLevel(v.level) || !givensString(v.givens) || typeof v.solution !== 'string' || !/^[1-9]{81}$/.test(v.solution)) {
    return null;
  }
  if (!Array.isArray(v.values) || v.values.length !== 81 || !maskArray(v.notes)) return null;
  const values = (v.values as unknown[]).map((n) => (Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 9 ? (n as number) : -1));
  if (values.some((n) => n < 0)) return null;
  const givens = v.givens;
  for (let i = 0; i < 81; i++) if (givens[i] !== '.' && Number(givens[i]) !== values[i]) return null;
  const history = Array.isArray(v.history)
    ? (v.history as unknown[]).filter(
        (h): h is Snapshot => !!h && typeof h === 'object' && digitString((h as Snapshot).values) && maskArray((h as Snapshot).notes),
      )
    : [];
  const status = v.status === 'won' || v.status === 'lost' ? v.status : 'playing';
  return {
    id: typeof v.id === 'string' ? v.id : 'game',
    level: v.level,
    daily: typeof v.daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.daily) ? v.daily : null,
    givens,
    solution: v.solution,
    values,
    notes: v.notes,
    mistakes: count(v.mistakes, MISTAKE_LIMIT),
    history,
    freeHints: count(v.freeHints, 9),
    freeHintsUsed: count(v.freeHintsUsed, 9),
    rewardedHintsUsed: count(v.rewardedHintsUsed, REWARDED_HINTS_PER_GAME),
    secondChanceUsed: v.secondChanceUsed === true,
    rewardedAds: count(v.rewardedAds, 100),
    elapsedMs: count(v.elapsedMs, 1_000 * 60 * 60 * 100),
    status,
    startedAt: count(v.startedAt, Number.MAX_SAFE_INTEGER),
  };
}
