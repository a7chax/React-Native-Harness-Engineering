import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { getTrack, lyricsFor } from '@/lib/music/catalog';
import { FakePlayer } from '@/lib/player/FakePlayer';
import type { PlayerParams } from '@/lib/player/params';

import { NowPlaying } from '../NowPlaying';

// Driven through NowPlaying, which owns the anchor and the selected index.
// Real timers throughout: `jest.useFakeTimers()` stops Reanimated's
// `useFrameCallback` under jest-expo, so anything that goes through the
// UI-thread chain is awaited with `waitFor`. Paused applies are checked
// synchronously, since the selected index is computed on the JS side.
jest.setTimeout(20_000);

let mockPlayer: FakePlayer;

jest.mock('@/lib/player/createPlayer', () => ({
  createPlayer: () => mockPlayer,
}));

function linesOf(id: string) {
  const track = getTrack(id);
  const lyrics = track === undefined ? null : lyricsFor(track);
  if (lyrics === null) throw new Error(`expected lyrics for ${id}`);
  return lyrics.lines;
}

const DCYE = linesOf('dcye');
const LETTING_GO = linesOf('letting-go');

const params = (overrides: Partial<PlayerParams> = {}): PlayerParams => ({
  trackId: 'dcye',
  atMs: 0,
  paused: true,
  stallMs: null,
  ...overrides,
});

const rows = () => screen.queryAllByTestId(/^lyrics-line-\d+$/);

/** Indexes of the rows reported as selected to accessibility services. */
const selectedRows = () =>
  rows()
    .filter((row) => row.props.accessibilityState?.selected === true)
    .map((row) => Number(String(row.props.testID).replace('lyrics-line-', '')));

async function settled(action: 'play' | 'pause') {
  await waitFor(() => expect(mockPlayer.calls[mockPlayer.calls.length - 1]).toBe(action));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('LyricsView', () => {
  beforeEach(() => {
    mockPlayer = new FakePlayer({ durationMs: 214_173 });
  });

  it('selects only line 6 in the first render when paused at 0:41', async () => {
    render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);

    expect(screen.getByTestId('lyrics-view')).toBeOnTheScreen();
    expect(rows()).toHaveLength(DCYE.length);
    expect(screen.getByTestId('lyrics-line-6')).toBeSelected();
    expect(screen.getByTestId('lyrics-line-6')).toHaveTextContent(
      'Light a candle, or curse the dark',
    );
    expect(selectedRows()).toEqual([6]);
    await settled('pause');
    expect(selectedRows()).toEqual([6]);
  });

  it('moves the selection back to line 2 when a new paused link applies 0:21.5', async () => {
    render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);
    await settled('pause');

    screen.rerender(<NowPlaying params={params({ atMs: 21_500 })} applyKey={1} />);
    expect(screen.getByTestId('lyrics-line-2')).toBeSelected();
    expect(screen.getByTestId('lyrics-line-2')).toHaveTextContent('Weak knees, and fresh scars');
    expect(selectedRows()).toEqual([2]);
    expect(screen.getByTestId('lyrics-line-6')).not.toBeSelected();
  });

  it.each([
    ['before the first line', 5_000],
    ['after the end marker', 200_000],
  ])('selects no line %s', async (_label, atMs) => {
    render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);
    await settled('pause');

    screen.rerender(<NowPlaying params={params({ atMs })} applyKey={1} />);
    expect(rows()).toHaveLength(DCYE.length);
    expect(selectedRows()).toEqual([]);
    await settled('pause');
    expect(selectedRows()).toEqual([]);
  });

  it('shows the new track’s lines in the same render as a track switch', async () => {
    render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);
    await settled('pause');

    screen.rerender(<NowPlaying params={params({ trackId: 'letting-go' })} applyKey={1} />);
    expect(screen.getByTestId('player-title')).toHaveTextContent("I'm Letting Go");
    expect(rows()).toHaveLength(LETTING_GO.length);
    expect(screen.getByTestId('lyrics-line-0')).toHaveTextContent(LETTING_GO[0].text);
    for (const line of DCYE) expect(screen.queryByText(line.text)).toBeNull();
    expect(screen.queryByTestId('loading')).toBeNull();
    // 0:00 is before letting-go's first line.
    expect(selectedRows()).toEqual([]);
  });

  it('shows "No lyrics for this track" and no rows for the tone', async () => {
    render(<NowPlaying params={params({ trackId: 'tone' })} applyKey={0} />);

    expect(screen.getByTestId('lyrics-empty')).toHaveTextContent('No lyrics for this track');
    expect(rows()).toHaveLength(0);
    expect(screen.queryByTestId('lyrics-view')).toBeNull();
    expect(screen.queryByTestId('loading')).toBeNull();
    await settled('pause');
  });

  it('moves the selection forward while playing and never back on a stale status', async () => {
    // Line 6 runs from 0:37.23 to 0:44.59, line 7 to 0:48.85.
    render(<NowPlaying params={params({ atMs: 44_000 })} applyKey={0} />);
    await settled('pause');
    expect(selectedRows()).toEqual([6]);

    fireEvent.press(screen.getByTestId('player-toggle'));
    act(() => mockPlayer.advance(1_000));
    await waitFor(() => expect(selectedRows()).toEqual([7]));

    // A sample behind the displayed position, like the burst queued during a
    // JS stall: the highlight holds still instead of moving back.
    act(() => mockPlayer.emit({ positionMs: 43_000 }));
    await act(async () => {
      await sleep(300);
    });
    expect(selectedRows()).toEqual([7]);
    expect(screen.getByTestId('lyrics-line-6')).not.toBeSelected();
  });

  it('follows a deep link back to an earlier line even while playing', async () => {
    render(<NowPlaying params={params({ atMs: 44_000, paused: false })} applyKey={0} />);
    await settled('play');
    act(() => mockPlayer.advance(1_000));
    await waitFor(() => expect(selectedRows()).toEqual([7]));

    // A user or deep-link action starts a new epoch, which may move back.
    screen.rerender(<NowPlaying params={params({ atMs: 21_500, paused: false })} applyKey={1} />);
    expect(selectedRows()).toEqual([2]);
    await settled('play');
    await act(async () => {
      await sleep(200);
    });
    expect(selectedRows()).toEqual([2]);
  });

  describe('tap a line to jump to it', () => {
    const toggle = () => screen.getByTestId('player-toggle');
    const time = () => screen.getByTestId('player-time');

    it('jumps to a later line while paused and stays paused', async () => {
      render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);
      await settled('pause');
      const seekTo = jest.spyOn(mockPlayer, 'seekTo');
      const before = mockPlayer.calls.length;

      fireEvent.press(screen.getByTestId('lyrics-line-9'));
      expect(screen.getByTestId('lyrics-line-9')).toHaveTextContent('And shake away the heat');
      expect(selectedRows()).toEqual([9]);
      expect(time()).toHaveTextContent('0:54');
      expect(toggle()).toHaveTextContent('Play');

      // Line 9 starts at 0:54.36; the jump lands 50 ms inside it.
      await waitFor(() => expect(mockPlayer.calls.slice(before)).toEqual(['seekTo', 'pause']));
      expect(seekTo).toHaveBeenCalledWith(54_410);
      expect(mockPlayer.status).toMatchObject({ positionMs: 54_410, playing: false });

      act(() => mockPlayer.emit());
      await act(async () => {
        await sleep(300);
      });
      expect(selectedRows()).toEqual([9]);
      expect(time()).toHaveTextContent('0:54');
      expect(toggle()).toHaveTextContent('Play');
    });

    it('jumps back to an earlier line while playing and plays on from there', async () => {
      render(<NowPlaying params={params({ atMs: 41_000, paused: false })} applyKey={0} />);
      await settled('play');
      act(() => mockPlayer.advance(1_000));
      await waitFor(() => expect(time()).toHaveTextContent('0:42'));
      const seekTo = jest.spyOn(mockPlayer, 'seekTo');
      const before = mockPlayer.calls.length;

      act(() => {
        fireEvent.press(screen.getByTestId('lyrics-line-2'));
        // A status sent before the seek lands still carries the old position.
        mockPlayer.emit({ positionMs: 42_100 });
      });
      expect(screen.getByTestId('lyrics-line-2')).toHaveTextContent('Weak knees, and fresh scars');
      expect(selectedRows()).toEqual([2]);
      expect(time()).toHaveTextContent('0:18');
      expect(toggle()).toHaveTextContent('Pause');

      // Line 2 starts at 0:18.77.
      await waitFor(() => expect(mockPlayer.calls.slice(before)).toEqual(['seekTo', 'play']));
      expect(seekTo).toHaveBeenCalledWith(18_820);

      act(() => mockPlayer.advance(500));
      expect(time()).toHaveTextContent('0:19');
      act(() => mockPlayer.advance(1_000));
      expect(time()).toHaveTextContent('0:20');
      await act(async () => {
        await sleep(300);
      });
      expect(selectedRows()).toEqual([2]);
      expect(toggle()).toHaveTextContent('Pause');
    });

    it('does not seek on a drag or a fling of the lyrics', async () => {
      render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);
      await settled('pause');
      const before = mockPlayer.calls.length;

      const user = userEvent.setup();
      // Drag events, then momentum events for the fling.
      await user.scrollTo(screen.getByTestId('lyrics-view'), { y: 400, momentumY: 900 });
      await user.scrollTo(screen.getByTestId('lyrics-view'), { y: 0 });
      await act(async () => {
        await sleep(200);
      });

      expect(mockPlayer.calls.slice(before)).toEqual([]);
      expect(selectedRows()).toEqual([6]);
      expect(time()).toHaveTextContent('0:41');
      expect(toggle()).toHaveTextContent('Play');
    });
  });
});
