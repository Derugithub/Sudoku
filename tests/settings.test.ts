import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, parseSettings } from '../src/lib/settings-model.ts';

test('settings load with defaults and survive junk', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('{oops'), DEFAULT_SETTINGS);
  const s = parseSettings(JSON.stringify({ theme: 'midnight', inputMode: 'number', sound: false, theme2: 'x' }));
  assert.equal(s.theme, 'midnight');
  assert.equal(s.inputMode, 'number');
  assert.equal(s.sound, false);
  assert.equal(parseSettings(JSON.stringify({ theme: 'sage' })).theme, 'system'); // post-launch theme
});
