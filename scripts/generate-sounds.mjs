#!/usr/bin/env node
/**
 * Writes every Sudoku sound effect to assets/sounds as small mono WAV files.
 * Everything is synthesised here from noise and tones with a seeded PRNG, so the output is
 * deterministic and owned by the project (no third-party audio). Run: node scripts/generate-sounds.mjs
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
const SFX_RATE = 16000;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wav(samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Builds a buffer of `seconds` by summing layer functions f(t, i) -> sample. */
function render(seconds, rate, layers) {
  const n = Math.floor(seconds * rate);
  const out = new Float32Array(n);
  for (const layer of layers) layer(out, rate);
  return out;
}

function normalize(buf, peak) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max === 0) return buf;
  const k = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  // Short fades so nothing clicks.
  const fade = Math.min(64, buf.length >> 2);
  for (let i = 0; i < fade; i++) {
    buf[i] *= i / fade;
    buf[buf.length - 1 - i] *= i / fade;
  }
  return buf;
}

const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

/** Filtered noise burst. lp/hp are one-pole cutoffs in Hz (0 = off). */
function noise({ seed = 1, start = 0, dur, attack = 0.002, decay = 0.05, lp = 0, hp = 0, gain = 1 }) {
  return (out, rate) => {
    const r = rng(seed);
    const a = lp ? 1 - Math.exp((-2 * Math.PI * lp) / rate) : 1;
    const b = hp ? Math.exp((-2 * Math.PI * hp) / rate) : 0;
    let low = 0;
    let prevIn = 0;
    let high = 0;
    const s0 = Math.floor(start * rate);
    const n = Math.floor(dur * rate);
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / rate;
      let v = r() * 2 - 1;
      low += a * (v - low);
      v = low;
      if (hp) {
        high = b * (high + v - prevIn);
        prevIn = v;
        v = high;
      }
      out[s0 + i] += v * env(t, attack, decay) * gain;
    }
  };
}

/** Tone with a linear frequency sweep. */
function tone({ f0, f1 = f0, start = 0, dur, attack = 0.004, decay = 0.08, gain = 1, shape = 'sine', vibrato = 0, vibratoRate = 0 }) {
  return (out, rate) => {
    let phase = 0;
    const s0 = Math.floor(start * rate);
    const n = Math.floor(dur * rate);
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / rate;
      const f = f0 + (f1 - f0) * (t / dur) + (vibrato ? Math.sin(2 * Math.PI * vibratoRate * t) * vibrato : 0);
      phase += (2 * Math.PI * f) / rate;
      let v = Math.sin(phase);
      if (shape === 'square') v = v >= 0 ? 0.6 : -0.6;
      else if (shape === 'triangle') v = (2 / Math.PI) * Math.asin(Math.sin(phase));
      out[s0 + i] += v * env(t, attack, decay) * gain;
    }
  };
}

/** One soft bell note: a triangle with a quiet octave above it. */
function bell(f, start, dur, decay) {
  return [
    tone({ f0: f, start, dur, decay, gain: 0.5, shape: 'triangle' }),
    tone({ f0: f * 2, start, dur: dur * 0.6, decay: decay * 0.5, gain: 0.1 }),
  ];
}

/** Adds one decaying echo `delay` seconds behind the sound. */
function echo(buf, delay, level) {
  const d = Math.floor(delay * SFX_RATE);
  for (let i = d; i < buf.length; i++) buf[i] += buf[i - d] * level;
  return buf;
}

const sfx = {
  // Soft tap when a digit is placed: a short damped wooden tick.
  tap: [
    render(0.09, SFX_RATE, [
      tone({ f0: 760, f1: 620, dur: 0.09, attack: 0.002, decay: 0.022, gain: 0.8 }),
      tone({ f0: 1520, f1: 1240, dur: 0.05, attack: 0.001, decay: 0.01, gain: 0.25 }),
      noise({ seed: 11, dur: 0.03, decay: 0.006, lp: 3200, hp: 400, gain: 0.35 }),
    ]),
    0.55,
  ],
  // Lighter tap for pencil notes.
  note: [
    render(0.06, SFX_RATE, [
      tone({ f0: 1250, f1: 1100, dur: 0.06, attack: 0.001, decay: 0.012, gain: 0.6 }),
      noise({ seed: 12, dur: 0.02, decay: 0.004, lp: 5000, hp: 900, gain: 0.25 }),
    ]),
    0.32,
  ],
  // Low muted thud for a mistake. Never harsh.
  mistake: [
    render(0.22, SFX_RATE, [
      tone({ f0: 150, f1: 92, dur: 0.22, attack: 0.004, decay: 0.07, gain: 0.9 }),
      noise({ seed: 13, dur: 0.08, decay: 0.025, lp: 500, gain: 0.5 }),
    ]),
    0.5,
  ],
  // Rising chime when a row, column or box is completed.
  unit: [
    render(0.5, SFX_RATE, [
      tone({ f0: 1046.5, start: 0, dur: 0.32, decay: 0.12, gain: 0.45, shape: 'triangle' }),
      tone({ f0: 1318.5, start: 0.07, dur: 0.32, decay: 0.12, gain: 0.45, shape: 'triangle' }),
      tone({ f0: 1568, start: 0.14, dur: 0.36, decay: 0.16, gain: 0.5, shape: 'triangle' }),
      tone({ f0: 3136, start: 0.14, dur: 0.2, decay: 0.05, gain: 0.08 }),
    ]),
    0.45,
  ],
  // Win jingle (~1.9 s): a bright ascending C major arpeggio that lands on a ringing C-E-G chord,
  // each note a soft bell (triangle plus a quiet octave) with a light echo for sparkle.
  win: [
    echo(
      render(1.9, SFX_RATE, [
        ...[523.25, 659.25, 783.99, 1046.5, 1318.5].flatMap((f, i) => bell(f, i * 0.115, 0.5, 0.11)),
        ...[1046.5, 1318.5, 1568].flatMap((f) => bell(f, 0.6, 1.3, 0.38)),
        tone({ f0: 261.63, start: 0.6, dur: 1.3, decay: 0.5, gain: 0.3 }),
        tone({ f0: 3136, start: 0.6, dur: 0.5, decay: 0.12, gain: 0.07 }),
      ]),
      0.16,
      0.28,
    ),
    0.6,
  ],
};

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, [buf, peak]] of Object.entries(sfx)) {
  const file = wav(normalize(buf, peak), SFX_RATE);
  writeFileSync(join(OUT, `${name}.wav`), file);
  total += file.length;
}
console.log(`Wrote ${Object.keys(sfx).length} sounds, ${(total / 1024).toFixed(0)} KB, to ${OUT}`);
