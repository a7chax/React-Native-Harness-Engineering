---
name: harness-engineering
description: >
  Full React Native testing-harness workflow — not just TDD guardrails. Write failing
  tests first and complete unit, UI, and snapshot coverage; then run the device harness:
  run the Appium + WebdriverIO E2E suite, capture a per-test screenshot, read it to verify
  on-screen behavior, and diff it against a committed baseline.
  Use this skill whenever the user asks to implement or fix app behavior, components,
  hooks, navigation flows, or test coverage in React Native/Expo projects.
  When user says "test", automatically runs all unit tests, UI tests, snapshot tests,
  then (after asking) runs the Appium E2E suite which captures one screenshot per test,
  then reads those screenshots to verify on-screen behavior and runs the Layer 6
  visual-regression diff against committed baselines.
tags: [react-native, expo, tdd, unit-test, ui-test, snapshot, appium, webdriverio, e2e, screenshot, visual-regression, auto-test]
---

# React Native Harness Engineering Skill

Use this workflow for feature work and bug fixes in React Native/Expo codebases.

## Core Principle

Run **Red -> Green -> Refactor** for every behavior change:

1. **Red**: write a failing test that reproduces the requirement/bug.
2. **Green**: implement the minimum code to pass.
3. **Refactor**: clean code while keeping tests green.

If no failing test was created first, treat implementation as incomplete.

## Mandatory Test Surfaces

For each feature/bug change, cover all relevant layers:

1. **Unit test**
   - Pure logic, helpers, hooks, state transforms, formatters, validators.
   - Assert exact expected behavior and edge cases.
2. **UI test**
   - Component/screen behavior through user interactions (press, input, visibility, navigation intent).
   - Use testing-library patterns over implementation details.
3. **Snapshot update**
   - Update snapshot only when UI change is intentional.
   - Never blindly accept snapshots; confirm the visual/structural delta is expected.
4. **Visual regression (when screenshots exist)**
   - For changes that affect rendered pixels (layout, typography, color
     tokens, icons, spacing), diff Appium per-test screenshots against
     committed PNG baselines under
     `__tests__/visual/__image_snapshots__/`.
   - Same update discipline as snapshots: only `-u` after reviewing
     the `*-diff.png` and confirming the visual delta is intentional.

When a layer is not applicable, explicitly state why.

## Execution Workflow

1. Clarify acceptance criteria and impacted files.
2. Create/extend failing tests first (unit/UI/snapshot as applicable).
3. Run the targeted failing tests to confirm **Red**.
4. Implement minimal production change.
5. Re-run targeted tests for **Green**.
6. Run broader related tests to detect regressions.
7. If snapshots changed, review diff and update intentionally.
8. Summarize what changed and what is now covered by tests.

## Test Quality Bar

- Prefer behavior-focused assertions.
- Include at least one negative or edge-path assertion when relevant.
- Avoid over-mocking core behavior unless unavoidable.
- Keep tests deterministic and readable.

## Comprehensive Test Execution

When the user asks to "test" or run tests, execute ALL test surfaces in this order:

1. **Run all unit tests**: `npx jest --watchAll=false`
2. **Run all UI tests**: `npx jest --testNamePattern=".*" --watchAll=false`
3. **Run snapshot tests**: All snapshots are automatically tested within jest runs
4. **Confirm a device + installed app**: `adb devices` shows one `device`,
   and the app is installed/reachable (`expo run:android` if needed).
5. **Ask before running the Appium suite**: the device E2E run is gated —
   confirm with the user before starting it (see Completion Gate below).
6. **Run the Appium E2E suite**: `npm run test:appium`
   (= `wdio run automation_test/wdio.conf.ts`). Appium is auto-started by
   `@wdio/appium-service`. The `afterTest` hook saves one screenshot per
   test (pass or fail) into `automation_test/screenshots/`, named by the
   full test title.
7. **Read the captured screenshots**: open the PNGs in
   `automation_test/screenshots/` and verify on-screen behavior — the
   correct screen rendered, validation errors / success states show with
   their exact text, and there is **no redbox or ANR dialog**.
8. **Run visual regression (Layer 6)**:
   `npx jest __tests__/visual/appium-screenshots-test.ts`
   to diff each Appium screenshot against committed baselines under
   `__tests__/visual/__image_snapshots__/`. On an **intentional** visual
   change, review the `*-diff.png` and update with `-u`; otherwise treat a
   diff as a regression and fix production code.

This is the **default behavior** when the user says "test", except that the
device E2E suite (steps 5–8) is only run after the user confirms.

## Completion Gate (Appium + per-test screenshots)

When all unit/UI/snapshot tests pass, **ask before running the device suite**.
The Appium E2E run is gated — do not start it without user confirmation.

**Execution order (after the user confirms):**
1. Run all tests (unit, UI, snapshot).
2. If tests pass, confirm a device and installed app are available.
3. Run the Appium suite: `npm run test:appium`.
4. The `afterTest` hook saves one screenshot per test into
   `automation_test/screenshots/` (git-ignored; override the dir via
   `APPIUM_SHOT_DIR`).
5. Read the captured screenshots to verify on-screen behavior.
6. Run the Layer 6 visual-regression diff and review any failures.

### Prerequisites (required)

Before `npm run test:appium`:

1. **Device attached**: `adb devices` shows one `device` (Android device
   or emulator; the suite uses the UiAutomator2 driver).
2. **App installed and reachable** on that device — build/install with
   `expo run:android` if it is not already present.

You do not start or stop any recording. Appium is launched automatically by
`@wdio/appium-service` when the suite runs, and the `afterTest` hook handles
all capture.

### Run the Appium suite

```bash
# Default screenshot dir: automation_test/screenshots/
npm run test:appium

# Override the screenshot output dir if needed:
APPIUM_SHOT_DIR=/tmp/appium-shots npm run test:appium
```

The suite is Appium + WebdriverIO (Mocha, TypeScript via tsx), configured in
`automation_test/wdio.conf.ts`. It currently covers 4 flows — **login**,
**home**, **forgot-password**, and **register** — with page objects in
`automation_test/screens/`, specs in `automation_test/specs/*.e2e.ts`, and
shared helpers in `automation_test/helpers/`.

After the run, confirm `automation_test/screenshots/` contains one PNG per
test (named by the full test title) and mention the path in the completion
summary. If a screenshot is missing, the `afterTest` hook logs the capture
failure but never fails the run — note the logged error; do not claim a test
was screenshotted when it was not.

## Screenshot Inspection (read the captured PNGs)

A green WebdriverIO/Mocha log is **not** sufficient on its own — confirm the
pixels. After the suite runs, read the per-test PNGs in
`automation_test/screenshots/` to verify what actually happened on screen
(errors shown, success states, navigation, no redbox/ANR). This is a
**required verification step**, not optional.

### Read the screenshots

- There is exactly **one screenshot per test**, saved by the `afterTest`
  hook (pass or fail) and named by the test's full title, so you can map a
  PNG straight back to the spec that produced it.
- For each screenshot confirm the expected UI: validation errors with their
  exact text, success/empty states, the correct screen, and **no redbox or
  ANR dialog**.
- If a screenshot shows an ANR ("isn't responding") or a redbox, the run is
  **not** trustworthy even if the spec reported a pass — fix reliability
  (below), re-run, and re-inspect.
- Summarize findings by referencing specific tests (e.g. "the
  `register form shows all errors` screenshot shows all four validation
  errors").

### Reliability (so the run is clean enough to inspect)

- Ensure the app is built and installed (`expo run:android`) before the
  suite so the first spec does not hit a cold-start ANR while Metro rebuilds
  the JS bundle.
- WebdriverIO taps do **not** auto-scroll. On scrollable screens use the
  `scrollIntoView` helper in `automation_test/helpers/gestures.ts` to bring
  an off-screen field into view before interacting, and assert a field's
  inline error right after typing while it is on screen.

## Visual Regression (jest-image-snapshot)

The Appium `afterTest` hook writes one screenshot per test to
`automation_test/screenshots/`. Run the visual regression suite to lock
visual behavior against committed baselines. This is **Layer 6** in
`HARNESS_GUIDE.md` — pixel-level regression detection that closes the gap
WebdriverIO assertions can't (specs assert on accessibility id / text, not
pixels).

### Run the suite

```bash
npx jest __tests__/visual/appium-screenshots-test.ts
```

- `__tests__/visual/appium-screenshots-test.ts` reads each PNG in
  `automation_test/screenshots/`, crops the Android status bar with
  `cropTopRows` (from `lib/visual/frameUtils.ts`), and diffs it against the
  committed baseline
  `__tests__/visual/__image_snapshots__/appium-<test-title>.png`.
  **Commit the baselines** — they are the regression contract.
- On a **fresh checkout** (no Appium screenshots captured yet) the suite
  **skips** so CI stays green until a device run has produced screenshots.
- On subsequent runs the matcher diffs each new screenshot against its
  baseline; failures write `*-diff.png` files to
  `__tests__/visual/__image_snapshots__/__diff_output__/` (git-ignored).
- The Android **status bar is cropped before diff** via `cropTopRows`
  (default `ANDROID_STATUS_BAR_PX_DEFAULT`, 75 px). Without this, the
  clock/battery/signal indicators would dominate every diff and the layer
  would be unusable. Adjust the crop in
  `__tests__/visual/appium-screenshots-test.ts` if a flow runs on a
  non-Pixel emulator (taller bar, notch skin).

### Updating baselines

Same rule as the structural `.snap` files in Layer 3 — only `-u` after
reviewing the diff PNG and confirming the visual change is intended:

```bash
npx jest __tests__/visual/appium-screenshots-test.ts -u
```

If the diff is **not** intended, treat it as a regression and fix the
production code, not the baseline.

### Reporting visual failures

When a visual diff fails:
- Reference the failing test title (the screenshot/baseline key) so the
  reviewer can correlate it to the spec that produced it.
- Surface each `__diff_output__/*-diff.png` for the failing screenshots so
  the reviewer can see *exactly* which pixels drifted.
