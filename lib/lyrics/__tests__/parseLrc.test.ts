import * as fc from 'fast-check';

import { parseLrc, type LyricLine, type ParsedLyrics } from '../parseLrc';

const NUM_RUNS = 1000;

// "Don't Close Your Eyes" by Josh Woodward, LRCLIB record 10481837 (syncedLyrics,
// verbatim, including the trailing space after the end marker).
const DCYE_LRC = `[00:09.94] Cold hands, sore feet
[00:13.72] You've been walking for an hour on abandoned streets
[00:18.77] Weak knees, and fresh scars
[00:24.31] It's a struggle when you're losing track of who you are
[00:28.95] The words you stole won't save your soul
[00:34.08] They can only buy you time
[00:37.23] Light a candle, or curse the dark
[00:44.59] It's all the same to me
[00:48.85] Start a fire, or drown the spark
[00:54.36] And shake away the heat
[00:58.71] Tell the truth or live a lie
[01:02.48] Just don't close your eyes
[01:07.17] Let down, and so spent
[01:17.99] You've been holding up the world with your good intent
[01:22.51] Help out, like you should
[01:27.60] It's a burden that you never really understood
[01:32.92] But Caroline, I'm doing fine
[01:37.89] It's the others who are dying
[01:41.46] Light a candle, or curse the dark
[01:47.12] It's all the same to me
[01:50.83] Start a fire, or drown the spark
[01:56.15] And shake away the heat
[02:00.30] Tell the truth or live a lie
[02:04.11] Just don't close your eyes
[02:06.14] And you're breaking
[02:08.00] But you're faking nothing's ever wrong
[02:13.44] And concealing what you're feeling
[02:19.12] Always standing strong
[02:23.17] But you don't need
[02:25.31] To act like you don't bleed
[02:27.53] When you come falling down
[02:30.52] Cuz there is no healing when you're not feeling
[02:35.03] Anything at all
[02:41.31] Light a candle, or curse the dark
[02:46.44] It's all the same to me
[02:51.18] Start a fire, or drown the spark
[02:54.80] And shake away the heat
[02:59.28] Tell the truth or live a lie
[03:05.98] Just don't close your eyes
[03:15.85] `;

const times = (parsed: ParsedLyrics) => parsed.lines.map((line) => line.timeMs);

describe('parseLrc: timestamps', () => {
  it('accepts every fraction width and scales it to milliseconds', () => {
    expect(times(parseLrc('[01:02]a'))).toEqual([62000]);
    expect(times(parseLrc('[01:02.5]a'))).toEqual([62500]);
    expect(times(parseLrc('[01:02.05]a'))).toEqual([62050]);
    expect(times(parseLrc('[01:02.005]a'))).toEqual([62005]);
    expect(times(parseLrc('[01:02.50]a'))).toEqual([62500]);
    expect(times(parseLrc('[01:02.123]a'))).toEqual([62123]);
  });

  it('accepts minutes of any length', () => {
    expect(times(parseLrc('[1:02.00]a'))).toEqual([62000]);
    expect(times(parseLrc('[123:04.50]a'))).toEqual([123 * 60000 + 4500]);
    expect(times(parseLrc('[0000003:00]a'))).toEqual([180000]);
  });

  it('ignores malformed timestamps', () => {
    for (const line of ['[00:60.00]a', '[00:1.00]a', '[00:01.0000]a', '[ab:cd]a', '[-1:00.00]a', '[00:01,00]a']) {
      expect(parseLrc(line)).toEqual({ lines: [], endMs: null });
    }
  });

  it('expands several timestamps on one line into separate rows, sorted', () => {
    expect(parseLrc('[00:30.00][00:10.00]Chorus\n[00:20.00]Verse').lines).toEqual([
      { timeMs: 10000, text: 'Chorus' },
      { timeMs: 20000, text: 'Verse' },
      { timeMs: 30000, text: 'Chorus' },
    ]);
  });

  it('sorts stably, keeping file order for equal times', () => {
    expect(parseLrc('[00:05.00]x\n[00:05.00]y\n[00:01.00]z\n[00:05.00]w').lines).toEqual([
      { timeMs: 1000, text: 'z' },
      { timeMs: 5000, text: 'x' },
      { timeMs: 5000, text: 'y' },
      { timeMs: 5000, text: 'w' },
    ]);
  });

  it('reads LF, CRLF and CR line endings and a leading BOM', () => {
    const expected = [
      { timeMs: 1000, text: 'a' },
      { timeMs: 2000, text: 'b' },
      { timeMs: 3000, text: 'c' },
    ];
    expect(parseLrc('﻿[00:01.00]a\r\n[00:02.00]b\r[00:03.00]c\n').lines).toEqual(expected);
  });
});

describe('parseLrc: offset tag', () => {
  it('subtracts a positive offset (lyrics earlier) and clamps at 0', () => {
    expect(parseLrc('[offset:+500]\n[00:10.00]a\n[00:00.20]b').lines).toEqual([
      { timeMs: 0, text: 'b' },
      { timeMs: 9500, text: 'a' },
    ]);
  });

  it('adds a negative offset (lyrics later)', () => {
    expect(times(parseLrc('[offset:-250]\n[00:10.00]a'))).toEqual([10250]);
  });

  it('applies to the whole file, including the end marker, and the last tag wins', () => {
    const parsed = parseLrc('[00:10.00]a\n[00:20.00]\n[offset:100]\n[offset: +1000 ]');
    expect(parsed).toEqual({ lines: [{ timeMs: 9000, text: 'a' }], endMs: 19000 });
  });

  it('ignores an offset that is not an integer', () => {
    expect(times(parseLrc('[offset:abc]\n[offset:1.5]\n[00:10.00]a'))).toEqual([10000]);
  });
});

describe('parseLrc: text', () => {
  it('ignores metadata tags and untimed lines', () => {
    const lrc = [
      '[ar:Josh Woodward]',
      '[ti:Don\'t Close Your Eyes]',
      '[al:The Simple Life]',
      '[length:03:34]',
      '[by:someone]',
      'a line with no timestamp',
      '',
      '[00:01.00]sung',
    ].join('\n');
    expect(parseLrc(lrc)).toEqual({ lines: [{ timeMs: 1000, text: 'sung' }], endMs: null });
  });

  it('strips enhanced word tags and trims the text', () => {
    expect(parseLrc('[00:01.00]  <00:01.00>Hello <00:01.50>world <00:02.000>  ').lines).toEqual([
      { timeMs: 1000, text: 'Hello world' },
    ]);
  });

  it('leaves one space where a word tag sat between spaces (A2 layout)', () => {
    expect(parseLrc('[00:01.00] <00:01.00> Hello <00:01.50> world <00:02.00>').lines).toEqual([
      { timeMs: 1000, text: 'Hello world' },
    ]);
    expect(parseLrc('[00:01.00]a <00:01.20>\t<00:01.40>  b').lines).toEqual([{ timeMs: 1000, text: 'a b' }]);
  });

  it('removes a word tag inside a word without adding a space', () => {
    expect(parseLrc('[00:01.00]<00:01.00>Hel<00:01.20>lo<00:01.40><00:01.50> world').lines).toEqual([
      { timeMs: 1000, text: 'Hello world' },
    ]);
  });

  it('keeps spacing that is not next to a word tag', () => {
    expect(parseLrc('[00:01.00]a  b <00:01.50> c').lines).toEqual([{ timeMs: 1000, text: 'a  b c' }]);
  });

  it('keeps bracketed text that follows the timestamps', () => {
    expect(parseLrc('[00:01.00][Chorus] la').lines).toEqual([{ timeMs: 1000, text: '[Chorus] la' }]);
  });
});

describe('parseLrc: end marker', () => {
  it('turns the empty-text timestamp after the last row into endMs', () => {
    expect(parseLrc('[00:01.00]a\n[00:03.00]b\n[00:04.00]')).toEqual({
      lines: [
        { timeMs: 1000, text: 'a' },
        { timeMs: 3000, text: 'b' },
      ],
      endMs: 4000,
    });
  });

  it('treats text made only of word tags and spaces as empty', () => {
    expect(parseLrc('[00:01.00]a\n[00:04.00] <00:04.00> ').endMs).toBe(4000);
  });

  // design.md Decision 4 says such a marker closes the previous row's window, but
  // ParsedLyrics has no way to express a gap, so only the final marker counts.
  it('drops an empty-text timestamp between rows', () => {
    expect(parseLrc('[00:01.00]a\n[00:02.00]\n[00:03.00]b')).toEqual({
      lines: [
        { timeMs: 1000, text: 'a' },
        { timeMs: 3000, text: 'b' },
      ],
      endMs: null,
    });
  });

  it('uses the latest of several trailing markers', () => {
    expect(parseLrc('[00:03.00]b\n[00:05.00]\n[00:04.00]').endMs).toBe(5000);
  });

  it('accepts a marker at the same time as the last row', () => {
    expect(parseLrc('[00:03.00]\n[00:03.00]b').endMs).toBe(3000);
  });

  it('has no endMs when there are no rows', () => {
    expect(parseLrc('[00:03.00]\n[00:04.00]')).toEqual({ lines: [], endMs: null });
    expect(parseLrc('')).toEqual({ lines: [], endMs: null });
  });
});

describe('parseLrc: dcye fixture', () => {
  it('parses the real LRCLIB record into 39 rows and the 3:15.85 end marker', () => {
    const parsed = parseLrc(DCYE_LRC);
    expect(parsed.lines).toHaveLength(39);
    expect(parsed.lines[0]).toEqual({ timeMs: 9940, text: 'Cold hands, sore feet' });
    expect(parsed.lines[2]).toEqual({ timeMs: 18770, text: 'Weak knees, and fresh scars' });
    expect(parsed.lines[6]).toEqual({ timeMs: 37230, text: 'Light a candle, or curse the dark' });
    expect(parsed.lines[7]).toEqual({ timeMs: 44590, text: "It's all the same to me" });
    expect(parsed.lines[38]).toEqual({ timeMs: 185980, text: "Just don't close your eyes" });
    expect(parsed.endMs).toBe(195850);
  });
});

// ---- Properties ----

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Formats `ms` exactly, with at least `minDigits` fraction digits. */
function formatTime(ms: number, minDigits: number): string {
  const fraction = ms % 1000;
  const required = fraction === 0 ? 0 : fraction % 100 === 0 ? 1 : fraction % 10 === 0 ? 2 : 3;
  const digits = Math.max(required, minDigits);
  const suffix = digits === 0 ? '' : `.${String(fraction).padStart(3, '0').slice(0, digits)}`;
  return `[${pad2(Math.floor(ms / 60000))}:${pad2(Math.floor((ms % 60000) / 1000))}${suffix}]`;
}

type Format = {
  digits: number[];
  endings: string[];
  noise: string[];
  header: string[];
};

// Lines parseLrc must ignore. No offset tag here: the offset property adds its own.
const NOISE = ['', '[ar:Josh Woodward]', '[ti:Title]', '[length:03:34]', '[by:x]', 'untimed words'];

/** Writes `parsed` as LRC; `format` varies fraction widths, line endings and noise lines. */
function formatLrc(parsed: ParsedLyrics, format: Format, offsetTag = ''): string {
  const pick = <T,>(list: T[], i: number, fallback: T) => (list.length === 0 ? fallback : list[i % list.length]);
  const rows = parsed.lines.map((line, i) => `${formatTime(line.timeMs, pick(format.digits, i, 3))}${line.text}`);
  if (parsed.endMs !== null) rows.push(formatTime(parsed.endMs, pick(format.digits, rows.length, 2)));
  let out = [...format.header, offsetTag].map((line) => `${line}\n`).join('');
  rows.forEach((row, i) => {
    out += `${pick(format.noise, i, '')}${pick(format.endings, i, '\n')}${row}${pick(format.endings, i + 1, '\n')}`;
  });
  return out;
}

const TRICKY_CHARS = fc.constantFrom(...'ab Z09:.[]<>-+\té中\u{1F3B5}\'"'.split(''));

/** Text that parseLrc must return unchanged: trimmed, one line, no leading timestamp, no word tag. */
const roundTripText = fc
  .oneof(fc.string({ minLength: 1, maxLength: 30 }), fc.string({ unit: TRICKY_CHARS, minLength: 1, maxLength: 30 }))
  .filter(
    (s) =>
      s.length > 0 &&
      s === s.trim() &&
      !/[\r\n]/.test(s) &&
      !/^\[\d+:[0-5]\d(?:\.\d{1,3})?\]/.test(s) &&
      !/<\d+:[0-5]\d(?:\.\d{1,3})?>/.test(s),
  );

const rowArb = fc.record({ timeMs: fc.integer({ min: 0, max: 100_000_000 }), text: roundTripText });

const stableSortByTime = (rows: LyricLine[]) =>
  rows
    .map((row, order) => ({ row, order }))
    .sort((a, b) => a.row.timeMs - b.row.timeMs || a.order - b.order)
    .map(({ row }) => ({ timeMs: row.timeMs, text: row.text }));

const parsedArb: fc.Arbitrary<ParsedLyrics> = fc
  .record({
    rows: fc.array(rowArb, { maxLength: 30 }),
    endGap: fc.option(fc.integer({ min: 0, max: 1_000_000 })),
  })
  .map(({ rows, endGap }) => {
    const lines = stableSortByTime(rows);
    const last = lines[lines.length - 1];
    return { lines, endMs: last === undefined || endGap === null ? null : last.timeMs + endGap };
  });

const formatArb: fc.Arbitrary<Format> = fc.record({
  digits: fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 5 }),
  endings: fc.array(fc.constantFrom('\n', '\r\n', '\r'), { maxLength: 5 }),
  noise: fc.array(fc.constantFrom(...NOISE), { maxLength: 5 }),
  header: fc.array(fc.constantFrom(...NOISE), { maxLength: 3 }),
});

// Arbitrary LRC-like input, valid or not.
const digitString = (maxLength: number) =>
  fc.string({ unit: fc.constantFrom(...'0123456789'.split('')), minLength: 1, maxLength });
const tagArb = fc.oneof(
  fc
    .tuple(digitString(4), digitString(2), fc.option(digitString(4)))
    .map(([m, s, f]) => `[${m}:${s}${f === null ? '' : `.${f}`}]`),
  digitString(400).map((m) => `[${m}:00.00]`),
  fc.constantFrom('[ar:x]', '[ti:y]', '[length:03:34]', '[]', '[', ']', '[00:00.00', '[offset:]', '[offset:+-1]'),
  fc.tuple(fc.constantFrom('', '+', '-'), digitString(400)).map(([sign, n]) => `[offset:${sign}${n}]`),
  fc.string({ maxLength: 8 }).map((s) => `[${s}]`),
);
const wordTagArb = fc.tuple(digitString(3), digitString(2), digitString(3)).map(([m, s, f]) => `<${m}:${s}.${f}>`);
const lrcLikeArb = fc
  .array(
    fc.tuple(
      fc.constantFrom('', ' ', '﻿', '\t'),
      fc.array(tagArb, { maxLength: 4 }),
      fc.array(fc.oneof(fc.string({ maxLength: 10 }), wordTagArb, fc.constantFrom(' ', '<', '>', '[', ']')), {
        maxLength: 4,
      }),
      fc.constantFrom('\n', '\r\n', '\r', ''),
    ),
    { maxLength: 20 },
  )
  .map((lines) => lines.map(([lead, tags, words, ending]) => lead + tags.join('') + words.join('') + ending).join(''));

function expectWellFormed(parsed: ParsedLyrics) {
  const t = times(parsed);
  for (let i = 0; i < t.length; i++) {
    expect(Number.isFinite(t[i]) && t[i] >= 0).toBe(true);
    if (i > 0) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
  }
  for (const line of parsed.lines) {
    expect(line.text.length).toBeGreaterThan(0);
    expect(line.text).toBe(line.text.trim());
  }
  if (parsed.endMs !== null) {
    expect(parsed.lines.length).toBeGreaterThan(0);
    expect(parsed.endMs).toBeGreaterThanOrEqual(t[t.length - 1]);
  }
}

describe('parseLrc: properties', () => {
  it('never throws on any string and returns well-formed output', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.string({ unit: 'binary' }), fc.string({ unit: TRICKY_CHARS })), (s) => {
        expectWellFormed(parseLrc(s));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('never throws on LRC-like input and keeps times non-decreasing', () => {
    fc.assert(
      fc.property(lrcLikeArb, (s) => {
        expectWellFormed(parseLrc(s));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('round-trips: format then parse gives the same lines and endMs', () => {
    fc.assert(
      fc.property(parsedArb, formatArb, (parsed, format) => {
        expect(parseLrc(formatLrc(parsed, format))).toEqual(parsed);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('sorts rows written in any order stably by time', () => {
    fc.assert(
      fc.property(fc.array(rowArb, { maxLength: 30 }), formatArb, (rows, format) => {
        const lrc = rows.map((row) => `${formatTime(row.timeMs, 3)}${row.text}`).join(format.endings[0] ?? '\n');
        expect(parseLrc(lrc)).toEqual({ lines: stableSortByTime(rows), endMs: null });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('applies an offset to every row and the end marker', () => {
    fc.assert(
      fc.property(
        parsedArb,
        formatArb,
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        fc.boolean(),
        (parsed, format, offset, plusSign) => {
          const tag = `[offset:${offset >= 0 && plusSign ? '+' : ''}${offset}]`;
          const shift = (ms: number) => Math.max(0, ms - offset);
          expect(parseLrc(formatLrc(parsed, format, tag))).toEqual({
            lines: parsed.lines.map((line) => ({ timeMs: shift(line.timeMs), text: line.text })),
            endMs: parsed.endMs === null ? null : shift(parsed.endMs),
          });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
