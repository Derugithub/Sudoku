/**
 * Background music: a soft, calm piano piece that loops seamlessly, synthesised here so there is
 * nothing to license. `npm run music` writes assets/music/calm-piano.m4a (needs ffmpeg for AAC).
 * `node scripts/generate-music.mjs --wav out.wav` writes the raw 16-bit render instead, which is
 * deterministic and can be compared byte for byte between machines.
 *
 * The piece: F major, about 66 BPM, 24 bars of 4/4 (about 87 s). Three 8-bar sections (A, B, A') over a
 * gentle I-iii-IV-V / vi-IV-I-ii progression. The left hand plays broken chords, quarters in the A
 * sections and eighths in B, under a hand-written pentatonic-leaning melody. The last bar sits on C
 * so the loop falls back onto F.
 *
 * The piano voice is additive: up to 14 slightly inharmonic partials, two detuned strings per note
 * for warmth, a two-stage decay that is faster for higher partials, a soft 7 ms hammer with a quiet
 * felt thump, a sustain pedal lifted at each bar line, and dampers. Notes are written into a circular
 * buffer, so tails ringing past the end continue at the start. The Freeverb-style reverb runs over two
 * passes of the loop and keeps the second, so its tail wraps too and the loop point is seamless.
 */
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const BARS = 24;
const AAC_FRAME = 1024;
// 66 BPM, nudged (by under 0.02%) so the loop is a whole number of AAC frames: no end padding
// for the player to trim, which keeps the loop point clean.
const LENGTH = Math.round((BARS * 4 * (60 / 66) * SR) / AAC_FRAME) * AAC_FRAME;
const BAR = LENGTH / SR / BARS;
const BEAT = BAR / 4;

// ---- deterministic randomness (humanising only) ----
let seed = 0x51ca7;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const jitter = (amount) => (rand() * 2 - 1) * amount;

// ---- score ----
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "Bb4" -> MIDI number. */
function midi(name) {
  const m = /^([A-G])(b|#)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0);
}

/** Left-hand voicings, low to high. */
const CHORDS = {
  Fmaj7: ['F2', 'C3', 'A3', 'E4'],
  'F/A': ['A2', 'F3', 'C4', 'A3'],
  Am7: ['A2', 'E3', 'C4', 'G3'],
  Bbmaj7: ['Bb1', 'F2', 'D3', 'A3'],
  Bbmaj9: ['Bb1', 'F2', 'C4', 'A3'],
  Csus2: ['C2', 'G2', 'D3', 'G3'],
  Csus4: ['C2', 'G2', 'F3', 'C4'],
  C: ['C2', 'G2', 'E3', 'C4'],
  Dm7: ['D2', 'A2', 'F3', 'C4'],
  Gm7: ['G1', 'D2', 'Bb2', 'F3'],
};

const PROGRESSION = [
  'Fmaj7', 'Am7', 'Bbmaj7', 'Csus2', 'Fmaj7', 'Dm7', 'Bbmaj9', 'Csus4',
  'Dm7', 'Bbmaj7', 'F/A', 'Gm7', 'Dm7', 'Bbmaj7', 'Gm7', 'Csus4',
  'Fmaj7', 'Am7', 'Bbmaj7', 'Gm7', 'F/A', 'Bbmaj7', 'Csus4', 'C',
];

/** Melody per bar: "note:beats", "r:beats" for a rest. Each bar adds up to 4 beats. */
const MELODY = [
  'r:1 A4:1 C5:2', 'E5:3 D5:1', 'D5:2 C5:1 A4:1', 'G4:3 r:1',
  'r:1 A4:1 C5:1 F5:1', 'E5:2 D5:1 A4:1', 'C5:3 D5:1', 'C5:2 A4:1 G4:1',
  'r:0.5 A4:0.5 D5:0.5 F5:0.5 A5:2', 'G5:1.5 F5:0.5 D5:2', 'C5:1 F5:1 E5:1 C5:1', 'D5:3 r:1',
  'r:0.5 A4:0.5 D5:0.5 F5:0.5 A5:1.5 G5:0.5', 'F5:1 D5:1 F5:1 G5:1', 'A5:2 G5:1 F5:1', 'F5:2 E5:2',
  'r:1 A4:1 C5:2', 'E5:2 G5:1 E5:1', 'D5:2 F5:1 D5:1', 'D5:3 C5:1',
  'A4:2 C5:1 F5:1', 'D5:2 C5:2', 'C5:3 Bb4:1', 'A4:2 G4:2',
];

/** Left-hand patterns: [eighth position, voice index]. */
const QUARTERS = [[0, 0], [2, 1], [4, 2], [6, 3]];
const EIGHTHS = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 2], [5, 1], [6, 2], [7, 1]];

function score() {
  const notes = [];
  for (let bar = 0; bar < BARS; bar++) {
    const barStart = bar * BAR;
    const barEnd = barStart + BAR;
    const section = Math.floor(bar / 8);
    const voicing = CHORDS[PROGRESSION[bar]].map(midi);
    const pattern = section === 1 ? EIGHTHS : QUARTERS;
    for (const [pos, voice] of pattern) {
      const start = barStart + pos * (BEAT / 2) + jitter(0.006);
      const accent = pos === 0 ? 0.08 : pos === 4 ? 0.03 : 0;
      notes.push({ midi: voicing[voice], start, end: barEnd, velocity: 0.3 + accent + jitter(0.025) });
    }
    let beat = 0;
    for (const token of MELODY[bar].split(' ')) {
      const [name, len] = token.split(':');
      const beats = Number(len);
      if (name !== 'r') {
        const start = barStart + beat * BEAT + jitter(0.008);
        const strong = beat === 0 || beat === 2;
        notes.push({ midi: midi(name), start, end: barEnd, velocity: 0.44 + (strong ? 0.05 : 0) + jitter(0.03) });
      }
      beat += beats;
    }
    if (Math.abs(beat - 4) > 1e-9) throw new Error(`bar ${bar + 1} has ${beat} beats`);
  }
  return notes;
}

// ---- piano voice ----
const PEDAL_OVERLAP = 0.08; // pedal lifts just after the bar line (legato pedalling)
const DAMPER = 0.11; // seconds for the felt to stop the string
const TAIL = 0.7; // render this long after the damper falls

function renderNote(out, note) {
  const f0 = 440 * 2 ** ((note.midi - 69) / 12);
  const v = Math.max(0.05, Math.min(1, note.velocity));
  const held = note.end - note.start + PEDAL_OVERLAP;
  const total = held + TAIL;
  const n = Math.round(total * SR);
  const start = Math.round(note.start * SR);
  const pan = Math.max(-0.6, Math.min(0.6, (note.midi - 62) / 36));
  const gl = Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = Math.sin(((pan + 1) * Math.PI) / 4);

  const B = 0.00012 * (f0 / 261.6) ** 0.5; // inharmonicity
  const longDecay = Math.min(9, Math.max(1.1, 4.2 * (261.6 / f0) ** 0.55));
  const brightness = 0.62 - 0.38 * v; // soft notes are darker
  const loudness = 0.16 * v ** 1.4 * (f0 < 110 ? 0.8 : 1); // tame the lowest notes
  const attack = Math.round(0.007 * SR);
  const damperAt = Math.round(held * SR);
  const damperK = Math.exp(-1 / (DAMPER * SR));

  const buf = new Float64Array(n);
  for (let k = 1; k <= 14; k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k);
    if (fk > 7500) break;
    const amp = (loudness / k ** 1.1) * Math.exp(-(k - 1) * brightness);
    if (amp < 1e-5) continue;
    const tau2 = longDecay / (1 + 0.22 * (k - 1));
    const tau1 = tau2 * 0.16;
    const d1 = Math.exp(-1 / (tau1 * SR));
    const d2 = Math.exp(-1 / (tau2 * SR));
    for (const detune of [-0.7, 0.7]) {
      const w = (2 * Math.PI * fk * 2 ** (detune / 1200)) / SR;
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      let re = 0;
      let im = 1;
      let e1 = 0.6 * amp * 0.5;
      let e2 = 0.4 * amp * 0.5;
      let damp = 1;
      for (let i = 0; i < n; i++) {
        const nre = re * cw - im * sw;
        im = re * sw + im * cw;
        re = nre;
        if (i >= damperAt) damp *= damperK;
        buf[i] += im * (e1 + e2) * damp;
        e1 *= d1;
        e2 *= d2;
      }
    }
  }
  // Soft hammer: raised-cosine attack plus a quiet, low-passed felt thump.
  let lp = 0;
  const thumpLen = Math.round(0.035 * SR);
  for (let i = 0; i < n; i++) {
    if (i < attack) buf[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / attack);
    if (i < thumpLen) {
      lp += 0.08 * (jitter(1) - lp);
      buf[i] += lp * 0.025 * v * Math.exp(-i / (0.008 * SR));
    }
  }
  for (let i = 0; i < n; i++) {
    const j = (start + i) % LENGTH; // circular: tails wrap to the start of the loop
    out[0][(j + LENGTH) % LENGTH] += buf[i] * gl;
    out[1][(j + LENGTH) % LENGTH] += buf[i] * gr;
  }
}

// ---- reverb (Freeverb) ----
const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];
const SPREAD = 23;

function reverb(dry, { room = 0.84, damp = 0.4, wet = 0.3, dryGain = 0.82, width = 0.9 } = {}) {
  const feedback = room * 0.28 + 0.7;
  const make = (spread) => ({
    combs: COMBS.map((len) => ({ buf: new Float64Array(len + spread), i: 0, store: 0 })),
    alls: ALLPASSES.map((len) => ({ buf: new Float64Array(len + spread), i: 0 })),
  });
  const chans = [make(0), make(SPREAD)];
  const out = [new Float64Array(LENGTH), new Float64Array(LENGTH)];
  const wet1 = wet * (width / 2 + 0.5);
  const wet2 = wet * ((1 - width) / 2);
  for (let pass = 0; pass < 2; pass++) {
    for (let s = 0; s < LENGTH; s++) {
      const input = (dry[0][s] + dry[1][s]) * 0.015;
      const res = [0, 0];
      for (let c = 0; c < 2; c++) {
        let acc = 0;
        for (const comb of chans[c].combs) {
          const y = comb.buf[comb.i];
          comb.store = y * (1 - damp) + comb.store * damp;
          comb.buf[comb.i] = input + comb.store * feedback;
          comb.i = (comb.i + 1) % comb.buf.length;
          acc += y;
        }
        for (const ap of chans[c].alls) {
          const b = ap.buf[ap.i];
          ap.buf[ap.i] = acc + b * 0.5;
          ap.i = (ap.i + 1) % ap.buf.length;
          acc = b - acc;
        }
        res[c] = acc;
      }
      if (pass === 1) {
        out[0][s] = dry[0][s] * dryGain + res[0] * wet1 + res[1] * wet2;
        out[1][s] = dry[1][s] * dryGain + res[1] * wet1 + res[0] * wet2;
      }
    }
  }
  return out;
}

// ---- output ----
function toWav(ch) {
  // Gentle one-pole low-pass at ~8 kHz (circular, two passes), then normalise the peak to -5 dBFS.
  const a = 1 - Math.exp((-2 * Math.PI * 8000) / SR);
  for (const x of ch) {
    let y = 0;
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < LENGTH; i++) x[i] = y += a * (x[i] - y);
  }
  let peak = 0;
  for (const x of ch) for (let i = 0; i < LENGTH; i++) peak = Math.max(peak, Math.abs(x[i]));
  const gain = 10 ** (-5 / 20) / peak;
  const data = Buffer.alloc(LENGTH * 4);
  for (let i = 0; i < LENGTH; i++) {
    for (let c = 0; c < 2; c++) {
      const s = Math.max(-1, Math.min(1, ch[c][i] * gain));
      data.writeInt16LE(Math.round(s * 32767), i * 4 + c * 2);
    }
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function render() {
  const dry = [new Float64Array(LENGTH), new Float64Array(LENGTH)];
  for (const note of score()) renderNote(dry, note);
  return toWav(reverb(dry));
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wavArg = process.argv.indexOf('--wav');
const started = Date.now();
const wav = render();
if (wavArg >= 0) {
  const path = process.argv[wavArg + 1];
  writeFileSync(path, wav);
  console.log(`Wrote ${path}: ${(LENGTH / SR).toFixed(2)} s, ${(wav.length / 1e6).toFixed(1)} MB, ${Date.now() - started} ms`);
} else {
  const dir = mkdtempSync(join(tmpdir(), 'calm-piano-'));
  const tmp = join(dir, 'calm-piano.wav');
  const out = join(root, 'assets', 'music', 'calm-piano.m4a');
  writeFileSync(tmp, wav);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'aac', '-b:a', '112k', '-map_metadata', '-1', '-fflags', '+bitexact', '-movflags', '+faststart', out], { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
  if (r.error || r.status !== 0) {
    console.error('ffmpeg is needed to encode AAC. Install it, or use --wav <path> to write the raw render.');
    process.exit(1);
  }
  console.log(`Wrote ${out}: ${(LENGTH / SR).toFixed(2)} s, ${(statSync(out).size / 1e6).toFixed(2)} MB, ${Date.now() - started} ms`);
}
