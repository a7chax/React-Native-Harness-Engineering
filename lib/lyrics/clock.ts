/**
 * The last known playback state. `seq` counts status samples; `epoch` counts
 * user actions (seek, play, pause, track change). `stampedAt` is the frame
 * time at which the UI thread first saw this anchor, or null before that.
 */
export type Anchor = {
  posMs: number;
  playing: boolean;
  rate: number;
  seq: number;
  epoch: number;
  stampedAt: number | null;
};

/** The position the lyrics follow, and the action epoch it belongs to. */
export type Displayed = { positionMs: number; epoch: number };

/**
 * Position at time `now`: the anchor advanced by the time since it was stamped
 * (never negative) while playing, clamped to `[0, durationMs]`. Pass the
 * catalog duration, not the status one, which is 0 until the media is prepared.
 */
export function extrapolate(anchor: Anchor, now: number, durationMs: number): number {
  'worklet';
  const elapsed = anchor.stampedAt === null ? 0 : Math.max(0, now - anchor.stampedAt);
  const positionMs = anchor.playing ? anchor.posMs + elapsed * anchor.rate : anchor.posMs;
  // `!(x > 0)` also maps NaN to 0.
  if (!(positionMs > 0)) return 0;
  return positionMs < durationMs ? positionMs : durationMs;
}

/**
 * Next displayed position. Within one epoch it never moves backward, so stale
 * samples hold it still; a new epoch (a user action) starts again from the anchor.
 */
export function nextDisplayed(
  prev: Displayed | null,
  anchor: Anchor,
  now: number,
  durationMs: number,
): Displayed {
  'worklet';
  const positionMs = extrapolate(anchor, now, durationMs);
  if (prev === null || prev.epoch !== anchor.epoch) {
    return { positionMs, epoch: anchor.epoch };
  }
  return { positionMs: Math.max(prev.positionMs, positionMs), epoch: anchor.epoch };
}
