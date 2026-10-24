import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTION, PALETTES, POPUP, TOP_BAR, hintButtonStyle } from '../src/theme/tokens.ts';

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

test('text pairs pass WCAG AA in every theme', () => {
  for (const [name, p] of Object.entries(PALETTES)) {
    const normal: [string, string, string][] = [
      ['text/bg', p.text, p.bg],
      ['text/surface', p.text, p.surface],
      ['muted/bg', p.textMuted, p.bg],
      ['muted/surface', p.textMuted, p.surface],
      ['onAccent/accent', p.onAccent, p.accent],
      ['keyText/key', p.keyText, p.key],
      ['keyActiveText/keyActive', p.keyActiveText, p.keyActive],
      ['badgeText/badge', p.badgeText, p.badge],
    ];
    for (const [label, fg, bg] of normal) assert.ok(contrast(fg, bg) >= 4.5, `${name} ${label} ${contrast(fg, bg).toFixed(2)}`);
    // Board digits are large text (about 60% of a 40+ px cell): AA large is 3:1.
    const boardBgs = [p.board, p.selected, p.cellSelected, p.unitTint, p.sameNumber, p.hintCell];
    for (const bg of boardBgs) {
      assert.ok(contrast(p.given, bg) >= 4.5, `${name} given on ${bg}`);
      assert.ok(contrast(p.player, bg) >= 3, `${name} player on ${bg} ${contrast(p.player, bg).toFixed(2)}`);
    }
    assert.ok(contrast(p.errorText, p.errorBg) >= 3, `${name} error`);
    // Notes are small text, so they need AA normal (4.5:1) on every background an empty cell can
    // have: plain, selected, row/column/box tint, hint target and hint context. (Same-number tint only marks filled cells.)
    for (const bg of [p.board, p.selected, p.cellSelected, p.unitTint, p.hintCell, p.hintPattern]) {
      assert.ok(contrast(p.notes, bg) >= 4.5, `${name} notes on ${bg} ${contrast(p.notes, bg).toFixed(2)}`);
    }
  }
});

function toLab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (v: number) => (v > 216 / 24389 ? Math.cbrt(v) : ((24389 / 27) * v + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
/** CIE76 colour difference: about 2 is just noticeable, 10 is clearly different. */
function deltaE(a: string, b: string): number {
  const [p, q] = [toLab(a), toLab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

test('the tapped cell has its own colour, clearly apart from every other cell highlight', () => {
  for (const [name, p] of Object.entries(PALETTES)) {
    for (const [label, other] of [
      ['plain', p.board],
      ['row/column/box', p.unitTint],
      ['same number', p.sameNumber],
      ['error', p.errorBg],
      ['hint', p.hintCell],
      ['hint pattern', p.hintPattern],
    ] as const) {
      if (name === 'contrast' && label === 'hint') continue; // High contrast keeps its yellow; the black outline tells them apart.
      assert.ok(deltaE(p.cellSelected, other) >= 10, `${name} selected vs ${label} ${deltaE(p.cellSelected, other).toFixed(1)}`);
    }
    // The outline is a graphic: 3:1 against the plain cell and against the selected fill.
    assert.ok(contrast(p.cellSelectedBorder, p.board) >= 3, `${name} outline on board`);
    assert.ok(contrast(p.cellSelectedBorder, p.cellSelected) >= 3, `${name} outline on selected fill`);
  }
  assert.equal(PALETTES.paper.cellSelected, '#E4DDFA');
  assert.equal(PALETTES.paper.cellSelectedBorder, '#5B4BB5');
  assert.equal(PALETTES.midnight.cellSelected, '#342F5E');
  assert.equal(PALETTES.midnight.cellSelectedBorder, '#B9ABFF');
});

test('note colours from the contrast fix, player digits unchanged', () => {
  assert.equal(PALETTES.paper.notes, '#5F646D');
  assert.equal(PALETTES.midnight.notes, '#9AA0A8');
  assert.equal(PALETTES.paper.player, '#3A6EA5');
});

test('hint button has three distinct states', () => {
  const p = PALETTES.paper;
  const kinds = (['free', 'ad', 'used'] as const).map((k) => hintButtonStyle(k, p).badge);
  assert.deepEqual(kinds, ['count', 'play', 'none']);
});

test('game chrome: popup buttons, top-bar icons and the progress bar are legible in every theme', () => {
  for (const [name, p] of Object.entries(PALETTES)) {
    assert.ok(contrast(p.popupPrimaryText, p.popupPrimary) >= 4.5, `${name} popup button text`);
    assert.ok(contrast(p.popupPrimary, p.surface) >= 3, `${name} outlined popup button on the card`);
    assert.ok(contrast(p.topIcon, p.bg) >= 3, `${name} top-bar icons`); // UI graphics: 3:1
    assert.ok(contrast(p.progressFill, p.progressTrack) >= 3, `${name} progress fill on track`);
  }
});

test('game chrome uses the specified Paper and Midnight values', () => {
  assert.equal(PALETTES.paper.topIcon, '#0E3264');
  assert.equal(PALETTES.midnight.topIcon, '#E8E6E1');
  assert.equal(PALETTES.paper.progressTrack, '#E4DED1');
  assert.equal(PALETTES.paper.progressFill, '#3A6EA5');
  assert.equal(PALETTES.paper.popupPrimary, '#0E3264');
  assert.equal(PALETTES.paper.popupPrimaryText, '#FFFFFF');
  assert.equal(POPUP.width, 280);
  assert.equal(POPUP.radius, 20);
  assert.equal(POPUP.padding, 20);
  assert.equal(POPUP.buttonHeight, 48);
  assert.equal(POPUP.buttonGap, 10);
  assert.equal(POPUP.scrim, 'rgba(18,20,23,0.4)');
  assert.equal(MOTION.progressMs, 200);
  assert.equal(TOP_BAR.iconSize, 24);
});

test('top-bar icons fit beside back and title on a 360dp phone with 48dp targets', () => {
  // Back + Restart + Music + Settings, 4px apart, 4px side padding each side.
  const icons = 4 * TOP_BAR.target + 3 * TOP_BAR.gap + 2 * 4;
  const titleRoom = 360 - icons - TOP_BAR.gap;
  assert.ok(titleRoom >= 140, `title gets ${titleRoom}dp`);
});
