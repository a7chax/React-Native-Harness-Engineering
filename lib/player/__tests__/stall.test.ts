import type { PlayerStatus } from '../PlayerAdapter';
import { busyWait, shouldStartStall, STALL_LEAD_MS } from '../stall';

const AT_MS = 43_000;

const status = (positionMs: number, playing = true): PlayerStatus => ({
  positionMs,
  durationMs: 214_173,
  playing,
  rate: 1,
});

const ready = {
  atMs: AT_MS,
  stallMs: 6_000,
  seekResolved: true,
  alreadyStalled: false,
};

describe('shouldStartStall', () => {
  it('fires on a playing status at or past at - 250 ms once the seek resolved', () => {
    expect(shouldStartStall({ ...ready, status: status(AT_MS - STALL_LEAD_MS) })).toBe(true);
    expect(shouldStartStall({ ...ready, status: status(AT_MS) })).toBe(true);
    expect(shouldStartStall({ ...ready, status: status(AT_MS + 1_500) })).toBe(true);
  });

  it('never fires when stallMs is null, as in a non-development build', () => {
    for (const positionMs of [0, AT_MS - STALL_LEAD_MS, AT_MS, AT_MS + 10_000]) {
      expect(shouldStartStall({ ...ready, stallMs: null, status: status(positionMs) })).toBe(false);
    }
  });

  it('does not fire on a status earlier than at - 250 ms', () => {
    expect(shouldStartStall({ ...ready, status: status(AT_MS - STALL_LEAD_MS - 1) })).toBe(false);
    expect(shouldStartStall({ ...ready, status: status(0) })).toBe(false);
  });

  it('does not fire on a status that arrives before the seek resolves', () => {
    expect(shouldStartStall({ ...ready, seekResolved: false, status: status(AT_MS) })).toBe(false);
  });

  it('does not fire on a paused status', () => {
    expect(shouldStartStall({ ...ready, status: status(AT_MS, false) })).toBe(false);
  });

  it('fires only once per apply', () => {
    expect(shouldStartStall({ ...ready, alreadyStalled: true, status: status(AT_MS) })).toBe(false);
  });

  it('ignores a zero stall', () => {
    expect(shouldStartStall({ ...ready, stallMs: 0, status: status(AT_MS) })).toBe(false);
  });
});

describe('busyWait', () => {
  it('blocks the thread for at least the requested time', () => {
    const start = performance.now();
    busyWait(30);
    expect(performance.now() - start).toBeGreaterThanOrEqual(30);
  });

  it('returns at once for zero or a negative time', () => {
    const start = performance.now();
    busyWait(0);
    busyWait(-5);
    expect(performance.now() - start).toBeLessThan(20);
  });
});
