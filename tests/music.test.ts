import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC_VOLUME, MusicController, type MusicPlayer } from '../src/lib/music-controller.ts';

function fake() {
  const log: string[] = [];
  let created = 0;
  const controller = new MusicController((): MusicPlayer => {
    created++;
    return { play: () => log.push('play'), pause: () => log.push('pause') };
  });
  return { controller, log, created: () => created };
}

test('one player, never double-started across screens', () => {
  const { controller, log, created } = fake();
  assert.equal(created(), 0); // nothing until music should be heard
  for (let i = 0; i < 5; i++) controller.setEnabled(true); // every screen syncing the setting
  assert.equal(created(), 1);
  assert.deepEqual(log, ['play']);
  assert.equal(controller.playing, true);
});

test('pauses in the background and during ads, resumes when all are gone', () => {
  const { controller, log } = fake();
  controller.setEnabled(true);
  controller.block('rewarded');
  controller.block('background'); // ad still open when the app is backgrounded
  controller.unblock('background');
  assert.equal(controller.playing, false); // the ad is still on screen
  controller.unblock('interstitial'); // an unrelated interstitial load error must not resume it
  assert.equal(controller.playing, false);
  controller.unblock('rewarded');
  assert.equal(controller.playing, true);
  controller.block('interstitial');
  assert.equal(controller.playing, false);
  controller.unblock('interstitial');
  assert.deepEqual(log, ['play', 'pause', 'play', 'pause', 'play']);
});

test('turning Music off pauses it, and nothing resumes it while off', () => {
  const { controller, log } = fake();
  controller.setEnabled(true);
  controller.setEnabled(false);
  controller.block('rewarded');
  controller.unblock('rewarded');
  controller.block('background');
  controller.unblock('background');
  assert.equal(controller.playing, false);
  assert.deepEqual(log, ['play', 'pause']);
  controller.setEnabled(true);
  assert.deepEqual(log, ['play', 'pause', 'play']);
});

test('does not start while blocked, and a failing player never throws', () => {
  const { controller, log, created } = fake();
  controller.block('background'); // launched behind the lock screen
  controller.setEnabled(true);
  assert.equal(created(), 0);
  assert.deepEqual(log, []);
  const broken = new MusicController(() => {
    throw new Error('no audio');
  });
  assert.doesNotThrow(() => broken.setEnabled(true));
  assert.equal(broken.playing, false);
});

test('music volume is soft', () => {
  assert.ok(MUSIC_VOLUME > 0 && MUSIC_VOLUME <= 0.35);
});
