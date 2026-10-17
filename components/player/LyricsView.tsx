import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { activeLineIndex } from '@/lib/lyrics/activeLine';
import { nextDisplayed, type Anchor, type Displayed } from '@/lib/lyrics/clock';
import type { ParsedLyrics } from '@/lib/lyrics/parseLrc';

const HIGHLIGHT_MS = 180;
const INACTIVE_OPACITY = 0.45;
const ACTIVE_SCALE = 1.04;

interface LyricsViewProps {
  /** The track's lyrics, or null for a track without any. */
  lyrics: ParsedLyrics | null;
  /**
   * Each line's start time (`timesFor(track)`). It must keep its identity
   * across renders: UI-thread worklets capture it, and Reanimated sets them up
   * again whenever a captured value changes.
   */
  times: readonly number[];
  /** Last known playback state, written by the screen on the JS thread. */
  anchor: SharedValue<Anchor>;
  /** The position the lyrics follow, written every frame by the clock. */
  displayed: SharedValue<Displayed>;
  /** Catalog duration, which clamps the extrapolated position. */
  durationMs: number;
  /** The accessibility-selected row (React state; -1 for none). */
  selectedIndex: number;
  /** Receives each UI-thread line index change, tagged with its action epoch. */
  onActiveIndex: (index: number, epoch: number) => void;
  /** Receives a tap on a line, with that line's start time. */
  onLinePress: (index: number, timeMs: number) => void;
}

/**
 * The lyrics of one track: highlight and auto-scroll run on the UI thread from
 * `displayed`, while `selectedIndex` drives the accessibility state. The parent
 * keys it by track id, so a track change remounts it at row 0 with fresh
 * measurements.
 *
 * Memoised, so the screen's time label ticking every second does not re-render
 * the rows; that holds only while the parent passes props that keep their
 * identity (the callbacks and `times` above).
 */
export const LyricsView = memo(function LyricsView({
  lyrics,
  times,
  anchor,
  displayed,
  durationMs,
  selectedIndex,
  onActiveIndex,
  onLinePress,
}: LyricsViewProps) {
  return (
    <View style={styles.container}>
      <PlaybackClock anchor={anchor} displayed={displayed} durationMs={durationMs} />
      {lyrics === null || lyrics.lines.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText testID="lyrics-empty" style={styles.emptyText}>
            No lyrics for this track
          </ThemedText>
        </View>
      ) : (
        <SyncedLyrics
          lyrics={lyrics}
          times={times}
          displayed={displayed}
          selectedIndex={selectedIndex}
          onActiveIndex={onActiveIndex}
          onLinePress={onLinePress}
        />
      )}
    </View>
  );
});

interface PlaybackClockProps {
  anchor: SharedValue<Anchor>;
  displayed: SharedValue<Displayed>;
  durationMs: number;
}

/**
 * Per-frame position clock on the UI thread. It stamps each new anchor with
 * the frame time it was first seen at, then advances `displayed` (never
 * backward within an epoch). A memoised leaf, so status ticks never re-render
 * it; `'use no memo'` because React Compiler would drop the `useCallback` and
 * re-register the frame callback on every render.
 */
const PlaybackClock = memo(function PlaybackClock({
  anchor,
  displayed,
  durationMs,
}: PlaybackClockProps) {
  'use no memo';
  const onFrame = useCallback(
    (frame: FrameInfo) => {
      'worklet';
      let current = anchor.get();
      if (current.stampedAt === null) {
        current = { ...current, stampedAt: frame.timestamp };
        anchor.set(current);
      }
      const previous = displayed.get();
      const next = nextDisplayed(previous, current, frame.timestamp, durationMs);
      // Writing only on change keeps a paused screen free of UI-thread updates.
      if (next.positionMs !== previous.positionMs || next.epoch !== previous.epoch) {
        displayed.set(next);
      }
    },
    [anchor, displayed, durationMs],
  );
  useFrameCallback(onFrame);
  return null;
});

interface SyncedLyricsProps {
  lyrics: ParsedLyrics;
  times: readonly number[];
  displayed: SharedValue<Displayed>;
  selectedIndex: number;
  onActiveIndex: (index: number, epoch: number) => void;
  onLinePress: (index: number, timeMs: number) => void;
}

function SyncedLyrics({
  lyrics,
  times,
  displayed,
  selectedIndex,
  onActiveIndex,
  onLinePress,
}: SyncedLyricsProps) {
  const { lines, endMs } = lyrics;
  const lastRow = lines.length - 1;
  const activeColor = useThemeColor({}, 'tint');
  const inactiveColor = useThemeColor({}, 'text');

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  /** Each row's vertical centre in content coordinates, by row index. */
  const centres = useSharedValue<number[]>([]);
  const centresVersion = useSharedValue(0);
  const viewHeight = useSharedValue(0);
  /** A user drag, or the fling that follows it, is in progress. */
  const userScrolling = useSharedValue(false);
  /** The user moved the lyrics since the last line change or tap. */
  const userScrolled = useSharedValue(false);
  /** The last tapped row, and a count of taps, so that every tap re-centres. */
  const tapped = useSharedValue({ row: -1, count: 0 });
  // Half the view height above and below the rows, so the first and last rows
  // can be centred too.
  const [padding, setPadding] = useState(0);

  const activeIndex = useDerivedValue(() =>
    activeLineIndex(times, displayed.get().positionMs, endMs),
  );
  // The row to centre: the active one, else row 0 before the lyrics or the
  // last row once they have ended.
  const scrollRow = useDerivedValue(() => {
    const index = activeIndex.get();
    if (index >= 0) return index;
    return endMs !== null && displayed.get().positionMs >= endMs ? lastRow : 0;
  });

  useAnimatedReaction(
    () => activeIndex.get(),
    (index, previous) => {
      if (index !== previous) scheduleOnRN(onActiveIndex, index, displayed.get().epoch);
    },
  );

  useAnimatedReaction(
    () => ({
      index: activeIndex.get(),
      row: scrollRow.get(),
      version: centresVersion.get(),
      height: viewHeight.get(),
      tap: tapped.get(),
    }),
    (current, previous) => {
      if (userScrolling.get()) return;
      const lineChanged =
        previous !== null && (current.index !== previous.index || current.row !== previous.row);
      // A tap brings its line to the centre even when that line was already
      // the active one, so the index did not change.
      const tap = previous !== null && current.tap.count !== previous.tap.count;
      if (lineChanged || tap) {
        userScrolled.set(false);
      } else if (userScrolled.get()) {
        // A re-measure after the user scrolled must not snap the lyrics back;
        // only the next line change resumes auto-scroll.
        return;
      }
      const centre = centres.get()[tap ? current.tap.row : current.row];
      if (current.height <= 0 || centre === undefined) return;
      scrollTo(scrollRef, 0, Math.max(0, centre - current.height / 2), lineChanged || tap);
    },
  );

  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => {
      userScrolling.set(true);
      userScrolled.set(true);
    },
    onEndDrag: () => {
      userScrolling.set(false);
    },
    onMomentumBegin: () => {
      // Only a fling the user started; a programmatic animated scroll can
      // report momentum too.
      if (userScrolled.get()) userScrolling.set(true);
    },
    onMomentumEnd: () => {
      userScrolling.set(false);
    },
  });

  const onViewLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setPadding(height / 2);
    viewHeight.set(height);
  };

  // The tap's seek moves the active line; the tap count makes the scroll
  // reaction centre the row even if it was already the active one.
  const onRowPress = (index: number) => {
    onLinePress(index, lines[index].timeMs);
    scheduleOnUI(() => {
      'worklet';
      tapped.set({ row: index, count: tapped.get().count + 1 });
    });
  };

  const onRowLayout = (index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    scheduleOnUI(() => {
      'worklet';
      const next = centres.get().slice();
      next[index] = y + height / 2;
      centres.set(next);
      centresVersion.set(centresVersion.get() + 1);
    });
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      testID="lyrics-view"
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingVertical: padding }]}
      onLayout={onViewLayout}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}>
      {lines.map((line, index) => (
        <LyricRow
          // Rows never reorder within a track, and a track change remounts the view.
          key={index}
          index={index}
          text={line.text}
          selected={index === selectedIndex}
          activeIndex={activeIndex}
          activeColor={activeColor}
          inactiveColor={inactiveColor}
          onRowLayout={onRowLayout}
          onPress={onRowPress}
        />
      ))}
    </Animated.ScrollView>
  );
}

interface LyricRowProps {
  index: number;
  text: string;
  selected: boolean;
  activeIndex: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
  onRowLayout: (index: number, event: LayoutChangeEvent) => void;
  onPress: (index: number) => void;
}

/**
 * One line: a button that jumps playback to it. Being a Pressable inside the
 * ScrollView, a drag or fling that starts on it scrolls instead of pressing.
 */
function LyricRow({
  index,
  text,
  selected,
  activeIndex,
  activeColor,
  inactiveColor,
  onRowLayout,
  onPress,
}: LyricRowProps) {
  // Colour, opacity and scale only: never anything that changes the layout.
  const highlight = useAnimatedStyle(() => {
    const active = activeIndex.get() === index;
    const timing = { duration: HIGHLIGHT_MS };
    return {
      color: withTiming(active ? activeColor : inactiveColor, timing),
      opacity: withTiming(active ? 1 : INACTIVE_OPACITY, timing),
      transform: [{ scale: withTiming(active ? ACTIVE_SCALE : 1, timing) }],
    };
  });

  return (
    <Pressable
      testID={`lyrics-line-${index}`}
      accessibilityRole="button"
      accessibilityHint="Jumps to this line"
      accessibilityState={{ selected }}
      onLayout={(event) => onRowLayout(index, event)}
      onPress={() => onPress(index)}>
      <Animated.Text style={[styles.line, highlight]}>{text}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    opacity: 0.7,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  line: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
