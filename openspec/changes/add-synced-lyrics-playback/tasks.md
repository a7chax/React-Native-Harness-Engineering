# Tasks

## 1. Branch, dependencies and native build

- [x] 1.1 Ask the user whether to implement on a new branch in this checkout or in a git worktree. For a branch here, the untracked `openspec/` comes along. For a worktree, copy `openspec/` into it (it is untracked on `main`, so a new worktree starts without it) and ask the user before removing the copy on `main`. Verify `git branch --show-current` is not `main` and `openspec/changes/add-synced-lyrics-playback/tasks.md` exists in the directory used for implementation
- [x] 1.2 Run `npx expo install expo-audio` and `npm install -D fast-check@^4`; verify `package.json` lists `expo-audio` ~1.1.1 and `fast-check` 4.x, and `npx tsc --noEmit` still passes
- [x] 1.3 Add `["expo-audio", { "recordAudioAndroid": false }]` to the `app.json` plugins and run `npx expo prebuild --clean -p android`; verify prebuild succeeds and `android/app/src/main/AndroidManifest.xml` contains `android.permission.MODIFY_AUDIO_SETTINGS`, which the plugin adds
- [x] 1.4 After asking the user to confirm the device run, build and install with `npx expo run:android` on the user's Genymotion device. Verify that:
  - the merged manifest under `android/app/build/intermediates/merged_manifests/debug/` declares `expo.modules.audio.service.AudioControlsService`;
  - `unzip -p android/app/build/outputs/apk/debug/app-debug.apk 'classes*.dex' | strings | grep -m1 'Landroidx/media3/exoplayer/ExoPlayer'` prints a match;
  - the app still opens to the Login screen (read a screenshot).

## 2. Lyrics core (pure functions)

- [x] 2.1 Implement `parseLrc` in `lib/lyrics/parseLrc.ts` per design Decision 4. Verify `npx jest lib/lyrics --watchAll=false` passes with:
  - unit tests for fraction formats, the offset tag, multi-timestamp lines, metadata and untimed lines, word tags, and the empty-text end marker;
  - fast-check properties: never throws on any string, output sorted, format-then-parse round-trip.
- [x] 2.2 Implement the `'worklet'` function `activeLineIndex(times, positionMs, endMs)` in `lib/lyrics/activeLine.ts`, with properties (agrees with a linear-scan oracle, never decreases as position grows, -1 before the first line and at or after `endMs`); verify the Jest run passes
- [x] 2.3 Implement the `'worklet'` clock functions in `lib/lyrics/clock.ts` per design Decision 3 (`extrapolate` and the monotonic displayed position with the action epoch). Verify the Jest run passes with properties:
  - never decreases while playing;
  - constant while paused;
  - clamped to the catalog duration, and a status duration of 0 never changes the bound;
  - a stale sample behind the displayed position does not decrease it within one epoch;
  - a new epoch can move it back.

## 3. Catalog and audio assets

- [x] 3.1 Write `scripts/build-music-assets.mjs` per design Decision 6 (download with a browser-like User-Agent, transcode to AAC-LC 128 kbps M4A with `ffmpeg-static`, generate the 20 s tone, print size, duration and sha256) and run it; verify `assets/music/dcye.m4a`, `letting-go.m4a` and `tone.m4a` exist with durations of about 214 s, 192 s and 20 s
- [x] 3.2 Add `lib/music/lyrics/dcye.ts` from LRCLIB record 10481837, and `lib/music/lyrics/letting-go.ts` from LRCLIB 10481859 with the "(Chorus)" marker expanded from the official lyrics on joshwoodward.com and timed per design Decision 5; verify both strings parse with `parseLrc` and `dcye` gives 39 rows with `endMs` 195850
- [x] 3.3 Add `lib/music/catalog.ts` (all fields from design Decision 5, `lrcCheckedByEar: false` for both lyric tracks) and a `creditLine(track)` helper. Verify that:
  - a catalog integrity test passes: each lyric track has more than one line, monotonic times inside its duration, and licence fields present;
  - `creditLine` for `dcye` returns exactly `Music: "Don't Close Your Eyes" by Josh Woodward, CC BY 4.0, transcoded to AAC`.
- [x] 3.4 Document `node scripts/build-music-assets.mjs`, the catalog and its CC BY obligations in `README.md`; verify the documented command runs as written

## 4. Player adapter

- [x] 4.1 Define `PlayerAdapter` and its status sample in `lib/player/PlayerAdapter.ts`, and implement `FakePlayer` with an explicit `advance(ms)` and `emit(sample)` API that does not use `jest.useFakeTimers()`; verify unit tests cover load, play, pause, seek and status delivery
- [x] 4.2 Implement `lib/player/ExpoAudioPlayer.ts` per design Decision 2 (the only file importing `expo-audio`) and `__mocks__/expo-audio.ts`, which stubs `createAudioPlayer`, `remove` and `release`. Verify unit tests assert that:
  - `createAudioPlayer` gets `updateInterval: 250`;
  - track changes call `replace()`;
  - seeks call `seekTo(seconds, 0, 0)`;
  - `playbackStatusUpdate` events reach subscribers;
  - `release()` calls `pause()`, `remove()` and `release()` on the player.
- [x] 4.3 Implement `lib/player/params.ts` per design Decision 7. Verify a table test covers:
  - valid string parameters;
  - an unknown track;
  - `at` values of `-5`, `abc` and past the catalog duration;
  - `paused` values;
  - `stall` only when the development flag is true, capped at 10000.

## 5. Now Playing screen

- [x] 5.1 Call Reanimated's `setUpTests()` in `jest.setup.ts`; verify the whole existing Jest suite still passes with `npx jest --ci --watchAll=false`
- [x] 5.2 Add `app/player.tsx` and register it in `app/_layout.tsx`, with title, artist, credit, time label and Play/Pause toggle. Use the testIDs in design Decision 8, inject `FakePlayer` in tests, and apply parameters on every incoming link via expo-linking's `url` event, per design Decision 7. Verify RNTL tests on real timers cover:
  - opening by id, and unknown-id fallback;
  - the Play/Pause labels;
  - the time label after a fake seek and status;
  - the credit text;
  - tapping the credit opens the credits panel with the licence address and song page, tapping each calls `Linking.openURL` with that URL, and closing hides the panel (add `pageUrl` to the catalog per design Decision 5 and update the catalog test, and replace the README's CC BY "Open item" with a description of the panel);
  - an identical `url` event re-applying a paused position after Play.
  
  Add a snapshot as well.
- [x] 5.3 Build the lyrics view (`components/player/LyricsView.tsx` and the clock leaf component) per design Decisions 1, 3 and 8. Verify RNTL tests with `FakePlayer`:
  - paused at 41 s selects only line 6 in the first render;
  - a new paused apply at 21.5 s selects only line 2;
  - 5 s and 200 s select none;
  - switching to `letting-go` shows its lines in the same render, with no previous lines and no element with testID `loading`;
  - `tone` shows "No lyrics for this track";
  - after `advance()` and `emit()` while playing, `await waitFor` sees the selection move forward and never back when a stale sample is emitted.
- [x] 5.4 Wire the `stall` parameter per design Decision 7 (development builds only, once, on the first `playing` status at or past `at - 250` ms after the seek resolves); verify unit tests that it is ignored when the development flag is false and does not fire on an earlier status
- [x] 5.6 Make each lyric row tappable per the "Tap a line to jump to it" requirement and design Decision 8. Verify RNTL tests with `FakePlayer` cover:
  - a tap on line 9 while paused at 41 s selects only line 9, shows 0:54 and keeps "Play", with `seekTo(54410)` and no `play()` in the FakePlayer calls;
  - a tap on line 2 while playing selects line 2, keeps "Pause", and the time label follows the FakePlayer from 0:18;
  - a scroll gesture on the lyrics does not seek.
- [x] 5.5 Add the `/player` route and its deep-link parameters to the "App under test" table in `README.md`; verify `npx jest --ci --watchAll=false` and `npx tsc --noEmit` both pass

## 6. Device verification (Appium)

- [x] 6.1 After asking the user to confirm the device run, check on Genymotion that:
  - a cold-start `mobile: deepLink` opens the player;
  - the position advances while playing;
  - `adb shell dumpsys audio` lists the app's player as `started`;
  - a second, different deep link into the running app re-applies;
  - the same link sent twice after tapping Play re-applies;
  - the active row reports `selected="true"` in the page source;
  - one page-source read on the playing screen takes a measured time with `waitForIdleTimeout: 0`.
  
  Record any deviation and the measured lookup time in `design.md` Risks before continuing.
- [x] 6.2 Add `automation_test/screens/PlayerScreen.ts` per design Decision 9:
  - `open(params)` cold-starts, then sends `mobile: deepLink`;
  - `receive(params)` sends an in-app deep link;
  - `snapshot()`, `closestRowToCentre()`, `selectedLine()`, `centreRatio(i)`, `swipeLyrics()`, `toggle()`, `timeLabel()`, `openCredits()` and `closeCredits()`;
  - `waitForIdleTimeout` set to 0 in the spec's `before()` and restored in `after()`.
  
  Also add the player track ids, titles, credit and line texts to `automation_test/data/testData.ts`. Verify `npx tsc --noEmit -p automation_test` passes.
- [x] 6.3 Write `automation_test/specs/player.e2e.ts` covering every `music-playback` and `synced-lyrics` scenario, using in-app deep links only where a scenario says "receives". Combine scenarios that share setup into one `it()` whose title names them, with `// Positive cases` and `// Negative cases` groups. Verify it passes on the device with `RECORD_VIDEO=1 npx wdio run automation_test/wdio.conf.ts --spec automation_test/specs/player.e2e.ts`, which also records the labelled per-test videos
- [x] 6.4 In the stall test, reset `dumpsys gfxinfo` before the cold-start deep link and dump it after the assertions, through `mobile: shell`, as a report-only metric; verify the frame counts appear in the WDIO log and no assertion depends on them
- [x] 6.5 Add an `isSkippedShot(slug)` helper in `lib/visual/` and use it in `__tests__/visual/appium-screenshots-test.ts` to skip player screenshots; verify a unit test that player slugs are skipped and auth slugs are not
- [x] 6.6 Read every player screenshot, and a contact sheet of every player video (`.skills/harness-engineering/scripts/contact-sheet.sh`), from the recorded device run, and check that each test's end state matches its title (active line, time label, empty state, no error screen or system popup); report what each one shows
- [ ] 6.7 Ask the user to listen to `dcye` and `letting-go` on the device with the lyrics view open, and set `lrcCheckedByEar: true` for each track they confirm; verify the catalog integrity test still passes

## 7. Integration

- [x] 7.1 Run `npx jest --ci --watchAll=false`, `npx tsc --noEmit` and `npx tsc --noEmit -p automation_test`; verify all pass
- [x] 7.2 After asking the user to confirm the device run, run the full Appium suite on the device with screenshots written to a scratch directory. Verify that:
  - the player spec passes;
  - the 22 auth tests give the same results as before this change. On Genymotion that means 21 pass, and `Home > scrolls down to the bottom of the page and back up` fails for the known screen-size reason.

## Workflow follow-up

- Review the branch with the user, then commit in logical pieces and open a PR only when asked. The PR description must include proof from the device: the labelled player videos and per-test screenshots (a curated copy committed under `docs/proof/` or attached, as the user prefers).
- Run `/opsx:verify`, then archive the change once the review is done.
