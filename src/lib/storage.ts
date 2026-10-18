/** Key-value persistence on expo-sqlite's kv-store. Failures never throw into the UI. */

export const KEYS = {
  settings: 'sudokucalm.settings.v1',
  stats: 'sudokucalm.stats.v1',
  daily: 'sudokucalm.daily.v1',
  game: 'sudokucalm.game.v1',
  buffer: 'sudokucalm.buffer.v1',
  ads: 'sudokucalm.ads.v1',
  review: 'sudokucalm.review.v1',
  fallbackCursor: 'sudokucalm.fallback.v1',
} as const;

type Kv = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  setItemSync: (key: string, value: string) => void;
};

function kv(): Kv {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-sqlite/kv-store').default as Kv;
}

export async function readRaw(key: string): Promise<string | null> {
  try {
    return await kv().getItem(key);
  } catch {
    return null;
  }
}

export async function writeRaw(key: string, value: string): Promise<void> {
  try {
    await kv().setItem(key, value);
  } catch {
    // Keep playing; the next write tries again.
  }
}

export async function removeRaw(key: string): Promise<void> {
  try {
    await kv().removeItem(key);
  } catch {
    // ignore
  }
}

/** For the moment the app goes to the background, before Android may freeze the process. */
export function writeRawSync(key: string, value: string): void {
  try {
    kv().setItemSync(key, value);
  } catch {
    // ignore
  }
}
