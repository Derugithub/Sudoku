/** Pure layout for the win confetti: where each piece starts, how it falls and what it looks like. */
import { mulberry32 } from '@/sudoku/rng';

export type ConfettiShape = 'rect' | 'strip' | 'dot';

export type ConfettiPiece = {
  /** Horizontal start, 0..width. */
  x: number;
  delay: number;
  duration: number;
  /** Side-to-side sway amplitude in px and the number of full sways during the fall. */
  sway: number;
  swayCycles: number;
  /** Total flat rotation and 3D flip, in degrees, over the fall. */
  spin: number;
  flip: number;
  size: number;
  shape: ConfettiShape;
  color: string;
};

export type ConfettiOptions = {
  seed: number;
  width: number;
  count: number;
  colors: readonly string[];
  minMs: number;
  maxMs: number;
  maxDelayMs: number;
};

const SHAPES: readonly ConfettiShape[] = ['rect', 'rect', 'strip', 'dot'];

export function layoutConfetti(o: ConfettiOptions): ConfettiPiece[] {
  const rng = mulberry32(o.seed);
  return Array.from({ length: o.count }, () => ({
    x: rng() * o.width,
    delay: Math.floor(rng() * o.maxDelayMs),
    duration: Math.round(o.minMs + rng() * (o.maxMs - o.minMs)),
    sway: 14 + rng() * 40,
    swayCycles: 1 + rng() * 2,
    spin: (rng() - 0.5) * 1080,
    flip: 360 + rng() * 720,
    size: 8 + rng() * 8,
    shape: SHAPES[Math.floor(rng() * SHAPES.length)],
    color: o.colors[Math.floor(rng() * o.colors.length)],
  }));
}

/** Resting spots for the reduced-motion version: pieces scattered over the screen, not moving. */
export function layoutStaticConfetti(o: ConfettiOptions & { height: number }): (ConfettiPiece & { y: number; tilt: number })[] {
  const rng = mulberry32(o.seed ^ 0x9e3779b9);
  return layoutConfetti(o).map((piece) => ({ ...piece, y: rng() * o.height, tilt: (rng() - 0.5) * 120 }));
}
