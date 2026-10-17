import type { PlayerStatus } from './PlayerAdapter';

/** The stall may start this many ms before the requested position. */
export const STALL_LEAD_MS = 250;

/**
 * Whether this status sample should start the development-only `stall`: a
 * `playing` sample at or past `atMs - 250` ms, after the apply's seek has
 * resolved, once per apply. Never true when `stallMs` is null (other builds).
 */
export function shouldStartStall({
  status,
  atMs,
  stallMs,
  seekResolved,
  alreadyStalled,
}: {
  status: PlayerStatus;
  atMs: number;
  stallMs: number | null;
  seekResolved: boolean;
  alreadyStalled: boolean;
}): boolean {
  return (
    stallMs !== null &&
    stallMs > 0 &&
    seekResolved &&
    !alreadyStalled &&
    status.playing &&
    status.positionMs >= atMs - STALL_LEAD_MS
  );
}

/** Blocks the calling (JS) thread for `ms` milliseconds. */
export function busyWait(ms: number): void {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    // Spin: the point is to keep the JS thread busy.
  }
}
