/**
 * Where puzzles come from. Starting a game is always instant:
 *   1. a persisted buffer of pre-generated puzzles per level (refilled in the background), else
 *   2. the bundled seeded fallback set, shown through a random symmetry so it looks new.
 * Generation runs in small time slices on the JS thread and pauses while a puzzle is being played.
 */
import { dailyPuzzleSteps } from '@/sudoku/daily';
import { FALLBACK_PUZZLES } from '@/sudoku/fallback-puzzles';
import { generatePuzzleSteps, type Puzzle } from '@/sudoku/generator';
import { LEVELS, isLevel, type Level } from '@/sudoku/grader';
import { mulberry32, randomSeed } from '@/sudoku/rng';
import { transformPuzzle } from '@/sudoku/transform';
import { KEYS, readRaw, writeRaw } from '@/lib/storage';

const BUFFER_TARGET = 2;
const SLICE_MS = 6;
const GAP_MS = 24;
const VALID = /^[1-9.]{81}$/;

type Buffer = Record<Level, [string, string][]>;

let buffer: Buffer | null = null;
let loading: Promise<Buffer> | null = null;
let paused = false;
let filling = false;

function emptyBuffer(): Buffer {
  return Object.fromEntries(LEVELS.map((l) => [l, []])) as unknown as Buffer;
}

export function parseBuffer(raw: string | null): Buffer {
  const out = emptyBuffer();
  if (!raw) return out;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    for (const [level, list] of Object.entries(v)) {
      if (!isLevel(level) || !Array.isArray(list)) continue;
      out[level] = list
        .filter((p): p is [string, string] => Array.isArray(p) && VALID.test(p[0]) && /^[1-9]{81}$/.test(p[1]))
        .slice(0, BUFFER_TARGET);
    }
  } catch {
    // start empty
  }
  return out;
}

async function getBuffer(): Promise<Buffer> {
  if (buffer) return buffer;
  loading ??= readRaw(KEYS.buffer).then((raw) => (buffer = parseBuffer(raw)));
  return loading;
}

function saveBuffer() {
  if (buffer) void writeRaw(KEYS.buffer, JSON.stringify(buffer));
}

function fallbackPuzzle(level: Level): Puzzle {
  const list = FALLBACK_PUZZLES[level];
  const rng = mulberry32(randomSeed());
  const [g, s] = list[Math.floor(rng() * list.length)];
  const t = transformPuzzle(g, s, rng);
  return { givens: t.givens, solution: t.solution, level };
}

/** A puzzle for this level right away. Kicks off a background refill. */
export async function takePuzzle(level: Level): Promise<Puzzle> {
  const buf = await getBuffer();
  const next = buf[level].shift();
  saveBuffer();
  scheduleFill();
  if (next) return { givens: next[0], solution: next[1], level };
  return fallbackPuzzle(level);
}

/** The game screen pauses generation while a puzzle is being played. */
export function setGenerationPaused(value: boolean): void {
  paused = value;
  if (!value) scheduleFill();
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs a step generator in time slices. */
export async function runSliced<T>(
  it: Generator<void, T, void>,
  options: { sliceMs?: number; gapMs?: number; respectPause?: boolean } = {},
): Promise<T> {
  const slice = options.sliceMs ?? SLICE_MS;
  const gap = options.gapMs ?? GAP_MS;
  for (;;) {
    while (options.respectPause && paused) await wait(250);
    const end = Date.now() + slice;
    while (Date.now() < end) {
      const r = it.next();
      if (r.done) return r.value;
    }
    await wait(gap);
  }
}

function scheduleFill() {
  if (filling) return;
  filling = true;
  setTimeout(() => {
    void fill().finally(() => {
      filling = false;
    });
  }, 1500);
}

async function fill(): Promise<void> {
  const buf = await getBuffer();
  for (;;) {
    const level = LEVELS.find((l) => buf[l].length < BUFFER_TARGET);
    if (!level) return;
    const puzzle = await runSliced(generatePuzzleSteps(level, mulberry32(randomSeed())), { respectPause: true });
    buf[level].push([puzzle.givens, puzzle.solution]);
    saveBuffer();
  }
}

/** Starts filling the buffer after launch. */
export function warmUpPuzzles(): void {
  scheduleFill();
}

const dailyCache = new Map<string, Promise<Puzzle>>();

/** Today's (or any day's) puzzle, generated from the date in larger slices while the player waits. */
export function getDailyPuzzle(key: string): Promise<Puzzle> {
  let p = dailyCache.get(key);
  if (!p) {
    p = runSliced(dailyPuzzleSteps(key), { sliceMs: 14, gapMs: 4 });
    dailyCache.set(key, p);
    if (dailyCache.size > 8) dailyCache.delete(dailyCache.keys().next().value!);
  }
  return p;
}
