# Appium E2E Suite (`automation_test/`)

End-to-end UI automation for the Expo React Native app `com.anonymous.reactnativeuitest`,
built with **Appium + WebdriverIO** (`@wdio/cli` v9 testrunner), the **Mocha** framework,
and the **`spec`** reporter. Tests are written in **TypeScript** and executed directly via
**`tsx`** — there is no build step.

This suite covers the app's four core flows as WebdriverIO specs:

| Flow             | WDIO spec                        | What it covers                                            |
| ---------------- | -------------------------------- | --------------------------------------------------------- |
| Login            | `specs/login.e2e.ts`             | Empty-submit validation errors; valid login -> Home       |
| Home             | `specs/home.e2e.ts`              | Welcome text on Home; logout returns to Login             |
| Forgot password  | `specs/forgot-password.e2e.ts`   | Empty-submit email error; valid email -> success message  |
| Register         | `specs/register.e2e.ts`          | Per-field validation (scrolled into view); valid -> Home  |

Android (UiAutomator2 driver) is the runtime target. iOS selectors are written defensively
but are not exercised by the runtime here.

## Prerequisites

1. **Android SDK** with `adb`, `emulator`, and platform tools on your `PATH`.
2. **A running emulator or device.** An AVD named **`Pixel_9a`** already exists; start it with:
   ```bash
   emulator -avd Pixel_9a
   # verify it is connected:
   adb devices
   ```
3. **Appium 3** on your `PATH` with the **`uiautomator2`** driver installed:
   ```bash
   npm i -g appium
   appium driver install uiautomator2
   ```
   You do **not** start Appium manually — `@wdio/appium-service` auto-starts it from `PATH`
   when the test run begins.
4. **The app installed on the device.** This is a **managed Expo project** with no committed
   `android/` folder, so the native app must be **prebuilt** before it can be installed:
   ```bash
   # from the repo ROOT — generates native code, builds, installs, and launches:
   npx expo run:android
   ```
   This installs `com.anonymous.reactnativeuitest` on the running device. Alternatively, set
   `APP_PATH` (see below) to an `.apk` so the runner installs it for you.
5. **Node dependencies** are already installed at the repo root (`@wdio/*`, `webdriverio`,
   `tsx`, `@wdio/mocha-framework`, `@wdio/appium-service`, `@wdio/spec-reporter`).

## Directory layout

```
automation_test/
├── data/
│   └── testData.ts        # APP ids, valid login/registration fixtures, TITLES, MESSAGES
├── helpers/
│   ├── app.ts             # launchAppFresh / restartApp (terminate + activate)
│   ├── gestures.ts        # setField, hideKeyboardIfVisible, scrollIntoView
│   └── selectors.ts       # byTestId / byText / byTextContains / scrollToTestId
├── screens/
│   ├── BaseScreen.ts      # abstract page-object base (root, waitUntilLoaded, el, textOf)
│   ├── LoginScreen.ts     # page objects, each default-exports a singleton instance
│   ├── HomeScreen.ts
│   ├── ForgotPasswordScreen.ts
│   ├── RegisterScreen.ts
│   └── index.ts           # re-exports instances: loginScreen, homeScreen, ...
├── specs/
│   ├── login.e2e.ts
│   ├── home.e2e.ts
│   ├── forgot-password.e2e.ts
│   └── register.e2e.ts
├── wdio.conf.ts           # capabilities, appium service, mocha opts, tsx-driven config
├── tsconfig.json          # @wdio/globals/types + webdriverio types
└── README.md
```

Specs depend only on `../screens`, `../helpers/app`, and `../data/testData` — raw selector
strings never appear in specs.

## How to run

From the repo **ROOT** (not from inside `automation_test/`):

```bash
npx wdio run automation_test/wdio.conf.ts
```

The root `package.json` wraps this in a script, so you can also run:

```bash
npm run test:appium
```

Make sure the emulator/device is up and the app is installed before running. Appium itself is
launched automatically by `@wdio/appium-service`.

## Screenshots & visual regression

After **every** test (pass or fail) the `afterTest` hook in `wdio.conf.ts` saves one
screenshot, named by the test's full title, into `automation_test/screenshots/` (override the
location with `APPIUM_SHOT_DIR`). These are git-ignored and regenerated on each run.

Those screenshots feed **Layer 6 (visual regression)**: the Jest suite
`__tests__/visual/appium-screenshots-test.ts` crops the Android status bar (via
`lib/visual/frameUtils.ts → cropTopRows`) and diffs each screenshot against a committed PNG
baseline at `__tests__/visual/__image_snapshots__/appium-<test-title>.png`.

```bash
npm run test:appium                                      # 1) run E2E, capturing screenshots
npx jest __tests__/visual/appium-screenshots-test.ts     # 2) diff screenshots vs baselines
npx jest __tests__/visual/appium-screenshots-test.ts -u  # accept intentional visual changes
```

On a fresh checkout (no screenshots yet) the visual suite skips so CI stays green.

## Environment variable overrides

The capabilities in `wdio.conf.ts` read these env vars; all are optional with sensible defaults:

| Variable       | Purpose                                                                   | Default                            |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| `DEVICE_NAME`  | UiAutomator2 device / AVD name                                            | `Pixel_9a`                         |
| `APP_PACKAGE`  | Android app package id to launch                                          | `com.anonymous.reactnativeuitest`  |
| `APP_ACTIVITY` | Android launch activity                                                   | the app's main activity            |
| `APP_PATH`     | Path to an `.apk`. When set, Appium **auto-installs** it before the run.  | _(unset — uses already-installed)_ |
| `APPIUM_SHOT_DIR` | Directory the `afterTest` hook writes per-test screenshots into.       | `automation_test/screenshots`      |

Example:

```bash
APP_PATH=/abs/path/to/app.apk DEVICE_NAME=Pixel_9a npx wdio run automation_test/wdio.conf.ts
```

## testID -> Android resource-id mapping

React Native `testID`s map to native Android **`resource-id`** values (the exact string, with
no package prefix) under the UiAutomator2 driver. All locator logic lives in
**`helpers/selectors.ts`**:

- `byTestId(id)` resolves via a `resource-id` UiSelector on Android (this works for both
  container/`Text` nodes that set only `testID` and for interactive inputs/buttons that set
  `testID` and `accessibilityLabel`). It does **not** rely on the accessibility-id (`~`)
  strategy on Android.
- `byText(text)` / `byTextContains(text)` match visible text via XPath.
- `scrollToTestId(id)` uses `UiScrollable.scrollIntoView` so off-screen fields on the long
  Register form can be brought into view before interaction.

Selectors branch on `driver.isIOS` / `driver.isAndroid`, so the same page objects work for
both platforms while Android remains the runtime target.
