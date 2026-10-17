import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { activeLineIndex } from '../../lyrics/activeLine';
import { CATALOG, creditLine, getTrack, lyricsFor, timesFor, type Track } from '../catalog';

const CC_BY = CATALOG.filter((track) => track.license === 'CC BY 4.0');
const WITH_LYRICS = CATALOG.filter((track) => track.lrc !== null);

/** Presentation length (ms) from the file's `mvhd` box; faststart puts it near the start. */
function mvhdDurationMs(id: string): number {
  const file = readFileSync(join(__dirname, '../../../assets/music', `${id}.m4a`));
  const box = file.indexOf('mvhd') + 4;
  const v1 = file[box] === 1;
  const timescale = file.readUInt32BE(box + (v1 ? 20 : 12));
  const duration = v1 ? Number(file.readBigUInt64BE(box + 24)) : file.readUInt32BE(box + 16);
  return (duration / timescale) * 1000;
}

function track(id: string): Track {
  const found = getTrack(id);
  if (found === undefined) throw new Error(`No catalog track ${id}`);
  return found;
}

/**
 * Fields every entry needs. `lrcCheckedByEar` may be either value, since it
 * flips to true once someone confirms the timing by ear; only a track without
 * lyrics is pinned to false.
 */
function expectEntryFields(t: Track): void {
  for (const field of [t.title, t.artist, t.license, t.attribution, t.sourceUrl]) {
    expect(field.trim()).not.toBe('');
  }
  expect(typeof t.audio).toBe('number');
  expect(typeof t.lrcCheckedByEar).toBe('boolean');
  if (t.lrc === null) expect(t.lrcCheckedByEar).toBe(false);
}

describe('CATALOG integrity', () => {
  it('lists dcye first, then letting-go and tone, with unique ids', () => {
    const ids = CATALOG.map((t) => t.id);
    expect(ids).toEqual(['dcye', 'letting-go', 'tone']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CATALOG.map((t) => [t.id, t] as const))('%s has its display and licence fields', (_id, t) => {
    expectEntryFields(t);
  });

  it.each(WITH_LYRICS.map((t) => [t.id, t] as const))(
    '%s still passes once its lyric timing is confirmed by ear',
    (_id, t) => {
      expect(() => expectEntryFields({ ...t, lrcCheckedByEar: true })).not.toThrow();
    },
  );

  it('rejects a track without lyrics marked as checked by ear', () => {
    expect(() => expectEntryFields({ ...track('tone'), lrcCheckedByEar: true })).toThrow();
  });

  it.each(CATALOG.map((t) => [t.id, t] as const))(
    '%s durationMs matches the bundled m4a to the millisecond',
    (id, t) => {
      expect(Number.isInteger(t.durationMs)).toBe(true);
      expect(Math.abs(t.durationMs - mvhdDurationMs(id))).toBeLessThanOrEqual(1);
    },
  );

  it('records the CC BY 4.0 terms for both songs', () => {
    expect(CC_BY.map((t) => t.id)).toEqual(['dcye', 'letting-go']);
    for (const t of CC_BY) {
      expect(t.licenseUrl).toBe('https://creativecommons.org/licenses/by/4.0/');
      expect(t.changes).toBe('transcoded to AAC');
      expect(t.sourceUrl).toMatch(/^https:\/\/www\.joshwoodward\.com\/mp3\/.+\.mp3$/);
      expect(t.attribution).toContain(t.title);
      expect(t.attribution).toContain(t.artist);
      expect(t.attribution).toContain('CC BY 4.0');
      // The links the licence asks for: the licence itself and the song page.
      expect(t.attribution).toContain(t.licenseUrl);
      expect(t.attribution).toMatch(/\(https:\/\/www\.joshwoodward\.com\/song\/\w+\)/);
      expect(t.lyricsSource).toMatch(/^lrclib:\d+/);
      // The credits panel links `pageUrl`, so it must be the page the attribution names.
      expect(t.pageUrl).toMatch(/^https:\/\/www\.joshwoodward\.com\/song\/\w+$/);
      expect(t.attribution).toContain(`(${t.pageUrl})`);
    }
  });

  it('links each song to its page on joshwoodward.com', () => {
    expect(track('dcye').pageUrl).toBe('https://www.joshwoodward.com/song/DontCloseYourEyes');
    expect(track('letting-go').pageUrl).toBe('https://www.joshwoodward.com/song/ImLettingGo');
  });

  it.each(WITH_LYRICS.map((t) => [t.id, t] as const))(
    '%s lyrics parse to ordered lines inside the track, closed by an end marker',
    (_id, t) => {
      const lyrics = lyricsFor(t);
      if (lyrics === null) throw new Error('expected lyrics');
      const times = lyrics.lines.map((line) => line.timeMs);

      expect(lyrics.lines.length).toBeGreaterThan(1);
      times.slice(1).forEach((time, i) => expect(time).toBeGreaterThan(times[i]));
      expect(times[0]).toBeGreaterThanOrEqual(0);
      expect(lyrics.lines.every((line) => line.text !== '')).toBe(true);
      expect(lyrics.endMs).not.toBeNull();
      expect(lyrics.endMs).toBeGreaterThan(times[times.length - 1]);
      expect(lyrics.endMs).toBeLessThanOrEqual(t.durationMs);
    },
  );

  // parseLrc ignores a blank timestamp mid-song (it has no way to express a
  // gap), so bundled lyrics may only use one as the final end marker.
  it.each(WITH_LYRICS.map((t) => [t.id, t] as const))(
    '%s has no blank timestamp before its last lyric line',
    (_id, t) => {
      const timed = (t.lrc ?? '')
        .split('\n')
        .map((line) => /^\s*(?:\[\d+:\d{2}(?:\.\d{1,3})?\])+(.*)$/.exec(line))
        .filter((match) => match !== null)
        .map((match) => match[1].trim());
      const lastText = timed.findLastIndex((text) => text !== '');

      expect(timed.slice(0, lastText).every((text) => text !== '')).toBe(true);
    },
  );

  it('has no lyrics, source, page or changes for the generated tone', () => {
    const tone = track('tone');
    expect(tone).toMatchObject({
      title: 'Test Tone (440 Hz)',
      artist: 'Generated',
      license: 'None (generated)',
      licenseUrl: '',
      lrc: null,
      changes: null,
      lyricsSource: null,
      sourceUrl: 'scripts/build-music-assets.mjs',
      pageUrl: null,
    });
    expect(lyricsFor(tone)).toBeNull();
  });
});

describe('getTrack', () => {
  it('finds a track by id', () => {
    expect(getTrack('dcye')).toMatchObject({
      title: "Don't Close Your Eyes",
      artist: 'Josh Woodward',
    });
    expect(getTrack('letting-go')?.title).toBe("I'm Letting Go");
  });

  it('returns undefined for an unknown, empty or missing id', () => {
    expect(getTrack('does-not-exist')).toBeUndefined();
    expect(getTrack('')).toBeUndefined();
    expect(getTrack(null)).toBeUndefined();
    expect(getTrack(undefined)).toBeUndefined();
  });
});

describe('creditLine', () => {
  it('gives the exact on-screen credit for each track', () => {
    expect(creditLine(track('dcye'))).toBe(
      'Music: "Don\'t Close Your Eyes" by Josh Woodward, CC BY 4.0, transcoded to AAC',
    );
    expect(creditLine(track('letting-go'))).toBe(
      'Music: "I\'m Letting Go" by Josh Woodward, CC BY 4.0, transcoded to AAC',
    );
    expect(creditLine(track('tone'))).toBe('Generated test tone');
  });

  it('leaves out the change note when the audio is unchanged', () => {
    expect(creditLine({ ...track('dcye'), changes: null })).toBe(
      'Music: "Don\'t Close Your Eyes" by Josh Woodward, CC BY 4.0',
    );
  });
});

describe('lyricsFor', () => {
  it('parses dcye to 39 lines ending at 3:15.85', () => {
    const lyrics = lyricsFor(track('dcye'));
    expect(lyrics?.lines).toHaveLength(39);
    expect(lyrics?.endMs).toBe(195_850);
    expect(lyrics?.lines[0]).toEqual({ timeMs: 9_940, text: 'Cold hands, sore feet' });
  });

  it('returns the same object on every call for the same id', () => {
    const t = track('dcye');
    const first = lyricsFor(t);
    expect(lyricsFor(t)).toBe(first);
    expect(lyricsFor({ ...t })).toBe(first);
    expect(lyricsFor(track('letting-go'))).not.toBe(first);
  });
});

describe('timesFor', () => {
  it('gives each lyric line’s start time, in order', () => {
    const t = track('dcye');
    expect(timesFor(t)).toEqual(lyricsFor(t)?.lines.map((line) => line.timeMs));
    expect(timesFor(t).slice(0, 3)).toEqual([9_940, 13_720, 18_770]);
  });

  // The lyrics view hands this array to UI-thread worklets, which are set up
  // again whenever a captured value changes identity.
  it('returns the same array on every call for the same id', () => {
    const t = track('dcye');
    const first = timesFor(t);
    expect(timesFor(t)).toBe(first);
    expect(timesFor({ ...t })).toBe(first);
    expect(timesFor(track('letting-go'))).not.toBe(first);
    expect(timesFor(track('letting-go'))).toHaveLength(lyricsFor(track('letting-go'))?.lines.length ?? -1);
  });

  it('is empty, and stable, for a track without lyrics', () => {
    expect(timesFor(track('tone'))).toEqual([]);
    expect(timesFor(track('tone'))).toBe(timesFor(track('tone')));
  });
});

// The spec's paused deep-link scenarios, run through the bundled data and the
// same activeLineIndex the screen uses.
describe('dcye active line at the spec positions', () => {
  const lyrics = lyricsFor(track('dcye'));
  if (lyrics === null) throw new Error('expected dcye lyrics');
  const times = lyrics.lines.map((line) => line.timeMs);
  const at = (ms: number) => activeLineIndex(times, ms, lyrics.endMs);

  it.each([
    [41_000, 6, 'Light a candle, or curse the dark'],
    [21_500, 2, 'Weak knees, and fresh scars'],
    [11_000, 0, 'Cold hands, sore feet'],
    [190_000, 38, lyrics.lines[38].text],
  ])('at %i ms selects line %i', (ms, index, text) => {
    expect(at(ms)).toBe(index);
    expect(lyrics.lines[index].text).toBe(text);
  });

  it('selects nothing before the first line or after the end marker', () => {
    expect(at(5_000)).toBe(-1);
    expect(at(200_000)).toBe(-1);
  });

  it('runs from line 5 through 6 to 7 between 35 s and 47 s', () => {
    expect([35_000, 37_230, 44_590, 47_000].map(at)).toEqual([5, 6, 7, 7]);
    expect(at(48_850)).toBe(8);
  });
});
