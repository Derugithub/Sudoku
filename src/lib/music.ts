/**
 * Soft background piano (assets/music/calm-piano.m4a, synthesised by scripts/generate-music.mjs).
 * Loops seamlessly at a low volume, fades in, and pauses while the app is in the background or an
 * ad is on screen. One app-wide controller, so it never double-starts across screens.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AppState } from 'react-native';

import { MUSIC_VOLUME, MusicController, type MusicBlock, type MusicPlayer } from '@/lib/music-controller';

const TRACK = require('../../assets/music/calm-piano.m4a');
const FADE_MS = 1500;
const FADE_STEP_MS = 50;

function createPlayer(): MusicPlayer {
  setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
    allowsRecording: false,
  }).catch(() => undefined);
  const player: AudioPlayer = createAudioPlayer(TRACK);
  player.loop = true;
  player.volume = 0;
  let fade: ReturnType<typeof setInterval> | null = null;
  const stopFade = () => {
    if (fade) clearInterval(fade);
    fade = null;
  };
  return {
    play: () => {
      stopFade();
      player.volume = 0;
      player.play();
      const steps = FADE_MS / FADE_STEP_MS;
      let step = 0;
      fade = setInterval(() => {
        step++;
        // Ease in so the start is gentle.
        const x = Math.min(1, step / steps);
        player.volume = MUSIC_VOLUME * x * x;
        if (x >= 1) stopFade();
      }, FADE_STEP_MS);
    },
    pause: () => {
      stopFade();
      player.pause();
    },
  };
}

const controller = new MusicController(createPlayer);
let watching = false;

function watchAppState() {
  if (watching) return;
  watching = true;
  if (AppState.currentState && AppState.currentState !== 'active') controller.block('background');
  AppState.addEventListener('change', (status) => {
    if (status === 'active') controller.unblock('background');
    else controller.block('background');
  });
}

/** Follows the Music setting. Safe to call from any number of screens and re-renders. */
export function setMusicEnabled(enabled: boolean): void {
  watchAppState();
  controller.setEnabled(enabled);
}

/** Pause for a reason (an ad on screen); resumes when every reason is gone. */
export function blockMusic(reason: MusicBlock): void {
  controller.block(reason);
}

export function unblockMusic(reason: MusicBlock): void {
  controller.unblock(reason);
}
