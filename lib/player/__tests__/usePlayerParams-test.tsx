import { act, renderHook } from '@testing-library/react-native';

import { usePlayerParams } from '../usePlayerParams';

let mockSearchParams: Record<string, string | string[]> = {};
const mockUrlListeners = new Set<(event: { url: string }) => void>();
const mockRemove = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('expo-linking', () => ({
  // The real parser: which links count as player links is part of the contract.
  parse: jest.requireActual('expo-linking').parse,
  addEventListener: jest.fn((_type: 'url', listener: (event: { url: string }) => void) => {
    mockUrlListeners.add(listener);
    return {
      remove: () => {
        mockRemove();
        mockUrlListeners.delete(listener);
      },
    };
  }),
}));

const LINK = 'reactnativeuitest://player?track=dcye&at=41000&paused=1';

function receiveLink(url = LINK) {
  act(() => {
    for (const listener of [...mockUrlListeners]) listener({ url });
  });
}

describe('usePlayerParams', () => {
  beforeEach(() => {
    mockSearchParams = {};
    mockUrlListeners.clear();
    mockRemove.mockClear();
  });

  it('validates the route params against the catalog', () => {
    mockSearchParams = { track: 'letting-go', at: '21500', paused: '1' };
    const { result } = renderHook(() => usePlayerParams());

    expect(result.current.params).toEqual({
      trackId: 'letting-go',
      atMs: 21_500,
      paused: true,
      stallMs: null,
    });
    expect(result.current.applyKey).toBe(0);
  });

  it('falls back to the first track for an unknown id', () => {
    mockSearchParams = { track: 'does-not-exist', at: '41000' };
    const { result } = renderHook(() => usePlayerParams());

    expect(result.current.params).toMatchObject({ trackId: 'dcye', atMs: 41_000, paused: false });
  });

  it('starts from 0 for an at past the track, using the catalog duration', () => {
    mockSearchParams = { track: 'tone', at: '20001' };
    const { result } = renderHook(() => usePlayerParams());

    expect(result.current.params).toMatchObject({ trackId: 'tone', atMs: 0 });
  });

  it('honours stall in a development build (Jest runs with __DEV__ true)', () => {
    mockSearchParams = { track: 'dcye', at: '43000', stall: '20000' };
    const { result } = renderHook(() => usePlayerParams());

    expect(__DEV__).toBe(true);
    expect(result.current.params.stallMs).toBe(10_000);
  });

  it('bumps applyKey on every incoming player link, including an identical one', () => {
    mockSearchParams = { track: 'dcye', at: '41000', paused: '1' };
    const { result } = renderHook(() => usePlayerParams());
    const before = result.current.params;

    receiveLink();
    expect(result.current.applyKey).toBe(1);
    receiveLink();
    expect(result.current.applyKey).toBe(2);
    expect(result.current.params).toEqual(before);
  });

  it('leaves applyKey unchanged for links to other routes', () => {
    mockSearchParams = { track: 'dcye', at: '41000', paused: '1' };
    const { result } = renderHook(() => usePlayerParams());

    receiveLink('reactnativeuitest://home');
    receiveLink('reactnativeuitest://register');
    receiveLink('reactnativeuitest://forgot-password?from=player');
    expect(result.current.applyKey).toBe(0);

    receiveLink('reactnativeuitest://player?track=letting-go&paused=1');
    expect(result.current.applyKey).toBe(1);
    // The same route written as a path rather than a host.
    receiveLink('reactnativeuitest:///player?track=dcye');
    expect(result.current.applyKey).toBe(2);
  });

  it('removes its url subscription on unmount', () => {
    const { unmount } = renderHook(() => usePlayerParams());
    expect(mockUrlListeners.size).toBe(1);

    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockUrlListeners.size).toBe(0);
  });
});
