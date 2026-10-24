import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../src/i18n/en.ts';
import { format, LANGUAGES, t } from '../src/i18n/index.ts';
import { TECHNIQUE_TIER } from '../src/sudoku/techniques.ts';
import { LEVELS } from '../src/sudoku/grader.ts';

test('format fills params and leaves unknown ones', () => {
  assert.equal(format('Row {n} of {m}', { n: 4 }), 'Row 4 of {m}');
  assert.equal(t('explain.hiddenSingle', { unit: 'row 4', d: 7 }), 'Only one cell in row 4 can hold a 7.');
});

test('every technique and level has a name, English only in v1', () => {
  const keys = Object.keys(en);
  for (const tech of Object.keys(TECHNIQUE_TIER)) assert.ok(keys.includes(`technique.${tech}`), tech);
  for (const level of LEVELS) assert.ok(keys.includes(`level.${level}`) && keys.includes(`levelInfo.${level}`));
  assert.deepEqual(LANGUAGES.map((l) => l.code), ['en']);
  assert.equal(t('app.name'), 'Sudoku');
});

test('the Statistics tabs and empty states have strings', () => {
  for (const key of ['stats.overall', 'stats.tabs', 'stats.byLevel', 'stats.emptyAll', 'stats.emptyLevel'] as const) assert.ok(en[key].length > 0, key);
  assert.equal(t('stats.emptyLevel', { level: 'Hard' }), 'No Hard games yet. Play one to see your statistics.');
});
