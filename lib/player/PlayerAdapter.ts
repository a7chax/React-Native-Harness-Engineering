/** One playback status sample, in milliseconds. */
export type PlayerStatus = {
  positionMs: number;
  /** As the player reports it: 0 until the media is prepared. */
  durationMs: number;
  playing: boolean;
  rate: number;
};

/**
 * The playback surface the Now Playing screen depends on. `ExpoAudioPlayer`
 * backs it on device and `FakePlayer` in Jest, so the audio library can be
 * swapped without touching the UI.
 */
export interface PlayerAdapter {
  /** Loads a bundled asset (a `require()` id), replacing the current one. */
  load(source: number): void;
  play(): void;
  pause(): void;
  /** Resolves once the player has moved to `ms`. */
  seekTo(ms: number): Promise<void>;
  /** Registers a status listener and returns its unsubscribe function. */
  subscribe(listener: (status: PlayerStatus) => void): () => void;
  /** Stops playback and frees the player; every later call does nothing. */
  release(): void;
}
