# Design

## Context

See proposal.md for the motivation and specs/ for the required behaviour.

Current state that shapes the approach:

- Expo SDK 54, React Native 0.81.5 with the New Architecture (bridgeless), React Compiler on, Reanimated 4.1.7 and react-native-worklets 0.5.1 already installed and in the debug APK. Expo SDK 54 bundles `expo-audio ~1.1.1`. No audio module is in the APK today, so this change needs a rebuild.
- `app/_layout.tsx` is a plain Stack with no auth guard, so a new `player` route is reachable by deep link (`reactnativeuitest` scheme, MainActivity is `singleTask`). A deep link to the focused route updates its params in place (React Navigation's StackRouter), so an identical link produces identical params.
- The harness: Jest (jest-expo) with manual mocks in `__mocks__/` (see `react-native-mmkv.ts`), RNTL, Appium 3 + WDIO 9 page objects with `byTestId()` mapping testIDs to resource-ids, one screenshot per test, and a Layer 6 pixel diff over every screenshot in `automation_test/screenshots/`.
- The user's test device is a Genymotion emulator (570x1230). The committed Layer 6 baselines are Pixel 9a (1080x2349), so they cannot be compared on it. A full device run costs about 30 s per test.
- Never run the Expo web target in this repo.

Research behind these decisions (library sources, LRCLIB probes, licence checks) was done in the explore session on 2026-10-17. A review pass then checked the artifacts against the installed sources. The key facts are restated where a decision depends on them.

## Goals / Non-Goals

**Goals:**
- Keep the lyric highlight and auto-scroll on the UI thread, so a busy JS thread cannot make them stutter.
- Make every spec scenario checkable without real-time audio assumptions: a pure, property-tested core, and deterministic device tests driven by deep links.
- Keep the playback library swappable (expo-audio now; nitro-player or an SDK upgrade later) without touching the UI.

**Non-Goals:**
- No worklet worker runtime, WorkManager or Headless JS. At this scale they add cost and no user-visible smoothness: an LRC file parses in under 2 ms, and a worker runtime on worklets 0.5.1 cannot use `fetch` or imports and throws under jest-expo.
- No progress bar in this change, only the `m:ss` time label. A per-frame progress bar would also keep UiAutomator2's idle detection from ever settling.
- No pixel baselines for the player in this change (see Decision 9).
- No change to the auth flow, its tests or its baselines.

## Decisions

### 1. Threads: what runs where

```
 +---------------------------+  status every 250 ms   +-----------------------------+
 | JS thread                 | ---------------------> | UI thread (Reanimated)      |
 |  screen, params, catalog  |  anchor shared value   |  useFrameCallback: position |
 |  status listener: writes  |  {pos, playing, rate,  |  useDerivedValue: line idx  |
 |   shared values only      |   seq, epoch}          |  useAnimatedStyle: highlight|
 |  a11y selected index      | <--------------------- |  scrollTo: auto-scroll      |
 +-------------^-------------+  scheduleOnRN(idx),    +-----------------------------+
               | events          only when it changes
 +-------------+--------------------------------------------+
 | Native: ExoPlayer playback thread (decode, output),      |
 | expo-audio status coroutine, image and network pools     |
 +----------------------------------------------------------+
```

- Never read `player.currentTime` from JS on a timer. In expo-audio 1.1.1 on Android it is `runBlocking` on the main queue, which would tie the JS thread to the UI thread.
- The status listener writes only shared values, never React state. The one exception is the time label, which updates its state only when the displayed second changes.
- The per-frame clock lives in a small leaf component that does not re-render on status ticks. It is marked `'use no memo'`, because React Compiler strips a manual `useCallback` around a worklet that captures a shared value, which would re-register `useFrameCallback` on every render. Shared values are never read during render.

Alternatives considered: deriving the line only from the 250 ms status events (up to one interval of lag); a worker runtime for parsing (no benefit, see Non-Goals).

### 2. Playback library: expo-audio ~1.1.1 behind `PlayerAdapter`

`lib/player/PlayerAdapter.ts` defines `load(track)`, `play()`, `pause()`, `seekTo(ms)`, `subscribe(listener)` and `release()`. Its status sample is `{positionMs, durationMs, playing, rate}`.

`ExpoAudioPlayer.ts` is the only file that imports `expo-audio`:
- It creates one player with `createAudioPlayer(source, { updateInterval: 250 })`.
- It switches tracks with `replace()`, seeks exactly with `seekTo(seconds, 0, 0)`, and forwards `playbackStatusUpdate` events.
- `release()` pauses the player, removes all subscriptions, then calls `remove()` and `release()` on it. In expo-audio 1.1.1 on Android, `remove()` only drops the player from the module's map. It is the SharedObject `release()` that frees the ExoPlayer, so without it audio would keep playing after unmount or a Fast Refresh.

`FakePlayer.ts` implements the same interface for Jest with an explicit `advance(ms)` and `emit(sample)` API.

Alternatives considered:
- **react-native-nitro-player 1.6.1:** the best feature fit (queue, gapless, notification next/prev, becoming-noisy), but it has never been compiled against RN 0.81.5. Kept for a separate spike before the background/queue change.
- **@rntp/player 5.x:** any use beyond personal or educational needs a commercial licence.
- **react-native-track-player 4.1.2:** legacy ExoPlayer, and its events very likely drop under bridgeless.
- **Upgrading Expo first:** SDK 55 adds first-party playlists, but the upgrade re-renders every baseline. It is a separate change.

### 3. Position clock: anchor, action epoch and a position that never runs backward

- **Anchor from status samples.** Each status sample sets the anchor shared value to `{posMs, playing, rate, seq: seq + 1, epoch}`. On the next frame, the UI-thread frame callback sees the new `seq` and stamps it with `frame.timestamp`.
- **Extrapolation.** `extrapolate(anchor, now, durationMs)` returns `clamp(posMs + (now - stampedAt) * rate * (playing ? 1 : 0), 0, durationMs)`. The `durationMs` used is always the catalog entry's. expo-audio reports a duration of 0 until the media is prepared, so status durations are never used for the clamp.
- **User actions.** Seek, play, pause and track change bump an action `epoch` and set the anchor immediately, so the highlight jumps at once. Status samples that arrive after an action but before its `seekTo` promise resolves are ignored. This stops a pre-seek sample (for example the first status at 0:00 after `replace()`) from overriding the requested position.
- **Monotonic displayed position.** While playing, the position used for the line index and scrolling is `displayed = max(lastDisplayed, extrapolate(...))`. `lastDisplayed` resets only when the epoch changes. A burst of stale samples (for example the ones queued during the `stall`, each carrying an old position) therefore holds the highlight still until the audio catches up, and never moves it backward.

`extrapolate` and the monotonic step live in `lib/lyrics/clock.ts`, marked `'worklet'`, so Jest and the UI thread run the same code.

### 4. Lyrics core (pure, in `lib/lyrics/`)

- **`parseLrc(text)`** returns `{lines: {timeMs, text}[], endMs: number | null}`. It:
  - accepts `[mm:ss]`, `[mm:ss.x]`, `[mm:ss.xx]` and `[mm:ss.xxx]`;
  - expands several timestamps on one line into separate lines;
  - applies `[offset:±ms]`;
  - ignores metadata tags and lines without a timestamp;
  - strips enhanced word tags (`<mm:ss.xx>`);
  - sorts the result stably by time.
  
  An empty-text timestamp line is not a row. The last one at or after the last row becomes `endMs`, which gives the spec's "end marker" (`dcye` ends at 3:15.85). An empty marker in the middle of a song is ignored in this change, so the line before it stays active until the next row. `ParsedLyrics` has no way to express a gap, and neither bundled song has one; the catalog integrity test asserts that. Gap support belongs with the LRCLIB enrichment change, whose lyrics can contain mid-song markers. The parser never throws.
- **`activeLineIndex(times, positionMs, endMs)`** is a binary search. It returns -1 before the first line or at or after `endMs`. It is marked `'worklet'`.
- Parsed lyrics are memoised per track id the first time they are read, synchronously. The cost is sub-millisecond, so it happens during the first render and there is no loading state.

### 5. Catalog and lyrics storage

- `lib/music/catalog.ts` exports a typed array, keyed by id (`dcye`, `letting-go`, `tone`). Each entry has: `title`, `artist`, `durationMs`, the `audio` asset (`require('../../assets/music/<id>.m4a')`), `lrc` (string or null), `license`, `licenseUrl`, `attribution`, `changes` ("transcoded to AAC"), `sourceUrl`, `pageUrl` (the song's web page), `lyricsSource` (for example `"lrclib:10481837"`), and `lrcCheckedByEar`.
- The LRC text lives in `lib/music/lyrics/<id>.ts` as an exported template string. This keeps it reviewable, needs no Metro transformer, and puts it in the bundle synchronously.

Alternatives considered: `.lrc` asset files read through expo-asset and the file system (asynchronous, so it brings back a loading state); a Metro `sourceExts` transformer for `.lrc` (custom build configuration for three files).

Lyrics content:
- **`dcye`:** LRCLIB record 10481837 (40 timestamps: 39 rows plus the end marker at 3:15.85; monotonic; no gaps under 0.6 s; CC BY lyrics).
- **`letting-go`:** LRCLIB 10481859, with its literal "(Chorus)" marker at 2:16.57 expanded from the official lyrics page. The repeated chorus is timed by reusing the first chorus's line offsets from 2:16.57.
- **`tone`:** no lyrics.

Both lyric tracks keep `lrcCheckedByEar: false` until the user listens on the device (see tasks).

### 6. Audio assets

`scripts/build-music-assets.mjs` produces the M4A files in `assets/music/`:
- It downloads the two CC BY MP3s from joshwoodward.com with a browser-like User-Agent. The site is behind Cloudflare, which returns 403 to curl's default User-Agent.
- It transcodes them with the repo's `ffmpeg-static` to AAC-LC 128 kbps M4A (`-c:a aac -b:a 128k -movflags +faststart`).
- It generates `tone.m4a` (20 s, 440 Hz) with ffmpeg's `sine` source.
- It prints each file's size, duration and sha256.

M4A is used because Media3 calls seeking in VBR MP3 imprecise, which would make the lyrics drift after a seek. The committed audio adds about 7 MB. AAC encoder priming (about 50 ms) is compensated by the MP4 edit list, which ExoPlayer honours.

### 7. Route, parameters, re-applying links, and the stall switch

- `app/player.tsx` reads `track`, `at`, `paused` and `stall` with `useLocalSearchParams`. `app/_layout.tsx` registers `<Stack.Screen name="player" options={{ title: 'Now Playing' }} />`.
- **Re-applying links.** An identical link leaves the params unchanged, so the screen does not key its apply effect on param values alone. It also subscribes to expo-linking's `addEventListener('url')`, which fires for every incoming link, and bumps an apply counter. The effect runs on the first mount and whenever the counter or a parameter changes. It calls `load` (if the track changed), then `seekTo(at)`, then `play()` or `pause()`, and starts a new action epoch.
- **Validation.** `lib/player/params.ts` (pure, unit-tested) validates the parameters. It falls back to the first track for an unknown id, and to 0 for an `at` that is not finite, is negative, or is past the catalog `durationMs`. Values arrive as strings.
- **Selected state on apply.** On the first render and on every apply, the screen computes the selected line index synchronously on the JS side from the requested position, using the same `activeLineIndex`. A paused deep link or a track switch is therefore correct in the same render, without waiting for the UI-thread chain.
- **Stall.** `stall` is honoured only when `__DEV__` and is capped at 10000 ms. It fires once, on the first `playing` status whose position is at least `at - 250` ms after the apply's seek resolves, as a busy-wait on the JS thread. This keeps a stale status from an earlier state from starting it early.

### 8. Lyrics view

- An `Animated.ScrollView` rather than a FlatList, because there are at most about 40 rows and virtualisation would hide rows from Appium. Its top and bottom padding equal half of the measured view height, so the first and last lines can be centred.
- **Offsets.** Every row's `onLayout` writes its offset into a shared array and bumps an `offsetsVersion` shared value. The view's own `onLayout` updates `viewHeight`. Offsets are never collected only once, because the half-height padding arrives after the first layout.
- **Scrolling.** `useAnimatedReaction` watches `[lineIndex, offsetsVersion, viewHeight]` and calls `scrollTo(ref, 0, rowCentre - viewHeight / 2, animated)`. It therefore scrolls again when measurements arrive after a paused open. The target is:
  - for index -1 before the first line, row 0;
  - for index -1 at or after `endMs`, the last row;
  - otherwise, the active row.
  
  A track change resets the scroll to row 0 without animation before the new rows lay out.
- **User scrolls.** Auto-scroll is suppressed while a drag or momentum scroll is active, which `useAnimatedScrollHandler` tracks through `onBeginDrag`, `onEndDrag`, `onMomentumBegin` and `onMomentumEnd`. It resumes at the next index change after the scroll rests.
- **Rows.** Each row has `testID="lyrics-line-<i>"` and `accessibilityState={{ selected }}`, and its own `useAnimatedStyle` (colour, opacity, scale; never font size or height). `selected` is React state. It is set synchronously on apply (Decision 7) and then updated by `scheduleOnRN` only when the UI-thread index changes. React Native maps `selected` to `View.setSelected`, which UiAutomator2 reports as `@selected` and TalkBack announces.

**Tap to jump.** Each row is a Pressable (`accessibilityRole="button"`, with an accessibility hint that it jumps there), so a drag or fling of the ScrollView does not fire it. A tap goes through the same path as an apply:
- start a new action epoch, then set the anchor to the line's time plus 50 ms;
- set the selected index and time label synchronously;
- ignore status samples until `seekTo` resolves;
- keep the current playing state.

The 50 ms lands the position inside the line even if the native seek or the status rounding comes back a few milliseconds early. The index change clears the user-scrolled flag, so the tapped line is brought to the centre.

Other testIDs: `player-screen`, `player-title`, `player-artist`, `player-time`, `player-toggle`, `player-credit`, `lyrics-view`, `lyrics-empty`.

**Credits panel.** `player-credit` is a Pressable that opens an inline overlay panel (`credits-panel`). It is an absolutely positioned View rather than an RN `Modal`, so it stays in the screen's view tree for RNTL and Appium. The panel shows:
- the full `attribution`;
- the licence address (`credits-license-link`) and the song page (`credits-page-link`), each opened with `Linking.openURL`;
- a close button (`credits-close`).

The catalog gains a `pageUrl` field (`string | null`; null for the generated tone) so the song page is not parsed out of `attribution`. The tone's panel shows its attribution with no links.

### 9. Harness and verification

- **Unit (Jest + fast-check 4.x devDependency):**
  - `parseLrc`: never throws on any string; output sorted; format then parse round-trips; offsets apply; multiple timestamps expand.
  - `activeLineIndex`: agrees with a linear-scan oracle; never decreases as position grows.
  - Clock: never decreases while playing; constant while paused; clamped to the catalog duration; a stale sample behind the displayed position does not decrease it within one epoch; a new epoch can move it back.
  - `params`: table of valid and invalid inputs.
  - A catalog integrity test: every lyric track parses to more than one line with monotonic times inside its duration; every track has licence fields.
- **RNTL:**
  - Tests run on **real timers**. `jest.useFakeTimers()` breaks Reanimated's `useFrameCallback` under jest-expo.
  - Assertions that depend on the UI-thread chain use `await waitFor(...)`. Paused applies are checked synchronously, since the selected index is computed on the JS side.
  - `jest.setup.ts` calls Reanimated's `setUpTests()`, and `__mocks__/expo-audio.ts` stubs `createAudioPlayer` (including `remove` and `release`). jest-expo's own ExpoAudio mock has no `AudioPlayer` class.
- **Appium (`automation_test/specs/player.e2e.ts`, `screens/PlayerScreen.ts`):**
  - **Cold start.** `open(params)` cold-starts the app (`terminateApp`, then `mobile: deepLink` with `waitForLaunch`), so every test begins from a known state and the URL is the launch intent. In-app deep links are sent only in the scenarios that say "receives ... while open".
  - **No idle-waiting.** The spec's `before()` sets `driver.updateSettings({ waitForIdleTimeout: 0 })` and `after()` restores 10000. Otherwise UiAutomator2 waits for the playing screen to go idle before every lookup. Without idle-waiting, every tap and deep link is followed by an explicit `waitForDisplayed` or `waitUntil`.
  - **Single-snapshot reads.** `snapshot()` reads one page source and returns each row's bounds and `selected` flag plus the `lyrics-view` bounds. `closestRowToCentre()` and `selectedLine()` work from that one reading, which is what makes the stall check possible: line 7 is the row closest to the centre while line 6 is still selected.
  - **Timing windows.** Play-from tests open paused at 35.0 s and start timing at the Play tap. That leaves 2.2 s of line 5, and the 12 s run ends at about 47 s, before line 8 at 48.85 s. Polls run about every 300 ms.
  - **Size.** About 13 tests, roughly 7 minutes on Genymotion including cold starts.
- **Dropped frames:** the stall test cold-starts, resets `dumpsys gfxinfo <pkg>` before the deep link, and dumps it after the assertions, via `mobile: shell` (which `relaxedSecurity: true` already allows). It is report-only, not a gate, because the numbers come from a debug build on an emulator.
- **Pixel baselines:** player screenshots still get captured and read by the agent, but `isSkippedShot()` in `lib/visual/` excludes them from the Layer 6 diff. Recording player baselines needs a decision on the baseline device (Pixel 9a AVD for the existing set vs. re-baselining everything on Genymotion). That decision is independent of this change's behaviour, so it is deferred rather than baked in.

## Risks / Trade-offs

- [Lyric timing is checked only structurally, not by ear] → Both lyric tracks ship with `lrcCheckedByEar: false`. A task asks the user to listen on the device. The device tests use paused positions at least 1 s inside a line's window, and play-from runs that leave at least 2.2 s of the first observed line.
- [Genymotion may have no audio output, or the position may not advance] → The first device task checks that the position advances while playing and that `dumpsys audio` shows the player started, before writing the timed tests.
- [Cold-start deep links and in-app deep links into the `singleTask` activity are unverified on API 35] → Checked in the first device task, including an identical link sent twice.
- [The UiAutomator2 lookup cost with idle-waiting off] → Measured on Genymotion, 2026-10-17: one `getPageSource()` on the playing screen takes about 0.3–0.5 s with `waitForIdleTimeout: 0`, so the ~300 ms poll interval effectively becomes one reading every 0.35–0.5 s. With idle-waiting on, reads stall: `adb shell uiautomator dump` fails with "could not get idle state" while a track plays, and then leaves the previous dump file in place, which looks like a frozen UI.
- [Genymotion's audio clock does not run at real time] → Measured on 2026-10-17: the player's own position advanced 1.1–1.9× faster than the wall clock (for example 22 s of song in 11.9 s). The app shows the player's position correctly; the emulated audio output is the cause. Device tests therefore assert wall-clock timing only as a lower bound (never slower than real time). The exact "label equals position" checks run in RNTL against `FakePlayer`. Timing checks on a real phone or the Pixel 9a AVD can use the full ±1 s bound.
- [A link that opens the browser races the test] → Opening the licence link launches the browser in its own task. The test waits for the browser to finish opening, then returns with Back as a user would. Calling `activateApp` while the browser is still starting lets the browser come back on top.
- [expo-audio 1.1.1's library manifest merges RECORD_AUDIO even with `recordAudioAndroid: false`] → No runtime request is made, so no dialog appears in tests. Noted for the store-readiness change.
- [The per-frame clock under React Compiler] → Isolated leaf component plus `'use no memo'`. If re-registration still shows, fall back to a `useAnimatedReaction` on the anchor that extrapolates on each status sample.
- [Performance numbers from a debug build on an emulator are not representative] → Report-only. Gating waits for a release-build baseline over about 10 runs.
- [About 7 MB of audio committed to git] → Acceptable for a demo catalog. The build script can regenerate the files from source URLs if they are ever moved to LFS.
- [Moving UI makes screenshots unstable] → Excluded from Layer 6 (Decision 9). Content is asserted in Appium instead.

## Migration Plan

1. Implementation happens on a branch or worktree, not on `main`. `openspec/` is untracked on `main`, so a new worktree starts without it. The change folder must be brought into the implementation directory (see tasks 1.1).
2. `npx expo install expo-audio`, add `["expo-audio", { "recordAudioAndroid": false }]` to `app.json` plugins, then `npx expo prebuild --clean -p android` (android/ is gitignored, and `run:android` only prebuilds when it is missing), then `npx expo run:android`. Then install on the user's Genymotion device.
3. Rollback: remove the `player` route, the `expo-audio` dependency and plugin, and `assets/music/`; then prebuild and rebuild again. The auth flow is untouched throughout.

## Open Questions

- Which device records future player pixel baselines (deferred; see Decision 9).
- Whether to keep "I'm Letting Go" as the second track after the user listens, or replace it with another CC BY track. This only changes catalog data.
- Whether `updateInterval: 250` costs measurable battery or main-thread time compared with 500 ms. Tune after the first device run; no behaviour change.
