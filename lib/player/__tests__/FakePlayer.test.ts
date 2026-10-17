import { FakePlayer } from '../FakePlayer';
import type { PlayerStatus } from '../PlayerAdapter';

const DURATION_MS = 214_000;

function subscribed(player: FakePlayer) {
  const received: PlayerStatus[] = [];
  const unsubscribe = player.subscribe((status) => received.push(status));
  return { received, unsubscribe };
}

describe('FakePlayer', () => {
  it('records adapter calls in order', async () => {
    const player = new FakePlayer({ durationMs: DURATION_MS });
    player.load(7);
    await player.seekTo(41_000);
    player.play();
    player.pause();

    expect(player.calls).toEqual(['load', 'seekTo', 'play', 'pause']);
    expect(player.source).toBe(7);
    expect(player.status).toEqual({
      positionMs: 41_000,
      durationMs: DURATION_MS,
      playing: false,
      rate: 1,
    });
  });

  it('load goes back to 0 and keeps the playing state', async () => {
    const player = new FakePlayer({ durationMs: DURATION_MS });
    player.load(1);
    await player.seekTo(30_000);
    player.play();
    player.load(2);

    expect(player.source).toBe(2);
    expect(player.status.positionMs).toBe(0);
    expect(player.status.playing).toBe(true);
  });

  it('advance moves the position only while playing, then emits', () => {
    const player = new FakePlayer({ durationMs: DURATION_MS });
    const { received } = subscribed(player);

    player.advance(1_000);
    expect(player.status.positionMs).toBe(0);

    player.play();
    player.advance(1_000);
    player.advance(250);
    expect(player.status.positionMs).toBe(1_250);

    expect(received.map((s) => [s.positionMs, s.playing])).toEqual([
      [0, false],
      [1_000, true],
      [1_250, true],
    ]);
  });

  it('advance respects the playback rate', () => {
    const player = new FakePlayer({ durationMs: DURATION_MS });
    player.setRate(1.5);
    player.play();
    player.advance(1_000);

    expect(player.status).toEqual(
      expect.objectContaining({ positionMs: 1_500, rate: 1.5 }),
    );
  });

  it('advance stops at the duration', () => {
    const player = new FakePlayer({ durationMs: 2_000 });
    player.play();
    player.advance(1_500);
    player.advance(1_500);

    expect(player.status.positionMs).toBe(2_000);
  });

  it('emit delivers the current status merged with the sample, without keeping it', async () => {
    const player = new FakePlayer({ durationMs: DURATION_MS });
    const { received } = subscribed(player);
    await player.seekTo(41_000);
    player.play();

    player.emit();
    player.emit({ positionMs: 30_000, durationMs: 0 });

    expect(received).toEqual([
      { positionMs: 41_000, durationMs: DURATION_MS, playing: true, rate: 1 },
      { positionMs: 30_000, durationMs: 0, playing: true, rate: 1 },
    ]);
    expect(player.status.positionMs).toBe(41_000);
  });

  it('delivers to every subscriber until it unsubscribes', () => {
    const player = new FakePlayer();
    const a = subscribed(player);
    const b = subscribed(player);

    player.emit();
    a.unsubscribe();
    player.emit();

    expect(a.received).toHaveLength(1);
    expect(b.received).toHaveLength(2);
  });

  it('seekTo clamps to [0, duration] and resolves', async () => {
    const player = new FakePlayer({ durationMs: DURATION_MS });

    await expect(player.seekTo(999_999_999)).resolves.toBeUndefined();
    expect(player.status.positionMs).toBe(DURATION_MS);

    await player.seekTo(-5);
    expect(player.status.positionMs).toBe(0);
  });

  it('does not cap positions when the duration is unknown', async () => {
    const player = new FakePlayer();
    await player.seekTo(41_000);
    player.play();
    player.advance(1_000);

    expect(player.status.positionMs).toBe(42_000);
  });

  it('release stops delivery and makes later calls inert', async () => {
    const player = new FakePlayer({ durationMs: DURATION_MS });
    const before = subscribed(player);
    player.load(1);
    player.play();
    player.release();

    const after = subscribed(player);
    player.load(2);
    player.play();
    await player.seekTo(41_000);
    player.advance(1_000);
    player.emit();

    expect(before.received).toEqual([]);
    expect(after.received).toEqual([]);
    expect(player.source).toBe(1);
    expect(player.status).toEqual(
      expect.objectContaining({ positionMs: 0, playing: false }),
    );
    expect(player.calls).toEqual([
      'subscribe',
      'load',
      'play',
      'release',
      'subscribe',
      'load',
      'play',
      'seekTo',
    ]);
  });
});
