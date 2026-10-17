import * as fc from 'fast-check';

import { extrapolate, nextDisplayed, type Anchor, type Displayed } from '../clock';

const NUM_RUNS = 2000;
const DCYE_DURATION_MS = 214000;

const anchor = (fields: Partial<Anchor>): Anchor => ({
  posMs: 0,
  playing: true,
  rate: 1,
  seq: 1,
  epoch: 1,
  stampedAt: 1000,
  ...fields,
});

const durationArb = fc.integer({ min: 0, max: 600_000 });
const nowArb = fc.double({ min: 0, max: 1e7, noNaN: true });
const anchorArb = (playing: fc.Arbitrary<boolean> = fc.boolean()): fc.Arbitrary<Anchor> =>
  fc.record({
    posMs: fc.double({ min: -10_000, max: 700_000, noNaN: true }),
    playing,
    rate: fc.double({ min: 0, max: 4, noNaN: true }),
    seq: fc.nat(),
    epoch: fc.nat(),
    stampedAt: fc.option(nowArb),
  });

describe('extrapolate', () => {
  it('advances by the time since the stamp while playing', () => {
    expect(extrapolate(anchor({ posMs: 41000, stampedAt: 1000 }), 3500, DCYE_DURATION_MS)).toBe(43500);
    expect(extrapolate(anchor({ posMs: 41000, stampedAt: 1000, rate: 1.5 }), 3000, DCYE_DURATION_MS)).toBe(44000);
  });

  it('treats an unstamped anchor and a frame before the stamp as no elapsed time', () => {
    expect(extrapolate(anchor({ posMs: 41000, stampedAt: null }), 99999, DCYE_DURATION_MS)).toBe(41000);
    expect(extrapolate(anchor({ posMs: 41000, stampedAt: 5000 }), 4000, DCYE_DURATION_MS)).toBe(41000);
  });

  it('holds still while paused', () => {
    expect(extrapolate(anchor({ posMs: 41000, playing: false }), 99999, DCYE_DURATION_MS)).toBe(41000);
  });

  it('clamps to the catalog duration, which a status duration of 0 never replaces', () => {
    // A status sample before the media is prepared reports durationMs 0; the
    // anchor has no duration field, so only the catalog duration bounds it.
    const status = { positionMs: 5000, durationMs: 0, playing: true, rate: 1 };
    const fromStatus = anchor({ posMs: status.positionMs, playing: status.playing, rate: status.rate });
    expect(extrapolate(fromStatus, 3000, DCYE_DURATION_MS)).toBe(7000);
    expect(extrapolate(anchor({ posMs: 213000 }), 1e6, DCYE_DURATION_MS)).toBe(DCYE_DURATION_MS);
    expect(extrapolate(anchor({ posMs: -50, playing: false }), 0, DCYE_DURATION_MS)).toBe(0);
  });

  it('matches the design formula clamp(pos + elapsed * rate * playing, 0, duration)', () => {
    fc.assert(
      fc.property(anchorArb(), nowArb, durationArb, (a, now, durationMs) => {
        const elapsed = a.stampedAt === null ? 0 : Math.max(0, now - a.stampedAt);
        const raw = a.posMs + elapsed * a.rate * (a.playing ? 1 : 0);
        expect(extrapolate(a, now, durationMs)).toBe(Math.min(Math.max(raw, 0), durationMs));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('never decreases as time moves on while playing', () => {
    fc.assert(
      fc.property(anchorArb(fc.constant(true)), nowArb, nowArb, durationArb, (a, t1, t2, durationMs) => {
        const [early, late] = t1 <= t2 ? [t1, t2] : [t2, t1];
        expect(extrapolate(a, late, durationMs)).toBeGreaterThanOrEqual(extrapolate(a, early, durationMs));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('is constant while paused', () => {
    fc.assert(
      fc.property(anchorArb(fc.constant(false)), nowArb, nowArb, durationArb, (a, t1, t2, durationMs) => {
        expect(extrapolate(a, t1, durationMs)).toBe(extrapolate(a, t2, durationMs));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('always stays within [0, durationMs], even for non-finite inputs', () => {
    const anyNumber = fc.double();
    const wildAnchor: fc.Arbitrary<Anchor> = fc.record({
      posMs: anyNumber,
      playing: fc.boolean(),
      rate: anyNumber,
      seq: fc.nat(),
      epoch: fc.nat(),
      stampedAt: fc.option(anyNumber),
    });
    fc.assert(
      fc.property(fc.oneof(anchorArb(), wildAnchor), fc.oneof(nowArb, anyNumber), durationArb, (a, now, durationMs) => {
        const positionMs = extrapolate(a, now, durationMs);
        expect(positionMs).toBeGreaterThanOrEqual(0);
        expect(positionMs).toBeLessThanOrEqual(durationMs);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('nextDisplayed', () => {
  it('starts from the anchor when there is no previous position', () => {
    expect(nextDisplayed(null, anchor({ posMs: 41000, epoch: 3 }), 2000, DCYE_DURATION_MS)).toEqual({
      positionMs: 42000,
      epoch: 3,
    });
  });

  it('holds still when a stale sample in the same epoch is behind', () => {
    const prev: Displayed = { positionMs: 45000, epoch: 3 };
    const stale = anchor({ posMs: 43000, epoch: 3, stampedAt: 5000 });
    expect(nextDisplayed(prev, stale, 5000, DCYE_DURATION_MS)).toEqual(prev);
  });

  it('moves back when a new epoch starts behind the displayed position', () => {
    const prev: Displayed = { positionMs: 41000, epoch: 3 };
    const seek = anchor({ posMs: 21500, playing: false, epoch: 4 });
    expect(nextDisplayed(prev, seek, 9000, DCYE_DURATION_MS)).toEqual({ positionMs: 21500, epoch: 4 });
  });

  it('moves forward with the clock within one epoch while playing', () => {
    const prev: Displayed = { positionMs: 41000, epoch: 1 };
    const playing = anchor({ posMs: 41000, epoch: 1, stampedAt: 1000 });
    expect(nextDisplayed(prev, playing, 3000, DCYE_DURATION_MS)).toEqual({ positionMs: 43000, epoch: 1 });
    expect(nextDisplayed(prev, playing, 1016, DCYE_DURATION_MS)).toEqual({ positionMs: 41016, epoch: 1 });
  });

  it('within one epoch, is the larger of the previous and the extrapolated position', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 600_000, noNaN: true }),
        anchorArb(),
        nowArb,
        durationArb,
        (prevPositionMs, a, now, durationMs) => {
          const prev: Displayed = { positionMs: prevPositionMs, epoch: a.epoch };
          expect(nextDisplayed(prev, a, now, durationMs)).toEqual({
            positionMs: Math.max(prevPositionMs, extrapolate(a, now, durationMs)),
            epoch: a.epoch,
          });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('never decreases within one epoch, whatever samples arrive', () => {
    const step = fc.record({ anchor: anchorArb(), dt: fc.double({ min: 0, max: 5000, noNaN: true }) });
    fc.assert(
      // A plain predicate (false = counterexample) keeps 2000 runs of 40 steps fast.
      fc.property(fc.nat(), fc.array(step, { minLength: 1, maxLength: 40 }), durationArb, (epoch, steps, durationMs) => {
        let prev: Displayed | null = null;
        let now = 0;
        for (const { anchor: a, dt } of steps) {
          now += dt;
          const next = nextDisplayed(prev, { ...a, epoch }, now, durationMs);
          const inBounds = next.positionMs >= 0 && next.positionMs <= durationMs;
          const forward = prev === null || next.positionMs >= prev.positionMs;
          if (next.epoch !== epoch || !inBounds || !forward) return false;
          prev = next;
        }
        return true;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('follows the anchor exactly when the epoch changes, so it can move backward', () => {
    fc.assert(
      fc.property(
        fc.record({ positionMs: fc.double({ min: 0, max: 600_000, noNaN: true }), epoch: fc.nat() }),
        anchorArb(),
        nowArb,
        durationArb,
        (prev, a, now, durationMs) => {
          fc.pre(a.epoch !== prev.epoch);
          expect(nextDisplayed(prev, a, now, durationMs)).toEqual({
            positionMs: extrapolate(a, now, durationMs),
            epoch: a.epoch,
          });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('can move backward across epochs while each epoch only moves forward', () => {
    const prev: Displayed = { positionMs: 50000, epoch: 7 };
    const back = nextDisplayed(prev, anchor({ posMs: 10000, epoch: 8, stampedAt: 0 }), 0, DCYE_DURATION_MS);
    expect(back.positionMs).toBeLessThan(prev.positionMs);
    const later = nextDisplayed(back, anchor({ posMs: 9000, epoch: 8, stampedAt: 0 }), 500, DCYE_DURATION_MS);
    expect(later).toEqual({ positionMs: 10000, epoch: 8 });
  });
});
