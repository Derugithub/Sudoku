import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, migrateSettings, parseSettings } from '../src/lib/settings-model.ts';

test('settings load with defaults and survive junk', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('{oops'), DEFAULT_SETTINGS);
  const s = parseSettings(JSON.stringify({ theme: 'midnight', inputMode: 'number', sound: false, theme2: 'x' }));
  assert.equal(s.theme, 'midnight');
  assert.equal(s.inputMode, 'number');
  assert.equal(s.sound, false);
  assert.equal(parseSettings(JSON.stringify({ theme: 'sage' })).theme, 'system'); // post-launch theme
});

test('the old three-mistake toggle is migrated away', () => {
  // A save from the first version, with the limit switched off.
  const old = JSON.stringify({ theme: 'paper', mistakeCheck: true, mistakeLimit: false, sound: false });
  const { settings, changed } = migrateSettings(old);
  assert.equal(changed, true); // rewrite storage once
  assert.ok(!('mistakeLimit' in settings));
  assert.equal(settings.theme, 'paper');
  assert.equal(settings.sound, false);
  assert.equal(settings.mistakeCheck, true);
  // The rewritten copy is clean and stable: no second migration.
  const again = migrateSettings(JSON.stringify(settings));
  assert.equal(again.changed, false);
  assert.deepEqual(again.settings, settings);
  assert.ok(!('mistakeLimit' in DEFAULT_SETTINGS));
});

test('music is on by default, persisted, and independent of sound', () => {
  assert.equal(DEFAULT_SETTINGS.music, true);
  assert.equal(parseSettings(null).music, true);
  // Saves from before music existed get it switched on and are rewritten.
  const before = migrateSettings(JSON.stringify({ theme: 'midnight', sound: true }));
  assert.equal(before.settings.music, true);
  assert.equal(before.changed, true);
  const off = parseSettings(JSON.stringify({ ...DEFAULT_SETTINGS, music: false }));
  assert.equal(off.music, false);
  assert.equal(off.sound, true);
  const soundOff = parseSettings(JSON.stringify({ ...DEFAULT_SETTINGS, sound: false }));
  assert.equal(soundOff.music, true);
  assert.equal(parseSettings(JSON.stringify({ ...DEFAULT_SETTINGS, music: 'yes' })).music, true); // junk falls back
});
