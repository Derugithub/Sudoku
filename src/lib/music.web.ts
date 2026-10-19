/** Web preview has no background music (browsers block autoplay, and the app ships on Android). */
import type { MusicBlock } from '@/lib/music-controller';

export function setMusicEnabled(enabled: boolean): void {
  void enabled;
}

export function blockMusic(reason: MusicBlock): void {
  void reason;
}

export function unblockMusic(reason: MusicBlock): void {
  void reason;
}
