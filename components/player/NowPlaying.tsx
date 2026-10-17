import { useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { activeLineIndex } from '@/lib/lyrics/activeLine';
import { nextDisplayed, type Anchor, type Displayed } from '@/lib/lyrics/clock';
import { CATALOG, creditLine, getTrack, lyricsFor, timesFor, type Track } from '@/lib/music/catalog';
import { createPlayer } from '@/lib/player/createPlayer';
import type { PlayerParams } from '@/lib/player/params';
import type { PlayerAdapter } from '@/lib/player/PlayerAdapter';
import { busyWait, shouldStartStall } from '@/lib/player/stall';

import { CreditsPanel } from './CreditsPanel';
import { LyricsView } from './LyricsView';

/**
 * After a play or pause, a status whose `playing` flag disagrees with it is
 * treated as one sent before the player acted on it, for at most this long.
 */
const CONFIRM_WINDOW_MS = 1000;

/**
 * A tapped line plays from this far past its timestamp, so the position is
 * inside the line even if the native seek or the status rounding lands a few
 * milliseconds early.
 */
const LINE_JUMP_LEAD_MS = 50;

interface NowPlayingProps {
  params: PlayerParams;
  /** Goes up on every incoming deep link, so an identical link re-applies. */
  applyKey: number;
}

/** What the screen shows for one apply; `applyId` names the apply it belongs to. */
type Shown = { applyId: string; index: number; second: number; playing: boolean };

/** The latest apply of the deep-link parameters. */
type Apply = { atMs: number; stallMs: number | null; seekResolved: boolean; stalled: boolean };

/**
 * The latest user action (apply, line tap, play or pause) and the playing
 * state it asked for. `pausedAtMs` is the position a user Pause showed at the
 * tap, which the screen keeps until the next action; null for other actions.
 */
type Action = {
  epoch: number;
  playing: boolean;
  confirmed: boolean;
  confirmBy: number;
  pausedAtMs: number | null;
};

/** A seek action: the position to show at once and the playing state to keep. */
type Seek = {
  positionMs: number;
  playing: boolean;
  stallMs: number | null;
  /** Shown along with the position, such as the selected line. */
  patch: Partial<Shown>;
  /** A track to load first, under the new action. */
  source?: number;
};

const trackFor = (id: string): Track => getTrack(id) ?? CATALOG[0];

const lineAt = (track: Track, positionMs: number): number =>
  activeLineIndex(timesFor(track), positionMs, lyricsFor(track)?.endMs ?? null);

/**
 * Updates what the screen shows only when something changed, so idle status
 * samples and repeated line indexes cause no React update. `ref` mirrors the
 * last value set.
 */
function show(ref: RefObject<Shown>, setLive: (shown: Shown) => void, patch: Partial<Shown>) {
  const prev = ref.current;
  const next = { ...prev, ...patch };
  if (
    next.applyId === prev.applyId &&
    next.index === prev.index &&
    next.second === prev.second &&
    next.playing === prev.playing
  ) {
    return;
  }
  ref.current = next;
  setLive(next);
}

/** `m:ss` from whole seconds. */
const formatTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * The Now Playing screen for already validated deep-link parameters. It owns
 * one player for its lifetime and applies the parameters on mount, on any
 * change, and whenever `applyKey` goes up.
 *
 * Playback state reaches the lyrics through the `anchor` shared value, never
 * through per-tick React state; React state changes only for the time label's
 * second, the Play/Pause label and the selected line.
 */
export function NowPlaying({ params, applyKey }: NowPlayingProps) {
  const { atMs, paused, stallMs } = params;
  const track = trackFor(params.trackId);
  const trackId = track.id;
  const lyrics = lyricsFor(track);

  // Values for the current apply, computed during render so a paused deep link
  // or a track switch is right in the same render as the new parameters.
  const applyId = `${applyKey}:${trackId}:${atMs}:${paused ? 1 : 0}:${stallMs ?? ''}`;
  const applied: Shown = {
    applyId,
    index: lineAt(track, atMs),
    second: Math.floor(atMs / 1000),
    playing: !paused,
  };
  const [live, setLive] = useState<Shown>(applied);
  const shownRef = useRef<Shown>(applied);
  const shown = live.applyId === applyId ? live : applied;
  const [creditsOpen, setCreditsOpen] = useState(false);

  const anchor = useSharedValue<Anchor>({
    posMs: atMs,
    playing: false,
    rate: 1,
    seq: 0,
    epoch: 0,
    stampedAt: null,
  });
  const displayed = useSharedValue<Displayed>({ positionMs: atMs, epoch: 0 });

  const playerRef = useRef<PlayerAdapter | null>(null);
  const loadedRef = useRef<string | null>(null);
  const epochRef = useRef(0);
  const seqRef = useRef(0);
  const applyRef = useRef<Apply | null>(null);
  const actionRef = useRef<Action>({
    epoch: 0,
    playing: false,
    confirmed: true,
    confirmBy: 0,
    pausedAtMs: null,
  });
  /** The time label's position: like `displayed`, it never moves back within an epoch. */
  const labelRef = useRef<Displayed>({ positionMs: atMs, epoch: 0 });
  const durationRef = useRef(track.durationMs);

  // Declared before the apply effect, so the player exists when that runs.
  useEffect(() => {
    const player = createPlayer();
    playerRef.current = player;
    loadedRef.current = null;

    const unsubscribe = player.subscribe((status) => {
      const apply = applyRef.current;
      const action = actionRef.current;
      // Samples sent before the apply's seek lands (such as the 0:00 one after
      // a track load) would override the requested position.
      if (apply === null || !apply.seekResolved) return;
      if (!action.confirmed) {
        if (status.playing !== action.playing && performance.now() < action.confirmBy) return;
        action.confirmed = true;
      }

      // After a user Pause, a paused sample may change only the playing flag:
      // the screen keeps the position it showed at the tap.
      const posMs =
        action.pausedAtMs !== null && !status.playing ? action.pausedAtMs : status.positionMs;
      seqRef.current += 1;
      const next: Anchor = {
        posMs,
        playing: status.playing,
        rate: status.rate,
        seq: seqRef.current,
        epoch: action.epoch,
        stampedAt: null,
      };
      anchor.set(next);

      const label = nextDisplayed(labelRef.current, next, 0, durationRef.current);
      labelRef.current = label;
      show(shownRef, setLive, {
        second: Math.floor(label.positionMs / 1000),
        playing: status.playing,
      });

      if (
        shouldStartStall({
          status,
          atMs: apply.atMs,
          stallMs: apply.stallMs,
          seekResolved: apply.seekResolved,
          alreadyStalled: apply.stalled,
        })
      ) {
        apply.stalled = true;
        const ms = apply.stallMs ?? 0;
        // On the next macrotask: the anchor write above reaches the UI thread
        // in a microtask, and must get there before the JS thread blocks.
        setTimeout(() => busyWait(ms), 0);
      }
    });

    return () => {
      unsubscribe();
      player.release();
      playerRef.current = null;
      applyRef.current = null;
    };
  }, [anchor]);

  /**
   * Starts a seek action, the path every deep-link apply and line tap takes: a
   * new epoch, with the anchor, the time label and `patch` shown at once;
   * status samples ignored until the seek lands; then play or pause to keep
   * the requested state. Stable for the screen's lifetime, since it reads only
   * refs and shared values.
   */
  const [startSeek] = useState(
    () =>
      (player: PlayerAdapter, { positionMs, playing, stallMs, patch, source }: Seek) => {
        epochRef.current += 1;
        const epoch = epochRef.current;
        const apply: Apply = { atMs: positionMs, stallMs, seekResolved: false, stalled: false };
        applyRef.current = apply;
        actionRef.current = {
          epoch,
          playing,
          confirmed: false,
          confirmBy: Infinity,
          pausedAtMs: null,
        };
        if (source !== undefined) player.load(source);

        // Jump at once; status samples take over once the seek has landed.
        seqRef.current += 1;
        anchor.set({
          posMs: positionMs,
          playing,
          rate: 1,
          seq: seqRef.current,
          epoch,
          stampedAt: null,
        });
        displayed.set({ positionMs, epoch });
        labelRef.current = { positionMs, epoch };
        show(shownRef, setLive, { ...patch, second: Math.floor(positionMs / 1000), playing });

        player
          .seekTo(positionMs)
          .catch(() => {})
          .then(() => {
            if (applyRef.current !== apply) return;
            apply.seekResolved = true;
            // A tap on Play or Pause during the seek wins over the requested state.
            if (actionRef.current.epoch !== epoch) return;
            actionRef.current.confirmBy = performance.now() + CONFIRM_WINDOW_MS;
            if (playing) player.play();
            else player.pause();
          });
      },
  );

  useEffect(() => {
    const player = playerRef.current;
    if (player === null) return;
    const target = trackFor(trackId);
    durationRef.current = target.durationMs;
    const source = loadedRef.current !== target.id ? target.audio : undefined;
    loadedRef.current = target.id;

    startSeek(player, {
      positionMs: atMs,
      playing: !paused,
      stallMs,
      patch: { applyId, index: lineAt(target, atMs) },
      source,
    });
  }, [startSeek, applyId, trackId, atMs, paused, stallMs]);

  const onToggle = () => {
    const player = playerRef.current;
    if (player === null) return;
    const playing = !shown.playing;
    const current = displayed.get();
    const positionMs =
      current.epoch === epochRef.current ? current.positionMs : labelRef.current.positionMs;

    epochRef.current += 1;
    const epoch = epochRef.current;
    actionRef.current = {
      epoch,
      playing,
      confirmed: false,
      confirmBy: performance.now() + CONFIRM_WINDOW_MS,
      pausedAtMs: playing ? null : positionMs,
    };
    seqRef.current += 1;
    anchor.set({ posMs: positionMs, playing, rate: 1, seq: seqRef.current, epoch, stampedAt: null });
    labelRef.current = { positionMs, epoch };
    // The selected line too: a line index the UI thread sent before this tap
    // carries the old epoch and is dropped, and the UI index may not change
    // again to send it anew.
    show(shownRef, setLive, {
      index: lineAt(track, positionMs),
      second: Math.floor(positionMs / 1000),
      playing,
    });

    if (playing) player.play();
    else player.pause();
  };

  // The lyrics are memoised, so the callbacks they get must keep their
  // identity across renders, or every time-label second would re-render them
  // and set their UI-thread work up again. React Compiler does not memoise
  // closures like these here, so the identity comes from state; they read only
  // refs and stable values.
  const [onActiveIndex] = useState(() => (index: number, epoch: number) => {
    // An index from before the latest action belongs to a position the screen has left.
    if (epoch === epochRef.current) show(shownRef, setLive, { index });
  });

  /** A tap on a lyric line: plays from it, or stays paused there. */
  const [onLinePress] = useState(() => (index: number, lineTimeMs: number) => {
    const player = playerRef.current;
    if (player === null) return;
    startSeek(player, {
      positionMs: lineTimeMs + LINE_JUMP_LEAD_MS,
      playing: shownRef.current.playing,
      stallMs: null,
      patch: { index },
    });
  });

  return (
    <ThemedView testID="player-screen" style={styles.screen}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText testID="player-title" type="subtitle">
            {track.title}
          </ThemedText>
          <ThemedText testID="player-artist" style={styles.artist}>
            {track.artist}
          </ThemedText>
        </View>

        <LyricsView
          key={trackId}
          lyrics={lyrics}
          times={timesFor(track)}
          anchor={anchor}
          displayed={displayed}
          durationMs={track.durationMs}
          selectedIndex={shown.index}
          onActiveIndex={onActiveIndex}
          onLinePress={onLinePress}
        />

        <View style={styles.controls}>
          <View style={styles.transport}>
            <ThemedText testID="player-time" style={styles.time}>
              {formatTime(shown.second)}
            </ThemedText>
            <View style={styles.toggle}>
              <PrimaryButton
                testID="player-toggle"
                title={shown.playing ? 'Pause' : 'Play'}
                onPress={onToggle}
              />
            </View>
          </View>
          <Pressable
            testID="player-credit"
            accessibilityRole="button"
            accessibilityHint="Shows the licence and the song page"
            onPress={() => setCreditsOpen(true)}
            style={styles.credit}>
            <ThemedText style={styles.creditText}>{creditLine(track)}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>

      {creditsOpen ? <CreditsPanel track={track} onClose={() => setCreditsOpen(false)} /> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 2,
  },
  artist: {
    opacity: 0.7,
  },
  controls: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    marginTop: 12,
  },
  toggle: {
    width: 140,
  },
  credit: {
    marginTop: 12,
  },
  creditText: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
  },
});
