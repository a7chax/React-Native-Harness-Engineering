import * as fc from 'fast-check';

import { activeLineIndex } from '../activeLine';

const NUM_RUNS = 2000;

// Row times and end marker of the dcye LRC (LRCLIB record 10481837).
const DCYE_TIMES = [
  9940, 13720, 18770, 24310, 28950, 34080, 37230, 44590, 48850, 54360, 58710, 62480, 67170, 77990,
  82510, 87600, 92920, 97890, 101460, 107120, 110830, 116150, 120300, 124110, 126140, 128000,
  133440, 139120, 143170, 145310, 147530, 150520, 155030, 161310, 166440, 171180, 174800, 179280,
  185980,
];
const DCYE_END_MS = 195850;

/** Linear-scan oracle: the last row starting at or before the position. */
function oracle(times: readonly number[], positionMs: number, endMs: number | null): number {
  if (endMs !== null && positionMs >= endMs) return -1;
  let index = -1;
  for (let i = 0; i < times.length; i++) if (times[i] <= positionMs) index = i;
  return index;
}

const sortedTimes = fc
  .array(fc.integer({ min: 0, max: 300_000 }), { maxLength: 60 })
  .map((times) => [...times].sort((a, b) => a - b));
// Mostly near the rows, sometimes before them, sometimes on an exact row time.
const position = (times: number[]) =>
  fc.oneof(
    fc.double({ min: -1000, max: 320_000, noNaN: true }),
    fc.integer({ min: -1000, max: 320_000 }),
    times.length === 0 ? fc.constant(0) : fc.constantFrom(...times),
  );
const endMsArb = fc.option(fc.integer({ min: 0, max: 320_000 }));

describe('activeLineIndex', () => {
  it('matches the dcye scenarios', () => {
    expect(activeLineIndex(DCYE_TIMES, 5000, DCYE_END_MS)).toBe(-1);
    expect(activeLineIndex(DCYE_TIMES, 11000, DCYE_END_MS)).toBe(0);
    expect(activeLineIndex(DCYE_TIMES, 21500, DCYE_END_MS)).toBe(2);
    expect(activeLineIndex(DCYE_TIMES, 41000, DCYE_END_MS)).toBe(6);
    expect(activeLineIndex(DCYE_TIMES, 190000, DCYE_END_MS)).toBe(38);
    expect(activeLineIndex(DCYE_TIMES, 200000, DCYE_END_MS)).toBe(-1);
  });

  it('visits lines 5, 6 and 7 in order between 0:36 and 0:48', () => {
    const visited: number[] = [];
    for (let ms = 36000; ms <= 48000; ms += 50) {
      const index = activeLineIndex(DCYE_TIMES, ms, DCYE_END_MS);
      if (visited[visited.length - 1] !== index) visited.push(index);
    }
    expect(visited).toEqual([5, 6, 7]);
  });

  it('is -1 for empty times, before the first row, at or after endMs, and for NaN', () => {
    expect(activeLineIndex([], 1000, null)).toBe(-1);
    expect(activeLineIndex([1000, 2000], 999.9, null)).toBe(-1);
    expect(activeLineIndex([1000, 2000], 1000, null)).toBe(0);
    expect(activeLineIndex([1000, 2000], 2999, 3000)).toBe(1);
    expect(activeLineIndex([1000, 2000], 3000, 3000)).toBe(-1);
    expect(activeLineIndex([1000, 2000], Number.NaN, null)).toBe(-1);
    expect(activeLineIndex([1000, 2000], Number.POSITIVE_INFINITY, null)).toBe(1);
  });

  it('picks the last of several rows with the same time', () => {
    expect(activeLineIndex([1000, 2000, 2000, 2000, 3000], 2500, null)).toBe(3);
  });

  it('agrees with a linear-scan oracle', () => {
    fc.assert(
      fc.property(
        sortedTimes.chain((times) => fc.tuple(fc.constant(times), position(times), endMsArb)),
        ([times, positionMs, endMs]) => {
          expect(activeLineIndex(times, positionMs, endMs)).toBe(oracle(times, positionMs, endMs));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('returns a row whose window contains the position, or -1', () => {
    fc.assert(
      fc.property(
        sortedTimes.chain((times) => fc.tuple(fc.constant(times), position(times), endMsArb)),
        ([times, positionMs, endMs]) => {
          const index = activeLineIndex(times, positionMs, endMs);
          if (index === -1) {
            expect(times.length === 0 || positionMs < times[0] || (endMs !== null && positionMs >= endMs)).toBe(true);
          } else {
            expect(times[index]).toBeLessThanOrEqual(positionMs);
            if (index < times.length - 1) expect(times[index + 1]).toBeGreaterThan(positionMs);
            if (endMs !== null) expect(positionMs).toBeLessThan(endMs);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // For fixed times and endMs, and positions p1 <= p2 that are both before endMs
  // (or with no endMs), the index never goes down. The one allowed drop is to -1
  // at or after endMs, which the next property covers.
  it('never decreases as the position grows before endMs', () => {
    fc.assert(
      fc.property(
        sortedTimes.chain((times) => fc.tuple(fc.constant(times), position(times), position(times), endMsArb)),
        ([times, a, b, endMs]) => {
          const [p1, p2] = a <= b ? [a, b] : [b, a];
          fc.pre(endMs === null || p2 < endMs);
          expect(activeLineIndex(times, p1, endMs)).toBeLessThanOrEqual(activeLineIndex(times, p2, endMs));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('is -1 before the first row and at or after endMs', () => {
    fc.assert(
      fc.property(
        sortedTimes,
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.integer({ min: 0, max: 320_000 }),
        (times, delta, endMs) => {
          if (times.length > 0) expect(activeLineIndex(times, times[0] - delta - 1e-3, null)).toBe(-1);
          expect(activeLineIndex(times, endMs + delta, endMs)).toBe(-1);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
