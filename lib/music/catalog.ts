import { parseLrc, type ParsedLyrics } from '../lyrics/parseLrc';
import dcyeLrc from './lyrics/dcye';
import lettingGoLrc from './lyrics/letting-go';

/** One bundled track and the licence record its audio and lyrics ship under. */
export type Track = {
  id: string;
  title: string;
  artist: string;
  /** Presentation length of the bundled M4A (MP4 edit list), in ms. Used for clamping. */
  durationMs: number;
  /** Metro asset id from `require()`. */
  audio: number;
  /** LRC text, or null for a track without lyrics. */
  lrc: string | null;
  license: string;
  /** Licence text URL; empty when no licence applies. */
  licenseUrl: string;
  /** Full attribution as the licence asks for it: title, author, source, licence, changes. */
  attribution: string;
  /** Changes made to the original, shown in the credit; null when none. */
  changes: string | null;
  /** Where the audio came from: the original download, or the script that generates it. */
  sourceUrl: string;
  /** The original song's web page, linked from the credits panel; null for generated audio. */
  pageUrl: string | null;
  /** Lyrics provenance, e.g. `lrclib:10481837`; null without lyrics. */
  lyricsSource: string | null;
  /** True once someone has listened on a device and confirmed the LRC timing. */
  lrcCheckedByEar: boolean;
};

const CC_BY = 'CC BY 4.0';
const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/';
const GENERATED = 'None (generated)';
const TRANSCODED = 'transcoded to AAC';

/** Bundled tracks. The first one is the fallback for an unknown id. */
export const CATALOG: readonly Track[] = [
  {
    id: 'dcye',
    title: "Don't Close Your Eyes",
    artist: 'Josh Woodward',
    durationMs: 214_173,
    audio: require('../../assets/music/dcye.m4a'),
    lrc: dcyeLrc,
    license: CC_BY,
    licenseUrl: CC_BY_URL,
    attribution:
      '"Don\'t Close Your Eyes" by Josh Woodward (https://www.joshwoodward.com/song/DontCloseYourEyes), ' +
      `licensed under ${CC_BY} (${CC_BY_URL}). Audio transcoded from MP3 to AAC.`,
    changes: TRANSCODED,
    sourceUrl:
      'https://www.joshwoodward.com/mp3/TheSimpleLife/JoshWoodward-TheSimpleLife-204-DontCloseYourEyes.mp3',
    pageUrl: 'https://www.joshwoodward.com/song/DontCloseYourEyes',
    lyricsSource: 'lrclib:10481837',
    lrcCheckedByEar: false,
  },
  {
    id: 'letting-go',
    title: "I'm Letting Go",
    artist: 'Josh Woodward',
    durationMs: 192_173,
    audio: require('../../assets/music/letting-go.m4a'),
    lrc: lettingGoLrc,
    license: CC_BY,
    licenseUrl: CC_BY_URL,
    attribution:
      '"I\'m Letting Go" by Josh Woodward (https://www.joshwoodward.com/song/ImLettingGo), ' +
      `licensed under ${CC_BY} (${CC_BY_URL}). Audio transcoded from MP3 to AAC.`,
    changes: TRANSCODED,
    sourceUrl:
      'https://www.joshwoodward.com/mp3/TheSimpleLife/JoshWoodward-TheSimpleLife-107-ImLettingGo.mp3',
    pageUrl: 'https://www.joshwoodward.com/song/ImLettingGo',
    lyricsSource: 'lrclib:10481859+official-chorus',
    lrcCheckedByEar: false,
  },
  {
    id: 'tone',
    title: 'Test Tone (440 Hz)',
    artist: 'Generated',
    durationMs: 20_000,
    audio: require('../../assets/music/tone.m4a'),
    lrc: null,
    license: GENERATED,
    licenseUrl: '',
    attribution: 'Generated test tone',
    changes: null,
    sourceUrl: 'scripts/build-music-assets.mjs',
    pageUrl: null,
    lyricsSource: null,
    lrcCheckedByEar: false,
  },
];

/** Returns the catalog track with this id, or undefined. */
export function getTrack(id: string | null | undefined): Track | undefined {
  return CATALOG.find((track) => track.id === id);
}

/**
 * The one-line credit shown on the Now Playing screen, e.g.
 * `Music: "Don't Close Your Eyes" by Josh Woodward, CC BY 4.0, transcoded to AAC`.
 * A generated track has nothing to credit, so it shows its attribution text.
 */
export function creditLine(track: Track): string {
  if (track.license === GENERATED) return track.attribution;
  const credit = `Music: "${track.title}" by ${track.artist}, ${track.license}`;
  return track.changes === null ? credit : `${credit}, ${track.changes}`;
}

const parsed = new Map<string, ParsedLyrics>();

/** Parsed lyrics, memoised per track id on first read; null when the track has none. */
export function lyricsFor(track: Track): ParsedLyrics | null {
  if (track.lrc === null) return null;
  let lyrics = parsed.get(track.id);
  if (lyrics === undefined) {
    lyrics = parseLrc(track.lrc);
    parsed.set(track.id, lyrics);
  }
  return lyrics;
}

const NO_TIMES: readonly number[] = Object.freeze([]);
const times = new Map<string, readonly number[]>();

/**
 * Each lyric line's start time in ms, memoised per track id on first read, so
 * every caller gets the same array; empty when the track has no lyrics. The
 * lyrics view captures it in UI-thread worklets, which Reanimated sets up again
 * whenever a captured value changes identity.
 */
export function timesFor(track: Track): readonly number[] {
  let lineTimes = times.get(track.id);
  if (lineTimes === undefined) {
    lineTimes = lyricsFor(track)?.lines.map((line) => line.timeMs) ?? NO_TIMES;
    times.set(track.id, lineTimes);
  }
  return lineTimes;
}
