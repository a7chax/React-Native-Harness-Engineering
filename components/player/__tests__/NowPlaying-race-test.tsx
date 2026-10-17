import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { FakePlayer } from '@/lib/player/FakePlayer';

import { NowPlaying } from '../NowPlaying';

// Real timers throughout: `jest.useFakeTimers()` stops Reanimated's
// `useFrameCallback` under jest-expo.
jest.setTimeout(20_000);

/**
 * On a device `scheduleOnRN` is asynchronous, so a tap already in the JS queue
 * runs before a line index the UI thread has just sent. While `hold` is on,
 * the lyrics' `(index, epoch)` messages wait in `queue` until the test
 * delivers them.
 */
const mockMessages = {
  hold: false,
  queue: [] as (() => void)[],
  sent: [] as [number, number][],
};

jest.mock('react-native-worklets', () => {
  const actual = jest.requireActual('react-native-worklets');
  return {
    __esModule: true,
    ...actual,
    scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => {
      const [index, epoch] = args;
      if (mockMessages.hold && typeof index === 'number' && typeof epoch === 'number') {
        mockMessages.sent.push([index, epoch]);
        mockMessages.queue.push(() => fn(...args));
        return;
      }
      actual.scheduleOnRN(fn, ...args);
    },
  };
});

let mockPlayer: FakePlayer;

jest.mock('@/lib/player/createPlayer', () => ({
  createPlayer: () => mockPlayer,
}));

const selectedRows = () =>
  screen
    .queryAllByTestId(/^lyrics-line-\d+$/)
    .filter((row) => row.props.accessibilityState?.selected === true)
    .map((row) => Number(String(row.props.testID).replace('lyrics-line-', '')));

async function settled(action: 'play' | 'pause') {
  await waitFor(() => expect(mockPlayer.calls[mockPlayer.calls.length - 1]).toBe(action));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('NowPlaying with a line index still on its way to JS', () => {
  beforeEach(() => {
    mockPlayer = new FakePlayer({ durationMs: 214_173 });
    mockMessages.hold = false;
    mockMessages.queue = [];
    mockMessages.sent = [];
  });

  it('selects the line Pause stopped on, even though the UI thread’s message for it arrives late', async () => {
    // Line 6 runs to 0:44.59, then line 7 to 0:48.85.
    render(
      <NowPlaying
        params={{ trackId: 'dcye', atMs: 43_000, paused: false, stallMs: null }}
        applyKey={0}
      />,
    );
    await settled('play');
    expect(selectedRows()).toEqual([6]);

    mockMessages.hold = true;
    act(() => mockPlayer.advance(1_700));
    // The UI thread has moved to line 7 and sent it; JS has not handled it yet.
    await waitFor(() => expect(mockMessages.sent.map(([index]) => index)).toContain(7));

    fireEvent.press(screen.getByTestId('player-toggle'));
    expect(screen.getByTestId('player-toggle')).toHaveTextContent('Play');
    expect(screen.getByTestId('player-time')).toHaveTextContent('0:44');
    expect(selectedRows()).toEqual([7]);

    // The late message belongs to the epoch before the Pause and is dropped,
    // and the paused UI index does not change, so nothing sends line 7 again.
    act(() => {
      mockMessages.hold = false;
      for (const deliver of mockMessages.queue.splice(0)) deliver();
    });
    act(() => mockPlayer.emit());
    await act(async () => {
      await sleep(300);
    });
    expect(selectedRows()).toEqual([7]);
  });
});
