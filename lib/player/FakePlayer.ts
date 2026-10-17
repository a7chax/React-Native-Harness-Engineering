import type { PlayerAdapter, PlayerStatus } from './PlayerAdapter';

type Listener = (status: PlayerStatus) => void;

/**
 * In-memory `PlayerAdapter` for Jest. It has no timers: time moves only through
 * `advance()`, and subscribers hear only what `advance()` and `emit()` send, so
 * tests stay deterministic on real timers.
 *
 * A `durationMs` of 0 (the default) means "unknown", like expo-audio before the
 * media is prepared: positions are then not capped at the end.
 */
export class FakePlayer implements PlayerAdapter {
  /** Adapter method names in call order, including calls made after `release()`. */
  readonly calls: string[] = [];
  private current: PlayerStatus;
  private loaded: number | null = null;
  private readonly listeners = new Set<Listener>();
  private released = false;

  constructor(options: { durationMs?: number } = {}) {
    this.current = {
      positionMs: 0,
      durationMs: options.durationMs ?? 0,
      playing: false,
      rate: 1,
    };
  }

  /** A copy of the player's own state. */
  get status(): PlayerStatus {
    return { ...this.current };
  }

  /** The last source passed to `load()`, or null. */
  get source(): number | null {
    return this.loaded;
  }

  /** Like a real track switch: back to 0, keeping the playing state. */
  load(source: number): void {
    this.calls.push('load');
    if (this.released) return;
    this.loaded = source;
    this.current.positionMs = 0;
  }

  play(): void {
    this.calls.push('play');
    if (!this.released) this.current.playing = true;
  }

  pause(): void {
    this.calls.push('pause');
    if (!this.released) this.current.playing = false;
  }

  seekTo(ms: number): Promise<void> {
    this.calls.push('seekTo');
    if (!this.released) this.current.positionMs = this.clamp(ms);
    return Promise.resolve();
  }

  subscribe(listener: Listener): () => void {
    this.calls.push('subscribe');
    if (this.released) return () => {};
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  release(): void {
    this.calls.push('release');
    this.released = true;
    this.current.playing = false;
    this.listeners.clear();
  }

  /** Test control: moves the position by `ms * rate` while playing, then emits. */
  advance(ms: number): void {
    if (this.released) return;
    if (this.current.playing) {
      this.current.positionMs = this.clamp(this.current.positionMs + ms * this.current.rate);
    }
    this.emit();
  }

  /**
   * Test control: sends the current status merged with `sample` to every
   * subscriber. The merge is not kept, so a stale sample can be sent without
   * moving the player.
   */
  emit(sample: Partial<PlayerStatus> = {}): void {
    if (this.released) return;
    const status = { ...this.current, ...sample };
    for (const listener of [...this.listeners]) listener({ ...status });
  }

  /** Test control: sets the playback rate used by `advance()`. */
  setRate(rate: number): void {
    this.current.rate = rate;
  }

  private clamp(ms: number): number {
    const upper = this.current.durationMs > 0 ? this.current.durationMs : Infinity;
    return Math.min(Math.max(ms, 0), upper);
  }
}
