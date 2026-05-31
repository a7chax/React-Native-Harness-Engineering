# React Native Harness Engineering

A harness-engineering setup for React Native / Expo apps that combines **Jest** (unit/UI/snapshot), **Appium + WebdriverIO** (E2E on a real device), **per-test screenshot capture**, and **jest-image-snapshot pixel diff** — with a critical extra step at each layer: every E2E test saves a screenshot, the screenshots are **read** to confirm what actually happened on screen, **and** diffed against committed baselines so visual drift fails the Jest gate. A green E2E log reporting "all steps passed" is not trusted on its own; the pixels are verified — twice.

The app under test is a small, clean **auth flow** (mock/local auth, no backend) used to exercise the harness end-to-end.

## Quick Start

### Prerequisites

- Node.js 18+
- Android SDK with `adb` and `emulator` on `PATH`; a running emulator or device (an AVD named `Pixel_9a` exists)
- [Appium 3](https://appium.io/) on `PATH` with the **uiautomator2** driver installed: `appium driver install uiautomator2`
- The app installed on the device — this is a managed Expo project with **no committed `android/` folder**, so build + install with `npx expo run:android`
- Node deps already provide `webdriverio`, `@wdio/*`, and `tsx` (Appium itself is auto-started by `@wdio/appium-service`)

### Setup

```bash
npm install
appium driver install uiautomator2   # one-time: install the Android UiAutomator2 driver
adb devices                          # confirm a device/emulator is attached
npx expo run:android                 # build + install the managed Expo app on the device
```

### Running the harness

```bash
# Jest: unit + UI + snapshots + visual
npx jest --ci --watchAll=false

# Type check the app + Jest layers
npx tsc --noEmit

# The Appium E2E suite (captures one screenshot per test)
npm run test:appium

# Visual regression: diff the captured screenshots vs baselines (Layer 6)
npx jest __tests__/visual/appium-screenshots-test.ts
```

---

## App under test (auth flow)

A tab-less Expo Router stack (`app/_layout.tsx`):

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/index.tsx` | **Login** — email/password validation, links to Register/Forgot, → Home |
| `/register` | `app/register.tsx` | **Register** — name/email/password/confirm validation, → Home |
| `/forgot-password` | `app/forgot-password.tsx` | **Forgot Password** — email validation, mock "reset link sent" |
| `/home` | `app/home.tsx` | **Home** — post-login landing, logout → Login |

Shared building blocks: `lib/authValidation.ts` (validators), `components/ui/{FormTextInput,PrimaryButton,AuthScreen}.tsx`, and `components/RegisterForm/`.

---

## Harness architecture

```
Jest Layer (Unit / UI / Snapshots)            ← fast, no device
        ↓ (green gate)
Appium + WebdriverIO E2E suite                ← real device, UiAutomator2
        ↓
afterTest hook: save ONE screenshot per test (pass or fail)
        ↓
   automation_test/screenshots/*.png
        ↓
   read screenshots = visual verification
        ↓
jest-image-snapshot pixel diff vs committed baselines
        ↓
   attach screenshots + diff PNGs
   to the issue tracker
```

**Jest** catches logic/structure/regression bugs without a device. **Appium + WebdriverIO** drives real user flows via the UiAutomator2 driver, asserting on stable `testID`/text. The **`afterTest` hook** saves a single PNG per test case — an image a coding agent can actually read and inspect (unlike a log line). **jest-image-snapshot** then closes the loop by diffing those screenshots against committed baselines, so visual regressions (layout shift, color drift, missing icons) fail the Jest gate the same way structural snapshots do.

### Why per-test screenshots (not video)?

| Property | Per-test screenshot | Screen video |
|----------|---------------------|--------------|
| Readable by a coding agent | ✅ It's an image | ❌ Must be decoded to frames first |
| Deterministic baseline key | ✅ Named by full test title | ❌ Timestamped, drifts run-to-run |
| Diffable as a regression gate | ✅ One PNG per test → one baseline | ⚠️ Which frame is "the" frame? |
| Overhead on weaker emulators | ✅ One capture per test | ❌ Continuous encode load |

The `afterTest` hook in `automation_test/wdio.conf.ts` writes exactly one screenshot per test (pass or fail), named by the test's full title, into `automation_test/screenshots/` (git-ignored, regenerated each run; override the directory via `APPIUM_SHOT_DIR`). That single, stably-named PNG is both the artifact you **read** to verify behavior and the input the Layer 6 pixel diff consumes.

---

## Test layers

### Layer 1 — Unit (Jest)
Pure logic: validators, helpers, transforms.
```typescript
import { validateEmail, EMAIL_ERROR } from '@/lib/authValidation';

it('rejects malformed emails', () => {
  expect(validateEmail('foo@bar')).toBe(EMAIL_ERROR);
  expect(validateEmail('a@b.co')).toBeNull();
});
```

### Layer 2 — UI (React Native Testing Library)
Component behavior through interactions; mock navigation.
```typescript
fireEvent.press(getByTestId('login-submit-button'));
expect(getByText('Enter a valid email address')).toBeTruthy();
expect(mockReplace).not.toHaveBeenCalled();
```

### Layer 3 — Snapshots
Structural regression detection; update only when the change is intentional.
```bash
npx jest --updateSnapshot
```

### Layer 4 — E2E (Appium + WebdriverIO)
Full flows on the device, keyed off stable `testID`s. The suite is **Mocha + TypeScript (via `tsx`)** and lives in `automation_test/`: page objects in `screens/`, specs in `specs/`, helpers in `helpers/`, config in `wdio.conf.ts`. Page objects (a `BaseScreen` plus four screens) keep selectors out of the specs, and the scroll helper (`helpers/gestures.ts → scrollIntoView`) brings off-screen fields into view (WebdriverIO's `click` does not auto-scroll). Four specs — `login`, `home`, `forgot-password`, `register` — cover the same flows the harness has always exercised.

```typescript
import { loginScreen, homeScreen } from "../screens";
import { launchAppFresh } from "../helpers/app";
import { MESSAGES, VALID_LOGIN } from "../data/testData";

describe("Login", () => {
  beforeEach(async () => {
    await launchAppFresh();
    await loginScreen.waitUntilLoaded();
  });

  it("shows inline validation errors when submitting an empty form", async () => {
    await loginScreen.submit();
    expect(await loginScreen.emailErrorText()).toEqual(MESSAGES.login.invalidEmail);
    expect(await loginScreen.passwordErrorText()).toEqual(MESSAGES.login.passwordRequired);
  });

  it("navigates to Home with valid credentials", async () => {
    await loginScreen.login(VALID_LOGIN.email, VALID_LOGIN.password);
    await homeScreen.waitUntilLoaded();
    await expect(homeScreen.root).toBeDisplayed();
  });
});
```

Run with `npm run test:appium` (wraps `wdio run automation_test/wdio.conf.ts`). Appium is auto-started by `@wdio/appium-service` on `127.0.0.1:4723` — no separate server process to manage.

### Layer 5 — Per-test screenshot capture + inspection
The `afterTest` hook saves one screenshot per test case (pass or fail) into `automation_test/screenshots/`, then those PNGs are read to visually verify on-screen behavior (see below).

### Layer 6 — Visual regression (jest-image-snapshot)
The captured screenshots are diffed pixel-by-pixel against committed baselines under `__tests__/visual/__image_snapshots__/`. Closes the gap Appium can't fill — Appium asserts on `testID`/`text`, not pixels, so a button drifting 4 px or a color token swap looks "passing" to it. Visual regressions show up as ordinary Jest assertion failures, gated by the same `--ci` run as the other layers.

```bash
# Diff every captured Appium screenshot against its baseline
npx jest __tests__/visual/appium-screenshots-test.ts --ci --watchAll=false

# Accept intentional visual changes (after reviewing the *-diff.png)
npx jest __tests__/visual/appium-screenshots-test.ts -u
```

`__tests__/visual/appium-screenshots-test.ts` reads each PNG in `automation_test/screenshots/`, crops the Android status bar (clock, battery, signal) via `lib/visual/frameUtils.ts → cropTopRows()` — without that mask, per-run chrome drift would dominate every comparison — and diffs against `__tests__/visual/__image_snapshots__/appium-<test-title>.png`. On fresh checkouts with no screenshots yet, the suite reports as a single skipped test so CI stays green.

> Library choice: [`jest-image-snapshot`](https://github.com/americanexpress/jest-image-snapshot) over [`react-native-owl`](https://github.com/FormidableLabs/react-native-owl) — extends the existing `jest-expo` preset, consumes the screenshots Layer 5 already produces (no second device driver contending with Appium), works with the managed Expo workflow, actively maintained (Owl archived 2023).

---

## Test results & coverage

`npx jest --ci --watchAll=false` → **12 suites passing + 1 intentionally skipped (the `appium-screenshots-test.ts` conditional suite — engages only when screenshots exist), 60 tests passing**, 5 snapshots.

| Layer | File | % Stmts | % Branch | % Funcs | % Lines |
|-------|------|--------:|---------:|--------:|--------:|
| **All files** | — | **99.18** | **94.04** | **100** | **99.14** |
| Unit (logic) | `lib/authValidation.ts` | 100 | 100 | 100 | 100 |
| Unit (logic) | `components/RegisterForm/validation.ts` | 100 | 100 | 100 | 100 |
| Unit (visual) | `lib/visual/frameUtils.ts` | 100 | 100 | 100 | 100 |
| UI (screen) | `app/index.tsx` — Login | 100 | 100 | 100 | 100 |
| UI (screen) | `app/register.tsx` | 100 | 100 | 100 | 100 |
| UI (screen) | `app/forgot-password.tsx` | 100 | 100 | 100 | 100 |
| UI (screen) | `app/home.tsx` | 100 | 100 | 100 | 100 |
| UI (component) | `components/RegisterForm/index.tsx` | 100 | 100 | 100 | 100 |
| UI (component) | `components/ui/FormTextInput.tsx` | 100 | 100 | 100 | 100 |
| UI (component) | `components/ui/PrimaryButton.tsx` | 100 | 100 | 100 | 100 |
| UI (component) | `components/ui/AuthScreen.tsx` | 100 | 50 | 100 | 100 |
| Shared | `components/themed-text.tsx` | 100 | 90.9 | 100 | 100 |

**Unit coverage** (pure logic — validators) is **100%** across the board. **UI coverage** (screens + components) is **100% of statements/functions/lines**; the only sub-100% branch is `AuthScreen`'s optional `subtitle`/theme branch. The visual frame utility (`frameUtils.ts`) stays **100%**. Regenerate anytime with `npx jest --coverage` (HTML report at `coverage/lcov-report/index.html`).

> Navigation/theme scaffolding (`app/_layout.tsx`, `hooks/use-color-scheme.ts`) has no dedicated tests and is intentionally excluded from the goals above.
> The Appium suite uses a **separate type environment** — typecheck it with `npx tsc -p automation_test/tsconfig.json --noEmit` (the root `tsconfig` excludes `automation_test/`).

---

## Screenshot inspection (read the per-test PNGs)

You don't watch a recording — you read **images**. After an Appium run, each test has left exactly one PNG in `automation_test/screenshots/`, named by its full test title. Read them to confirm errors render, success/empty states appear, the right screen is shown, and there's **no redbox or ANR dialog**.

```bash
npm run test:appium                         # runs the suite; writes one PNG per test
ls automation_test/screenshots/             # e.g. login-navigates-to-home-with-valid-credentials.png
# read each PNG and verify the on-screen state matches the test's intent
```

Because the filename is the test's full title (`<describe>-<it>`, lowercased and dash-safe), the screenshot maps directly back to the spec that produced it — no timestamps to reconcile. Read the screenshot for each test, paying special attention to assertion failures and to flows where layout/keyboard behavior matters (lower fields, scrolled views).

To redirect the captures (e.g. into a CI artifact path) set `APPIUM_SHOT_DIR`:

```bash
APPIUM_SHOT_DIR="$PWD/artifacts/shots" npm run test:appium
```

---

## Error diagnosis — what to do when a flow fails

A failing Appium test, **or** any screenshot showing an ANR/redbox, means the run is not trustworthy even if some steps reported passing. The procedure:

1. **Read the spec reporter output** — WebdriverIO's `spec` reporter prints the failing `describe`/`it` and the assertion or selector that threw.
2. **Read the screenshot for that test** in `automation_test/screenshots/` — its name is the test's full title. It shows exactly what was on screen at the end of the test: wrong scroll position, keyboard covering a field, an ANR/redbox dialog, an unexpected screen.
3. **Fix in the page object, not the spec** — selectors and waits live in `automation_test/screens/`; the scroll helper lives in `automation_test/helpers/gestures.ts`. Bring off-screen fields into view with `scrollIntoView(testId)` before tapping/asserting.
4. **Re-run and re-inspect** the screenshot.

### Failure patterns (and the fixes)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Failed to create session` / Appium won't start | uiautomator2 driver missing, or port 4723 already in use | `appium driver install uiautomator2`; kill the stale Appium process so `@wdio/appium-service` can bind 4723 |
| `No devices found` / session targets nothing | No emulator/device attached, or `DEVICE_NAME` doesn't match | `adb devices`; start the `Pixel_9a` AVD (or set `DEVICE_NAME`/`APP_PACKAGE`/`APP_ACTIVITY` to match yours) |
| App not installed / activity not found | The managed Expo app isn't on the device (no committed `android/`) | `npx expo run:android`, or point `APP_PATH` at a prebuilt `.apk` to auto-install |
| `Element not found` for a lower field | WebdriverIO `click` doesn't auto-scroll; the field was off-screen / behind the keyboard | Use the page object + `scrollIntoView(testId)` (`helpers/gestures.ts`) before each field tap and assertion |

---

## Project structure

```
react-native-testing-sample/
├── README.md                     ← this overview
├── HARNESS_GUIDE.md              ← engineering deep-dive
├── jest.setup.ts                 ← registers toMatchImageSnapshot (Layer 6)
├── app/                          ← Expo Router screens (tab-less stack)
│   ├── _layout.tsx               ← Stack: index, register, forgot-password, home
│   ├── index.tsx                 ← Login
│   ├── register.tsx              ← Register
│   ├── forgot-password.tsx       ← Forgot Password
│   ├── home.tsx                  ← Home
│   └── __tests__/                ← screen UI tests + snapshots
├── lib/
│   ├── authValidation.ts         ← shared validators
│   ├── __tests__/
│   └── visual/
│       └── frameUtils.ts         ← cropTopRows + status-bar masking (Layer 6)
├── components/
│   ├── RegisterForm/             ← register form + validation + tests
│   └── ui/                       ← FormTextInput, PrimaryButton, AuthScreen (+ tests)
├── __tests__/visual/             ← visual regression layer (Layer 6)
│   ├── image-snapshot-matcher-test.ts   ← matcher wiring smoke test
│   ├── frameUtils-test.ts               ← cropTopRows unit tests
│   ├── appium-screenshots-test.ts       ← diffs Appium screenshots vs baselines
│   └── __image_snapshots__/             ← committed PNG baselines (regression contract)
├── automation_test/              ← Appium + WebdriverIO E2E suite (Layer 4/5)
│   ├── data/                     ← test data (credentials, expected messages)
│   ├── helpers/
│   │   ├── selectors.ts          ← byTestId / UiScrollable selector builders
│   │   ├── gestures.ts           ← setField, hideKeyboard, scrollIntoView
│   │   └── app.ts                ← launchAppFresh + app lifecycle
│   ├── screens/                  ← page objects: BaseScreen + 4 screens + index
│   ├── specs/                    ← login / home / forgot-password / register *.e2e.ts
│   ├── wdio.conf.ts              ← WDIO config + afterTest screenshot hook (Layer 5)
│   ├── tsconfig.json             ← separate type environment for the suite
│   ├── screenshots/              ← per-test PNGs (git-ignored, regenerated each run)
│   └── README.md                 ← suite-specific notes
└── .skills/
    └── harness-engineering/      ← TDD + Appium + screenshot-inspection harness skill
```

---

## Common commands

```bash
npx jest --ci --watchAll=false                          # all jest layers (incl. visual)
npx jest app/__tests__/login-screen-test.tsx            # one suite
npx jest __tests__/visual/ --ci                         # visual regression only (Layer 6)
npx jest --updateSnapshot                               # accept intentional snapshot changes
npx jest __tests__/visual/appium-screenshots-test.ts -u # accept intentional visual changes
npx tsc --noEmit                                        # type check app + Jest layers
npx tsc -p automation_test/tsconfig.json --noEmit       # type check the Appium suite
npm run test:appium                                     # run the Appium E2E suite (captures screenshots)
npx wdio run automation_test/wdio.conf.ts               # same, directly
ls automation_test/screenshots/                         # list captured per-test PNGs
```

---

## Execution pipeline

```
START
  ├─► Jest (unit + UI + snapshots) + tsc            ← green gate
  ├─► Device check (adb devices)
  ├─► npm run test:appium  (Appium + WebdriverIO, UiAutomator2)
  ├─► afterTest hook: save ONE PNG per test → automation_test/screenshots/
  ├─► READ screenshots → verify on-screen behavior    ← required, not optional
  ├─► jest-image-snapshot pixel diff → catch visual drift (Layer 6)
  └─► attach screenshots + *-diff.png to issue tracker (Linear)
END
```

---

## Troubleshooting

```bash
# Device not connected
adb devices

# Jest failures (verbose)
npx jest --verbose --watchAll=false

# Appium session won't start → install the driver / free port 4723
appium driver install uiautomator2

# App not installed (managed Expo, no committed android/) → build + install
npx expo run:android

# Appium element not found → it doesn't auto-scroll; use scrollIntoView in the page object

# Inspect the captured screenshots
ls automation_test/screenshots/

# Override the screenshot output directory
APPIUM_SHOT_DIR="$PWD/artifacts/shots" npm run test:appium
```

---

## Best practices

- ✅ TDD: write a failing test first (Red → Green → Refactor)
- ✅ Stable `testID`s for every E2E assertion
- ✅ Keep selectors in the page objects (`automation_test/screens/`); keep specs intent-only
- ✅ `scrollIntoView(testId)` before lower fields/asserts (Appium does not auto-scroll)
- ✅ Read the per-test screenshot — don't trust a green E2E log alone
- ✅ Update snapshots only for intentional changes (structural **and** visual)
- ✅ Visual regression: mask the status bar, attach `*-diff.png` artifacts on failure

---

## Deep dive

See **[HARNESS_GUIDE.md](./HARNESS_GUIDE.md)** for architecture, design principles, timing analysis, and the full diagnostics playbook.

## References

- [Jest](https://jestjs.io/) · [React Native Testing Library](https://callstack.github.io/react-native-testing-library/) · [Appium](https://appium.io/) · [WebdriverIO](https://webdriver.io/) · [ADB](https://developer.android.com/tools/adb) · [Expo](https://docs.expo.dev/) · [jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot)

---

**Harness Version**: 3.0 · **Stack**: React Native + Expo Router + Jest + Appium + WebdriverIO + jest-image-snapshot

---

## Harness engineering for agentic AI coding

When an AI agent generates code, the harness is what makes its output trustworthy:

1. **Verification without human review** — jest + tsc gate every change; the Appium run + per-test screenshots prove real behavior.
2. **Deterministic feedback loop** — clear pass/fail plus visual evidence guide the next iteration.
3. **Safety through layers** — unit → UI → structural snapshot → E2E → screenshot-and-inspected → **visual regression** (pixel diff).
4. **Trust through artifacts** — each test's screenshot is attached to its tracker issue, the screenshots are inspected (and, on failure, read against the spec), **and** every one is diffed against a committed baseline. A green E2E log no longer ends the trust chain; the pixels do.

```
AGENT CODE  →  HARNESS (jest · tsc · appium · screenshot · pixel diff)  →  PASS/FAIL + screenshots + *-diff.png  →  next iteration
```

Reference: OpenAI — [Harness Engineering for AI](https://openai.com/index/harness-engineering/).
