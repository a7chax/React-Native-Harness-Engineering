import { act, render, screen, waitFor } from '@testing-library/react-native';

import { FakePlayer } from '@/lib/player/FakePlayer';
import type { PlayerParams } from '@/lib/player/params';

import { NowPlaying } from '../NowPlaying';

// Real timers throughout: `jest.useFakeTimers()` stops Reanimated's
// `useFrameCallback` under jest-expo.
jest.setTimeout(20_000);

/**
 * Render probes on the Reanimated hooks the lyrics subtree calls, and on
 * nothing else on the screen: one `useAnimatedScrollHandler` per lyrics list
 * render, one `useAnimatedStyle` per row render and one `useFrameCallback` per
 * clock render. The worklets given to `useDerivedValue` and
 * `useAnimatedReaction` carry their captured values in `__closure`; Reanimated
 * sets the worklet up again whenever one of them changes identity.
 */
const mockProbe = {
  listRenders: 0,
  rowRenders: 0,
  clockRenders: 0,
  times: new Set<unknown>(),
  onActiveIndex: new Set<unknown>(),
};

type Worklet = { __closure?: Record<string, unknown> };

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useAnimatedScrollHandler: (...args: unknown[]) => {
      mockProbe.listRenders += 1;
      return actual.useAnimatedScrollHandler(...args);
    },
    useAnimatedStyle: (...args: unknown[]) => {
      mockProbe.rowRenders += 1;
      return actual.useAnimatedStyle(...args);
    },
    useFrameCallback: (...args: unknown[]) => {
      mockProbe.clockRenders += 1;
      return actual.useFrameCallback(...args);
    },
    useDerivedValue: (updater: Worklet, ...rest: unknown[]) => {
      if (updater.__closure !== undefined && 'times' in updater.__closure) {
        mockProbe.times.add(updater.__closure.times);
      }
      return actual.useDerivedValue(updater, ...rest);
    },
    useAnimatedReaction: (prepare: unknown, react: Worklet, ...rest: unknown[]) => {
      if (react.__closure !== undefined && 'onActiveIndex' in react.__closure) {
        mockProbe.onActiveIndex.add(react.__closure.onActiveIndex);
      }
      return actual.useAnimatedReaction(prepare, react, ...rest);
    },
  };
});

let mockPlayer: FakePlayer;

jest.mock('@/lib/player/createPlayer', () => ({
  createPlayer: () => mockPlayer,
}));

const params = (overrides: Partial<PlayerParams> = {}): PlayerParams => ({
  trackId: 'dcye',
  atMs: 0,
  paused: true,
  stallMs: null,
  ...overrides,
});

const selectedRows = () =>
  screen
    .queryAllByTestId(/^lyrics-line-\d+$/)
    .filter((row) => row.props.accessibilityState?.selected === true)
    .map((row) => Number(String(row.props.testID).replace('lyrics-line-', '')));

async function settled(action: 'play' | 'pause') {
  await waitFor(() => expect(mockPlayer.calls[mockPlayer.calls.length - 1]).toBe(action));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const counts = () => ({
  list: mockProbe.listRenders,
  rows: mockProbe.rowRenders,
  clock: mockProbe.clockRenders,
});

describe('LyricsView render cost', () => {
  beforeEach(() => {
    mockPlayer = new FakePlayer({ durationMs: 214_173 });
    mockProbe.listRenders = 0;
    mockProbe.rowRenders = 0;
    mockProbe.clockRenders = 0;
    mockProbe.times.clear();
    mockProbe.onActiveIndex.clear();
  });

  it('does not re-render the lyrics when only the time label’s second changes', async () => {
    // Line 4 runs from 0:28.95 to 0:34.08, so 0:30 to 0:33 changes only the label.
    render(<NowPlaying params={params({ atMs: 30_000, paused: false })} applyKey={0} />);
    await settled('play');
    await act(async () => {
      await sleep(200);
    });
    expect(selectedRows()).toEqual([4]);
    const before = counts();
    expect(before.list).toBeGreaterThan(0);

    for (const label of ['0:31', '0:32', '0:33']) {
      act(() => mockPlayer.advance(1_000));
      expect(screen.getByTestId('player-time')).toHaveTextContent(label);
    }
    await act(async () => {
      await sleep(200);
    });

    expect(counts()).toEqual(before);
    expect(selectedRows()).toEqual([4]);
  });

  it('keeps the worklets’ captured line times and index callback across a line change', async () => {
    // Line 5 starts at 0:34.08: one line change, which re-renders the list once.
    render(<NowPlaying params={params({ atMs: 33_500, paused: false })} applyKey={0} />);
    await settled('play');
    const before = counts();

    act(() => mockPlayer.advance(1_000));
    await waitFor(() => expect(selectedRows()).toEqual([5]));

    expect(mockProbe.listRenders).toBeGreaterThan(before.list);
    expect(mockProbe.times.size).toBe(1);
    expect(mockProbe.onActiveIndex.size).toBe(1);
  });
});
