import dcye from '../dcye';
import lettingGo from '../letting-go';

// A local pattern, so this checks the bundled text independently of lib/lyrics.
const TIMED_LINE = /^\[(\d{2}):([0-5]\d)\.(\d{2})\](.*)$/;

type Row = { timeMs: number; text: string };

function toRows(lrc: string): Row[] {
  return lrc.split('\n').map((line) => {
    const match = TIMED_LINE.exec(line);
    if (!match) throw new Error(`Not a timed LRC line: ${JSON.stringify(line)}`);
    const [, mm, ss, cs, text] = match;
    return { timeMs: (Number(mm) * 60 + Number(ss)) * 1000 + Number(cs) * 10, text: text.trim() };
  });
}

describe.each([
  ['dcye', dcye],
  ['letting-go', lettingGo],
])('%s lyrics', (_id, lrc) => {
  it('is a non-empty string', () => {
    expect(typeof lrc).toBe('string');
    expect(lrc.length).toBeGreaterThan(0);
  });

  it('has only lines that start with an [mm:ss.xx] timestamp', () => {
    expect(lrc.split('\n').filter((line) => !TIMED_LINE.test(line))).toEqual([]);
  });

  it('has strictly increasing timestamps', () => {
    const times = toRows(lrc).map((row) => row.timeMs);
    times.slice(1).forEach((time, i) => expect(time).toBeGreaterThan(times[i]));
  });

  it('has no chorus marker left', () => {
    expect(lrc).not.toMatch(/[([]chorus[)\]]/i);
  });

  it('ends with an empty end marker and has no other empty line', () => {
    const rows = toRows(lrc);
    expect(rows[rows.length - 1].text).toBe('');
    expect(rows.slice(0, -1).filter((row) => row.text === '')).toEqual([]);
  });
});

describe('dcye lyrics', () => {
  it('has 40 timestamp lines, the last the empty [03:15.85] end marker', () => {
    const lines = dcye.split('\n');
    expect(lines).toHaveLength(40);
    expect(lines[39].trim()).toBe('[03:15.85]');
  });
});

describe('letting-go lyrics', () => {
  it('repeats the first chorus from 2:16.57 with the same text and line offsets', () => {
    const rows = toRows(lettingGo);
    const first = rows.findIndex((row) => row.timeMs === 60_240);
    const repeat = rows.findIndex((row) => row.timeMs === 136_570);
    const chorus = rows.slice(first, first + 7);
    const repeated = rows.slice(repeat, repeat + 7);

    expect(chorus[0].text).toBe("But I'm letting go");
    expect(repeated.map((row) => row.text)).toEqual(chorus.map((row) => row.text));
    expect(repeated.map((row) => row.timeMs - 136_570)).toEqual(
      chorus.map((row) => row.timeMs - 60_240),
    );
    expect(rows.slice(repeat + 7)).toEqual([{ timeMs: 185_380, text: '' }]);
  });
});
