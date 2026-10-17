import { createAudioPlayer, type AudioStatus } from 'expo-audio';

import type { MockAudioPlayer } from '@/__mocks__/expo-audio';

import { ExpoAudioPlayer } from '../ExpoAudioPlayer';
import type { PlayerStatus } from '../PlayerAdapter';

const DCYE = 101;
const LETTING_GO = 102;

const createMock = jest.mocked(createAudioPlayer);

/** The fake player behind the most recent `createAudioPlayer()` call. */
function nativePlayer(): MockAudioPlayer {
  const { results } = createMock.mock;
  expect(results.length).toBeGreaterThan(0);
  return results[results.length - 1].value as unknown as MockAudioPlayer;
}

function audioStatus(overrides: Partial<AudioStatus> = {}): AudioStatus {
  return {
    id: 1,
    currentTime: 0,
    playbackState: 'ready',
    timeControlStatus: 'paused',
    reasonForWaitingToPlay: '',
    mute: false,
    duration: 214,
    playing: false,
    loop: false,
    didJustFinish: false,
    isBuffering: false,
    isLoaded: true,
    playbackRate: 1,
    shouldCorrectPitch: true,
    ...overrides,
  };
}

function subscribed(player: ExpoAudioPlayer) {
  const received: PlayerStatus[] = [];
  const unsubscribe = player.subscribe((status) => received.push(status));
  return { received, unsubscribe };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ExpoAudioPlayer', () => {
  it('creates the native player on the first load with a 250 ms update interval', () => {
    const player = new ExpoAudioPlayer();
    expect(createMock).not.toHaveBeenCalled();

    player.load(DCYE);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(DCYE, { updateInterval: 250 });
  });

  it('switches tracks with replace() on later loads', () => {
    const player = new ExpoAudioPlayer();
    player.load(DCYE);
    player.load(LETTING_GO);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(nativePlayer().replace).toHaveBeenCalledWith(LETTING_GO);
  });

  it('forwards play and pause', () => {
    const player = new ExpoAudioPlayer();
    player.load(DCYE);
    player.play();
    player.pause();

    expect(nativePlayer().play).toHaveBeenCalledTimes(1);
    expect(nativePlayer().pause).toHaveBeenCalledTimes(1);
  });

  it('seeks exactly in seconds and waits for the native seek', async () => {
    const player = new ExpoAudioPlayer();
    player.load(DCYE);
    let finishSeek!: () => void;
    nativePlayer().seekTo.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSeek = resolve;
      }),
    );

    let done = false;
    const seek = player.seekTo(41_500).then(() => {
      done = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(nativePlayer().seekTo).toHaveBeenCalledWith(41.5, 0, 0);
    expect(done).toBe(false);
    finishSeek();
    await seek;
    expect(done).toBe(true);
  });

  it('maps playbackStatusUpdate events to millisecond statuses', () => {
    const player = new ExpoAudioPlayer();
    player.load(DCYE);
    const { received } = subscribed(player);

    nativePlayer().emit(
      'playbackStatusUpdate',
      audioStatus({ currentTime: 41.5, duration: 214.3, playing: true, playbackRate: 1.5 }),
    );
    nativePlayer().emit('playbackStatusUpdate', audioStatus({ currentTime: 0, duration: 0 }));

    expect(received).toEqual([
      { positionMs: 41_500, durationMs: 214_300, playing: true, rate: 1.5 },
      { positionMs: 0, durationMs: 0, playing: false, rate: 1 },
    ]);
  });

  it('falls back to rate 1 when a status has no playbackRate', () => {
    const player = new ExpoAudioPlayer();
    player.load(DCYE);
    const { received } = subscribed(player);

    const { playbackRate: _omitted, ...withoutRate } = audioStatus({ playing: true });
    nativePlayer().emit('playbackStatusUpdate', withoutRate);

    expect(received[0].rate).toBe(1);
  });

  it('attaches subscriptions made before the first load once the player exists', () => {
    const player = new ExpoAudioPlayer();
    const { received } = subscribed(player);

    player.load(DCYE);
    nativePlayer().emit('playbackStatusUpdate', audioStatus({ currentTime: 3 }));

    expect(nativePlayer().addListener).toHaveBeenCalledWith(
      'playbackStatusUpdate',
      expect.any(Function),
    );
    expect(received.map((s) => s.positionMs)).toEqual([3_000]);
  });

  it('unsubscribe stops delivery and removes the native subscription', () => {
    const player = new ExpoAudioPlayer();
    player.load(DCYE);
    const a = subscribed(player);
    const b = subscribed(player);

    a.unsubscribe();
    nativePlayer().emit('playbackStatusUpdate', audioStatus());

    expect(a.received).toEqual([]);
    expect(b.received).toHaveLength(1);
    expect(nativePlayer().listenerCount('playbackStatusUpdate')).toBe(1);
  });

  it('release pauses, removes subscriptions, then calls remove() and release()', () => {
    const player = new ExpoAudioPlayer();
    player.load(DCYE);
    subscribed(player);
    const native = nativePlayer();
    const subscription = native.addListener.mock.results[0].value;

    player.release();

    const order = [
      native.pause.mock.invocationCallOrder[0],
      subscription.remove.mock.invocationCallOrder[0],
      native.remove.mock.invocationCallOrder[0],
      native.release.mock.invocationCallOrder[0],
    ];
    expect(order.every((n) => typeof n === 'number')).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(native.listenerCount('playbackStatusUpdate')).toBe(0);
  });

  it('ignores every call after release', async () => {
    const player = new ExpoAudioPlayer();
    player.load(DCYE);
    const native = nativePlayer();
    player.release();
    jest.clearAllMocks();

    const { received } = subscribed(player);
    player.load(LETTING_GO);
    player.play();
    player.pause();
    await expect(player.seekTo(1_000)).resolves.toBeUndefined();
    player.release();
    native.emit('playbackStatusUpdate', audioStatus());

    expect(createMock).not.toHaveBeenCalled();
    for (const method of [
      native.replace,
      native.play,
      native.pause,
      native.seekTo,
      native.addListener,
      native.remove,
      native.release,
    ]) {
      expect(method).not.toHaveBeenCalled();
    }
    expect(received).toEqual([]);
  });

  it('does nothing before the first load and after a release without one', async () => {
    const player = new ExpoAudioPlayer();
    player.play();
    player.pause();
    await expect(player.seekTo(1_000)).resolves.toBeUndefined();
    player.release();
    player.load(DCYE);

    expect(createMock).not.toHaveBeenCalled();
  });
});
