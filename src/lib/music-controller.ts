/**
 * Background music state (pure, tested). One controller for the whole app, so music can never
 * double-start when screens mount or remount: it owns at most one player and only calls play()
 * when the music goes from silent to audible.
 *
 * Music plays when the Music setting is on and nothing blocks it. Blocks stack: the app being in
 * the background, a rewarded ad and an interstitial each pause it, and it resumes only when all are gone.
 */
export type MusicBlock = 'background' | 'rewarded' | 'interstitial';

/** Soft: the track is mastered to -5 dBFS peaks, and this keeps it well under game sounds. */
export const MUSIC_VOLUME = 0.25;

export type MusicPlayer = {
  play: () => void;
  pause: () => void;
};

export class MusicController {
  private player: MusicPlayer | null = null;
  private enabled = false;
  private readonly blocks = new Set<MusicBlock>();
  private audible = false;

  constructor(private readonly createPlayer: () => MusicPlayer | null) {}

  get playing(): boolean {
    return this.audible;
  }

  get blockedBy(): MusicBlock[] {
    return [...this.blocks];
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.sync();
  }

  block(reason: MusicBlock): void {
    this.blocks.add(reason);
    this.sync();
  }

  unblock(reason: MusicBlock): void {
    this.blocks.delete(reason);
    this.sync();
  }

  private sync(): void {
    const want = this.enabled && this.blocks.size === 0;
    if (want === this.audible) return;
    if (want) {
      // The player is created lazily, the first time music should actually be heard.
      if (!this.player) this.player = this.safe(() => this.createPlayer()) ?? null;
      if (!this.player) return;
      this.safe(() => this.player?.play());
      this.audible = true;
    } else {
      this.safe(() => this.player?.pause());
      this.audible = false;
    }
  }

  /** Music must never break the game. */
  private safe<T>(run: () => T): T | undefined {
    try {
      return run();
    } catch {
      return undefined;
    }
  }
}
