/**
 * Jest manual mock for `expo-audio`.
 *
 * jest-expo's stand-in for the `ExpoAudio` native module has no `AudioPlayer`
 * class, and `expo-audio` patches `AudioModule.AudioPlayer.prototype` at import
 * time, so importing the real package throws under Jest.
 *
 * This replaces the package with `jest.fn` stubs. `createAudioPlayer` returns a
 * fake player whose methods are all `jest.fn`; `addListener` records each
 * listener so a test can fire events with the player's `emit()` helper, and the
 * returned subscription's `remove()` unregisters it. Jest applies the mock
 * automatically because it sits in `<rootDir>/__mocks__` next to `node_modules`.
 */

type Listener = (payload: any) => void;

function createMockAudioPlayer(source?: unknown, options?: unknown) {
  const listeners = new Map<string, Set<Listener>>();
  return {
    source,
    options,
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn((_source: unknown) => {}),
    seekTo: jest.fn(
      (_seconds: number, _toleranceBefore?: number, _toleranceAfter?: number): Promise<void> =>
        Promise.resolve(),
    ),
    setPlaybackRate: jest.fn((_rate: number) => {}),
    remove: jest.fn(),
    release: jest.fn(),
    addListener: jest.fn((event: string, listener: Listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      listeners.set(event, set);
      set.add(listener);
      return {
        remove: jest.fn(() => {
          set.delete(listener);
        }),
      };
    }),
    /** Test helper: delivers `payload` to every listener still registered for `event`. */
    emit(event: string, payload: unknown) {
      for (const listener of [...(listeners.get(event) ?? [])]) listener(payload);
    },
    /** Test helper: how many listeners are registered for `event`. */
    listenerCount(event: string): number {
      return listeners.get(event)?.size ?? 0;
    },
  };
}

export type MockAudioPlayer = ReturnType<typeof createMockAudioPlayer>;

export const createAudioPlayer = jest.fn(createMockAudioPlayer);

export const useAudioPlayer = jest.fn(createMockAudioPlayer);

export const setAudioModeAsync = jest.fn((_mode: unknown): Promise<void> => Promise.resolve());
