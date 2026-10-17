import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { FakePlayer } from '@/lib/player/FakePlayer';

import { NowPlaying } from '../NowPlaying';

// Real timers throughout: `jest.useFakeTimers()` stops Reanimated's
// `useFrameCallback` under jest-expo.
jest.setTimeout(20_000);

/** Every auto-scroll the lyrics ask for: the target offset and whether it animates. */
const mockScrolls: { y: number; animated: boolean }[] = [];

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    scrollTo: (_ref: unknown, _x: number, y: number, animated: boolean) => {
      mockScrolls.push({ y, animated });
    },
  };
});

let mockPlayer: FakePlayer;

jest.mock('@/lib/player/createPlayer', () => ({
  createPlayer: () => mockPlayer,
}));

const VIEW_HEIGHT = 400;
const ROW_HEIGHT = 44;
const DCYE_ROWS = 39;

/**
 * Lays the lyrics out as a device would: rows of equal height below half a
 * view of padding. Row `i` is then centred at a scroll offset of
 * `i * ROW_HEIGHT + ROW_HEIGHT / 2`.
 */
function layOut(shift = 0) {
  fireEvent(screen.getByTestId('lyrics-view'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: VIEW_HEIGHT } },
  });
  for (let i = 0; i < DCYE_ROWS; i += 1) {
    fireEvent(screen.getByTestId(`lyrics-line-${i}`), 'layout', {
      nativeEvent: {
        layout: { x: 24, y: VIEW_HEIGHT / 2 + i * ROW_HEIGHT + shift, width: 312, height: ROW_HEIGHT },
      },
    });
  }
}

const centredAt = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;
const lastScroll = () => mockScrolls[mockScrolls.length - 1];

async function settled(action: 'play' | 'pause') {
  await waitFor(() => expect(mockPlayer.calls[mockPlayer.calls.length - 1]).toBe(action));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('LyricsView auto-scroll on a tap', () => {
  beforeEach(() => {
    mockPlayer = new FakePlayer({ durationMs: 214_173 });
    mockScrolls.length = 0;
  });

  it('brings the tapped line to the centre after the user scrolled away, even the active one', async () => {
    render(
      <NowPlaying
        params={{ trackId: 'dcye', atMs: 41_000, paused: true, stallMs: null }}
        applyKey={0}
      />,
    );
    await settled('pause');
    layOut();
    await waitFor(() => expect(lastScroll()).toEqual({ y: centredAt(6), animated: false }));

    const user = userEvent.setup();
    await user.scrollTo(screen.getByTestId('lyrics-view'), { y: 1_200 });
    // The drag counted: a re-measure now leaves the lyrics where the user put them.
    const afterDrag = mockScrolls.length;
    layOut(1);
    await act(async () => {
      await sleep(150);
    });
    expect(mockScrolls).toHaveLength(afterDrag);

    // Line 6 is already the active line, so the index does not change.
    fireEvent.press(screen.getByTestId('lyrics-line-6'));
    await waitFor(() => expect(lastScroll()).toEqual({ y: centredAt(6) + 1, animated: true }));

    await user.scrollTo(screen.getByTestId('lyrics-view'), { y: 0 });
    fireEvent.press(screen.getByTestId('lyrics-line-9'));
    await waitFor(() => expect(lastScroll()).toEqual({ y: centredAt(9) + 1, animated: true }));
    await settled('pause');
  });
});
