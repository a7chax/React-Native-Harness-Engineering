import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';

import type { PlayerAdapter, PlayerStatus } from './PlayerAdapter';

/** How often expo-audio sends `playbackStatusUpdate` while playing. */
const UPDATE_INTERVAL_MS = 250;

type Listener = (status: PlayerStatus) => void;
type Entry = { listener: Listener; subscription: { remove(): void } | null };

const toPlayerStatus = (status: AudioStatus): PlayerStatus => ({
  positionMs: Math.round(status.currentTime * 1000),
  // 0 until the media is prepared; the screen clamps with the catalog duration.
  durationMs: Math.round(status.duration * 1000),
  playing: status.playing,
  rate: Number.isFinite(status.playbackRate) ? status.playbackRate : 1,
});

/**
 * `PlayerAdapter` over one expo-audio player, created on the first `load()`.
 * This is the only module that imports `expo-audio`.
 */
export class ExpoAudioPlayer implements PlayerAdapter {
  private player: AudioPlayer | null = null;
  private readonly entries = new Set<Entry>();
  private released = false;

  load(source: number): void {
    if (this.released) return;
    if (this.player) {
      this.player.replace(source);
      return;
    }
    const player = createAudioPlayer(source, { updateInterval: UPDATE_INTERVAL_MS });
    this.player = player;
    for (const entry of this.entries) entry.subscription = attach(player, entry.listener);
  }

  play(): void {
    this.player?.play();
  }

  pause(): void {
    this.player?.pause();
  }

  async seekTo(ms: number): Promise<void> {
    // The tolerances are iOS-only; zero makes the seek exact there too.
    await this.player?.seekTo(ms / 1000, 0, 0);
  }

  subscribe(listener: Listener): () => void {
    if (this.released) return () => {};
    const entry: Entry = {
      listener,
      subscription: this.player ? attach(this.player, listener) : null,
    };
    this.entries.add(entry);
    return () => {
      entry.subscription?.remove();
      entry.subscription = null;
      this.entries.delete(entry);
    };
  }

  /**
   * `remove()` only drops the player from expo-audio's registry; the
   * SharedObject `release()` is what frees the native ExoPlayer, so without it
   * audio keeps playing after unmount or a Fast Refresh.
   */
  release(): void {
    if (this.released) return;
    this.released = true;
    const player = this.player;
    this.player = null;
    player?.pause();
    for (const entry of this.entries) {
      entry.subscription?.remove();
      entry.subscription = null;
    }
    this.entries.clear();
    player?.remove();
    player?.release();
  }
}

function attach(player: AudioPlayer, listener: Listener) {
  return player.addListener('playbackStatusUpdate', (status) => listener(toPlayerStatus(status)));
}
