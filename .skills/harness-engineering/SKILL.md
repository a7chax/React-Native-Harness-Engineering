---
name: harness-engineering
description: >
  End-to-end development workflow for this React Native / Expo app and its
  testing harness: test-first changes with unit, UI and snapshot tests in Jest,
  then Appium + WebdriverIO E2E specs (positive, negative and scroll cases) run
  on an Android emulator, with per-test screenshots, visual-regression diffs and
  labelled per-test videos that show every tap and swipe. Use this skill
  whenever the user wants to build or fix a feature, screen, form, navigation
  flow or component; add, complete or fix tests; run "the tests" or "the
  harness"; record a test video or prove/show that something works on the
  device; add scrolling or gesture tests; or update E2E coverage or screenshot
  baselines — even if they only say "test it", "make sure it works" or
  "give me proof".
tags: [react-native, expo, tdd, jest, appium, webdriverio, e2e, emulator, screenshot, visual-regression, video, recording]
---

# React Native Harness Engineering

This repo ships a layered test harness. A change is done when it is covered
at every layer it touches **and** you have seen it work on a device. Each
layer catches something the others miss:

| Layer | What it catches | Where |
|---|---|---|
| 1. Unit (Jest) | wrong logic: validators, helpers, storage | `lib/**/__tests__`, `components/**/__tests__` |
| 2. UI (React Testing Library) | wrong behaviour on press/type/render | `app/__tests__`, `components/**/__tests__` |
| 3. Snapshot | unintended structural UI changes | `__snapshots__/*.snap` |
| 4. E2E (Appium + WebdriverIO) | broken real-device flows, navigation, native bits | `automation_test/specs/*.e2e.ts` |
| 5. Per-test screenshot | what the screen looked like at the end of each test | `automation_test/screenshots/` (git-ignored) |
| 6. Visual regression | pixel drift (spacing, colour, layout) | `__tests__/visual/__image_snapshots__/appium-*.png` |
| Video proof | the whole interaction, with taps and swipes drawn on | `automation_test/recordings/<feature>/` (git-ignored) |

`HARNESS_GUIDE.md` is the long-form reference for layers 1–6. Device setup,
environment requirements and known Appium quirks are in
`references/device-run.md`; read it before the first device run of a session
or whenever a device run misbehaves.

## The development loop

Work through these in order. Skipping ahead (writing code before a failing
test, or claiming success from a green log without looking at the screen) is
how regressions slip in.

1. **Pin down acceptance criteria.** List the user-visible behaviours,
   including the unhappy paths (empty input, malformed input, going back).
   Each behaviour should map to at least one test.
2. **Red.** Write failing Jest tests first: a unit test for new logic, a UI
   test for new interaction. Run just those tests and confirm they fail for
   the right reason (`npx jest path/to/test --watchAll=false`).
3. **Green.** Implement the minimum production change that makes them pass.
4. **Refactor** with the tests green, then run the whole Jest suite
   (`npx jest --ci --watchAll=false`) to catch regressions elsewhere. Update
   `.snap` files only after reading the diff and confirming the change was
   intended.
5. **E2E.** Add or extend the Appium spec for the feature (see "Writing E2E
   tests"). Every new testID the spec needs goes into the component first.
6. **Device run.** Ask the user before starting it: it drives a real
   emulator for several minutes. Then run with recording on (see "Device
   run").
7. **Look at the evidence.** Check screenshots and videos (see "Reviewing
   the evidence"). A passing test whose video shows the wrong screen, an
   error dialog or a system popup is not a pass.
8. **Visual regression.** Run Layer 6 and handle diffs (see below).
9. **Commit** in logical pieces with conventional-commit messages. Push or
   open a PR only when the user asks.

When a layer genuinely does not apply (e.g. a pure refactor of a validator
has no E2E surface), say so explicitly in the summary instead of silently
skipping it.

## Writing E2E tests

Structure:

- `automation_test/screens/*Screen.ts`: page objects. They own selectors
  and actions (`login()`, `submit()`, `scrollDown()`), extend `BaseScreen`,
  and find elements by testID through `byTestId()`.
- `automation_test/specs/<feature>.e2e.ts`: one `describe` per feature, a
  `beforeEach` that calls `launchAppFresh()` and navigates to the screen, and
  plain-English `it(...)` titles. The title becomes the screenshot,
  baseline and video file name, so keep titles stable and descriptive.
- `automation_test/data/testData.ts`: valid inputs, expected messages and
  seeded values. Tests import expectations from here instead of hard-coding
  strings.

Coverage expectations for each feature. Group them under `// Positive cases`
and `// Negative cases` comments so the balance is visible:

- **Positive:** the happy path end to end; every navigation entry and exit
  (links, back button, logout); tolerated input variations (e.g. an email
  with surrounding spaces); errors disappearing once the input is fixed;
  data the screen should display.
- **Negative:** empty submit; each malformed field on its own (assert the
  *other* fields show no error, via `isShown(testId) === false`); rules at
  their boundary (e.g. a password without a number).
- **Scroll:** if a screen is taller than the viewport, test the scroll
  itself. Use `swipe("up" | "down")` from `helpers/gestures.ts`. It is a real
  W3C finger drag, so it shows up in the video. Assert that the scroll
  happened by comparing an element's `getLocation().y` before and after, and
  that content near the bottom became reachable. Before tapping a control
  that starts partly off-screen, scroll it into view the way a user would.

Patterns that keep specs reliable:

- Wait for elements (`waitForDisplayed`) instead of using fixed sleeps.
  Fixed pauses are only for letting a scroll settle.
- Assert that something is *absent* with `isShown()`, which does not wait.
  Waiting for an absent element just burns the timeout.
- Fill fields with `setField()`, which focuses, clears, types and hides the
  keyboard so the keyboard does not cover the next element.
- Appium's UiAutomator2 source flattens React Native views. Text that looks
  nested inside a `View` in the code appears as **following siblings** of
  that view, so use
  `//*[@resource-id="<id>"]/following-sibling::android.widget.TextView[n]`
  rather than a child lookup.
- Android clips element bounds to the screen. A partly visible element still
  reports `isDisplayed() === true` and a shorter height, so "is it fully
  visible?" needs a size or position comparison, not `isDisplayed()`.

## Device run

Prerequisites (details and a bootstrap script are in
`references/device-run.md`):

- Node 22 (pinned in `mise.toml`). Under Node 26, WebdriverIO cannot create
  an Appium session (`UND_ERR_INVALID_ARG`).
- An emulator or device in `adb devices`, Metro running on 8081 with
  `adb reverse tcp:8081 tcp:8081`, and the debug app installed. To set all of
  this up in one go, run
  `bash .skills/harness-engineering/scripts/boot-device.sh`.

Run it:

```bash
npm run test:appium:record                       # whole suite, with videos
RECORD_VIDEO=1 npx wdio run automation_test/wdio.conf.ts \
  --spec automation_test/specs/home.e2e.ts       # one feature while iterating
npm run test:appium                              # no videos (faster)
```

The full suite takes about 10 minutes. Run it in the background and wait for
the completion notification instead of polling. While iterating, run only the
spec you are changing, then the full suite once at the end.

When a test fails, read the error in the WDIO log first, then look at that
test's screenshot and video before changing code. Most failures are
environmental (a system popup, a cold Metro bundle, a timing issue) rather
than app bugs. `references/device-run.md` has a troubleshooting table.

## Reviewing the evidence

With `RECORD_VIDEO=1`, every test produces
`automation_test/recordings/<feature>/<NN>-<test-title>.<passed|failed>.mp4`,
post-processed (by `automation_test/helpers/recording.ts`) to include:

- a caption band showing the feature, the test number and title, and
  PASSED/FAILED;
- an orange circle at every element tap, and a circle that follows the
  finger for every swipe;
- real-time playback and a 2-second hold on the final frame.

Android's own "Show taps" setting does not draw Appium's injected touches.
That is why the markers are drawn during post-processing.

You cannot watch a video, so turn it into a frame strip and read that:

```bash
bash .skills/harness-engineering/scripts/contact-sheet.sh \
  automation_test/recordings/home/04-*.mp4 /tmp/strip.png 2
```

Then read the PNG. For each test, check:

- it starts on the expected screen and ends in the expected state (error
  text, success message, new screen);
- tap markers land on the control being tested, and the screen reacts right
  after (a keyboard opens, an error appears, navigation happens);
- for scroll tests, the content moves with the swipe marker;
- there is no redbox, ANR dialog, keyboard onboarding popup or other system
  overlay.

Screenshots in `automation_test/screenshots/` (one per test, the final state)
are quicker to read when you only need the end state.

Report what you saw per test ("`register/02` shows the name error clearing
once 'John Doe' is typed"), not just the pass count. If a video or screenshot
is missing, say so; the hooks never fail the run when capture fails.

## Visual regression (Layer 6)

```bash
npx jest __tests__/visual/appium-screenshots-test.ts --ci --watchAll=false
```

The test diffs each screenshot (status bar cropped) against
`__tests__/visual/__image_snapshots__/appium-<test-title>.png`.

- A new test has no baseline yet, so `--ci` reports "New snapshot was not
  written". Generate the baselines with `-u`, then look at every new PNG
  before committing: each should be the correct final screen with no
  overlays.
- A diff on an existing baseline is a regression until proven otherwise.
  Open `__diff_output__/*-diff.png`, decide whether the change was intended,
  and only then update with `-u`. Otherwise fix the code.
- Renaming a test title orphans its old baseline. Delete the stale PNG in
  the same commit.

## Finishing up

Summarise for the user:

1. What changed in the app and which tests cover it, grouped by layer.
2. Test results with real numbers: Jest suites and tests, Appium tests and
   duration, visual baselines.
3. What the videos and screenshots showed, per feature, with file paths.
4. Anything skipped or environmental (e.g. "the device run used Node 22",
   "the stylus popup was disabled on the emulator").

Recordings and screenshots are git-ignored and regenerated on every run.
Commit source, specs, page objects, test data and reviewed baselines only.
