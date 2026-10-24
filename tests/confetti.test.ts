import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutConfetti, layoutStaticConfetti } from '../src/lib/confetti-layout.ts';
import { MOTION } from '../src/theme/tokens.ts';

const options = {
  seed: 7,
  width: 400,
  height: 800,
  count: MOTION.confettiCount,
  colors: ['#111111', '#222222', '#333333'],
  minMs: MOTION.confettiMinMs,
  maxMs: MOTION.confettiMaxMs,
  maxDelayMs: MOTION.confettiDelayMs,
};

test('confetti layout is deterministic and stays inside its limits', () => {
  const a = layoutConfetti(options);
  assert.deepEqual(a, layoutConfetti(options));
  assert.notDeepEqual(a, layoutConfetti({ ...options, seed: 8 }));
  assert.equal(a.length, 90);
  for (const piece of a) {
    assert.ok(piece.x >= 0 && piece.x <= options.width);
    assert.ok(piece.delay >= 0 && piece.delay < options.maxDelayMs);
    assert.ok(piece.duration >= options.minMs && piece.duration <= options.maxMs);
    assert.ok(options.colors.includes(piece.color));
    assert.ok(piece.size > 0);
  }
  // A full-screen effect: the pieces cover the width, not one corner.
  assert.ok(Math.min(...a.map((p) => p.x)) < options.width * 0.15);
  assert.ok(Math.max(...a.map((p) => p.x)) > options.width * 0.85);
});

test('the reduced-motion confetti is a lighter, still scatter on screen', () => {
  assert.ok(MOTION.confettiStaticCount < MOTION.confettiCount);
  const still = layoutStaticConfetti({ ...options, count: MOTION.confettiStaticCount });
  assert.equal(still.length, MOTION.confettiStaticCount);
  for (const piece of still) assert.ok(piece.y >= 0 && piece.y <= options.height);
});

test('the win jingle is a bundled WAV of about two seconds', () => {
  const wav = readFileSync(new URL('../assets/sounds/win.wav', import.meta.url));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  const seconds = wav.readUInt32LE(40) / 2 / wav.readUInt32LE(24);
  assert.ok(seconds >= 1.5 && seconds <= 2.1, `${seconds}s`);
  assert.ok(wav.length < 100 * 1024, `${wav.length} bytes`);
});
