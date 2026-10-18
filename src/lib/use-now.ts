import { useSyncExternalStore } from 'react';

/** A shared wall clock that ticks every 15 s, read through an external store so render stays pure. */
let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function emit() {
  current = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) timer = setInterval(emit, 15_000);
  setTimeout(emit, 0);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const snapshot = () => current;

export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
