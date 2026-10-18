/**
 * App-wide game data: per-level stats, the Daily Challenge record and the game in progress.
 * Everything is saved to the kv-store; the current game also flushes synchronously on background.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getDailyPuzzle, takePuzzle, warmUpPuzzles } from '@/lib/puzzle-source';
import { KEYS, readRaw, removeRaw, writeRaw, writeRawSync } from '@/lib/storage';
import { completeDaily, EMPTY_DAILY, parseDaily, unlockDay, type DailyRecord } from '@/sudoku/daily';
import { hintsUsed, newGame, parseGame, serializeGame, type GameState } from '@/sudoku/game';
import type { Level } from '@/sudoku/grader';
import { emptyStats, parseStats, recordLoss, recordStart, recordWin, type Stats } from '@/sudoku/stats';

type AppDataValue = {
  loaded: boolean;
  stats: Stats;
  daily: DailyRecord;
  /** The game in progress (or just finished and not yet dismissed). */
  game: GameState | null;
  startLevel: (level: Level) => Promise<GameState>;
  startDaily: (date: string) => Promise<GameState>;
  /** Saves the latest game state (debounced). */
  saveGame: (game: GameState) => void;
  /** Records the result of a game that just ended. Idempotent per game id. */
  finishGame: (game: GameState) => { newBest: boolean };
  unlockDaily: (date: string) => void;
};

const Ctx = createContext<AppDataValue | null>(null);

const SAVE_DELAY_MS = 400;

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [daily, setDaily] = useState<DailyRecord>(EMPTY_DAILY);
  const [game, setGame] = useState<GameState | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const statsRef = useRef<Stats>(emptyStats());
  const dailyRef = useRef<DailyRecord>(EMPTY_DAILY);
  const finished = useRef(new Set<string>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([readRaw(KEYS.stats), readRaw(KEYS.daily), readRaw(KEYS.game)]).then(([s, d, g]) => {
      if (!alive) return;
      statsRef.current = parseStats(s);
      dailyRef.current = parseDaily(d);
      const saved = parseGame(g);
      gameRef.current = saved && saved.status === 'playing' ? saved : null;
      setStats(statsRef.current);
      setDaily(dailyRef.current);
      setGame(gameRef.current);
      setLoaded(true);
      warmUpPuzzles();
    });
    const sub = AppState.addEventListener('change', (status) => {
      if (status !== 'background') return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const g = gameRef.current;
      if (g) writeRawSync(KEYS.game, serializeGame(g));
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const putStats = useCallback((next: Stats) => {
    statsRef.current = next;
    setStats(next);
    void writeRaw(KEYS.stats, JSON.stringify(next));
  }, []);

  const putDaily = useCallback((next: DailyRecord) => {
    dailyRef.current = next;
    setDaily(next);
    void writeRaw(KEYS.daily, JSON.stringify(next));
  }, []);

  const putGame = useCallback((next: GameState | null) => {
    gameRef.current = next;
    setGame(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (next) void writeRaw(KEYS.game, serializeGame(next));
    else void removeRaw(KEYS.game);
  }, []);

  /** Leaving an unfinished game for a new one ends its win streak. */
  const abandonCurrent = useCallback(() => {
    const g = gameRef.current;
    if (g && g.status === 'playing' && !finished.current.has(g.id)) {
      finished.current.add(g.id);
      putStats(recordLoss(statsRef.current, g.level));
    }
  }, [putStats]);

  const begin = useCallback(
    (next: GameState) => {
      abandonCurrent();
      putStats(recordStart(statsRef.current, next.level));
      putGame(next);
      return next;
    },
    [abandonCurrent, putGame, putStats],
  );

  const startLevel = useCallback(
    async (level: Level) => {
      const p = await takePuzzle(level);
      const now = Date.now();
      return begin(newGame({ id: `${level}-${now}`, level, givens: p.givens, solution: p.solution, now }));
    },
    [begin],
  );

  const startDaily = useCallback(
    async (date: string) => {
      const current = gameRef.current;
      if (current && current.daily === date && current.status === 'playing') return current;
      const p = await getDailyPuzzle(date);
      const now = Date.now();
      return begin(newGame({ id: `daily-${date}-${now}`, level: p.level, givens: p.givens, solution: p.solution, daily: date, now }));
    },
    [begin],
  );

  const saveGame = useCallback((next: GameState) => {
    gameRef.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void writeRaw(KEYS.game, serializeGame(next));
    }, SAVE_DELAY_MS);
  }, []);

  const finishGame = useCallback(
    (g: GameState) => {
      if (finished.current.has(g.id)) return { newBest: false };
      finished.current.add(g.id);
      let newBest = false;
      if (g.status === 'won') {
        const prevBest = statsRef.current[g.level].bestMs;
        newBest = prevBest == null || g.elapsedMs < prevBest;
        putStats(recordWin(statsRef.current, g.level, g.elapsedMs, g.mistakes === 0 && hintsUsed(g) === 0));
        if (g.daily) putDaily(completeDaily(dailyRef.current, g.daily, { timeMs: g.elapsedMs, mistakes: g.mistakes, hints: hintsUsed(g) }));
      } else {
        putStats(recordLoss(statsRef.current, g.level));
      }
      putGame(null);
      return { newBest };
    },
    [putDaily, putGame, putStats],
  );

  const unlockDaily = useCallback((date: string) => putDaily(unlockDay(dailyRef.current, date)), [putDaily]);

  const value = useMemo(
    () => ({ loaded, stats, daily, game, startLevel, startDaily, saveGame, finishGame, unlockDaily }),
    [loaded, stats, daily, game, startLevel, startDaily, saveGame, finishGame, unlockDaily],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppDataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData outside AppDataProvider');
  return v;
}
