import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { FakePlayer } from '@/lib/player/FakePlayer';

import PlayerScreen from '../player';

// Real timers: `jest.useFakeTimers()` stops Reanimated's `useFrameCallback`.
jest.setTimeout(20_000);

let mockPlayer: FakePlayer;
let mockSearchParams: Record<string, string> = {};
const mockUrlListeners = new Set<(event: { url: string }) => void>();

jest.mock('@/lib/player/createPlayer', () => ({
  createPlayer: () => mockPlayer,
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('expo-linking', () => ({
  parse: jest.requireActual('expo-linking').parse,
  addEventListener: (_type: 'url', listener: (event: { url: string }) => void) => {
    mockUrlListeners.add(listener);
    return { remove: () => mockUrlListeners.delete(listener) };
  },
}));

/** Opens the route as the deep link `reactnativeuitest://player?<query>` would. */
function open(query: Record<string, string>) {
  mockSearchParams = query;
  return render(<PlayerScreen />);
}

/** An incoming link that leaves the route params unchanged: only the `url` event fires. */
function receiveLink(url = 'reactnativeuitest://player?track=dcye&at=41000&paused=1') {
  act(() => {
    for (const listener of [...mockUrlListeners]) listener({ url });
  });
}

async function settled(action: 'play' | 'pause') {
  await waitFor(() => expect(mockPlayer.calls[mockPlayer.calls.length - 1]).toBe(action));
}

describe('PlayerScreen route', () => {
  beforeEach(() => {
    mockPlayer = new FakePlayer({ durationMs: 214_173 });
    mockUrlListeners.clear();
  });

  it('opens a track by id, paused at the requested position', async () => {
    open({ track: 'dcye', at: '41000', paused: '1' });

    expect(screen.getByTestId('player-title')).toHaveTextContent("Don't Close Your Eyes");
    expect(screen.getByTestId('player-artist')).toHaveTextContent('Josh Woodward');
    expect(screen.getByTestId('player-time')).toHaveTextContent('0:41');
    expect(screen.getByTestId('player-toggle')).toHaveTextContent('Play');
    expect(screen.getByTestId('lyrics-line-6')).toBeSelected();
    await settled('pause');
  });

  it('shows the first catalog track for an unknown id, with no error screen', async () => {
    open({ track: 'does-not-exist' });

    expect(screen.getByTestId('player-title')).toHaveTextContent("Don't Close Your Eyes");
    await settled('play');
  });

  it.each(['-5', 'abc', '999999999'])('starts from 0:00 for at=%s', async (at) => {
    open({ track: 'dcye', at, paused: '1' });

    expect(screen.getByTestId('player-time')).toHaveTextContent('0:00');
    await settled('pause');
    expect(mockPlayer.status.positionMs).toBe(0);
  });

  it('re-applies the same deep link after Play', async () => {
    open({ track: 'dcye', at: '41000', paused: '1' });
    await settled('pause');

    fireEvent.press(screen.getByTestId('player-toggle'));
    act(() => mockPlayer.advance(2_000));
    expect(screen.getByTestId('player-time')).toHaveTextContent('0:43');
    const before = mockPlayer.calls.length;

    receiveLink();
    expect(screen.getByTestId('player-toggle')).toHaveTextContent('Play');
    expect(screen.getByTestId('player-time')).toHaveTextContent('0:41');
    await settled('pause');
    expect(mockPlayer.calls.slice(before)).toEqual(['seekTo', 'pause']);
    expect(mockPlayer.status).toMatchObject({ positionMs: 41_000, playing: false });
  });

  it('does not re-apply for a link to another route', async () => {
    open({ track: 'dcye', at: '41000', paused: '1' });
    await settled('pause');

    fireEvent.press(screen.getByTestId('player-toggle'));
    act(() => mockPlayer.advance(2_000));
    const before = mockPlayer.calls.length;

    receiveLink('reactnativeuitest://home');
    receiveLink('reactnativeuitest://register');
    await act(async () => {});
    expect(screen.getByTestId('player-toggle')).toHaveTextContent('Pause');
    expect(screen.getByTestId('player-time')).toHaveTextContent('0:43');
    expect(mockPlayer.calls.slice(before)).toEqual([]);
  });
});
