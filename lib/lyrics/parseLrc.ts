/** One lyric row: its text and the time (ms) at which its window starts. */
export type LyricLine = { timeMs: number; text: string };

/**
 * Rows sorted by time, plus the end marker that closes the last row's window
 * (null when the file has none).
 */
export type ParsedLyrics = { lines: LyricLine[]; endMs: number | null };

// `[mm:ss]`, `[mm:ss.x]`, `[mm:ss.xx]` or `[mm:ss.xxx]`, matched at `lastIndex`.
const TIME_TAG = /\s*\[(\d+):([0-5]\d)(?:\.(\d{1,3}))?\]/y;
const OFFSET_TAG = /^\s*\[offset:\s*([+-]?\d+)\s*\]/i;
// Enhanced-LRC word timing, e.g. `<00:12.34>`: a run of such tags with the
// whitespace around it.
const WORD_TAG = String.raw`<\d+:[0-5]\d(?:\.\d{1,3})?>`;
const WORD_TAG_RUN = new RegExp(String.raw`\s*${WORD_TAG}(?:\s*${WORD_TAG})*\s*`, 'g');

type Stamp = { timeMs: number; text: string; order: number };

/**
 * Parses LRC text. Never throws: lines it cannot read are skipped.
 *
 * - Several leading timestamps on one line expand into one row each.
 * - `[offset:±ms]` (the last one wins) applies to every timestamp in the file.
 * - Metadata tags (`[ar:]`, `[ti:]`, `[length:]`, ...) and untimed lines are ignored.
 * - Enhanced word tags (`<mm:ss.xx>`) are stripped from the text.
 * - A timestamp with empty text is not a row. The latest such timestamp at or
 *   after the last row becomes `endMs`; earlier ones (mid-song gaps) are dropped,
 *   since `ParsedLyrics` cannot express a gap.
 */
export function parseLrc(text: string): ParsedLyrics {
  const stamps: Stamp[] = [];
  let offsetMs = 0;

  for (const line of text.split(/\r\n|\r|\n/)) {
    const times: number[] = [];
    let end = 0;
    for (;;) {
      TIME_TAG.lastIndex = end;
      const tag = TIME_TAG.exec(line);
      if (tag === null) break;
      const fractionMs = tag[3] === undefined ? 0 : Number(tag[3].padEnd(3, '0'));
      times.push(Number(tag[1]) * 60000 + Number(tag[2]) * 1000 + fractionMs);
      end = TIME_TAG.lastIndex;
    }

    if (times.length === 0) {
      const offset = OFFSET_TAG.exec(line);
      if (offset !== null && Number.isFinite(Number(offset[1]))) offsetMs = Number(offset[1]);
      continue;
    }

    // A tag run between words (`a <t> b`) becomes one space; inside a word
    // (`Hel<t>lo`) it is removed.
    const lyric = line
      .slice(end)
      .replace(WORD_TAG_RUN, (run) => (/\s/.test(run) ? ' ' : ''))
      .trim();
    for (const timeMs of times) stamps.push({ timeMs, text: lyric, order: stamps.length });
  }

  // LRC convention: a positive offset makes lyrics appear earlier, so it is
  // subtracted from every timestamp. Times are clamped at 0.
  const sorted = stamps
    .map((stamp) => ({ ...stamp, timeMs: Math.max(0, stamp.timeMs - offsetMs) }))
    .filter((stamp) => Number.isFinite(stamp.timeMs))
    .sort((a, b) => a.timeMs - b.timeMs || a.order - b.order);

  const lines: LyricLine[] = [];
  let lastMarkerMs: number | null = null;
  for (const stamp of sorted) {
    if (stamp.text === '') lastMarkerMs = stamp.timeMs;
    else lines.push({ timeMs: stamp.timeMs, text: stamp.text });
  }

  const lastRow = lines[lines.length - 1];
  const endMs =
    lastRow !== undefined && lastMarkerMs !== null && lastMarkerMs >= lastRow.timeMs
      ? lastMarkerMs
      : null;
  return { lines, endMs };
}
