import { parsePlayerParams, type PlayerParams, type RawParams } from '../params';

const DURATIONS: Record<string, number> = {
  dcye: 214_000,
  'letting-go': 192_000,
  tone: 20_000,
};

const options = (isDev: boolean) => ({
  trackIds: Object.keys(DURATIONS),
  durationMsFor: (id: string) => DURATIONS[id],
  isDev,
});

const DEFAULTS: PlayerParams = { trackId: 'dcye', atMs: 0, paused: false, stallMs: null };

const cases: [string, RawParams, Partial<PlayerParams>, boolean?][] = [
  ['no parameters', {}, {}],
  [
    'valid string parameters',
    { track: 'letting-go', at: '21500', paused: '1' },
    { trackId: 'letting-go', atMs: 21_500, paused: true },
  ],
  ['an unknown track falls back to the first id', { track: 'does-not-exist' }, {}],
  ['an empty track falls back to the first id', { track: '' }, {}],

  ['at=41000', { at: '41000' }, { atMs: 41_000 }],
  ['at=41000.7 floors to whole ms', { at: '41000.7' }, { atMs: 41_000 }],
  ['at=0', { at: '0' }, { atMs: 0 }],
  ['at at the exact end is kept', { at: '214000' }, { atMs: 214_000 }],
  ['at=-5 is ignored', { at: '-5' }, {}],
  ['at=abc is ignored', { at: 'abc' }, {}],
  ['at past the duration is ignored', { at: '999999999' }, {}],
  ['at one ms past the end is ignored', { at: '214001' }, {}],
  ['an empty at is ignored', { at: '' }, {}],
  ['an exponent at is ignored', { at: '1e3' }, {}],
  ['a padded at is ignored', { at: ' 41000' }, {}],
  ['an at overflowing to Infinity is ignored', { at: '9'.repeat(400) }, {}],
  [
    'at is checked against the requested track',
    { track: 'tone', at: '41000' },
    { trackId: 'tone' },
  ],
  ['at is checked against the fallback track', { track: 'nope', at: '41000' }, { atMs: 41_000 }],

  ['paused=1', { paused: '1' }, { paused: true }],
  ['paused=0', { paused: '0' }, { paused: false }],
  ['paused=true', { paused: 'true' }, { paused: false }],
  ['an empty paused', { paused: '' }, { paused: false }],

  ['stall outside development', { stall: '3000' }, {}, false],
  ['stall in development', { stall: '3000' }, { stallMs: 3_000 }, true],
  ['stall=20000 is capped at 10000', { stall: '20000' }, { stallMs: 10_000 }, true],
  ['stall=10000', { stall: '10000' }, { stallMs: 10_000 }, true],
  ['stall=0 is ignored', { stall: '0' }, {}, true],
  ['stall=-1 is ignored', { stall: '-1' }, {}, true],
  ['stall=abc is ignored', { stall: 'abc' }, {}, true],

  [
    'array values use the first entry',
    { track: ['letting-go', 'dcye'], at: ['21500', '41000'], paused: ['1', '0'], stall: ['20000', '1'] },
    { trackId: 'letting-go', atMs: 21_500, paused: true, stallMs: 10_000 },
    true,
  ],
  ['an empty array is missing', { track: [], at: [], paused: [] }, {}],
];

describe('parsePlayerParams', () => {
  it.each(cases)('%s', (_name, raw, expected, isDev = false) => {
    expect(parsePlayerParams(raw, options(isDev))).toEqual({ ...DEFAULTS, ...expected });
  });

  it('ignores unrelated parameters', () => {
    expect(parsePlayerParams({ foo: 'bar', track: 'tone' }, options(true))).toEqual({
      ...DEFAULTS,
      trackId: 'tone',
    });
  });
});
