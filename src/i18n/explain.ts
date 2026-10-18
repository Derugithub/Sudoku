/** Turns a hint into plain words: the technique name and one or two sentences. */
import type { Level } from '../sudoku/grader';
import { cellLabel, unitIndex, unitKind } from '../sudoku/grid';
import type { Hint } from '../sudoku/hints';
import type { Step } from '../sudoku/techniques';
import type { StringKey, Translate } from './index';

function unitName(t: Translate, unit: number, cap = false): string {
  const kind = unitKind(unit);
  return t(`${cap ? 'unitCap' : 'unit'}.${kind}` as StringKey, { n: unitIndex(unit) + 1 });
}

export function joinList(t: Translate, items: (string | number)[]): string {
  const s = items.map(String);
  if (s.length <= 1) return s[0] ?? '';
  if (s.length === 2) return t('list.two', { a: s[0], b: s[1] });
  return t('list.many', { rest: s.slice(0, -1).join(t('list.sep')), last: s[s.length - 1] });
}

function linesName(t: Translate, units: number[]): string {
  const rows = units.every((u) => u < 9);
  const nums = units.map((u) => unitIndex(u) + 1).sort((a, b) => a - b);
  return t(rows ? 'lines.rows' : 'lines.cols', { list: joinList(t, nums) });
}

export function explainStep(t: Translate, step: Step): string {
  const d = step.digits[0];
  const digits = joinList(t, step.digits);
  switch (step.technique) {
    case 'fullHouse':
      return t('explain.fullHouse', { Unit: unitName(t, step.units[0], true), d });
    case 'hiddenSingle':
      return t('explain.hiddenSingle', { unit: unitName(t, step.units[0]), d });
    case 'nakedSingle': {
      const { row, col } = cellLabel(step.placement!.cell);
      return t('explain.nakedSingle', { row, col, d });
    }
    case 'pointing':
      return t('explain.pointing', { box: unitName(t, step.units[0]), line: unitName(t, step.units[1]), d });
    case 'claiming':
      return t('explain.claiming', { line: unitName(t, step.units[0]), box: unitName(t, step.units[1]), d });
    case 'nakedPair':
    case 'nakedTriple':
    case 'nakedQuad':
    case 'hiddenPair':
    case 'hiddenTriple':
    case 'hiddenQuad':
      return t(`explain.${step.technique}` as StringKey, { unit: unitName(t, step.units[0]), digits });
    case 'xWing':
    case 'swordfish':
    case 'jellyfish': {
      const size = step.technique === 'xWing' ? 2 : step.technique === 'swordfish' ? 3 : 4;
      return t('explain.fish', {
        lines: linesName(t, step.units.slice(0, size)),
        covers: linesName(t, step.units.slice(size)),
        d,
      });
    }
    case 'xyWing':
      return t('explain.xyWing', { z: step.digits[step.digits.length - 1] });
    case 'xyzWing': {
      const z = step.eliminations[0]?.digit ?? d;
      return t('explain.xyzWing', { z });
    }
  }
}

function placementTail(t: Translate, step: Step): string {
  const { row, col } = cellLabel(step.placement!.cell);
  const d = step.placement!.digit;
  if (step.technique === 'hiddenSingle' || step.technique === 'fullHouse') {
    return t('explain.thenUnit', { d, unit: unitName(t, step.units[0]), row, col });
  }
  return t('explain.thenCell', { d, row, col });
}

export type HintText = { title: string; body: string };

export function explainHint(t: Translate, hint: Hint): HintText {
  const { row, col } = cellLabel(hint.cell);
  if (hint.kind === 'fix') return { title: t('technique.fix'), body: t('explain.fix', { row, col, d: hint.digit }) };
  if (hint.kind === 'reveal') return { title: t('technique.reveal'), body: t('explain.reveal', { row, col, d: hint.digit }) };
  const title = t(`technique.${hint.pattern.technique}` as StringKey);
  if (hint.pattern === hint.placement) return { title, body: explainStep(t, hint.pattern) };
  return {
    title,
    body: `${explainStep(t, hint.pattern)} ${t('explain.then', { placement: placementTail(t, hint.placement) })}`,
  };
}

export function levelName(t: Translate, level: Level): string {
  return t(`level.${level}` as StringKey);
}
