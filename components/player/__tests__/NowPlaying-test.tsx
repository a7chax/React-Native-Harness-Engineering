import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { FakePlayer } from '@/lib/player/FakePlayer';
import type { PlayerParams } from '@/lib/player/params';
import { busyWait } from '@/lib/player/stall';

import { NowPlaying } from '../NowPlaying';

// Real timers throughout: `jest.useFakeTimers()` stops Reanimated's
// `useFrameCallback` under jest-expo. The first render of the screen in a
// worker with a cold transform cache can take over 5 s.
jest.setTimeout(20_000);

// Reanimated numbers every animated component in the worker (`nativeID`), so
// the number depends on which tests ran first. Leave it out of snapshots.
expect.addSnapshotSerializer({
  test: (value) =>
    typeof value?.props?.nativeID === 'string' && /^\d+$/.test(value.props.nativeID),
  serialize: (value, config, indentation, depth, refs, printer) => {
    const { nativeID: _nativeID, ...props } = value.props;
    // `$$typeof` is not enumerable, so the spread alone would drop it and the
    // node would print as a plain object.
    return printer({ ...value, $$typeof: value.$$typeof, props }, config, indentation, depth, refs);
  },
});

let mockPlayer: FakePlayer;

jest.mock('@/lib/player/createPlayer', () => ({
  createPlayer: () => mockPlayer,
}));

jest.mock('@/lib/player/stall', () => ({
  ...jest.requireActual('@/lib/player/stall'),
  busyWait: jest.fn(),
}));

const DCYE_CREDIT = 'Music: "Don\'t Close Your Eyes" by Josh Woodward, CC BY 4.0, transcoded to AAC';
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
const DCYE_PAGE_URL = 'https://www.joshwoodward.com/song/DontCloseYourEyes';

const params = (overrides: Partial<PlayerParams> = {}): PlayerParams => ({
  trackId: 'dcye',
  atMs: 0,
  paused: true,
  stallMs: null,
  ...overrides,
});

/** Waits until the apply's seek has landed and the player was told to play or pause. */
async function settled(action: 'play' | 'pause') {
  await waitFor(() => expect(mockPlayer.calls[mockPlayer.calls.length - 1]).toBe(action));
}

const toggle = () => screen.getByTestId('player-toggle');
const time = () => screen.getByTestId('player-time');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('NowPlaying', () => {
  beforeEach(() => {
    mockPlayer = new FakePlayer({ durationMs: 214_173 });
    jest.mocked(busyWait).mockClear();
  });

  it('opens a track by id with its title and artist', async () => {
    render(<NowPlaying params={params({ trackId: 'letting-go' })} applyKey={0} />);

    expect(screen.getByTestId('player-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('player-title')).toHaveTextContent("I'm Letting Go");
    expect(screen.getByTestId('player-artist')).toHaveTextContent('Josh Woodward');
    await settled('pause');
  });

  it('falls back to the first catalog track for an unknown id', async () => {
    render(<NowPlaying params={params({ trackId: 'does-not-exist' })} applyKey={0} />);

    expect(screen.getByTestId('player-title')).toHaveTextContent("Don't Close Your Eyes");
    expect(screen.getByTestId('player-artist')).toHaveTextContent('Josh Woodward');
    await settled('pause');
  });

  it('loads, seeks and then pauses for a paused deep link', async () => {
    render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);

    expect(toggle()).toHaveTextContent('Play');
    expect(time()).toHaveTextContent('0:41');
    await settled('pause');
    expect(mockPlayer.calls).toEqual(['subscribe', 'load', 'seekTo', 'pause']);
    expect(mockPlayer.status).toMatchObject({ positionMs: 41_000, playing: false });
  });

  it('starts playing straight away without paused=1', async () => {
    render(<NowPlaying params={params({ atMs: 41_000, paused: false })} applyKey={0} />);

    expect(toggle()).toHaveTextContent('Pause');
    await settled('play');
    expect(mockPlayer.calls).toEqual(['subscribe', 'load', 'seekTo', 'play']);
  });

  it('flips between Play and Pause on tap and drives the player', async () => {
    render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);
    await settled('pause');

    fireEvent.press(toggle());
    expect(toggle()).toHaveTextContent('Pause');
    expect(mockPlayer.calls[mockPlayer.calls.length - 1]).toBe('play');
    expect(mockPlayer.status.playing).toBe(true);

    fireEvent.press(toggle());
    expect(toggle()).toHaveTextContent('Play');
    expect(mockPlayer.calls[mockPlayer.calls.length - 1]).toBe('pause');
    expect(mockPlayer.status.playing).toBe(false);
  });

  it('keeps the time label and the lyric position for 2 s after Pause, whatever the paused status says', async () => {
    // Line 6 runs to 0:44.59, then line 7.
    render(<NowPlaying params={params({ atMs: 43_000, paused: false })} applyKey={0} />);
    await settled('play');
    act(() => mockPlayer.advance(1_300));
    // Lets the UI-thread clock pick up 0:44.3 before the tap.
    await act(async () => {
      await sleep(50);
    });

    fireEvent.press(toggle());
    expect(toggle()).toHaveTextContent('Play');
    expect(time()).toHaveTextContent('0:44');
    expect(screen.getByTestId('lyrics-line-6')).toBeSelected();

    // The native player stopped a little later than the screen showed, and
    // every paused status after the tap says so.
    for (let i = 0; i < 4; i += 1) {
      act(() => mockPlayer.emit({ positionMs: 45_100, playing: false }));
      await act(async () => {
        await sleep(500);
      });
      expect(time()).toHaveTextContent('0:44');
      expect(toggle()).toHaveTextContent('Play');
    }
    expect(screen.getByTestId('lyrics-line-6')).toBeSelected();
    expect(screen.getByTestId('lyrics-line-7')).not.toBeSelected();
  });

  it('resumes from the paused second, never showing less, and then moves on', async () => {
    render(<NowPlaying params={params({ atMs: 43_000, paused: false })} applyKey={0} />);
    await settled('play');
    act(() => mockPlayer.advance(1_300));
    await act(async () => {
      await sleep(50);
    });

    fireEvent.press(toggle());
    // A paused status a little behind the label, such as audio still in the
    // output buffer when the pause landed.
    act(() => mockPlayer.emit({ positionMs: 44_000, playing: false }));
    expect(time()).toHaveTextContent('0:44');

    fireEvent.press(toggle());
    expect(toggle()).toHaveTextContent('Pause');
    expect(time()).toHaveTextContent('0:44');
    act(() => mockPlayer.emit({ positionMs: 43_950, playing: true }));
    expect(time()).toHaveTextContent('0:44');
    // The fake player resumes from 0:44.3; 0:45.3 is in line 7.
    act(() => mockPlayer.advance(1_000));
    expect(time()).toHaveTextContent('0:45');
    await waitFor(() => expect(screen.getByTestId('lyrics-line-7')).toBeSelected());
  });

  it('shows the position in m:ss, rounded down, after a seek and a status', async () => {
    render(<NowPlaying params={params()} applyKey={0} />);
    expect(time()).toHaveTextContent('0:00');
    await settled('pause');

    await act(async () => {
      await mockPlayer.seekTo(61_999);
      mockPlayer.emit();
    });
    expect(time()).toHaveTextContent('1:01');
  });

  it('moves the time label while playing', async () => {
    render(<NowPlaying params={params({ atMs: 35_000 })} applyKey={0} />);
    await settled('pause');

    fireEvent.press(toggle());
    act(() => mockPlayer.advance(12_000));
    expect(time()).toHaveTextContent('0:47');
    // 0:47 is in line 7; the selection follows through the UI-thread chain.
    await waitFor(() => expect(screen.getByTestId('lyrics-line-7')).toBeSelected());
  });

  it('ignores a status sent before the seek lands', async () => {
    render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);
    // The seek promise has not resolved yet: this is the 0:00 sample a real
    // player sends right after loading a track.
    act(() => mockPlayer.emit({ positionMs: 0 }));
    expect(time()).toHaveTextContent('0:41');

    await settled('pause');
    expect(time()).toHaveTextContent('0:41');
  });

  it('shows the exact credit line', async () => {
    render(<NowPlaying params={params()} applyKey={0} />);

    expect(screen.getByTestId('player-credit')).toHaveTextContent(DCYE_CREDIT, { exact: true });
    await settled('pause');
  });

  it('opens the credits panel with working licence and song page links, and closes it', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<NowPlaying params={params()} applyKey={0} />);
    await settled('pause');
    expect(screen.queryByTestId('credits-panel')).toBeNull();

    fireEvent.press(screen.getByTestId('player-credit'));
    expect(screen.getByTestId('credits-panel')).toBeOnTheScreen();
    expect(screen.getByTestId('credits-attribution')).toHaveTextContent(
      /^"Don't Close Your Eyes" by Josh Woodward/,
    );
    expect(screen.getByTestId('credits-license-link')).toHaveTextContent(LICENSE_URL, {
      exact: true,
    });
    expect(screen.getByTestId('credits-page-link')).toHaveTextContent(DCYE_PAGE_URL, {
      exact: true,
    });

    fireEvent.press(screen.getByTestId('credits-license-link'));
    expect(openURL).toHaveBeenLastCalledWith(LICENSE_URL);
    fireEvent.press(screen.getByTestId('credits-page-link'));
    expect(openURL).toHaveBeenLastCalledWith(DCYE_PAGE_URL);
    expect(openURL).toHaveBeenCalledTimes(2);

    fireEvent.press(screen.getByTestId('credits-close'));
    expect(screen.queryByTestId('credits-panel')).toBeNull();
    expect(screen.getByTestId('lyrics-view')).toBeOnTheScreen();
    openURL.mockRestore();
  });

  it('shows only the attribution, with no links, for the generated tone', async () => {
    render(<NowPlaying params={params({ trackId: 'tone' })} applyKey={0} />);
    await settled('pause');
    expect(screen.getByTestId('player-credit')).toHaveTextContent('Generated test tone', {
      exact: true,
    });

    fireEvent.press(screen.getByTestId('player-credit'));
    expect(screen.getByTestId('credits-attribution')).toHaveTextContent('Generated test tone');
    expect(screen.queryByTestId('credits-license-link')).toBeNull();
    expect(screen.queryByTestId('credits-page-link')).toBeNull();
  });

  it('re-applies an identical deep link after Play when applyKey goes up', async () => {
    const link = params({ atMs: 41_000 });
    render(<NowPlaying params={link} applyKey={0} />);
    await settled('pause');

    fireEvent.press(toggle());
    act(() => mockPlayer.advance(2_500));
    expect(toggle()).toHaveTextContent('Pause');
    expect(time()).toHaveTextContent('0:43');
    const before = mockPlayer.calls.length;

    screen.rerender(<NowPlaying params={{ ...link }} applyKey={1} />);
    expect(toggle()).toHaveTextContent('Play');
    expect(time()).toHaveTextContent('0:41');
    expect(screen.getByTestId('lyrics-line-6')).toBeSelected();

    await settled('pause');
    // Same track: no reload, just the seek and the pause again.
    expect(mockPlayer.calls.slice(before)).toEqual(['seekTo', 'pause']);
    expect(mockPlayer.status).toMatchObject({ positionMs: 41_000, playing: false });
  });

  it('reloads only when the track changes', async () => {
    render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);
    await settled('pause');

    screen.rerender(<NowPlaying params={params({ atMs: 21_500 })} applyKey={0} />);
    await settled('pause');
    screen.rerender(<NowPlaying params={params({ trackId: 'letting-go' })} applyKey={0} />);
    await settled('pause');

    expect(mockPlayer.calls.filter((call) => call === 'load')).toHaveLength(2);
    expect(mockPlayer.calls.filter((call) => call === 'seekTo')).toHaveLength(3);
  });

  it('releases the player on unmount', async () => {
    const { unmount } = render(<NowPlaying params={params()} applyKey={0} />);
    await settled('pause');

    unmount();
    expect(mockPlayer.calls[mockPlayer.calls.length - 1]).toBe('release');
  });

  it('stalls once, on the first playing status at or past at - 250 ms', async () => {
    render(<NowPlaying params={params({ atMs: 43_000, paused: false, stallMs: 6_000 })} applyKey={0} />);
    await settled('play');

    act(() => mockPlayer.emit({ positionMs: 42_000 }));
    await act(async () => {});
    expect(busyWait).not.toHaveBeenCalled();

    act(() => mockPlayer.emit({ positionMs: 42_750 }));
    await waitFor(() => expect(busyWait).toHaveBeenCalledWith(6_000));

    act(() => mockPlayer.advance(1_000));
    await act(async () => {});
    expect(busyWait).toHaveBeenCalledTimes(1);
  });

  it('never stalls without a stall parameter', async () => {
    render(<NowPlaying params={params({ atMs: 43_000, paused: false })} applyKey={0} />);
    await settled('play');

    act(() => mockPlayer.advance(1_000));
    await act(async () => {});
    expect(busyWait).not.toHaveBeenCalled();
  });

  it('never renders a loading indicator', async () => {
    render(<NowPlaying params={params()} applyKey={0} />);

    expect(screen.queryByTestId('loading')).toBeNull();
    await settled('pause');
    expect(screen.queryByTestId('loading')).toBeNull();
  });

  it('matches the snapshot of dcye paused at 0:41', async () => {
    render(<NowPlaying params={params({ atMs: 41_000 })} applyKey={0} />);

    expect(screen.toJSON()).toMatchSnapshot();
    await settled('pause');
  });
});
