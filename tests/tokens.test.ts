import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, hintButtonStyle } from '../src/theme/tokens.ts';

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
    const boardBgs = [p.board, p.selected, p.unitTint, p.sameNumber, p.hintCell];
    for (const bg of boardBgs) {
      assert.ok(contrast(p.given, bg) >= 4.5, `${name} given on ${bg}`);
      assert.ok(contrast(p.player, bg) >= 3, `${name} player on ${bg} ${contrast(p.player, bg).toFixed(2)}`);
    }
    assert.ok(contrast(p.errorText, p.errorBg) >= 3, `${name} error`);
    assert.ok(contrast(p.notes, p.board) >= 3, `${name} notes`);
  }
});

test('hint button has three distinct states', () => {
  const p = PALETTES.paper;
  const kinds = (['free', 'ad', 'used'] as const).map((k) => hintButtonStyle(k, p).badge);
  assert.deepEqual(kinds, ['count', 'play', 'none']);
});
