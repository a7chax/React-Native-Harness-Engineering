# Proposal

## Why

The app only has a mock auth flow, and the user wants a music player that shows lyrics in time with the song and feels smooth: no spinners, no stutter. This first slice proves the core experience on a real device. A bundled song plays, and its lyrics follow along, with the highlight running on the UI thread so a busy JavaScript thread cannot make it stutter. It also gives the harness its first time-based, stateful screen to verify.

## What Changes

- Add a **Now Playing** screen (new route, reached by the deep link `reactnativeuitest://player`) that plays one bundled track at a time, with play/pause, a time label and a scrolling lyrics view.
- Bundle a small, legally reusable catalog: two Josh Woodward songs (CC BY 4.0), transcoded to AAC/M4A so seeking is exact, plus a generated tone track with no lyrics. Each track ships with a catalog entry (title, artist, license, attribution, source, lyrics source) and, where applicable, its lyrics in LRC format, compiled into the JavaScript bundle so they are available synchronously.
- Highlight exactly one active lyric line from the playback position, keep it in the middle band of the lyrics view, and drive the highlight and auto-scroll from Reanimated shared values on the UI thread.
- Let the user tap any lyric line to jump the song to it, keeping play or pause as it was.
- Show lyrics on the first render, with no loading state, including when switching tracks; show a clear "No lyrics for this track" state when a track has none.
- Show the CC BY attribution, including the "transcoded to AAC" note, on the Now Playing screen. Tapping it opens a credits panel with the license link and the original song page, as CC BY 4.0 asks.
- Accept deep-link parameters for a track, a start position and a paused state, so the device tests are deterministic. Validate them and ignore invalid values. A debug-only `stall` parameter blocks the JS thread to prove the highlight keeps moving.
- Add `expo-audio` (~1.1.1, the version Expo SDK 54 bundles) behind a `PlayerAdapter` interface, so the playback library can be swapped later without touching the UI. This adds a native module and **requires an APK rebuild** (`npx expo prebuild --clean -p android`, then `npx expo run:android`).
- Harness additions: a pure lyrics core (`parseLrc`, `activeLineIndex`, position extrapolation) with fast-check property tests; a manual Jest mock for `expo-audio`; an Appium page object and spec for the player; a skip list so screenshots of moving UI are not pixel-diffed; and a report-only dropped-frames measurement (`dumpsys gfxinfo`).

Out of scope for this change: background playback, lock-screen and notification controls, media keys, a queue with next/previous or gapless playback, auto-advance, live lyrics from LRCLIB, resuming where the user left off, streaming and downloads, word-level karaoke, search, worklet worker runtimes and `expo-background-task`, an Expo SDK upgrade, and iOS.

**Assumption to confirm:** the goal is smoothness, not a showcase of extra threads. The research found that a worklet worker runtime or WorkManager adds no user-visible smoothness at this scale, so this change uses only the UI thread (Reanimated), the native audio threads and the JS thread. If a visible multithreading showcase is wanted, it becomes a later change (for example a worker-runtime lyrics search index).

## Capabilities

### New Capabilities
- `music-playback`: Playing tracks from the bundled catalog: opening a track on the Now Playing screen, play/pause, the playback time display, start-position and paused deep-link parameters, and license attribution for the bundled music.
- `synced-lyrics`: Showing a track's lyrics in time with playback: choosing the active line, keeping it centred, staying smooth while the JS thread is busy, having lyrics ready with no loading state, and the states for tracks without lyrics or before the first line.

### Modified Capabilities
<!-- None: openspec/specs/ has no existing capabilities, and the auth flow's behaviour does not change. -->

## Impact

- **New code**: `app/player.tsx` (route), `components/player/` (Now Playing UI, lyrics view), `lib/lyrics/` (parser, active-line search, position extrapolation), `lib/player/` (`PlayerAdapter`, its expo-audio implementation and a fake for tests), `lib/music/` (the catalog and the per-track LRC text modules), `assets/music/` (M4A files), `scripts/build-music-assets.mjs` (download and transcode).
- **Changed code**: `app/_layout.tsx` (register the `player` screen), `app.json` (the `expo-audio` config plugin), `package.json` (`expo-audio` dependency, `fast-check` devDependency), `__tests__/visual/appium-screenshots-test.ts` (skip list for moving-UI screenshots).
- **Harness**: new `__mocks__/expo-audio.ts`, `automation_test/screens/PlayerScreen.ts`, `automation_test/specs/player.e2e.ts`, new entries in `automation_test/data/testData.ts`.
- **Native/build**: new native module (Media3 via expo-audio), so the debug APK must be rebuilt and reinstalled on the test device. The expo-audio 1.1.1 manifest merges RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, FOREGROUND_SERVICE and FOREGROUND_SERVICE_MEDIA_PLAYBACK; no runtime permission dialog is requested in this change.
- **Unchanged**: the auth flow, its 22 Appium tests and their committed baselines. Home gets no new button in this change, so its pixels do not move.
- **Licensing**: bundled audio and lyrics are CC BY 4.0 or generated. Attribution and a note of the transcoding are shown in the app and recorded in the catalog. No copyrighted lyrics are bundled or used as test fixtures.
