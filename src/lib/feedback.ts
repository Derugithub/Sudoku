/**
 * Sound and vibration for game events. Sounds are tiny WAVs synthesised by
 * scripts/generate-sounds.mjs (license-safe). Each has a matching haptic. Separate toggles.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type FeedbackEvent = 'place' | 'note' | 'mistake' | 'unit' | 'win';

const SOURCES: Record<FeedbackEvent, number> = {
  place: require('../../assets/sounds/tap.wav'),
  note: require('../../assets/sounds/note.wav'),
  mistake: require('../../assets/sounds/mistake.wav'),
  unit: require('../../assets/sounds/unit.wav'),
  win: require('../../assets/sounds/win.wav'),
};

const VOLUME: Record<FeedbackEvent, number> = { place: 0.7, note: 0.5, mistake: 0.75, unit: 0.7, win: 0.8 };

let players: Partial<Record<FeedbackEvent, AudioPlayer>> | null = null;

function ensurePlayers() {
  if (players) return players;
  players = {};
  setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
    allowsRecording: false,
  }).catch(() => undefined);
  for (const name of Object.keys(SOURCES) as FeedbackEvent[]) {
    try {
      const p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUME[name];
      players[name] = p;
    } catch {
      // That sound stays silent.
    }
  }
  return players;
}

/** Create the players ahead of the first tap so it does not stutter. */
export function preloadFeedback(): void {
  if (Platform.OS !== 'web') ensurePlayers();
}

function haptic(event: FeedbackEvent) {
  const run = () => {
    switch (event) {
      case 'place':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'note':
        return Haptics.selectionAsync();
      case 'mistake':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      case 'unit':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'win':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  run().catch(() => undefined);
}

export function feedback(event: FeedbackEvent, options: { sound: boolean; vibration: boolean }): void {
  if (Platform.OS === 'web') return;
  if (options.vibration) haptic(event);
  if (!options.sound) return;
  const player = ensurePlayers()[event];
  if (!player) return;
  try {
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Never let a sound break play.
  }
}

/** A light tap for toggles (e.g. the Music icon). Follows the Vibration setting. */
export function lightTap(vibration: boolean): void {
  if (Platform.OS === 'web' || !vibration) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
