# Device run: setup and troubleshooting

Read this before the first Appium run in a session, or when a device run
fails in a way that does not look like an app bug.

## Contents

1. Environment requirements
2. Bringing up the device (script or manual)
3. How recording works
4. Troubleshooting table

## 1. Environment requirements

| Requirement | Why | Check |
|---|---|---|
| Node 22 (`mise.toml`) | WebdriverIO 9 bundles undici 6, which cannot create an Appium session on Node 26 (`UND_ERR_INVALID_ARG` on `POST /session`). | `node -v` in the repo shows v22 |
| `appium` on PATH for that Node | `wdio.conf.ts` starts Appium with `command: "appium"` through `@wdio/appium-service`. A global install under a different Node version is not visible. | `appium --version`; install with `npm i -g appium` if missing |
| UiAutomator2 driver | Android automation backend. Lives in `~/.appium`, so it is shared across Node versions. | `appium driver list --installed` |
| Android SDK, `ANDROID_HOME` | adb and the emulator. | `adb devices`, `emulator -list-avds` |
| `ffmpeg-static` binary | Post-processes videos (captions, tap markers). npm may block its install script; without the binary you get raw, unlabelled videos. | `ls node_modules/ffmpeg-static/ffmpeg`; fix with `npm approve-scripts ffmpeg-static && npm rebuild ffmpeg-static` |
| Debug APK installed | The specs launch `com.anonymous.reactnativeuitest`. | `adb shell pm list packages \| grep reactnativeuitest` |
| Metro on 8081 | The debug build loads its JavaScript from Metro. | `curl -s localhost:8081/status` → `packager-status:running` |

The APK only needs rebuilding (`npx expo run:android`) when native
dependencies change, i.e. a new or updated package with native code.
JavaScript changes are served live by Metro.

## 2. Bringing up the device

The script does everything below and is safe to re-run; it skips steps that
are already done:

```bash
bash .skills/harness-engineering/scripts/boot-device.sh [AVD_NAME]
```

Manual equivalent:

```bash
emulator -avd Pixel_9a -no-snapshot-load -no-boot-anim &   # boot (≈1–2 min)
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 2; done
adb shell settings put secure stylus_handwriting_enabled 0   # see troubleshooting
npx expo start --port 8081 &                                  # Metro
adb reverse tcp:8081 tcp:8081
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Stop the emulator and Metro when you finish, or tell the user they are still
running.

## 3. How recording works

All of this is in `automation_test/wdio.conf.ts` and
`automation_test/helpers/recording.ts`, enabled by `RECORD_VIDEO=1`:

- `beforeTest` starts `driver.startRecordingScreen()` and resets the list of
  recorded touches.
- `beforeCommand` records each `elementClick` (centre of the element's rect)
  and each single-finger `performActions` drag (start, end, duration), timed
  from the start of the recording.
- `afterTest` waits 1.5 s so the final transition is captured, stops the
  recording and saves it to
  `recordings/<feature>/<NN>-<title>.<passed|failed>.mp4`. ffmpeg then
  converts it to constant 30 fps (screenrecord only emits frames when the
  screen changes, so raw clips play back far too fast), adds the caption band
  and the libass-drawn tap and swipe markers, and holds the last frame.
- Failures in any of these steps only log a warning, so recording can never
  fail a test.

When adding a new kind of gesture (pinch, long-press), extend
`swipeFromActions()` in `wdio.conf.ts` so it shows up in the videos.

## 4. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every spec fails at once with `UND_ERR_INVALID_ARG` | Running under Node 26 | Use Node 22 (`mise exec -- npm run test:appium`) |
| `spawn appium ENOENT` or the Appium service fails to start | `appium` not installed for the active Node | `npm i -g appium` under Node 22 |
| One test can't find a field, and the screenshot shows "Try out your stylus" | Gboard handwriting onboarding covering the screen | `adb shell settings put secure stylus_handwriting_enabled 0`, then rerun |
| The first test after boot times out on the login screen | Metro bundling the JavaScript for the first time | Open the app once before the run, or rerun |
| Black or empty video frames at the start | App still launching when recording began | Usually harmless; the caption and later frames show the test |
| Element found in an `adb shell uiautomator dump` but not by Appium | Appium's source flattens React Native views | Use the `following-sibling` XPath described in SKILL.md |
| An element at the screen edge counts as "displayed" | Bounds clipped to the screen | Compare height or position, or scroll it into view first |
| Markers are offset from the tapped element | Changed circle path in `recording.ts` | The path must use coordinates from 0 to 2r: libass aligns drawings from the (0,0) origin |
| Videos have no caption or markers | ffmpeg binary missing | See the `ffmpeg-static` row in section 1 |
| Visual suite fails with "New snapshot was not written" | New test without a baseline | Review the screenshot, then run `-u` and commit the PNG |
