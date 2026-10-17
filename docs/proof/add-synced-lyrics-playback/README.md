# Device proof: add-synced-lyrics-playback

Evidence from one recorded run of `automation_test/specs/player.e2e.ts`. All 16 tests passed in that run (6 min 52 s).

- **Device:** Genymotion emulator, Android 15 (API 35), x86_64, 570x1230 at 220 dpi.
- **Build:** debug APK with expo-audio 1.1.1, JavaScript served by Metro.
- **Date:** 2026-10-17.
- **Command:**

  ```bash
  RECORD_VIDEO=1 npx wdio run automation_test/wdio.conf.ts --spec automation_test/specs/player.e2e.ts
  ```

## What is here

| Folder | Contents |
|---|---|
| `videos/` | One labelled video per test (`<NN>-<test title>.passed.mp4`). A caption band shows the test and its result, orange circles mark taps and swipes, and the last frame is held for 2 s. The videos are silent, because screen recording does not capture audio. |
| `screenshots/` | The final screen of each test (`player-<test title>.png`), captured by the `afterTest` hook. |
| `strips/` | Frame strips, 1 frame per second, for the tests that show the most: playback in order (06), drag without seek (08), tap-to-jump paused and playing (09, 10), the JS-thread stall (11) and the credits links (13). |

## How to read the stall test (11)

The time label is React state, so it freezes while the debug-only `stall` parameter blocks the JavaScript thread. In `strips/11-…png`, the label stays at 0:43 while the highlight moves from line 6 to line 7 and the list scrolls line 7 to the middle. Only the UI thread can do that. When the stall ends, the label jumps to 0:49 and line 8 is active.

## Known limits of this evidence

- **The emulator's audio clock runs 1.1–1.9× faster than real time.** Time labels can therefore advance faster than the wall clock in the videos, and wall-clock timing is asserted only as a lower bound on this device.
- **Cold starts show 5–9 s of black screen after the splash.** This is the debug build loading its JavaScript bundle from Metro.
- **Frame counts during the stall** (`dumpsys gfxinfo`, report-only): 16 frames, 6 janky (37.5%), p95 150 ms. These come from a debug build on an emulator and are not representative of a release build on a phone.
- **The lyric timing has not yet been checked by ear** (`lrcCheckedByEar: false` in `lib/music/catalog.ts`).
